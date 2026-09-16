import { createHash, sign, verify } from 'node:crypto';
import { isGrant, isPrincipal } from './contracts.ts';
import type { Authorization, Signed } from './pos-domain.ts';
export const payloadHash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export function signAuthorization(doc: Authorization, privateKey: string): Signed {
  const document = JSON.stringify(doc); return { document, signature: sign(null, Buffer.from(document), privateKey).toString('base64') };
}
export function verifyAuthorization(signed: Signed, publicKey: string): Authorization {
  try {
    if (!verify(null, Buffer.from(signed.document), publicKey, Buffer.from(signed.signature, 'base64'))) throw new Error();
    const doc = JSON.parse(signed.document) as Authorization;
    if (!isGrant(doc.grant) || !isPrincipal(doc.principal) || doc.grant.actorId !== doc.principal.actorId || typeof doc.actorName !== 'string') throw new Error();
    return doc;
  } catch { throw new Error('La autorización local no es válida. Inicia sesión online.'); }
}
