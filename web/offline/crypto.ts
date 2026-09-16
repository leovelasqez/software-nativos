import type { Signed,Authorization } from '../../src/pos-domain.ts';
import { isGrant,isPrincipal } from './contracts.ts';
const bytes=(s:string)=>new TextEncoder().encode(s);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',bytes(s)));
export async function passwordHash(password:string,salt:string=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveBits']);return salt+':'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:600000},key,256));}
export async function verifyPassword(password:string,stored:string){return await passwordHash(password,stored.split(':')[0])===stored;}
export async function verify(signed:Signed,pem:string):Promise<Authorization>{try{const raw=Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('spki',raw,'Ed25519',false,['verify']);if(!await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(signed.signature),c=>c.charCodeAt(0)),bytes(signed.document)))throw Error();const a=JSON.parse(signed.document);if(!isGrant(a.grant)||!isPrincipal(a.principal)||a.grant.actorId!==a.principal.actorId||typeof a.actorName!=='string')throw Error();return a;}catch{throw new Error('Autorización inválida. Inicia sesión online.');}}
