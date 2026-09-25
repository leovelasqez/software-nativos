import { useState } from 'react';
import { api } from './api.ts';
import { Dialog, Notice } from './components.tsx';
import { MAX_EXCEL_BYTES } from '../src/catalog-import.ts';
import type { ExcelPreview, ExcelImportResult } from '../src/catalog-import.ts';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function base64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function CatalogImport({ branchId, close, saved }: { branchId: string; close: () => void; saved: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null); const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ExcelPreview | null>(null); const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(0);
  const recipe = preview?.recipes[recipeIndex];
  async function template() {
    setError(''); setBusy(true);
    try {
      const response = await fetch(`/api/catalog/imports/template?branchId=${encodeURIComponent(branchId)}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json()).message ?? 'No se pudo descargar la plantilla.');
      download(await response.blob(), 'Plantilla_Nativos.xlsx');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function validate() {
    if (!file) return; setError(''); setPreview(null); setBusy(true);
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > MAX_EXCEL_BYTES) throw new Error('Selecciona un archivo .xlsx de hasta 5 MB.');
      setRecipeIndex(0); setPreview(await api<ExcelPreview>('/catalog/imports/preview', 'POST', { branchId, reason: reason.trim(), fileName: file.name, content: await base64(file) }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!preview?.valid || !preview.previewId) return; setError(''); setBusy(true);
    try { const imported = await api<ExcelImportResult>('/catalog/imports/confirm', 'POST', { previewId: preview.previewId }); setResult(imported); await saved(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function errors() {
    const cell = (value: string | number) => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
    const rows = [['Hoja', 'Fila', 'Campo', 'Error'], ...(preview?.issues ?? []).map(i => [i.sheet, i.row, i.field, i.message])];
    download(new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'Errores_importacion.csv');
  }
  return <Dialog title="Importar Excel" canClose={!busy} onClose={() => { if (!busy) close(); }}>
    <div className="form catalog-import">
      <p>Insumos nuevos, productos y recetas del catálogo compartido. Las cantidades de receta corresponden a una unidad vendida.</p>
      {result ? <section aria-live="polite"><Notice>Importación completada: {result.summary.products} productos, {result.summary.recipes} recetas y {result.summary.items} insumos.</Notice><p>Operación: {result.importId}</p><button type="button" className="primary" onClick={close}>Cerrar</button></section> : <>
        <fieldset disabled={busy}>
          <button type="button" className="secondary" onClick={() => void template()}>Descargar plantilla</button>
          <label>Archivo Excel (.xlsx, máximo 5 MB)<input type="file" accept=".xlsx" onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); setError(''); }} /></label>
          <label>Motivo de la importación<textarea minLength={3} maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setPreview(null); }} rows={2} /></label>
          <button type="button" className="secondary" disabled={!file || reason.trim().length < 3} onClick={() => void validate()}>Validar archivo</button>
        </fieldset>
        <p>Validar no cambia el catálogo. Solo se crean registros nuevos; las referencias existentes se reportan como errores.</p>
        {preview && <section aria-label="Vista previa de importación" aria-live="polite">
          <h3>Vista previa</h3><p>{preview.summary.products} productos · {preview.summary.recipes} recetas · {preview.summary.items} insumos nuevos · {preview.summary.lines} ingredientes/empaques · {preview.summary.options} opciones</p>
          {preview.valid ? <Notice>Archivo válido. Revisa el contenido antes de confirmar. La vista previa vence a las {new Date(preview.expiresAt!).toLocaleTimeString('es-CO')}.</Notice> : <><Notice error>Corrige los errores y vuelve a validar. Se muestran hasta 1.000 errores.</Notice><button type="button" className="secondary" onClick={errors}>Descargar errores</button>
            <div className="import-table-scroll"><table><thead><tr><th>Hoja</th><th>Fila</th><th>Campo</th><th>Error</th></tr></thead><tbody>{preview.issues.map((i, n) => <tr key={n}><td>{i.sheet}</td><td>{i.row || '—'}</td><td>{i.field}</td><td>{i.message}</td></tr>)}</tbody></table></div></>}
          {preview.products.length > 0 && <details><summary>Revisar productos ({preview.products.length})</summary><div className="import-table-scroll"><table><thead><tr><th>Referencia</th><th>Nombre</th><th>Tipo</th><th>Precio COP</th></tr></thead><tbody>{preview.products.map((p, n) => <tr key={n}><td>{p.reference}</td><td>{p.name}</td><td>{p.type === 'prepared' ? 'Preparado' : 'Terminado'}</td><td>{p.price}</td></tr>)}</tbody></table></div></details>}
          {preview.items.length > 0 && <details><summary>Revisar insumos nuevos ({preview.items.length})</summary><div className="import-table-scroll"><table><thead><tr><th>Referencia</th><th>Nombre</th><th>Tipo</th><th>Unidad base</th></tr></thead><tbody>{preview.items.map((i, n) => <tr key={n}><td>{i.reference}</td><td>{i.name}</td><td>{i.kind === 'raw' ? 'Materia prima' : 'Consumible'}</td><td>{i.baseUnit}</td></tr>)}</tbody></table></div></details>}
          {preview.recipes.length > 0 && <details><summary>Revisar recetas ({preview.recipes.length})</summary>
            <label>Receta a revisar<select value={recipeIndex} onChange={e => setRecipeIndex(Number(e.target.value))}>{preview.recipes.map((r, i) => <option key={i} value={i}>{r.reference} · {r.name}</option>)}</select></label>
            {recipe && <><p>{recipe.instructions}</p><div className="import-table-scroll"><table><thead><tr><th>Línea</th><th>Insumo</th><th>Cantidad</th><th>Tipo</th><th>Conversión</th></tr></thead><tbody>{recipe.lines.map((l, i) => <tr key={i}><td>{l.code}</td><td>{l.reference}</td><td>{l.quantity} {l.unit}</td><td>{l.kind === 'ingredient' ? 'Ingrediente' : 'Empaque'}</td><td>{l.factor ? `${l.factor} · ${l.source}` : 'Unidad estándar'}</td></tr>)}</tbody></table></div>
              {recipe.options.map((o, i) => <p key={i}>{o.name} · {o.kind === 'addition' ? 'Adición' : `Sustituye ${o.replaces}`} · {o.line.reference}: {o.line.quantity} {o.line.unit}{o.line.factor ? ` × ${o.line.factor} (${o.line.source})` : ''} · Precio adicional: {o.price} COP</p>)}
            </>}
          </details>}
          {preview.valid && <div className="form-footer"><span>Se guardará todo el lote.</span><button type="button" className="primary" disabled={busy || Date.now() >= Date.parse(preview.expiresAt!)} onClick={() => void confirm()}>Confirmar importación</button></div>}
        </section>}
      </>}
      {busy && <p role="status">Procesando…</p>}{error && <Notice error>{error}</Notice>}
    </div>
  </Dialog>;
}
