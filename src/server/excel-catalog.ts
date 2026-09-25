import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import { randomUUID } from 'node:crypto';
import { freezeRecipe } from '../catalog.ts';
import type { Item, Product, Recipe, RecipeLine, RecipeOption } from '../catalog.ts';
import { excelHeaders, MAX_EXCEL_BYTES } from '../catalog-import.ts';
import type { ImportIssue } from '../catalog-import.ts';

export type Located<T> = { sheet: string; row: number; value: T };
export type ImportProduct = Omit<Product, 'id' | 'version' | 'activeRecipeVersion' | 'sellable' | 'unit'>;
export type PendingLine = Located<RecipeLine>;
export type PendingRecipe = Located<{ reference: string; name: string; instructions: string; lines: PendingLine[]; options: Located<RecipeOption>[] }>;
export type ExcelPlan = { items: Located<Item>[]; products: Located<ImportProduct>[]; recipes: PendingRecipe[] };
const key = (s: string) => s.trim().toLowerCase();
export { key as referenceKey };

/** Check every ZIP entry before ExcelJS allocates/decompresses the workbook. */
async function checkArchive(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_EXCEL_BYTES) throw new Error('El archivo debe medir como máximo 5 MB.');
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(new Error('Selecciona un archivo .xlsx válido, sin contraseña.'));
      let bytes = 0; let expanded = 0; let entries = 0; let workbook = false;
      const fail = (message: string) => { zip.close(); reject(new Error(message)); };
      zip.on('error', () => fail('No se pudo leer el archivo Excel.'));
      zip.on('entry', (entry: yauzl.Entry) => {
        bytes += entry.uncompressedSize; entries++;
        if (bytes > 50 * 1024 * 1024 || entries > 1000 || (entry.generalPurposeBitFlag & 1)) return fail('El contenido del Excel supera el límite permitido o está cifrado.');
        if (/vbaProject\.bin$/i.test(entry.fileName)) return fail('Usa un archivo .xlsx sin macros.');
        if (entry.fileName === 'xl/workbook.xml') workbook = true;
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail('El contenido comprimido del Excel es inválido.');
          stream.on('error', () => fail('El contenido comprimido del Excel es inválido.'));
          stream.on('data', (chunk: Buffer) => {
            expanded += chunk.length;
            if (expanded > 50 * 1024 * 1024) { stream.destroy(); fail('El contenido del Excel supera el límite permitido.'); }
          });
          stream.on('end', () => zip.readEntry());
        });
      });
      zip.on('end', () => workbook ? resolve() : reject(new Error('El archivo no contiene un libro Excel.')));
      zip.readEntry();
    });
  });
}

export async function parseCatalogExcel(buffer: Buffer): Promise<{ plan: ExcelPlan; issues: ImportIssue[] }> {
  const plan: ExcelPlan = { items: [], products: [], recipes: [] }; const issues: ImportIssue[] = [];
  const issue = (sheet: string, row: number, field: string, message: string) => {
    if (issues.length < 1000) issues.push({ sheet, row, field, message });
  };
  let workbook: ExcelJS.Workbook;
  try { await checkArchive(buffer); workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer); }
  catch (e) { issue('Archivo', 0, 'Archivo', e instanceof Error ? e.message : 'No se pudo leer el Excel.'); return { plan, issues }; }
  type DataRow = { number: number; values: Record<string, string | number> };
  const tables = new Map<string, DataRow[]>(); let totalRows = 0;
  const permitted = new Set<string>([...Object.keys(excelHeaders), 'Instrucciones', 'Campos', 'Ejemplos']);
  for (const s of workbook.worksheets) if (!permitted.has(s.name)) issue(s.name, 1, 'Hoja', 'Hoja no reconocida. Descarga la plantilla de Productos.');
  for (const [name, headers] of Object.entries(excelHeaders)) {
    if (name === 'Insumos disponibles') continue; // Reference only, never trusted as inventory.
    const sheet = workbook.getWorksheet(name);
    if (!sheet) { if (['Productos', 'Recetas', 'Ingredientes'].includes(name)) issue(name, 1, 'Hoja', 'Falta esta hoja de la plantilla.'); continue; }
    if (sheet.rowCount > 20001 || sheet.columnCount > 30) { issue(name, 1, 'Tamaño', 'Máximo 20.000 filas y 30 columnas por hoja.'); continue; }
    const columns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => { const label = cell.text.trim(); if (columns.has(label)) issue(name, 1, label, 'Encabezado repetido.'); columns.set(label, col); });
    for (const header of headers) if (!columns.has(header)) issue(name, 1, header, 'Falta esta columna en la fila 1.');
    for (const label of columns.keys()) if (!(headers as readonly string[]).includes(label)) issue(name, 1, label, 'Columna no reconocida.');
    if (issues.some(i => i.sheet === name)) continue;
    const rows: DataRow[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const values: DataRow['values'] = {}; let populated = false;
      row.eachCell((cell, col) => {
        if (cell.value !== null && cell.value !== '') populated = true;
        if (cell.isMerged) issue(name, number, String(cell.address), 'No se permiten celdas combinadas.');
        if (col > headers.length && cell.value !== null) issue(name, number, String(cell.address), 'Hay datos fuera de las columnas de la plantilla.');
      });
      if (!populated) return;
      totalRows++;
      for (const header of headers) {
        const cell = row.getCell(columns.get(header)!); const value = cell.value;
        if (value === null || value === undefined) values[header] = '';
        else if (typeof value === 'string' || typeof value === 'number') values[header] = typeof value === 'string' ? value.trim() : value;
        else { values[header] = ''; issue(name, number, header, 'Usa texto o números. No se admiten fórmulas, fechas, enlaces ni errores de Excel.'); }
      }
      rows.push({ number, values });
    });
    tables.set(name, rows);
  }
  if (totalRows > 20000) { issue('Archivo', 0, 'Filas', 'Máximo 20.000 filas de datos por archivo.'); return { plan, issues }; }
  function reader(sheet: string, row: DataRow) {
    const text = (field: string, min = 0, max = 160) => {
      const value = String(row.values[field] ?? '').trim();
      if (value.length < min || value.length > max) issue(sheet, row.number, field, `Debe tener entre ${min} y ${max} caracteres.`);
      return value;
    };
    const choice = <T extends string>(field: string, mapping: Record<string, T>): T => {
      const value = mapping[key(text(field))];
      if (!value) issue(sheet, row.number, field, `Elige: ${Object.keys(mapping).join(', ')}.`);
      return value ?? Object.values(mapping)[0]!;
    };
    const number = (field: string, positive = false, optional = false) => {
      const raw = row.values[field]; if ((raw === '' || raw === undefined) && optional) return null;
      // Excel numeric cells are locale-independent. Text must be unambiguous.
      const value = typeof raw === 'number' ? String(raw) : String(raw ?? '').trim();
      if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(value) || (positive && Number(value) <= 0)) {
        issue(sheet, row.number, field, `Escribe un número ${positive ? 'mayor que cero' : 'mayor o igual a cero'}, con hasta 6 decimales y sin separadores de miles.`); return '0';
      }
      return value;
    };
    const code = (field: string) => { const value = text(field, 1, 128); if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) issue(sheet, row.number, field, 'Usa letras sin tildes, números, guion o guion bajo.'); return value; };
    return { text, choice, number, code };
  }
  for (const row of tables.get('Insumos nuevos') ?? []) {
    const r = reader('Insumos nuevos', row);
    plan.items.push({ sheet: 'Insumos nuevos', row: row.number, value: { id: randomUUID(), reference: r.text('Referencia', 2, 100), name: r.text('Nombre', 2, 160), kind: r.choice('Tipo insumo', { 'materia prima': 'raw', consumible: 'consumable' }), baseUnit: r.choice('Unidad base', { g: 'g', ml: 'ml', unit: 'unit' }) } });
  }
  for (const row of tables.get('Productos') ?? []) {
    const r = reader('Productos', row); const label = r.text('Impuesto', 0, 80); let tax: Product['tax'] = null;
    if (label || row.values['Tasa %'] !== '' || row.values.Exento !== '') {
      r.text('Impuesto', 2, 80); const rate = r.number('Tasa %')!; const exempt = r.choice('Exento', { sí: 'yes', no: 'no' }) === 'yes';
      if (Number(rate) > 100 || (exempt && Number(rate) !== 0)) issue('Productos', row.number, 'Tasa %', 'La tasa debe estar entre 0 y 100, y ser cero si es exento.');
      tax = { label, rate, exempt };
    }
    plan.products.push({ sheet: 'Productos', row: row.number, value: { reference: r.text('Referencia', 2, 100), name: r.text('Nombre', 2, 160), type: r.choice('Tipo', { preparado: 'prepared', terminado: 'finished' }), category: r.text('Categoría', 2, 100), presentation: r.text('Presentación', 2, 160), price: r.number('Precio COP')!, tax, description: r.text('Descripción', 0, 1000) } });
  }
  for (const row of tables.get('Recetas') ?? []) {
    const r = reader('Recetas', row);
    plan.recipes.push({ sheet: 'Recetas', row: row.number, value: { reference: r.text('Referencia producto', 2, 100), name: r.text('Nombre receta', 2, 160), instructions: r.text('Instrucciones', 0, 4000), lines: [], options: [] } });
  }
  const recipes = new Map(plan.recipes.map(r => [key(r.value.reference), r]));
  for (const sheet of ['Ingredientes', 'Opciones']) for (const row of tables.get(sheet) ?? []) {
    const r = reader(sheet, row); const ref = r.text('Referencia producto', 2, 100); const recipe = recipes.get(key(ref));
    const factor = r.number('Factor conversión', true, true); const source = r.text('Fuente conversión', 0, 160);
    if (!factor && source) issue(sheet, row.number, 'Factor conversión', 'Indica el factor para esta fuente de conversión.');
    const line: RecipeLine = { id: sheet === 'Ingredientes' ? r.code('Código línea') : randomUUID(), itemId: r.text('Referencia insumo', 2, 100), quantity: r.number('Cantidad', true), unit: r.text('Unidad', 1, 20), kind: r.choice('Tipo línea', { ingrediente: 'ingredient', empaque: 'packaging' }), conversion: factor ? { factor, source } : null };
    if (factor && source.length < 2) issue(sheet, row.number, 'Fuente conversión', 'Documenta la fuente de la equivalencia.');
    if (!recipe) { issue(sheet, row.number, 'Referencia producto', 'No existe una receta con esta referencia en la hoja Recetas.'); continue; }
    if (sheet === 'Ingredientes') recipe.value.lines.push({ sheet, row: row.number, value: line });
    else {
      const kind = r.choice('Tipo opción', { 'adición': 'addition', 'sustitución': 'substitution' }); const replaces = r.text('Línea reemplazada', 0, 128);
      if ((kind === 'addition' && replaces) || (kind === 'substitution' && !replaces)) issue(sheet, row.number, 'Línea reemplazada', 'Es obligatoria solo para sustituciones.');
      recipe.value.options.push({ sheet, row: row.number, value: { id: r.code('Código opción'), name: r.text('Nombre opción', 2, 160), kind, replacesLineId: replaces || null, price: r.number('Precio adicional COP'), line } });
    }
  }
  for (const [rows, ref, field] of [
    [plan.products, (v: ImportProduct) => v.reference, 'Referencia'],
    [plan.items, (v: Item) => v.reference, 'Referencia'],
    [plan.recipes, (v: PendingRecipe['value']) => v.reference, 'Referencia producto'],
  ] as const) {
    const seen = new Set<string>();
    for (const row of rows) { const value = key((ref as (v: typeof row.value) => string)(row.value)); if (seen.has(value)) issue(row.sheet, row.row, field, 'Referencia repetida en el archivo.'); seen.add(value); }
  }
  if (!plan.products.length && !plan.items.length) issue('Archivo', 0, 'Datos', 'Agrega al menos un producto o insumo nuevo.');
  if (plan.products.length > 1000 || plan.items.length > 2000) issue('Archivo', 0, 'Filas', 'Máximo 1.000 productos y 2.000 insumos nuevos.');
  const products = new Map(plan.products.map(p => [key(p.value.reference), p]));
  for (const product of plan.products) {
    const hasRecipe = recipes.has(key(product.value.reference));
    if ((product.value.type === 'prepared') !== hasRecipe) issue('Productos', product.row, 'Tipo', product.value.type === 'prepared' ? 'El preparado requiere una receta.' : 'Un terminado no puede tener receta.');
  }
  for (const recipe of plan.recipes) {
    if (!products.has(key(recipe.value.reference))) issue('Recetas', recipe.row, 'Referencia producto', 'No existe este producto en Productos.');
    if (recipe.value.lines.length > 100 || recipe.value.options.length > 100) issue('Recetas', recipe.row, 'Líneas', 'Máximo 100 ingredientes/empaques y 100 opciones por receta.');
  }
  return { plan, issues };
}

export type CatalogRow = { row: number; product: Product; recipe: Recipe | null };
/** Shared recipe rules preserve versioned consumption semantics used by POS. */
export function resolveRecipes(plan: ExcelPlan, inventory: Item[], issues: ImportIssue[]): CatalogRow[] {
  const items = new Map([...inventory, ...plan.items.map(i => i.value)].map(i => [key(i.reference), i]));
  const byId = new Map([...items.values()].map(i => [i.id, i]));
  return plan.products.map(p => {
    const product: Product = { ...p.value, id: randomUUID(), version: 1, unit: 'unit', activeRecipeVersion: p.value.type === 'prepared' ? 1 : null, sellable: true };
    const pending = plan.recipes.find(r => key(r.value.reference) === key(product.reference)); let recipe: Recipe | null = null;
    if (pending) {
      const resolveLine = (entry: Located<RecipeLine>) => {
        const item = items.get(key(entry.value.itemId));
        const line = { ...entry.value, itemId: item?.id ?? entry.value.itemId };
        try { freezeRecipe({ id: '', productId: '', version: 1, name: '', instructions: '', state: 'active', lines: [{ ...line, kind: 'ingredient' }], options: [] }, byId); }
        catch (e) { issues.push({ sheet: entry.sheet, row: entry.row, field: !item || item.kind === 'finished' ? 'Referencia insumo' : 'Cantidad / Unidad / Conversión', message: (e as Error).message }); }
        return line;
      };
      const lines = pending.value.lines.map(resolveLine);
      const options = pending.value.options.map(o => ({ ...o.value, line: resolveLine({ ...o, value: o.value.line }) }));
      try { recipe = freezeRecipe({ id: randomUUID(), productId: product.id, version: 1, name: pending.value.name, instructions: pending.value.instructions, state: 'active', lines, options }, byId); }
      catch (e) { issues.push({ sheet: 'Recetas', row: pending.row, field: 'Receta', message: (e as Error).message }); }
    }
    return { row: p.row, product, recipe };
  });
}
