import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { payloadHash } from '../../src/pos-crypto.ts';
import type { Signed, Snapshot, Authorization } from '../../src/pos-domain.ts';

test('AC-007-08 — recuperación de cola después del corte', {timeout:120_000}, async () => {
  const db=await startLocalPostgres(resolve('.local/caja-access-'+randomUUID()), {password:randomBytes(32).toString('hex')});
  const app=await createApp({pool:db.pool,origin:'http://127.0.0.1:4363'});
  const base={host:'127.0.0.1:4363','x-nativos-request':'1'};
  let cookie='';
  const request=(url:string,payload:object,token?:string)=>app.inject({method:'POST',url,payload,headers:{...base,cookie,...(token?{'x-pos-token':token}:{})}});
  type Client={installationId:string;deviceId:string;token:string;signed:Signed;snapshot:Snapshot;sequence:number;previous:string|null};
  const authorize=async (client:Pick<Client,'deviceId'|'token'>)=>{
    const r=await request('/api/pos/authorize',{deviceId:client.deviceId,previous:null},client.token);assert.equal(r.statusCode,200,r.body);return r.json();
  };
  const enroll=async (deviceId:string,installationId:string=randomUUID()):Promise<Client>=>{
    const r=await request('/api/pos/enroll',{deviceId,installationId});assert.equal(r.statusCode,200,r.body);
    return {...r.json(),...await authorize(r.json()),sequence:0,previous:null};
  };
  const envelope=(client:Client,event:object,version=1)=>{
    const payload=JSON.stringify({...event,occurredAtMs:Date.now()});const a=JSON.parse(client.signed.document) as Authorization;
    return {operation:{version:1,operationId:randomUUID(),deviceId:client.deviceId,branchId:a.grant.branchId,actorId:a.grant.actorId,sequence:client.sequence+1,previousOperationId:client.previous,payloadHash:payloadHash(payload),payloadVersion:version},payload,signed:client.signed};
  };
  try {
    await migrate(db.pool);
    const password=randomBytes(24).toString('base64url');
    const setup=await request('/api/setup',{name:'DueÃ±o pruebas',login:'access-owner',password});assert.equal(setup.statusCode,201,setup.body);cookie=`nativos_session=${setup.cookies[0]!.value}`;
      const client = await enroll('milan-caja');
      const archivedOpen = envelope(client, {kind:'shift.open', shiftId:randomUUID(), openingCash:'100'});
      const op = archivedOpen.operation;
      const fingerprint = payloadHash(JSON.stringify(op) + archivedOpen.payload + client.signed.document + client.signed.signature);
      const digest = (...parts: unknown[]) => payloadHash(JSON.stringify(parts));
      const manifest = [
        digest('id', op.operationId),
        digest('receipt',client.deviceId,client.installationId,op.operationId,fingerprint,0),
        digest('cursor',client.deviceId,client.installationId,op.sequence,op.operationId),
      ];
      const previous = process.env.NATIVOS_ARCHIVED_SYNC;
      process.env.NATIVOS_ARCHIVED_SYNC = manifest.join(' ');
      let restored;
      try { restored = await createApp({pool:db.pool,origin:'http://127.0.0.1:4363'}); }
      finally { if (previous === undefined) delete process.env.NATIVOS_ARCHIVED_SYNC; else process.env.NATIVOS_ARCHIVED_SYNC=previous; }
      const sync = (body:typeof archivedOpen, token=client.token) => restored.inject({method:'POST',url:'/api/pos/sync',
        headers:{...base,'x-pos-token':token},payload:body});
      try {
        const ack = await sync(archivedOpen);
        assert.equal(ack.statusCode,200,ack.body);
        assert.deepEqual(ack.json().receipt,op);
        assert.equal((await sync({...archivedOpen,signed:{...client.signed,signature:'different'}})).statusCode,409);
        assert.equal((await db.pool.query('SELECT 1 FROM pos_shifts WHERE device_id=$1',[client.deviceId])).rowCount,0);
        client.sequence=1;client.previous=op.operationId;
        const next=envelope(client,{kind:'shift.open',shiftId:randomUUID(),openingCash:'200'});
        const other=await enroll(client.deviceId);
        assert.equal((await sync(next,other.token)).json().code,'predecessor_required');
        assert.equal((await sync({...next,operation:{...next.operation,previousOperationId:randomUUID()}})).json().code,'predecessor_required');
        assert.equal((await sync({...next,signed:{...client.signed,signature:'invalid'}})).statusCode,403);
        assert.equal((await sync(next)).statusCode,200);
        assert.equal((await sync(next)).statusCode,200);
        assert.equal((await db.pool.query('SELECT 1 FROM pos_shifts WHERE device_id=$1',[client.deviceId])).rowCount,1);
        client.sequence++;client.previous=next.operation.operationId;
        const close=envelope(client,{kind:'shift.close',shiftId:JSON.parse(next.payload).shiftId,counted:'200'});
        assert.equal((await sync(close)).statusCode,200);
      } finally { await restored.close(); }
  } finally { await app.close(); await db.stop(); }
});
