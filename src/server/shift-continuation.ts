import type { PoolClient } from 'pg';
import type { SharedShift } from '../shift-continuation.ts';
import type { CashMovement, Snapshot } from '../pos-domain.ts';
import type { RefundV2 } from '../orders-domain.ts';
import { legacySale } from '../orders-domain.ts';
import { formatted } from '../catalog.ts';
import { signedDecimal } from '../pos-domain.ts';

export async function sharedShifts(c: PoolClient, deviceId: string, installationId: string, actorId: string): Promise<SharedShift[]> {
  const shifts = (await c.query(`SELECT s.*,u.name AS actor_name,
    (s.opening_cash+(SELECT coalesce(sum(cash_applied),0) FROM pos_sales WHERE shift_id=s.id)
    +(SELECT coalesce(sum(cash_applied),0) FROM pos_refunds WHERE shift_id=s.id)
    +(SELECT coalesce(sum(cash_delta),0) FROM pos_cash_movements WHERE shift_id=s.id))::text AS current_expected
    FROM pos_shifts s JOIN app_users u ON u.id=s.actor_id WHERE s.device_id=$1 AND s.actor_id=$3
    AND cardinality(s.resumed_installations)>0 AND (s.installation_id=$2 OR $2=ANY(s.resumed_installations)) ORDER BY s.opened_at`, [deviceId,installationId,actorId])).rows;
  if (!shifts.length) return [];
  const result: SharedShift[] = [];
  for (const row of shifts) {
    const rawSales = (await c.query('SELECT data FROM pos_sales WHERE shift_id=$1 ORDER BY occurred_at,id',[row.id])).rows.map(r=>r.data);
    const snapshotIds = [...new Set(rawSales.filter(s=>!('products' in s)).flatMap(s=>(s.lines as {snapshotId:string}[]).map(l=>l.snapshotId)))];
    const snapshots = snapshotIds.length ? (await c.query<{data:Snapshot}>('SELECT data FROM pos_snapshots WHERE device_id=$1 AND id=ANY($2::text[])',[deviceId,snapshotIds])).rows.map(r=>r.data) : [];
    const sales = rawSales.map(s=>legacySale(s,snapshots));
    const refunds = (await c.query<{data:RefundV2}>('SELECT data FROM pos_refunds WHERE shift_id=$1 ORDER BY id',[row.id])).rows.map(r=>r.data);
    const cashMovements: CashMovement[] = (await c.query('SELECT * FROM pos_cash_movements WHERE shift_id=$1 ORDER BY occurred_at,id',[row.id])).rows.map(m=>({id:m.id,shiftId:m.shift_id,class:m.class,method:m.payment_method,amount:formatted(signedDecimal(m.amount)),cashDelta:formatted(signedDecimal(m.cash_delta)),reason:m.reason,reversesMovementId:m.reverses_id,occurredAtMs:new Date(m.occurred_at).getTime(),actorName:row.actor_name}));
    result.push({shift:{id:row.id,actorId:row.actor_id,actorName:row.actor_name,openingCash:formatted(signedDecimal(row.opening_cash)),expected:formatted(signedDecimal(row.closed_at?row.expected:row.current_expected)),openedAtMs:new Date(row.opened_at).getTime(),closedAtMs:row.closed_at?new Date(row.closed_at).getTime():null,counted:row.counted===null?null:formatted(signedDecimal(row.counted)),difference:row.difference===null?null:formatted(signedDecimal(row.difference))},sales,refunds,cashMovements,
      tip:formatted(sales.reduce((n,s)=>n+signedDecimal(s.tipPaid),0n)-refunds.reduce((n,r)=>n+signedDecimal(r.tip),0n)),
      shipping:formatted(sales.reduce((n,s)=>n+signedDecimal(s.shippingPaid),0n)-refunds.reduce((n,r)=>n+signedDecimal(r.shipping),0n))});
  }
  return result;
}
