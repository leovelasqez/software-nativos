import loyaltyContract from '../../contracts/loyalty-v1.schema.json' with {type:'json'};
import { loyaltyCache } from './loyalty-api.ts';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { audit, principal, transaction } from './db.ts';
import type { Actor, UserRow } from './db.ts';
import { ApiError, authenticate, requireAccess, requireAdmin, tokenHash, notFound } from './security.ts';
import { routeSchema } from './api-contract.ts';
import { isOperation, WEEK_MS } from '../contracts.ts';
import type { Operation } from '../contracts.ts';
import { calculateSale } from '../pos-domain.ts';
import { isPosEvent } from '../pos-contract.ts';
import type { Authorization, Signed, Snapshot } from '../pos-domain.ts';
import { payloadHash, signAuthorization, verifyAuthorization } from '../pos-crypto.ts';
import { handleOrdersSync } from './orders-sync.ts';
import { CatalogError, decimal, formatted } from '../catalog.ts';
import { queueShiftClosed } from './notifications-api.ts';
import { isWithinGrantClock } from '../authorization.ts';
import { sharedShifts } from './shift-continuation.ts';

async function key(c: PoolClient) {
  let row = (await c.query('SELECT * FROM pos_signing_key')).rows[0] as { public_key: string; private_key: string } | undefined;
  if (!row) {
    const pair = generateKeyPairSync('ed25519');
    row = { public_key: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
    await c.query('INSERT INTO pos_signing_key(public_key,private_key) VALUES($1,$2)', [row.public_key, row.private_key]);
  }
  return row;
}
async function terminal(c: PoolClient, req: FastifyRequest, deviceId: string) {
  const token = req.headers['x-pos-token'];
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'device_auth', 'Activa esta caja con el dueño.');
  const t = (await c.query(`SELECT t.*,d.branch_id,d.active AS device_active FROM pos_terminals t JOIN devices d ON d.id=t.device_id WHERE t.device_id=$1 AND t.token_hash=$2`, [deviceId, tokenHash(token)])).rows[0];
  if (!t || !t.active || !t.device_active) throw new ApiError(403, 'device_revoked', 'El equipo no está autorizado. Se conservarán las operaciones pendientes.');
  return t;
}
async function snapshot(c: PoolClient, device: { device_id: string; branch_id: string; last_sequence: string; last_operation_id: string | null }): Promise<Snapshot> {
  const warehouse = (await c.query('SELECT id FROM warehouses WHERE branch_id=$1 AND is_default', [device.branch_id])).rows[0]; if (!warehouse) throw notFound();
  const products = (await c.query(`SELECT v.data,p.active_recipe_version FROM catalog_products p JOIN product_versions v ON v.product_id=p.id AND v.version=p.current_version WHERE p.archived_at IS NULL ORDER BY p.id`)).rows.map(r => ({ ...r.data, activeRecipeVersion: r.active_recipe_version, sellable: r.data.type === 'finished' || r.active_recipe_version !== null }));
  const recipes = (await c.query('SELECT r.data FROM recipe_versions r JOIN catalog_products p ON p.id=r.product_id AND p.active_recipe_version=r.version ORDER BY r.product_id')).rows.map(r => r.data);
  const stock = (await c.query(`SELECT i.id AS "itemId",coalesce(sum(m.quantity),0)::text AS quantity FROM inventory_items i LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=$1 GROUP BY i.id ORDER BY i.id`, [warehouse.id])).rows;
  const snapshotId = payloadHash(JSON.stringify({ deviceId: device.device_id, warehouseId: warehouse.id, sequence: device.last_sequence, operationId: device.last_operation_id, products, recipes, stock }));
  const existing = (await c.query('SELECT data FROM pos_snapshots WHERE id=$1', [snapshotId])).rows[0]; if (existing) return existing.data as Snapshot;
  const data: Snapshot = { id: snapshotId, createdAtMs: Date.now(), branchId: device.branch_id, deviceId: device.device_id, warehouseId: warehouse.id, serverSequence: Number(device.last_sequence), serverOperationId: device.last_operation_id, products, recipes, stock };
  await c.query('INSERT INTO pos_snapshots(id,device_id,data) VALUES($1,$2,$3)', [data.id, device.device_id, JSON.stringify(data)]); return data;
}
export function registerPos(app: FastifyInstance, pool: Pool) {
  async function tx<T>(run: (c: PoolClient) => Promise<T>) {
    try { return await transaction(pool, async c => { await c.query('SELECT pg_advisory_xact_lock(7301)'); return run(c); }); }
    catch (e) { if (e instanceof CatalogError) throw new ApiError(422, 'invalid_payload', e.message); throw e; }
  }
  app.post('/api/pos/enroll', { schema: routeSchema('/api/pos/enroll', 'post') }, req => tx(async c => {
    const actor = await authenticate(c, req);
    requireAdmin(actor);
    const b = req.body as { deviceId: string; installationId: string };
    const device = (await c.query('SELECT * FROM devices WHERE id=$1 AND active', [b.deviceId])).rows[0]; if (!device) throw notFound(); requireAccess(actor, device.branch_id);
    const token = randomBytes(32).toString('base64url');
    await c.query('INSERT INTO pos_terminals(device_id,installation_id,token_hash) VALUES($1,$2,$3) ON CONFLICT(device_id,installation_id) DO UPDATE SET token_hash=$3', [device.id, b.installationId, tokenHash(token)]);
    await audit(c, actor, 'pos.enrolled', 'Vinculación de instalación local', { deviceId: device.id, installationId: b.installationId }, device.branch_id);
    return { deviceId: device.id, branchId: device.branch_id, installationId: b.installationId, token, publicKey: (await key(c)).public_key };
  }));
  app.post('/api/pos/authorize', { schema: routeSchema('/api/pos/authorize', 'post') }, req => tx(async c => {
    const b = req.body as { deviceId: string; previous: Signed | null }; const device = await terminal(c, req, b.deviceId); const keys = await key(c);
    let actor: Actor;
    if (req.cookies.nativos_session) actor = await authenticate(c, req);
    else {
      if (!b.previous) throw new ApiError(401, 'login_required', 'Inicia sesión online.');
      let previous: Authorization;
      try { previous = verifyAuthorization(b.previous, keys.public_key); } catch { throw new ApiError(403, 'invalid_grant', 'Concesión inválida.'); }
      if (previous.grant.deviceId !== device.device_id || previous.grant.branchId !== device.branch_id || Date.now() >= previous.grant.expiresAtMs) throw new ApiError(401, 'login_required', 'Revalida el acceso con tu contraseña online.');
      const user = (await c.query<UserRow>('SELECT * FROM app_users WHERE id=$1 AND active', [previous.grant.actorId])).rows[0];
      if (!user) throw new ApiError(403, 'user_revoked', 'El acceso del usuario fue revocado.');
      actor = { user, deviceId: device.device_id, tokenHash: '' };
    }
    requireAccess(actor, device.branch_id); const now = Date.now();
    const authorization: Authorization = { principal: principal(actor.user), actorName: actor.user.name,
      grant: { version: 1, grantId: randomUUID(), actorId: actor.user.id, branchId: device.branch_id, deviceId: device.device_id, validatedAtMs: now, expiresAtMs: now + WEEK_MS, actions: actor.user.actions.filter(a => ['data.read','order.write','sale.charge','shift.open','shift.close','sale.discount','sale.cancel','sale.refund','cash.movement'].includes(a)) } };
    const openShift = (await c.query('SELECT s.id,s.actor_id AS "actorId",u.name AS "actorName" FROM pos_shifts s JOIN app_users u ON u.id=s.actor_id WHERE s.device_id=$1 AND s.closed_at IS NULL', [device.device_id])).rows[0] ?? null;
    return { signed: signAuthorization(authorization, keys.private_key), snapshot: await snapshot(c, device), customers: (await c.query('SELECT data FROM customers ORDER BY id')).rows.map(r=>r.data), loyalty:await loyaltyCache(c), openShift, sharedShifts:await sharedShifts(c,device.device_id,device.installation_id,actor.user.id) };
  }));
  app.post('/api/pos/shift/resume', {schema:routeSchema('/api/pos/shift/resume','post')}, req=>tx(async c=>{
    const actor=await authenticate(c,req),b=req.body as {deviceId:string;shiftId:string};
    const device=await terminal(c,req,b.deviceId);
    requireAccess(actor,device.branch_id,'shift.open');requireAccess(actor,device.branch_id,'sale.charge');
    const shift=(await c.query('SELECT * FROM pos_shifts WHERE id=$1 AND device_id=$2 AND closed_at IS NULL',[b.shiftId,device.device_id])).rows[0];
    if(!shift)throw new ApiError(409,'shift_conflict','El turno ya está cerrado o pertenece a otra caja.');
    if(shift.actor_id!==actor.user.id)throw new ApiError(403,'scope_denied','Inicia sesión con el responsable del turno para continuarlo.');
    if(shift.installation_id!==device.installation_id&&!shift.resumed_installations.includes(device.installation_id)){
      await c.query('UPDATE pos_shifts SET resumed_installations=array_append(resumed_installations,$2) WHERE id=$1',[shift.id,device.installation_id]);
      await audit(c,actor,'pos.shift.resumed','Continuación del mismo turno en otro navegador',{shiftId:shift.id,installationId:device.installation_id},device.branch_id);
    }
    return {id:shift.id};
  }));
  app.post('/api/pos/redemption/cancel',{schema:{body:loyaltyContract.cancel}},req=>tx(async c=>{
    const b=req.body as {operationId:string;deviceId:string;signed:Signed};const device=await terminal(c,req,b.deviceId);const a=verifyAuthorization(b.signed,(await key(c)).public_key);if(a.grant.deviceId!==device.device_id||a.grant.branchId!==device.branch_id)throw new ApiError(403,'scope_denied','Concesión de otra caja.');
    const old=(await c.query('SELECT response,installation_id FROM pos_receipts WHERE operation_id=$1 AND device_id=$2',[b.operationId,b.deviceId])).rows[0];if(old){if(old.installation_id!==device.installation_id)throw new ApiError(403,'scope_denied','Operación de otro navegador.');return {committed:true,response:old.response};}
    const prior=(await c.query('SELECT * FROM loyalty_cancellations WHERE operation_id=$1',[b.operationId])).rows[0];if(prior&&(prior.device_id!==b.deviceId||prior.actor_id!==a.grant.actorId))throw new ApiError(403,'scope_denied','Operación de otro usuario.');
    await c.query('INSERT INTO loyalty_cancellations VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[b.operationId,b.deviceId,a.grant.actorId]);return {committed:false};
  }));
  app.post('/api/pos/sync', { schema: routeSchema('/api/pos/sync', 'post'), bodyLimit: 1_100_000 }, req => tx(async c => {
    const b = req.body as { operation: Operation; payload: string; signed: Signed }; const o = b.operation;
    if (!isOperation(o) || payloadHash(b.payload) !== o.payloadHash) throw new ApiError(422, 'invalid_payload', 'Hash o envoltura inválida.');
    const device = await terminal(c, req, o.deviceId);
    if ((await c.query('SELECT 1 FROM loyalty_cancellations WHERE operation_id=$1',[o.operationId])).rowCount) throw new ApiError(409,'redemption_cancelled','El canje fue cancelado antes de cobrarse.');
    const fingerprint = payloadHash(JSON.stringify(o) + b.payload + b.signed.document + b.signed.signature);
    const old = (await c.query('SELECT * FROM pos_receipts WHERE operation_id=$1', [o.operationId])).rows[0];
    if (old) { if (old.device_id !== o.deviceId || old.installation_id !== device.installation_id) throw new ApiError(403, 'scope_denied', 'Operación de otro navegador.'); if (old.fingerprint !== fingerprint) throw new ApiError(409, 'operation_conflict', 'La operación ya existe con otro contenido.'); return old.response; }
    if (o.sequence <= Number(device.last_sequence)) throw new ApiError(409, 'sequence_conflict', 'La secuencia ya fue utilizada por otra operación.');
    if (o.sequence !== Number(device.last_sequence) + 1 || o.previousOperationId !== device.last_operation_id) throw new ApiError(409, 'predecessor_required', 'Se requiere la operación previa de esta caja.');
    let authorization: Authorization;
    try { authorization = verifyAuthorization(b.signed, (await key(c)).public_key); } catch { throw new ApiError(403, 'invalid_grant', 'Firma de autorización inválida.'); }
    const grant = authorization.grant;
    if (grant.actorId !== o.actorId || grant.deviceId !== o.deviceId || grant.branchId !== o.branchId || device.branch_id !== o.branchId) throw new ApiError(403, 'scope_denied', 'Usuario, caja o sucursal no coinciden.');
    let payload: unknown; try { payload = JSON.parse(b.payload); } catch { throw new ApiError(422, 'invalid_payload', 'Contenido inválido.'); }
    if (o.payloadVersion === 2 || o.payloadVersion === 3) {
      if(o.payloadVersion===3&&(payload as {loyalty?:{redeemedPoints:string}}).loyalty?.redeemedPoints!=='0'&&(payload as {loyalty?:unknown}).loyalty){if(Date.now()>=grant.expiresAtMs)throw new ApiError(403,'grant_expired','Revalida el acceso para canjear.');}
      const response = await handleOrdersSync(c,o,payload,authorization,device.installation_id);
      await c.query('INSERT INTO pos_receipts(operation_id,device_id,sequence,fingerprint,response,installation_id) VALUES($1,$2,$3,$4,$5,$6)',[o.operationId,o.deviceId,o.sequence,fingerprint,JSON.stringify(response),device.installation_id]);
      await c.query('UPDATE pos_terminals SET last_sequence=$2,last_operation_id=$3,last_sync_at=now() WHERE device_id=$1 AND installation_id=$4',[o.deviceId,o.sequence,o.operationId,device.installation_id]); return response;
    }
    if (!isPosEvent(payload)) throw new ApiError(422, 'invalid_payload', 'Formato de operación inválido.');
    if (!grant.actions.includes(payload.kind) || !isWithinGrantClock(payload.occurredAtMs, grant.validatedAtMs) || payload.occurredAtMs > Date.now() + 300_000 || payload.kind !== 'shift.close' && payload.occurredAtMs >= grant.expiresAtMs) throw new ApiError(403, 'grant_denied', 'La operación está fuera de la autorización registrada.');
    const user = (await c.query<UserRow>('SELECT * FROM app_users WHERE id=$1', [o.actorId])).rows[0]; if (!user) throw notFound();
    const reviewRequired = !user.active || !user.branch_ids.includes(o.branchId) || !user.actions.includes(payload.kind);
    const actor: Actor = { user, deviceId: o.deviceId, tokenHash: '' }; const occurred = new Date(payload.occurredAtMs);
    if (payload.kind === 'shift.open') {
      if ((await c.query('SELECT 1 FROM pos_shifts WHERE device_id=$1 AND closed_at IS NULL', [o.deviceId])).rowCount) throw new ApiError(409, 'shift_conflict', 'La caja ya tiene un turno activo.');
      await c.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,installation_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [payload.shiftId, o.deviceId, o.branchId, o.actorId, payload.openingCash, occurred,device.installation_id]);
    } else {
      const shift = (await c.query('SELECT * FROM pos_shifts WHERE id=$1 AND device_id=$2 AND actor_id=$3 AND (installation_id=$4 OR $4=ANY(resumed_installations)) AND closed_at IS NULL', [payload.shiftId, o.deviceId, o.actorId,device.installation_id])).rows[0];
      if (!shift) throw new ApiError(409, 'shift_conflict', 'El turno no pertenece al usuario o ya está cerrado.');
      if (occurred.getTime() < shift.opened_at.getTime()) throw new ApiError(422, 'invalid_time', 'La operación precede a la apertura.');
      if (payload.kind === 'sale.charge') {
        const snap = (await c.query('SELECT data FROM pos_snapshots WHERE id=$1 AND device_id=$2', [payload.snapshotId, o.deviceId])).rows[0]?.data as Snapshot | undefined;
        if (!snap || snap.branchId !== o.branchId || snap.createdAtMs > payload.occurredAtMs) throw new ApiError(422, 'snapshot_missing', 'Versión de catálogo desconocida.');
        const history = (await c.query('SELECT data FROM pos_snapshots WHERE id=ANY($1::text[]) AND device_id=$2', [[...new Set(payload.lines.map(l => l.snapshotId))], o.deviceId])).rows.map(r => r.data as Snapshot);
        if (history.some(s => s.branchId !== o.branchId || s.createdAtMs > payload.occurredAtMs)) throw new ApiError(422, 'snapshot_invalid', 'Versión de línea inválida.');
        if ((await c.query('SELECT 1 FROM pos_sales WHERE order_id=$1', [payload.orderId])).rowCount) throw new ApiError(409, 'order_already_charged', 'Este pedido ya tiene un cobro confirmado.');
        const sale = calculateSale(snap, payload.lines, payload.payment, history);
        const receiptNumber = `${o.branchId}-${o.deviceId}-${device.installation_id}-${o.sequence}`;
        const data = { id: o.operationId, receiptNumber, occurredAtMs: payload.occurredAtMs, actorName: authorization.actorName, branchId: o.branchId, deviceId: o.deviceId, payment: payload.payment, ...sale };
        await c.query('INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [o.operationId, payload.orderId, payload.shiftId, o.deviceId, o.branchId, o.actorId, receiptNumber, JSON.stringify(data), sale.cashApplied, occurred, reviewRequired]);
        for (const [i, item] of sale.consumption.entries()) await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,reason,sale_id,created_at) VALUES($1,$2,$3,'sale',-$4::numeric,'Consumo por cobro',$5,$6)`, [`${o.operationId}-stock-${i}`, item.itemId, snap.warehouseId, item.quantity, o.operationId, occurred]);
      } else if (payload.kind === 'cash.movement') {
        if (!payload.reason.trim() || payload.reason.trim().length < 3 || payload.reason.length > 500 || decimal(payload.amount) <= 0n) throw new ApiError(422, 'invalid_payload', 'Revisa importe y motivo del movimiento.');
        let cashDelta = payload.method === 'cash' ? (payload.class === 'income' ? decimal(payload.amount) : -decimal(payload.amount)) : 0n;
        if (payload.class === 'correction') {
          if (!payload.reversesMovementId) throw new ApiError(422, 'invalid_payload', 'La corrección debe indicar el movimiento original.');
          const original = (await c.query('SELECT * FROM pos_cash_movements WHERE id=$1 AND shift_id=$2 AND amount=$3::numeric', [payload.reversesMovementId, payload.shiftId, payload.amount])).rows[0];
          if (!original || original.reverses_id || String(original.payment_method) !== payload.method) throw new ApiError(422, 'invalid_payload', 'La corrección no coincide con un movimiento vigente del turno.');
          if ((await c.query('SELECT 1 FROM pos_cash_movements WHERE reverses_id=$1', [payload.reversesMovementId])).rowCount)
            throw new ApiError(409, 'movement_already_corrected', 'El movimiento ya tiene una corrección registrada.');
          cashDelta = payload.method === 'cash' ? (original.class === 'income' ? -decimal(payload.amount) : decimal(payload.amount)) : 0n;
        } else if (payload.reversesMovementId) throw new ApiError(422, 'invalid_payload', 'Solo una corrección puede referenciar otro movimiento.');
        await c.query(`INSERT INTO pos_cash_movements(id,shift_id,device_id,branch_id,actor_id,class,payment_method,amount,cash_delta,reverses_id,reason,occurred_at,data)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [payload.movementId, payload.shiftId, o.deviceId, o.branchId, o.actorId, payload.class, payload.method, payload.amount, formatted(cashDelta), payload.reversesMovementId, payload.reason.trim(), occurred, JSON.stringify(payload)]);
      } else {
        await c.query(`UPDATE pos_shifts SET closed_at=$2,counted=$3,expected=opening_cash+(SELECT coalesce(sum(cash_applied),0) FROM pos_sales WHERE shift_id=$1)+(SELECT coalesce(sum(cash_applied),0) FROM pos_refunds WHERE shift_id=$1)+(SELECT coalesce(sum(cash_delta),0) FROM pos_cash_movements WHERE shift_id=$1),difference=$3::numeric-opening_cash-(SELECT coalesce(sum(cash_applied),0) FROM pos_sales WHERE shift_id=$1)-(SELECT coalesce(sum(cash_applied),0) FROM pos_refunds WHERE shift_id=$1)-(SELECT coalesce(sum(cash_delta),0) FROM pos_cash_movements WHERE shift_id=$1) WHERE id=$1`, [payload.shiftId, occurred, payload.counted]);
        await queueShiftClosed(c, payload.shiftId);
      }
    }
    const response = { kind: 'accepted', receipt: o, reviewRequired };
    await c.query('INSERT INTO pos_receipts(operation_id,device_id,sequence,fingerprint,response,installation_id) VALUES($1,$2,$3,$4,$5,$6)', [o.operationId, o.deviceId, o.sequence, fingerprint, JSON.stringify(response),device.installation_id]);
    await c.query('UPDATE pos_terminals SET last_sequence=$2,last_operation_id=$3,last_sync_at=now() WHERE device_id=$1 AND installation_id=$4', [o.deviceId, o.sequence, o.operationId,device.installation_id]);
    await audit(c, actor, payload.kind, 'Operación confirmada en caja local', { operationId: o.operationId, shiftId: payload.shiftId, reviewRequired, receipt: o }, o.branchId, [o.branchId]);
    return response;
  }));
  app.get('/api/pos/sales', { schema: routeSchema('/api/pos/sales', 'get') }, async req => {
    const { branchId, after } = req.query as { branchId: string; after?: string }; const actor = await authenticate(pool, req); requireAccess(actor, branchId);
    const rows = (await pool.query('SELECT id,data,review_required FROM pos_sales WHERE branch_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT 51', [branchId, after ?? null])).rows;
    return { items: rows.slice(0,50).map(r => ({ ...r.data, reviewRequired: r.review_required })), nextCursor: rows.length > 50 ? rows[49].id : null };
  });
}
