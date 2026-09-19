import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { PosEngine } from '../../src/pos/engine.ts';
import type { Requester } from '../../src/pos/engine.ts';
import type { Snapshot } from '../../src/pos-domain.ts';
import { payloadHash } from '../../src/pos-crypto.ts';
import { WEEK_MS } from '../../src/contracts.ts';

test('Incremento 3 — PostgreSQL, SQLite y DPAPI reales; recuperación y sincronización', { timeout: 240_000 }, async t => {
  const directory = resolve('.local/pos-test-' + randomUUID()); const password = randomBytes(24).toString('base64url');
  const dbPassword = randomBytes(32).toString('hex'); let db = await startLocalPostgres(directory, { password: dbPassword });
  let app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4330' });
  let cookie = ''; let offline = false; let loseReply = false; let offset = 0; let original: Snapshot; let productId = ''; let preparedId = ''; let rawId = ''; let warehouse = ''; let saleId = '';
  const req = async (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: object) => app.inject({ method, url, ...(payload ? { payload } : {}), headers: { host: '127.0.0.1:4330', cookie, 'x-nativos-request': '1' } });
  const request: Requester = async (url, init) => {
    if (offline) throw new Error('Simulated network outage');
    const headers = Object.fromEntries(new Headers(init.headers)); headers.host = '127.0.0.1:4330';
    const r = await app.inject({ method: init.method as 'GET' | 'POST', url: new URL(url).pathname, headers, ...(init.body ? { payload: String(init.body) } : {}) });
    if (loseReply && url.endsWith('/pos/sync') && r.statusCode === 200) { loseReply = false; throw new Error('Response lost after central commit'); }
    return new Response(r.body, { status: r.statusCode, headers: r.headers as Record<string, string> });
  };
  const openEngine = () => PosEngine.open(join(directory, 'terminal'), 'http://127.0.0.1:4330', { request, clock: () => Date.now() + offset });
  let engine: PosEngine | undefined;
  const common = () => ({ branchId: 'centro', operationId: randomUUID(), reason: 'Verificación sintética de caja' });
  const draftProduct = (reference: string, type = 'finished') => ({ ...common(), type, reference, name: 'Producto ' + reference, category: 'Pruebas', presentation: 'Unidad', unit: 'unit', price: '100.5', tax: null, description: '' });
  try {
    await migrate(db.pool); await migrate(db.pool);
    const setup = await req('POST', '/api/setup', { name: 'Dueño Sintético', login: 'owner-pos', password }); assert.equal(setup.statusCode, 201, setup.body); cookie = `nativos_session=${setup.cookies[0]!.value}`;
    const detail = (await req('GET', '/api/branches/centro')).json(); warehouse = detail.warehouses.find((w: { isDefault: boolean }) => w.isDefault).id;
    const p = await req('POST', '/api/products', draftProduct('FIN')); assert.equal(p.statusCode, 200, p.body); productId = p.json().id;
    rawId = (await req('POST', '/api/items', { ...common(), name: 'Insumo sintético', reference: 'RAW-POS', kind: 'raw', baseUnit: 'g' })).json().id;
    preparedId = (await req('POST', '/api/products', draftProduct('PREP', 'prepared'))).json().id;
    const recipe = await req('POST', `/api/products/${preparedId}/recipes`, { ...common(), name: 'Receta sintética', instructions: '', state: 'active', expectedActiveVersion: 0, lines: [{ id: 'ingredient', itemId: rawId, quantity: '10', unit: 'g', conversion: null, kind: 'ingredient' }], options: [{ id: 'extra', name: 'Adicional sintético', kind: 'addition', replacesLineId: null, price: '5', line: { id: 'extra-line', itemId: rawId, quantity: '2', unit: 'g', conversion: null, kind: 'ingredient' } }] }); assert.equal(recipe.statusCode, 200, recipe.body);
    engine = await openEngine();
    await t.test('Activación única, firma, catálogo sin costos y custodia cifrada', async () => {
      const r = await engine!.login('owner-pos', password); assert.equal(r.needsEnrollment, true); await engine!.enroll(detail.devices[0].id, 'owner-pos');
      original = engine!.state('owner-pos').snapshot!; assert.ok(original.products.some(p => p.id === preparedId));
      assert.doesNotMatch(JSON.stringify(original), /unitCost|password|privateKey/);
      const encrypted = await readFile(join(directory, 'terminal/vault.dpapi'), 'utf8'); assert.ok(!encrypted.includes(engine!.vault.data.terminal!.token)); assert.ok(!encrypted.includes('owner-pos'));
      const second = await req('POST', '/api/pos/enroll', { deviceId: detail.devices[0].id, installationId: randomUUID() }); assert.equal(second.statusCode, 409);
    });
    await t.test('Pedido y consumo: guardar no descuenta; rollback previo al commit no deja cobro parcial', async () => {
      await engine!.execute('owner-pos', 'shift.open', { operationId: randomUUID(), openingCash: '500' });
      const o = engine!.state('owner-pos').order;
      await engine!.saveOrder('owner-pos', { ...o, lines: [{ id: randomUUID(), productId, snapshotId: original.id, quantity: '1', optionIds: [] }, { id: randomUUID(), productId: preparedId, snapshotId: original.id, quantity: '2', optionIds: ['extra'] }] });
      assert.ok(engine!.store.balances().every(i => !i.negative));
      const order = engine!.store.order(engine!.access('owner-pos', 'data.read').grant.actorId)!;
      assert.throws(() => engine!.store.command(randomUUID(), { test: true }, engine!.access('owner-pos', 'sale.charge'), { kind: 'sale.charge', shiftId: engine!.store.shift()!.id, orderId: order.id, snapshotId: order.snapshotId, lines: order.lines, payment: { method: 'cash', received: '500' }, occurredAtMs: Date.now() }, engine!.vault.data.installationId, () => { throw new Error('before commit'); }), /before commit/);
      assert.equal(engine!.store.history().length, 0); assert.equal(engine!.store.pending().length, 1); assert.equal(engine!.store.shift()!.expected, '500'); assert.equal(engine!.store.order(order.id), null); assert.equal(engine!.state('owner-pos').order.lines.length, 2);
    });
    await t.test('Venta offline exacta y doble clic: una venta, efectivo y consumo; reinicio recupera todo', async () => {
      offline = true; const s = engine!.state('owner-pos'); saleId = randomUUID();
      const body = { operationId: saleId, orderId: s.order.id, revision: s.order.revision, payment: { method: 'cash' as const, received: '500' } };
      const r = await engine!.execute('owner-pos', 'sale.charge', body); assert.deepEqual(await engine!.execute('owner-pos', 'sale.charge', body), r);
      const receipt = r.receipt as { total: string; change: string }; assert.equal(receipt.total, '312'); assert.equal(receipt.change, '188'); assert.equal(engine!.store.shift()!.expected, '812');
      assert.equal(engine!.store.balances().find(i => i.itemId === rawId)!.quantity, '-24');
      engine!.close(); engine = await openEngine(); await engine.login('owner-pos', password);
      assert.equal(engine.store.history().length, 1); assert.equal(engine.store.pending().length, 2); assert.deepEqual(engine.store.receipt(saleId), r.receipt);
      await assert.rejects(engine.login('owner-pos', 'incorrecta'));
    });
    await t.test('Acuse perdido después del commit: reintento confirma sin duplicar consumo ni venta', async () => {
      offline = false;
      await db.pool.query("CREATE FUNCTION reject_pos_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER reject_pos_receipt BEFORE INSERT ON pos_receipts FOR EACH ROW EXECUTE FUNCTION reject_pos_receipt();");
      await engine!.sync(); assert.equal(engine!.store.pending().length, 2); assert.equal((await db.pool.query('SELECT count(*) FROM pos_shifts')).rows[0].count, '0');
      await db.pool.query('DROP TRIGGER reject_pos_receipt ON pos_receipts; DROP FUNCTION reject_pos_receipt();');
      loseReply = true; await engine!.sync(); assert.equal(engine!.store.pending().length, 2);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_receipts')).rows[0].count, '1');
      await engine!.sync(); assert.equal(engine!.store.pending().length, 0);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count, '1');
      assert.equal((await db.pool.query('SELECT sum(quantity)::text AS n FROM inventory_movements WHERE item_id=$1', [rawId])).rows[0].n, '-24.000000');
      assert.deepEqual((await db.pool.query('SELECT data FROM pos_sales WHERE id=$1', [saleId])).rows[0].data, engine!.store.receipt(saleId));
      assert.equal(engine!.store.balances().find(i => i.itemId === rawId)!.quantity, '-24');
      const sqlite = await readFile(join(directory, 'terminal/pos.sqlite')); assert.ok(!sqlite.includes(Buffer.from(engine!.vault.data.terminal!.token))); assert.ok(!sqlite.includes(Buffer.from('"signature"')));
    });
    await t.test('Reinicio central conserva acuses, ventas e inventario', async () => {
      await app.close(); await db.stop(); db = await startLocalPostgres(directory, { password: dbPassword }); await migrate(db.pool); app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4330' });
      await engine!.sync(); assert.equal(engine!.store.pending().length, 0); assert.deepEqual((await db.pool.query('SELECT data FROM pos_sales WHERE id=$1', [saleId])).rows[0].data, engine!.store.receipt(saleId));
    });
    await t.test('Precio histórico y producto nuevo dentro del pedido; digital no aumenta efectivo', async () => {
      const order = engine!.state('owner-pos').order; await engine!.saveOrder('owner-pos', { ...order, lines: [{ id: randomUUID(), productId, snapshotId: original.id, quantity: '1', optionIds: [] }] });
      const { type: _, ...update } = draftProduct('FIN'); assert.equal((await req('PUT', `/api/products/${productId}`, { ...update, expectedVersion: 1, price: '999' })).statusCode, 200);
      await engine!.login('owner-pos', password); const newProduct = await engine!.createProduct('owner-pos', draftProduct('NEW')) as { id: string };
      const s = engine!.state('owner-pos'); await engine!.saveOrder('owner-pos', { ...s.order, lines: [...s.order.lines, { id: randomUUID(), productId: newProduct.id, snapshotId: s.snapshot!.id, quantity: '1', optionIds: [] }] });
      const next = engine!.state('owner-pos'); assert.equal(next.preview!.total, '201');
      await engine!.execute('owner-pos', 'sale.charge', { operationId: randomUUID(), orderId: next.order.id, revision: next.order.revision, payment: { method: 'nequi', received: '201' } });
      assert.equal(engine!.store.shift()!.expected, '812'); await engine!.sync(); assert.equal(engine!.store.pending().length, 0);
    });
    await t.test('Siete días y retroceso de reloj bloquean cobros; permiten consulta, pedido y cierre', async () => {
      offline = true; offset = -60_000; assert.equal(engine!.state('owner-pos').canCharge, false);
      offset = WEEK_MS + 1000; assert.equal(engine!.state('owner-pos').canCharge, false);
      await assert.rejects(engine!.execute('owner-pos', 'shift.open', { operationId: randomUUID(), openingCash: '0' }), /siete días/);
      const s = engine!.state('owner-pos'); await engine!.saveOrder('owner-pos', { ...s.order, lines: [] });
      await engine!.execute('owner-pos', 'shift.close', { operationId: randomUUID(), counted: '800' }); assert.equal(engine!.store.shift(), null); assert.equal(engine!.store.pending().length, 1);
      engine!.close(); engine = await openEngine(); await engine.login('owner-pos', password); assert.equal(engine.state('owner-pos').canCharge, false); assert.equal(engine.store.pending().length, 1);
    });
    await t.test('Permisos, acuse ajeno, hash, secuencia y revocación preservan los pendientes', async () => {
      const milan = (await req('GET', '/api/branches/milan')).json();
      const user = await req('POST', '/api/users', { name: 'Cajero Sintético', login: 'cashier-pos', password, role: 'cashier', branchIds: ['milan'], reason: 'Prueba de revocación' }); assert.equal(user.statusCode, 201, user.body);
      offline = false;
      const second = await PosEngine.open(join(directory, 'terminal-milan'), 'http://127.0.0.1:4330', { request });
      try {
        await assert.rejects(second.login('cashier-pos', password), /dueño/);
        await second.login('owner-pos', password); await second.enroll(milan.devices[0].id, 'owner-pos'); await second.login('cashier-pos', password);
        await second.execute('cashier-pos', 'shift.open', { operationId: randomUUID(), openingCash: '0' });
        await assert.rejects(second.execute('owner-pos', 'shift.close', { operationId: randomUUID(), counted: '0' }), /pertenece/);
        const pending = second.store.pending()[0]!; const signed = second.vault.data.grants[pending.signedId]!;
        second.store.mark(pending, { kind: 'accepted', receipt: { ...pending.operation, payloadHash: '0'.repeat(64) } }); assert.equal(second.store.pending().length, 1);
        const send = (operation: typeof pending.operation, payload = pending.payload, proof = signed) => app.inject({ method: 'POST', url: '/api/pos/sync', headers: { host: '127.0.0.1:4330', 'x-nativos-request': '1', 'x-pos-token': second.vault.data.terminal!.token }, payload: { operation, payload, signed: proof } });
        assert.equal((await send({ ...pending.operation, payloadHash: '0'.repeat(64) })).statusCode, 422);
        assert.equal((await send({ ...pending.operation, sequence: 2, previousOperationId: randomUUID() })).statusCode, 409);
        assert.equal((await send({ ...pending.operation, branchId: 'centro' })).statusCode, 403);
        assert.equal((await send(pending.operation, pending.payload, { ...signed, document: signed.document.replace('Cajero', 'Intruso') })).statusCode, 403);
        await second.sync(); assert.equal(second.store.pending().length, 0);
        assert.equal(second.state('cashier-pos').snapshot!.serverSequence, pending.operation.sequence);
        assert.equal(second.state('cashier-pos').snapshot!.serverOperationId, pending.operation.operationId);
        assert.equal((await send({ ...pending.operation, operationId: randomUUID() })).json().code, 'sequence_conflict');
        const altered = pending.payload.replace('"openingCash":"0"', '"openingCash":"1"'); const alteredResponse = await send({ ...pending.operation, payloadHash: payloadHash(altered) }, altered); assert.equal(alteredResponse.statusCode, 409); assert.equal(alteredResponse.json().code, 'operation_conflict');
        const state = second.state('cashier-pos'); await second.saveOrder('cashier-pos', { ...state.order, lines: [{ id: randomUUID(), productId, snapshotId: state.snapshot!.id, quantity: '1', optionIds: [] }] });
        const order = second.state('cashier-pos').order; await second.execute('cashier-pos', 'sale.charge', { operationId: randomUUID(), orderId: order.id, revision: order.revision, payment: { method: 'cash', received: '1000' } });
        const users = (await req('GET', '/api/users')).json().items; const cashier = users.find((u: { login: string }) => u.login === 'cashier-pos');
        assert.equal((await req('PATCH', '/api/users/' + cashier.id, { active: false, reason: 'Prueba de revocación' })).statusCode, 200);
        await second.sync(); assert.equal(second.store.pending().length, 0); assert.throws(() => second.state('cashier-pos'), /autorizado/);
        assert.equal((await db.pool.query("SELECT review_required FROM pos_sales WHERE branch_id='milan'")).rows[0].review_required, true);
        assert.equal((await req('PATCH', '/api/users/' + cashier.id, { active: true, reason: 'Reactivar prueba' })).statusCode, 200); await second.login('cashier-pos', password);
        await second.execute('cashier-pos', 'shift.close', { operationId: randomUUID(), counted: '999' });
        assert.equal((await req('PATCH', '/api/branches/milan/devices/' + milan.devices[0].id, { active: false, reason: 'Revocar equipo de prueba' })).statusCode, 200);
        await second.sync(); assert.equal(second.store.pending().length, 1); assert.equal(second.store.pending()[0]!.state, 'reconciliation_required'); assert.throws(() => second.state('cashier-pos'), /autorizado/);
      } finally { second.close(); }
    });
  } finally { engine?.close(); await app.close(); await db.stop(); }
});
