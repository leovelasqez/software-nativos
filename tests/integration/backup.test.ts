import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
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
    // Relational regression: the backup must restore parents before sale/event movements,
    // preserve configured seed rows, and include causal cost reconciliations.
    const actor = (await db.pool.query('SELECT id FROM app_users')).rows[0].id;
    await db.pool.query("UPDATE branches SET name='Centro configurado' WHERE id='centro'");
    await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES('backup-item','Artículo sintético','BK-1','raw','g')");
    await db.pool.query("INSERT INTO inventory_cost_reconciliations(id,warehouse_id,item_id,actor_id,unit_cost,effective_from,reason) VALUES('backup-cost','centro-venta','backup-item',$1,2,'2026-09-25','Conciliación sintética')",[actor]);
    await db.pool.query("INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at) VALUES('backup-shift','centro-caja','centro',$1,150000,now())",[actor]);
    await db.pool.query("INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES('backup-sale','backup-order','backup-shift','centro-caja','centro',$1,'backup-receipt','{}',10000,now(),false)",[actor]);
    await db.pool.query("INSERT INTO pos_order_events(id,device_id,actor_id,data) VALUES('backup-event','centro-caja',$1,'{}')",[actor]);
    await db.pool.query("INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,reason,sale_id,event_id) VALUES('backup-movement','backup-item','centro-venta','sale',-100,'Venta sintética','backup-sale','backup-event')");
    const created = await app.inject({ method: 'POST', url: '/api/backups', headers }); assert.equal(created.statusCode, 201, created.body);
    const manifest = created.json(); assert.equal(manifest.coverage, 'server-synchronized-only'); assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
    const snapshot = JSON.parse(await readFile(resolve(directory, `backup-${manifest.id}.json`),'utf8'));
    const databaseTables = (await db.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations'")).rows.map(row=>row.tablename).sort();
    assert.deepEqual(Object.keys(snapshot.rows).sort(),databaseTables, 'Every business table must be covered');
    assert.equal(snapshot.rows.inventory_cost_reconciliations.length,1);
    const listed = await app.inject({ method: 'GET', url: '/api/backups', headers: { host: '127.0.0.1:4360', cookie: headers.cookie } }); assert.equal(listed.statusCode, 200); assert.deepEqual(listed.json().items.map((item: { id: string }) => item.id), [manifest.id]);
    const verified = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/verify`, headers }); assert.equal(verified.statusCode, 200, verified.body);
    const missingConfirmation = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, headers }); assert.equal(missingConfirmation.statusCode, 400, missingConfirmation.body);
    const restored = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, payload: { confirm: `RESTORE ${manifest.id}` }, headers }); assert.equal(restored.statusCode, 200, restored.body); assert.equal(restored.json().reconciled, true); assert.ok(restored.json().tables.every((row: { sourceRows: number; restoredRows: number }) => row.sourceRows === row.restoredRows));
    assert.ok(restored.json().tables.every((row: { contentMatches: boolean })=>row.contentMatches));
    const secondRestore = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/restore-check`, payload: { confirm: `RESTORE ${manifest.id}` }, headers }); assert.equal(secondRestore.statusCode, 409, secondRestore.body); assert.equal(secondRestore.json().code, 'restore_destination_exists');
    const failedApp = await createApp({pool:db.pool,origin:'http://127.0.0.1:4360',backupDirectory:directory,backupRestoreDatabase:'restore_failed',backupRestoreConnection:db.connection});
    try {
      const brokenManifest=(await app.inject({method:'POST',url:'/api/backups',headers})).json();
      const brokenPath=resolve(directory,`backup-${brokenManifest.id}.json`);
      const broken=JSON.parse(await readFile(brokenPath,'utf8'));
      async function persistBroken() {const bytes=Buffer.from(JSON.stringify(broken)); await writeFile(brokenPath,bytes); await writeFile(resolve(directory,`backup-${brokenManifest.id}.manifest.json`),JSON.stringify({...brokenManifest,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));}
      const costs=broken.rows.inventory_cost_reconciliations; delete broken.rows.inventory_cost_reconciliations; await persistBroken();
      const incomplete=await failedApp.inject({method:'POST',url:`/api/backups/${brokenManifest.id}/restore-check`,payload:{confirm:`RESTORE ${brokenManifest.id}`},headers});
      assert.equal(incomplete.statusCode,409); assert.equal(incomplete.json().code,'backup_incomplete');
      assert.equal((await db.pool.query("SELECT 1 FROM pg_database WHERE datname='restore_failed'")).rowCount,0);
      broken.rows.inventory_cost_reconciliations=costs; broken.rows.inventory_movements[0].sale_id='missing-sale'; await persistBroken();
      const failed=await failedApp.inject({method:'POST',url:`/api/backups/${brokenManifest.id}/restore-check`,payload:{confirm:`RESTORE ${brokenManifest.id}`},headers}); assert.equal(failed.statusCode,400);
      const target=new Pool({...db.connection,database:'restore_failed'});
      try {assert.equal((await target.query('SELECT count(*) FROM pos_sales')).rows[0].count,'0'); assert.equal((await target.query("SELECT name FROM branches WHERE id='centro'")).rows[0].name,'Centro'); assert.equal((await target.query("SELECT tgenabled FROM pg_trigger WHERE tgname='loyalty_rule_immutable'")).rows[0].tgenabled,'O');}
      finally {await target.end();}
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count,'1');
    } finally {await failedApp.close();}
    const path = resolve(directory, `backup-${manifest.id}.json`); await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('alterado')]));
    const invalid = await app.inject({ method: 'POST', url: `/api/backups/${manifest.id}/verify`, headers }); assert.equal(invalid.statusCode, 409, invalid.body); assert.equal(invalid.json().code, 'backup_invalid');
    assert.equal((await db.pool.query("SELECT count(*) FROM audit_events WHERE action IN ('backup.created','backup.verified')")).rows[0].count, '3');
  } finally { await app.close(); await db.stop(); await rm(base, { recursive: true, force: true }); }
});
