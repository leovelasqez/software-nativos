import type { PoolClient } from 'pg';
import { legacySale } from '../orders-domain.ts';
import type { RefundV2 } from '../orders-domain.ts';
import type { CashMovement } from '../pos-domain.ts';
import { signedDecimal } from '../pos-domain.ts';
import { formatted } from '../catalog.ts';
import { buildShiftReceipt } from '../shift-receipt.ts';
import type { Shift } from '../pos/store.ts';
import { colombiaDate, sumSales } from '../notification-report.ts';
import type { BranchSales, NotificationReport, StockRow } from '../notification-report.ts';

export async function reportBranches(c:PoolClient) { return (await c.query<{id:string;name:string}>('SELECT id,name FROM branches ORDER BY id')).rows; }
export async function stockRows(c:PoolClient):Promise<StockRow[]> {
  return (await c.query(`SELECT b.id AS "branchId",b.name AS "branchName",w.id AS "warehouseId",w.name AS "warehouseName",i.id AS "itemId",i.name AS "itemName",i.reference,i.base_unit AS "baseUnit",coalesce(sum(m.quantity),0)::numeric(30,6)::text AS quantity,n.minimum::text AS minimum FROM inventory_minimums n JOIN warehouses w ON w.id=n.warehouse_id JOIN branches b ON b.id=w.branch_id JOIN inventory_items i ON i.id=n.item_id LEFT JOIN inventory_movements m ON m.warehouse_id=w.id AND m.item_id=i.id GROUP BY b.id,b.name,w.id,w.name,i.id,i.name,i.reference,i.base_unit,n.minimum HAVING coalesce(sum(m.quantity),0)<=n.minimum ORDER BY b.id,w.id,i.id`)).rows;
}
export async function closeReport(c:PoolClient,shiftId:string):Promise<NotificationReport|null> {
  const row=(await c.query(`SELECT s.*,u.name AS actor_name FROM pos_shifts s JOIN app_users u ON u.id=s.actor_id WHERE s.id=$1 AND s.closed_at IS NOT NULL`,[shiftId])).rows[0];
  if(!row)return null;
  const sales=(await c.query('SELECT data FROM pos_sales WHERE shift_id=$1 ORDER BY id',[shiftId])).rows.map(r=>legacySale(r.data,[]));
  const refunds=(await c.query<{data:RefundV2}>('SELECT data FROM pos_refunds WHERE shift_id=$1 ORDER BY id',[shiftId])).rows.map(r=>r.data);
  const cashMovements:CashMovement[]=(await c.query(`SELECT m.*,u.name AS actor_name FROM pos_cash_movements m JOIN app_users u ON u.id=m.actor_id WHERE m.shift_id=$1 ORDER BY m.occurred_at,m.id`,[shiftId])).rows.map(m=>({id:m.id,shiftId,class:m.class,method:m.payment_method,amount:formatted(signedDecimal(m.amount)),cashDelta:formatted(signedDecimal(m.cash_delta)),reason:m.reason,reversesMovementId:m.reverses_id,occurredAtMs:new Date(m.occurred_at).getTime(),actorName:m.actor_name}));
  const shift:Shift={id:row.id,actorId:row.actor_id,actorName:row.actor_name,openingCash:formatted(signedDecimal(row.opening_cash)),expected:formatted(signedDecimal(row.expected)),openedAtMs:new Date(row.opened_at).getTime(),closedAtMs:new Date(row.closed_at).getTime(),counted:formatted(signedDecimal(row.counted)),difference:formatted(signedDecimal(row.difference))};
  const close=buildShiftReceipt(shift,row.branch_id,row.device_id,{sales,refunds,cashMovements});
  const date=colombiaDate(new Date(row.closed_at));
  const branches:BranchSales[]=[];
  for(const branch of await reportBranches(c)) {
    const dailySales=(await c.query(`SELECT data FROM pos_sales WHERE branch_id=$1 AND (occurred_at AT TIME ZONE 'America/Bogota')::date=$2::date ORDER BY id`,[branch.id,date])).rows.map(r=>legacySale(r.data,[]));
    const dailyRefunds=(await c.query<{data:RefundV2}>(`SELECT r.data FROM pos_refunds r JOIN pos_shifts s ON s.id=r.shift_id WHERE s.branch_id=$1 AND (to_timestamp((r.data->>'occurredAtMs')::numeric/1000) AT TIME ZONE 'America/Bogota')::date=$2::date ORDER BY r.id`,[branch.id,date])).rows.map(r=>r.data);
    const daily=buildShiftReceipt(shift,branch.id,'summary',{sales:dailySales,refunds:dailyRefunds,cashMovements:[]});
    const status=(await c.query(`SELECT EXISTS(SELECT 1 FROM pos_shifts WHERE branch_id=$1 AND closed_at IS NULL) AS open,EXISTS(SELECT 1 FROM pos_shifts WHERE branch_id=$1 AND (closed_at AT TIME ZONE 'America/Bogota')::date=$2::date) AS closed`,[branch.id,date])).rows[0];
    const synced=(await c.query(`SELECT max(t.last_sync_at) AS at FROM pos_terminals t JOIN devices d ON d.id=t.device_id WHERE d.branch_id=$1`,[branch.id])).rows[0]?.at;
    // queueShiftClosed runs before the final receipt timestamp is written in the same transaction.
    const at=branch.id===row.branch_id?new Date():synced?new Date(synced):null;
    branches.push({branchId:branch.id,name:branch.name,status:status.open?'open':status.closed?'closed':'no_close',lastSynchronizedAt:at?.toISOString()??null,products:daily.totals.products,sales:formatted(signedDecimal(daily.totals.sales)-signedDecimal(daily.totals.refunds)),refunds:daily.totals.refunds,saleCount:daily.totals.saleCount,tips:daily.totals.tip,shipping:daily.totals.shipping,payments:Object.fromEntries(daily.payments.map(p=>[p.method,p.net]))});
  }
  return {version:2,kind:'shift_closed',branchIds:branches.map(b=>b.branchId),date,preparedAt:new Date().toISOString(),coverage:'server-synchronized-only',partial:branches.some(b=>b.status!=='closed'),branches,totals:sumSales(branches),close,stock:[]};
}
