import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { xlsx } from '../src/server/xlsx.ts';

test('AC-019-05: Excel abre con caracteres de usuario, Unicode y controles no válidos en XML', async () => {
  const text = 'Nombre\u0001\u000b\ufffe\ud800 & < > " café 🥭\tfinal\nsegunda línea';
  const formula = '=HYPERLINK("https://example.invalid", "texto")';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(xlsx([{ name: 'Datos', rows: [[text, formula]] }])).buffer);
  assert.equal(workbook.getWorksheet('Datos')!.getCell('A1').value, 'Nombre & < > " café 🥭\tfinal\nsegunda línea');
  assert.equal(workbook.getWorksheet('Datos')!.getCell('B1').value, formula);
  assert.equal(workbook.getWorksheet('Datos')!.getCell('B1').type, ExcelJS.ValueType.String);
});
