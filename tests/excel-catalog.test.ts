import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogExcel, resolveRecipes } from '../src/server/excel-catalog.ts';
import { excelFixture } from './excel-fixture.ts';
import { catalogTemplate } from '../src/server/excel-template.ts';

test('Excel: all supported sheets, options and base consumption resolve together', async () => {
  const { plan, issues } = await parseCatalogExcel(await excelFixture());
  const rows = resolveRecipes(plan, [], issues); assert.deepEqual(issues, []);
  assert.equal(rows[0]!.recipe!.lines[0]!.baseQuantity, '150');
  assert.equal(rows[0]!.recipe!.options[1]!.line.baseQuantity, '120');
  assert.equal(rows[0]!.recipe!.options[0]!.price, '1000');
  assert.equal(rows[1]!.product.tax!.rate, '19'); assert.equal(rows[1]!.recipe, null);
});
test('Excel: blank styled rows ignored, reordered columns supported, text references preserved', async () => {
  const { plan, issues } = await parseCatalogExcel(await excelFixture(w => {
    const s = w.getWorksheet('Productos')!;
    for (let row = 1; row <= 3; row++) { const a = s.getCell(row, 1).value; s.getCell(row, 1).value = s.getCell(row, 2).value; s.getCell(row, 2).value = a; }
    s.getCell('B3').value = '00123'; s.getCell('A1001').numFmt = '@';
  }));
  assert.deepEqual(issues, []); assert.equal(plan.products.length, 2); assert.equal(plan.products[1]!.value.reference, '00123');
});
test('Excel: detailed cell errors for formulas, missing prices, duplicates and unsupported units', async () => {
  const parsed = await parseCatalogExcel(await excelFixture(w => {
    w.getWorksheet('Productos')!.getCell('F2').value = { formula: '100*80', result: 8000 };
    w.getWorksheet('Productos')!.getCell('A3').value = 'jug-test';
    w.getWorksheet('Ingredientes')!.getCell('E2').value = 'cucharada';
  }));
  resolveRecipes(parsed.plan, [], parsed.issues);
  assert.ok(parsed.issues.some(i => i.sheet === 'Productos' && i.row === 2 && i.field === 'Precio COP'));
  assert.ok(parsed.issues.some(i => i.row === 3 && /repetida/.test(i.message)));
  assert.ok(parsed.issues.some(i => i.sheet === 'Ingredientes' && i.row === 2 && /conversión/.test(i.message)));
});
test('Excel: unknown references, replacement targets and missing ingredient fail', async () => {
  const parsed = await parseCatalogExcel(await excelFixture(w => {
    w.getWorksheet('Ingredientes')!.getCell('C2').value = 'UNKNOWN';
    w.getWorksheet('Opciones')!.getCell('E3').value = 'NOT-A-LINE';
  }));
  resolveRecipes(parsed.plan, [], parsed.issues);
  assert.ok(parsed.issues.some(i => i.field === 'Referencia insumo'));
  const second = await parseCatalogExcel(await excelFixture(w => { w.getWorksheet('Ingredientes')!.getCell('F2').value = 'Empaque'; }));
  resolveRecipes(second.plan, [], second.issues); assert.ok(second.issues.some(i => /al menos un ingrediente/.test(i.message)));
});
test('Excel: wrong template, invalid archive and excessive expanded size are rejected', async () => {
  assert.equal((await parseCatalogExcel(Buffer.from('not excel'))).issues[0]!.sheet, 'Archivo');
  const wrong = await parseCatalogExcel(await excelFixture(w => { w.getWorksheet('Productos')!.name = 'Productos terminados'; }));
  assert.ok(wrong.issues.some(i => i.sheet === 'Productos')); assert.ok(wrong.issues.some(i => i.sheet === 'Productos terminados'));
  const zip = await excelFixture(); const directory = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); assert.ok(directory > 0);
  zip.writeUInt32LE(60 * 1024 * 1024, directory + 24);
  assert.match((await parseCatalogExcel(zip)).issues[0]!.message, /límite/);
});
test('Excel: generated template has supported headers and does not trust reference sheet', async () => {
  const template = await catalogTemplate([{ id: 'real', name: 'Referencia sintética', reference: 'REAL', kind: 'raw', baseUnit: 'g' }]);
  const { plan, issues } = await parseCatalogExcel(template);
  assert.equal(plan.items.length, 0); assert.equal(issues.length, 1); assert.equal(issues[0]!.field, 'Datos');
});
