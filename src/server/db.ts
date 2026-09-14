import { readFile, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { Action, Principal, Role } from '../contracts.ts';

export interface UserRow {
  id: string; name: string; login: string; password_hash: string; role: Role;
  active: boolean; branch_ids: string[]; actions: Action[];
}
export function publicUser(u: UserRow) {
  return { id: u.id, name: u.name, login: u.login, role: u.role,
    active: u.active, branchIds: u.branch_ids, actions: u.actions };
}
export function principal(u: UserRow): Principal {
  return { version: 1, actorId: u.id, kind: 'human', role: u.role,
    active: u.active, branchIds: u.branch_ids, actions: u.actions };
}
export interface Actor { user: UserRow; deviceId: string; tokenHash: string }
export async function transaction<T>(pool: Pool, run: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await run(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}
export async function migrate(pool: Pool) {
  await transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7300)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const folder = new URL('../../migrations/', import.meta.url);
    for (const name of (await readdir(folder)).filter(n => n.endsWith('.sql')).sort()) {
      const sql = (await readFile(new URL(name, folder), 'utf8')).replaceAll('\r\n', '\n');
      const hash = createHash('sha256').update(sql).digest('hex');
      const old = await c.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (old.rows[0]) {
        if (old.rows[0].checksum !== hash) throw new Error('migration_checksum_mismatch');
      } else {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, hash]);
      }
    }
  });
}
export async function audit(c: PoolClient, actor: Actor, action: string, reason: string,
  changes: object, branchId: string | null = null, scope = actor.user.branch_ids) {
  await c.query(`INSERT INTO audit_events(actor_id,actor_kind,device_id,branch_id,scope_branch_ids,operation_id,action,reason,changes)
    VALUES($1,'human',$2,$3,$4,$5,$6,$7,$8)`,
  [actor.user.id, actor.deviceId, branchId, scope, randomUUID(), action, reason, JSON.stringify(changes)]);
}
