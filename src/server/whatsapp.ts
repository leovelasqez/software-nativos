import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { templateSummary } from '../notification-report.ts';
import type { NotificationReport } from '../notification-report.ts';

export type WhatsAppConfig = {
  enabled:boolean; ready:boolean; missing:string[]; graphVersion:string; phoneNumberId:string; accessToken:string;
  ownerPhone:string; ownerUserId:string; appSecret:string; verifyToken:string; closeTemplate:string; stockTemplate:string; language:string;
};
export function whatsappConfig(env:NodeJS.ProcessEnv=process.env):WhatsAppConfig {
  const fields={graphVersion:'GRAPH_VERSION',phoneNumberId:'PHONE_NUMBER_ID',accessToken:'ACCESS_TOKEN',ownerPhone:'OWNER_PHONE',ownerUserId:'OWNER_USER_ID',appSecret:'APP_SECRET',verifyToken:'VERIFY_TOKEN',closeTemplate:'CLOSE_TEMPLATE',stockTemplate:'STOCK_TEMPLATE',language:'LANGUAGE'};
  const values=Object.fromEntries(Object.entries(fields).map(([key,name])=>[key,env[`NATIVOS_WHATSAPP_${name}`]?.trim()??''])) as Omit<WhatsAppConfig,'enabled'|'ready'|'missing'>;
  const checks:Record<string,RegExp>={graphVersion:/^v\d{1,3}\.0$/,phoneNumberId:/^\d{5,30}$/,ownerPhone:/^[1-9]\d{7,14}$/,ownerUserId:/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/,closeTemplate:/^[a-z0-9_]{1,512}$/,stockTemplate:/^[a-z0-9_]{1,512}$/,language:/^[a-z]{2}(?:_[A-Z]{2})?$/};
  const missing=Object.entries(fields).filter(([key])=>!values[key as keyof typeof values] || (checks[key]&&!checks[key]!.test(values[key as keyof typeof values]))).map(([,name])=>`NATIVOS_WHATSAPP_${name}`);
  return {...values,enabled:env.NATIVOS_WHATSAPP_ENABLED==='true',ready:missing.length===0,missing};
}
export function deliveryConfigHash(config:WhatsAppConfig) {
  return createHash('sha256').update(JSON.stringify([config.ownerUserId,config.ownerPhone,config.phoneNumberId,config.closeTemplate,config.stockTemplate,config.language,config.graphVersion])).digest('hex');
}
export function validWebhookSignature(body:Buffer,signature:unknown,secret:string) {
  if(!secret||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  return timingSafeEqual(Buffer.from(signature.slice(7),'hex'),createHmac('sha256',secret).update(body).digest());
}
export type SendResult={outcome:'accepted'|'retryable'|'terminal'|'uncertain';messageId:string|null;safeCode:string|null};
export type SendTransport=(config:WhatsAppConfig,report:NotificationReport,intentId:string,deliveryId:string)=>Promise<SendResult>;
export const sendWhatsApp:SendTransport=async(config,report,intentId,deliveryId)=>{
  if(!config.enabled||!config.ready)return {outcome:'terminal',messageId:null,safeCode:'adapter_disabled'};
  try {
    const response=await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,{
      method:'POST',headers:{Authorization:`Bearer ${config.accessToken}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15_000),redirect:'error',
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:config.ownerPhone,type:'template',biz_opaque_callback_data:deliveryId,template:{name:report.kind==='shift_closed'?config.closeTemplate:config.stockTemplate,language:{code:config.language},components:[{type:'body',parameters:[{type:'text',text:templateSummary(report)}]},{type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:intentId}]}]}})
    });
    // Never persist or log provider error messages; they may echo request values.
    if(response.status>=500)return {outcome:'uncertain',messageId:null,safeCode:'provider_5xx'};
    const data=await response.json() as {messages?:{id?:unknown}[];error?:{code?:unknown}};
    if(response.ok) {
      const messageId=data.messages?.[0]?.id;
      return typeof messageId==='string'&&messageId.length>0&&messageId.length<=256?{outcome:'accepted',messageId,safeCode:null}:{outcome:'uncertain',messageId:null,safeCode:'missing_message_id'};
    }
    const code=Number.isSafeInteger(data.error?.code)?String(data.error!.code):String(response.status);
    const retryable=response.status===429 || ['130429','131048','131056'].includes(code);
    return {outcome:retryable?'retryable':'terminal',messageId:null,safeCode:`provider_${code}`};
  }catch{return {outcome:'uncertain',messageId:null,safeCode:'transport_uncertain'};}
};
