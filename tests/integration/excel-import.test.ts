import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { excelFixture } from '../excel-fixture.ts';

test('Excel API: staging, atomic confirmation, conflicts, expiry, permissions and retries', { timeout: 180_000 }, async () => {
  const db = await startLocalPostgres(resolve('.local/excel-import-test-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4381' });
  try {
    await migrate(db.pool);
    const setup = await app.inject({ method: 'POST', url: '/api/setup', headers: { host: '127.0.0.1:4381', 'x-nativos-request': '1' }, payload: { name: 'Dueño Excel', login: 'excel-owner', password: randomBytes(24).toString('hex') } });
    assert.equal(setup.statusCode, 201, setup.body);
    const headers = { host: '127.0.0.1:4381', 'x-nativos-request': '1', cookie: `nativos_session=${setup.cookies[0]!.value}` };
    const post = (url: string, payload: object) => app.inject({ method: 'POST', url: '/api/catalog/imports/' + url, payload, headers });
    const count = async (table: string) => Number((await db.pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
    const payload = { branchId: 'centro', reason: 'Prueba sintética Excel', fileName: 'prueba.xlsx', content: (await excelFixture()).toString('base64') };
    const denied = await app.inject({ method: 'POST', url: '/api/catalog/imports/preview', payload, headers: { ...headers, cookie: '' } }); assert.equal(denied.statusCode, 401);
    assert.equal((await post('preview', { ...payload, branchId: 'not-allowed' })).statusCode, 403);
    const template = await app.inject({ method: 'GET', url: '/api/catalog/imports/template?branchId=centro', headers }); assert.equal(template.statusCode, 200); assert.ok(template.rawPayload.length > 1000);
    const preview = await post('preview', payload); assert.equal(preview.statusCode, 200, preview.body); assert.equal(preview.json().valid, true, preview.body);
    assert.equal(await count('catalog_products'), 0); assert.equal(await count('inventory_items'), 0);
    const previewId = preview.json().previewId as string;
    // Force a late failure, after new insumos and the first product were inserted.
    await db.pool.query("CREATE FUNCTION fail_excel_product() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reference='BOT-TEST' THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN NEW; END $$");
    await db.pool.query('CREATE TRIGGER fail_excel BEFORE INSERT ON catalog_products FOR EACH ROW EXECUTE FUNCTION fail_excel_product()');
    assert.equal((await post('confirm', { previewId })).statusCode, 500);
    assert.equal(await count('catalog_products'), 0); assert.equal(await count('inventory_items'), 0); assert.equal(await count('recipe_versions'), 0);
    await db.pool.query('DROP TRIGGER fail_excel ON catalog_products');
    const confirm = await post('confirm', { previewId }); assert.equal(confirm.statusCode, 200, confirm.body);
    assert.deepEqual(confirm.json().summary, { products: 2, recipes: 1, items: 2, lines: 2, options: 2 });
    assert.equal(await count('catalog_products'), 2); assert.equal(await count('inventory_items'), 3); assert.equal(await count('recipe_versions'), 1);
    assert.deepEqual((await post('confirm', { previewId })).json(), confirm.json());
    assert.equal(Number((await db.pool.query("SELECT count(*) FROM audit_events WHERE action='catalog.excel_imported'")).rows[0].count), 1);
    const recipe = (await db.pool.query('SELECT data FROM recipe_versions')).rows[0].data;
    assert.equal(recipe.lines[0].baseQuantity, '150'); assert.equal(recipe.options[1].line.baseQuantity, '120');
    const duplicate = await post('preview', payload); assert.equal(duplicate.json().valid, false); assert.ok(duplicate.json().issues.length >= 3);
    const onlyItem = await excelFixture(w => {
      for (const name of ['Productos', 'Recetas', 'Ingredientes', 'Opciones', 'Insumos nuevos']) w.getWorksheet(name)!.eachRow((r, n) => { if (n > 1) r.values = []; });
      w.getWorksheet('Insumos nuevos')!.addRow(['NEW-ONLY', 'Insumo nuevo sintético', 'Materia prima', 'g']);
    });
    const itemPayload = { ...payload, content: onlyItem.toString('base64') };
    const itemPreview = (await post('preview', itemPayload)).json(); assert.equal(itemPreview.valid, true, JSON.stringify(itemPreview));
    await db.pool.query("UPDATE excel_catalog_imports SET expires_at=now()-interval '1 minute' WHERE id=$1", [itemPreview.previewId]);
    assert.equal((await post('confirm', { previewId: itemPreview.previewId })).statusCode, 409);
    const changed = (await post('preview', itemPayload)).json();
    await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES('conflict','Conflicto sintético','NEW-ONLY','raw','g')");
    assert.equal((await post('confirm', { previewId: changed.previewId })).statusCode, 409);
    // Revoke access after preview: even an idempotent retry must check current permissions.
    await db.pool.query("UPDATE app_users SET actions=ARRAY['data.read']::text[] WHERE login='excel-owner'");
    assert.equal((await post('confirm', { previewId })).statusCode, 403);
  } finally { await app.close(); await db.stop(); }
});
