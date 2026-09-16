import { randomUUID } from 'node:crypto';
import type { PosStore, Shift } from './store.ts';
import type { Authorization, Snapshot } from '../pos-domain.ts';
import type { Operation } from '../contracts.ts';
import { payloadHash } from '../pos-crypto.ts';
import { formatted } from '../catalog.ts';
import { signedDecimal } from '../pos-domain.ts';
import { applyOrderEvent, upgradeOrder, legacySale } from '../orders-domain.ts';
import type { Customer, OrderV2, OrderEvent, SaleV2, RefundV2 } from '../orders-domain.ts';
export class OrdersStore {
  readonly base: PosStore;
  constructor(base: PosStore) {
    this.base=base;
    const sql=`CREATE TABLE IF NOT EXISTS orders_v2(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sales_v2(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS refunds_v2(id TEXT PRIMARY KEY,sale_id TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS order_events_v2(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers_cache(id TEXT PRIMARY KEY,data TEXT NOT NULL);`;
    this.tx(()=>{ const checksum=payloadHash(sql); const old=base.meta<string>('ordersSchemaChecksum'); if(old&&old!==checksum)throw new Error('Migración de pedidos incompatible. Conserva los pendientes.'); base.db.exec(sql); this.meta('ordersSchemaChecksum',checksum);this.meta('ordersSchema',2);
      for(const r of base.db.prepare('SELECT * FROM orders').all()) {const order=upgradeOrder(JSON.parse(String(r.data)));order.revision=0; if(!base.db.prepare('SELECT 1 FROM orders_v2 WHERE id=?').get(order.id)) base.db.prepare('INSERT INTO orders_v2 VALUES(?,?,?)').run(order.id,String(r.actor_id),JSON.stringify(order));}
    });
  }
  private tx<T>(fn:()=>T):T {this.base.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.base.db.exec('COMMIT');return r;}catch(e){this.base.db.exec('ROLLBACK');throw e;}}
  private meta(key:string,value:unknown){this.base.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  get(id:string):OrderV2|null{const r=this.base.db.prepare('SELECT data FROM orders_v2 WHERE id=?').get(id);return r?JSON.parse(String(r.data)):null;}
  owner(id:string){return this.base.db.prepare('SELECT actor_id FROM orders_v2 WHERE id=?').get(id)?.actor_id;}
  list(actorId:string):OrderV2[]{return this.base.db.prepare('SELECT data FROM orders_v2 WHERE actor_id=? ORDER BY rowid DESC').all(actorId).map(r=>JSON.parse(String(r.data)) as OrderV2).filter(o=>!o.closed);}
  current(actorId:string){const selected=this.base.meta<string>('order-active-'+actorId);return this.list(actorId).find(o=>o.id===selected)??this.list(actorId)[0]??this.blank(actorId);}
  select(actorId:string,id:string){if(this.owner(id)!==actorId)throw new Error('El pedido pertenece a otro usuario.');this.meta('order-active-'+actorId,id);}
  customers():Customer[]{return this.base.db.prepare('SELECT data FROM customers_cache ORDER BY id').all().map(r=>JSON.parse(String(r.data)));}
  cache(customers:Customer[]){this.tx(()=>{for(const customer of customers)this.base.db.prepare('INSERT INTO customers_cache VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(customer.id,JSON.stringify(customer));});}
  snapshots():Snapshot[]{return this.base.db.prepare('SELECT data FROM snapshots').all().map(r=>JSON.parse(String(r.data)));}
  receipt(id:string):SaleV2|null{const r=this.base.db.prepare('SELECT data FROM sales_v2 WHERE id=?').get(id);const old=r?JSON.parse(String(r.data)):this.base.receipt(id);return old?legacySale(old,this.snapshots()):null;}
  history(){return [...this.base.history(),...this.base.db.prepare('SELECT data FROM sales_v2 ORDER BY rowid DESC LIMIT 50').all().map(r=>JSON.parse(String(r.data)))].map(r=>legacySale(r,this.snapshots())).sort((a,b)=>b.occurredAtMs-a.occurredAtMs).slice(0,50);}
  refunds(saleId?:string):RefundV2[]{return this.base.db.prepare('SELECT data FROM refunds_v2 WHERE (? IS NULL OR sale_id=?) ORDER BY rowid').all(saleId??null,saleId??null).map(r=>JSON.parse(String(r.data)));}
  shiftSummary(id:string|null){
    let tip=0n,shipping=0n;
    if(id)for(const r of this.base.db.prepare('SELECT s.data AS sale,r.data AS refund FROM cash_entries c LEFT JOIN sales_v2 s ON s.id=c.id LEFT JOIN refunds_v2 r ON r.id=c.id WHERE c.shift_id=?').all(id)){
      if(r.sale){const sale=JSON.parse(String(r.sale));tip+=signedDecimal(sale.tipPaid);shipping+=signedDecimal(sale.shippingPaid);}
      if(r.refund){const refund=JSON.parse(String(r.refund));tip-=signedDecimal(refund.tip);shipping-=signedDecimal(refund.shipping);}
    }
    return {tip:formatted(tip),shipping:formatted(shipping)};
  }
  events(actorId:string){return this.base.db.prepare('SELECT data FROM order_events_v2 WHERE actor_id=? ORDER BY rowid DESC LIMIT 50').all(actorId).map(r=>JSON.parse(String(r.data)));}
  command(id:string,intent:unknown,auth:Authorization,event:OrderEvent,installationId:string,failure?:(result:ReturnType<typeof applyOrderEvent>)=>void){
    const replay=this.base.replay(id,intent,auth.grant.actorId);if(replay)return replay;
    return this.tx(()=>{
      const actorId=auth.grant.actorId;const orderId=event.kind==='order.save'?event.order.id:'orderId' in event?event.orderId:null; const order=orderId?this.get(orderId):null;
      if(orderId&&order&&this.owner(orderId)!==actorId)throw new Error('El pedido pertenece a otro usuario.');
      const shift=this.base.shift();if(['sale.split','sale.refund'].includes(event.kind)&&(!shift||shift.actorId!==actorId||event.shiftId!==shift.id))throw new Error('Abre un turno propio para cobrar o devolver.');
      const customerId=event.kind==='sale.split'?event.customerId:event.kind==='order.save'?event.order.customerId:null;
      const customer=customerId?this.customers().find(c=>c.id===customerId):null;if(customerId&&!customer)throw new Error('Selecciona un cliente sincronizado.');
      const sequence=(this.base.meta<number>('sequence')??0)+1;const payload=JSON.stringify(event);
      const operation:Operation={version:1,operationId:id,deviceId:auth.grant.deviceId,branchId:auth.grant.branchId,actorId,sequence,previousOperationId:this.base.meta<string>('previous'),payloadHash:payloadHash(payload),payloadVersion:event.kind==='sale.split'&&event.loyalty||event.kind==='sale.refund'&&this.receipt(event.saleId)?.loyalty?3:2};
      const result=applyOrderEvent(event,{id,receiptNumber:`${operation.branchId}-${operation.deviceId}-${installationId}-${sequence}`,actorId,actorName:auth.actorName,branchId:operation.branchId,deviceId:operation.deviceId,order,snapshots:this.snapshots(),customer:customer??null,originalSale:event.kind==='sale.refund'?this.receipt(event.saleId):null,refunds:event.kind==='sale.refund'?this.refunds(event.saleId):[]});
      if(result.order){this.base.db.prepare('INSERT INTO orders_v2 VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(result.order.id,actorId,JSON.stringify(result.order));this.meta('order-active-'+actorId,result.order.id);}
      if(result.sale)this.base.db.prepare('INSERT INTO sales_v2 VALUES(?,?)').run(id,JSON.stringify(result.sale));
      if(result.refund)this.base.db.prepare('INSERT INTO refunds_v2 VALUES(?,?,?)').run(id,result.refund.saleId,JSON.stringify(result.refund));
      const entry={id,kind:event.kind,occurredAtMs:event.occurredAtMs,event,result};this.base.db.prepare('INSERT INTO order_events_v2 VALUES(?,?,?)').run(id,actorId,JSON.stringify(entry));
      if(result.sale||result.refund){this.base.db.prepare('INSERT INTO cash_entries VALUES(?,?,?)').run(id,shift!.id,result.cashDelta);const changed:Shift={...shift!,expected:formatted(signedDecimal(shift!.expected)+signedDecimal(result.cashDelta))};this.base.db.prepare('UPDATE shifts SET data=? WHERE id=?').run(JSON.stringify(changed),shift!.id);}
      const merged=new Map<string,bigint>();for(const m of result.movements)merged.set(m.itemId,(merged.get(m.itemId)??0n)+signedDecimal(m.quantity));
      for(const[itemId,quantity]of merged)this.base.db.prepare('INSERT INTO stock_entries VALUES(?,?,?,?)').run(id,itemId,sequence,formatted(quantity));
      this.base.db.prepare("INSERT INTO outbox(id,sequence,envelope,payload,signed,state) VALUES(?,?,?,?,?,'pending')").run(id,sequence,JSON.stringify(operation),payload,auth.grant.grantId);
      this.meta('sequence',sequence);this.meta('previous',id);
      this.base.db.prepare('INSERT INTO commands VALUES(?,?,?)').run(id,payloadHash(JSON.stringify({actor:actorId,intent})),JSON.stringify(result));failure?.(result);return result;
    });
  }
  blank(actorId:string){return upgradeOrder({id:randomUUID(),revision:0,snapshotId:this.base.snapshot()?.id??'',lines:[]});}
}
