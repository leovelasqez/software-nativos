import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { tokenHash } from '../../src/server/security.ts';
import { payloadHash } from '../../src/pos-crypto.ts';
import { upgradeOrder } from '../../src/orders-domain.ts';
import type { Signed, Snapshot, Authorization } from '../../src/pos-domain.ts';

test('AC-018-01/02/04 — migración, navegadores independientes, permisos y turnos', {timeout:180_000}, async t => {
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
  const send=async (client:Client,event:object,version=1)=>{
    const body=envelope(client,event,version);const r=await request('/api/pos/sync',body,client.token);
    if(r.statusCode===200){client.sequence++;client.previous=body.operation.operationId;}return {r,body};
  };
  try{
    // Install the historical schema and register its checksums, as a real upgrade.
    await db.pool.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')&&n<'021').sort()){
      const sql=(await readFile('migrations/'+name,'utf8')).replaceAll('\r\n','\n');await db.pool.query(sql);
      await db.pool.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);
    }
    const password=randomBytes(24).toString('base64url');
    const setup=await request('/api/setup',{name:'Dueño pruebas',login:'access-owner',password});assert.equal(setup.statusCode,201,setup.body);cookie=`nativos_session=${setup.cookies[0]!.value}`;
    const actor=(await db.pool.query("SELECT id FROM app_users WHERE login='access-owner'")).rows[0].id;
    const legacyToken=randomBytes(32).toString('base64url'),legacyInstallation=randomUUID(),legacyOperation=randomUUID(),legacyShift=randomUUID();
    await db.pool.query('INSERT INTO pos_terminals(device_id,installation_id,token_hash,last_sequence,last_operation_id) VALUES($1,$2,$3,1,$4)',['centro-caja',legacyInstallation,tokenHash(legacyToken),legacyOperation]);
    await db.pool.query('INSERT INTO pos_receipts(operation_id,device_id,sequence,fingerprint,response) VALUES($1,$2,1,$3,$4)',[legacyOperation,'centro-caja','legacy-fingerprint',JSON.stringify({legacy:true})]);
    await db.pool.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at) VALUES($1,$2,$3,$4,12000,now())',[legacyShift,'centro-caja','centro',actor]);
    await migrate(db.pool);await migrate(db.pool);
    const oldReceipt=(await db.pool.query('SELECT * FROM pos_receipts WHERE operation_id=$1',[legacyOperation])).rows[0];
    assert.equal(oldReceipt.installation_id,legacyInstallation);assert.deepEqual(oldReceipt.response,{legacy:true});assert.equal(oldReceipt.fingerprint,'legacy-fingerprint');
    assert.equal((await db.pool.query('SELECT installation_id FROM pos_shifts WHERE id=$1',[legacyShift])).rows[0].installation_id,legacyInstallation);
    await assert.rejects(db.pool.query('UPDATE pos_receipts SET fingerprint=$1 WHERE operation_id=$2',['tamper',legacyOperation]));
    const old:Client={deviceId:'centro-caja',installationId:legacyInstallation,token:legacyToken,...await authorize({deviceId:'centro-caja',token:legacyToken}),sequence:1,previous:legacyOperation};
    assert.equal(old.snapshot.serverSequence,1);assert.equal(old.snapshot.serverOperationId,legacyOperation);
    const first=await enroll('centro-caja');const second=await enroll('centro-caja');const milan=await enroll('milan-caja',first.installationId);
    await t.test('Ambas cajas, tokens conservados y secuencia 1 independiente',async()=>{
      for(const client of [first,second,milan]){
        const order=upgradeOrder({id:randomUUID(),revision:0,snapshotId:client.snapshot.id,lines:[]});
        const {r,body}=await send(client,{kind:'order.save',order,shiftId:null},2);assert.equal(r.statusCode,200,r.body);
        assert.equal((await request('/api/pos/sync',body,client.token)).statusCode,200);
        if(client===first)assert.equal((await request('/api/pos/sync',body,second.token)).statusCode,403);
      }
      assert.equal((await authorize(old)).snapshot.serverSequence,1);
      assert.equal((await authorize(first)).snapshot.serverSequence,1);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_receipts')).rows[0].count,'4');
    });
    await t.test('Turno anterior sigue abierto; otra instalación no lo cierra ni duplica',async()=>{
      assert.equal((await authorize(first)).openShift.id,legacyShift);
      assert.equal((await send(first,{kind:'shift.open',shiftId:randomUUID(),openingCash:'0'})).r.json().code,'shift_conflict');
      assert.equal((await send(first,{kind:'shift.close',shiftId:legacyShift,counted:'12000'})).r.statusCode,409);
      assert.equal((await send(old,{kind:'shift.close',shiftId:legacyShift,counted:'12000'})).r.statusCode,200);
      assert.equal((await authorize(first)).openShift,null);
      const opened=await send(first,{kind:'shift.open',shiftId:randomUUID(),openingCash:'500'});assert.equal(opened.r.statusCode,200,opened.r.body);
      assert.equal((await authorize(second)).snapshot.serverSequence,1);
      assert.equal((await send(milan,{kind:'shift.open',shiftId:randomUUID(),openingCash:'700'})).r.statusCode,200);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_shifts WHERE closed_at IS NULL')).rows[0].count,'2');
    });
    await t.test('Activar otro navegador requiere dueño; sucursal y equipo conservan permisos',async()=>{
      const user=await request('/api/users',{name:'Cajero prueba',login:'access-cashier',password,role:'cashier',branchIds:['centro'],reason:'Prueba de acceso'});assert.equal(user.statusCode,201,user.body);
      const login=await request('/api/login',{login:'access-cashier',password});cookie=`nativos_session=${login.cookies[0]!.value}`;
      assert.equal((await request('/api/pos/enroll',{deviceId:'centro-caja',installationId:randomUUID()})).statusCode,403);
      assert.equal((await request('/api/pos/authorize',{deviceId:'milan-caja',previous:null},milan.token)).statusCode,403);
      assert.equal((await request('/api/pos/authorize',{deviceId:'centro-caja',previous:null},'x'.repeat(43))).statusCode,403);
    });
  }finally{await app.close();await db.stop();}
});
