import {createConnection} from 'node:net';
import {audit,transaction} from './db.ts';
// Development-only bridge. Never enabled in the hosted application.
import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {authenticate,requireAdmin,requireAccess,ApiError} from './security.ts';
import {PosEngine} from '../pos/engine.ts';
import type {BrowserData} from '../../web/offline/engine.ts';
import {legacySale} from '../orders-domain.ts';
export function registerLocalTransition(app:FastifyInstance,pool:Pool,directory:string,origin:string,legacyPort?:number){
 let queue:Promise<unknown>=Promise.resolve();
 const serial=<T>(fn:()=>Promise<T>)=>{const r=queue.then(fn,fn);queue=r.catch(()=>{});return r;};
 app.get('/api/local-transition',async req=>{const actor=await authenticate(pool,req);requireAdmin(actor);return {available:existsSync(join(directory,'pos.sqlite'))};});
 app.post('/api/local-transition',{schema:{body:{type:'object',additionalProperties:false,required:['targetId'],properties:{targetId:{type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}}}}},req=>serial(async()=>{
  const actor=await authenticate(pool,req);requireAdmin(actor);if(!existsSync(join(directory,'pos.sqlite')))throw new ApiError(404,'not_found','No hay una caja anterior para trasladar.');
  if(legacyPort)await new Promise<void>((resolve,reject)=>{const socket=createConnection({host:'127.0.0.1',port:legacyPort});socket.setTimeout(1000);socket.once('connect',()=>{socket.destroy();reject(new ApiError(409,'legacy_running','Cierra el servicio de Caja anterior antes de trasladar sus datos.'));});socket.once('error',()=>resolve());socket.once('timeout',()=>{socket.destroy();reject(new ApiError(409,'legacy_running','No se pudo comprobar el cierre de la caja anterior.'));});});
  const engine=await PosEngine.open(directory,origin);try{const t=engine.vault.data.terminal;if(!t)throw new ApiError(409,'not_enrolled','La caja anterior no está vinculada.');requireAccess(actor,t.branchId);
   const target=(req.body as {targetId:string}).targetId;const previous=engine.store.meta<string>('browserTransferTarget');if(previous&&previous!==target)throw new ApiError(409,'already_transferred','La caja ya fue trasladada a otro navegador. Conserva ese perfil y sus pendientes.');
   const rows=(table:string)=>engine.store.db.prepare('SELECT * FROM '+table).all();const snapshots=engine.orders.snapshots();const users=Object.fromEntries(Object.entries(engine.vault.data.users).map(([login,u])=>[login,{...u,passwordHash:''}]));
   const data:BrowserData={version:1,installationId:t.installationId,sequence:engine.store.meta<number>('sequence')??0,previous:engine.store.meta<string>('previous'),lastSyncAtMs:engine.store.meta<number>('lastSyncAtMs'),high:engine.vault.data.lastObservedAtMs,terminal:t,users,grants:engine.vault.data.grants,session:null,snapshots,snapshotId:engine.store.snapshot()?.id??null,customers:engine.orders.customers(),loyalty:engine.loyalty.cache(),orders:Object.fromEntries(rows('orders_v2').map(r=>[String(r.id),{actorId:String(r.actor_id),order:JSON.parse(String(r.data))}])),selected:{},shifts:rows('shifts').map(r=>JSON.parse(String(r.data))),sales:[...rows('sales'),...rows('sales_v2')].map(r=>legacySale(JSON.parse(String(r.data)),snapshots)),refunds:engine.orders.refunds(),events:rows('order_events_v2').map(r=>({...JSON.parse(String(r.data)),actorId:String(r.actor_id)})),stock:rows('stock_entries').map(r=>({sequence:Number(r.sequence),itemId:String(r.item_id),quantity:String(r.delta)})),outbox:engine.store.pending(),commands:Object.fromEntries(rows('commands').map(r=>[String(r.id),{fingerprint:String(r.fingerprint),response:JSON.parse(String(r.response))}])),staged:null,failures:{}};
   const stage=engine.loyalty.pending();if(stage){const {payloadHash}=await import('../pos-crypto.ts');data.staged={entry:{operation:stage.operation,payload:stage.payload,signedId:stage.auth.grant.grantId,state:'pending',error:null},result:stage.result,actorId:stage.auth.grant.actorId,fingerprint:payloadHash(JSON.stringify({actor:stage.auth.grant.actorId,intent:stage.intent}))};}
   engine.store.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run('browserTransferTarget',JSON.stringify(target));await transaction(pool,c=>audit(c,actor,'pos.browser-transfer','Traslado de caja al navegador',{installationId:t.installationId,targetId:target},t.branchId));return data;
  }finally{engine.close();}
 }));
}
