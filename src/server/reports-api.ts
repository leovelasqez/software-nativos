import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { authenticate, authenticateAgent, requireAccess, ApiError } from './security.ts';
import { decimal, formatted } from '../catalog.ts';
import { xlsx } from './xlsx.ts';

type Kind = 'sales' | 'cash' | 'inventory' | 'purchases' | 'waste' | 'loyalty';
type Query = { branchId?: string; from?: string; to?: string; after?: string; limit?: string; productId?: string; customerId?: string; supplierId?: string; paymentMethod?: string };
const kinds = new Set<Kind>(['sales', 'cash', 'inventory', 'purchases', 'waste', 'loyalty']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const paymentMethods = new Set(['cash', 'card', 'transfer', 'breb', 'daviplata', 'nequi']);
const zero = () => ({ products: 0n, discounts: 0n, redemption: 0n, tips: 0n, shipping: 0n, refunds: 0n, cash: 0n, digital: 0n });
const text = (value: unknown) => typeof value === 'string' && /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/.test(value) ? decimal(value) : 0n;
const signed = (value: unknown) => typeof value === 'string' && /^-?(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/.test(value) ? (value.startsWith('-') ? -decimal(value.slice(1)) : decimal(value)) : 0n;
const totals = (value: ReturnType<typeof zero>) => Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, formatted(amount)]));
function localRange(column: string, q: Query, parameters: unknown[]) {
  const clauses: string[] = [];
  if (q.from) { parameters.push(q.from); clauses.push(`(${column} AT TIME ZONE 'America/Bogota')::date >= $${parameters.length}::date`); }
  if (q.to) { parameters.push(q.to); clauses.push(`(${column} AT TIME ZONE 'America/Bogota')::date <= $${parameters.length}::date`); }
  return clauses.length ? ' AND ' + clauses.join(' AND ') : '';
}
function page<T extends { id: string }>(items: T[], q: Query) {
  const limit = Math.min(Math.max(Number(q.limit ?? 20), 1), 100); const after = q.after ?? '';
  const matching = items.filter(item => item.id > after); return { items: matching.slice(0, limit), nextCursor: matching.length > limit ? matching[limit - 1]!.id : null };
}
export function registerReports(app: FastifyInstance, pool: Pool) {
  async function report(req: FastifyRequest, db: Pool | PoolClient, agent = false) {
    const kind = (req.params as { kind: string }).kind as Kind; if (!kinds.has(kind)) throw new ApiError(404, 'not_found', 'Informe no disponible.');
    const q = req.query as Query; const actor = agent ? await authenticateAgent(db, req) : await authenticate(db, req); const permitted = new Set(['branchId', 'from', 'to', 'after', 'limit', ...(kind === 'sales' ? ['productId', 'customerId', 'paymentMethod'] : kind === 'purchases' ? ['supplierId', 'paymentMethod'] : kind === 'waste' ? ['productId'] : kind === 'loyalty' ? ['customerId'] : [])]);
    if (Object.keys(q).some(key => !permitted.has(key)) || (q.from && !datePattern.test(q.from)) || (q.to && !datePattern.test(q.to)) || (q.from && q.to && q.from > q.to) || [q.productId, q.customerId, q.supplierId].some(value => value !== undefined && !idPattern.test(value)) || (q.paymentMethod && !paymentMethods.has(q.paymentMethod))) throw new ApiError(400, 'invalid_filter', 'Revisa los filtros del informe.');
    const branches = q.branchId === 'all' ? actor.user.branch_ids : q.branchId ? [q.branchId] : [];
    if (!branches.length) throw new ApiError(400, 'branch_required', 'Selecciona una sucursal.'); for (const branchId of branches) requireAccess(actor, branchId, kind === 'purchases' ? 'purchase.read' : 'data.read');
    const synchronization = new Map<string, string | null>((await db.query('SELECT id FROM branches WHERE id=ANY($1::text[])', [branches])).rows.map(row => [row.id, null]));
    for (const row of (await db.query(`SELECT d.branch_id,max(t.last_sync_at) AS synchronized FROM pos_terminals t JOIN devices d ON d.id=t.device_id WHERE d.branch_id=ANY($1::text[]) GROUP BY d.branch_id`, [branches])).rows)
      synchronization.set(row.branch_id, row.synchronized instanceof Date ? row.synchronized.toISOString() : row.synchronized ?? null);
    const context = { kind, branchIds: branches, from: q.from ?? null, to: q.to ?? null, filters: { productId: q.productId ?? null, customerId: q.customerId ?? null, supplierId: q.supplierId ?? null, paymentMethod: q.paymentMethod ?? null }, timeZone: 'America/Bogota', lastSynchronizedAt: Object.fromEntries(synchronization) };
    const amount = zero(); let items: { id: string; [key: string]: unknown }[] = [];
    if (kind === 'sales') {
      const params: unknown[] = [branches]; const rows = (await db.query(`SELECT id,branch_id,data,occurred_at FROM pos_sales WHERE branch_id=ANY($1::text[])${localRange('occurred_at', q, params)} ORDER BY id`, params)).rows;
      const selected = rows.filter(row => { const data = row.data as Record<string, unknown>; const customer = data.customer as { id?: string } | null; const lines = (data.lines as { productId?: string }[] | undefined) ?? []; const payments = (data.payments as { method?: string }[] | undefined) ?? []; return (!q.productId || lines.some(line => line.productId === q.productId)) && (!q.customerId || customer?.id === q.customerId) && (!q.paymentMethod || payments.some(payment => payment.method === q.paymentMethod)); });
      items = selected.map(row => { const data = row.data as Record<string, unknown>; amount.products += text(data.products); amount.discounts += text(data.discount); amount.redemption += text((data.loyalty as { redeemedAmount?: string } | undefined)?.redeemedAmount); amount.tips += text(data.tipPaid); amount.shipping += text(data.shippingPaid); amount.cash += signed(data.cashApplied); for (const payment of (data.payments as { method?: string; applied?: string }[] | undefined) ?? []) if (payment.method !== 'cash') amount.digital += signed(payment.applied); return { id: row.id, kind: 'sale', branchId: row.branch_id, occurredAt: row.occurred_at.toISOString(), ...data }; });
      const refunds = (await db.query(`SELECT r.id,r.sale_id,r.data,s.branch_id,s.data AS sale_data FROM pos_refunds r JOIN pos_sales s ON s.id=r.sale_id WHERE s.branch_id=ANY($1::text[]) ORDER BY r.id`, [branches])).rows.filter(row => { const data = row.data as Record<string, unknown>; const sale = row.sale_data as Record<string, unknown>; const customer = sale.customer as { id?: string } | null; const lines = (sale.lines as { productId?: string }[] | undefined) ?? []; const payments = (data.payments as { method?: string }[] | undefined) ?? []; const occurred = Number(data.occurredAtMs); const day = Number.isSafeInteger(occurred) ? new Date(occurred).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : ''; return (!q.from || day >= q.from) && (!q.to || day <= q.to) && (!q.productId || lines.some(line => line.productId === q.productId)) && (!q.customerId || customer?.id === q.customerId) && (!q.paymentMethod || payments.some(payment => payment.method === q.paymentMethod)); });
      for (const row of refunds) { const data = row.data as Record<string, unknown>; amount.refunds += text(data.total); amount.tips -= text(data.tip); amount.shipping -= text(data.shipping); amount.cash += signed(data.cashApplied); for (const payment of (data.payments as { method?: string; received?: string }[] | undefined) ?? []) if (payment.method !== 'cash') amount.digital -= text(payment.received); items.push({ id: `refund-${row.id}`, kind: 'refund', saleId: row.sale_id, branchId: row.branch_id, occurredAt: Number.isSafeInteger(Number(data.occurredAtMs)) ? new Date(Number(data.occurredAtMs)).toISOString() : null, ...data }); }
      items.sort((a, b) => a.id.localeCompare(b.id));
    } else if (kind === 'cash') {
      const params: unknown[] = [branches]; const rows = (await db.query(`SELECT id,branch_id,opening_cash::text,expected::text,counted::text,difference::text,opened_at,closed_at FROM pos_shifts WHERE branch_id=ANY($1::text[])${localRange('opened_at', q, params)} ORDER BY id`, params)).rows;
      items = rows.map(row => ({ id: row.id, kind: 'shift', branchId: row.branch_id, openingCash: row.opening_cash, expected: row.expected, counted: row.counted, difference: row.difference, openedAt: row.opened_at instanceof Date ? row.opened_at.toISOString() : row.opened_at, closedAt: row.closed_at instanceof Date ? row.closed_at.toISOString() : row.closed_at ?? null }));
      const movements = await db.query(`SELECT payment_method,cash_delta::text FROM pos_cash_movements WHERE branch_id=ANY($1::text[])${localRange('occurred_at', q, [branches])}`, [branches, ...(q.from ? [q.from] : []), ...(q.to ? [q.to] : [])]); for (const movement of movements.rows) { if (movement.payment_method === 'cash') amount.cash += text(movement.cash_delta.replace('-', '')) * (String(movement.cash_delta).startsWith('-') ? -1n : 1n); else amount.digital += text(movement.cash_delta); }
      const movementParams: unknown[] = [branches]; const movementRows = (await db.query(`SELECT m.id,m.shift_id,m.branch_id,m.class,m.payment_method,m.amount::text,m.cash_delta::text,m.reason,m.occurred_at,u.name AS actor_name FROM pos_cash_movements m JOIN app_users u ON u.id=m.actor_id WHERE m.branch_id=ANY($1::text[])${localRange('m.occurred_at', q, movementParams)} ORDER BY m.id`, movementParams)).rows;
      items.push(...movementRows.map(row => ({ id: row.id, kind: 'movement', shiftId: row.shift_id, branchId: row.branch_id, class: row.class, paymentMethod: row.payment_method, amount: row.amount, cashDelta: row.cash_delta, reason: row.reason, actorName: row.actor_name, occurredAt: row.occurred_at.toISOString() })));
      items.sort((a, b) => a.id.localeCompare(b.id));
    } else if (kind === 'inventory') {
      const rows = (await db.query(`SELECT w.id AS warehouse_id,w.name AS warehouse_name,i.id AS item_id,i.name,i.reference,coalesce(sum(m.quantity),0)::numeric(30,6)::text AS quantity,minimums.minimum::text AS minimum FROM inventory_items i CROSS JOIN (SELECT id,name FROM warehouses WHERE branch_id=ANY($1::text[])) w LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=w.id LEFT JOIN inventory_minimums minimums ON minimums.warehouse_id=w.id AND minimums.item_id=i.id GROUP BY w.id,w.name,i.id,i.name,i.reference,minimums.minimum ORDER BY w.id,i.id`, [branches])).rows; items = rows.map(row => ({ id: `${row.warehouse_id}:${row.item_id}`, warehouseId: row.warehouse_id, warehouse: row.warehouse_name, itemId: row.item_id, name: row.name, reference: row.reference, quantity: row.quantity, minimum: row.minimum }));
    } else if (kind === 'purchases') {
      const params: unknown[] = [branches]; const rows = (await db.query(`SELECT p.id,p.branch_id,p.supplier_id,p.purchased_on::text,s.data->>'name' AS supplier,p.payment_method,p.paid_amount::text FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.branch_id=ANY($1::text[])${q.from ? ` AND p.purchased_on >= $${params.push(q.from)}::date` : ''}${q.to ? ` AND p.purchased_on <= $${params.push(q.to)}::date` : ''}${q.supplierId ? ` AND p.supplier_id=$${params.push(q.supplierId)}` : ''}${q.paymentMethod ? ` AND p.payment_method=$${params.push(q.paymentMethod)}` : ''} ORDER BY p.id`, params)).rows; items = rows.map(row => ({ id: row.id, branchId: row.branch_id, supplierId: row.supplier_id, purchasedOn: row.purchased_on, supplier: row.supplier, paymentMethod: row.payment_method, paidAmount: row.paid_amount }));
    } else if (kind === 'waste') {
      const params: unknown[] = [branches]; const rows = (await db.query(`SELECT m.id,m.item_id,w.branch_id,i.name,m.kind,m.quantity::text,m.reason,m.created_at FROM inventory_movements m JOIN warehouses w ON w.id=m.warehouse_id JOIN inventory_items i ON i.id=m.item_id WHERE w.branch_id=ANY($1::text[]) AND m.kind IN ('waste','internal_consumption')${localRange('m.created_at', q, params)}${q.productId ? ` AND m.item_id=$${params.push(q.productId)}` : ''} ORDER BY m.id`, params)).rows; items = rows.map(row => ({ id: row.id, itemId: row.item_id, branchId: row.branch_id, item: row.name, kind: row.kind, quantity: row.quantity, reason: row.reason, occurredAt: row.created_at.toISOString() }));
    } else {
      const params: unknown[] = [branches]; const rows = (await db.query(`SELECT l.id,l.customer_id,l.sale_id,l.data FROM loyalty_ledger l JOIN pos_sales s ON s.id=l.sale_id WHERE s.branch_id=ANY($1::text[])${localRange('s.occurred_at', q, params)}${q.customerId ? ` AND l.customer_id=$${params.push(q.customerId)}` : ''} ORDER BY l.id`, params)).rows; items = rows.map(row => ({ id: row.id, customerId: row.customer_id, saleId: row.sale_id, ...row.data }));
    }
    return { context, ...page(items, q), totals: totals(amount), allItems: items };
  }
  async function snapshot(req: FastifyRequest, agent = false) {
    const db = await pool.connect();
    try { await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const value = await report(req, db, agent); await db.query('COMMIT'); return value; }
    catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  app.get('/api/reports/:kind', async req => { const value = await snapshot(req); const { allItems, ...response } = value; return response; });
  app.get('/api/agent/v1/reports/:kind', async req => { const value = await snapshot(req, true); const { allItems, ...response } = value; return response; });
  app.get('/api/reports/:kind/export', async (req, reply) => {
    const value = await snapshot(req); const columns = [...new Set(value.allItems.flatMap(item => Object.keys(item)))]; const name = `nativos-${value.context.kind}-${value.context.from ?? 'todo'}-${value.context.to ?? 'actual'}.xlsx`;
    const file = xlsx([{ name: 'Contexto', rows: [['Campo', 'Valor'], ...Object.entries(value.context).map(([key, item]) => [key, typeof item === 'object' ? JSON.stringify(item) : item])]}, { name: 'Datos', rows: [columns, ...value.allItems.map(item => columns.map(column => typeof item[column] === 'object' ? JSON.stringify(item[column]) : item[column] ?? ''))]}, { name: 'Totales', rows: [['Concepto', 'Importe'], ...Object.entries(value.totals)] }]);
    return reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', `attachment; filename="${name}"`).send(file);
  });
}
