import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('AC-018-08/10/11: login por cuenta conserva perfiles ajenos y recupera su caja offline', () => {
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
let cookie=users.owner,offline=false,deny=false,hijack=false,legacySource=null;
const requests=[];
globalThis.fetch=async(url,init)=>{
 if(offline)throw new Error('Synthetic network failure');
 const path=String(url).slice(4),body=init.body?JSON.parse(init.body):null;
 requests.push({path,body,token:init.headers['X-Pos-Token']});
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(path==='/login'){assert.equal(body.password,password);cookie=users[body.login];return json({actorId:cookie.id});}
 if(path==='/me')return json({user:cookie,branches:cookie.branchIds.map(id=>({id,name:id}))});
 if(path==='/local-transition')return json(legacySource);
 if(path.startsWith('/branches/')){const branch=path.split('/').at(-1);assert.ok(cookie.branchIds.includes(branch));return json({devices:[{id:branch+'-caja',name:'Caja',active:true}]});}
 if(path==='/pos/enroll'){
  if(cookie.role!=='owner'){assert.equal(body.sourceDeviceId,'milan-caja');assert.equal(init.headers['X-Pos-Token'],'token-milan-caja');}
  return json({deviceId:body.deviceId,branchId:body.deviceId.split('-')[0],installationId:body.installationId,token:'token-'+body.deviceId,publicKey});
 }
 if(path==='/pos/authorize'){
  if(deny)return json({code:'forbidden',message:'Destino no autorizado'},403);
  const user=hijack?users.owner:cookie,branch=body.deviceId.split('-')[0],now=Date.now()-1000;
  assert.ok(user.branchIds.includes(branch));assert.equal(init.headers['X-Pos-Token'],'token-'+body.deviceId);
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
await assert.rejects(fresh.login('centro',password),/dueño debe activar/);
await e.login('owner',password);await e.enroll('milan-caja');
assert.equal(e.data.lastTerminals['owner-id'],'milan-caja');
// AC-012-05/AC-018-08: explicitly importing Milán must retain its open shift,
// even when the older aggregate has no per-account terminal preferences.
legacySource=structuredClone(e.data);delete legacySource.lastTerminals;legacySource.session=null;
legacySource.shifts.push({id:'legacy-milan-shift',actorId:'owner-id',actorName:'owner',openingCash:'25000',expected:'25000',openedAtMs:Date.now(),closedAtMs:null,counted:null,difference:null});
const imported=new BrowserEngine({},blankData());imported.save=async()=>{};
await imported.login('owner',password);await imported.importLegacy(password);
assert.equal(imported.data.terminal.deviceId,'milan-caja');
assert.equal(imported.data.lastTerminals['owner-id'],'milan-caja');
assert.equal((await imported.state()).branchId,'milan');
assert.equal(imported.shift().id,'legacy-milan-shift');assert.equal(imported.shift().openingCash,'25000');
// A foreign queue awaiting reconciliation must remain intact, without being sent.
e.data.outbox.push({operation:{operationId:'pending-milan'},payload:'{}',signedId:'historic',state:'reconciliation_required',error:'Pendiente ajeno'});
e.data.orders['milan-order']={actorId:'owner-id',order:{id:'milan-order',closed:false}};
e.data.sequence=7;e.data.previous='last-milan';
const original=structuredClone(e.data),start=requests.length;
cookie=users.centro;await assert.rejects(e.session(),/Ingresa tu contraseña/);
assert.deepEqual(e.data,original);
await e.login('centro',password);
assert.equal((await e.state()).branchId,'centro');assert.equal((await e.state()).user.id,'centro-id');
assert.deepEqual(e.data.terminalProfiles['milan-caja'],original);
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
