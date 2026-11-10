import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate, transaction } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { queueLowStock, queueShiftClosed, runDailyLowStock } from '../../src/server/notifications-api.ts';
import { dispatchNotification } from '../../src/server/notification-delivery.ts';
import { deliveryConfigHash, whatsappConfig } from '../../src/server/whatsapp.ts';
import { seedNotificationReports } from '../notification-fixture.ts';

function zipEntry(file:Buffer,target:string) {let offset=0;while(file.readUInt32LE(offset)===0x04034b50){const size=file.readUInt32LE(offset+18),nameSize=file.readUInt16LE(offset+26),extra=file.readUInt16LE(offset+28);const name=file.subarray(offset+30,offset+30+nameSize).toString();const start=offset+30+nameSize+extra;if(name===target)return inflateRawSync(file.subarray(start,start+size)).toString();offset=start+size;}throw new Error('XLSX entry not found');}

test('REQ-009-05 a 08 — consolidado del dueño, permisos y entrega durable', {timeout:180_000},async t=>{
  const db=await startLocalPostgres(resolve('.local/notifications-test-'+randomUUID()),{password:randomBytes(32).toString('hex')});
  const config=whatsappConfig({NATIVOS_WHATSAPP_GRAPH_VERSION:'v26.0',NATIVOS_WHATSAPP_PHONE_NUMBER_ID:'12345678',NATIVOS_WHATSAPP_OWNER_PHONE:'573001234567',NATIVOS_WHATSAPP_OWNER_USER_ID:'pending',NATIVOS_WHATSAPP_ACCESS_TOKEN:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_APP_SECRET:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_VERIFY_TOKEN:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_CLOSE_TEMPLATE:'nativos_close',NATIVOS_WHATSAPP_STOCK_TEMPLATE:'nativos_stock',NATIVOS_WHATSAPP_LANGUAGE:'es_CO'});
  const app=await createApp({pool:db.pool,origin:'http://127.0.0.1:4371',whatsapp:config,notificationScheduler:false});
  const password=randomBytes(24).toString('base64url');
  try {
    await migrate(db.pool);
    const setup=await app.inject({method:'POST',url:'/api/setup',headers:{host:'127.0.0.1:4371','x-nativos-request':'1'},payload:{name:'Dueño WhatsApp',login:'owner-notifications',password}});assert.equal(setup.statusCode,201,setup.body);
    const headers={host:'127.0.0.1:4371','x-nativos-request':'1',cookie:`nativos_session=${setup.cookies[0]!.value}`};
    const owner=(await db.pool.query("SELECT id FROM app_users WHERE login='owner-notifications'")).rows[0].id;config.ownerUserId=owner;
    const live={...config,enabled:true};
    const {first,second}=await seedNotificationReports(db.pool,owner);
    await t.test('AC-009-06/07 — un cierre parcial y segundo consolidado; correcciones y devolución netas',async()=>{
      assert.equal(first.data.partial,true);assert.equal(first.data.branches.find((b:{branchId:string})=>b.branchId==='milan').status,'open');
      assert.equal(first.data.totals.sales,'15000');assert.equal(first.data.totals.products,'13500');assert.equal(first.data.totals.tips,'500');assert.equal(first.data.totals.shipping,'1000');
      assert.equal(first.data.totals.payments.cash,'5000');assert.equal(first.data.totals.payments.nequi,'10000');
      assert.equal(first.data.close.totals.correction,'1000');assert.equal(first.data.close.payments.find((p:{method:string})=>p.method==='cash').net,'8000');
      assert.equal(first.data.close.shift.expected,'158000');assert.equal(second.data.partial,false);assert.equal(second.data.totals.sales,'25000');
      await transaction(db.pool,c=>queueShiftClosed(c,'notify-centro'));
      assert.equal((await db.pool.query("SELECT count(*) FROM notification_intents WHERE type='shift_closed'")).rows[0].count,'2');
      assert.equal((await db.pool.query('SELECT data FROM notification_intents WHERE id=$1',[first.id])).rows[0].data.totals.sales,'15000');
      await assert.rejects(db.pool.query("UPDATE notification_intents SET mode='live' WHERE id=$1",[first.id]),/notification_content_immutable/);
    });
    await t.test('AC-009-05/08 — mínimos de ambos locales, recuperación y Excel completo',async()=>{
      assert.equal(await runDailyLowStock(db.pool,new Date('2026-10-14T18:00:00Z')),0);
      for(let i=0;i<121;i++) {
        await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$1,'raw','g')",[`notify-item-${i}`,`Artículo mínimo ${i}`]);
        await db.pool.query('INSERT INTO inventory_minimums(warehouse_id,item_id,minimum) VALUES($1,$2,2)',[i%2?'milan-venta':'centro-venta',`notify-item-${i}`]);
      }
      assert.equal(await runDailyLowStock(db.pool,new Date('2026-10-15T12:59:00Z')),0);
      assert.equal(await runDailyLowStock(db.pool,new Date('2026-10-14T20:00:00Z')),0,'Un corte vacío completado no genera avisos nuevos por ventas posteriores');
      await transaction(db.pool,c=>queueLowStock(c,'centro','2026-10-15',live,true));
      assert.equal((await db.pool.query("SELECT mode FROM notification_intents WHERE dedupe_key='owner-low-stock-preview:2026-10-15'")).rows[0].mode,'preview');
      assert.equal(await runDailyLowStock(db.pool,new Date('2026-10-15T18:00:00Z')),121);
      await runDailyLowStock(db.pool,new Date('2026-10-15T20:00:00Z'));
      const stock=(await db.pool.query("SELECT * FROM notification_intents WHERE dedupe_key='owner-low-stock:2026-10-15'")).rows[0];
      assert.equal(stock.recipient_role,'owner');assert.equal(stock.data.stock.length,121);assert.equal(stock.mode,'preview');
      const exported=await app.inject({method:'GET',url:`/api/notifications/${stock.id}/export`,headers});assert.equal(exported.statusCode,200,exported.body);
      const sheet=zipEntry(exported.rawPayload,'xl/worksheets/sheet2.xml');assert.equal((sheet.match(/<row /g)??[]).length,122);assert.match(sheet,/Artículo mínimo 120/);
      const detail=await app.inject({method:'GET',url:`/api/notifications/${first.id}`,headers});assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().reportPath,`/?notification=${first.id}`);
      assert.match(detail.json().text,/Ventas netas de productos \$ 13\.500/);assert.match(detail.json().text,/Recaudo neto \$ 15\.000/);
    });
    await t.test('AC-009-08 — simulación independiente, alcance integral e idempotencia ligada al reporte',async()=>{
      const body={operationId:randomUUID(),reason:'Simulación sintética',outcome:'delivered'};
      const request=()=>app.inject({method:'POST',url:`/api/notifications/${first.id}/simulate`,headers,payload:body});
      const preview=await request();assert.equal(preview.statusCode,200,preview.body);assert.equal(preview.json().simulated,true);assert.equal(preview.json().deliveryState,'pending');assert.deepEqual((await request()).json(),preview.json());
      assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[first.id])).rows[0].state,'pending');assert.equal((await db.pool.query('SELECT count(*) FROM notification_attempts')).rows[0].count,'0');
      assert.equal((await app.inject({method:'POST',url:`/api/notifications/${second.id}/simulate`,headers,payload:body})).statusCode,409);
      let after='';const seen:string[]=[];
      do {const r=await app.inject({method:'GET',url:'/api/notifications?branchId=centro&limit=1'+(after?'&after='+after:''),headers});assert.equal(r.statusCode,200,r.body);seen.push(...r.json().items.map((row:{id:string})=>row.id));after=r.json().nextCursor??'';}while(after);
      assert.equal(new Set(seen).size,seen.length);assert.ok(seen.includes(first.id)&&seen.includes(second.id));
      await db.pool.query("UPDATE app_users SET branch_ids=ARRAY['centro'] WHERE id=$1",[owner]);
      for(const path of [`/api/notifications/${first.id}`,`/api/notifications/${first.id}/export`])assert.equal((await app.inject({method:'GET',url:path,headers})).statusCode,403);
      const list=await app.inject({method:'GET',url:'/api/notifications?branchId=centro',headers});assert.equal(list.json().items.length,0);
      await db.pool.query("UPDATE app_users SET branch_ids=ARRAY['centro','milan'] WHERE id=$1",[owner]);
    });
    const makeLive=async()=>{const id=randomUUID();await db.pool.query(`INSERT INTO notification_intents(id,dedupe_key,type,branch_id,causal_id,recipient_role,state,data,mode,delivery_config_hash) VALUES($1,$1,'shift_closed','centro',$1,'owner','pending',$2,'live',$3)`,[id,JSON.stringify(first.data),deliveryConfigHash(live)]);return id;};
    const webhook=async(intentId:string,status:string,timestamp='1792076400',valid=true)=>{
      const row=(await db.pool.query('SELECT delivery_id FROM notification_intents WHERE id=$1',[intentId])).rows[0];
      const payload=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:config.phoneNumberId},statuses:[{id:'wamid.'+intentId,status,timestamp,biz_opaque_callback_data:row.delivery_id}]}}]}]});
      const signature='sha256='+createHmac('sha256',config.appSecret).update(valid?payload:'different').digest('hex');
      return app.inject({method:'POST',url:'/api/whatsapp/webhook',headers:{host:'127.0.0.1:4371','content-type':'application/json','x-hub-signature-256':signature},payload});
    };
    await t.test('AC-009-09/10 — sin red desactivado, aceptación y webhook firmado',async()=>{
      let calls=0;assert.equal(await dispatchNotification(db.pool,config,async()=>{calls++;throw new Error('never');}),false);assert.equal(calls,0);
      // Preview records remain ineligible even when the adapter is enabled.
      assert.equal(await dispatchNotification(db.pool,live,async()=>{calls++;throw new Error('never');}),false);assert.equal(calls,0);
      const id=await makeLive();assert.equal(await dispatchNotification(db.pool,live,async()=>{calls++;return {outcome:'accepted',messageId:'wamid.'+id,safeCode:null};}),true);
      assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[id])).rows[0].state,'accepted');
      assert.equal((await webhook(id,'delivered','1792076400',false)).statusCode,403);
      assert.equal((await webhook(id,'delivered')).statusCode,200);
      const before=(await db.pool.query('SELECT count(*) FROM notification_delivery_events WHERE intent_id=$1',[id])).rows[0].count;
      assert.equal((await webhook(id,'delivered')).statusCode,200);assert.equal((await db.pool.query('SELECT count(*) FROM notification_delivery_events WHERE intent_id=$1',[id])).rows[0].count,before);
      await webhook(id,'sent','1792076300');await webhook(id,'failed','1792076500');
      assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[id])).rows[0].state,'delivered');
      assert.equal((await app.inject({method:'GET',url:`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=challenge`,headers:{host:'127.0.0.1:4371'}})).body,'challenge');
      const status=await app.inject({method:'GET',url:'/api/notifications/config',headers});assert.equal(status.statusCode,200);assert.equal(status.json().recipient,'••••4567');assert.ok(!status.body.includes(config.accessToken)&&!status.body.includes(config.ownerPhone));
    });
    await t.test('AC-009-10 — despachos concurrentes, callback anterior a respuesta y timeout',async()=>{
      const id=await makeLive();let calls=0;
      const result=await Promise.all([1,2].map(()=>dispatchNotification(db.pool,live,async()=>{calls++;await webhook(id,'read');return {outcome:'uncertain',messageId:null,safeCode:'transport_uncertain'};})));
      assert.equal(calls,1);assert.equal(result.filter(Boolean).length,1);assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[id])).rows[0].state,'read');
      const timeout=await makeLive();await dispatchNotification(db.pool,live,async()=>{throw new Error('timeout');});
      assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[timeout])).rows[0].state,'uncertain');
      assert.equal(await dispatchNotification(db.pool,live,async()=>{throw new Error('must not retry');}),false);
      const abandoned=await makeLive();await db.pool.query("UPDATE notification_intents SET state='sending',delivery_id=$2,claimed_at=now()-interval '3 minutes' WHERE id=$1",[abandoned,randomUUID()]);
      await dispatchNotification(db.pool,live,async()=>{throw new Error('must not retry');});assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[abandoned])).rows[0].state,'uncertain');
    });
    await t.test('AC-021-04 — fallo definitivo por callback impide reintento por respuesta HTTP tardía',async()=>{
      const id=await makeLive();let calls=0;
      await dispatchNotification(db.pool,live,async()=>{calls++;await webhook(id,'failed');return {outcome:'retryable',messageId:null,safeCode:'provider_130429'};});
      const row=(await db.pool.query('SELECT state,next_attempt_at FROM notification_intents WHERE id=$1',[id])).rows[0];
      assert.equal(row.state,'failed_terminal');assert.equal(row.next_attempt_at,null);
      assert.equal(await dispatchNotification(db.pool,live,async()=>{calls++;throw new Error('must not retry');}),false);
      assert.equal(calls,1);
    });
    await t.test('AC-009-09/10 — backoff acotado y revocación antes de envío',async()=>{
      const id=await makeLive();let calls=0;
      for(let n=0;n<3;n++){await db.pool.query('UPDATE notification_intents SET next_attempt_at=NULL WHERE id=$1',[id]);await dispatchNotification(db.pool,live,async()=>{calls++;return {outcome:'retryable',messageId:null,safeCode:'provider_130429'};});}
      assert.equal(calls,3);assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[id])).rows[0].state,'failed_terminal');
      const revoked=await makeLive();await db.pool.query('UPDATE app_users SET active=false WHERE id=$1',[owner]);
      await dispatchNotification(db.pool,live,async()=>{calls++;throw new Error('revoked');});assert.equal(calls,3);assert.equal((await db.pool.query('SELECT state FROM notification_intents WHERE id=$1',[revoked])).rows[0].state,'failed_terminal');await db.pool.query('UPDATE app_users SET active=true WHERE id=$1',[owner]);
    });
  }finally{await app.close();await db.stop();}
});
