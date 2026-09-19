import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';

test('AC-017-02: Resumen real, alcance por sucursal, 120 ventas, cortes Colombia y mínimos', {timeout:120_000}, async t => {
  const db = await startLocalPostgres(resolve('.local/dashboard-test-'+randomUUID()), {password:randomBytes(32).toString('hex')});
  const origin = 'http://127.0.0.1:4358'; const app = await createApp({pool:db.pool,origin});
  try {
    await migrate(db.pool);
    const password = randomBytes(24).toString('base64url');
    const writeHeaders = {host:'127.0.0.1:4358','x-nativos-request':'1'};
    const setup = await app.inject({method:'POST',url:'/api/setup',headers:writeHeaders,payload:{name:'Dueño Resumen',login:'dashboard-owner',password}});
    assert.equal(setup.statusCode,201,setup.body);
    const headers = {...writeHeaders,cookie:`nativos_session=${setup.cookies[0]!.value}`};
    const actor = (await db.pool.query("SELECT id FROM app_users WHERE login='dashboard-owner'")).rows[0].id;
    for (const branch of ['centro','milan']) await db.pool.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at) VALUES($1,$2,$3,$4,0,now(),now())', [`shift-${branch}`,branch+'-caja',branch,actor]);
    async function addSale(id: string, branch: string, occurredAt: string, paid: string, qty='1') {
      const data = {id,total:'99999',products:'100000',tipPaid:'77',shippingPaid:'88',loyalty:{redeemedAmount:'100'},customer:{name:'Cliente privado',phone:'111222333'},cost:'confidential',
        lines:[{id:'line',productId:`product-${branch}`,name:`Producto ${branch}`,presentation:'Unidad',quantity:qty,paidAmount:paid}]};
      await db.pool.query('INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$1,$2,$3,$4,$5,$1,$6,0,$7,false)',[id,`shift-${branch}`,branch+'-caja',branch,actor,JSON.stringify(data),occurredAt]);
    }
    for(let i=0;i<120;i++) await addSale(`sale-${i}`,'centro','2026-09-19T16:00:00Z','100.5');
    await addSale('at-midnight','centro','2026-09-19T05:00:00Z','700');
    await addSale('month-start','centro','2026-09-01T05:00:00Z','800');
    await addSale('previous-month','centro','2026-09-01T04:59:59Z','999');
    await addSale('next-day','centro','2026-09-20T05:00:00Z','10000');
    await addSale('other-branch','milan','2026-09-19T23:00:00Z','2000','2');
    const refund = {total:'100',tip:'10',shipping:'20',occurredAtMs:Date.parse('2026-09-19T05:00:00Z'),lines:[{lineId:'line',quantity:'0.5'}]};
    await db.pool.query("INSERT INTO pos_refunds(id,sale_id,shift_id,data,cash_applied) VALUES('refund-old','previous-month','shift-centro',$1,0)",[JSON.stringify(refund)]);
    await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES('low','Agotado','low','raw','g'),('equal','En mínimo','equal','raw','ml'),('enough','Disponible','enough','raw','unit'),('unconfigured','Sin mínimo','unconfigured','raw','unit')");
    await db.pool.query("INSERT INTO inventory_minimums(warehouse_id,item_id,minimum) VALUES('centro-venta','low',0),('centro-venta','enough',3),('milan-venta','equal',5)");
    await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit,archived_at) VALUES('archived','Archivado','archived','finished','unit',now())");
    await db.pool.query("INSERT INTO inventory_minimums(warehouse_id,item_id,minimum) VALUES('centro-venta','archived',10)");
    await db.pool.query("INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,unit_cost,reason) VALUES('initial-enough','enough','centro-venta','initial',4,98765,'Prueba sintética'),('initial-equal','equal','milan-venta','initial',5,87654,'Prueba sintética')");
    await db.pool.query("INSERT INTO pos_terminals(device_id,installation_id,token_hash,last_sync_at) VALUES('centro-caja','synthetic-dashboard','synthetic','2026-09-19T16:00:00Z')");
    const cashierPassword = randomBytes(24).toString('base64url');
    const cashier = await app.inject({method:'POST',url:'/api/users',headers,payload:{name:'Cajero Resumen',login:'dashboard-cashier',password:cashierPassword,role:'cashier',branchIds:['centro'],reason:'AC-017 sintético'}});
    assert.equal(cashier.statusCode,201,cashier.body);
    const login = await app.inject({method:'POST',url:'/api/login',headers:writeHeaders,payload:{login:'dashboard-cashier',password:cashierPassword}});
    assert.equal(login.statusCode,200,login.body);
    const cashierHeaders = {...writeHeaders,cookie:`nativos_session=${login.cookies[0]!.value}`};
    t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-19T18:00:00Z')});
    const result = await app.inject({method:'GET',url:'/api/dashboard?branchId=centro',headers});
    assert.equal(result.statusCode,200,result.body); const local = result.json();
    assert.deepEqual(local.day,{sales:'12690',saleCount:121,refunds:'70'});
    assert.deepEqual(local.month,{sales:'13490',saleCount:122,refunds:'70'});
    assert.equal(local.ticketAverage,'105');
    assert.equal(local.daily.length,19); assert.equal(local.daily[18].sales,'12690');
    assert.deepEqual(local.topProducts,[{productId:'product-centro',name:'Producto centro',presentation:'Unidad',quantity:'121.5'}]);
    assert.deepEqual(local.inventoryAlerts.map((i:{itemId:string})=>i.itemId),['low']);
    assert.equal(local.context.today,'2026-09-19'); assert.equal(local.context.monthStart,'2026-09-01');
    assert.equal(local.context.lastSynchronizedAt.centro,'2026-09-19T16:00:00.000Z');
    assert.doesNotMatch(result.body,/Cliente privado|phone|cost|98765|87654/i);
    const all = await app.inject({method:'GET',url:'/api/dashboard?branchId=all',headers});
    assert.equal(all.statusCode,200,all.body); assert.equal(all.json().day.sales,'14690'); assert.equal(all.json().month.sales,'15490');
    assert.deepEqual(all.json().context.branchIds.sort(),['centro','milan']); assert.equal(all.json().context.lastSynchronizedAt.milan,null);
    assert.equal(all.json().inventoryAlerts.length,2); assert.equal(all.json().topProducts.length,2);
    const restricted = await app.inject({method:'GET',url:'/api/dashboard?branchId=all',headers:cashierHeaders});
    assert.equal(restricted.statusCode,200,restricted.body); assert.deepEqual(restricted.json(),local);
    assert.equal((await app.inject({method:'GET',url:'/api/dashboard?branchId=milan',headers:cashierHeaders})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:'/api/dashboard?branchId=centro',headers:writeHeaders})).statusCode,401);
    for(const query of ['', '?branchId=all&cost=true','?branchId=../milan','?branchId=centro&branchId=milan'])
      assert.equal((await app.inject({method:'GET',url:'/api/dashboard'+query,headers})).statusCode,400,query);
    await db.pool.query("UPDATE app_users SET actions=array_remove(actions,'data.read') WHERE login='dashboard-cashier'");
    assert.equal((await app.inject({method:'GET',url:'/api/dashboard?branchId=all',headers:cashierHeaders})).statusCode,403);
    t.mock.timers.reset();
  } finally { t.mock.timers.reset(); await app.close(); await db.stop(); }
});
