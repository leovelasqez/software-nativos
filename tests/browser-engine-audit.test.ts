import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The real browser engine needs transformed TS constructor properties. Only
// transport and IndexedDB writes are substituted; signatures and commands run.
test('AC-019-03/08: motor real conserva caja ante doble corrección y cambio de responsable', () => {
  const script = String.raw`
import { createRequire } from 'node:module';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
globalThis.require = createRequire(import.meta.url);
const { BrowserEngine, blankData } = await import('./web/offline/engine.ts');
const { signAuthorization } = await import('./src/pos-crypto.ts');
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type:'spki', format:'pem' }).toString();
const privateKey = pair.privateKey.export({ type:'pkcs8', format:'pem' }).toString();
const now = Date.now()-1000;
const actions = ['data.read','order.write','sale.discount','sale.cancel','sale.charge','shift.open','shift.close','cash.movement'];
const signedFor = actor => signAuthorization({actorName:actor,
  principal:{version:1,actorId:actor,kind:'human',role:'cashier',active:true,branchIds:['centro'],actions},
  grant:{version:1,grantId:'grant-'+actor,actorId:actor,deviceId:'centro-caja',branchId:'centro',validatedAtMs:now,expiresAtMs:now+7*86400000,actions}},privateKey);
const central = {shift:null,resumed:[],ownerInstallation:null,cursors:new Map(),movements:[]};
function responseFor(engine,actor){
  const installation=engine.data.installationId,cursor=central.cursors.get(installation)??{sequence:0,operationId:null};
  const linked=central.ownerInstallation===installation||central.resumed.includes(installation);
  const ledger=central.shift&&central.shift.actorId===actor&&linked&&(central.resumed.length>0||central.shift.closedAtMs!==null);
  return {signed:signedFor(actor),snapshot:{id:'snapshot-'+installation+'-'+cursor.sequence,createdAtMs:now,branchId:'centro',deviceId:'centro-caja',warehouseId:'centro-venta',serverSequence:cursor.sequence,serverOperationId:cursor.operationId,products:[],recipes:[],stock:[]},customers:[],
    loyalty:{rule:{id:'rule',earnEvery:'1000',pointValue:'10',maxPercent:'20',createdAtMs:now},members:[],asOfMs:now},
    openShift:central.shift?.closedAtMs===null?{id:central.shift.id,actorId:central.shift.actorId,actorName:central.shift.actorName}:null,
    sharedShifts:ledger?[{shift:structuredClone(central.shift),sales:[],refunds:[],cashMovements:structuredClone(central.movements),tip:'0',shipping:'0'}]:[],
    closedShiftIds:central.shift&&linked&&central.shift.closedAtMs!==null?[central.shift.id]:[]};
}
async function createEngine(installation){
  const data=blankData();data.installationId=installation;data.terminal={deviceId:'centro-caja',branchId:'centro',installationId:installation,token:'synthetic',publicKey};
  data.session={login:'actor-a',expires:Date.now()+3600000};
  const engine=new BrowserEngine({},data);engine.cookieActor='actor-a';engine.save=async()=>{};
  engine.remote=async(path,body)=>{
    const actor=engine.cookieActor;
    if(path==='/me')return {user:{id:actor,login:actor,role:'cashier'},branches:[]};
    if(path==='/pos/authorize')return responseFor(engine,actor);
    if(path==='/pos/shift/resume'){assert.equal(actor,central.shift.actorId);central.resumed.push(installation);return {id:central.shift.id};}
    if(path==='/pos/sync'){
      const event=JSON.parse(body.payload);
      if(event.kind==='shift.open'){central.ownerInstallation=installation;central.shift=structuredClone(engine.data.shifts.find(s=>s.id===event.shiftId));}
      if(event.kind==='cash.movement'){central.movements.push(structuredClone(engine.data.events.find(e=>e.id===body.operation.operationId).result.cashMovement));central.shift.expected=engine.shift().expected;}
      if(event.kind==='shift.close'){central.shift.closedAtMs=event.occurredAtMs;central.shift.counted=event.counted;central.shift.difference='0';}
      central.cursors.set(installation,{sequence:body.operation.sequence,operationId:body.operation.operationId});
      return {kind:'accepted',receipt:body.operation};
    }
    throw new Error('Unexpected synthetic transport '+path);
  };
  await engine.accept('actor-a','synthetic-verifier',responseFor(engine,'actor-a'));return engine;
}
const first=await createEngine('browser-1');await first.shiftCommand(randomUUID(),'shift.open','100');await first.sync();
const originalShiftId=central.shift.id;
const withdrawal=await first.cashMovementCommand(randomUUID(),{class:'withdrawal',method:'cash',amount:'10',reason:'Retiro sintético',reversesMovementId:null});await first.sync();
const input={class:'correction',method:'cash',amount:'10',reason:'Corrección sintética',reversesMovementId:withdrawal.cashMovement.id};
const correctionId=randomUUID(),corrected=await first.cashMovementCommand(correctionId,input);
assert.deepEqual(await first.cashMovementCommand(correctionId,input),corrected);
await first.sync();
const commercial=engine=>JSON.stringify({sequence:engine.data.sequence,previous:engine.data.previous,expected:engine.shift().expected,outbox:engine.data.outbox,commands:Object.keys(engine.data.commands),events:engine.data.events});
const before= commercial(first);
await assert.rejects(first.cashMovementCommand(randomUUID(),{...input,reason:'Corrección duplicada'}),/ya tiene una corrección/);
assert.equal(commercial(first),before);
const second=await createEngine('browser-2');await second.resumeShift();
const beforeSecond=commercial(second);
await assert.rejects(second.cashMovementCommand(randomUUID(),input),/ya tiene una corrección/);
assert.equal(commercial(second),beforeSecond);
first.cookieActor='actor-b';await first.login('actor-b','',true);
await second.shiftCommand(randomUUID(),'shift.close','100');await second.sync();await first.sync();
const state=await first.state(),retained=first.data.shifts.find(s=>s.id===originalShiftId),response=responseFor(first,'actor-b');
assert.equal(state.user.id,'actor-b');assert.equal(state.shift,null);assert.equal(response.openShift,null);assert.equal(response.sharedShifts.length,0);
assert.deepEqual(response.closedShiftIds,[originalShiftId]);assert.ok(first.data.closedShiftIds.includes(originalShiftId));
assert.equal(retained.actorId,'actor-a');assert.equal(retained.closedAtMs,null);assert.equal(retained.counted,null);
await first.shiftCommand(randomUUID(),'shift.open','200');assert.equal(first.shift().actorId,'actor-b');assert.equal(first.shift().openingCash,'200');
console.log('verified');
`;
  const result = spawnSync(process.execPath, ['--experimental-transform-types', '--input-type=module'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), input: script, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'verified');
});

test('AC-019-09: contraseña offline conserva su actor ante cookies ajenas y login concurrente', () => {
  const script = String.raw`
import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';
globalThis.require=createRequire(import.meta.url);
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{persist:async()=>true}}});
const {BrowserEngine,blankData}=await import('./web/offline/engine.ts');
const {verifyPassword}=await import('./web/offline/crypto.ts');
const {signAuthorization}=await import('./src/pos-crypto.ts');
const keys=generateKeyPairSync('ed25519');
const publicKey=keys.publicKey.export({type:'spki',format:'pem'}).toString();
const privateKey=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const users={
 cashier:{id:'cashier-id',login:'cashier',password:'cashier-password',role:'cashier'},
 owner:{id:'owner-id',login:'owner',password:'owner-password',role:'owner'},
 other:{id:'other-owner-id',login:'other',password:'other-owner-password',role:'owner'},
};
const devices={'centro-caja':'centro','milan-caja':'milan'};
let cookieUser=users.cashier,offline=false,hijackNextLogin=false;
const seen=[];
const actions=user=>['data.read','sale.charge','shift.open',...(user.role==='cashier'?[]:['sale.refund','settings.manage'])];
function authorized(user,deviceId){
 const now=Date.now()-1000,branchId=devices[deviceId];
 return {signed:signAuthorization({actorName:user.login,
  principal:{version:1,actorId:user.id,kind:'human',role:user.role,active:true,branchIds:['centro','milan'],actions:actions(user)},
  grant:{version:1,grantId:'grant-'+user.id+'-'+now,actorId:user.id,deviceId,branchId,validatedAtMs:now,expiresAtMs:now+7*86400000,actions:actions(user)}},privateKey),
  snapshot:{id:'snapshot-'+deviceId,createdAtMs:now,branchId,deviceId,warehouseId:branchId+'-venta',serverSequence:0,serverOperationId:null,products:[],recipes:[],stock:[]},
  customers:[],loyalty:{rule:{id:'rule',earnEvery:'1000',pointValue:'10',maxPercent:'20',createdAtMs:now},members:[],asOfMs:now},openShift:null,sharedShifts:[],closedShiftIds:[]};
}
globalThis.fetch=async(url,init)=>{
 if(offline)throw new Error('Synthetic network failure');
 const path=String(url).slice(4),body=init.body?JSON.parse(init.body):null;
 seen.push({path,credentials:init.credentials});
 const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
 if(path==='/login'){
  const user=users[body.login];assert.ok(user);assert.equal(body.password,user.password);
  cookieUser=hijackNextLogin?users.owner:user;hijackNextLogin=false;
  return json({ok:true,actorId:user.id});
 }
 if(path==='/me')return json({user:{id:cookieUser.id,login:cookieUser.login,role:cookieUser.role},branches:[{id:'centro',name:'Centro'},{id:'milan',name:'Milán'}]});
 if(path.startsWith('/branches/')){const branch=path.split('/').at(-1);return json({devices:[{id:branch+'-caja',name:'Caja',active:true}]});}
 if(path==='/pos/enroll')return json({deviceId:body.deviceId,branchId:devices[body.deviceId],installationId:body.installationId,token:'synthetic',publicKey});
 if(path==='/pos/authorize'){
  const actorId=init.credentials==='omit'?JSON.parse(body.previous.document).grant.actorId:cookieUser.id;
  const user=Object.values(users).find(user=>user.id===actorId);assert.ok(user);
  return json(authorized(user,body.deviceId));
 }
 throw new Error('Unexpected synthetic request '+path);
};
function engine(enrolled=true){
 const data=blankData();
 if(enrolled)data.terminal={deviceId:'centro-caja',branchId:'centro',installationId:data.installationId,token:'synthetic',publicKey};
 const result=new BrowserEngine({},data);result.save=async()=>{};return result;
}
const caixa=engine();await caixa.login('cashier','cashier-password');
const verifier=caixa.data.users.cashier.passwordHash;
delete caixa.data.users.cashier.actorId; // Existing v1 states recover identity from the signature.
cookieUser=users.owner;await caixa.refresh();
assert.equal((await caixa.state()).user.id,'cashier-id');
assert.equal(seen.at(-1).credentials,'omit');
const before=JSON.stringify(caixa.data);
await assert.rejects(caixa.reauthorize(),/otro usuario/);
assert.equal(JSON.stringify(caixa.data),before);
offline=true;await caixa.login('cashier','cashier-password');
assert.equal((await caixa.auth()).principal.role,'cashier');
await assert.rejects(caixa.auth('sale.refund'),/No tienes permiso/);
offline=false;cookieUser=users.owner;
await assert.rejects(caixa.switchTerminal('milan-caja'),/otro usuario/);
assert.equal(caixa.data.terminal.deviceId,'centro-caja');
assert.equal(caixa.data.users.cashier.passwordHash,verifier);
assert.equal((await caixa.state()).user.id,'cashier-id');

// A second tab can replace the cookie after successful password validation.
const fresh=engine();hijackNextLogin=true;
await assert.rejects(fresh.login('cashier','cashier-password'),/otro usuario/);
assert.equal(fresh.data.session,null);assert.equal(fresh.data.users.cashier,undefined);
await fresh.login('cashier','cashier-password');fresh.data.session=null;
const cachedBefore=JSON.stringify(fresh.data.users.cashier);hijackNextLogin=true;
await assert.rejects(fresh.login('cashier','cashier-password'),/otro usuario/);
assert.equal(fresh.data.session,null);assert.equal(JSON.stringify(fresh.data.users.cashier),cachedBefore);
await assert.rejects(fresh.login('cashier','',true),/otro usuario/);

// Enrollment has no old signed grant yet, so retain the authenticated actor ID.
const unbound=engine(false);await unbound.login('owner','owner-password');
assert.equal(unbound.data.users.owner.actorId,'owner-id');
const enrollmentBefore=JSON.stringify(unbound.data);cookieUser=users.other;
await assert.rejects(unbound.enroll('centro-caja'),/otro usuario/);
assert.equal(JSON.stringify(unbound.data),enrollmentBefore);
cookieUser=users.owner;await unbound.enroll('centro-caja');
assert.equal((await unbound.state()).user.id,'owner-id');
assert.ok(await verifyPassword('owner-password',unbound.data.users.owner.passwordHash));

// Old unenrolled v1 states have a verifier but no demonstrable actor identity.
const legacyUnbound=engine(false);await legacyUnbound.login('owner','owner-password');
delete legacyUnbound.data.users.owner.actorId;
const legacyBefore=JSON.stringify(legacyUnbound.data);
await assert.rejects(legacyUnbound.session(),/La cuenta cambió/);
assert.equal(JSON.stringify(legacyUnbound.data),legacyBefore);
await assert.rejects(legacyUnbound.enroll('centro-caja'),/otro usuario/);
assert.equal(JSON.stringify(legacyUnbound.data),legacyBefore);
await assert.rejects(legacyUnbound.preparePassword(''),/Ingresa tu contraseña/);
await legacyUnbound.preparePassword('owner-password');
await legacyUnbound.enroll('centro-caja');
assert.equal((await legacyUnbound.state()).user.id,'owner-id');

// Renewing permissions for the same person must remain possible.
users.cashier.role='manager';cookieUser=users.cashier;await caixa.reauthorize();
assert.equal(caixa.data.users.cashier.passwordHash,verifier);
assert.equal((await caixa.auth()).principal.role,'manager');await caixa.auth('sale.refund');

// A recreated login requires its new password, never the previous verifier.
users.cashier={id:'recreated-cashier-id',login:'cashier',password:'new-cashier-password',role:'cashier'};
cookieUser=users.cashier;const recreatedBefore=JSON.stringify(caixa.data);
await assert.rejects(caixa.session(),/La cuenta cambió/);
assert.equal(JSON.stringify(caixa.data),recreatedBefore);
await caixa.login('cashier','new-cashier-password');
assert.equal((await caixa.state()).user.id,'recreated-cashier-id');
assert.notEqual(caixa.data.users.cashier.passwordHash,verifier);
offline=true;
await assert.rejects(caixa.login('cashier','cashier-password'),/Credenciales offline incorrectas/);
await caixa.login('cashier','new-cashier-password');
assert.equal((await caixa.state()).user.id,'recreated-cashier-id');
console.log('verified');
`;
  const result=spawnSync(process.execPath,['--experimental-transform-types','--input-type=module'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),input:script,encoding:'utf8',timeout:30_000,
  });
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'verified');
});
