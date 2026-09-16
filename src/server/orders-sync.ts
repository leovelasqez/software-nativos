import { settleLoyalty } from './loyalty-api.ts';
import { isOrderEvent, isOrderEventV3 } from '../orders-contract.ts';
import type { PoolClient } from 'pg';
import type { Operation } from '../contracts.ts';
import type { Authorization, Snapshot } from '../pos-domain.ts';
import { eventAction, applyOrderEvent, legacySale } from '../orders-domain.ts';
import type { OrderV2, Customer, RefundV2 } from '../orders-domain.ts';
import type { Actor, UserRow } from './db.ts';
import { ApiError, notFound } from './security.ts';
import { audit } from './db.ts';
export async function handleOrdersSync(c:PoolClient,o:Operation,payload:unknown,a:Authorization,installationId:string){
  const validate=o.payloadVersion===3?isOrderEventV3:isOrderEvent;
  if(!validate(payload))throw new ApiError(422,'invalid_payload','Formato de pedido inválido.');
  const action=eventAction(payload);const recovery=action==='order.write';const grant=a.grant;
  if(!grant.actions.includes(action)||payload.occurredAtMs<grant.validatedAtMs||payload.occurredAtMs>Date.now()+300_000||!recovery&&payload.occurredAtMs>=grant.expiresAtMs)throw new ApiError(403,'grant_denied','Operación fuera de la autorización.');
  if(payload.kind==='order.save'&&payload.order.lines.some(l=>l.discount.value!=='0')&&!grant.actions.includes('sale.discount'))throw new ApiError(403,'discount_denied','No tienes permiso de descuento.');
  const user=(await c.query<UserRow>('SELECT * FROM app_users WHERE id=$1',[o.actorId])).rows[0];if(!user)throw notFound();
  const reviewRequired=!user.active||!user.branch_ids.includes(o.branchId)||!user.actions.includes(action);const actor:Actor={user,deviceId:o.deviceId,tokenHash:''};
  const orderId=payload.kind==='order.save'?payload.order.id:'orderId'in payload?payload.orderId:null;
  const row=orderId?(await c.query('SELECT * FROM pos_orders_v2 WHERE id=$1',[orderId])).rows[0]:null;
  if(row&&(row.device_id!==o.deviceId||row.actor_id!==o.actorId))throw new ApiError(403,'scope_denied','El pedido pertenece a otro equipo o usuario.');
  const order=row?.data as OrderV2|null;
  if(['sale.split','sale.refund'].includes(payload.kind)){
    const shift=(await c.query('SELECT * FROM pos_shifts WHERE id=$1 AND device_id=$2 AND actor_id=$3 AND closed_at IS NULL',[payload.shiftId,o.deviceId,o.actorId])).rows[0];
    if(!shift||new Date(shift.opened_at).getTime()>payload.occurredAtMs)throw new ApiError(409,'shift_conflict','El turno no está abierto o no te pertenece.');
  }
  const snapshots=(await c.query('SELECT data FROM pos_snapshots WHERE device_id=$1',[o.deviceId])).rows.map(r=>r.data as Snapshot).filter(s=>s.branchId===o.branchId&&s.createdAtMs<=payload.occurredAtMs);
  const customerId=payload.kind==='sale.split'?payload.customerId:payload.kind==='order.save'?payload.order.customerId:null;
  const customer=customerId?(await c.query('SELECT data FROM customers WHERE id=$1',[customerId])).rows[0]?.data as Customer: null;if(customerId&&!customer)throw new ApiError(422,'customer_missing','Cliente desconocido.');
  const original=payload.kind==='sale.refund'?(await c.query('SELECT data FROM pos_sales WHERE id=$1',[payload.saleId])).rows[0]?.data:null;
  const refunds=payload.kind==='sale.refund'?(await c.query('SELECT data FROM pos_refunds WHERE sale_id=$1',[payload.saleId])).rows.map(r=>r.data as RefundV2):[];
  const result=applyOrderEvent(payload,{id:o.operationId,receiptNumber:`${o.branchId}-${o.deviceId}-${installationId}-${o.sequence}`,actorId:o.actorId,actorName:a.actorName,branchId:o.branchId,deviceId:o.deviceId,order:order??null,snapshots,customer:customer??null,originalSale:original?legacySale(original,snapshots):null,refunds});
  if(result.order)await c.query('INSERT INTO pos_orders_v2 VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[result.order.id,o.deviceId,o.actorId,JSON.stringify(result.order)]);
  await c.query('INSERT INTO pos_order_events VALUES($1,$2,$3,$4)',[o.operationId,o.deviceId,o.actorId,JSON.stringify({event:payload,result})]);
  if(result.sale)await c.query('INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[o.operationId,result.sale.orderId,payload.shiftId,o.deviceId,o.branchId,o.actorId,result.sale.receiptNumber,JSON.stringify(result.sale),result.cashDelta,new Date(payload.occurredAtMs),reviewRequired]);
  if(result.refund)await c.query('INSERT INTO pos_refunds VALUES($1,$2,$3,$4,$5)',[o.operationId,result.refund.saleId,payload.shiftId,JSON.stringify(result.refund),result.cashDelta]);
  for(const[i,m]of result.movements.entries())await c.query('INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,reason,sale_id,event_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[`${o.operationId}-v2-${i}`,m.itemId,result.warehouseId,result.sale?'sale':result.refund?'refund':'waste',m.quantity,'reason'in payload?payload.reason:'Consumo por cobro',result.sale?.id??result.refund?.saleId??null,o.operationId,new Date(payload.occurredAtMs)]);
  await settleLoyalty(c,o.operationId,result.sale,result.refund,actor,o.branchId,payload.occurredAtMs);
  await audit(c,actor,payload.kind,'reason'in payload?payload.reason:'Operación de pedido',{operationId:o.operationId,orderId,reviewRequired},o.branchId,[o.branchId]);
  return {kind:'accepted',receipt:o,reviewRequired};
}
