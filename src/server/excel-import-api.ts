import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { authenticate, requireAccess, ApiError } from './security.ts';
import { audit, transaction } from './db.ts';
import type { Actor } from './db.ts';
import type { Item, RecipeLine } from '../catalog.ts';
import type { ExcelPreview, ImportIssue, ImportSummary, ExcelImportResult } from '../catalog-import.ts';
import { MAX_EXCEL_BYTES } from '../catalog-import.ts';
import { parseCatalogExcel, resolveRecipes, referenceKey } from './excel-catalog.ts';
import type { ExcelPlan } from './excel-catalog.ts';
import { insertCatalogRows } from './catalog-import-store.ts';
import { catalogTemplate } from './excel-template.ts';

const branchSchema = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' };
const summary = (p: ExcelPlan): ImportSummary => ({ products: p.products.length, items: p.items.length, recipes: p.recipes.length, lines: p.recipes.reduce((n, r) => n + r.value.lines.length, 0), options: p.recipes.reduce((n, r) => n + r.value.options.length, 0) });
function permissions(actor: Actor, branch: string, plan: ExcelPlan) {
  requireAccess(actor, branch, 'product.create');
  if (plan.recipes.length) requireAccess(actor, branch, 'recipe.create');
  if (plan.items.length) requireAccess(actor, branch, 'inventory.manage');
}
async function validateAgainstDatabase(db: Pool | PoolClient, plan: ExcelPlan, issues: ImportIssue[]) {
  const references = [...new Set([
    ...plan.items.map(i => referenceKey(i.value.reference)),
    ...plan.products.map(p => referenceKey(p.value.reference)),
    ...plan.recipes.flatMap(r => [...r.value.lines.map(l => referenceKey(l.value.itemId)), ...r.value.options.map(o => referenceKey(o.value.line.itemId))]),
  ])];
  const inventory = (await db.query<Item & { archived: boolean }>('SELECT id,name,reference,kind,base_unit AS "baseUnit",archived_at IS NOT NULL AS archived FROM inventory_items WHERE lower(reference)=ANY($1::text[]) ORDER BY id', [references])).rows;
  const products = new Set((await db.query('SELECT lower(reference) AS reference FROM catalog_products WHERE lower(reference)=ANY($1::text[])', [references])).rows.map(r => r.reference as string));
  const itemRefs = new Set(inventory.map(i => referenceKey(i.reference)));
  const newItems = new Set(plan.items.map(i => referenceKey(i.value.reference)));
  for (const p of plan.products) {
    const ref = referenceKey(p.value.reference);
    if (products.has(ref) || (p.value.type === 'finished' && (itemRefs.has(ref) || newItems.has(ref)))) issues.push({ sheet: 'Productos', row: p.row, field: 'Referencia', message: 'La referencia ya existe o coincide con un insumo. Esta importación solo crea registros nuevos.' });
  }
  for (const i of plan.items) if (itemRefs.has(referenceKey(i.value.reference))) issues.push({ sheet: i.sheet, row: i.row, field: 'Referencia', message: 'El insumo ya existe (puede estar archivado). Retíralo de Insumos nuevos y usa su referencia si está activo.' });
  const rows = resolveRecipes(plan, inventory.filter(i => !i.archived), issues);
  const fingerprint = createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
  return { rows, fingerprint };
}
export function registerExcelImport(app: FastifyInstance, pool: Pool) {
  app.get('/api/catalog/imports/template', { schema: { querystring: { type: 'object', required: ['branchId'], additionalProperties: false, properties: { branchId: branchSchema } } } }, async (req, reply) => {
    const actor = await authenticate(pool, req); const { branchId } = req.query as { branchId: string }; requireAccess(actor, branchId, 'product.create'); requireAccess(actor, branchId, 'data.read');
    const items = (await pool.query<Item>("SELECT id,name,reference,kind,base_unit AS \"baseUnit\" FROM inventory_items WHERE archived_at IS NULL AND kind IN ('raw','consumable') ORDER BY reference")).rows;
    return reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', 'attachment; filename="Plantilla_Nativos.xlsx"').send(await catalogTemplate(items));
  });
  app.post('/api/catalog/imports/preview', {
    bodyLimit: 7 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', additionalProperties: false, required: ['branchId', 'reason', 'fileName', 'content'], properties: {
      branchId: branchSchema, reason: { type: 'string', minLength: 3, maxLength: 500 }, fileName: { type: 'string', minLength: 6, maxLength: 200, pattern: '\\.[xX][lL][sS][xX]$' }, content: { type: 'string', minLength: 4, maxLength: Math.ceil(MAX_EXCEL_BYTES / 3) * 4, pattern: '^[A-Za-z0-9+/]+={0,2}$' },
    } } },
  }, async req => {
    const actor = await authenticate(pool, req); const body = req.body as { branchId: string; reason: string; fileName: string; content: string };
    requireAccess(actor, body.branchId, 'product.create');
    if (body.reason.trim().length < 3) throw new ApiError(400, 'invalid_reason', 'Indica el motivo de la importación.');
    const parsed = await parseCatalogExcel(Buffer.from(body.content, 'base64')); permissions(actor, body.branchId, parsed.plan);
    let fingerprint = '';
    if (!parsed.issues.length) fingerprint = (await validateAgainstDatabase(pool, parsed.plan, parsed.issues)).fingerprint;
    const valid = parsed.issues.length === 0;
    const line = (l: RecipeLine) => ({ code: l.id, reference: l.itemId, quantity: l.quantity ?? '', unit: l.unit, kind: l.kind, factor: l.conversion?.factor ?? null, source: l.conversion?.source ?? null });
    const response: ExcelPreview = {
      valid, issues: parsed.issues.slice(0, 1000), summary: summary(parsed.plan),
      products: parsed.plan.products.slice(0, 1000).map(p => ({ reference: p.value.reference, name: p.value.name, price: p.value.price, type: p.value.type })),
      items: parsed.plan.items.slice(0, 2000).map(i => ({ reference: i.value.reference, name: i.value.name, kind: i.value.kind, baseUnit: i.value.baseUnit })),
      recipes: valid ? parsed.plan.recipes.map(({ value: r }) => ({ reference: r.reference, name: r.name, instructions: r.instructions, lines: r.lines.map(l => line(l.value)), options: r.options.map(({ value: o }) => ({ name: o.name, kind: o.kind, replaces: o.replacesLineId, price: o.price ?? '', line: line(o.line) })) })) : [],
      previewId: null, expiresAt: null,
    };
    if (valid) {
      response.previewId = randomUUID(); response.expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
      await pool.query('DELETE FROM excel_catalog_imports WHERE actor_id=$1 AND expires_at<now() AND response IS NULL', [actor.user.id]);
      await pool.query('INSERT INTO excel_catalog_imports(id,actor_id,branch_id,file_name,reason,data,inventory_fingerprint,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [response.previewId, actor.user.id, body.branchId, body.fileName, body.reason.trim(), JSON.stringify(parsed.plan), fingerprint, response.expiresAt]);
    }
    return response;
  });
  app.post('/api/catalog/imports/confirm', { schema: { body: { type: 'object', additionalProperties: false, required: ['previewId'], properties: { previewId: { type: 'string', format: 'uuid' } } } } }, req => transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7301)');
    const actor = await authenticate(c, req); const { previewId } = req.body as { previewId: string };
    const draft = (await c.query('SELECT * FROM excel_catalog_imports WHERE id=$1 AND actor_id=$2 FOR UPDATE', [previewId, actor.user.id])).rows[0];
    if (!draft) throw new ApiError(404, 'preview_missing', 'La vista previa no existe para este usuario.');
    const plan = draft.data as ExcelPlan; permissions(actor, draft.branch_id as string, plan);
    if (draft.response) return draft.response as ExcelImportResult;
    if (new Date(draft.expires_at as string).getTime() < Date.now()) throw new ApiError(409, 'preview_expired', 'La vista previa venció. Vuelve a validar el archivo.');
    const issues: ImportIssue[] = []; const checked = await validateAgainstDatabase(c, plan, issues);
    if (issues.length || checked.fingerprint !== draft.inventory_fingerprint) throw new ApiError(409, 'catalog_changed', 'El catálogo cambió desde la validación. Vuelve a validar el archivo para revisar los conflictos.');
    for (const { value: i } of plan.items) await c.query('INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$3,$4,$5)', [i.id, i.name, i.reference, i.kind, i.baseUnit]);
    const products = await insertCatalogRows(c, checked.rows);
    const response: ExcelImportResult = { importId: previewId, summary: summary(plan) };
    await audit(c, actor, 'catalog.excel_imported', draft.reason as string, { importId: previewId, fileName: draft.file_name, summary: response.summary, products, itemIds: plan.items.map(i => i.value.id) }, draft.branch_id as string);
    await c.query('UPDATE excel_catalog_imports SET response=$2,confirmed_at=now() WHERE id=$1', [previewId, JSON.stringify(response)]);
    return response;
  }));
}
