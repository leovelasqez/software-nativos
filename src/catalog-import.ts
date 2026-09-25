/** Public contract shared by the browser and Excel import API. */
export const excelHeaders = {
  Productos: ['Referencia', 'Nombre', 'Tipo', 'Categoría', 'Presentación', 'Precio COP', 'Impuesto', 'Tasa %', 'Exento', 'Descripción'],
  Recetas: ['Referencia producto', 'Nombre receta', 'Instrucciones'],
  Ingredientes: ['Referencia producto', 'Código línea', 'Referencia insumo', 'Cantidad', 'Unidad', 'Tipo línea', 'Factor conversión', 'Fuente conversión'],
  Opciones: ['Referencia producto', 'Código opción', 'Nombre opción', 'Tipo opción', 'Línea reemplazada', 'Referencia insumo', 'Cantidad', 'Unidad', 'Tipo línea', 'Precio adicional COP', 'Factor conversión', 'Fuente conversión'],
  'Insumos nuevos': ['Referencia', 'Nombre', 'Tipo insumo', 'Unidad base'],
  'Insumos disponibles': ['Referencia', 'Nombre', 'Tipo insumo', 'Unidad base'],
} as const;
export type ImportIssue = { sheet: string; row: number; field: string; message: string };
export type ImportSummary = { products: number; recipes: number; items: number; lines: number; options: number };
export type PreviewLine = { code: string; reference: string; quantity: string; unit: string; kind: string; factor: string | null; source: string | null };
export type ExcelPreview = {
  valid: boolean; issues: ImportIssue[]; summary: ImportSummary;
  products: { reference: string; name: string; price: string; type: string }[];
  items: { reference: string; name: string; kind: string; baseUnit: string }[];
  recipes: { reference: string; name: string; instructions: string; lines: PreviewLine[]; options: { name: string; kind: string; replaces: string | null; price: string; line: PreviewLine }[] }[];
  previewId: string | null; expiresAt: string | null;
};
export type ExcelImportResult = { importId: string; summary: ImportSummary };
export const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
