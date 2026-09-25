import ExcelJS from 'exceljs';
import { excelHeaders } from '../catalog-import.ts';
import type { Item } from '../catalog.ts';

export async function catalogTemplate(items: Item[]) {
  const workbook = new ExcelJS.Workbook();
  const guide = workbook.addWorksheet('Instrucciones');
  guide.columns = [{ width: 28 }, { width: 110 }];
  guide.addRows([
    ['Nativos', 'Importación de insumos, productos y recetas · v1'],
    ['Orden', 'Insumos nuevos → Productos → Recetas → Ingredientes → Opciones.'],
    ['Captura', 'Encabezados en fila 1. Datos desde fila 2. Conserva nombres de hojas y columnas.'],
    ['Alcance', 'Solo registros nuevos. Catálogo compartido entre sedes. No carga existencias ni costos.'],
    ['Referencias', 'Usa texto para conservar ceros iniciales. Las referencias no distinguen mayúsculas.'],
    ['Insumos', 'Insumos disponibles contiene una consulta real del sistema. No se importa. No repitas insumos existentes en Insumos nuevos.'],
    ['Productos', 'Referencia, Nombre, Tipo, Categoría, Presentación y Precio COP son obligatorios. Preparado requiere receta; Terminado no lleva receta.'],
    ['Impuestos', 'Opcionales. Si se asigna uno, completa Impuesto, Tasa % (19 significa 19 %) y Exento (Sí/No). Exento requiere tasa cero.'],
    ['Recetas', 'Referencia producto y Nombre receta son obligatorios. Instrucciones es opcional. Una receta por producto preparado.'],
    ['Ingredientes', 'Referencia producto, Código línea, Referencia insumo, Cantidad, Unidad y Tipo línea son obligatorios. Al menos un ingrediente por receta.'],
    ['Cantidades', 'Consumo por UNA unidad vendida. Números mayores que cero, hasta 6 decimales. Precios permiten cero. Usa celdas numéricas sin fórmulas.'],
    ['Unidades', 'Base: g, ml, unit. kg→g y l→ml son automáticas. Otras unidades requieren Factor conversión y Fuente conversión.'],
    ['Factor', 'Cantidad × factor = cantidad base. Ejemplo: 1 porción × 150 = 150 g. Fuente: Ficha de porcionado.'],
    ['Opciones', 'Adición o Sustitución. Código opción único por receta. Sustitución requiere Línea reemplazada (Código línea de Ingredientes).'],
    ['Opciones: campos', 'Referencia producto, Código opción, Nombre opción, Tipo opción, Referencia insumo, Cantidad, Unidad, Tipo línea y Precio adicional COP son obligatorios.'],
    ['Insumos nuevos', 'Referencia, Nombre, Tipo insumo (Materia prima/Consumible) y Unidad base (g/ml/unit) son obligatorios.'],
    ['Códigos', 'Código línea y Código opción: letras sin tildes, números, guion o guion bajo; comenzar por letra o número.'],
    ['Límites', '5 MB, 1.000 productos, 2.000 insumos, 20.000 filas en total. Hasta 100 líneas y 100 opciones por receta.'],
    ['Confirmación', 'Validar no cambia el catálogo. La vista previa vence en 30 minutos. Confirmar guarda todo el lote o nada.'],
  ]);
  guide.eachRow(r => { r.height = 36; r.alignment = { vertical: 'middle', wrapText: true }; });
  for (const [name, headers] of Object.entries(excelHeaders)) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    sheet.columns = headers.map(h => ({ header: h, width: /Instrucciones|Descripción|Fuente/.test(h) ? 55 : 25 }));
    sheet.getRow(1).height = 32; sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244938' } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    if (name === 'Insumos disponibles') { items.forEach(i => sheet.addRow([i.reference, i.name, i.kind === 'raw' ? 'Materia prima' : 'Consumible', i.baseUnit])); continue; }
    for (let row = 2; row <= 1001; row++) headers.forEach((h, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.numFmt = /Referencia|Código|Línea reemplazada/.test(h) ? '@' : /Precio|Cantidad|Factor|Tasa/.test(h) ? '0.######' : 'General';
      const choices: Record<string, string[]> = { Tipo: ['Preparado', 'Terminado'], Exento: ['Sí', 'No'], 'Tipo línea': ['Ingrediente', 'Empaque'], 'Tipo opción': ['Adición', 'Sustitución'], 'Tipo insumo': ['Materia prima', 'Consumible'], 'Unidad base': ['g', 'ml', 'unit'] };
      if (choices[h]) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + choices[h]!.join(',') + '"'], showErrorMessage: true, errorTitle: 'Valor no permitido', error: 'Selecciona un valor de la lista.' };
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
