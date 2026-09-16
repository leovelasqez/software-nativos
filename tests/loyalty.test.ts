import test from 'node:test';
import assert from 'node:assert/strict';
import { checkout, emptyLine, upgradeOrder, refund } from '../src/orders-domain.ts';
import type { SaleV2, RefundV2 } from '../src/orders-domain.ts';
import type { Snapshot } from '../src/pos-domain.ts';
import { loyaltyCalculation, apportion } from '../src/loyalty.ts';
const rule={id:'rule',earnEvery:'1000',pointValue:'10',maxPercent:'20',createdAtMs:1};
const meta={rule,redeemedPoints:'100',knownBalance:'100',memberSince:1};
const snapshot:Snapshot={id:'s',deviceId:'d',branchId:'centro',warehouseId:'w',serverSequence:0,createdAtMs:1,recipes:[],stock:[],products:[{id:'p',name:'Sintético',reference:'TEST',type:'finished',category:'Prueba',presentation:'Unidad',unit:'unit',price:'10000',tax:null,version:1,activeRecipeVersion:null,description:'',sellable:true}]};
const order={...upgradeOrder({id:'o',revision:1,snapshotId:'s',lines:[]}),lines:[emptyLine({id:'a',productId:'p',snapshotId:'s',quantity:'1',optionIds:[]}),emptyLine({id:'b',productId:'p',snapshotId:'s',quantity:'1',optionIds:[]})]};
test('AC-005-02/07; AC-004-06: base neta, canje 100, 19 puntos y propina antes de canje',()=>{
 assert.equal(loyaltyCalculation(9000_000000n,{...meta,redeemedPoints:'0'}).earnedPoints,'9');
 const result=checkout(order,[{lineId:'a',quantity:'1'},{lineId:'b',quantity:'1'}],[snapshot],{kind:'percent',value:'10'},'0',[{method:'cash',received:'22000'}],meta);
 assert.equal(result.sale.loyalty!.earnedPoints,'19');assert.equal(result.sale.products,'20000');assert.equal(result.sale.tip,'2000');assert.equal(result.sale.total,'21000');assert.equal(result.sale.change,'1000');assert.equal(result.sale.lines[0]!.paidAmount,'9500');
 assert.throws(()=>loyaltyCalculation(20000_000000n,{...meta,redeemedPoints:'401'}),/límite/);
});
test('AC-005-08: medio pedido devuelve 9500 COP y 50 puntos; restitución completa exacta',()=>{
 const result=checkout(order,[{lineId:'a',quantity:'1'},{lineId:'b',quantity:'1'}],[snapshot],{kind:'amount',value:'0'},'0',undefined,meta);
 const sale:SaleV2={...result.sale,id:'sale',orderId:'o',customer:{id:'c',name:'Prueba',document:'TEST',phone:'00000',email:'',address:''},receiptNumber:'r',occurredAtMs:2,actorName:'Prueba',branchId:'centro',deviceId:'d'};
 const e={kind:'sale.refund' as const,saleId:'sale',lines:[{lineId:'a',quantity:'1',recoverable:true}],tip:'0',shipping:'0',payments:[{method:'cash' as const,received:'9500'}],reason:'Devolución sintética'};
 const first=refund(sale,[],e);assert.equal(first.total,'9500');assert.deepEqual(first.loyalty,{customerId:'c',earnedReversed:'10',redeemedRestored:'50'});
 const prior:RefundV2={...first,id:'refund',saleId:'sale',occurredAtMs:3,actorName:'Prueba'};const second=refund(sale,[prior],{...e,lines:[{lineId:'b',quantity:'1',recoverable:true}]});assert.equal(second.loyalty!.earnedReversed,'9');assert.equal(second.loyalty!.redeemedRestored,'50');
 assert.equal(Number(first.total)+Number(second.total),19000);assert.equal(sale.total,'19000');
});
test('REQ-005-04/05: reparto de micro-pesos no produce líneas negativas ni pierde residuos',()=>{const parts=apportion(7n,[1n,1n,1n,1n,1n,1n,1n,1n,1n,1n]);assert.equal(parts.reduce((a,b)=>a+b),7n);assert.ok(parts.every(n=>n>=0n));assert.deepEqual(apportion(0n,[0n]),[0n]);});

test('REQ-005-05: regla del dueño al 100% devuelve solo puntos cuando no se pagó dinero',()=>{const full={...meta,rule:{...rule,maxPercent:'100'},redeemedPoints:'2000'};const priced=checkout(order,[{lineId:'a',quantity:'1'},{lineId:'b',quantity:'1'}],[snapshot],{kind:'amount',value:'0'},'0',[{method:'cash',received:'0'}],full).sale;const sale:SaleV2={...priced,id:'full',orderId:'o',customer:{id:'c',name:'Prueba',document:'TEST',phone:'00000',email:'',address:''},receiptNumber:'r',occurredAtMs:2,actorName:'Prueba',branchId:'centro',deviceId:'d'};const r=refund(sale,[],{kind:'sale.refund',saleId:'full',lines:[{lineId:'a',quantity:'1',recoverable:true}],tip:'0',shipping:'0',payments:[{method:'cash',received:'0'}],reason:'Restitución de puntos'});assert.equal(r.total,'0');assert.equal(r.loyalty!.redeemedRestored,'1000');assert.equal(r.loyalty!.earnedReversed,'0');});
