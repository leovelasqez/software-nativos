import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { colombiaDate, money, sumSales, templateSummary } from '../src/notification-report.ts';
import type { NotificationReport } from '../src/notification-report.ts';
import { sendWhatsApp, validWebhookSignature, whatsappConfig } from '../src/server/whatsapp.ts';
import { transitionDelivery } from '../src/notification-state.ts';

test('AC-009-05/07 — fecha Colombia, acumulación precisa y resumen sin saltos',()=>{
  assert.equal(colombiaDate(new Date('2026-10-15T04:59:59Z')),'2026-10-14');assert.equal(colombiaDate(new Date('2026-10-15T05:00:00Z')),'2026-10-15');
  const totals=sumSales([{products:'9007199254740993.1',sales:'1.2',refunds:'0',saleCount:1,tips:'0',shipping:'0',payments:{cash:'-1'}},{products:'0.2',sales:'-0.2',refunds:'1',saleCount:0,tips:'0',shipping:'0',payments:{cash:'0.2'}}]);
  assert.equal(totals.products,'9007199254740993.3');assert.equal(totals.sales,'1');assert.equal(totals.payments.cash,'-0.8');
  assert.equal(money(totals.products),'$ 9.007.199.254.740.993,3');
  const report={kind:'low_stock_daily',date:'2026-10-15',stock:[{branchName:'Centro',itemName:'Artículo\ncon\ttabulación',quantity:'0',baseUnit:'g'}]} as NotificationReport;
  assert.doesNotMatch(templateSummary(report),/[\n\t]/);assert.ok(templateSummary(report).length<=900);
});
test('AC-009-09 — configuración incompleta impide red; HMAC requiere cuerpo exacto',async()=>{
  const config=whatsappConfig({NATIVOS_WHATSAPP_ENABLED:'true',NATIVOS_WHATSAPP_OWNER_PHONE:'invalid'});
  assert.equal(config.ready,false);assert.ok(config.missing.includes('NATIVOS_WHATSAPP_OWNER_PHONE'));
  assert.equal((await sendWhatsApp(config,{} as NotificationReport,'test','test')).safeCode,'adapter_disabled');
  const secret=randomBytes(32).toString('hex');const raw=Buffer.from('{"entry":[]}');const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
  assert.equal(validWebhookSignature(raw,signature,secret),true);assert.equal(validWebhookSignature(Buffer.from('{}'),signature,secret),false);assert.equal(validWebhookSignature(raw,'sha256=bad',secret),false);
});
test('AC-009-10 — estados de entrega no retroceden por callbacks repetidos',()=>{
  assert.equal(transitionDelivery('delivered',{kind:'webhook',state:'sent'}),'delivered');assert.equal(transitionDelivery('read',{kind:'webhook',state:'failed_terminal'}),'read');assert.equal(transitionDelivery('sent',{kind:'webhook',state:'delivered'}),'delivered');assert.equal(transitionDelivery('uncertain',{kind:'webhook',state:'delivered'}),'delivered');
});
test('AC-009-09 — adaptador transmite plantilla/callback y distingue aceptación de entrega',async t=>{
  const config=whatsappConfig({NATIVOS_WHATSAPP_ENABLED:'true',NATIVOS_WHATSAPP_GRAPH_VERSION:'v26.0',NATIVOS_WHATSAPP_PHONE_NUMBER_ID:'12345678',NATIVOS_WHATSAPP_OWNER_PHONE:'573001234567',NATIVOS_WHATSAPP_OWNER_USER_ID:'owner-test',NATIVOS_WHATSAPP_ACCESS_TOKEN:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_APP_SECRET:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_VERIFY_TOKEN:randomBytes(32).toString('hex'),NATIVOS_WHATSAPP_CLOSE_TEMPLATE:'nativos_close',NATIVOS_WHATSAPP_STOCK_TEMPLATE:'nativos_stock',NATIVOS_WHATSAPP_LANGUAGE:'es_CO'});
  assert.equal(config.ready,true);
  const report={kind:'low_stock_daily',date:'2026-10-15',stock:[]} as unknown as NotificationReport;
  let status=200;let data:unknown={messages:[{id:'wamid.synthetic'}]};
  const mocked=t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
    assert.equal(url,'https://graph.facebook.com/v26.0/12345678/messages');const body=JSON.parse(String(options.body));assert.equal(body.biz_opaque_callback_data,'attempt');assert.equal(body.template.components[1].parameters[0].text,'intent');
    return new Response(JSON.stringify(data),{status});
  });
  assert.equal((await sendWhatsApp(config,report,'intent','attempt')).outcome,'accepted');
  status=429;data={error:{code:130429,message:'must not be recorded'}};assert.equal((await sendWhatsApp(config,report,'intent','attempt')).outcome,'retryable');
  status=503;assert.equal((await sendWhatsApp(config,report,'intent','attempt')).outcome,'uncertain');
  status=200;data={};assert.equal((await sendWhatsApp(config,report,'intent','attempt')).outcome,'uncertain');
  mocked.mock.mockImplementation(async()=>{throw new Error('request timeout');});assert.equal((await sendWhatsApp(config,report,'intent','attempt')).outcome,'uncertain');
});
