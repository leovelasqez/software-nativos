import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { NotificationReport } from '../notification-report.ts';
import { transaction } from './db.ts';
import { ApiError, matchesSetupToken } from './security.ts';
import { deliveryConfigHash, sendWhatsApp, validWebhookSignature } from './whatsapp.ts';
import type { SendTransport, WhatsAppConfig } from './whatsapp.ts';
import { transitionDelivery } from '../notification-state.ts';
import type { DeliveryEvent, NotificationState } from '../notification-state.ts';
async function event(c:PoolClient,intentId:string,deliveryId:string,status:string,messageId:string|null,code:string|null,id:string=randomUUID()) {
  await c.query(`INSERT INTO notification_delivery_events(id,intent_id,delivery_id,provider_message_id,status,safe_code) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[id,intentId,deliveryId,messageId,status,code]);
}
export async function dispatchNotification(pool:Pool,config:WhatsAppConfig,transport:SendTransport=sendWhatsApp) {
  if(!config.enabled||!config.ready)return false;
  const claimed=await transaction(pool,async c=>{
    // A process may die after sending but before receiving the acknowledgement.
    const abandoned=(await c.query(`UPDATE notification_intents SET state='uncertain' WHERE mode='live' AND state='sending' AND claimed_at<now()-interval '2 minutes' RETURNING id,delivery_id`)).rows;
    for(const row of abandoned)await event(c,row.id,row.delivery_id,'uncertain',null,'interrupted_request');
    const row=(await c.query(`SELECT * FROM notification_intents WHERE mode='live' AND state IN ('pending','failed_retryable') AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`)).rows[0];
    if(!row)return null;
    const owner=(await c.query(`SELECT role,active,kind,branch_ids,actions FROM app_users WHERE id=$1`,[config.ownerUserId])).rows[0];
    const report=row.data as NotificationReport;
    const authorized=owner?.active&&owner.kind==='human'&&owner.role==='owner'&&owner.actions.includes('settings.manage')&&owner.actions.includes('data.read')&&report.version===2&&report.branchIds.every(id=>owner.branch_ids.includes(id))&&row.recipient_role==='owner'&&row.delivery_config_hash===deliveryConfigHash(config);
    const deliveryId=randomUUID();
    if(!authorized){await c.query(`UPDATE notification_intents SET state='failed_terminal' WHERE id=$1`,[row.id]);await event(c,row.id,deliveryId,'failed_terminal',null,'configuration_or_access_changed');return null;}
    await c.query(`UPDATE notification_intents SET state='sending',delivery_id=$2,claimed_at=now(),attempt_count=attempt_count+1,next_attempt_at=NULL WHERE id=$1`,[row.id,deliveryId]);
    await event(c,row.id,deliveryId,'sending',null,null);
    return {id:row.id,report,deliveryId,attempt:Number(row.attempt_count)+1,startedAt:new Date()};
  });
  if(!claimed)return false;
  // No database lock or commercial transaction is held across this request.
  let result;
  try{result=await transport(config,claimed.report,claimed.id,claimed.deliveryId);}catch{result={outcome:'uncertain' as const,messageId:null,safeCode:'transport_uncertain'};}
  await transaction(pool,async c=>{
    const row=(await c.query<{state:NotificationState;provider_message_id:string|null}>('SELECT state,provider_message_id FROM notification_intents WHERE id=$1 AND delivery_id=$2 FOR UPDATE',[claimed.id,claimed.deliveryId])).rows[0];
    if(!row)return;
    const outcome=result.outcome==='retryable'&&claimed.attempt>=3?'terminal':result.outcome;
    await c.query(`INSERT INTO notification_attempts(id,intent_id,outcome,provider_message_id,safe_error,started_at,finished_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(id) DO NOTHING`,[claimed.deliveryId,claimed.id,outcome,result.messageId,result.safeCode,claimed.startedAt]);
    const incoming=outcome==='accepted'?'accepted':outcome==='retryable'?'failed_retryable':outcome==='terminal'?'failed_terminal':'uncertain';
    const state=transitionDelivery(row.state,{kind:'transport',state:incoming});
    await c.query(`UPDATE notification_intents SET state=$2,provider_message_id=coalesce(provider_message_id,$3),next_attempt_at=CASE WHEN $2='failed_retryable' THEN now()+($4::integer*interval '1 minute') ELSE NULL END WHERE id=$1`,[claimed.id,state,result.messageId,claimed.attempt*2]);
    await event(c,claimed.id,claimed.deliveryId,state,result.messageId,result.safeCode);
  });
  return true;
}
export function registerWhatsAppWebhook(app:FastifyInstance,pool:Pool,config:WhatsAppConfig) {
  app.get('/api/whatsapp/webhook',async(req,reply)=>{
    const q=req.query as Record<string,unknown>;
    if(q['hub.mode']!=='subscribe'||typeof q['hub.verify_token']!=='string'||typeof q['hub.challenge']!=='string'||q['hub.challenge'].length>512||!config.verifyToken||!matchesSetupToken(config.verifyToken,q['hub.verify_token']))throw new ApiError(403,'invalid_webhook','Verificación no válida.');
    return reply.type('text/plain').send(q['hub.challenge']);
  });
  app.register(async scope=>{
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json',{parseAs:'buffer'},(_req,body,done)=>done(null,body));
    scope.post('/api/whatsapp/webhook',async req=>{
      const body=req.body as Buffer;
      if(!Buffer.isBuffer(body)||!validWebhookSignature(body,req.headers['x-hub-signature-256'],config.appSecret))throw new ApiError(403,'invalid_webhook','Firma no válida.');
      let data;
      try{data=JSON.parse(body.toString('utf8'));}catch{throw new ApiError(400,'invalid_webhook','Formato no válido.');}
      if(data?.object!=='whatsapp_business_account'||!Array.isArray(data.entry))return {received:true};
      await transaction(pool,async c=>{
        for(const entry of data.entry) for(const change of Array.isArray(entry?.changes)?entry.changes:[]) {
          const value=change?.value;
          if(value?.metadata?.phone_number_id!==config.phoneNumberId||!Array.isArray(value?.statuses))continue;
          for(const status of value.statuses) {
            if(!['sent','delivered','read','failed'].includes(status?.status)||typeof status.id!=='string'||status.id.length>256||typeof status.timestamp!=='string'||!/^\d{1,16}$/.test(status.timestamp))continue;
            const callback=typeof status.biz_opaque_callback_data==='string'&&/^[0-9a-f-]{36}$/.test(status.biz_opaque_callback_data)?status.biz_opaque_callback_data:null;
            const row=(await c.query<{id:string;delivery_id:string|null;state:NotificationState;provider_message_id:string|null}>(`SELECT id,delivery_id,state,provider_message_id FROM notification_intents WHERE mode='live' AND (provider_message_id=$1 OR ($2::text IS NOT NULL AND delivery_id=$2)) LIMIT 1 FOR UPDATE`,[status.id,callback])).rows[0];
            if(!row||!row.delivery_id||row.provider_message_id&&row.provider_message_id!==status.id)continue;
            const id=createHash('sha256').update(JSON.stringify([status.id,status.status,status.timestamp])).digest('hex');
            const exists=await c.query('SELECT 1 FROM notification_delivery_events WHERE id=$1',[id]); if(exists.rowCount)continue;
            const code=Number.isSafeInteger(status.errors?.[0]?.code)?`provider_${status.errors[0].code}`:null;
            await event(c,row.id,row.delivery_id,status.status,status.id,code,id);
            const incoming:Extract<DeliveryEvent,{kind:'webhook'}>['state']=status.status==='failed'?'failed_terminal':status.status;
            const state=transitionDelivery(row.state,{kind:'webhook',state:incoming});
            await c.query('UPDATE notification_intents SET state=$2,provider_message_id=$3,next_attempt_at=NULL WHERE id=$1',[row.id,state,status.id]);
          }
        }
      });
      return {received:true};
    });
  });
}
