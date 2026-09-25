import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { Ajv2020 } from 'ajv/dist/2020.js';
import contract from '../../contracts/catalog-inventory-v1.json' with { type: 'json' };
import lifecycleContract from '../../contracts/catalog-lifecycle-v1.json' with { type: 'json' };
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';

test('Incremento 2 — catálogo, recetas y existencias en PostgreSQL real', { timeout: 180_000 }, async t => {
  const directory = resolve(`.local/test-${randomUUID()}`); const password = randomBytes(24).toString('base64url'); const dbPassword = randomBytes(32).toString('hex');
  let db = await startLocalPostgres(directory, { password: dbPassword });
  let app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4310' });
  let owner = ''; let manager = ''; let cashier = ''; let warehouse = ''; let productId = ''; let finishedId = ''; let rawId = ''; let milkId = ''; let moveId = '';
  type ResponseDefinition = { content: { 'application/json': { schema: object } } } | { $ref: string };
  type ContractDocument = { paths: Record<string, Record<string, { responses: Record<string, ResponseDefinition> }>>; components?: { responses?: Record<string, { content: { 'application/json': { schema: object } } }> } };
  const documents = [contract, lifecycleContract] as unknown as ContractDocument[];
  const contractPaths = Object.assign({}, ...documents.map(document => document.paths)) as ContractDocument['paths'];
  const ajv = new Ajv2020({ strict: false }); const validators = new Map<string, ReturnType<typeof ajv.compile>>();
  for (const document of documents) for (const [path, methods] of Object.entries(document.paths)) for (const [method, op] of Object.entries(methods)) for (const [status, response] of Object.entries(op.responses)) {
    const resolved = '$ref' in response ? document.components?.responses?.[response.$ref.split('/').at(-1)!] : response;
    if (resolved) validators.set(`${method} ${path} ${status}`, ajv.compile(resolved.content['application/json'].schema));
  }
  const req = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object, cookie = owner) => {
    const r = await app.inject({ method, url, ...(payload ? { payload } : {}), headers: { host: '127.0.0.1:4310', 'x-nativos-request': '1', cookie } });
    const requestPath = url.split('?')[0]!; const path = Object.keys(contractPaths).find(p => p === requestPath) ?? Object.keys(contractPaths).find(p => new RegExp('^' + p.replaceAll(/\{[^}]+\}/g, '[^/]+') + '$').test(requestPath));
    if (path) { const validate = validators.get(`${method.toLowerCase()} ${path} ${r.statusCode}`); assert.ok(validate, r.body); assert.ok(validate(r.json()), JSON.stringify(validate.errors)); }
    return r;
  };
  const common = () => ({ branchId: 'centro', operationId: randomUUID(), reason: 'Verificación sintética incremento 2' });
  const product = () => ({ ...common(), type: 'prepared', name: 'Batido sintético', reference: 'PREP-TEST', category: 'Pruebas', presentation: '12 onzas', unit: 'unit', price: '12500', tax: null, description: 'No es receta operativa' });
  const recipe = (state = 'active', quantity: string | null = '100', expectedActiveVersion = 0) => ({ ...common(), name: 'Receta sintética', instructions: 'Prueba', state, expectedActiveVersion,
    lines: [{ id: 'line-1', itemId: milkId, quantity, unit: 'ml', conversion: null, kind: 'ingredient' }], options: [] });
  try {
    await migrate(db.pool); await migrate(db.pool);
    const setup = await req('POST', '/api/setup', { name: 'Prueba Dueño', login: 'owner-catalog', password }, '');
    assert.equal(setup.statusCode, 201); owner = `nativos_session=${setup.cookies[0]!.value}`;
    for (const role of ['manager', 'cashier']) {
      assert.equal((await req('POST', '/api/users', { name: `Prueba ${role}`, login: `catalog-${role}`, password, role, branchIds: ['centro'], reason: 'Prueba de permisos' })).statusCode, 201);
      const r = await req('POST', '/api/login', { login: `catalog-${role}`, password }, '');
      if (role === 'manager') manager = `nativos_session=${r.cookies[0]!.value}`; else cashier = `nativos_session=${r.cookies[0]!.value}`;
    }
    warehouse = (await req('GET', '/api/branches/centro')).json().warehouses[0].id;
    await t.test('AC-002-06: cajero crea producto sin impuesto, datos completos, idempotencia concurrente', async () => {
      const body = product(); const replies = await Promise.all([req('POST', '/api/products', body, cashier), req('POST', '/api/products', body, cashier)]);
      assert.deepEqual(replies.map(r => r.statusCode), [200, 200]); assert.deepEqual(replies[0]!.json(), replies[1]!.json());
      const p = replies[0]!.json(); productId = p.id; assert.equal(p.tax, null); assert.equal(p.sellable, false);
      assert.equal((await req('POST', '/api/products', { ...body, name: 'Distinto' }, cashier)).statusCode, 409);
      assert.equal((await req('POST', '/api/products', body, manager)).statusCode, 409);
      assert.equal((await req('POST', '/api/products', { ...product(), operationId: randomUUID(), reference: 'MISSING', price: undefined }, cashier)).statusCode, 400);
      assert.equal((await req('GET', '/api/products?branchId=milan', undefined, cashier)).statusCode, 403);
      assert.equal((await req('GET', '/api/products?branchId=centro', undefined, '')).statusCode, 401);
    });
    await t.test('AC-002-06/07: edición optimista conserva precio/impuesto histórico, terminado crea artículo', async () => {
      const { type: _, ...body } = product();
      const edited = await req('PUT', `/api/products/${productId}`, { ...body, expectedVersion: 1, price: '13500', tax: { label: 'Tasa sintética cero', rate: '0', exempt: false } }, cashier);
      assert.equal(edited.statusCode, 200, edited.body); assert.equal(edited.json().version, 2);
      assert.equal((await req('PUT', `/api/products/${productId}`, { ...body, expectedVersion: 1 }, cashier)).statusCode, 409);
      const history = (await req('GET', `/api/products/${productId}/versions?branchId=centro&limit=1`)).json(); assert.equal(history.items[0].price, '12500'); assert.equal(history.items[0].tax, null); assert.equal(history.nextCursor, '1');
      const second = (await req('GET', `/api/products/${productId}/versions?branchId=centro&after=1`)).json(); assert.equal(second.items[0].tax.rate, '0');
      const finished = await req('POST', '/api/products', { ...product(), type: 'finished', reference: 'FIN-TEST' }, cashier); assert.equal(finished.statusCode, 200); assert.equal(finished.json().sellable, true); finishedId = finished.json().id;
      assert.ok((await req('GET', '/api/items?branchId=centro')).json().items.some((i: { id: string }) => i.id === finished.json().id));
    });
    await t.test('AC-013-01/02/03/04: archivado reversible, idempotente y sin borrar historia', async () => {
      const body = { ...common(), expectedVersion: 1 };
      const archived = await req('POST', `/api/products/${finishedId}/archive`, body, cashier); assert.equal(archived.statusCode, 200, archived.body); assert.deepEqual(archived.json(), { id: finishedId, archived: true });
      assert.deepEqual((await req('POST', `/api/products/${finishedId}/archive`, body, cashier)).json(), archived.json());
      assert.ok(!(await req('GET', '/api/products?branchId=centro')).json().items.some((p: { id: string }) => p.id === finishedId));
      assert.ok(!(await req('GET', '/api/items?branchId=centro')).json().items.some((i: { id: string }) => i.id === finishedId));
      assert.ok((await req('GET', '/api/products/archived?branchId=centro')).json().items.some((p: { id: string }) => p.id === finishedId));
      assert.equal((await req('POST', `/api/products/${finishedId}/restore`, { ...common(), expectedVersion: 2 }, cashier)).statusCode, 409);
      const restored = await req('POST', `/api/products/${finishedId}/restore`, { ...common(), expectedVersion: 1 }, cashier); assert.deepEqual(restored.json(), { id: finishedId, archived: false });
      assert.ok((await req('GET', '/api/products?branchId=centro')).json().items.some((p: { id: string }) => p.id === finishedId));
      assert.equal((await db.pool.query('SELECT count(*)::int AS count FROM product_versions WHERE product_id=$1', [finishedId])).rows[0].count, 1);
    });
    await t.test('AC-003-06/08: artículos, permisos y aislamiento de sucursales', async () => {
      const body = { ...common(), name: 'Pulpa sintética', reference: 'RAW-TEST', kind: 'raw', baseUnit: 'g' };
      assert.equal((await req('POST', '/api/items', body, cashier)).statusCode, 403);
      const r = await req('POST', '/api/items', body, manager); assert.equal(r.statusCode, 200); rawId = r.json().id;
      const milk = await req('POST', '/api/items', { ...common(), name: 'Leche sintética', reference: 'MILK-TEST', kind: 'raw', baseUnit: 'ml' }, manager); milkId = milk.json().id;
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=milan`, undefined, manager)).statusCode, 403);
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=milan`)).statusCode, 404);
    });
    await t.test('AC-002-02/07: borrador, activación, conflictos y versiones inmutables', async () => {
      const draft = await req('POST', `/api/products/${productId}/recipes`, recipe('draft', null), cashier); assert.equal(draft.statusCode, 200, draft.body); assert.equal(draft.json().lines[0].baseQuantity, null);
      const bad = await req('POST', `/api/products/${productId}/recipes`, recipe('active', null), cashier); assert.equal(bad.statusCode, 400); assert.match(bad.json().message, /Línea 1/);
      const active = await req('POST', `/api/products/${productId}/recipes`, recipe(), cashier); assert.equal(active.statusCode, 200, active.body); assert.equal(active.json().version, 2); assert.equal(active.json().lines[0].baseQuantity, '100');
      assert.equal((await req('POST', `/api/products/${productId}/recipes`, recipe(), cashier)).statusCode, 409);
      assert.equal((await req('POST', `/api/products/${productId}/recipes`, recipe('draft', null), cashier)).statusCode, 200);
      const p = (await req('GET', '/api/products?branchId=centro')).json().items.find((p: { id: string }) => p.id === productId); assert.equal(p.activeRecipeVersion, 2); assert.equal(p.sellable, true);
      const v4Body = { ...recipe('active', '150', 2), options: [{ id: 'option-1', name: 'Sustitución sintética', kind: 'substitution', replacesLineId: 'line-1', price: '500', line: { id: 'option-line', itemId: rawId, quantity: '0.1', unit: 'kg', conversion: null, kind: 'ingredient' } }] };
      const v4 = await req('POST', `/api/products/${productId}/recipes`, v4Body, cashier); assert.equal(v4.statusCode, 200); assert.equal(v4.json().options[0].line.baseQuantity, '100');
      const versions = (await req('GET', `/api/products/${productId}/recipes?branchId=centro`)).json().items; assert.equal(versions[1].lines[0].baseQuantity, '100'); assert.equal(versions[3].lines[0].baseQuantity, '150');
    });
    await t.test('AC-003-01/06/07: inicial exacto, costo protegido, reintento concurrente y mínimo', async () => {
      const body = { ...common(), itemId: rawId, quantity: '1', unit: 'kg', conversion: null, unitCost: '2.25' };
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/initial`, body, manager)).statusCode, 403);
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/initial`, { ...body, unitCost: null }, cashier)).statusCode, 403);
      const results = await Promise.all([req('POST', `/api/warehouses/${warehouse}/initial`, body), req('POST', `/api/warehouses/${warehouse}/initial`, body)]);
      assert.deepEqual(results.map(r => r.statusCode), [200, 200]); assert.deepEqual(results[0]!.json(), results[1]!.json()); moveId = results[0]!.json().id;
      assert.equal(results[0]!.json().quantity, '1000.000000'); assert.ok(!results[0]!.body.includes('unitCost'));
      assert.deepEqual(results[0]!.json().entry, { quantity: '1', unit: 'kg', conversion: null });
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/initial`, { ...body, ...common() })).statusCode, 409);
      assert.equal((await req('PUT', `/api/warehouses/${warehouse}/minimum`, { ...common(), itemId: rawId, minimum: '1000' }, manager)).statusCode, 200);
      const stock = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, cashier)).json().items.find((i: { itemId: string }) => i.itemId === rawId); assert.equal(stock.quantity, '1000.000000'); assert.equal(stock.low, true); assert.ok(!('unitCost' in stock));
      for (const cookie of [manager, cashier]) { assert.equal((await req('GET', `/api/warehouses/${warehouse}/costs?branchId=centro`, undefined, cookie)).statusCode, 403); assert.equal((await req('GET', `/api/warehouses/${warehouse}/recipe-cost/${productId}?branchId=centro`, undefined, cookie)).statusCode, 403); }
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/costs?branchId=centro`)).json().items.find((i: { itemId: string }) => i.itemId === rawId).unitCost, '2.250000');
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/recipe-cost/${productId}?branchId=centro`)).json().cost, null);
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/initial`, { ...common(), itemId: milkId, quantity: '1', unit: 'l', conversion: null, unitCost: '3' })).statusCode, 200);
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/recipe-cost/${productId}?branchId=centro`)).json().cost, '450');
    });
    await t.test('DEC-005-A: dueño concilia costo sin reescribir inventario ni exponerlo a otros roles', async () => {
      const body = { ...common(), itemId: milkId, unitCost: '4', effectiveFrom: '2020-01-01', reason: 'Conciliación manual con soporte del propietario' };
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/cost-reconciliations`, body, manager)).statusCode, 403);
      const first = await req('POST', `/api/warehouses/${warehouse}/cost-reconciliations`, body); assert.equal(first.statusCode, 200, first.body);
      assert.deepEqual((await req('POST', `/api/warehouses/${warehouse}/cost-reconciliations`, body)).json(), first.json());
      assert.equal(first.json().unitCost, '4.000000'); assert.equal(first.json().effectiveFrom, '2020-01-01');
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/cost-reconciliations?branchId=centro`, undefined, manager)).statusCode, 403);
      const history = await req('GET', `/api/warehouses/${warehouse}/cost-reconciliations?branchId=centro`); assert.equal(history.statusCode, 200); assert.equal(history.json().items.length, 1);
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/costs?branchId=centro`)).json().items.find((i: { itemId: string }) => i.itemId === milkId).unitCost, '4.000000');
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/recipe-cost/${productId}?branchId=centro`)).json().cost, '600');
      assert.equal((await db.pool.query('SELECT count(*) FROM inventory_cost_reconciliations')).rows[0].count, '1');
    });
    await t.test('AC-003-06: reversión relacionada única, nuevo inicial y paginación sin duplicados', async () => {
      const body = { ...common(), movementId: moveId };
      const r = await req('POST', `/api/warehouses/${warehouse}/reversals`, body, manager); assert.equal(r.statusCode, 200); assert.equal(r.json().quantity, '-1000.000000'); assert.equal(r.json().reversesId, moveId);
      assert.deepEqual((await req('POST', `/api/warehouses/${warehouse}/reversals`, body, manager)).json(), r.json());
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/reversals`, { ...body, ...common() }, manager)).statusCode, 409);
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/initial`, { ...common(), itemId: rawId, quantity: '900', unit: 'g', conversion: null, unitCost: null }, manager)).statusCode, 200);
      const first = (await req('GET', `/api/warehouses/${warehouse}/movements?branchId=centro&limit=1`)).json(); assert.ok(first.nextCursor);
      const rest = (await req('GET', `/api/warehouses/${warehouse}/movements?branchId=centro&after=${first.nextCursor}`)).json(); assert.ok(!rest.items.some((i: { id: string }) => i.id === first.items[0].id));
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '900.000000');
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/costs?branchId=centro`)).json().items.find((i: { itemId: string }) => i.itemId === rawId).unitCost, null);
    });
    await t.test('AC-003-09: encargado registra compra pagada idempotente sin exponer margen', async () => {
      const supplierBody = { ...common(), name: 'Proveedor sintético', document: '900123456', contact: 'compras@ejemplo.test' };
      assert.equal((await req('POST', '/api/suppliers', supplierBody, cashier)).statusCode, 403);
      const supplier = await req('POST', '/api/suppliers', supplierBody, manager); assert.equal(supplier.statusCode, 200, supplier.body);
      assert.deepEqual((await req('POST', '/api/suppliers', supplierBody, manager)).json(), supplier.json());
      const before = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity;
      const purchaseBody = { ...common(), supplierId: supplier.json().id, warehouseId: warehouse, purchasedOn: '2026-09-15', paymentMethod: 'transferencia', paidAmount: '7',
        lines: [{ itemId: rawId, quantity: '1', unit: 'kg', conversion: null, unitPrice: '7' }] };
      assert.equal((await req('POST', '/api/purchases', purchaseBody, cashier)).statusCode, 403);
      const replies = await Promise.all([req('POST', '/api/purchases', purchaseBody, manager), req('POST', '/api/purchases', purchaseBody, manager)]);
      assert.deepEqual(replies.map(r => r.statusCode), [200, 200]); assert.deepEqual(replies[0]!.json(), replies[1]!.json());
      assert.equal(replies[0]!.json().lines[0].baseQuantity, '1000');
      const after = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity;
      assert.equal(after, '1900.000000'); assert.equal(before, '900.000000');
      const purchases = await req('GET', '/api/purchases?branchId=centro', undefined, manager); assert.equal(purchases.statusCode, 200); assert.equal(purchases.json().items[0].paidAmount, '7.000000');
      assert.equal((await req('GET', '/api/purchases?branchId=centro', undefined, cashier)).statusCode, 403);
      assert.equal((await db.pool.query("SELECT count(*) FROM inventory_movements WHERE kind='purchase'" )).rows[0].count, '1');
    });
    await t.test('AC-003-10: despacho y recepción parcial no duplican ni exceden el traslado', async () => {
      const target = randomUUID(); await db.pool.query('INSERT INTO warehouses(id,branch_id,name,is_default) VALUES($1,$2,$3,false)', [target, 'centro', 'Bodega sintética destino']);
      const body = { ...common(), sourceWarehouseId: warehouse, targetWarehouseId: target, lines: [{ itemId: rawId, quantity: '1', unit: 'kg', conversion: null }] };
      assert.equal((await req('POST', '/api/transfers', body, cashier)).statusCode, 403);
      const transfer = await req('POST', '/api/transfers', body, manager); assert.equal(transfer.statusCode, 200, transfer.body); const lineId = transfer.json().lines[0].id;
      const dispatch = { ...common() }; const dispatched = await req('POST', `/api/transfers/${transfer.json().id}/dispatch`, dispatch, manager); assert.equal(dispatched.statusCode, 200);
      assert.deepEqual((await req('POST', `/api/transfers/${transfer.json().id}/dispatch`, dispatch, manager)).json(), dispatched.json());
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '900.000000');
      const firstReceipt = { ...common(), lines: [{ lineId, quantity: '400' }] }; assert.equal((await req('POST', `/api/transfers/${transfer.json().id}/receive`, firstReceipt, manager)).statusCode, 200);
      assert.deepEqual((await req('POST', `/api/transfers/${transfer.json().id}/receive`, firstReceipt, manager)).json().received, [{ lineId, quantity: '400' }]);
      assert.equal((await req('GET', `/api/warehouses/${target}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '400.000000');
      assert.equal((await req('POST', `/api/transfers/${transfer.json().id}/receive`, { ...common(), lines: [{ lineId, quantity: '601' }] }, manager)).statusCode, 400);
      assert.equal((await req('POST', `/api/transfers/${transfer.json().id}/receive`, { ...common(), lines: [{ lineId, quantity: '600' }] }, manager)).statusCode, 200);
      assert.equal((await req('GET', `/api/warehouses/${target}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '1000.000000');
      assert.equal((await db.pool.query("SELECT count(*) FROM inventory_movements WHERE kind IN ('transfer_dispatch','transfer_receipt')" )).rows[0].count, '3');
    });
    await t.test('AC-003-11: conteo conserva esperado, contado y ajuste causal sin duplicarlo', async () => {
      const body = { ...common(), lines: [{ itemId: rawId, quantity: '750', unit: 'g', conversion: null }] };
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/counts`, body, cashier)).statusCode, 403);
      const results = await Promise.all([req('POST', `/api/warehouses/${warehouse}/counts`, body, manager), req('POST', `/api/warehouses/${warehouse}/counts`, body, manager)]);
      assert.deepEqual(results.map(r => r.statusCode), [200, 200], results.map(r => r.body).join('\n')); assert.deepEqual(results[0]!.json(), results[1]!.json());
      assert.deepEqual(results[0]!.json().lines, [{ itemId: rawId, expectedQuantity: '900.000000', actualQuantity: '750', difference: '-150' }]);
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '750.000000');
      assert.equal((await db.pool.query("SELECT count(*) FROM inventory_movements WHERE kind='adjustment_out'" )).rows[0].count, '1');
    });
    await t.test('REQ-003-04: consumo interno es una salida causal e idempotente distinta de desperdicio', async () => {
      const body = { ...common(), lines: [{ itemId: rawId, quantity: '50', unit: 'g', conversion: null }] };
      assert.equal((await req('POST', `/api/warehouses/${warehouse}/internal-consumptions`, body, cashier)).statusCode, 403);
      const replies = await Promise.all([req('POST', `/api/warehouses/${warehouse}/internal-consumptions`, body, manager), req('POST', `/api/warehouses/${warehouse}/internal-consumptions`, body, manager)]);
      assert.deepEqual(replies.map(r => r.statusCode), [200, 200]); assert.deepEqual(replies[0]!.json(), replies[1]!.json());
      assert.equal((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`, undefined, manager)).json().items.find((i: { itemId: string }) => i.itemId === rawId).quantity, '700.000000');
      assert.equal((await db.pool.query("SELECT count(*) FROM inventory_movements WHERE kind='internal_consumption'" )).rows[0].count, '1');
    });
    await t.test('NAT-UAT-02: terminados admiten compra, traslado, conteo y consumo con permisos e idempotencia', async () => {
      const supplier = await req('POST', '/api/suppliers', { ...common(), name: 'Proveedor terminados', document: '', contact: '' }, manager);
      assert.equal(supplier.statusCode, 200, supplier.body);
      const purchase = { ...common(), supplierId: supplier.json().id, warehouseId: warehouse, purchasedOn: '2026-09-25', paymentMethod: 'transferencia', paidAmount: '6000', lines: [{ itemId: finishedId, quantity: '3', unit: 'unit', conversion: null, unitPrice: '2000' }] };
      assert.equal((await req('POST', '/api/purchases', purchase, cashier)).statusCode, 403);
      assert.equal((await req('POST', '/api/purchases', { ...purchase, ...common(), lines: [{ ...purchase.lines[0], unit: 'kg' }] }, manager)).statusCode, 400);
      const bought = await req('POST', '/api/purchases', purchase, manager); assert.equal(bought.statusCode, 200, bought.body);
      assert.deepEqual((await req('POST', '/api/purchases', purchase, manager)).json(), bought.json());
      const balance = async (id: string) => Number((await req('GET', `/api/warehouses/${id}/stock?branchId=centro`, undefined, manager)).json().items.find((item: { itemId: string }) => item.itemId === finishedId)?.quantity ?? 0);
      assert.equal(await balance(warehouse), 3);
      const target = randomUUID(); await db.pool.query('INSERT INTO warehouses(id,branch_id,name,is_default) VALUES($1,$2,$3,false)', [target, 'centro', 'Destino terminados']);
      const draft = { ...common(), sourceWarehouseId: warehouse, targetWarehouseId: target, lines: [{ itemId: finishedId, quantity: '2', unit: 'unit', conversion: null }] };
      assert.equal((await req('POST', '/api/transfers', draft, cashier)).statusCode, 403);
      const transfer = await req('POST', '/api/transfers', draft, manager); assert.equal(transfer.statusCode, 200, transfer.body);
      const dispatch = common(); const sent = await req('POST', `/api/transfers/${transfer.json().id}/dispatch`, dispatch, manager); assert.equal(sent.statusCode, 200, sent.body);
      assert.deepEqual((await req('POST', `/api/transfers/${transfer.json().id}/dispatch`, dispatch, manager)).json(), sent.json());
      assert.equal(await balance(warehouse), 1); assert.equal(await balance(target), 0);
      for (let received = 1; received <= 2; received++) {
        const receipt = { ...common(), lines: [{ lineId: transfer.json().lines[0].id, quantity: '1' }] };
        const response = await req('POST', `/api/transfers/${transfer.json().id}/receive`, receipt, manager); assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual((await req('POST', `/api/transfers/${transfer.json().id}/receive`, receipt, manager)).json(), response.json());
        assert.equal(await balance(target), received);
      }
      for (const [action, quantity, expected] of [['counts', '4', 4], ['internal-consumptions', '1', 3]] as const) {
        const body = { ...common(), lines: [{ itemId: finishedId, quantity, unit: 'unit', conversion: null }] };
        const url = `/api/warehouses/${warehouse}/${action}`;
        assert.equal((await req('POST', url, body, cashier)).statusCode, 403);
        const response = await req('POST', url, body, manager); assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual((await req('POST', url, body, manager)).json(), response.json()); assert.equal(await balance(warehouse), expected);
      }
      assert.equal((await db.pool.query('SELECT count(*) FROM inventory_movements WHERE item_id=$1', [finishedId])).rows[0].count, '6');
    });
    await t.test('AC-003-08: auditoría atómica, rollback de datos/idempotencia y libro protegido', async () => {
      await db.pool.query("CREATE FUNCTION fail_catalog_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER fail_catalog_audit BEFORE INSERT ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION fail_catalog_audit();");
      const body = { ...product(), reference: 'ROLLBACK-TEST' };
      try {
        assert.equal((await req('POST', '/api/products', body)).statusCode, 500); assert.equal((await db.pool.query('SELECT 1 FROM catalog_operations WHERE id=$1', [body.operationId])).rowCount, 0); assert.equal((await db.pool.query('SELECT 1 FROM catalog_products WHERE reference=$1', [body.reference])).rowCount, 0);
        const before = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`)).json();
        const milkMove = (await db.pool.query("SELECT id FROM inventory_movements WHERE item_id=$1 AND kind='initial'", [milkId])).rows[0].id;
        assert.equal((await req('POST', `/api/warehouses/${warehouse}/reversals`, { ...common(), movementId: milkMove })).statusCode, 500);
        assert.deepEqual((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`)).json(), before);
      }
      finally { await db.pool.query('DROP TRIGGER fail_catalog_audit ON audit_events; DROP FUNCTION fail_catalog_audit()'); }
      assert.equal((await req('POST', '/api/products', body)).statusCode, 200);
      for (const table of ['inventory_movements', 'recipe_versions', 'product_versions', 'inventory_cost_reconciliations', 'catalog_operations']) for (const sql of [`DELETE FROM ${table}`, `TRUNCATE ${table} CASCADE`]) await assert.rejects(db.pool.query(sql), /history_is_append_only/);
      const events = (await req('GET', '/api/audit?branchId=centro&limit=100')).body; assert.ok(events.includes('operationId')); assert.ok(!events.includes('unitCost'));
    });
    await t.test('AC-003-08: reinicio y restauración de snapshot lógico de pruebas preservan existencias/versiones', async () => {
      const snapshot = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`)).json();
      await app.close(); await db.stop(); db = await startLocalPostgres(directory, { password: dbPassword }); await migrate(db.pool); app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4310' });
      assert.deepEqual((await req('GET', `/api/warehouses/${warehouse}/stock?branchId=centro`)).json(), snapshot);
      // The bundled runtime has no pg_dump. Exercise an explicit logical fixture
      // snapshot/SQL restore into a fresh database; this is not an operational backup.
      const tables = ['branches', 'warehouses', 'devices', 'app_users', 'sessions', 'login_attempts', 'catalog_products', 'product_versions', 'inventory_items', 'recipe_versions', 'suppliers', 'purchases', 'purchase_lines', 'inventory_transfers', 'inventory_transfer_lines', 'inventory_transfer_events', 'inventory_transfer_event_lines', 'inventory_counts', 'inventory_count_lines', 'inventory_internal_consumptions', 'inventory_internal_consumption_lines', 'inventory_movements', 'inventory_minimums', 'inventory_cost_reconciliations', 'catalog_operations', 'audit_events'];
      const snapshotRows: Record<string, Record<string, unknown>[]> = {};
      for (const table of tables) snapshotRows[table] = (await db.pool.query(`SELECT * FROM ${table}`)).rows;
      const dump = join(directory, 'logical-fixture.json'); await writeFile(dump, JSON.stringify(snapshotRows), { mode: 0o600 });
      await db.pool.query('CREATE DATABASE catalog_restore');
      const restoredPool = new Pool({ host: '127.0.0.1', port: db.port, user: 'nativos_local', password: dbPassword, database: 'catalog_restore' });
      await migrate(restoredPool);
      const restoredRows = JSON.parse(await readFile(dump, 'utf8')) as typeof snapshotRows;
      for (const table of tables) {
        const rows = restoredRows[table]!;
        if (table === 'inventory_movements') rows.sort((a, b) => Number(a.kind === 'reversal') - Number(b.kind === 'reversal'));
        for (const row of rows) {
          const columns = Object.keys(row); const values = columns.map(k => typeof row[k] === 'object' && row[k] !== null && !Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k]);
          await restoredPool.query(`INSERT INTO ${table}(${columns.join(',')}) ${table === 'audit_events' ? 'OVERRIDING SYSTEM VALUE' : ''} VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT DO NOTHING`, values);
        }
      }
      await restoredPool.query("SELECT setval(pg_get_serial_sequence('audit_events','id'),(SELECT max(id) FROM audit_events))");
      const restored = await createApp({ pool: restoredPool, origin: 'http://127.0.0.1:4310' });
      try { await migrate(restoredPool); const r = await restored.inject({ method: 'GET', url: `/api/warehouses/${warehouse}/stock?branchId=centro`, headers: { host: '127.0.0.1:4310', cookie: owner } }); assert.deepEqual(r.json(), snapshot); assert.equal((await restoredPool.query('SELECT count(*) FROM recipe_versions')).rows[0].count, '4'); }
      finally { await restored.close(); await restoredPool.end(); }
    });
  } finally { await app.close(); await db.stop(); }
});
