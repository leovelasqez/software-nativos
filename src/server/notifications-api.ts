import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { audit, transaction } from './db.ts';
import { ApiError, authenticate, requireAccess, requireAdmin } from './security.ts';
import type { Actor } from './db.ts';
import { colombiaDate, reportSheets, reportText, sumSales } from '../notification-report.ts';
import type { NotificationReport } from '../notification-report.ts';
import { closeReport, reportBranches, stockRows } from './notification-reports.ts';
import { deliveryConfigHash, whatsappConfig } from './whatsapp.ts';
import type { SendTransport, WhatsAppConfig } from './whatsapp.ts';
import { dispatchNotification, registerWhatsAppWebhook } from './notification-delivery.ts';
import { xlsx } from './xlsx.ts';
import { isNotificationState } from '../notification-state.ts';
import type { NotificationState } from '../notification-state.ts';

const outcomes=new Set(['delivered','retryable','terminal','uncertain']);
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
type IntentRow={id:string;type:string;branch_id:string;causal_id:string;recipient_role:string;state:NotificationState;mode:string;data:NotificationReport;created_at:Date};
async function add(c:PoolClient,report:NotificationReport,branchId:string,causalId:string,dedupeKey:string,config:WhatsAppConfig) {
  await c.query(`INSERT INTO notification_intents(id,dedupe_key,type,branch_id,causal_id,recipient_role,state,data,mode,delivery_config_hash) VALUES($1,$2,$3,$4,$5,'owner','pending',$6,$7,$8) ON CONFLICT(dedupe_key) DO NOTHING`,[randomUUID(),dedupeKey,report.kind,branchId,causalId,JSON.stringify(report),config.enabled&&config.ready?'live':'preview',deliveryConfigHash(config)]);
}
export function isDailyLowStockWindow(now=new Date()) {return Number(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',hour:'2-digit',hourCycle:'h23'}).format(now))>=8;}
export async function queueLowStock(c:PoolClient,_branchId:string,date=colombiaDate(),config=whatsappConfig(),manual=false) {
  const rows=await stockRows(c);
  if(rows.length) {
    const branches=await reportBranches(c);
    if(branches[0])await add(c,{version:2,kind:'low_stock_daily',branchIds:branches.map(b=>b.id),date,preparedAt:new Date().toISOString(),coverage:'server-synchronized-only',partial:false,branches:[],totals:sumSales([]),close:null,stock:rows},branches[0].id,date,`owner-low-stock${manual?'-preview':''}:${date}`,manual?{...config,enabled:false}:config);
  }
  return rows.length;
}
export async function runDailyLowStock(pool:Pool,now=new Date(),config=whatsappConfig()) {
  if(!isDailyLowStockWindow(now))return 0;
  return transaction(pool,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(7301)');const date=colombiaDate(now);
    const prior=(await c.query('SELECT low_stock_rows FROM notification_daily_runs WHERE report_date=$1',[date])).rows[0];if(prior)return Number(prior.low_stock_rows);
    const count=await queueLowStock(c,'',date,config);await c.query('INSERT INTO notification_daily_runs(report_date,low_stock_rows) VALUES($1,$2)',[date,count]);return count;
  });
}
export async function queueShiftClosed(c:PoolClient,shiftId:string,config=whatsappConfig()) {
  if((await c.query('SELECT 1 FROM notification_intents WHERE dedupe_key=$1',[`owner-close:${shiftId}`])).rowCount)return;
  const report=await closeReport(c,shiftId);
  if(report?.close)await add(c,report,report.close.branchId,shiftId,`owner-close:${shiftId}`,config);
}
function scopeOf(row:IntentRow) {return row.data.version===2&&Array.isArray(row.data.branchIds)?row.data.branchIds:[row.branch_id];}
function checkScope(actor:Actor,row:IntentRow) {
  if(!scopeOf(row).every(branch=>actor.user.branch_ids.includes(branch)))throw new ApiError(403,'forbidden','El informe reúne sucursales fuera de tu acceso.');
  for(const branch of scopeOf(row))requireAccess(actor,branch);
}
function project(row:IntentRow) {
  return {id:row.id,type:row.type,branchId:row.branch_id,causalId:row.causal_id,recipientRole:row.recipient_role,state:row.state,mode:row.mode,data:row.data,createdAt:new Date(row.created_at).toISOString(),reportPath:`/?notification=${encodeURIComponent(row.id)}`};
}
export function registerNotifications(app:FastifyInstance,pool:Pool,config=whatsappConfig(),transport?:SendTransport,schedulerEnabled=true) {
  let running:Promise<void>|null=null;let closing=false;let schedulerError=false;let lastEvaluationAt:string|null=null;
  const tick=()=>{
    if(running||closing||!schedulerEnabled)return;
    running=(async()=>{try{await runDailyLowStock(pool,new Date(),config);lastEvaluationAt=new Date().toISOString();schedulerError=false;for(let n=0;n<10&&!closing&&await dispatchNotification(pool,config,transport);n++){} }catch{schedulerError=true;}finally{running=null;}})();
  };
  app.addHook('onReady',async()=>{void tick();});
  app.addHook('onResponse',async(req,reply)=>{
    if(req.url.split('?')[0]!=='/api/pos/sync'||reply.statusCode!==200)return;
    const payload=(req.body as {payload?:unknown}|null)?.payload;
    if(typeof payload==='string')try{if(JSON.parse(payload)?.kind==='shift.close')tick();}catch{/* Invalid sync payloads cannot create an intent. */}
  });
  const scheduler=setInterval(()=>void tick(),60_000);scheduler.unref();
  app.addHook('onClose',async()=>{closing=true;clearInterval(scheduler);await running;});
  registerWhatsAppWebhook(app,pool,config);
  app.get('/api/notifications/config',async req=>{
    const actor=await authenticate(pool,req);requireAdmin(actor);
    return {enabled:config.enabled&&config.ready,ready:config.ready,missing:config.missing,recipient:config.ownerPhone?`••••${config.ownerPhone.slice(-4)}`:null,recipientRole:'owner',sender:'WhatsApp Business del negocio',stockTime:'08:00 America/Bogota',closeRule:'Cada cierre confirmado y sincronizado; consolidado de ambas sucursales',schedulerError,lastEvaluationAt};
  });
  app.get('/api/notifications',async req=>{
    const actor=await authenticate(pool,req);requireAdmin(actor);const q=req.query as {branchId?:string;state?:string;after?:string;limit?:string};
    const limit=Number(q.limit??50);
    if(!id(q.branchId)||q.state&&!isNotificationState(q.state)||q.after!==undefined&&!id(q.after)||q.limit!==undefined&&typeof q.limit!=='string'||!Number.isInteger(limit)||limit<1||limit>100)throw new ApiError(400,'invalid_query','Revisa sucursal, estado y paginación.');
    if(!actor.user.branch_ids.includes(q.branchId))throw new ApiError(403,'forbidden','No tienes permiso para esta sucursal.');
    requireAccess(actor,q.branchId);
    const rows=(await pool.query<IntentRow>(`SELECT * FROM notification_intents WHERE (branch_id=$1 OR data->'branchIds' ? $1) AND ($2::text IS NULL OR state=$2) AND id>$3 AND (coalesce(data->>'version','')<>'2' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(data->'branchIds') AS b(id) WHERE NOT (b.id=ANY($5::text[])))) ORDER BY id LIMIT $4`,[q.branchId,q.state??null,q.after??'',limit+1,actor.user.branch_ids])).rows;
    const items=rows.slice(0,limit).map(project);return {items,nextCursor:rows.length>limit?items.at(-1)?.id??null:null};
  });
  const load=async(req:FastifyRequest)=>{
    const actor=await authenticate(pool,req);requireAdmin(actor);const intentId=(req.params as {id:string}).id;
    if(!id(intentId))throw new ApiError(400,'invalid_input','Identificador no válido.');
    const row=(await pool.query<IntentRow>('SELECT * FROM notification_intents WHERE id=$1',[intentId])).rows[0];
    if(!row)throw new ApiError(404,'not_found','No se encontró el reporte.');checkScope(actor,row);return row;
  };
  app.get('/api/notifications/:id',async req=>{
    const row=await load(req);
    const events=(await pool.query(`SELECT status,safe_code AS "safeCode",received_at AS "receivedAt" FROM notification_delivery_events WHERE intent_id=$1 ORDER BY received_at,id`,[row.id])).rows;
    return {...project(row),text:row.data.version===2?reportText(row.data):'Registro histórico. No es elegible para envío real.',events};
  });
  app.get('/api/notifications/:id/export',async(req,reply)=>{
    const row=await load(req);if(row.data.version!==2)throw new ApiError(409,'legacy_report','El registro histórico no tiene el formato de informe actual.');
    return reply.header('Content-Disposition',`attachment; filename="nativos-whatsapp-${row.id}.xlsx"`).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(xlsx(reportSheets(row.data)));
  });
  app.post('/api/notifications/:id/simulate',async req=>transaction(pool,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(7301)');const actor=await authenticate(c,req);requireAdmin(actor);const intentId=(req.params as {id:string}).id;const body=req.body as {operationId:string;reason:string;outcome:string};
    if(!id(intentId)||!id(body?.operationId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500||!outcomes.has(body.outcome))throw new ApiError(400,'invalid_input','Revisa operación, resultado y motivo.');
    const row=(await c.query<IntentRow>('SELECT * FROM notification_intents WHERE id=$1',[intentId])).rows[0];if(!row)throw new ApiError(404,'not_found','No se encontró el reporte.');checkScope(actor,row);
    const fingerprint=createHash('sha256').update(JSON.stringify([intentId,body])).digest('hex');const old=(await c.query('SELECT * FROM notification_operations WHERE id=$1',[body.operationId])).rows[0];
    if(old){if(old.actor_id!==actor.user.id||old.fingerprint!==fingerprint)throw new ApiError(409,'operation_conflict','La operación pertenece a otra solicitud.');return old.response;}
    const state=body.outcome==='delivered'?'delivered':body.outcome==='retryable'?'failed_retryable':body.outcome==='terminal'?'failed_terminal':'uncertain';
    const response={id:intentId,state,simulated:true,deliveryState:row.state};
    await c.query('INSERT INTO notification_operations VALUES($1,$2,$3,$4)',[body.operationId,actor.user.id,fingerprint,JSON.stringify(response)]);
    await audit(c,actor,'notification.simulated',body.reason.trim(),response,row.branch_id,scopeOf(row));return response;
  }));
  app.post('/api/notifications/low-stock/run',async req=>transaction(pool,async c=>{
    await c.query('SELECT pg_advisory_xact_lock(7301)');const actor=await authenticate(c,req);requireAdmin(actor);const body=req.body as {operationId:string;branchId:string;reason:string};
    if(!id(body?.operationId)||!id(body.branchId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500)throw new ApiError(400,'invalid_input','Revisa operación, sucursal y motivo.');
    const branches=await reportBranches(c);if(!actor.user.branch_ids.includes(body.branchId)||!branches.every(b=>actor.user.branch_ids.includes(b.id)))throw new ApiError(403,'forbidden','El resumen requiere acceso a ambas sucursales.');
    const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');const old=(await c.query('SELECT * FROM notification_operations WHERE id=$1',[body.operationId])).rows[0];
    if(old){if(old.actor_id!==actor.user.id||old.fingerprint!==fingerprint)throw new ApiError(409,'operation_conflict','La operación pertenece a otra solicitud.');return old.response;}
    for(const branch of branches)requireAccess(actor,branch.id);
    const count=await queueLowStock(c,body.branchId,colombiaDate(),config,true);const response={branchId:body.branchId,date:colombiaDate(),lowStockRows:count};
    await c.query('INSERT INTO notification_operations VALUES($1,$2,$3,$4)',[body.operationId,actor.user.id,fingerprint,JSON.stringify(response)]);await audit(c,actor,'notification.low_stock_evaluated',body.reason.trim(),response,null,branches.map(b=>b.id));return response;
  }));
}
