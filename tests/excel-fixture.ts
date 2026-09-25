import ExcelJS from 'exceljs';
import { excelHeaders } from '../src/catalog-import.ts';
export async function excelFixture(edit?: (w: ExcelJS.Workbook) => void) {
  const w = new ExcelJS.Workbook();
  for (const [name, headers] of Object.entries(excelHeaders)) w.addWorksheet(name).addRow([...headers]);
  w.getWorksheet('Insumos nuevos')!.addRows([['MP-TEST', 'Mango sintético', 'Materia prima', 'g'], ['EMP-TEST', 'Vaso sintético', 'Consumible', 'unit']]);
  w.getWorksheet('Productos')!.addRows([
    ['JUG-TEST', 'Jugo sintético', 'Preparado', 'Pruebas', 'Vaso', 8000, '', '', '', 'Solo pruebas'],
    ['BOT-TEST', 'Botella sintética', 'Terminado', 'Pruebas', 'Unidad', 3000, 'IVA', 19, 'No', ''],
  ]);
  w.getWorksheet('Recetas')!.addRow(['JUG-TEST', 'Receta sintética', 'Mezclar']);
  w.getWorksheet('Ingredientes')!.addRows([
    ['JUG-TEST', 'FRUTA', 'MP-TEST', 0.15, 'kg', 'Ingrediente', '', ''],
    ['JUG-TEST', 'VASO', 'EMP-TEST', 1, 'unit', 'Empaque', '', ''],
  ]);
  w.getWorksheet('Opciones')!.addRows([
    ['JUG-TEST', 'EXTRA', 'Extra fruta', 'Adición', '', 'MP-TEST', 50, 'g', 'Ingrediente', 1000, '', ''],
    ['JUG-TEST', 'PORCION', 'Porción distinta', 'Sustitución', 'FRUTA', 'MP-TEST', 1, 'porción', 'Ingrediente', 0, 120, 'Ficha sintética'],
  ]);
  edit?.(w);
  return Buffer.from(await w.xlsx.writeBuffer());
}
