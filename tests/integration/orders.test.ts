import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { resolve,join } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { PosEngine } from '../../src/pos/engine.ts';
import { emptyLine,upgradeOrder } from '../../src/orders-domain.ts';
import type { CommandEvent,SaleV2 } from '../../src/orders-domain.ts';
test('Incremento 4 — pedidos, clientes, cancelación, división y devolución persistentes', {timeout:240_000},async t=>{
  const directory=resolve('.local/test-'+randomUUID());const password=randomBytes(24).toString('base64url');const db=await startLocalPostgres(directory,{password:randomBytes(32).toString('hex')});
  await migrate(db.pool);const app=await createApp({pool:db.pool,origin:'http://127.0.0.1:4340'});let cookie='';let offline=false;let loseSale=false;
  const req=(method:'GET'|'POST',url:string,payload?:object)=>app.inject({method,url,...(payload?{payload}:{}),headers:{host:'127.0.0.1:4340',cookie,'x-nativos-request':'1'}});
  const open=()=>PosEngine.open(join(directory,'pos'),'http://127.0.0.1:4340',{request:async(url,init)=>{
    if(offline)throw new Error('offline fixture');const headers=Object.fromEntries(new Headers(init.headers));headers.host='127.0.0.1:4340';
    const r=await app.inject({method:init.method as 'POST'|'GET',url:new URL(url).pathname+new URL(url).search,headers,...(init.body?{payload:String(init.body)}:{})});
    if(loseSale&&url.endsWith('/pos/sync')&&String(init.body).includes('sale.split')&&r.statusCode===200){loseSale=false;throw new Error('lost accepted response');}return new Response(r.body,{status:r.statusCode,headers:r.headers as Record<string,string>});
  }});
  let engine:PosEngine|undefined;let first:SaleV2;let second:SaleV2;let customerId='';let productId='';const common=()=>({operationId:randomUUID(),branchId:'centro',reason:'Prueba sintética incremento 4'});
  const send=(e:CommandEvent,id=randomUUID())=>engine!.executeV2('owner-orders',id,e);
  try{
    const setup=await req('POST','/api/setup',{name:'Dueño sintético',login:'owner-orders',password});assert.equal(setup.statusCode,201,setup.body);cookie=`nativos_session=${setup.cookies[0]!.value}`;
    assert.equal((await req('POST','/api/users',{name:'Cajero sintético',login:'cashier-orders',password,role:'cashier',branchIds:['centro'],reason:'Permiso de prueba'})).statusCode,201);
    const p=await req('POST','/api/products',{...common(),type:'finished',name:'Producto sintético',reference:'ORDER-FIN',category:'Prueba',presentation:'Unidad',unit:'unit',price:'10000',tax:null,description:''});assert.equal(p.statusCode,200,p.body);productId=p.json().id;
    const branch=(await req('GET','/api/branches/centro')).json();engine=await open();await engine.login('owner-orders',password);await engine.enroll(branch.devices[0].id,'owner-orders');
    await t.test('AC-005-01/AC-004-01: cliente único, alta por cajero y selección sin perder pedido',async()=>{
      await engine!.login('cashier-orders',password);
      const c=await engine!.createCustomer('cashier-orders',{operationId:randomUUID(),branchId:'centro',name:'Cliente sintético',document:'TEST-123',phone:'3000000000',email:'',address:'Dirección de prueba'});customerId=c.id;
      await assert.rejects(engine!.createCustomer('cashier-orders',{operationId:randomUUID(),branchId:'centro',name:'Duplicado',document:'test-123',phone:'3000000000',email:'',address:''}),/registrado/);
      assert.equal(engine!.orders.customers().length,1);await engine!.login('owner-orders',password);
      const s=engine!.stateV2('owner-orders');const order={...s.order,customerId,mode:'delivery' as const,label:'Pedido de prueba',address:'Dirección de prueba',shipping:'3000',lines:[{...emptyLine({id:randomUUID(),productId,snapshotId:s.snapshot!.id,quantity:'3',optionIds:[]}),discount:{kind:'percent' as const,value:'10'}}]};
      await send({kind:'order.save',order});assert.equal(engine!.stateV2('owner-orders').order.lines.length,1);
    });
    await t.test('AC-004-03/08: comanda sin consumo, rollback y desperdicio solo de unidades preparadas',async()=>{
      await engine!.execute('owner-orders','shift.open',{operationId:randomUUID(),openingCash:'50000'});const o=engine!.stateV2('owner-orders').order;
      const before=engine!.store.pending().length;const auth=engine!.access('owner-orders','order.write');
      assert.throws(()=>engine!.orders.command(randomUUID(),{failure:true},auth,{kind:'order.prepare',orderId:o.id,revision:o.revision,occurredAtMs:Date.now(),shiftId:null},engine!.vault.data.installationId,()=>{throw new Error('rollback');}),/rollback/);assert.equal(engine!.store.pending().length,before);assert.equal(engine!.orders.get(o.id)!.revision,o.revision);
      await send({kind:'order.prepare',orderId:o.id,revision:o.revision});assert.ok(engine!.store.balances().every(i=>!i.negative));offline=true;
      const sent=engine!.stateV2('owner-orders').order;await send({kind:'order.cancel',orderId:sent.id,revision:sent.revision,lines:[{lineId:sent.lines[0]!.id,quantity:'1',preparedQuantity:'1'}],reason:'Una unidad preparada cancelada'});assert.equal(engine!.store.balances().find(i=>i.itemId===productId)!.quantity,'-1');
    });
    await t.test('AC-004-04/10: cobro dividido, medios combinados, cambio e idempotencia local',async()=>{
      const o=engine!.stateV2('owner-orders').order;const id=randomUUID();const event:CommandEvent={kind:'sale.split',orderId:o.id,revision:o.revision,selection:[{lineId:o.lines[0]!.id,quantity:'1'}],customerId,tip:{kind:'percent',value:'10'},shipping:'0',payments:[{method:'nequi',received:'5000'},{method:'cash',received:'10000'}]};
      const r=await send(event,id);assert.deepEqual(await send(event,id),r);first=r.sale as SaleV2;assert.equal(first.total,'9900');assert.equal(first.change,'5100');assert.equal(engine!.store.shift()!.expected,'54900');assert.equal(engine!.stateV2('owner-orders').order.lines[0]!.quantity,'1');
      engine!.close();engine=await open();await engine.login('owner-orders',password);assert.equal(engine.orders.receipt(first.id)!.customer!.id,customerId);assert.equal(engine.stateV2('owner-orders').order.lines[0]!.quantity,'1');
    });
    await t.test('AC-003-02/REQ-007-02: saldo negativo permitido y acuse v2 perdido sin duplicar consumo',async()=>{
      offline=false;loseSale=true;await engine!.sync();assert.ok(engine!.store.pending().length>0);await engine!.sync();assert.equal(engine!.store.pending().length,0,engine!.message);
      assert.deepEqual((await db.pool.query('SELECT data FROM pos_sales WHERE id=$1',[first.id])).rows[0].data,first);assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count,'1');assert.equal((await db.pool.query('SELECT sum(quantity)::text AS n FROM inventory_movements WHERE item_id=$1',[productId])).rows[0].n,'-2.000000');
      const o=engine!.stateV2('owner-orders').order;assert.deepEqual((await db.pool.query('SELECT data FROM pos_orders_v2 WHERE id=$1',[o.id])).rows[0].data,o);
      const r=await send({kind:'sale.split',orderId:o.id,revision:o.revision,selection:[{lineId:o.lines[0]!.id,quantity:'1'}],customerId:null,tip:{kind:'amount',value:'100'},shipping:'3000',payments:[{method:'cash',received:'20000'}]});second=r.sale as SaleV2;assert.equal(second.total,'12100');assert.equal(engine!.store.shift()!.expected,'67000');
      await engine!.sync();assert.equal(engine!.store.pending().length,0,engine!.message);
    });
    await t.test('REQ-004-06/REQ-006-03: devolución parcial con propina/envío, límites y permisos',async()=>{
      const event:CommandEvent={kind:'sale.refund',saleId:first.id,lines:[{lineId:first.lines[0]!.id,quantity:'1',recoverable:true}],tip:'900',shipping:'0',payments:[{method:'cash',received:'5000'},{method:'nequi',received:'4900'}],reason:'Devolución sintética'};
      await engine!.login('cashier-orders',password);await assert.rejects(engine!.executeV2('cashier-orders',randomUUID(),event),/permiso/);
      await engine!.login('owner-orders',password);const id=randomUUID();const r=await send(event,id);assert.deepEqual(await send(event,id),r);await assert.rejects(send(event),/cantidad/);assert.equal(engine!.store.shift()!.expected,'62000');
      await send({kind:'sale.refund',saleId:second.id,lines:[],tip:'0',shipping:'1000',payments:[{method:'nequi',received:'1000'}],reason:'Domicilio parcialmente devuelto'});
      await engine!.sync();assert.equal(engine!.store.pending().length,0,engine!.message);assert.equal((await db.pool.query('SELECT count(*) FROM pos_refunds')).rows[0].count,'2');assert.equal((await db.pool.query('SELECT sum(quantity)::text AS n FROM inventory_movements WHERE item_id=$1',[productId])).rows[0].n,'-2.000000');
      await engine!.execute('owner-orders','shift.close',{operationId:randomUUID(),counted:'62000'});await engine!.sync();assert.equal(engine!.store.pending().length,0,engine!.message);const shift=(await db.pool.query('SELECT expected::text,difference::text FROM pos_shifts')).rows[0];assert.equal(shift.expected,'62000.000000');assert.equal(shift.difference,'0.000000');assert.deepEqual(engine!.stateV2('owner-orders').shiftSummary,{tip:'100',shipping:'2000'});
      const history=await req('GET',`/api/customers/${customerId}/history?branchId=centro`);assert.equal(history.statusCode,200,history.body);assert.equal(history.json().items.length,1);assert.equal(history.json().items[0].refunds.length,1);assert.equal((await req('GET',`/api/customers/${customerId}/history?branchId=milan`)).json().items.length,0);
      const login=await req('POST','/api/login',{login:'cashier-orders',password});cookie=`nativos_session=${login.cookies[0]!.value}`;assert.equal((await req('GET',`/api/customers/${customerId}/history?branchId=milan`)).statusCode,403);
    });

    await t.test('AC-016-08: cierre vacío offline, reintento, reinicio y aceptación central sin efectos',async()=>{
      const empty=upgradeOrder({id:randomUUID(),revision:0,snapshotId:engine!.stateV2('owner-orders').snapshot!.id,lines:[]});
      const inventoryBefore=(await db.pool.query('SELECT count(*) FROM inventory_movements')).rows[0].count;
      const salesBefore=(await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count;
      offline=true;
      await send({kind:'order.save',order:empty});
      const event:CommandEvent={kind:'order.cancel',orderId:empty.id,revision:1,lines:[],reason:'Cierre de pestaña vacía'};
      const id=randomUUID();const result=await send(event,id);
      assert.deepEqual(await send(event,id),result);
      assert.equal(engine!.orders.get(empty.id)!.closed,true);
      engine!.close();engine=await open();
      await engine.login('owner-orders',password);
      assert.equal(engine.orders.get(empty.id)!.closed,true);
      assert.deepEqual(await send(event,id),result);
      offline=false;await engine.sync();
      assert.equal(engine.store.pending().length,0,engine.message);
      assert.equal((await db.pool.query('SELECT data FROM pos_orders_v2 WHERE id=$1',[empty.id])).rows[0].data.closed,true);
      assert.equal((await db.pool.query('SELECT count(*) FROM inventory_movements')).rows[0].count,inventoryBefore);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count,salesBefore);
    });

    await t.test('REQ-007-01: migra pedido v1 pendiente sin perder identidad ni duplicar cobro',async()=>{
      const old=engine!.store.newOrder(engine!.access('owner-orders','data.read').grant.actorId);old.lines=[{id:randomUUID(),productId,snapshotId:old.snapshotId,quantity:'1',optionIds:[]}];await engine!.saveOrder('owner-orders',old);
      const saved=engine!.store.order(engine!.access('owner-orders','data.read').grant.actorId)!;engine!.close();engine=await open();await engine.login('owner-orders',password);
      const migrated=engine.orders.get(saved.id)!;assert.equal(migrated.lines[0]!.productId,productId);assert.equal(migrated.revision,0);
      await send({kind:'order.prepare',orderId:migrated.id,revision:0});await engine.sync();assert.equal(engine.store.pending().length,0,engine.message);assert.deepEqual((await db.pool.query('SELECT data FROM pos_orders_v2 WHERE id=$1',[saved.id])).rows[0].data,engine.orders.get(saved.id));
      await assert.rejects(engine.execute('owner-orders','sale.charge',{operationId:randomUUID(),orderId:saved.id,revision:saved.revision,payment:{method:'cash',received:'10000'}}),/actualizó/);
    });
  }finally{engine?.close();await app.close();await db.stop();}
});
