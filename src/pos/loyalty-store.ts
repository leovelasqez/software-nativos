import type { OrdersStore } from './orders-store.ts';
import type { Authorization } from '../pos-domain.ts';
import type { Operation } from '../contracts.ts';
import type { OrderEvent, applyOrderEvent } from '../orders-domain.ts';
import type { LoyaltyCache } from '../loyalty.ts';
import { payloadHash } from '../pos-crypto.ts';
export interface StagedRedemption {id:string;intent:unknown;auth:Authorization;event:OrderEvent;installationId:string;operation:Operation;payload:string;result:ReturnType<typeof applyOrderEvent>}
export class LoyaltyStore {
 readonly orders:OrdersStore;
 constructor(orders:OrdersStore){this.orders=orders;const db=orders.base.db;const sql='CREATE TABLE IF NOT EXISTS loyalty_stage(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);';const checksum=payloadHash(sql);const prior=orders.base.meta<string>('loyaltySchemaChecksum');if(prior&&prior!==checksum)throw new Error('Migración de fidelización incompatible. Conserva pendientes.');db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run('loyaltySchemaChecksum',JSON.stringify(checksum));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 changes(){return this.orders.base.pending().flatMap(p=>{const sale=this.orders.receipt(p.operation.operationId);if(sale?.loyalty)return [{id:sale.id,customerId:sale.customer!.id,earned:sale.loyalty.earnedPoints,reversed:'0',restored:'0'}];const row=this.orders.base.db.prepare('SELECT data FROM refunds_v2 WHERE id=?').get(p.operation.operationId);const refund=row?JSON.parse(String(row.data)):null;return refund?.loyalty?[{id:refund.id,customerId:refund.loyalty.customerId,earned:'0',reversed:refund.loyalty.earnedReversed,restored:refund.loyalty.redeemedRestored}]:[];});}
 cache():LoyaltyCache|null{return this.orders.base.meta<LoyaltyCache>('loyaltyCache');}
 accept(cache:LoyaltyCache){this.orders.base.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run('loyaltyCache',JSON.stringify(cache));}
 pending():StagedRedemption|null{const row=this.orders.base.db.prepare('SELECT data FROM loyalty_stage WHERE id=1').get();return row?JSON.parse(String(row.data)):null;}
 clear(){this.orders.base.db.prepare('DELETE FROM loyalty_stage WHERE id=1').run();}
 stage(id:string,intent:unknown,auth:Authorization,event:OrderEvent,installationId:string){
  if(this.pending())throw new Error('Recupera o cancela el canje pendiente primero.');
  const marker=new Error('preview rollback');let result:ReturnType<typeof applyOrderEvent>|undefined;
  try{this.orders.command(id,intent,auth,event,installationId,value=>{result=value;throw marker;});}catch(e){if(e!==marker)throw e;}
  if(!result)throw new Error('No se pudo preparar el cobro.');const payload=JSON.stringify(event);const operation:Operation={version:1,operationId:id,deviceId:auth.grant.deviceId,branchId:auth.grant.branchId,actorId:auth.grant.actorId,sequence:(this.orders.base.meta<number>('sequence')??0)+1,previousOperationId:this.orders.base.meta<string>('previous'),payloadHash:payloadHash(payload),payloadVersion:3};
  const staged:StagedRedemption={id,intent,auth,event,installationId,operation,payload,result};this.orders.base.db.prepare('INSERT INTO loyalty_stage VALUES(1,?)').run(JSON.stringify(staged));return staged;
 }
 finish(){const staged=this.pending();if(!staged)throw new Error('No hay canje pendiente.');const result=this.orders.command(staged.id,staged.intent,staged.auth,staged.event,staged.installationId,()=>this.clear());if(this.pending())this.clear();return result;}
}
