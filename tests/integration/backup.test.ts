import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';

test('AC-011-04/06 — dueño crea y verifica respaldo lógico; artefacto alterado se rechaza', { timeout: 120_000 }, async () => {
  const base = resolve('.local/backup-test-' + randomUUID()); const directory = resolve(base, 'backups');
  const db = await startLocalPostgres(base, { password: randomBytes(32).toString('hex') });
  const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4360', backupDirectory: directory, backupRestoreDatabase: 'restore_check', backupRestoreConnection: db.connection });
  try {
    await migrate(db.pool); const password = randomBytes(24).toString('base64url');
    const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { name: 'Dueño respaldo', login: 'owner-backup', password }, headers: { host: '127.0.0.1:4360', 'x-nativos-request': '1' } });
    assert.equal(setup.statusCode, 201, setup.body); const headers = { host: '127.0.0.1:4360', cookie: `nativos_session=${setup.cookies[0]!.value}`, 'x-nativos-request': '1' };
    const created = await app.inject({ method: 'POST', url: '/api/backups', headers }); assert.equal(created.statusCode, 201, created.body);
    const manifest = created.json(); assert.equal(manifest.coverage, 'server-synchronized-only'); assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
    const listed = await app.inject({ method: 'GET', url: '/api/backups', headers: { host: '127.0.0.1:4360', cookie: headers.cookie } }); assert.equal(listed.statusCode, 200); assert.deepEqual(listed.json().items.map((item: { id: string }) => item.id), [manifest.id]);
    const verified = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/verify`, headers }); assert.equal(verified.statusCode, 200, verified.body);
    const missingConfirmation = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, headers }); assert.equal(missingConfirmation.statusCode, 400, missingConfirmation.body);
    const restored = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, payload: { confirm: `RESTORE ${manifest.id}` }, headers }); assert.equal(restored.statusCode, 200, restored.body); assert.equal(restored.json().reconciled, true); assert.ok(restored.json().tables.every((row: { sourceRows: number; restoredRows: number }) => row.sourceRows === row.restoredRows));
    const secondRestore = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, payload: { confirm: `RESTORE ${manifest.id}` }, headers }); assert.equal(secondRestore.statusCode, 409, secondRestore.body); assert.equal(secondRestore.json().code, 'restore_destination_exists');
    const path = resolve(directory, `backup-${manifest.id}.json`); await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('alterado')]));
    const invalid = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/verify`, headers }); assert.equal(invalid.statusCode, 409, invalid.body); assert.equal(invalid.json().code, 'backup_invalid');
    assert.equal((await db.pool.query("SELECT count(*) FROM audit_events WHERE action IN ('backup.created','backup.verified')")).rows[0].count, '2');
  } finally { await app.close(); await db.stop(); await rm(base, { recursive: true, force: true }); }
});
