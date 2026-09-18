import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { audit, transaction } from './db.ts';
import { ApiError, authenticate, requireAdmin } from './security.ts';
import { decimal, formatted } from '../catalog.ts';

const states = new Set(['pending','sending','delivered','failed_retryable','failed_terminal','uncertain']);
const outcomes = new Set(['delivered','retryable','terminal','uncertain']);
const id = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
const page = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? value : '0';
const roles = ['owner','branch_manager'] as const;
async function add(c: PoolClient, type: 'low_stock_daily'|'shift_closed', branchId: string, causalId: string, data: object) {
  for (const recipientRole of roles) await c.query(`INSERT INTO notification_intents(id,dedupe_key,type,branch_id,causal_id,recipient_role,state,data) VALUES($1,$2,$3,$4,$5,$6,'pending',$7) ON CONFLICT(dedupe_key) DO NOTHING`, [randomUUID(), `${type}:${branchId}:${causalId}:${recipientRole}`, type, branchId, causalId, recipientRole, JSON.stringify(data)]);
}
function colombiaDate(now = new Date()) { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now); return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`; }
export function isDailyLowStockWindow(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',hour:'2-digit',hourCycle:'h23'}).format(now) === '08'; }
export async function queueLowStock(c: PoolClient, branchId: string, date = colombiaDate()) {
  const rows = (await c.query(`SELECT w.id AS "warehouseId",w.name AS "warehouseName",i.id AS "itemId",i.name AS "itemName",i.reference,i.base_unit AS "baseUnit",coalesce(sum(m.quantity),0)::numeric(30,6)::text AS quantity,minimums.minimum::text AS minimum FROM inventory_minimums minimums JOIN warehouses w ON w.id=minimums.warehouse_id JOIN inventory_items i ON i.id=minimums.item_id LEFT JOIN inventory_movements m ON m.warehouse_id=w.id AND m.item_id=i.id WHERE w.branch_id=$1 GROUP BY w.id,w.name,i.id,i.name,i.reference,i.base_unit,minimums.minimum HAVING coalesce(sum(m.quantity),0)<=minimums.minimum ORDER BY w.id,i.id`,[branchId])).rows;
  if (rows.length) await add(c,'low_stock_daily',branchId,date,{date,rows}); return rows.length;
}
export async function runDailyLowStock(pool: Pool, now = new Date()) {
  if (!isDailyLowStockWindow(now)) return 0;
  return transaction(pool, async c => { await c.query('SELECT pg_advisory_xact_lock(7301)'); const branches=(await c.query<{id:string}>('SELECT id FROM branches ORDER BY id')).rows; let total=0; for(const branch of branches) total+=await queueLowStock(c,branch.id,colombiaDate(now)); return total; });
}
export async function queueShiftClosed(c: PoolClient, shiftId: string) {
  const shift=(await c.query(`SELECT s.id,s.branch_id AS "branchId",s.opening_cash::text AS "openingCash",s.expected::text,s.counted::text,s.difference::text,s.opened_at AS "openedAt",s.closed_at AS "closedAt",u.name AS "cashierName" FROM pos_shifts s JOIN app_users u ON u.id=s.actor_id WHERE s.id=$1 AND s.closed_at IS NOT NULL`,[shiftId])).rows[0]; if(!shift)return;
  const sales=(await c.query<{data: { total:string; cashApplied?:string; payments?:{method:string;applied?:string}[]; payment?:{method:string} }}>('SELECT data FROM pos_sales WHERE shift_id=$1',[shiftId])).rows; const totals=(await c.query(`SELECT coalesce(sum((data->>'tipPaid')::numeric),0)::text AS tips,coalesce(sum((data->>'shippingPaid')::numeric),0)::text AS shipping FROM pos_sales WHERE shift_id=$1`,[shiftId])).rows[0]; const refunds=(await c.query(`SELECT coalesce(sum((data->>'total')::numeric),0)::text AS total FROM pos_refunds WHERE shift_id=$1`,[shiftId])).rows[0]; const movements=(await c.query(`SELECT class,coalesce(sum(amount),0)::text AS amount FROM pos_cash_movements WHERE shift_id=$1 GROUP BY class`,[shiftId])).rows;
  const salesByMethod=new Map<string,bigint>(); let salesTotal=0n; for(const sale of sales){salesTotal+=decimal(sale.data.total);const payments=sale.data.payments??(sale.data.payment?[{method:sale.data.payment.method,applied:sale.data.payment.method==='cash'?sale.data.cashApplied??sale.data.total:sale.data.total}]:[]);for(const payment of payments){const amount=payment.applied??'0';salesByMethod.set(payment.method,(salesByMethod.get(payment.method)??0n)+decimal(amount));}}
  await add(c,'shift_closed',shift.branchId,shift.id,{...shift,salesTotal:formatted(salesTotal),salesByMethod:Object.fromEntries([...salesByMethod].map(([method,amount])=>[method,formatted(amount)])),income:movements.find(r=>r.class==='income')?.amount??'0',expenses:movements.find(r=>r.class==='expense')?.amount??'0',withdrawals:movements.find(r=>r.class==='withdrawal')?.amount??'0',refunds:refunds.total,tips:totals.tips,shipping:totals.shipping,reportPath:`/api/reports/cash?branchId=${encodeURIComponent(shift.branchId)}`});
}
export function registerNotifications(app: FastifyInstance, pool: Pool) {
  const evaluateDaily = () => { void runDailyLowStock(pool).catch(() => { /* retries on the next minute; commercial facts remain untouched */ }); };
  evaluateDaily(); const scheduler = setInterval(evaluateDaily, 60_000); scheduler.unref();
  app.addHook('onClose', async () => clearInterval(scheduler));
  app.get('/api/notifications', async req => {
    const actor = await authenticate(pool, req); requireAdmin(actor); const q = req.query as { branchId?: string; state?: string; after?: string; limit?: string };
    const limit = Number(q.limit ?? 50); if (!q.branchId || !id(q.branchId) || (q.state && !states.has(q.state)) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400,'invalid_query','Revisa sucursal, estado y paginación.');
    if (!actor.user.branch_ids.includes(q.branchId)) throw new ApiError(403,'forbidden','No tienes permiso para esta sucursal.');
    const rows = (await pool.query(`SELECT id,type,branch_id AS "branchId",causal_id AS "causalId",recipient_role AS "recipientRole",state,data,created_at AS "createdAt" FROM notification_intents WHERE branch_id=$1 AND ($2::text IS NULL OR state=$2) AND id>$3 ORDER BY id LIMIT $4`,[q.branchId,q.state??null,page(q.after),limit+1])).rows;
    const items=rows.slice(0,limit).map(row=>({...row,createdAt:row.createdAt.toISOString()})); return {items,nextCursor:rows.length>limit?items.at(-1)?.id??null:null};
  });
  app.post('/api/notifications/:id/simulate', async req => transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7301)'); const actor=await authenticate(c,req); requireAdmin(actor); const intentId=(req.params as {id:string}).id; const body=req.body as {operationId:string;reason:string;outcome:string;safeError?:string};
    if(!id(intentId)||!id(body?.operationId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500||!outcomes.has(body.outcome)||body.safeError!==undefined&&(typeof body.safeError!=='string'||body.safeError.length>500)) throw new ApiError(400,'invalid_input','Revisa operación, resultado y motivo.');
    const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex'); const old=(await c.query('SELECT * FROM notification_operations WHERE id=$1',[body.operationId])).rows[0]; if(old){if(old.actor_id!==actor.user.id||old.fingerprint!==fingerprint)throw new ApiError(409,'operation_conflict','La operación ya pertenece a otra solicitud.');return old.response;}
    const intent=(await c.query('SELECT * FROM notification_intents WHERE id=$1 FOR UPDATE',[intentId])).rows[0]; if(!intent)throw new ApiError(404,'not_found','No se encontró la intención.'); if(!actor.user.branch_ids.includes(intent.branch_id))throw new ApiError(403,'forbidden','No tienes permiso para esta sucursal.'); if(!['pending','failed_retryable'].includes(intent.state))throw new ApiError(409,'notification_state','La intención no admite simulación.');
    const state=body.outcome==='delivered'?'delivered':body.outcome==='retryable'?'failed_retryable':body.outcome==='terminal'?'failed_terminal':'uncertain'; const attemptId=randomUUID(); await c.query('INSERT INTO notification_attempts(id,intent_id,outcome,safe_error,started_at,finished_at) VALUES($1,$2,$3,$4,now(),now())',[attemptId,intentId,body.outcome,body.safeError??null]); await c.query('UPDATE notification_intents SET state=$2 WHERE id=$1',[intentId,state]); const response={id:intentId,state,attemptId,simulated:true}; await c.query('INSERT INTO notification_operations VALUES($1,$2,$3,$4)',[body.operationId,actor.user.id,fingerprint,JSON.stringify(response)]); await audit(c,actor,'notification.simulated',body.reason.trim(),response,intent.branch_id,[intent.branch_id]); return response;
  }));
  app.post('/api/notifications/low-stock/run', async req => transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7301)'); const actor=await authenticate(c,req); requireAdmin(actor); const body=req.body as {operationId:string;branchId:string;reason:string};
    if(!id(body?.operationId)||!id(body.branchId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500)throw new ApiError(400,'invalid_input','Revisa operación, sucursal y motivo.'); if(!actor.user.branch_ids.includes(body.branchId))throw new ApiError(403,'forbidden','No tienes permiso para esta sucursal.');
    const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex'); const old=(await c.query('SELECT * FROM notification_operations WHERE id=$1',[body.operationId])).rows[0];if(old){if(old.actor_id!==actor.user.id||old.fingerprint!==fingerprint)throw new ApiError(409,'operation_conflict','La operación ya pertenece a otra solicitud.');return old.response;}
    const rows=await queueLowStock(c,body.branchId);const response={branchId:body.branchId,date:colombiaDate(),lowStockRows:rows};await c.query('INSERT INTO notification_operations VALUES($1,$2,$3,$4)',[body.operationId,actor.user.id,fingerprint,JSON.stringify(response)]);await audit(c,actor,'notification.low_stock_evaluated',body.reason.trim(),response,body.branchId,[body.branchId]);return response;
  }));
}
