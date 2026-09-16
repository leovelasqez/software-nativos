import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';

function zipEntry(file: Buffer, target: string) { let offset = 0; while (file.readUInt32LE(offset) === 0x04034b50) { const size = file.readUInt32LE(offset + 18); const nameSize = file.readUInt16LE(offset + 26); const extraSize = file.readUInt16LE(offset + 28); const name = file.subarray(offset + 30, offset + 30 + nameSize).toString(); const start = offset + 30 + nameSize + extraSize; if (name === target) return inflateRawSync(file.subarray(start, start + size)).toString(); offset = start + size; } throw new Error('Entrada XLSX no encontrada.'); }

test('AC-008-01/03 — informe pagina 20 y Excel conserva 120 filas autorizadas', { timeout: 120_000 }, async () => {
  const db = await startLocalPostgres(resolve('.local/reports-test-' + randomUUID()), { password: randomBytes(32).toString('hex') }); const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4350' });
  try {
    await migrate(db.pool); const password = randomBytes(24).toString('base64url'); const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { name: 'Dueño Informes', login: 'owner-reports', password }, headers: { host: '127.0.0.1:4350', 'x-nativos-request': '1' } }); assert.equal(setup.statusCode, 201, setup.body); const cookie = `nativos_session=${setup.cookies[0]!.value}`;
    const actor = (await db.pool.query("SELECT id FROM app_users WHERE login='owner-reports'")).rows[0].id; const now = new Date();
    for (let index = 0; index < 120; index++) await db.pool.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [`shift-${String(index).padStart(3, '0')}`, 'centro-caja', 'centro', actor, '0', now, now, String(index), String(index), '0']);
    const headers = { host: '127.0.0.1:4350', cookie }; const page = await app.inject({ method: 'GET', url: '/api/reports/cash?branchId=centro&limit=20', headers }); assert.equal(page.statusCode, 200, page.body); assert.equal(page.json().items.length, 20); assert.ok(page.json().nextCursor);
    const exported = await app.inject({ method: 'GET', url: '/api/reports/cash/export?branchId=centro', headers }); assert.equal(exported.statusCode, 200, exported.body); assert.match(String(exported.headers['content-type']), /spreadsheetml/); const data = Buffer.from(exported.rawPayload); assert.equal(data.subarray(0, 2).toString(), 'PK'); const worksheet = zipEntry(data, 'xl/worksheets/sheet2.xml'); assert.equal((worksheet.match(/<row /g) ?? []).length, 121);
  } finally { await app.close(); await db.stop(); }
});

test('AC-008-02/04 — ventas filtra producto, cliente y medio; devolución conserva conceptos separados', { timeout: 120_000 }, async () => {
  const db = await startLocalPostgres(resolve('.local/reports-filters-test-' + randomUUID()), { password: randomBytes(32).toString('hex') }); const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4351' });
  try {
    await migrate(db.pool); const password = randomBytes(24).toString('base64url'); const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { name: 'Dueño Informes', login: 'owner-report-filters', password }, headers: { host: '127.0.0.1:4351', 'x-nativos-request': '1' } }); assert.equal(setup.statusCode, 201, setup.body); const cookie = `nativos_session=${setup.cookies[0]!.value}`;
    const actor = (await db.pool.query("SELECT id FROM app_users WHERE login='owner-report-filters'")).rows[0].id; const now = new Date(); const nowMs = now.getTime();
    await db.pool.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', ['report-shift', 'centro-caja', 'centro', actor, '0', now, now, '0', '0', '0']);
    const sale = { id: 'report-sale', customer: { id: 'customer-report' }, lines: [{ productId: 'product-report' }], products: '1000', discount: '100', loyalty: { redeemedAmount: '25' }, tipPaid: '50', shippingPaid: '75', cashApplied: '500', payments: [{ method: 'cash', applied: '500' }, { method: 'nequi', applied: '500' }] };
    await db.pool.query('INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', ['report-sale', 'report-order', 'report-shift', 'centro-caja', 'centro', actor, 'report-receipt', JSON.stringify(sale), '500', now, false]);
    const refund = { total: '200', tip: '10', shipping: '20', cashApplied: '-50', payments: [{ method: 'nequi', received: '150' }], occurredAtMs: nowMs };
    await db.pool.query('INSERT INTO pos_refunds(id,sale_id,shift_id,data,cash_applied) VALUES($1,$2,$3,$4,$5)', ['report-refund', 'report-sale', 'report-shift', JSON.stringify(refund), '-50']);
    const headers = { host: '127.0.0.1:4351', cookie }; const result = await app.inject({ method: 'GET', url: '/api/reports/sales?branchId=centro&productId=product-report&customerId=customer-report&paymentMethod=nequi', headers }); assert.equal(result.statusCode, 200, result.body); const body = result.json(); assert.equal(body.items.length, 2); assert.deepEqual(body.items.map((item: { kind: string }) => item.kind).sort(), ['refund', 'sale']); assert.deepEqual(body.totals, { products: '1000', discounts: '100', redemption: '25', tips: '40', shipping: '55', refunds: '200', cash: '450', digital: '350' });
    const invalid = await app.inject({ method: 'GET', url: '/api/reports/sales?branchId=centro&supplierId=supplier-report', headers }); assert.equal(invalid.statusCode, 400, invalid.body);
    const cashierPassword = randomBytes(24).toString('base64url'); const cashier = await app.inject({ method: 'POST', url: '/api/users', payload: { name: 'Cajero informes', login: 'cashier-report-filters', password: cashierPassword, role: 'cashier', branchIds: ['centro'], reason: 'Permiso sintético de informes' }, headers: { ...headers, 'x-nativos-request': '1' } }); assert.equal(cashier.statusCode, 201, cashier.body);
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { login: 'cashier-report-filters', password: cashierPassword }, headers: { host: '127.0.0.1:4351', 'x-nativos-request': '1' } }); assert.equal(login.statusCode, 200, login.body); const cashierHeaders = { host: '127.0.0.1:4351', cookie: `nativos_session=${login.cookies[0]!.value}` };
    const cashierReport = await app.inject({ method: 'GET', url: '/api/reports/sales?branchId=centro&paymentMethod=nequi', headers: cashierHeaders }); assert.equal(cashierReport.statusCode, 200, cashierReport.body); assert.doesNotMatch(cashierReport.body, /cost|margin/i);
    const cashierExport = await app.inject({ method: 'GET', url: '/api/reports/sales/export?branchId=centro&paymentMethod=nequi', headers: cashierHeaders }); assert.equal(cashierExport.statusCode, 200, cashierExport.body); assert.doesNotMatch(Buffer.from(cashierExport.rawPayload).toString('utf8'), /cost|margin/i);
  } finally { await app.close(); await db.stop(); }
});
