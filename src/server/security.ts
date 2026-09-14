import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { FastifyRequest } from 'fastify';
import type { Actor, UserRow } from './db.ts';
import { principal } from './db.ts';
import { authorize } from '../authorization.ts';
import type { Action } from '../contracts.ts';

export class ApiError extends Error {
  statusCode: number; code: string;
  constructor(statusCode: number, code: string, message: string) { super(message); this.statusCode = statusCode; this.code = code; }
}
export const SESSION_MS = 12 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64,
    { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (err, value) => err ? reject(err) : resolve(value)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [version, salt, hash] = stored.split('$');
  if (version !== 'scrypt-v1' || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, 'hex'));
}
export async function newSession(c: PoolClient, userId: string) {
  const token = randomBytes(32).toString('base64url'); const deviceId = randomUUID();
  await c.query('DELETE FROM sessions WHERE expires_at <= now()');
  await c.query('INSERT INTO sessions(token_hash,user_id,device_id,expires_at) VALUES($1,$2,$3,$4)',
    [tokenHash(token), userId, deviceId, new Date(Date.now() + SESSION_MS)]);
  return { token, deviceId, tokenHash: tokenHash(token) };
}
export async function authenticate(db: Pool | PoolClient, request: FastifyRequest): Promise<Actor> {
  const token = request.cookies.nativos_session;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'unauthenticated', 'Inicia sesión para continuar.');
  const result = await db.query<UserRow & { device_id: string }>(`SELECT u.*,s.device_id FROM sessions s
    JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [tokenHash(token)]);
  const row = result.rows[0];
  if (!row) throw new ApiError(401, 'unauthenticated', 'Tu sesión terminó. Inicia sesión de nuevo.');
  return { user: row, deviceId: row.device_id, tokenHash: tokenHash(token) };
}
export function requireAccess(actor: Actor, branchId: string, action: Action = 'data.read') {
  if (!authorize({ principal: principal(actor.user), action, branchId,
    deviceId: actor.deviceId, mode: 'online' }).allowed) throw new ApiError(403, 'forbidden', 'No tienes permiso para esta operación.');
}
export function requireAdmin(actor: Actor) {
  if (actor.user.role !== 'owner' || !actor.user.actions.includes('settings.manage'))
    throw new ApiError(403, 'forbidden', 'Esta administración requiere acceso del dueño.');
}
export const notFound = () => new ApiError(404, 'not_found', 'No se encontró el registro.');
