// Reproducible browser acceptance, using only synthetic data in a fresh local database.
// Run after npm run build. This never connects to the hosted site or existing local DBs.
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startLocalPostgres, freePort } from './local-postgres.ts';
import { migrate } from '../src/server/db.ts';
import { createApp } from '../src/server/app.ts';
import { excelFixture } from '../tests/excel-fixture.ts';

const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
const root = resolve('output/playwright', `acceptance-${runId}`);
await mkdir(root, { recursive: true });
const directory = resolve('.local', `test-${randomUUID()}`);
const db = await startLocalPostgres(directory, { password: randomBytes(32).toString('hex') });
const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
await migrate(db.pool);
const app = await createApp({ pool: db.pool, origin, staticRoot: resolve('dist'), backupDirectory: join(directory, 'backups'), backupRestoreDatabase: 'uat_restore_check', backupRestoreConnection: db.connection });
await app.listen({ host: '127.0.0.1', port });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const serverErrors: { path: string; status: number; code: string; message: string }[] = [];
context.on('response', async response => {
  if (response.status() >= 400 && response.url().includes('/api/')) {
    const body = await response.json().catch(() => ({}));
    serverErrors.push({path: new URL(response.url()).pathname, status: response.status(), code: body.code ?? '', message: body.message ?? ''});
  }
});
const password = randomBytes(24).toString('base64url');
let cookie = ''; const cases: { id: string; name: string; state: string; detail: string; seconds: number }[] = [];
const common = () => ({ branchId: 'centro', operationId: randomUUID(), reason: 'PRUEBA UAT aislada' });
async function req(method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) {
  const result = await app.inject({ method, url, ...(payload ? { payload } : {}), headers: { host: `127.0.0.1:${port}`, 'x-nativos-request': '1', cookie } });
  assert.ok(result.statusCode < 400, `${method} ${url}: ${result.statusCode} ${result.body}`);
  return result;
}
async function login(p: Page, login: string) {
  await p.goto(origin); await p.getByLabel('Usuario', { exact: true }).fill(login);
  await p.getByLabel('Contraseña', { exact: true }).fill(password);
  await p.getByRole('button', { name: 'Entrar a Nativos', exact: true }).click();
  await expect(p.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
}
async function nav(name: string, p = page) {
  const navigation = p.getByRole('navigation');
  if (!await navigation.isVisible()) await p.getByRole('button', { name: /Mostrar navegación|Menú de Caja/ }).click();
  await navigation.getByRole('button', { name, exact: true }).click();
}
async function admin(name: string, p = page) {
  await p.goto(origin); await expect(p.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
  await p.getByLabel('Sucursal', { exact: true }).selectOption('centro'); await nav(name, p);
}
async function pos() { await page.goto(`${origin}/caja`); await expect(page.getByRole('button', { name: 'Sincronizar', exact: true })).toBeVisible(); await nav('Venta'); }
async function sync() { await page.getByRole('button', { name: 'Sincronizar', exact: true }).click(); await expect(page.locator('.pos-sync')).toContainText('0 pendientes'); }
const dialog = () => page.getByRole('dialog');
async function save(name: string) { await dialog().getByRole('button', { name, exact: true }).click(); await expect(dialog()).not.toBeVisible(); }
async function newOrder() { await pos(); await page.getByRole('button', { name: '+ Nuevo pedido', exact: true }).click(); }
async function add(name: string, quantity = '1') {
  await page.getByRole('button').filter({ hasText: name }).click();
  await dialog().getByLabel('Cantidad', { exact: true }).fill(quantity);
}
async function charge(amount: string, method = 'cash') {
  await page.getByRole('button', { name: 'Cobrar pedido', exact: true }).click();
  await dialog().getByLabel('Medio de pago 1').selectOption(method);
  await dialog().getByLabel('Importe 1 (COP)').fill(amount);
  await dialog().getByRole('button', { name: 'Confirmar cobro', exact: true }).click();
  await expect(dialog().getByRole('heading', { name: 'Comprobante interno' })).toBeVisible();
}
async function stock(id: string, warehouse = 'centro-venta') {
  const rows = (await req('GET', `/api/warehouses/${warehouse}/stock?branchId=${warehouse.startsWith('milan')?'milan':'centro'}&limit=100`)).json().items;
  return Number(rows.find((r: { itemId: string }) => r.itemId === id).quantity);
}
async function saleCount() { return (await db.pool.query('SELECT count(*)::int AS n FROM pos_sales')).rows[0].n as number; }
async function run(id: string, name: string, fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn(); await page.screenshot({ path: join(root, `${id}.png`), fullPage: true });
    cases.push({ id, name, state: 'PASS', detail, seconds: (Date.now() - started) / 1000 }); console.log(`${id} PASS ${name}`);
  } catch (error) {
    const detail = (error as Error).message.replaceAll(password, '[redacted]');
    await page.screenshot({ path: join(root, `${id}-failure.png`), fullPage: true }).catch(() => {});
    await writeFile(join(root, `${id}-failure.txt`), (await page.locator('body').innerText()).replaceAll(password, '[redacted]'));
    cases.push({ id, name, state: 'FAIL', detail, seconds: (Date.now() - started) / 1000 }); console.log(`${id} FAIL ${name}: ${detail.slice(0, 500)}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
  await writeFile(join(root, 'results.json'), JSON.stringify({ runId, origin, synthetic: true, cases }, null, 2));
}
function zipXml(data: Buffer, target: string) {
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 18), nameSize = data.readUInt16LE(offset + 26), extraSize = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameSize).toString(); const start = offset + 30 + nameSize + extraSize;
    if (name === target) return inflateRawSync(data.subarray(start, start + size)).toString(); offset = start + size;
  }
  throw new Error(`Missing XLSX entry ${target}`);
}
try {
  const setup = await req('POST', '/api/setup', { name: 'PRUEBA UAT Dueño', login: 'uat-owner', password });
  cookie = `nativos_session=${setup.cookies[0]!.value}`;
  for (const role of ['cashier', 'manager']) await req('POST', '/api/users', { name: `PRUEBA UAT ${role}`, login: `uat-${role}`, password, role, branchIds: ['centro'], reason: 'Identidades sintéticas aisladas' });
  const items: Record<string, string> = {};
  for (const [key, unit, amount, kind] of [['P', 'g', '1000', 'raw'], ['L', 'ml', '2000', 'raw'], ['L2', 'ml', '1000', 'raw'], ['V', 'unit', '10', 'consumable'], ['A', 'g', '200', 'raw']]) {
    const item = (await req('POST', '/api/items', { ...common(), name: `PRUEBA ${key}`, reference: `UAT-${key}`, kind, baseUnit: unit })).json(); items[key!] = item.id;
    await req('POST', '/api/warehouses/centro-venta/initial', { ...common(), itemId: item.id, quantity: amount, unit, conversion: null, unitCost: null });
  }
  const product = async (name: string, type: string, price: string) => (await req('POST', '/api/products', { ...common(), name: `PRUEBA ${name}`, reference: `UAT-${name}`, type, category: 'UAT', unit: 'unit', presentation: '12 oz', price, tax: null, description: 'Solo ensayo aislado' })).json();
  const finished = await product('T', 'finished', '5000');
  await req('POST', '/api/warehouses/centro-venta/initial', { ...common(), itemId: finished.id, quantity: '10', unit: 'unit', conversion: null, unitCost: null });
  const prepared = await product('B', 'prepared', '10000');
  const line = (id: string, key: string, quantity: string, unit: string, kind = 'ingredient') => ({ id, itemId: items[key], quantity, unit, kind, conversion: null });
  await req('POST', `/api/products/${prepared.id}/recipes`, { ...common(), name: 'PRUEBA receta B', state: 'active', expectedActiveVersion: 0, instructions: 'Ensayo', lines: [line('p', 'P', '100', 'g'), line('l', 'L', '200', 'ml'), line('v', 'V', '1', 'unit', 'packaging')], options: [
    { id: 'sub', name: 'Sustituir L por L2', kind: 'substitution', replacesLineId: 'l', price: '2000', line: line('sub-l', 'L2', '200', 'ml') },
    { id: 'extra', name: 'Agregar A', kind: 'addition', replacesLineId: null, price: '1000', line: line('extra-a', 'A', '20', 'g') }
  ] });
  await login(page, 'uat-owner'); await page.goto(`${origin}/caja`);
  await expect(page.getByRole('heading', { name: 'Activa esta caja' })).toBeVisible();
  if (await page.getByLabel('Contraseña para habilitar Caja sin conexión').isVisible()) await page.getByLabel('Contraseña para habilitar Caja sin conexión').fill(password);
  await page.getByLabel('Equipo', { exact: true }).selectOption('centro-caja'); await page.getByRole('button', { name: 'Activar caja', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir turno', exact: true }).click(); await dialog().getByLabel('Base de efectivo (COP)').fill('150000'); await save('Confirmar apertura');

  await run('B02', 'Terminado, cambio, consulta de copia y consumo único', async () => {
    await add('PRUEBA T', '2'); await save('Guardar en pedido'); await charge('20000');
    await expect(dialog()).toContainText('10.000'); await expect(dialog()).toContainText('Sin impuesto asignado');
    await page.keyboard.press('Escape'); await sync(); assert.equal(await stock(finished.id), 8); assert.equal(await saleCount(), 1);
    const sale = (await db.pool.query('SELECT data FROM pos_sales')).rows[0].data; assert.equal(sale.cashApplied, '10000'); assert.equal(sale.change, '10000');
    await nav('Comprobantes'); await page.getByRole('button', { name: 'Ver copia', exact: true }).click(); await expect(dialog()).toContainText('10.000'); assert.equal(await saleCount(), 1);
    await page.keyboard.press('Escape'); return 'T 10→8; efectivo neto 10000; cambio 10000; una venta después de copia/sincronización.';
  });
  await run('B03', 'Comanda, sustitución y adicional con consumo exacto', async () => {
    await newOrder(); await add('PRUEBA B'); await dialog().getByLabel(/Sustituir L por L2/).check(); await dialog().getByLabel(/Agregar A/).check(); await dialog().getByLabel('Notas de preparación').fill('NOTA UAT SIN HIELO'); await save('Guardar en pedido');
    await page.getByRole('button', { name: 'Enviar a preparación', exact: true }).click(); await sync(); assert.equal(await stock(items.P!), 1000);
    await nav('Comandas'); await expect(page.locator('#pos-main')).toContainText('NOTA UAT SIN HIELO'); await expect(page.locator('#pos-main')).toContainText('Sustituir L por L2');
    await nav('Venta'); await charge('13000'); await page.keyboard.press('Escape'); await sync();
    assert.deepEqual(await Promise.all(['P','L','L2','V','A'].map(k=>stock(items[k]!))), [900,2000,800,9,180]);
    return 'Comanda sin consumo. Cobro13000: P900 L2000 L2 800 V9 A180.';
  });
  await run('B06', 'Cliente, domicilio, descuento, propina y canje: total 21800', async () => {
    await newOrder(); await add('PRUEBA B', '2'); await dialog().getByLabel('Tipo de descuento').selectOption('percent'); await dialog().getByLabel('Descuento', { exact: true }).fill('10'); await save('Guardar en pedido');
    await page.getByRole('button', { name: '+ Nuevo cliente', exact: true }).click(); await dialog().getByLabel('Nombre del cliente').fill('PRUEBA Cliente UAT'); await dialog().getByLabel('Documento', { exact: true }).fill('UAT-SINTETICO'); await dialog().getByLabel('Celular').fill('0000000000'); await save('Guardar y seleccionar cliente');
    await expect(page.getByRole('region', { name: 'Pedido' })).toContainText('2 × PRUEBA B');
    await page.getByRole('button', { name: 'Datos del pedido', exact: true }).click(); await dialog().getByLabel('Atención').selectOption('delivery'); await dialog().getByLabel('Dirección del domicilio').fill('Dirección ficticia de ensayo'); await dialog().getByLabel('Envío pendiente (COP)').fill('3000'); await save('Guardar pedido');
    await admin('Fidelización'); await page.getByRole('button', { name: 'Inscribir · PRUEBA Cliente UAT', exact: true }).click(); await page.getByRole('button', { name: 'Ajustar puntos · PRUEBA Cliente UAT', exact: true }).click(); await dialog().getByLabel('Puntos a sumar o restar').fill('500'); await dialog().getByLabel('Motivo del cambio').fill('Saldo sintético UAT'); await save('Registrar ajuste');
    await pos(); await sync(); await page.getByRole('button', { name: 'Cobrar pedido', exact: true }).click(); await dialog().getByLabel('Tipo de propina').selectOption('percent'); await dialog().getByLabel('Propina voluntaria').fill('10'); await dialog().locator('summary').filter({ hasText: 'Puntos de este cliente' }).click(); await dialog().getByLabel('Puntos a canjear').fill('100');
    await dialog().getByLabel('Importe 1 (COP)').fill('21800'); await expect(dialog()).toContainText('21.800'); await expect(dialog()).toContainText('Puntos de esta compra: 17');
    await dialog().getByRole('button', { name: 'Confirmar cobro', exact: true }).click(); await expect(dialog().getByRole('heading', { name: 'Comprobante interno' })).toBeVisible(); await page.screenshot({ path: join(root, 'B06-receipt.png'), fullPage: true }); await page.keyboard.press('Escape'); await sync();
    const row = (await db.pool.query("SELECT data FROM pos_sales WHERE data->>'total'='21800'")).rows[0]; assert.ok(row); assert.equal(row.data.tipPaid,'1800'); assert.equal(row.data.shippingPaid,'3000'); assert.equal(row.data.loyalty.earnedPoints,'17');
    await admin('Fidelización'); await expect(page.getByText('417 puntos', { exact: true })).toBeVisible(); return 'Pedido preservado al crear cliente. Total21800, propina1800, envío3000, 17 puntos; saldo417.';
  });
  await run('B08', 'Cancelar tres preparados: dos desperdiciados y uno sin consumo', async () => {
    const before = await stock(items.P!); const count = await saleCount(); await newOrder(); await add('PRUEBA B','3'); await save('Guardar en pedido'); await page.getByRole('button',{name:'Enviar a preparación',exact:true}).click();
    await page.getByRole('button',{name:'Quitar PRUEBA B',exact:true}).click(); await dialog().getByLabel('Unidades a cancelar').fill('3'); await dialog().getByLabel('De estas, ya preparadas').fill('2'); await dialog().getByLabel('Motivo',{exact:true}).fill('PRUEBA dos preparadas, una pendiente'); await save('Confirmar cancelación'); await sync();
    assert.equal(await stock(items.P!),before-200); assert.equal(await saleCount(),count); await sync(); assert.equal(await stock(items.P!),before-200); return 'Consumo por desperdicio200g, sin venta; reintento de sync no duplica.';
  });
  await run('B17', 'Archivar/restaurar conserva ventas y existencias', async () => {
    const before = await stock(finished.id); const sales = (await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows;
    await admin('Productos'); await page.getByRole('button',{name:'Archivar PRUEBA T',exact:true}).click(); await expect(page.getByRole('button',{name:'Restaurar PRUEBA T',exact:true})).toBeVisible(); await expect(page.getByRole('button',{name:'Editar PRUEBA T',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Restaurar PRUEBA T',exact:true}).click(); await expect(page.getByRole('button',{name:'Editar PRUEBA T',exact:true})).toBeVisible(); assert.equal(await stock(finished.id),before); assert.deepEqual((await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows,sales); return 'Archivo y restauración por UI; saldo e historia de ventas idénticos.';
  });
  await run('B20', 'Conciliación de costo desconocido con historia conservada', async () => {
    const before = (await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows; const amount=await stock(items.P!);
    await admin('Inventario'); const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'PRUEBA P',exact:true,level:2})}); await expect(card).toContainText('Pendiente');
    await page.getByRole('button',{name:'Conciliar costo · PRUEBA P',exact:true}).click(); await dialog().getByLabel('Costo por g (COP)',{exact:true}).fill('2'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA conciliación sin recalcular historia'); await save('Guardar registro');
    await expect(card).toContainText('Costo por g: $ 2'); assert.equal(await stock(items.P!),amount); assert.deepEqual((await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows,before); return 'Costo actual2; sin cambio de existencias ni ventas previas.';
  });
  await run('B15-T', 'Conteo físico y consumo interno de producto terminado', async () => {
    await admin('Conteos y ajustes'); await page.getByRole('button',{name:'+ Registrar conteo',exact:true}).click(); await expect(dialog().getByRole('combobox',{name:'Artículo 1',exact:true})).toContainText('PRUEBA T (unit)'); const options=await dialog().getByRole('combobox',{name:'Artículo 1',exact:true}).locator('option').allTextContents(); assert.ok(options.includes('PRUEBA T (unit)'), 'Producto terminado PRUEBA T no aparece en los artículos contables del formulario');
    await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA T (unit)'}); await dialog().getByLabel('Cantidad contada').fill('7'); await dialog().getByLabel('Motivo del cambio').fill('Conteo sintético terminado'); await save('Confirmar conteo'); assert.equal(await stock(finished.id),7);
    const sales=await saleCount(); await page.getByRole('button',{name:'+ Consumo interno',exact:true}).click(); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA T (unit)'}); await dialog().getByLabel('Cantidad consumida').fill('1'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA consumo terminado'); await save('Registrar consumo'); assert.equal(await stock(finished.id),6); assert.equal(await saleCount(),sales); return 'Conteo terminado8→7; consumo interno1→saldo6, sin venta.';
  });
  await run('B14-T', 'Traslado de producto terminado', async () => {
    const before=await stock(finished.id), destination=await stock(finished.id,'milan-venta');
    await admin('Traslados'); await page.getByRole('button',{name:'+ Nuevo traslado',exact:true}).click(); await expect(dialog().getByRole('combobox',{name:'Artículo 1',exact:true})).toContainText('PRUEBA T (unit)'); const options=await dialog().getByRole('combobox',{name:'Artículo 1',exact:true}).locator('option').allTextContents(); assert.ok(options.includes('PRUEBA T (unit)'), 'Producto terminado PRUEBA T no aparece en los artículos trasladables');
    await dialog().getByLabel('Origen').selectOption('centro-venta'); await dialog().getByLabel('Destino').selectOption('milan-venta'); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA T (unit)'}); await dialog().getByLabel('Cantidad',{exact:true}).fill('2'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA traslado terminado'); await save('Guardar borrador');
    await page.getByRole('button',{name:'Gestionar',exact:true}).first().click(); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA despacho terminado'); await save('Despachar traslado'); assert.equal(await stock(finished.id),before-2); assert.equal(await stock(finished.id,'milan-venta'),destination);
    for(let part=1;part<=2;part++) {await page.getByRole('button',{name:'Gestionar',exact:true}).first().click(); await dialog().getByLabel('Recibir ahora').fill('1'); await dialog().getByLabel('Motivo del cambio').fill(`PRUEBA recepción terminado ${part}`); await save('Registrar recepción'); assert.equal(await stock(finished.id,'milan-venta'),destination+part);}
    return 'Terminado despachado2; origen -2, destino +1 y +1; conciliación por sede.';
  });
  await page.keyboard.press('Escape');
  await run('B19', 'Excel descarga todas las filas, además de las veinte visibles', async () => {
    const actor=(await db.pool.query("SELECT id FROM app_users WHERE login='uat-owner'")).rows[0].id; const now=new Date();
    // Volume fixture only: these are closed synthetic shifts, not claimed UI-created operations.
    for(let i=0;i<120;i++) await db.pool.query('INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at,closed_at,expected,counted,difference) VALUES($1,$2,$3,$4,$5,$6,$6,$5,$5,$5)',[`uat-volume-${i.toString().padStart(3,'0')}`,'centro-caja','centro',actor,'0',now]);
    await admin('Informes'); await page.getByRole('combobox',{name:'Informe',exact:true}).selectOption('cash'); await expect(page.getByRole('button',{name:'Aplicar filtros',exact:true})).toBeEnabled(); await expect(page.getByRole('row')).toHaveCount(21);
    const pending=page.waitForEvent('download'); await page.getByRole('button',{name:'Exportar Excel',exact:true}).click(); const file=await pending; const path=join(root,'caja-exportada.xlsx'); await file.saveAs(path);
    const xml=zipXml(await readFile(path),'xl/worksheets/sheet2.xml'); const rowCount=(xml.match(/<row /g)??[]).length-1; const expected=(await db.pool.query('SELECT count(*)::int AS n FROM pos_shifts')).rows[0].n+(await db.pool.query('SELECT count(*)::int AS n FROM pos_cash_movements')).rows[0].n; assert.equal(rowCount,expected); assert.ok(rowCount>120);
    return `Pantalla20 filas; Excel${rowCount} filas completas en Contexto/Datos/Totales. Fixture volumétrica preparada, descarga por UI.`;
  });
  await run('BX01', 'Importación Excel: vista previa, alta y referencia duplicada', async () => {
    const path=join(root,'catalogo-sintetico.xlsx'); await writeFile(path,await excelFixture()); const before=(await db.pool.query('SELECT count(*)::int AS n FROM catalog_products')).rows[0].n;
    await admin('Productos'); await page.getByRole('button',{name:'Importar Excel',exact:true}).click(); await dialog().getByLabel('Archivo Excel (.xlsx, máximo 5 MB)').setInputFiles(path); await dialog().getByLabel('Motivo de la importación').fill('PRUEBA UAT archivo sintético'); await dialog().getByRole('button',{name:'Validar archivo',exact:true}).click(); await expect(dialog()).toContainText('Archivo válido'); assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM catalog_products')).rows[0].n,before);
    await dialog().getByRole('button',{name:/Confirmar importación/}).click(); await expect(dialog()).toContainText('Importación completada: 2 productos, 1 recetas y 2 insumos'); await dialog().getByRole('button',{name:'Cerrar',exact:true}).click(); assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM catalog_products')).rows[0].n,before+2);
    await page.getByRole('button',{name:'Importar Excel',exact:true}).click(); await dialog().getByLabel('Archivo Excel (.xlsx, máximo 5 MB)').setInputFiles(path); await dialog().getByLabel('Motivo de la importación').fill('PRUEBA duplicado no debe ingresar'); await dialog().getByRole('button',{name:'Validar archivo',exact:true}).click(); await expect(dialog()).toContainText('Corrige los errores'); assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM catalog_products')).rows[0].n,before+2); await page.keyboard.press('Escape'); return 'Vista previa sin altas; confirmación2 productos/1receta/2insumos; duplicado rechazado sin nuevas altas.';
  });
  await run('B21', 'Cajero y encargado: restricciones visibles y compras de su sede', async () => {
    for(const role of ['cashier','manager']) {
      const ctx=await browser.newContext({viewport:{width:1440,height:1000}}); const p=await ctx.newPage();
      try {await login(p,`uat-${role}`); const branches=await p.getByLabel('Sucursal',{exact:true}).locator('option').allTextContents(); assert.ok(branches.includes('Centro')); assert.ok(!branches.includes('Milán'));
        await nav('Inventario',p); await expect(p.getByRole('button',{name:/Conciliar costo/})).toHaveCount(0); await expect(p.getByText(/Costo por/)).toHaveCount(0);
        await nav('Fidelización',p); await expect(p.getByRole('button',{name:/Ajustar puntos/})).toHaveCount(0); await expect(p.getByRole('button',{name:'Cambiar reglas',exact:true})).toHaveCount(0);
        await nav('Compras y proveedores',p);
        if(role==='cashier') await expect(p.getByRole('button',{name:'+ Registrar compra',exact:true})).toHaveCount(0);
        else { await p.getByRole('button',{name:'+ Proveedor',exact:true}).click(); const d=p.getByRole('dialog'); await d.getByLabel('Nombre',{exact:true}).fill('PRUEBA proveedor UAT'); await d.getByLabel('Motivo del cambio').fill('Alta sintética proveedor'); await d.getByRole('button',{name:'Guardar proveedor',exact:true}).click(); await expect(d).not.toBeVisible();
          await p.getByRole('button',{name:'+ Registrar compra',exact:true}).click(); await d.getByRole('combobox',{name:'Proveedor',exact:true}).selectOption({label:'PRUEBA proveedor UAT'}); const options=await d.getByRole('combobox',{name:'Artículo 1',exact:true}).locator('option').allTextContents();
          await writeFile(join(root,'purchase-options.json'),JSON.stringify(options)); await d.getByLabel('Artículo 1').selectOption({label:'PRUEBA P (g)'}); await d.getByLabel('Cantidad 1').fill('1000'); await expect(d.getByLabel('Unidad 1',{exact:true})).toHaveValue('g'); await d.getByLabel('Precio unitario 1 (COP)').fill('2'); await d.getByLabel('Importe pagado (debe coincidir con las líneas)').fill('2000'); await d.getByLabel('Motivo del cambio').fill('Compra sintética 1kg'); const before=await stock(items.P!); await d.getByRole('button',{name:'Registrar compra',exact:true}).click(); await expect(d).not.toBeVisible(); assert.equal(await stock(items.P!),before+1000);
        } await p.screenshot({path:join(root,`B21-${role}.png`),fullPage:true});
      } finally {await ctx.close();}
    }
    return 'Roles limitados a Centro sin costos/ajustes de puntos. Encargado compra1000g en unidad base; cajero sin acción de compra.';
  });
  await run('B13-T', 'Compra de producto terminado', async () => {
    await admin('Compras y proveedores'); await page.getByRole('button',{name:'+ Registrar compra',exact:true}).click();
    await expect(dialog().getByRole('combobox',{name:'Artículo 1',exact:true}).locator('option')).not.toHaveCount(1);
    await expect(dialog().getByRole('combobox',{name:'Artículo 1',exact:true})).toContainText('PRUEBA T (unit)'); const options=await dialog().getByRole('combobox',{name:'Artículo 1',exact:true}).locator('option').allTextContents();
    assert.ok(options.includes('PRUEBA T (unit)'), 'Producto terminado PRUEBA T no aparece en los artículos comprables');
    const before=await stock(finished.id); await dialog().getByRole('combobox',{name:'Proveedor',exact:true}).selectOption({label:'PRUEBA proveedor UAT'}); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA T (unit)'}); await dialog().getByLabel('Cantidad 1').fill('3'); await dialog().getByLabel('Precio unitario 1 (COP)').fill('2000'); await dialog().getByLabel('Importe pagado (debe coincidir con las líneas)').fill('6000'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA compra terminado'); await save('Registrar compra'); assert.equal(await stock(finished.id),before+3);
    return 'Compra de3 terminados por6000; entrada exacta3 unidades.';
  });
  await page.keyboard.press('Escape');
  await run('B14-R', 'Insumo: despacho, dos recepciones y rechazo del exceso', async () => {
    const before=await stock(items.L!); const destination=await stock(items.L!,'milan-venta');
    await admin('Traslados'); await page.getByRole('button',{name:'+ Nuevo traslado',exact:true}).click();
    await dialog().getByRole('combobox',{name:'Origen',exact:true}).selectOption('centro-venta');
    await dialog().getByRole('combobox',{name:'Destino',exact:true}).selectOption('milan-venta');
    await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA L (ml)'}); await dialog().getByLabel('Cantidad',{exact:true}).fill('10'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA traslado entre sedes'); await save('Guardar borrador');
    await page.getByRole('article').filter({hasText:'de 10 unidades base'}).getByRole('button',{name:'Gestionar',exact:true}).click(); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA despacho'); await save('Despachar traslado');
    assert.equal(await stock(items.L!),before-10); assert.equal(await stock(items.L!,'milan-venta'),destination);
    await page.getByRole('article').filter({hasText:'de 10 unidades base'}).getByRole('button',{name:'Gestionar',exact:true}).click(); await dialog().getByLabel('Recibir ahora').fill('6'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA recepción parcial'); await save('Registrar recepción');
    assert.equal(await stock(items.L!,'milan-venta'),destination+6);
    await page.getByRole('article').filter({hasText:'de 10 unidades base'}).getByRole('button',{name:'Gestionar',exact:true}).click(); await dialog().getByLabel('Recibir ahora').fill('5'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA exceso debe rechazarse');
    const rejection=page.waitForResponse(r=>r.url().endsWith('/receive')); await dialog().getByRole('button',{name:'Registrar recepción',exact:true}).click(); assert.ok((await rejection).status()>=400); assert.equal(await stock(items.L!,'milan-venta'),destination+6);
    await dialog().getByLabel('Recibir ahora').fill('4'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA recepción final'); await save('Registrar recepción');
    assert.equal(await stock(items.L!),before-10); assert.equal(await stock(items.L!,'milan-venta'),destination+10); await expect(page.getByText('Recibido: 10 de 10 unidades base',{exact:true})).toBeVisible();
    return 'Salida10; entrada6+4; intento excedente5 cuando faltaban4 rechazado, sin movimiento.';
  });
  await run('B15-R', 'Insumo: conteo causal y consumo interno sin venta', async () => {
    const before=await stock(items.A!); const sales=await saleCount(); await admin('Conteos y ajustes');
    await page.getByRole('button',{name:'+ Registrar conteo',exact:true}).click(); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA A (g)'}); await dialog().getByLabel('Cantidad contada').fill(String(before-2)); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA diferencia física -2g'); await save('Confirmar conteo'); assert.equal(await stock(items.A!),before-2);
    await page.getByRole('button',{name:'+ Consumo interno',exact:true}).click(); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA A (g)'}); await dialog().getByLabel('Cantidad consumida').fill('2'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA consumo interno 2g'); await save('Registrar consumo'); assert.equal(await stock(items.A!),before-4); assert.equal(await saleCount(),sales);
    return `A ${before}→${before-2} por conteo→${before-4} por consumo interno; sin venta.`;
  });
  await run('B16', 'Venta con existencia negativa y alerta', async () => {
    await admin('Conteos y ajustes'); await page.getByRole('button',{name:'+ Registrar conteo',exact:true}).click(); await dialog().getByLabel('Artículo 1').selectOption({label:'PRUEBA P (g)'}); await dialog().getByLabel('Cantidad contada').fill('50'); await dialog().getByLabel('Motivo del cambio').fill('PRUEBA saldo insuficiente permitido'); await save('Confirmar conteo');
    await newOrder(); await sync(); await add('PRUEBA B'); await save('Guardar en pedido'); await charge('10000'); await page.keyboard.press('Escape'); await sync(); assert.equal(await stock(items.P!),-50); await expect(page.locator('body')).toContainText('Inventario negativo'); await sync(); assert.equal(await stock(items.P!),-50);
    return 'P50g; venta consume100g; saldo-50g, alerta visible, sin doble consumo al sincronizar.';
  });
  await run('B12', 'Retiro, contrapartida y cierre offline con diferencia', async () => {
    await pos(); await sync(); await nav('Turno'); await expect(page.locator('.pos-shift')).toContainText('204.800');
    async function movement(kind:string,amount:string,reason:string) {await page.getByRole('button',{name:'Registrar ingreso o salida',exact:true}).click(); await dialog().getByLabel('Clase').selectOption(kind); await dialog().getByLabel('Importe (COP)').fill(amount); await dialog().getByLabel('Motivo',{exact:true}).fill(reason); await save('Registrar movimiento');}
    await movement('withdrawal','50000','PRUEBA retiro50000'); await expect(page.locator('.pos-shift')).toContainText('154.800');
    await movement('expense','1000','PRUEBA gasto a corregir'); await expect(page.locator('.pos-shift')).toContainText('153.800');
    await page.getByRole('article').filter({hasText:'PRUEBA gasto a corregir'}).getByRole('button',{name:'Corregir',exact:true}).click(); await dialog().getByLabel('Motivo',{exact:true}).fill('PRUEBA contrapartida gasto'); await save('Registrar contrapartida'); await expect(page.locator('.pos-shift')).toContainText('154.800');
    await context.setOffline(true);
    try { await expect(page.getByRole('button',{name:'Registrar ingreso o salida',exact:true})).toBeDisabled({timeout:20000}); await page.getByRole('button',{name:'Cerrar turno',exact:true}).click(); await dialog().getByLabel('Efectivo contado (COP)').fill('148800'); await save('Confirmar cierre'); await expect(page.locator('.pos-shift')).toContainText('148.800'); await expect(page.locator('.pos-shift')).toContainText('6.000'); }
    finally {await context.setOffline(false);}
    await sync(); const shift=(await db.pool.query("SELECT expected,counted,difference FROM pos_shifts WHERE id NOT LIKE 'uat-volume-%'")).rows[0]; assert.deepEqual(Object.fromEntries(Object.entries(shift).map(([key,value])=>[key,Number(value)])),{expected:154800,counted:148800,difference:-6000});
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pos_cash_movements')).rows[0].n,3);
    return 'Base150000+cobros54800-retiro50000=154800; gasto1000 y contrapartida conservados; contado148800, diferencia-6000. Cierre offline sincronizado, movimientos offline bloqueados.';
  });
  await run('B18', 'Informes: catálogos completos, filtro y Excel fuera de la primera página', async () => {
    // Volume fixtures only; navigation, selection, report and download use the browser.
    for(let n=0;n<250;n++) {
      const id=`000-volume-${String(n).padStart(3,'0')}`;
      const data={...finished,id,name:`PRUEBA volumen ${n}`,reference:`VOL-${n}`};
      await db.pool.query("INSERT INTO catalog_products(id,reference,kind,current_version) VALUES($1,$2,'finished',1)",[id,data.reference]);
      await db.pool.query('INSERT INTO product_versions(product_id,version,data) VALUES($1,1,$2)',[id,data]);
    }
    const client=(await db.pool.query('SELECT data FROM customers LIMIT 1')).rows[0].data;
    for(let n=0;n<119;n++) {
      const id=`volume-client-${String(n).padStart(3,'0')}`;
      await db.pool.query('INSERT INTO customers(id,document_key,data) VALUES($1,$1,$2)',[id,{...client,id,name:`PRUEBA cliente volumen ${n}`,document:id}]);
    }
    for(let n=0;n<119;n++) await req('POST','/api/suppliers',{...common(),name:`PRUEBA proveedor volumen ${n}`,document:'',contact:''});
    await req('POST','/api/suppliers',{...common(),branchId:'milan',name:'PRUEBA proveedor exclusivo Milán',document:'',contact:''});
    assert.ok(!(await req('GET','/api/products?branchId=centro&limit=100')).json().items.some((p:{id:string})=>p.id===finished.id));
    await admin('Informes'); await expect(page.getByRole('combobox',{name:'Producto',exact:true}).locator('option')).toHaveCount(255); await expect(page.getByRole('combobox',{name:'Cliente',exact:true}).locator('option')).toHaveCount(121);
    await page.getByRole('combobox',{name:'Producto',exact:true}).selectOption(finished.id); await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click(); await expect(page.getByRole('row')).toHaveCount(2); await expect(page.locator('.report-results')).toContainText('10.000');
    const pending=page.waitForEvent('download'); await page.getByRole('button',{name:'Exportar Excel',exact:true}).click(); const downloaded=await pending; const path=join(root,'producto-fuera-primera-pagina.xlsx'); await downloaded.saveAs(path); const xml=zipXml(await readFile(path),'xl/worksheets/sheet2.xml'); assert.equal((xml.match(/<row /g)??[]).length-1,1);
    await page.screenshot({path:join(root,'B18-producto-fuera-primera-pagina.png'),fullPage:true});
    await page.getByRole('combobox',{name:'Informe',exact:true}).selectOption('purchases'); await expect(page.getByRole('combobox',{name:'Proveedor',exact:true}).locator('option')).toHaveCount(121);
    await page.getByRole('combobox',{name:'Proveedor',exact:true}).selectOption({label:'PRUEBA proveedor UAT'}); await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click(); await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByLabel('Sucursal',{exact:true}).selectOption('milan'); await expect(page.getByRole('combobox',{name:'Informe',exact:true})).toHaveValue('sales'); await expect(page.getByRole('combobox',{name:'Producto',exact:true})).toHaveValue('');
    await page.getByRole('combobox',{name:'Informe',exact:true}).selectOption('purchases'); await expect(page.getByRole('combobox',{name:'Proveedor',exact:true}).locator('option')).toHaveCount(2); await expect(page.getByRole('combobox',{name:'Proveedor',exact:true})).toHaveValue(''); await expect(page.locator('.report-results')).toContainText('No hay registros');
    return '254 productos,120 clientes,120 proveedores Centro; producto fuera de página100 filtra una venta y exporta una fila; Milán solo muestra su proveedor, sin filtro anterior.';
  });
  await run('B24', 'Crear, verificar y restaurar respaldo aislado desde navegador', async () => {
    const before=(await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows;
    await admin('Respaldo y recuperación'); await page.getByRole('button',{name:'Crear respaldo',exact:true}).click(); await expect(page.getByText(/Respaldo lógico local creado/)).toBeVisible(); await page.getByRole('button',{name:'Verificar',exact:true}).click(); await expect(page.getByText('Integridad verificada con SHA-256.',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Ensayar restauración',exact:true}).click(); const confirm=await dialog().locator('code').innerText(); await expect(dialog().getByRole('button',{name:'Restaurar y conciliar',exact:true})).toBeDisabled(); await dialog().getByRole('textbox').fill(confirm); const restoredResponse=page.waitForResponse(r=>r.url().endsWith('/restore-check')); await dialog().getByRole('button',{name:'Restaurar y conciliar',exact:true}).click(); const restored=await restoredResponse; assert.equal(restored.status(),200,await restored.text()); const reconciliation=await restored.json(); assert.ok(reconciliation.tables.every((row:{contentMatches:boolean})=>row.contentMatches)); assert.ok(reconciliation.tables.some((row:{table:string;sourceRows:number})=>row.table==='inventory_cost_reconciliations'&&row.sourceRows===1)); await writeFile(join(root,'restoration-reconciliation.json'),JSON.stringify(reconciliation,null,2)); await expect(page.getByText(/Restauración aislada conciliada en/)).toBeVisible(); assert.deepEqual((await db.pool.query('SELECT id,data FROM pos_sales ORDER BY id')).rows,before); return 'Respaldo y SHA-256 verificados; restauración aislada conciliada; ventas activas sin cambios. No acredita PITR Railway.';
  });
} finally {
  await writeFile(join(root,'server-errors.json'),JSON.stringify(serverErrors,null,2));
  const postgresLog = await readFile(join(directory,'postgres.log'),'utf8');
  await writeFile(join(root,'database-errors.txt'),postgresLog.split('\n').filter(line=>/ERROR:|DETAIL:/.test(line)).join('\n'));
  await writeFile(join(root,'results.json'),JSON.stringify({runId,origin,synthetic:true,cases},null,2));
  console.log(`EVIDENCE ${root}`); console.log(`RESULT ${cases.filter(c=>c.state==='PASS').length} passed / ${cases.filter(c=>c.state==='FAIL').length} failed`);
  await browser.close(); await app.close(); await db.stop();
}
if(cases.some(c=>c.state==='FAIL')) process.exitCode=1;
