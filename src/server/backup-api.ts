import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolConfig } from 'pg';
import { Pool as RestorePool } from 'pg';
import { audit, migrate, transaction } from './db.ts';
import { ApiError, authenticate, requireAdmin } from './security.ts';

const tables = [
  'branches', 'warehouses', 'devices', 'app_users', 'sessions', 'login_attempts', 'audit_events',
  'catalog_products', 'product_versions', 'inventory_items', 'recipe_versions', 'inventory_movements',
  'inventory_minimums', 'catalog_operations', 'pos_signing_key', 'pos_terminals', 'pos_snapshots',
  'pos_shifts', 'pos_sales', 'pos_receipts', 'customers', 'pos_orders_v2', 'pos_order_events', 'pos_refunds',
  'loyalty_rules', 'loyalty_members', 'loyalty_ledger', 'loyalty_cancellations', 'suppliers', 'purchases',
  'purchase_lines', 'inventory_transfers', 'inventory_transfer_lines', 'inventory_transfer_events',
  'inventory_transfer_event_lines', 'inventory_counts', 'inventory_count_lines',
  'inventory_internal_consumptions', 'inventory_internal_consumption_lines', 'pos_cash_movements',
] as const;

type Manifest = {
  version: 1; id: string; createdAt: string; schemaVersion: string; sha256: string; bytes: number;
  coverage: 'server-synchronized-only'; verified: boolean; verifiedAt: string | null;
};

function digest(data: Buffer) { return createHash('sha256').update(data).digest('hex'); }
function file(root: string, id: string) { return join(root, `backup-${id}.json`); }
function manifestFile(root: string, id: string) { return join(root, `backup-${id}.manifest.json`); }
function validId(id: unknown): id is string { return typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id); }
function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function validDatabase(value: unknown): value is string { return typeof value === 'string' && /^[a-z][a-z0-9_]{2,50}$/.test(value); }

type Snapshot = { version: 1; id: string; coverage: 'server-synchronized-only'; schemaVersion: string; migrations: string[]; rows: Record<string, Record<string, unknown>[]> };

export function registerBackups(app: FastifyInstance, pool: Pool, directory?: string, restoreDatabase?: string, restoreConnection?: PoolConfig) {
  const root = directory ? resolve(directory) : null;
  async function load(id: string) {
    if (!root || !validId(id)) throw new ApiError(404, 'not_found', 'No se encontró el respaldo.');
    try { return JSON.parse(await readFile(manifestFile(root, id), 'utf8')) as Manifest; }
    catch { throw new ApiError(404, 'not_found', 'No se encontró el respaldo.'); }
  }
  async function save(manifest: Manifest) {
    if (!root) throw new ApiError(503, 'backup_unavailable', 'El respaldo local no está configurado.');
    const target = manifestFile(root, manifest.id); const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(manifest), { encoding: 'utf8', mode: 0o600 }); await rename(temp, target);
  }
  function available() { if (!root) throw new ApiError(503, 'backup_unavailable', 'El respaldo local no está configurado.'); }
  async function verifiedBody(manifest: Manifest) {
    let body: Buffer;
    try { body = await readFile(file(root!, manifest.id)); } catch { throw new ApiError(409, 'backup_missing', 'Falta el artefacto del respaldo.'); }
    if (body.length !== manifest.bytes || digest(body) !== manifest.sha256) throw new ApiError(409, 'backup_invalid', 'La integridad del respaldo no es válida.');
    try {
      const snapshot = JSON.parse(body.toString('utf8')) as Snapshot;
      if (snapshot.version !== 1 || snapshot.id !== manifest.id || snapshot.coverage !== manifest.coverage
        || !Array.isArray(snapshot.migrations) || !snapshot.rows || typeof snapshot.rows !== 'object') throw new Error('invalid');
      return snapshot;
    } catch { throw new ApiError(409, 'backup_invalid', 'El contenido del respaldo no es válido.'); }
  }

  app.get('/api/backups', async req => {
    available(); const actor = await authenticate(pool, req); requireAdmin(actor); await mkdir(root!, { recursive: true, mode: 0o700 });
    const files = await readdir(root!); const result: Manifest[] = [];
    for (const name of files.filter(name => /^backup-[0-9a-f-]{36}\.manifest\.json$/.test(name))) {
      try { result.push(JSON.parse(await readFile(join(root!, name), 'utf8')) as Manifest); } catch { /* never expose a malformed file */ }
    }
    return { items: result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });

  app.post('/api/backups', async (req, reply) => {
    available(); const actor = await authenticate(pool, req); requireAdmin(actor); await mkdir(root!, { recursive: true, mode: 0o700 });
    const rows: Record<string, unknown[]> = {};
    for (const table of tables) rows[table] = (await pool.query(`SELECT * FROM ${table}`)).rows;
    const migrations = (await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map(row => row.name);
    const id = randomUUID(); const createdAt = new Date().toISOString();
    const body = Buffer.from(JSON.stringify({ version: 1, id, createdAt, coverage: 'server-synchronized-only', schemaVersion: migrations.at(-1) ?? 'none', migrations, rows }), 'utf8');
    const target = file(root!, id); const temp = `${target}.tmp`;
    await writeFile(temp, body, { mode: 0o600, flag: 'wx' }); await rename(temp, target);
    const manifest: Manifest = { version: 1, id, createdAt, schemaVersion: migrations.at(-1) ?? 'none', sha256: digest(body), bytes: body.length, coverage: 'server-synchronized-only', verified: true, verifiedAt: createdAt };
    await save(manifest);
    await transaction(pool, async c => { await audit(c, actor, 'backup.created', 'Respaldo lógico local creado', { id, sha256: manifest.sha256, bytes: manifest.bytes, coverage: manifest.coverage }); });
    return reply.code(201).send(manifest);
  });

  app.post('/api/backups/:id/verify', async req => {
    available(); const actor = await authenticate(pool, req); requireAdmin(actor); const id = (req.params as { id: string }).id; const manifest = await load(id);
    await verifiedBody(manifest);
    manifest.verified = true; manifest.verifiedAt = new Date().toISOString(); await save(manifest);
    await transaction(pool, async c => { await audit(c, actor, 'backup.verified', 'Integridad de respaldo verificada', { id, sha256: manifest.sha256 }); });
    return manifest;
  });

  app.post('/api/backups/:id/restore-check', async req => {
    available(); const actor = await authenticate(pool, req); requireAdmin(actor); const id = (req.params as { id: string }).id;
    const manifest = await load(id); const body = req.body as { confirm?: string } | undefined;
    if (body?.confirm !== `RESTORE ${id}`) throw new ApiError(400, 'restore_confirmation_required', 'Confirma exactamente la restauración aislada solicitada.');
    if (!validDatabase(restoreDatabase) || !restoreConnection) throw new ApiError(409, 'restore_not_configured', 'La base aislada de restauración no está configurada.');
    const active = (await pool.query<{ name: string }>('SELECT current_database() AS name')).rows[0]!.name;
    if (active === restoreDatabase) throw new ApiError(409, 'restore_destination_active', 'La base destino no puede ser la base activa.');
    if ((await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [restoreDatabase])).rowCount)
      throw new ApiError(409, 'restore_destination_exists', 'La base destino ya existe; no se vaciará ni sustituirá.');
    const snapshot = await verifiedBody(manifest); const sourceTables = Object.keys(snapshot.rows);
    if (sourceTables.some(table => !tables.includes(table as typeof tables[number]))) throw new ApiError(409, 'backup_invalid', 'El respaldo contiene una tabla no admitida.');
    await pool.query(`CREATE DATABASE ${quoteIdentifier(restoreDatabase)}`);
    const restored = new RestorePool({ ...restoreConnection, database: restoreDatabase, max: 4 });
    try {
      await migrate(restored);
      const restoredMigrations = (await restored.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map(row => row.name);
      if (JSON.stringify(restoredMigrations) !== JSON.stringify(snapshot.migrations)) throw new ApiError(409, 'schema_mismatch', 'La versión del esquema del respaldo no coincide con el destino aislado.');
      for (const table of tables) {
        const rows = snapshot.rows[table] ?? [];
        for (const row of rows.sort((a, b) => Number(Boolean(a.reverses_id)) - Number(Boolean(b.reverses_id)))) {
          const columns = Object.keys(row); if (!columns.length) continue;
          const values = columns.map(column => row[column]);
          await restored.query(`INSERT INTO ${table}(${columns.map(quoteIdentifier).join(',')}) ${table === 'audit_events' ? 'OVERRIDING SYSTEM VALUE' : ''} VALUES(${columns.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT DO NOTHING`, values);
        }
      }
      await restored.query("SELECT setval(pg_get_serial_sequence('audit_events','id'),COALESCE((SELECT max(id) FROM audit_events),1),true)");
      const reconciliation = [] as { table: string; sourceRows: number; restoredRows: number }[];
      for (const table of tables) {
        const restoredRows = Number((await restored.query<{ count: string }>(`SELECT count(*) FROM ${table}`)).rows[0]!.count);
        const sourceRows = (snapshot.rows[table] ?? []).length; reconciliation.push({ table, sourceRows, restoredRows });
      }
      if (reconciliation.some(row => row.sourceRows !== row.restoredRows)) throw new ApiError(409, 'restore_mismatch', 'La conciliación de la base aislada no coincide con el respaldo.');
      await transaction(pool, async c => { await audit(c, actor, 'backup.restore_checked', 'Restauración aislada verificada', { id, destination: restoreDatabase, tables: reconciliation.length }); });
      return { id, destination: restoreDatabase, coverage: manifest.coverage, reconciled: true, tables: reconciliation };
    } finally { await restored.end(); }
  });
}
