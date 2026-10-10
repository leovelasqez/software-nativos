import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { payloadHash, verifyAuthorization } from '../../src/pos-crypto.ts';
import { upgradeOrder } from '../../src/orders-domain.ts';
import type { Signed, Snapshot } from '../../src/pos-domain.ts';

test('AC-019 — seguridad, informes y contratos contra PostgreSQL real', { timeout: 180_000 }, async t => {
  const db = await startLocalPostgres(resolve('.local/code-audit-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  const setupToken = randomBytes(32).toString('base64url');
  const password = randomBytes(24).toString('base64url');
  const origin = 'https://audit.nativos.example';
  const app = await createApp({ pool: db.pool, origin, setupToken });
  let cookie = ''; let ownerId = '';
  let address = 1;
  const request = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object, extra: Record<string, string> = {}) => app.inject({
    method, url, ...(payload ? { payload } : {}), remoteAddress: `127.3.0.${address++}`,
    headers: { host: 'audit.nativos.example', 'x-nativos-request': '1', cookie, ...extra },
  });
  const common = () => ({ branchId: 'centro', operationId: randomUUID(), reason: 'Revisión sintética del código' });
  try {
    await migrate(db.pool);
    await t.test('AC-019-02: bootstrap cerrado sin clave externa; clave correcta configura una sola vez', async () => {
      const input = { name: 'Dueño Auditoría', login: 'owner-audit', password };
      const closed = await createApp({ pool: db.pool, origin });
      try {
        const status = await closed.inject({ method: 'GET', url: '/api/status', headers: { host: 'audit.nativos.example' } });
        assert.deepEqual(status.json(), { setupRequired: true, setupTokenRequired: true });
        const denied = await closed.inject({ method: 'POST', url: '/api/setup', payload: { ...input, setupToken }, headers: { host: 'audit.nativos.example', 'x-nativos-request': '1' } });
        assert.equal(denied.statusCode, 403);
      } finally { await closed.close(); }
      for (const key of [undefined, randomBytes(32).toString('base64url')]) {
        const denied = await request('POST', '/api/setup', { ...input, ...(key ? { setupToken: key } : {}) });
        assert.equal(denied.statusCode, 403);
        assert.doesNotMatch(denied.body, new RegExp(setupToken));
      }
      assert.equal((await db.pool.query('SELECT count(*) FROM app_users')).rows[0].count, '0');
      assert.equal((await db.pool.query('SELECT count(*) FROM sessions')).rows[0].count, '0');
      const setup = await request('POST', '/api/setup', { ...input, setupToken });
      assert.equal(setup.statusCode, 201);
      assert.match(String(setup.headers['set-cookie']), /Secure/);
      cookie = `nativos_session=${setup.cookies[0]!.value}`;
      ownerId = (await request('GET', '/api/me')).json().user.id as string;
      assert.equal(setup.json().actorId, ownerId);
      assert.equal((await request('POST', '/api/setup', { ...input, setupToken })).statusCode, 409);
      assert.deepEqual((await request('GET', '/api/status')).json(), { setupRequired: false });
      const audit = (await db.pool.query('SELECT actor_kind,changes FROM audit_events')).rows;
      assert.ok(audit.every(row => row.actor_kind === 'human'));
      assert.ok(!JSON.stringify(audit).includes(setupToken));
      const local = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4385' });
      try {
        const login = await local.inject({ method: 'POST', url: '/api/login', payload: { login: input.login, password }, headers: { host: '127.0.0.1:4385', 'x-nativos-request': '1' } });
        assert.equal(login.statusCode, 200);
        assert.equal(login.json().actorId, ownerId);
      } finally { await local.close(); }
    });
    await t.test('AC-019-04/05: agente bien auditado, cursor compuesto y reversión de inicial importado', async () => {
      const created = await request('POST', '/api/agents', { name: 'Agente auditoría', branchIds: ['centro'], actions: ['data.read', 'inventory.manage', 'product.create', 'recipe.create'], reason: 'Agente sintético para pruebas' });
      assert.equal(created.statusCode, 201);
      const agent = created.json() as { id: string; token: string };
      const headers = { authorization: `Bearer ${agent.token}` };
      for (const id of ['audit-item-a', 'audit-item-b']) await db.pool.query('INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$1,$1,\'raw\',\'unit\')', [id]);
      const first = await request('GET', '/api/agent/v1/inventory?branchId=centro&limit=1', undefined, headers);
      assert.equal(first.statusCode, 200); assert.equal(first.json().nextCursor, 'centro-venta:audit-item-a');
      const second = await request('GET', '/api/agent/v1/inventory?branchId=centro&limit=1&after=' + encodeURIComponent(first.json().nextCursor as string), undefined, headers);
      assert.equal(second.statusCode, 200); assert.equal(second.json().items[0].itemId, 'audit-item-b'); assert.equal(second.json().nextCursor, null);
      assert.equal((await request('GET', '/api/agent/v1/products?branchId=centro&after=centro-venta:audit-item-a', undefined, headers)).statusCode, 400);
      const draft = { kind: 'inventory', operationId: randomUUID(), branchId: 'centro', reason: 'Inicial sintético importado', rows: [{ row: 2, kind: 'initial', itemId: 'audit-item-a', warehouseId: 'centro-venta', quantity: '3', unit: 'unit', reason: 'Cantidad revisada' }] };
      const preview = await request('POST', '/api/agent/v1/imports/preview', draft, headers); assert.equal(preview.json().valid, true);
      const imported = await request('POST', '/api/agent/v1/imports/confirm', { ...draft, previewFingerprint: preview.json().previewFingerprint }, headers); assert.equal(imported.statusCode, 200);
      const events = (await db.pool.query('SELECT actor_kind FROM audit_events WHERE actor_id=$1', [agent.id])).rows;
      assert.ok(events.length > 0); assert.ok(events.every(row => row.actor_kind === 'agent'));
      const initial = (await db.pool.query("SELECT id FROM inventory_movements WHERE item_id='audit-item-a' AND kind='import_initial'")).rows[0].id as string;
      const reversed = await request('POST', '/api/warehouses/centro-venta/reversals', { ...common(), movementId: initial }); assert.equal(reversed.statusCode, 200); assert.equal(reversed.json().quantity, '-3.000000');
      assert.equal((await request('POST', '/api/warehouses/centro-venta/reversals', { ...common(), movementId: initial })).statusCode, 409);
      const replacement = await request('POST', '/api/warehouses/centro-venta/initial', { ...common(), itemId: 'audit-item-a', quantity: '5', unit: 'unit', conversion: null, unitCost: null }); assert.equal(replacement.statusCode, 200);
      const product = await request('POST', '/api/products', { ...common(), type: 'prepared', reference: 'AUDIT-PREP', name: 'Preparado sintético', category: 'Prueba', presentation: 'Unidad', unit: 'unit', price: '100', tax: null, description: '' }); assert.equal(product.statusCode, 200);
      const productId = product.json().id as string;
      const recipe = await request('POST', `/api/products/${productId}/recipes`, { ...common(), name: 'Receta sintética', instructions: '', state: 'active', expectedActiveVersion: 0, lines: [{ id: 'ingredient', itemId: 'audit-item-a', quantity: '1', unit: 'unit', conversion: null, kind: 'ingredient' }], options: [] }); assert.equal(recipe.statusCode, 200);
      assert.equal((await request('GET', '/api/agent/v1/products?branchId=centro', undefined, headers)).json().items.length, 1);
      assert.equal((await request('GET', '/api/agent/v1/recipes?branchId=centro', undefined, headers)).json().items.length, 1);
      await db.pool.query('UPDATE catalog_products SET archived_at=now() WHERE id=$1', [productId]);
      await db.pool.query("UPDATE inventory_items SET archived_at=now() WHERE id='audit-item-b'");
      assert.equal((await request('GET', '/api/agent/v1/products?branchId=centro', undefined, headers)).json().items.length, 0);
      assert.equal((await request('GET', '/api/agent/v1/recipes?branchId=centro', undefined, headers)).json().items.length, 0);
      assert.equal((await request('GET', '/api/agent/v1/inventory?branchId=centro', undefined, headers)).json().items.length, 1);
    });
    await t.test('AC-019-05: notificaciones recorren UUID y consultas inválidas devuelven 400', async () => {
      for (let i = 1; i <= 3; i++) await db.pool.query("INSERT INTO notification_intents(id,dedupe_key,type,branch_id,causal_id,recipient_role,state,data) VALUES($1,$1,'shift_closed','centro',$1,'owner','failed_terminal','{}')", [`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`]);
      let after: string | null = null; const seen: string[] = [];
      do {
        const page = await request('GET', '/api/notifications?branchId=centro&state=failed_terminal&limit=1' + (after ? '&after=' + encodeURIComponent(after) : ''));
        assert.equal(page.statusCode, 200); seen.push(...page.json().items.map((item: { id: string }) => item.id)); after = page.json().nextCursor as string | null;
        assert.ok(seen.length <= 3, 'No repetir la primera página');
      } while (after);
      assert.equal(new Set(seen).size, 3);
      for (const suffix of ['limit=abc', 'limit=1.5', 'limit=0', 'limit=101', 'from=2026-02-30', 'from=0000-01-01', 'after=bad/cursor'])
        assert.equal((await request('GET', '/api/reports/sales?branchId=centro&' + suffix)).statusCode, 400, suffix);
      assert.equal((await request('GET', '/api/notifications?branchId=centro&after=bad/cursor')).statusCode, 400);
    });
    await t.test('AC-019-05: totales grandes exactos, compras por medio real y puntos sin venta', async () => {
      await db.pool.query("INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES('audit-report-shift','centro-caja','centro',$1,0,'2020-01-01T12:00:00Z','2020-01-01T13:00:00Z',0,0,0)", [ownerId]);
      const sale = { id: 'audit-report-sale', products: '1000000000.123456', discount: '0', tipPaid: '0', shippingPaid: '0', cashApplied: '999999999.111111', payments: [{ method: 'cash', applied: '999999999.111111' }, { method: 'nequi', applied: '1.012345' }], lines: [] };
      await db.pool.query("INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES('audit-report-sale','audit-report-order','audit-report-shift','centro-caja','centro',$1,'audit-report-receipt',$2,999999999.111111,'2020-01-01T12:00:00Z',false)", [ownerId, JSON.stringify(sale)]);
      const sales = await request('GET', '/api/reports/sales?branchId=centro'); assert.equal(sales.statusCode, 200);
      assert.equal(sales.json().totals.products, '1000000000.123456'); assert.equal(sales.json().totals.cash, '999999999.111111'); assert.equal(sales.json().totals.digital, '1.012345');
      const legacy = { id: 'Audit-report-sale', subtotal: '100', total: '100', rounding: '0', cashApplied: '0', change: '0', payment: { method: 'card', received: '100' }, lines: [{ id: 'legacy-line', productId: 'legacy-product', snapshotId: 'legacy-snapshot', quantity: '1', amount: '100', name: 'Producto histórico' }], consumption: [] };
      await db.pool.query("INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES('Audit-report-sale','audit-legacy-order','audit-report-shift','centro-caja','centro',$1,'audit-legacy-receipt',$2,0,'2020-01-01T12:00:00Z',false)", [ownerId, JSON.stringify(legacy)]);
      const card = await request('GET', '/api/reports/sales?branchId=centro&paymentMethod=card'); assert.equal(card.statusCode, 200);
      assert.equal(card.json().items[0].id, 'Audit-report-sale'); assert.equal(card.json().totals.products, '100'); assert.equal(card.json().totals.digital, '100');
      const firstSale = await request('GET', '/api/reports/sales?branchId=centro&limit=1');
      const nextSale = await request('GET', '/api/reports/sales?branchId=centro&limit=1&after=' + encodeURIComponent(firstSale.json().nextCursor as string));
      assert.equal(firstSale.json().items[0].id, 'Audit-report-sale'); assert.equal(nextSale.json().items[0].id, 'audit-report-sale'); assert.equal(nextSale.json().nextCursor, null);
      await db.pool.query("INSERT INTO suppliers(id,branch_id,data) VALUES('audit-supplier','centro','{\"name\":\"Proveedor sintético\"}')");
      for (const method of ['efectivo', 'cash', 'tarjeta', 'transferencia', 'otro']) await db.pool.query("INSERT INTO purchases(id,branch_id,warehouse_id,supplier_id,actor_id,paid_amount,payment_method,purchased_on,data) VALUES($1,'centro','centro-venta','audit-supplier',$2,10,$3,'2020-01-02','{}')", ['audit-purchase-' + method, ownerId, method]);
      for (const [method, count] of [['cash', 2], ['efectivo', 2], ['card', 1], ['transfer', 1], ['other', 1]] as const) {
        const result = await request('GET', '/api/reports/purchases?branchId=centro&paymentMethod=' + method); assert.equal(result.statusCode, 200); assert.equal(result.json().items.length, count);
      }
      await db.pool.query("INSERT INTO customers(id,document_key,data) VALUES('audit-customer','audit','{\"id\":\"audit-customer\",\"name\":\"Cliente sintético\",\"document\":\"AUDIT\",\"phone\":\"3000000000\",\"email\":\"\",\"address\":\"\"}')");
      await db.pool.query("INSERT INTO loyalty_members(customer_id,enrolled_at_ms,balance) VALUES('audit-customer',$1,30)", [Date.UTC(2019, 0, 1)]);
      for (const [id, branchId, saleId, kind] of [['audit-adjustment', 'centro', null, 'adjustment'], ['audit-points-refund', 'centro', 'audit-report-sale', 'refund'], ['audit-other-branch', 'milan', null, 'adjustment']] as const)
        await db.pool.query('INSERT INTO loyalty_ledger(id,customer_id,sale_id,data) VALUES($1,\'audit-customer\',$2,$3)', [id, saleId, JSON.stringify({ kind, branchId, occurredAtMs: Date.UTC(2020, 0, 2, 12), delta: '10', balanceAfter: '10' })]);
      const loyalty = await request('GET', '/api/reports/loyalty?branchId=centro&from=2020-01-02&to=2020-01-02'); assert.equal(loyalty.statusCode, 200);
      assert.deepEqual(loyalty.json().items.map((item: { id: string }) => item.id).sort(), ['audit-adjustment', 'audit-points-refund']);
      const exported = await request('GET', '/api/reports/loyalty/export?branchId=centro&from=2020-01-02&to=2020-01-02'); assert.equal(exported.statusCode, 200); assert.match(String(exported.headers['content-type']), /spreadsheetml/);
    });
    await t.test('AC-019-07: catálogo nuevo admite cuatro segundos de desfase; cinco segundos son el límite', async () => {
      const product = await request('POST', '/api/products', { ...common(), type: 'finished', reference: 'AUDIT-TIME', name: 'Producto reloj', category: 'Prueba', presentation: 'Unidad', unit: 'unit', price: '100', tax: null, description: '' }); assert.equal(product.statusCode, 200);
      const installationId = randomUUID();
      const enrolled = await request('POST', '/api/pos/enroll', { deviceId: 'centro-caja', installationId }); assert.equal(enrolled.statusCode, 200);
      const terminal = { 'x-pos-token': enrolled.json().token as string };
      const authorized = await request('POST', '/api/pos/authorize', { deviceId: 'centro-caja', previous: null }, terminal); assert.equal(authorized.statusCode, 200);
      const { snapshot, signed } = authorized.json() as { snapshot: Snapshot; signed: Signed };
      const a = verifyAuthorization(signed, enrolled.json().publicKey as string);
      const order = upgradeOrder({ id: randomUUID(), revision: 0, snapshotId: snapshot.id, lines: [{ id: randomUUID(), productId: product.json().id as string, snapshotId: snapshot.id, quantity: '1', optionIds: [] }] });
      const payload = JSON.stringify({ kind: 'order.save', order, shiftId: null, occurredAtMs: snapshot.createdAtMs - 4000 });
      const operation = { version: 1, operationId: randomUUID(), deviceId: 'centro-caja', branchId: 'centro', actorId: ownerId, sequence: 1, previousOperationId: null, payloadHash: payloadHash(payload), payloadVersion: 2 };
      const synced = await request('POST', '/api/pos/sync', { operation, payload, signed }, terminal); assert.equal(synced.statusCode, 200, synced.body);
      const invalid = JSON.stringify({ kind: 'order.save', order: { ...order, revision: 1 }, shiftId: null, occurredAtMs: a.grant.validatedAtMs - 5001 });
      const denied = await request('POST', '/api/pos/sync', { operation: { ...operation, operationId: randomUUID(), sequence: 2, previousOperationId: operation.operationId, payloadHash: payloadHash(invalid) }, payload: invalid, signed }, terminal); assert.equal(denied.statusCode, 403);
      const closed = await request('POST', '/api/pos/authorize', { deviceId: 'centro-caja', previous: null }, terminal);
      assert.deepEqual(closed.json().closedShiftIds, [], 'La historia de otra instalación no se entrega');
      await db.pool.query("INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,installation_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES('audit-closed-linked','centro-caja','centro',$1,$2,0,now(),now(),0,0,0)", [ownerId, installationId]);
      const user = await request('POST', '/api/users', { name: 'Otro responsable', login: 'audit-cashier', password, role: 'cashier', branchIds: ['centro'], reason: 'Cambio de usuario sintético' }); assert.equal(user.statusCode, 201);
      const login = await request('POST', '/api/login', { login: 'audit-cashier', password }); assert.equal(login.statusCode, 200);
      const other = await request('POST', '/api/pos/authorize', { deviceId: 'centro-caja', previous: null }, { ...terminal, cookie: `nativos_session=${login.cookies[0]!.value}` }); assert.equal(other.statusCode, 200);
      assert.deepEqual(other.json().closedShiftIds, ['audit-closed-linked']);
      assert.deepEqual(other.json().sharedShifts, [], 'Otro usuario recibe solo los IDs de cierre, sin el libro del responsable');
    });
  } finally { await app.close(); await db.stop(); }
});
