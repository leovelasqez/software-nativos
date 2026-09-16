import { CatalogError } from '../catalog.ts';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { transaction, audit } from './db.ts';
import type { Actor } from './db.ts';
import { authenticate, requireAccess, ApiError } from './security.ts';
import { payloadHash } from '../pos-crypto.ts';
import { points, validateRule } from '../loyalty.ts';
import type { LoyaltyCache, LoyaltyRule } from '../loyalty.ts';
import type { SaleV2, RefundV2 } from '../orders-domain.ts';
import schema from '../../contracts/loyalty-v1.schema.json' with {type:'json'};
export async function loyaltyCache(c:Pool|PoolClient):Promise<LoyaltyCache>{
 const rule=(await c.query("SELECT data FROM loyalty_rules ORDER BY (data->>'createdAtMs')::bigint DESC,id DESC LIMIT 1")).rows[0].data;
 const members=(await c.query('SELECT customer_id AS "customerId",enrolled_at_ms AS "enrolledAtMs",balance::text FROM loyalty_members ORDER BY customer_id')).rows.map(r=>({...r,enrolledAtMs:Number(r.enrolledAtMs)}));return {rule,members,asOfMs:Date.now()};
}
export async function loyaltyEntry(c:PoolClient,id:string,customerId:string,delta:bigint,data:object,saleId:string|null=null){
 const row=(await c.query('UPDATE loyalty_members SET balance=balance+$2 WHERE customer_id=$1 RETURNING balance::text',[customerId,String(delta)])).rows[0];if(!row)throw new ApiError(422,'member_missing','El cliente no está inscrito.');
 const entry={...data,delta:String(delta),balanceAfter:row.balance,occurredAtMs:Date.now()};await c.query('INSERT INTO loyalty_ledger VALUES($1,$2,$3,$4)',[id,customerId,saleId,JSON.stringify(entry)]);return entry;
}
export async function settleLoyalty(c:PoolClient,id:string,sale:SaleV2|null,refund:RefundV2|null,actor:Actor,branchId:string,occurredAtMs:number){
 if(sale?.loyalty){const l=sale.loyalty;const member=(await c.query('SELECT * FROM loyalty_members WHERE customer_id=$1',[sale.customer?.id])).rows[0];const rule=(await c.query('SELECT data FROM loyalty_rules WHERE id=$1',[l.rule.id])).rows[0]?.data as LoyaltyRule|undefined;
  if(!member||!rule||Number(member.enrolled_at_ms)!==l.memberSince||l.memberSince>occurredAtMs||rule.createdAtMs>occurredAtMs||Object.keys(rule).some(k=>rule[k as keyof LoyaltyRule]!==l.rule[k as keyof LoyaltyRule]))throw new ApiError(422,'loyalty_version','La inscripción o regla no corresponde al cobro.');
  if(points(l.redeemedPoints)>0n){if((await loyaltyCache(c)).rule.id!==rule.id)throw new ApiError(409,'rule_changed','Las reglas cambiaron. Revisa el cobro.');requireAccess(actor,branchId,'loyalty.redeem');if(BigInt(member.balance)<points(l.redeemedPoints))throw new ApiError(409,'insufficient_points','Saldo central insuficiente para este canje.');}
  await loyaltyEntry(c,id,member.customer_id,points(l.earnedPoints)-points(l.redeemedPoints),{kind:'sale',branchId,actorName:actor.user.name,earned:l.earnedPoints,redeemed:l.redeemedPoints,ruleId:rule.id,reason:'Puntos del cobro'},sale.id);
 }
 if(refund?.loyalty){const l=refund.loyalty;await loyaltyEntry(c,id,l.customerId,points(l.redeemedRestored)-points(l.earnedReversed),{kind:'refund',branchId,actorName:actor.user.name,earnedReversed:l.earnedReversed,redeemedRestored:l.redeemedRestored,reason:refund.reason},refund.saleId);}
}
export function registerLoyalty(app:FastifyInstance,pool:Pool){
 for(const route of ['enroll','adjust','rules'] as const)app.post('/api/loyalty/'+route,{schema:{body:schema[route]}},req=>transaction(pool,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(7301)');const actor=await authenticate(c,req);const b=req.body as {branchId:string;operationId:string;customerId:string;delta:string;reason:string;earnEvery:string;pointValue:string;maxPercent:string};requireAccess(actor,b.branchId,route==='enroll'?'loyalty.enroll':'loyalty.adjust');
  const fingerprint=payloadHash(JSON.stringify({route,...b}));const prior=(await c.query('SELECT * FROM catalog_operations WHERE id=$1',[b.operationId])).rows[0];if(prior){if(prior.actor_id!==actor.user.id||prior.fingerprint!==fingerprint)throw new ApiError(409,'operation_conflict','Operación con otro contenido.');return prior.response;}
  let result:unknown;
  if(route==='enroll'){if(!(await c.query('SELECT id FROM customers WHERE id=$1',[b.customerId])).rowCount)throw new ApiError(404,'not_found','Cliente desconocido.');await c.query('INSERT INTO loyalty_members VALUES($1,$2,0) ON CONFLICT DO NOTHING',[b.customerId,Date.now()]);result={ok:true};}
  else if(route==='adjust'){const delta=points(b.delta,true);if(!delta||b.reason.trim().length<3)throw new ApiError(400,'invalid_adjustment','Indica puntos distintos de cero y un motivo.');result=await loyaltyEntry(c,b.operationId,b.customerId,delta,{kind:'adjustment',branchId:b.branchId,actorName:actor.user.name,reason:b.reason.trim()});}
  else {if(b.reason.trim().length<3)throw new ApiError(400,'invalid_rule','Indica un motivo para cambiar la regla.');try{validateRule(b);}catch(e){if(e instanceof CatalogError)throw new ApiError(400,'invalid_rule',e.message);throw e;}const rule:LoyaltyRule={id:randomUUID(),earnEvery:b.earnEvery,pointValue:b.pointValue,maxPercent:b.maxPercent,createdAtMs:Math.max(Date.now(),(await loyaltyCache(c)).rule.createdAtMs+1)};await c.query('INSERT INTO loyalty_rules VALUES($1,$2)',[rule.id,JSON.stringify(rule)]);result=rule;}
  await audit(c,actor,'loyalty.'+route,route==='enroll'?'Inscripción en fidelización':b.reason,{customerId:b.customerId??null,operationId:b.operationId},b.branchId);await c.query('INSERT INTO catalog_operations VALUES($1,$2,$3,$4)',[b.operationId,actor.user.id,fingerprint,JSON.stringify(result)]);return result;
 }));
 app.get('/api/loyalty',{schema:{querystring:schema.query}},async req=>{const q=req.query as {branchId:string;after?:string;customerId?:string};const actor=await authenticate(pool,req);requireAccess(actor,q.branchId);const cache=await loyaltyCache(pool);return cache;});
 app.get('/api/loyalty/history',{schema:{querystring:schema.query}},async req=>{const q=req.query as {branchId:string;after?:string;customerId?:string};const actor=await authenticate(pool,req);requireAccess(actor,q.branchId);const rows=(await pool.query("SELECT id,data,sale_id AS \"saleId\" FROM loyalty_ledger WHERE customer_id=$1 AND id>$2 AND data->>'branchId'=$3 ORDER BY id LIMIT 101",[q.customerId??'',q.after??'',q.branchId])).rows;return {items:rows.slice(0,100).map(r=>({id:r.id,saleId:r.saleId,...r.data})),nextCursor:rows.length>100?rows[99].id:null};});
}
