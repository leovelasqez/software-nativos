import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('AC-018-08/10/11/12/14: login directo en navegador nuevo, perfiles por cuenta y recuperación offline', () => {
  const script = String.raw`
import {createRequire} from 'node:module';
import {generateKeyPairSync} from 'node:crypto';
import assert from 'node:assert/strict';
globalThis.require=createRequire(import.meta.url);
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{persist:async()=>true}}});
const {BrowserEngine,blankData}=await import('./web/offline/engine.ts');
const {signAuthorization}=await import('./src/pos-crypto.ts');
const {defaultActions}=await import('./src/permissions.ts');
const keys=generateKeyPairSync('ed25519');
const publicKey=keys.publicKey.export({type:'spki',format:'pem'}).toString();
const privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const users={
 owner:{id:'owner-id',login:'owner',role:'owner',branchIds:['centro','milan']},
 centro:{id:'centro-id',login:'centro',role:'cashier',branchIds:['centro']},
 milan:{id:'milan-id',login:'milan',role:'cashier',branchIds:['milan']},
};
const password='synthetic-password-only';
let proxyFailure=false;
let cookie=users.owner,offline=false,deny=false,hijack=false,legacySource=null,loseEnrollment=false,noDevices=false;
const requests=[];
globalThis.fetch=async(url,init)=>{
 if(offline)throw new Error('Synthetic network failure');
 const path=String(url).slice(4),body=init.body?JSON.parse(init.body):null;
 requests.push({path,body,token:init.headers['X-Pos-Token']});
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(path==='/login'){if(body.password!==password)return json({message:'Credenciales incorrectas'},401);cookie=users[body.login];return json({actorId:cookie.id});}
 if(path==='/me')return json({user:cookie,branches:cookie.branchIds.map(id=>({id,name:id}))});
 if(path==='/local-transition')return json(body?legacySource:{available:!!legacySource});
 if(path.startsWith('/branches/')){const branch=path.split('/').at(-1);assert.ok(cookie.branchIds.includes(branch));return json({devices:[{id:branch+'-caja',name:'Caja',active:!noDevices}]});}
 if(path==='/pos/enroll'){
  if(proxyFailure){proxyFailure=false;return new Response('<html>Unavailable</html>',{status:503});}
  assert.ok(cookie.branchIds.includes(body.deviceId.split('-')[0]));
  if(body.password){assert.equal(body.login,cookie.login);assert.equal(body.password,password);}
  if(loseEnrollment){loseEnrollment=false;throw new Error('Synthetic lost enrollment response');}
  return json({deviceId:body.deviceId,branchId:body.deviceId.split('-')[0],installationId:body.installationId,token:'token-'+body.deviceId,publicKey});
 }
 if(path==='/pos/sync'){
  if(init.headers['X-Pos-Token']!=='token-'+body.operation.deviceId)return json({code:'device_revoked',message:'Equipo no autorizado'},403);
  return json({kind:'accepted',receipt:body.operation});
 }
 if(path==='/pos/authorize'){
  if(deny)return json({code:'forbidden',message:'Destino no autorizado'},403);
  if(init.credentials==='omit'&&init.headers['X-Pos-Token']!=='token-'+body.deviceId)return json({code:'device_revoked',message:'El equipo no está autorizado. Se conservarán las operaciones pendientes.'},403);
  const user=hijack?users.owner:cookie,branch=body.deviceId.split('-')[0],now=Date.now()-1000;
  assert.ok(user.branchIds.includes(branch));assert.equal(init.headers['X-Pos-Installation']!==undefined,true);
  const actions=defaultActions(user.role);
  return json({signed:signAuthorization({actorName:user.login,
   principal:{version:1,actorId:user.id,kind:'human',role:user.role,active:true,branchIds:user.branchIds,actions},
   grant:{version:1,grantId:'grant-'+user.id+'-'+now,actorId:user.id,deviceId:body.deviceId,branchId:branch,validatedAtMs:now,expiresAtMs:now+7*86400000,actions}},privateKey),
   snapshot:{id:'snapshot-'+body.deviceId,createdAtMs:now,branchId:branch,deviceId:body.deviceId,warehouseId:branch+'-venta',serverSequence:0,serverOperationId:null,products:[],recipes:[],stock:[]},
   customers:[],loyalty:{rule:{id:'rule',earnEvery:'1000',pointValue:'10',maxPercent:'20',createdAtMs:now},members:[],asOfMs:now},openShift:null});
 }
 throw new Error('Unexpected request '+path);
};
const e=new BrowserEngine({},blankData());e.save=async()=>{};
const fresh=new BrowserEngine({},blankData());fresh.save=async()=>{};
await assert.rejects(fresh.login('centro','incorrect'),/Credenciales incorrectas/);
assert.equal(requests.filter(r=>r.path==='/pos/enroll').length,0);
cookie=users.centro;const cookieOnly=new BrowserEngine({},blankData());cookieOnly.save=async()=>{};await cookieOnly.session();assert.equal(cookieOnly.data.users.centro.passwordHash,'');assert.equal((await cookieOnly.state()).user.id,'centro-id');
assert.equal((await cookieOnly.state()).offlinePasswordReady,false);
await assert.rejects(cookieOnly.preparePassword('incorrect'),/Credenciales incorrectas/);
deny=true;
await assert.rejects(cookieOnly.preparePassword(password),/Destino no autorizado/);
assert.equal(cookieOnly.data.users.centro.passwordHash,'');
deny=false;hijack=true;
await assert.rejects(cookieOnly.preparePassword(password),/otro usuario/);
assert.equal(cookieOnly.data.users.centro.passwordHash,'');
hijack=false;await cookieOnly.preparePassword(password);
assert.equal((await cookieOnly.state()).offlinePasswordReady,true);
offline=true;cookieOnly.data.session=null;await cookieOnly.login('centro',password);
assert.equal((await cookieOnly.state()).user.id,'centro-id');offline=false;
noDevices=true;await assert.rejects(fresh.login('centro',password),/no tiene una caja activa/);noDevices=false;
loseEnrollment=true;await assert.rejects(fresh.login('centro',password),/Credenciales offline incorrectas/);
assert.equal(fresh.data.terminal,undefined);
const lostInstallation=requests.findLast(r=>r.path==='/pos/enroll').body.installationId;
assert.equal((await fresh.login('centro',password)).needsEnrollment,false);
assert.notEqual(fresh.data.installationId,lostInstallation);
assert.equal(fresh.data.terminal.deviceId,'centro-caja');
assert.equal((await fresh.state()).user.id,'centro-id');
const initialEnrollment=requests.findLast(r=>r.path==='/pos/enroll');
assert.equal(initialEnrollment.body.sourceDeviceId,undefined);assert.equal(initialEnrollment.token,undefined);
const another=new BrowserEngine({},blankData());another.save=async()=>{};
await another.login('centro',password);assert.notEqual(another.data.installationId,fresh.data.installationId);
// AC-018-15: an old browser keeps its installation, shift and exact pending envelope.
const savedInstallation=fresh.data.installationId,authorization=await fresh.auth();
const pending={operation:{version:1,operationId:'11111111-1111-4111-8111-111111111111',deviceId:'centro-caja',branchId:'centro',actorId:'centro-id',sequence:1,previousOperationId:null,payloadVersion:2,payloadHash:'a'.repeat(64)},payload:'{"kind":"order.save"}',signedId:authorization.grant.grantId,state:'reconciliation_required',error:'El equipo no está autorizado.',errorCode:'device_revoked'};
fresh.data.grants[pending.signedId]=fresh.data.users.centro.signed;
fresh.data.outbox.push(pending);fresh.data.sequence=1;fresh.data.previous='11111111-1111-4111-8111-111111111111';
fresh.data.shifts.push({id:'centro-shift',actorId:'centro-id',actorName:'centro',openingCash:'100',expected:'100',openedAtMs:Date.now(),closedAtMs:null,counted:null,difference:null});
fresh.data.users.centro.revoked=true; // Reactivating an installation can preserve its token.
const staleBefore=structuredClone(fresh.data),pendingEnvelope={operation:pending.operation,payload:pending.payload,signed:fresh.data.users.centro.signed};
await assert.rejects(fresh.login('centro','incorrect'),/Credenciales incorrectas/);assert.deepEqual(fresh.data,staleBefore);
await fresh.session();assert.equal(fresh.data.installationId,savedInstallation);assert.equal(fresh.data.outbox.length,0);
await fresh.login('centro',password);
assert.equal(fresh.data.installationId,savedInstallation);assert.equal(fresh.data.sequence,1);assert.equal(fresh.data.previous,'11111111-1111-4111-8111-111111111111');
assert.deepEqual(fresh.data.shifts,staleBefore.shifts);assert.equal(fresh.data.outbox.length,0,JSON.stringify(fresh.data.outbox));
assert.deepEqual(requests.findLast(r=>r.path==='/pos/sync').body,pendingEnvelope);
// A stale token mid-session must recover both a signed refresh and a queued request.
fresh.data.terminal.token='stale-token';await fresh.sync();
assert.equal((await fresh.auth()).grant.actorId,'centro-id');
const retryEntry=structuredClone(pending);retryEntry.state='retry';retryEntry.error=null;retryEntry.errorCode=null;
fresh.data.outbox.push(retryEntry);fresh.data.terminal.token='stale-again';
proxyFailure=true;await fresh.sync();
assert.equal(fresh.data.outbox[0].state,'retry');
assert.deepEqual(fresh.data.outbox[0].operation,pending.operation);
let firstWrite=true;
fresh.save=async()=>{if(firstWrite){firstWrite=false;throw new Error('Temporary storage failure');}};
await fresh.sync();assert.equal(fresh.data.outbox[0].state,'retry');
assert.deepEqual(fresh.data.outbox[0].operation,pending.operation);
fresh.data.terminal.token='stale-again';
const beforeRetry=requests.length;await fresh.sync();
assert.equal(fresh.data.outbox.length,0);
const attempts=requests.slice(beforeRetry).filter(r=>r.path==='/pos/sync');
assert.equal(attempts.length,2);assert.deepEqual(attempts[0].body,attempts[1].body);
assert.equal(fresh.data.users.centro.revoked,false);assert.ok(!JSON.stringify(fresh.data).includes(password));
assert.equal((await e.login('owner',password)).needsEnrollment,false);
await e.switchTerminal('milan-caja');
assert.equal(e.data.lastTerminals['owner-id'],'milan-caja');
// AC-012-05/AC-018-08: explicitly importing Milán must retain its open shift,
// even when the older aggregate has no per-account terminal preferences.
legacySource=structuredClone(e.data);delete legacySource.lastTerminals;legacySource.session=null;
legacySource.shifts.push({id:'legacy-milan-shift',actorId:'owner-id',actorName:'owner',openingCash:'25000',expected:'25000',openedAtMs:Date.now(),closedAtMs:null,counted:null,difference:null});
// Choosing a new box instead of importing must also recover a lost first response.
const legacyNew=new BrowserEngine({},blankData());legacyNew.save=async()=>{};
await legacyNew.login('owner',password);loseEnrollment=true;
await assert.rejects(legacyNew.enroll('centro-caja'),/Sin conexión/);
const lostLegacyInstallation=requests.findLast(r=>r.path==='/pos/enroll').body.installationId;
await legacyNew.enroll('centro-caja');assert.notEqual(legacyNew.data.installationId,lostLegacyInstallation);
const imported=new BrowserEngine({},blankData());imported.save=async()=>{};
await imported.login('owner',password);await imported.importLegacy(password);
assert.equal(imported.data.terminal.deviceId,'milan-caja');
assert.equal(imported.data.lastTerminals['owner-id'],'milan-caja');
assert.equal((await imported.state()).branchId,'milan');
assert.equal(imported.shift().id,'legacy-milan-shift');assert.equal(imported.shift().openingCash,'25000');
legacySource=null;
// A foreign queue awaiting reconciliation must remain intact, without being sent.
e.data.outbox.push({operation:{operationId:'pending-milan'},payload:'{}',signedId:'historic',state:'reconciliation_required',error:'Pendiente ajeno'});
e.data.orders['milan-order']={actorId:'owner-id',order:{id:'milan-order',closed:false}};
e.data.sequence=7;e.data.previous='last-milan';
const original=structuredClone(e.data),start=requests.length;
cookie=users.centro;
await e.login('centro',password);
assert.equal((await e.state()).branchId,'centro');assert.equal((await e.state()).user.id,'centro-id');
const {terminalProfiles:initialProfiles,...originalMilan}=original;
assert.deepEqual(e.data.terminalProfiles['milan-caja'],originalMilan);
assert.equal(requests.slice(start).filter(r=>r.path==='/pos/sync').length,0);
assert.equal(e.data.lastTerminals['owner-id'],'milan-caja');
assert.equal(e.data.lastTerminals['centro-id'],'centro-caja');
await assert.rejects(e.auth('sale.refund'),/No tienes permiso/);
await e.login('owner',password);
assert.equal(e.data.terminal.deviceId,'milan-caja');assert.equal(e.data.sequence,7);
assert.deepEqual(e.data.outbox,original.outbox);assert.deepEqual(e.data.orders,original.orders);
await assert.rejects(e.switchTerminal('centro-caja'),/pendientes/);
// Resolve only this synthetic fixture so manual switching can be exercised.
e.data.outbox=[];e.data.orders={};e.data.sequence=0;e.data.previous=null;
await e.switchTerminal('centro-caja');assert.equal(e.data.lastTerminals['owner-id'],'centro-caja');
await e.login('milan',password);assert.equal((await e.state()).branchId,'milan');
await e.login('owner',password);assert.equal((await e.state()).branchId,'centro');
await e.login('milan',password);
const foreignBefore=structuredClone(e.data);
offline=true;await e.login('centro',password);
assert.equal((await e.state()).branchId,'centro');assert.equal((await e.state()).user.id,'centro-id');
const {terminalProfiles:ignored,...foreignProfile}=foreignBefore;
assert.deepEqual(e.data.terminalProfiles['milan-caja'],foreignProfile);
const wrongBefore=structuredClone(e.data);
await assert.rejects(e.login('centro','incorrect'),/Credenciales offline incorrectas/);
assert.equal(e.data.terminal.deviceId,wrongBefore.terminal.deviceId);
assert.deepEqual(e.data.terminalProfiles,wrongBefore.terminalProfiles);
offline=false;await e.login('milan',password);
const savedVerifier=e.data.terminalProfiles['centro-caja'].users.centro.passwordHash;
cookie=users.centro;await e.session();
assert.equal(e.data.terminal.deviceId,'centro-caja');assert.equal(e.data.users.centro.passwordHash,savedVerifier);
await e.login('milan',password);
const rejectedBefore=JSON.stringify(e.data);deny=true;
await assert.rejects(e.login('centro',password),/Destino no autorizado/);
assert.equal(JSON.stringify(e.data),rejectedBefore);deny=false;
hijack=true;await assert.rejects(e.login('centro',password),/otro usuario/);
assert.equal(JSON.stringify(e.data),rejectedBefore);hijack=false;
// Remembered device IDs never confer permission to that branch.
e.data.lastTerminals['centro-id']='milan-caja';await e.login('centro',password);
assert.equal(e.data.terminal.deviceId,'centro-caja');
e.data.users.centro.revoked=true;offline=true;
await assert.rejects(e.login('centro',password),/Credenciales offline incorrectas/);
console.log('verified');
`;
  const result = spawnSync(process.execPath, ['--experimental-transform-types', '--input-type=module'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), input: script, encoding: 'utf8', timeout: 60_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'verified');
});
