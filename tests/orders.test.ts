import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeOrder, emptyLine, checkout, cancelLines, validateSave, applyOrderEvent, refund, paymentTotals } from '../src/orders-domain.ts';
import type { OrderContext, SaleV2 } from '../src/orders-domain.ts';
import type { Snapshot } from '../src/pos-domain.ts';
const snapshot:Snapshot={id:'snapshot',createdAtMs:1,deviceId:'device',branchId:'centro',warehouseId:'warehouse',serverSequence:0,stock:[],recipes:[],products:[{id:'product',name:'Sintético',reference:'TEST',type:'finished',category:'Pruebas',presentation:'Unidad',unit:'unit',price:'10000',tax:null,description:'',version:1,activeRecipeVersion:null,sellable:true}]};
const make=()=>({...upgradeOrder({id:'order',revision:1,snapshotId:'snapshot',lines:[]}),lines:[{...emptyLine({id:'line',productId:'product',snapshotId:'snapshot',quantity:'3',optionIds:[]}),discount:{kind:'percent' as const,value:'10'}}]});
test('AC-004-02/04/10: dividir cantidades, descuento y dos medios con cambio solo efectivo',()=>{
  const order=make();const r=checkout(order,[{lineId:'line',quantity:'1'}],[snapshot],{kind:'percent',value:'10'},'0',[{method:'nequi',received:'5000'},{method:'cash',received:'10000'}]);
  assert.equal(r.sale.products,'9000');assert.equal(r.sale.tip,'900');assert.equal(r.sale.total,'9900');assert.equal(r.sale.cashApplied,'4900');assert.equal(r.sale.change,'5100');assert.equal(r.order.lines[0]!.quantity,'2');assert.equal(r.order.lines[0]!.discount.value,'2000');assert.equal(r.sale.lines[0]!.taxAmount,null);
  const rest=checkout(r.order,[{lineId:'line',quantity:'2'}],[snapshot],{kind:'amount',value:'0'},'0');assert.equal(rest.sale.products,'18000');assert.equal(rest.order.closed,true);assert.throws(()=>paymentTotals('20000',[{method:'nequi',received:'25000'}]),/digitales/);
});
test('AC-004-03/08: comanda no consume; cancelación de 3 con 2 preparadas consume solo 2',()=>{
  const order=make();const context:OrderContext={id:'op',receiptNumber:'r',actorId:'actor',actorName:'Prueba',branchId:'centro',deviceId:'device',order,snapshots:[snapshot],customer:null,originalSale:null,refunds:[]};
  const sent=applyOrderEvent({kind:'order.prepare',orderId:order.id,revision:1,occurredAtMs:2,shiftId:null},context);assert.deepEqual(sent.movements,[]);
  const cancelled=cancelLines(sent.order!,{kind:'order.cancel',orderId:order.id,revision:2,lines:[{lineId:'line',quantity:'3',preparedQuantity:'2'}],reason:'Prueba desperdicio'},[snapshot]);assert.deepEqual(cancelled.consumption,[{itemId:'product',quantity:'2'}]);assert.equal(cancelled.order.closed,true);
  assert.throws(()=>validateSave(sent.order!,{...sent.order!,lines:[]},[snapshot]),/cancelación/);
});
test('REQ-004-06: devolución acumulada exacta, propina/envío separados, preparado sin reingreso',()=>{
  const order={...make(),mode:'delivery' as const,address:'Dirección sintética',shipping:'3000'};
  const charged=checkout(order,[{lineId:'line',quantity:'3'}],[snapshot],{kind:'amount',value:'1000'},'3000');
  const sale:SaleV2={...charged.sale,id:'sale',orderId:order.id,receiptNumber:'r',occurredAtMs:2,actorName:'Prueba',branchId:'centro',deviceId:'device',customer:null};
  const input={kind:'sale.refund' as const,saleId:'sale',lines:[{lineId:'line',quantity:'1',recoverable:true}],tip:'1000',shipping:'3000',payments:[{method:'cash' as const,received:'13000'}],reason:'Devolución sintética'};
  const r=refund(sale,[],input);assert.equal(r.total,'13000');assert.deepEqual(r.consumption,[{itemId:'product',quantity:'1'}]);
  const previous=[{...r,id:'return',saleId:sale.id,occurredAtMs:3,actorName:'Prueba'}];assert.throws(()=>refund(sale,previous,input),/saldo/);
  assert.throws(()=>refund(sale,previous,{...input,tip:'0',shipping:'0',lines:[{lineId:'line',quantity:'3',recoverable:true}]}),/cantidad/);
  const second=refund(sale,previous,{...input,tip:'0',shipping:'0',lines:[{lineId:'line',quantity:'2',recoverable:false}],payments:[{method:'cash',received:'18000'}]});assert.equal(Number(second.total)+Number(r.total),Number(sale.total));
  const prepared={...sale,lines:sale.lines.map(l=>({...l,productType:'prepared' as const}))};assert.throws(()=>refund(prepared,[],input),/ingredientes/);
});


test('AC-004-09/REQ-004-06: redondeo y reparto preservan el total al devolver fracciones',()=>{
  const tiny={...snapshot,products:snapshot.products.map(p=>({...p,price:'0.6'}))};const order={...make(),mode:'delivery' as const,address:'Prueba',shipping:'0.4',lines:[{...make().lines[0]!,discount:{kind:'amount' as const,value:'0.1'}}]};
  const charged=checkout(order,[{lineId:'line',quantity:'3'}],[tiny],{kind:'amount',value:'0.4'},'0.4');assert.equal(charged.sale.total,'3');assert.equal(charged.sale.lines[0]!.paidAmount,'2');assert.equal(charged.sale.tipPaid,'1');assert.equal(charged.sale.shippingPaid,'0');
  const sale:SaleV2={...charged.sale,id:'sale',orderId:order.id,receiptNumber:'r',occurredAtMs:2,actorName:'Prueba',branchId:'centro',deviceId:'device',customer:null};
  const one=refund(sale,[],{kind:'sale.refund',saleId:sale.id,lines:[{lineId:'line',quantity:'1',recoverable:true}],tip:'1',shipping:'0',payments:[{method:'cash',received:'2'}],reason:'Prueba redondeo'});
  const two=refund(sale,[{...one,id:'return',saleId:sale.id,occurredAtMs:3,actorName:'Prueba'}],{kind:'sale.refund',saleId:sale.id,lines:[{lineId:'line',quantity:'2',recoverable:true}],tip:'0',shipping:'0',payments:[{method:'cash',received:'1'}],reason:'Prueba restante'});assert.equal(Number(one.total)+Number(two.total),3);
});
