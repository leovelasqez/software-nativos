import {registerLocalTransition} from '../../src/server/local-transition.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import {resolve,join} from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { PosEngine } from '../../src/pos/engine.ts';
import { emptyLine } from '../../src/orders-domain.ts';
import type { CommandEvent,SaleV2,RefundV2 } from '../../src/orders-domain.ts';

test('Incremento 5 — puntos, canjes concurrentes y recuperación real',{timeout:240_000},async t=>{
 const root=resolve('.local/test-'+randomUUID());const password=randomBytes(24).toString('base64url');const db=await startLocalPostgres(root,{password:randomBytes(32).toString('hex')});await migrate(db.pool);const app=await createApp({pool:db.pool,origin:'http://127.0.0.1:4345'});registerLocalTransition(app,db.pool,join(root,'centro'),'http://127.0.0.1:4345');let cookie='';let offline=false;let loss=false;let before=false;
 const req=(method:'GET'|'POST',url:string,payload?:object)=>app.inject({method,url,...(payload?{payload}:{}),headers:{host:'127.0.0.1:4345',cookie,'x-nativos-request':'1'}});
 const open=(name:string)=>PosEngine.open(join(root,name),'http://127.0.0.1:4345',{request:async(url,init)=>{
  if(offline)throw new Error('offline');const envelope=init.body?JSON.parse(String(init.body)):{};const event=envelope.payload?JSON.parse(envelope.payload):null;const canje=url.endsWith('/pos/sync')&&BigInt(event?.loyalty?.redeemedPoints??'0')>0n;
  if(before&&canje){before=false;throw new Error('cut before commit');}
  const headers=Object.fromEntries(new Headers(init.headers));headers.host='127.0.0.1:4345';const r=await app.inject({method:init.method as 'GET'|'POST',url:new URL(url).pathname+new URL(url).search,headers,...(init.body?{payload:String(init.body)}:{})});if(loss&&canje&&r.statusCode===200){loss=false;throw new Error('lost committed response');}return new Response(r.body,{status:r.statusCode,headers:r.headers as Record<string,string>});
 }});
 let engines:PosEngine[]=[];let customerId='';let productId='';let first:SaleV2;let winner:PosEngine;let loser:PosEngine;let redeemed:SaleV2;
 const balance=async()=>BigInt((await db.pool.query('SELECT balance::text FROM loyalty_members WHERE customer_id=$1',[customerId])).rows[0].balance);
 const common=()=>({operationId:randomUUID(),branchId:'centro'});
 const send=(engine:PosEngine,event:CommandEvent,id=randomUUID())=>engine.executeV2('rewards-owner',id,event);
 const draft=async(engine:PosEngine,qty='2')=>{const s=engine.stateV2('rewards-owner');await send(engine,{kind:'order.save',order:{...s.order,customerId,lines:[emptyLine({id:randomUUID(),productId,snapshotId:s.snapshot!.id,quantity:qty,optionIds:[]})]}});};
 const pay=(engine:PosEngine,points='0',cash='20000'):CommandEvent=>{const o=engine.stateV2('rewards-owner').order;return {kind:'sale.split',orderId:o.id,revision:o.revision,selection:o.lines.map(l=>({lineId:l.id,quantity:l.quantity})),customerId,tip:{kind:'amount',value:'0'},shipping:'0',payments:[{method:'cash',received:cash}],points};};
 try{
  const setup=await req('POST','/api/setup',{name:'Dueño sintético',login:'rewards-owner',password});assert.equal(setup.statusCode,201,setup.body);cookie='nativos_session='+setup.cookies[0]!.value;
  const customer=await req('POST','/api/customers',{...common(),name:'Cliente fidelización',document:'LOYALTY-TEST',phone:'3000000000',email:'',address:''});assert.equal(customer.statusCode,200,customer.body);customerId=customer.json().id;
  const product=await req('POST','/api/products',{...common(),reason:'Producto sintético',type:'finished',name:'Producto puntos',reference:'LOYALTY-P',category:'Prueba',presentation:'Unidad',unit:'unit',price:'10000',tax:null,description:''});assert.equal(product.statusCode,200,product.body);productId=product.json().id;
  await t.test('AC-005-01/05: inscripción única y ajustes solo dueño con idempotencia',async()=>{
   const enrollment={...common(),customerId};assert.equal((await req('POST','/api/loyalty/enroll',enrollment)).statusCode,200);assert.equal((await req('POST','/api/loyalty/enroll',enrollment)).statusCode,200);assert.equal(await balance(),0n);
   assert.equal((await req('POST','/api/users',{name:'Cajero prueba',login:'rewards-cashier',password,role:'cashier',branchIds:['centro'],reason:'Prueba permisos'})).statusCode,201);const ownerCookie=cookie;const login=await req('POST','/api/login',{login:'rewards-cashier',password});cookie='nativos_session='+login.cookies[0]!.value;assert.equal((await req('POST','/api/loyalty/enroll',{...common(),customerId})).statusCode,200);assert.equal((await req('POST','/api/loyalty/adjust',{...common(),customerId,delta:'100',reason:'No autorizado'})).statusCode,403);assert.equal((await req('POST','/api/loyalty/rules',{...common(),earnEvery:'1',pointValue:'100',maxPercent:'100',reason:'No autorizado'})).statusCode,403);cookie=ownerCookie;assert.equal((await req('POST','/api/loyalty/rules',{...common(),earnEvery:'1000',pointValue:'10',maxPercent:'20',reason:'   '})).statusCode,400);
  });
  for(const branch of ['centro','milan']){const e=await open(branch);engines.push(e);await e.login('rewards-owner',password);const detail=(await req('GET','/api/branches/'+branch)).json();await e.enroll(detail.devices[0].id,'rewards-owner');await e.execute('rewards-owner','shift.open',{operationId:randomUUID(),openingCash:'0'});}
  await t.test('AC-005-02/03: compra offline acumula pendiente y confirma una vez al recuperar',async()=>{
   const e=engines[0]!;await draft(e);offline=true;first=(await send(e,pay(e))).sale as SaleV2;assert.equal(first.loyalty!.earnedPoints,'20');assert.equal(await balance(),0n);e.close();engines[0]=await open('centro');await engines[0]!.login('rewards-owner',password);assert.equal(engines[0]!.orders.receipt(first.id)!.loyalty!.earnedPoints,'20');offline=false;await engines[0]!.sync();await engines[0]!.sync();assert.equal(await balance(),20n);
   const adjustment={...common(),customerId,delta:'100',reason:'Saldo sintético para concurrencia'};const a=await req('POST','/api/loyalty/adjust',adjustment);assert.equal(a.statusCode,200,a.body);assert.deepEqual((await req('POST','/api/loyalty/adjust',adjustment)).json(),a.json());assert.equal(await balance(),120n);
  });
  await t.test('AC-005-04: dos cajas compiten por el mismo saldo sin doble canje',async()=>{
   for(const e of engines){await e.sync();await draft(e);}
   const results=await Promise.allSettled(engines.map(e=>send(e,pay(e,'100','19000'))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const i=results.findIndex(r=>r.status==='fulfilled');winner=engines[i]!;loser=engines[1-i]!;redeemed=(results[i] as PromiseFulfilledResult<Awaited<ReturnType<typeof send>>>).value.sale as SaleV2;assert.equal(await balance(),39n);assert.ok(loser.loyalty.pending());await loser.resolveRedemption('rewards-owner',true);assert.equal(loser.loyalty.pending(),null);assert.equal(await balance(),39n);
  });
  await t.test('REQ-007-02/AC-005-04: acuse de canje perdido, reinicio y recuperación sin repetir',async()=>{
   assert.equal((await req('POST','/api/loyalty/adjust',{...common(),customerId,delta:'200',reason:'Saldo de prueba recuperación'})).statusCode,200);loss=true;await assert.rejects(send(loser,pay(loser,'100','19000')),/conexión/);const staged=loser.loyalty.pending()!;assert.ok(staged);assert.equal(await balance(),158n);const position=engines.indexOf(loser);const branch=loser.stateV2('rewards-owner').branchId;loser.close();offline=true;loser=await open(branch);engines[position]=loser;await loser.login('rewards-owner',password);assert.equal(loser.stateV2('rewards-owner').canCharge,false);assert.equal(loser.loyalty.pending()!.id,staged.id);offline=false;await loser.resolveRedemption('rewards-owner',false);assert.equal(loser.loyalty.pending(),null);assert.equal(await balance(),158n);assert.ok(loser.orders.receipt(staged.id));assert.equal((await db.pool.query('SELECT count(*) FROM loyalty_ledger WHERE id=$1',[staged.id])).rows[0].count,'1');
  });
  await t.test('AC-005-08/06: devuelve dinero pagado y puntos proporcionales; saldo negativo permite comprar',async()=>{
   const line=redeemed.lines[0]!;const event:CommandEvent={kind:'sale.refund',saleId:redeemed.id,lines:[{lineId:line.id,quantity:'1',recoverable:true}],tip:'0',shipping:'0',payments:[{method:'cash',received:'9500'}],reason:'Media compra devuelta'};const id=randomUUID();const r=await send(winner,event,id);assert.equal((r.refund as RefundV2).loyalty!.redeemedRestored,'50');assert.equal((r.refund as RefundV2).loyalty!.earnedReversed,'10');assert.deepEqual(await send(winner,event,id),r);await winner.sync();assert.equal(await balance(),198n);
   const delta=3n-await balance();assert.equal((await req('POST','/api/loyalty/adjust',{...common(),customerId,delta:String(delta),reason:'Escenario de saldo negativo'})).statusCode,200);const origin=engines.find(e=>e.stateV2('rewards-owner').branchId==='centro')!;await send(origin,{kind:'sale.refund',saleId:first.id,lines:first.lines.map(l=>({lineId:l.id,quantity:l.quantity,recoverable:true})),tip:'0',shipping:'0',payments:[{method:'cash',received:'20000'}],reason:'Compra generadora devuelta'});await origin.sync();assert.equal(await balance(),-17n);await draft(origin);await send(origin,pay(origin));await origin.sync();assert.equal(await balance(),3n);
  });
  await t.test('REQ-005-06: regla nueva no recalcula historial ni compras offline ya autorizadas',async()=>{
   const e=engines[0]!;const previous=first.loyalty!.rule;const r=await req('POST','/api/loyalty/rules',{...common(),earnEvery:'500',pointValue:'20',maxPercent:'10',reason:'Regla nueva de prueba'});assert.equal(r.statusCode,200,r.body);assert.deepEqual(e.orders.receipt(first.id)!.loyalty!.rule,previous);const beforeBalance=await balance();offline=true;await draft(e);const stale=(await send(e,pay(e))).sale as SaleV2;assert.equal(stale.loyalty!.rule.id,previous.id);assert.equal(stale.loyalty!.earnedPoints,'20');offline=false;await e.sync();assert.equal(await balance(),beforeBalance+20n);assert.equal(e.loyalty.cache()!.rule.earnEvery,'500');assert.equal((await db.pool.query('SELECT data FROM pos_sales WHERE id=$1',[first.id])).rows[0].data.loyalty.earnedPoints,'20');
   const history=await req('GET',`/api/loyalty/history?branchId=centro&customerId=${customerId}`);assert.equal(history.statusCode,200,history.body);assert.ok(history.json().items.length>0);
  });

  await t.test('REQ-007-02: cancelar antes del commit bloquea mensajes tardíos; después recupera el cobro',async()=>{
   const e=engines[0]!;await draft(e);await e.sync();const amount=await balance();before=true;await assert.rejects(send(e,pay(e,'1','19980')),/conexión/);const staged=e.loyalty.pending()!;assert.ok(staged);assert.equal(await balance(),amount);await e.resolveRedemption('rewards-owner',true);assert.equal(e.loyalty.pending(),null);assert.equal(await balance(),amount);
   const late=await app.inject({method:'POST',url:'/api/pos/sync',headers:{host:'127.0.0.1:4345','x-nativos-request':'1','x-pos-token':e.vault.data.terminal!.token},payload:{operation:staged.operation,payload:staged.payload,signed:e.vault.data.grants[staged.auth.grant.grantId]}});assert.equal(late.statusCode,409,late.body);assert.equal(late.json().code,'redemption_cancelled');
   loss=true;await assert.rejects(send(e,pay(e,'1','19980')),/conexión/);const committed=e.loyalty.pending()!;const afterCommit=await balance();const recovered=await e.resolveRedemption('rewards-owner',true);assert.ok(recovered?.sale);assert.ok(e.orders.receipt(committed.id));assert.equal(e.loyalty.pending(),null);assert.equal(await balance(),afterCommit);
  });
  await t.test('AC-012-05: traslado conserva historia y pendientes, bloquea segundo navegador',async()=>{
   const index=engines.findIndex(e=>e.vault.data.terminal?.branchId==='centro');const old=engines[index]!;await draft(old);const pending=old.store.pending();assert.ok(pending.length);const expected=old.orders.history().length;const sequence=old.store.meta<number>('sequence');old.close();engines.splice(index,1);const targetId=randomUUID();const moved=await req('POST','/api/local-transition',{targetId});assert.equal(moved.statusCode,200,moved.statusCode===200?'':moved.body);assert.equal(moved.json().sales.length,expected);assert.equal(moved.json().sequence,sequence);assert.deepEqual(moved.json().outbox,pending);assert.deepEqual((await req('POST','/api/local-transition',{targetId})).json(),moved.json());assert.equal((await req('POST','/api/local-transition',{targetId:randomUUID()})).statusCode,409);const retired=await open('centro');assert.throws(()=>retired.stateV2('rewards-owner'),/trasladada/);retired.close();
  });
 }finally{for(const e of engines)e.close();await app.close();await db.stop();}
});
