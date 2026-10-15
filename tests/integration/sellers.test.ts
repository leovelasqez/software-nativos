import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { payloadHash } from '../../src/pos-crypto.ts';
import { upgradeOrder, emptyLine } from '../../src/orders-domain.ts';
import type { OrderEvent, SaleV2 } from '../../src/orders-domain.ts';
import type { Operation } from '../../src/contracts.ts';
import type { Signed, Snapshot, PosEvent } from '../../src/pos-domain.ts';

test('REQ-020 — vendedores, comisiones y sincronización transaccional en PostgreSQL real', { timeout: 240_000 }, async t => {
  const db = await startLocalPostgres(resolve('.local/test-sellers-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  await migrate(db.pool);
  const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4356' });
  const password = randomBytes(24).toString('base64url'); let cookie = '', token = '';
  const req = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => app.inject({ method, url,
    headers: { host: '127.0.0.1:4356', cookie, 'x-nativos-request': '1', 'x-pos-token': token }, ...(payload ? { payload } : {}) });
  const common = () => ({ operationId: randomUUID(), reason: 'Configuración sintética de vendedores' });
  let sellerA: { id: string; version: number }, sellerB: { id: string; version: number }, productId = '', actorId = '';
  let signed: Signed, snapshot: Snapshot, sequence = 0, previousOperationId: string | null = null;
  let first: SaleV2, second: SaleV2;
  const authorize = async (sellerSupport = true) => {
    const r = await req('POST', '/api/pos/authorize', { deviceId: 'centro-caja', previous: null, ...(sellerSupport ? { sellerSupport } : {}) });
    assert.equal(r.statusCode, 200, r.body); return r.json() as { signed: Signed; snapshot: Snapshot };
  };
  const send = async (event: OrderEvent | PosEvent, version: Operation['payloadVersion']) => {
    const payload = JSON.stringify(event); const operation: Operation = { version: 1, operationId: randomUUID(), deviceId: 'centro-caja',
      branchId: 'centro', actorId, sequence: sequence + 1, previousOperationId, payloadHash: payloadHash(payload), payloadVersion: version };
    const body = { operation, payload, signed };
    const result = await req('POST', '/api/pos/sync', body);
    if (result.statusCode === 200) { sequence++; previousOperationId = operation.operationId; }
    return { result, body, id: operation.operationId };
  };
  try {
    const setup = await req('POST', '/api/setup', { name: 'Caja compartida sintética', login: 'seller-owner', password });
    assert.equal(setup.statusCode, 201, setup.body); actorId = setup.json().actorId; cookie = `nativos_session=${setup.cookies[0]!.value}`;
    await t.test('AC-020-01: administración, idempotencia, versión optimista y auditoría', async () => {
      const body = { ...common(), name: 'Ana sintética', active: true, branchIds: ['centro'] };
      const a = await req('POST', '/api/sellers', body); assert.equal(a.statusCode, 200, a.body); sellerA = a.json();
      assert.deepEqual((await req('POST', '/api/sellers', body)).json(), sellerA);
      assert.equal((await req('POST', '/api/sellers', { ...body, name: 'Contenido distinto' })).statusCode, 409);
      const b = await req('POST', '/api/sellers', { ...common(), name: 'Luis sintético', active: true, branchIds: ['centro'] });
      assert.equal(b.statusCode, 200, b.body); sellerB = b.json();
      assert.equal((await req('POST', '/api/sellers', { ...common(), name: 'Otro local', active: true, branchIds: ['milan'] })).statusCode, 200);
      const bad = await req('PATCH', '/api/sellers/' + sellerA.id, { ...common(), name: 'Conflicto', active: true, branchIds: ['centro'], expectedVersion: 99 });
      assert.equal(bad.statusCode, 409);
      assert.equal((await req('GET', '/api/sellers?branchId=centro')).json().items.length, 2);
      assert.equal((await db.pool.query("SELECT count(*) FROM audit_events WHERE action='seller.created'")).rows[0].count, '3');
      const p = await req('POST', '/api/products', { ...common(), branchId: 'centro', type: 'finished', name: 'Producto sintético', reference: 'SELLER-PRODUCT',
        category: 'Pruebas', presentation: 'Unidad', unit: 'unit', price: '10000', tax: null, description: '' });
      assert.equal(p.statusCode, 200, p.body); productId = p.json().id;
      const config = { ...common(), expectedVersion: 0, amount: '1000' };
      const commission = await req('POST', '/api/seller-commissions/' + productId, config); assert.equal(commission.statusCode, 200, commission.body);
      assert.deepEqual((await req('POST', '/api/seller-commissions/' + productId, config)).json(), commission.json());
      assert.equal((await req('POST', '/api/seller-commissions/' + productId, { ...common(), expectedVersion: 0, amount: '2000' })).statusCode, 409);
    });
    await t.test('AC-020-01/07: permisos y negociación de snapshot con cliente anterior', async () => {
      const ownerCookie = cookie;
      assert.equal((await req('POST', '/api/users', { name: 'Cajero sintético', login: 'seller-cashier', password, role: 'cashier', branchIds: ['centro'], reason: 'Prueba permisos' })).statusCode, 201);
      const login = await req('POST', '/api/login', { login: 'seller-cashier', password }); cookie = `nativos_session=${login.cookies[0]!.value}`;
      assert.equal((await req('GET', '/api/sellers?branchId=centro')).statusCode, 200);
      assert.equal((await req('GET', '/api/sellers?branchId=milan')).statusCode, 403);
      assert.equal((await req('POST', '/api/sellers', { ...common(), name: 'No autorizado', active: true, branchIds: ['centro'] })).statusCode, 403);
      assert.equal((await req('GET', '/api/seller-commissions')).statusCode, 403);
      assert.equal((await req('POST', '/api/seller-commissions/' + productId, { ...common(), expectedVersion: 1, amount: '500' })).statusCode, 403);
      assert.equal((await req('GET', '/api/reports/sellers?branchId=milan')).statusCode, 403);
      cookie = ownerCookie;
      const enrollment = await req('POST', '/api/pos/enroll', { deviceId: 'centro-caja', installationId: randomUUID() });
      assert.equal(enrollment.statusCode, 200, enrollment.body); token = enrollment.json().token;
      assert.equal((await authorize(false)).snapshot.sellers, undefined);
      ({ signed, snapshot } = await authorize());
      assert.equal(snapshot.sellers!.length, 2); assert.equal(snapshot.commissions![0]!.amount, '1000');
    });
    const shiftId = randomUUID();
    await t.test('AC-020-02/03: dos vendedores, misma cuenta/turno, división y respuesta perdida', async () => {
      assert.equal((await send({ kind: 'shift.open', shiftId, openingCash: '0', occurredAtMs: Date.now() }, 1)).result.statusCode, 200);
      const order = { ...upgradeOrder({ id: randomUUID(), revision: 0, snapshotId: snapshot.id, lines: [] }),
        lines: [{ ...emptyLine({ id: randomUUID(), productId, snapshotId: snapshot.id, quantity: '2', optionIds: [] }), discount: { kind: 'percent' as const, value: '10' } }] };
      assert.equal((await send({ kind: 'order.save', order, shiftId: null, occurredAtMs: Date.now() }, 2)).result.statusCode, 200);
      const event = { kind: 'sale.split' as const, orderId: order.id, revision: 1, selection: [{ lineId: order.lines[0]!.id, quantity: '1' }],
        sellerId: sellerA.id, sellerSnapshotId: snapshot.id, customerId: null, tip: { kind: 'amount' as const, value: '100' }, shipping: '0',
        payments: [{ method: 'cash' as const, received: '9100' }], shiftId, occurredAtMs: Date.now() };
      const invalid = await send({ ...event, sellerId: 'unknown' }, 4); assert.equal(invalid.result.statusCode, 422, invalid.result.body);
      const forged = { ...event, commissionAmount: '999999', sellerName: 'Suplantación sintética' };
      assert.equal((await send(forged, 4)).result.statusCode, 422);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count, '0');
      const a = await send(event, 4); assert.equal(a.result.statusCode, 200, a.result.body);
      assert.deepEqual((await req('POST', '/api/pos/sync', a.body)).json(), a.result.json());
      first = (await db.pool.query('SELECT data FROM pos_sales WHERE id=$1', [a.id])).rows[0].data;
      const b = await send({ ...event, revision: 2, sellerId: sellerB.id, tip: { kind: 'amount', value: '200' }, payments: [{ method: 'cash', received: '9200' }] }, 4);
      assert.equal(b.result.statusCode, 200, b.result.body); second = (await db.pool.query('SELECT data FROM pos_sales WHERE id=$1', [b.id])).rows[0].data;
      assert.equal(first.commissionAmount, '900'); assert.equal(second.sellerId, sellerB.id);
      const saved = (await db.pool.query('SELECT actor_id,shift_id FROM pos_sales')).rows;
      assert.ok(saved.every(row => row.actor_id === actorId && row.shift_id === shiftId));
      assert.equal(saved.length, 2); assert.equal((await db.pool.query("SELECT sum(quantity)::text AS q FROM inventory_movements WHERE kind='sale'")).rows[0].q, '-2.000000');
    });
    await t.test('AC-020-04/05: cambios no recalculan historia y devolución conserva vendedor', async () => {
      const edit = await req('PATCH', '/api/sellers/' + sellerA.id, { ...common(), name: 'Ana renombrada', active: false, branchIds: ['milan'], expectedVersion: 1 });
      assert.equal(edit.statusCode, 200, edit.body);
      assert.equal((await req('POST', '/api/seller-commissions/' + productId, { ...common(), expectedVersion: 1, amount: '5000' })).statusCode, 200);
      assert.equal((await authorize()).snapshot.sellers!.length, 1);
      const result = await send({ kind: 'sale.refund', saleId: first.id, lines: [{ lineId: first.lines[0]!.id, quantity: '1', recoverable: true }],
        tip: '50', shipping: '0', payments: [{ method: 'cash', received: '9050' }], reason: 'Devolución sintética', occurredAtMs: Date.now(), shiftId }, 4);
      assert.equal(result.result.statusCode, 200, result.result.body);
      assert.equal((await req('POST', '/api/pos/sync', result.body)).statusCode, 200);
      const refund = (await db.pool.query('SELECT data FROM pos_refunds')).rows[0].data;
      assert.equal(refund.sellerId, sellerA.id); assert.equal(refund.sellerName, 'Ana sintética'); assert.equal(refund.commissionAmount, '900');
      assert.equal((await db.pool.query('SELECT data FROM pos_sales WHERE id=$1', [first.id])).rows[0].data.commissionAmount, '900');
    });
    await t.test('AC-020-06: resumen, filtros y Excel con todas las filas', async () => {
      const report = await req('GET', '/api/reports/sellers?branchId=centro&limit=1'); assert.equal(report.statusCode, 200, report.body);
      assert.equal(report.json().items.length, 1); assert.ok(report.json().nextCursor);
      assert.deepEqual(report.json().totals, { products: '9000', tips: '250', shipping: '0', commissionKnown: '900', commissionPending: '0' });
      const filtered = await req('GET', '/api/reports/sellers?branchId=centro&sellerId=' + sellerA.id);
      assert.equal(filtered.statusCode, 200, filtered.body);
      const a = filtered.json().items[0]; assert.equal(a.products, '0'); assert.equal(a.tips, '50'); assert.equal(a.commissionAmount, '0');
      const options = await req('GET', '/api/seller-options?branchId=centro'); assert.equal(options.statusCode, 200, options.body);
      assert.ok(options.json().items.some((item: {id:string}) => item.id === sellerA.id), 'Historical sellers remain filterable after reassignment');
      const b = (await req('GET', '/api/reports/sellers?branchId=centro&sellerId=' + sellerB.id)).json().items[0];
      assert.equal(b.products, '9000'); assert.equal(b.tips, '200'); assert.equal(b.commissionAmount, '900');
      const sales = await req('GET', '/api/reports/sales?branchId=centro&sellerId=' + sellerA.id); assert.equal(sales.json().items.length, 2);
      const excel = await req('GET', '/api/reports/sellers/export?branchId=centro&limit=1'); assert.equal(excel.statusCode, 200, excel.body);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(excel.rawPayload as never);
      assert.equal(workbook.getWorksheet('Datos')!.rowCount, 3);
      assert.match(JSON.stringify(workbook.getWorksheet('Datos')!.getSheetValues()), /Ana sintética/);
      await migrate(db.pool);
      assert.equal((await db.pool.query('SELECT count(*) FROM pos_sales')).rows[0].count, '2');
    });
  } finally { await app.close(); await db.stop(); }
});
