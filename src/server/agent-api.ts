import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Action } from '../contracts.ts';
import importSchema from '../../contracts/agent-import-v1.schema.json' with { type: 'json' };
import { CatalogError, decimal, formatted, freezeRecipe, toBase } from '../catalog.ts';
import type { Item, Product, Recipe, RecipeLine, RecipeOption } from '../catalog.ts';
import { audit, publicUser, transaction } from './db.ts';
import type { Actor } from './db.ts';
import { ApiError, authenticate, authenticateAgent, hashPassword, requireAccess, requireAdmin, tokenHash } from './security.ts';

const permittedActions = new Set<Action>(['data.read', 'product.create', 'recipe.create', 'purchase.read', 'purchase.write', 'inventory.manage']);
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
type AgentInput = { name: string; branchIds: string[]; actions: Action[]; reason: string };
type Query = { branchId?: string; after?: string; limit?: string; q?: string };
type ImportRow = { row: number; kind: 'initial' | 'entry' | 'adjustment_in' | 'adjustment_out'; itemId: string; warehouseId: string; quantity: string; unit: string; reason: string };
type InventoryImport = { kind: 'inventory'; operationId: string; branchId: string; reason: string; previewFingerprint?: string; rows: ImportRow[] };
type CatalogRow = { row: number; product: Omit<Product, 'id' | 'version' | 'activeRecipeVersion' | 'sellable'>; recipe: { name: string; instructions: string; lines: RecipeLine[]; options: RecipeOption[] } | null };
type CatalogImport = { kind: 'catalog'; operationId: string; branchId: string; reason: string; previewFingerprint?: string; rows: CatalogRow[] };
type McpRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
const importValidator = new Ajv2020({ strict: true, allErrors: true }).compile(importSchema);

function queryLimit(value: string | undefined) { const limit = Number(value ?? '50'); return Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : null; }
function canonical(value: unknown): string { if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => JSON.stringify(key) + ':' + canonical(child)).join(',') + '}'; return JSON.stringify(value); }
function importFingerprint(value: { previewFingerprint?: string }) { const { previewFingerprint: _previewFingerprint, ...body } = value; return createHash('sha256').update(canonical(body)).digest('hex'); }
async function agentRead(pool: Pool, request: Parameters<typeof authenticateAgent>[1], action: Action = 'data.read') {
  const query = request.query as Query; const limit = queryLimit(query.limit);
  if (!limit || !query.branchId || !idPattern.test(query.branchId) || (query.after !== undefined && !idPattern.test(query.after)) || (query.q !== undefined && query.q.length > 100)) throw new ApiError(400, 'invalid_query', 'Revisa sucursal, cursor y límite.');
  const actor = await authenticateAgent(pool, request); requireAccess(actor, query.branchId, action);
  return { actor, query, limit };
}

async function validateCatalogImport(db: Pool | PoolClient, actor: Actor, value: unknown) {
  const errors: { row: number; field: string; code: string; message: string }[] = [];
  if (!importValidator(value) || !value || typeof value !== 'object' || (value as { kind?: unknown }).kind !== 'catalog') return { errors: [{ row: 0, field: 'body', code: 'invalid_schema', message: 'El lote no cumple el contrato de importación.' }], rows: [] as { row: number; product: Product; recipe: Recipe | null }[] };
  const input = value as CatalogImport; requireAccess(actor, input.branchId, 'product.create');
  if (input.rows.some(row => row.product.type === 'prepared')) requireAccess(actor, input.branchId, 'recipe.create');
  if (new Set(input.rows.map(row => row.row)).size !== input.rows.length) errors.push({ row: 0, field: 'row', code: 'duplicate_row', message: 'Cada número de fila debe ser único.' });
  const references = input.rows.map(row => row.product.reference.trim().toLowerCase());
  if (new Set(references).size !== references.length) errors.push({ row: 0, field: 'product.reference', code: 'duplicate_reference', message: 'El lote repite una referencia.' });
  const existing = new Set((await db.query('SELECT lower(reference) AS reference FROM catalog_products WHERE lower(reference)=ANY($1::text[])', [references])).rows.map(row => row.reference as string));
  const itemIds = [...new Set(input.rows.flatMap(row => row.recipe ? [...row.recipe.lines, ...row.recipe.options.map(option => option.line)].map(line => line.itemId) : []))];
  const items = new Map((await db.query<Item>('SELECT id,name,reference,kind,base_unit AS "baseUnit" FROM inventory_items WHERE id=ANY($1::text[])', [itemIds])).rows.map(item => [item.id, item]));
  const rows: { row: number; product: Product; recipe: Recipe | null }[] = [];
  for (const row of input.rows) {
    const product = row.product;
    if (existing.has(product.reference.trim().toLowerCase())) { errors.push({ row: row.row, field: 'product.reference', code: 'reference_exists', message: 'La referencia ya existe.' }); continue; }
    if (product.tax && (decimal(product.tax.rate) > decimal('100') || (product.tax.exempt && decimal(product.tax.rate) !== 0n))) { errors.push({ row: row.row, field: 'product.tax', code: 'invalid_tax', message: 'La tasa y exención no son consistentes.' }); continue; }
    const id = randomUUID(); const saved: Product = { ...product, id, name: product.name.trim(), reference: product.reference.trim(), category: product.category.trim(), presentation: product.presentation.trim(), description: product.description.trim(), unit: 'unit', version: 1, activeRecipeVersion: product.type === 'prepared' ? 1 : null, sellable: true };
    if (product.type === 'finished' && row.recipe !== null) { errors.push({ row: row.row, field: 'recipe', code: 'unexpected_recipe', message: 'Un producto terminado no lleva receta.' }); continue; }
    if (product.type === 'prepared' && row.recipe === null) { errors.push({ row: row.row, field: 'recipe', code: 'missing_recipe', message: 'Un producto preparado requiere receta activa.' }); continue; }
    try {
      const recipe = row.recipe === null ? null : freezeRecipe({ id: randomUUID(), productId: id, version: 1, name: row.recipe.name.trim(), instructions: row.recipe.instructions.trim(), state: 'active', lines: row.recipe.lines, options: row.recipe.options }, items);
      rows.push({ row: row.row, product: saved, recipe });
    } catch (error) { errors.push({ row: row.row, field: 'recipe', code: 'invalid_recipe', message: (error as Error).message }); }
  }
  return { errors, rows, input };
}
async function validateInventoryImport(db: Pool | PoolClient, actor: Actor, value: unknown) {
  const errors: { row: number; field: string; code: string; message: string }[] = [];
  if (!importValidator(value) || !value || typeof value !== 'object' || (value as { kind?: unknown }).kind !== 'inventory') return { errors: [{ row: 0, field: 'body', code: 'invalid_schema', message: 'El lote no cumple el contrato de importación.' }], rows: [] as (ImportRow & { baseQuantity: string })[] };
  const input = value as InventoryImport; requireAccess(actor, input.branchId, 'inventory.manage');
  if (new Set(input.rows.map(row => row.row)).size !== input.rows.length) errors.push({ row: 0, field: 'row', code: 'duplicate_row', message: 'Cada número de fila debe ser único.' });
  const itemIds = [...new Set(input.rows.map(row => row.itemId))]; const warehouseIds = [...new Set(input.rows.map(row => row.warehouseId))];
  const items = new Map((await db.query<Item>('SELECT id,name,reference,kind,base_unit AS "baseUnit" FROM inventory_items WHERE id=ANY($1::text[])', [itemIds])).rows.map(item => [item.id, item]));
  const warehouses = new Set((await db.query('SELECT id FROM warehouses WHERE branch_id=$1 AND id=ANY($2::text[])', [input.branchId, warehouseIds])).rows.map(row => row.id as string));
  const importedInitials = new Set<string>(); const rows: (ImportRow & { baseQuantity: string })[] = [];
  for (const row of input.rows) {
    const item = items.get(row.itemId); if (!item) { errors.push({ row: row.row, field: 'itemId', code: 'unknown_item', message: 'El artículo no existe.' }); continue; }
    if (!warehouses.has(row.warehouseId)) { errors.push({ row: row.row, field: 'warehouseId', code: 'branch_denied', message: 'La bodega no pertenece a la sucursal.' }); continue; }
    if (decimal(row.quantity) <= 0n) { errors.push({ row: row.row, field: 'quantity', code: 'invalid_quantity', message: 'La cantidad debe ser mayor que cero.' }); continue; }
    let baseQuantity: string;
    try { baseQuantity = toBase(row.quantity, row.unit, item.baseUnit, null); }
    catch { errors.push({ row: row.row, field: 'unit', code: 'invalid_unit', message: 'La unidad no es válida para el artículo.' }); continue; }
    if (row.kind === 'initial') {
      const key = `${row.warehouseId}:${row.itemId}`;
      if (importedInitials.has(key)) errors.push({ row: row.row, field: 'kind', code: 'duplicate_initial', message: 'El lote repite el inicial de artículo y bodega.' });
      importedInitials.add(key);
      if ((await db.query(`SELECT 1 FROM inventory_movements m WHERE m.item_id=$1 AND m.warehouse_id=$2 AND m.kind IN ('initial','import_initial') AND NOT EXISTS(SELECT 1 FROM inventory_movements r WHERE r.reverses_id=m.id)`, [row.itemId, row.warehouseId])).rowCount) errors.push({ row: row.row, field: 'kind', code: 'initial_exists', message: 'Ya existe un saldo inicial vigente.' });
    }
    rows.push({ ...row, baseQuantity });
  }
  return { errors, rows, input };
}

function validateInput(input: AgentInput) {
  if (input.name.trim().length < 2 || input.name.trim().length > 100 || input.reason.trim().length < 3 || input.reason.length > 500
    || !input.branchIds.length || new Set(input.branchIds).size !== input.branchIds.length || !input.branchIds.every(id => idPattern.test(id))
    || !input.actions.length || new Set(input.actions).size !== input.actions.length || !input.actions.every(action => permittedActions.has(action)))
    throw new ApiError(400, 'invalid_agent', 'Revisa nombre, sucursales, permisos y motivo del agente.');
}

const mcpTools = [
  { name: 'nativos_products_list', description: 'Consulta paginada de productos autorizados.', inputSchema: { type: 'object', required: ['branchId'], properties: { branchId: { type: 'string' }, after: { type: 'string' }, limit: { type: 'string' }, q: { type: 'string' } } } },
  { name: 'nativos_recipes_list', description: 'Consulta recetas activas autorizadas.', inputSchema: { type: 'object', required: ['branchId'], properties: { branchId: { type: 'string' }, after: { type: 'string' }, limit: { type: 'string' } } } },
  { name: 'nativos_inventory_list', description: 'Consulta existencias por bodega autorizada.', inputSchema: { type: 'object', required: ['branchId'], properties: { branchId: { type: 'string' }, after: { type: 'string' }, limit: { type: 'string' } } } },
  { name: 'nativos_movements_list', description: 'Consulta movimientos sin costos.', inputSchema: { type: 'object', required: ['branchId'], properties: { branchId: { type: 'string' }, after: { type: 'string' }, limit: { type: 'string' } } } },
  { name: 'nativos_report_get', description: 'Consulta un informe autorizado.', inputSchema: { type: 'object', required: ['branchId', 'kind'], properties: { branchId: { type: 'string' }, kind: { type: 'string' } } } },
  { name: 'nativos_inventory_import_preview', description: 'Valida un lote de inventario sin persistirlo.', inputSchema: { type: 'object' } },
  { name: 'nativos_inventory_import_confirm', description: 'Confirma un lote de inventario validado.', inputSchema: { type: 'object', required: ['previewFingerprint'] } },
  { name: 'nativos_catalog_import_preview', description: 'Valida productos y recetas sin persistirlos.', inputSchema: { type: 'object' } },
  { name: 'nativos_catalog_import_confirm', description: 'Confirma productos y recetas validados.', inputSchema: { type: 'object', required: ['previewFingerprint'] } }
] as const;
const mcpRoutes: Record<string, { method: 'GET' | 'POST'; path: string }> = {
  nativos_products_list: { method: 'GET', path: '/api/agent/v1/products' }, nativos_recipes_list: { method: 'GET', path: '/api/agent/v1/recipes' },
  nativos_inventory_list: { method: 'GET', path: '/api/agent/v1/inventory' }, nativos_movements_list: { method: 'GET', path: '/api/agent/v1/movements' },
  nativos_report_get: { method: 'GET', path: '/api/agent/v1/reports' }, nativos_inventory_import_preview: { method: 'POST', path: '/api/agent/v1/imports/preview' },
  nativos_inventory_import_confirm: { method: 'POST', path: '/api/agent/v1/imports/confirm' }, nativos_catalog_import_preview: { method: 'POST', path: '/api/agent/v1/imports/catalog/preview' },
  nativos_catalog_import_confirm: { method: 'POST', path: '/api/agent/v1/imports/catalog/confirm' }
};

export function registerAgents(app: FastifyInstance, pool: Pool) {
  async function mutate<T>(run: (client: PoolClient) => Promise<T>) {
    return transaction(pool, async c => { await c.query('SELECT pg_advisory_xact_lock(7301)'); return run(c); });
  }
  app.post('/api/agents', { schema: { body: { type: 'object', additionalProperties: false, properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 }, branchIds: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' } },
    actions: { type: 'array', minItems: 1, items: { type: 'string' } }, reason: { type: 'string', minLength: 3, maxLength: 500 }
  }, required: ['name', 'branchIds', 'actions', 'reason'] } } }, async (req, reply) => {
    const input = req.body as AgentInput;
    const created = await mutate(async c => {
      const actor = await authenticate(c, req); requireAdmin(actor); validateInput(input);
      if (input.branchIds.some(id => !actor.user.branch_ids.includes(id))) throw new ApiError(403, 'branch_denied', 'No puedes asignar otra sucursal.');
      const valid = await c.query('SELECT id FROM branches WHERE id=ANY($1::text[])', [input.branchIds]);
      if (valid.rowCount !== input.branchIds.length) throw new ApiError(400, 'invalid_branch', 'Sucursal no válida.');
      const id = randomUUID(); const token = randomBytes(32).toString('base64url');
      const user = (await c.query(`INSERT INTO app_users(id,name,login,password_hash,role,kind,branch_ids,actions)
        VALUES($1,$2,$3,$4,'owner','agent',$5,$6) RETURNING *`, [id, input.name.trim(), `agent-${id}`, await hashPassword(randomBytes(32).toString('base64url')), input.branchIds, input.actions])).rows[0];
      await c.query('INSERT INTO agent_credentials(user_id,token_hash,created_by) VALUES($1,$2,$3)', [id, tokenHash(token), actor.user.id]);
      await audit(c, actor, 'agent.created', input.reason.trim(), { after: { ...publicUser(user), kind: 'agent' } }, null, input.branchIds);
      return { id, name: user.name, branchIds: user.branch_ids, actions: user.actions, token };
    });
    return reply.code(201).send(created);
  });
  app.patch('/api/agents/:id', { schema: { params: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', pattern: '^[0-9a-f-]{36}$' } }, required: ['id'] }, body: { type: 'object', additionalProperties: false, properties: { active: { type: 'boolean' }, reason: { type: 'string', minLength: 3, maxLength: 500 } }, required: ['active', 'reason'] } } }, async req => mutate(async c => {
    const actor = await authenticate(c, req); requireAdmin(actor); const id = (req.params as { id: string }).id; const input = req.body as { active: boolean; reason: string };
    const row = (await c.query(`SELECT u.* FROM app_users u JOIN agent_credentials a ON a.user_id=u.id WHERE u.id=$1 AND u.kind='agent' FOR UPDATE`, [id])).rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'No se encontró el agente.');
    if (row.branch_ids.some((branchId: string) => !actor.user.branch_ids.includes(branchId))) throw new ApiError(403, 'branch_denied', 'No puedes modificar un agente de otra sucursal.');
    await c.query('UPDATE agent_credentials SET active=$2 WHERE user_id=$1', [id, input.active]);
    await audit(c, actor, input.active ? 'agent.activated' : 'agent.revoked', input.reason.trim(), { agentId: id }, null, row.branch_ids);
    return { id, active: input.active };
  }));
  app.post('/api/agents/:id/rotate', { schema: { params: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', pattern: '^[0-9a-f-]{36}$' } }, required: ['id'] }, body: { type: 'object', additionalProperties: false, properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } }, required: ['reason'] } } }, async req => mutate(async c => {
    const actor = await authenticate(c, req); requireAdmin(actor); const id = (req.params as { id: string }).id; const input = req.body as { reason: string };
    const row = (await c.query(`SELECT u.* FROM app_users u JOIN agent_credentials a ON a.user_id=u.id WHERE u.id=$1 AND u.kind='agent' AND a.active FOR UPDATE`, [id])).rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'No se encontró una credencial activa para el agente.');
    if (row.branch_ids.some((branchId: string) => !actor.user.branch_ids.includes(branchId))) throw new ApiError(403, 'branch_denied', 'No puedes modificar un agente de otra sucursal.');
    const token = randomBytes(32).toString('base64url');
    await c.query('UPDATE agent_credentials SET token_hash=$2,rotated_at=now() WHERE user_id=$1', [id, tokenHash(token)]);
    await audit(c, actor, 'agent.rotated', input.reason.trim(), { agentId: id }, null, row.branch_ids);
    return { id, token };
  }));
  app.get('/api/agent/v1/me', async req => {
    const actor = await authenticateAgent(pool, req);
    return { id: actor.user.id, name: actor.user.name, branchIds: actor.user.branch_ids, actions: actor.user.actions };
  });
  app.get('/api/agent/v1/products', async req => {
    const { query, limit } = await agentRead(pool, req);
    const rows = (await pool.query(`SELECT p.id,v.data,p.active_recipe_version FROM catalog_products p JOIN product_versions v ON v.product_id=p.id AND v.version=p.current_version
      WHERE p.id>$1 AND (v.data->>'name' ILIKE $2 OR p.reference ILIKE $2) ORDER BY p.id LIMIT $3`, [query.after ?? '', `%${query.q ?? ''}%`, limit + 1])).rows;
    const items = rows.slice(0, limit).map(row => ({ ...row.data, activeRecipeVersion: row.active_recipe_version, sellable: row.data.type === 'finished' || row.active_recipe_version !== null }));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  });
  app.get('/api/agent/v1/recipes', async req => {
    const { query, limit } = await agentRead(pool, req);
    const rows = (await pool.query(`SELECT r.id,r.data FROM recipe_versions r JOIN catalog_products p ON p.id=r.product_id AND p.active_recipe_version=r.version
      WHERE r.id>$1 ORDER BY r.id LIMIT $2`, [query.after ?? '', limit + 1])).rows;
    const items = rows.slice(0, limit).map(row => ({ id: row.id, ...row.data }));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  });
  app.get('/api/agent/v1/inventory', async req => {
    const { query, limit } = await agentRead(pool, req);
    const rows = (await pool.query(`SELECT w.id AS "warehouseId",w.name AS warehouse,i.id AS "itemId",i.name,i.reference,i.base_unit AS "baseUnit",coalesce(sum(m.quantity),0)::numeric(30,6)::text AS quantity,minimums.minimum::text AS minimum
      FROM inventory_items i CROSS JOIN (SELECT id,name FROM warehouses WHERE branch_id=$1) w LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=w.id LEFT JOIN inventory_minimums minimums ON minimums.warehouse_id=w.id AND minimums.item_id=i.id
      WHERE (w.id || ':' || i.id)>$2 GROUP BY w.id,w.name,i.id,i.name,i.reference,i.base_unit,minimums.minimum ORDER BY w.id,i.id LIMIT $3`, [query.branchId, query.after ?? '', limit + 1])).rows;
    const items = rows.slice(0, limit).map(row => ({ id: `${row.warehouseId}:${row.itemId}`, ...row }));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  });
  app.get('/api/agent/v1/movements', async req => {
    const { query, limit } = await agentRead(pool, req);
    const rows = (await pool.query(`SELECT m.id,m.item_id AS "itemId",m.warehouse_id AS "warehouseId",m.kind,m.quantity::text,m.reason,m.created_at AS "createdAt"
      FROM inventory_movements m JOIN warehouses w ON w.id=m.warehouse_id WHERE w.branch_id=$1 AND m.id>$2 ORDER BY m.id LIMIT $3`, [query.branchId, query.after ?? '', limit + 1])).rows;
    const items = rows.slice(0, limit).map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
    return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
  });
  app.post('/api/agent/v1/imports/preview', { bodyLimit: 1_100_000 }, async req => {
    const actor = await authenticateAgent(pool, req); const checked = await validateInventoryImport(pool, actor, req.body);
    if (!checked.input) return { valid: false, errors: checked.errors };
    return { valid: checked.errors.length === 0, errors: checked.errors, previewFingerprint: importFingerprint(checked.input), rows: checked.rows.map(row => ({ row: row.row, baseQuantity: row.baseQuantity })) };
  });
  app.post('/api/agent/v1/imports/confirm', { bodyLimit: 1_100_000 }, async req => mutate(async c => {
    const actor = await authenticateAgent(c, req);
    if (!importValidator(req.body) || !req.body || typeof req.body !== 'object' || (req.body as { kind?: unknown }).kind !== 'inventory') throw new ApiError(422, 'invalid_import', 'El lote no cumple el contrato de importación.');
    const input = req.body as InventoryImport; requireAccess(actor, input.branchId, 'inventory.manage');
    const fingerprint = importFingerprint(input);
    if (input.previewFingerprint !== fingerprint) throw new ApiError(409, 'preview_mismatch', 'La confirmación no coincide con la vista previa actual.');
    const prior = (await c.query('SELECT * FROM catalog_operations WHERE id=$1', [input.operationId])).rows[0];
    if (prior) {
      if (prior.actor_id !== actor.user.id || prior.fingerprint !== fingerprint) throw new ApiError(409, 'operation_conflict', 'El identificador pertenece a otro lote.');
      return prior.response;
    }
    const checked = await validateInventoryImport(c, actor, input);
    if (checked.errors.length || !checked.input) throw new ApiError(422, 'invalid_import', 'Corrige las filas indicadas por la vista previa.');
    const importId = randomUUID();
    await c.query('INSERT INTO agent_inventory_imports(id,operation_id,actor_id,branch_id,data) VALUES($1,$2,$3,$4,$5)', [importId, checked.input.operationId, actor.user.id, checked.input.branchId, JSON.stringify({ reason: checked.input.reason, rows: checked.rows.map(({ baseQuantity, ...row }) => ({ ...row, baseQuantity })) })]);
    const movements = [] as { row: number; movementId: string; kind: string; baseQuantity: string }[];
    for (const row of checked.rows) {
      const kind = row.kind === 'initial' ? 'import_initial' : row.kind === 'entry' ? 'import_entry' : row.kind === 'adjustment_in' ? 'import_adjustment_in' : 'import_adjustment_out';
      const quantity = row.kind === 'adjustment_out' ? formatted(-decimal(row.baseQuantity)) : row.baseQuantity;
      const movementId = randomUUID();
      await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,agent_import_id,reason,entry)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [movementId, row.itemId, row.warehouseId, kind, quantity, importId, row.reason, JSON.stringify({ importId, row: row.row, quantity: row.quantity, unit: row.unit })]);
      movements.push({ row: row.row, movementId, kind, baseQuantity: quantity });
    }
    const response = { importId, operationId: checked.input.operationId, movements };
    await c.query('INSERT INTO catalog_operations(id,actor_id,fingerprint,response) VALUES($1,$2,$3,$4)', [checked.input.operationId, actor.user.id, fingerprint, JSON.stringify(response)]);
    await audit(c, actor, 'agent.inventory_imported', checked.input.reason, { importId, operationId: checked.input.operationId, rows: movements.length }, checked.input.branchId, [checked.input.branchId]);
    return response;
  }));
  app.post('/api/agent/v1/imports/catalog/preview', { bodyLimit: 1_100_000 }, async req => {
    const actor = await authenticateAgent(pool, req); const checked = await validateCatalogImport(pool, actor, req.body);
    if (!checked.input) return { valid: false, errors: checked.errors };
    return { valid: checked.errors.length === 0, errors: checked.errors, previewFingerprint: importFingerprint(checked.input), rows: checked.rows.map(row => ({ row: row.row, productId: row.product.id, recipeId: row.recipe?.id ?? null, version: 1 })) };
  });
  app.post('/api/agent/v1/imports/catalog/confirm', { bodyLimit: 1_100_000 }, async req => mutate(async c => {
    const actor = await authenticateAgent(c, req);
    if (!importValidator(req.body) || !req.body || typeof req.body !== 'object' || (req.body as { kind?: unknown }).kind !== 'catalog') throw new ApiError(422, 'invalid_import', 'El lote no cumple el contrato de importación.');
    const input = req.body as CatalogImport; requireAccess(actor, input.branchId, 'product.create');
    if (input.rows.some(row => row.product.type === 'prepared')) requireAccess(actor, input.branchId, 'recipe.create');
    const fingerprint = importFingerprint(input);
    if (input.previewFingerprint !== fingerprint) throw new ApiError(409, 'preview_mismatch', 'La confirmación no coincide con la vista previa actual.');
    const prior = (await c.query('SELECT * FROM catalog_operations WHERE id=$1', [input.operationId])).rows[0];
    if (prior) {
      if (prior.actor_id !== actor.user.id || prior.fingerprint !== fingerprint) throw new ApiError(409, 'operation_conflict', 'El identificador pertenece a otro lote.');
      return prior.response;
    }
    const checked = await validateCatalogImport(c, actor, input);
    if (checked.errors.length || !checked.input) throw new ApiError(422, 'invalid_import', 'Corrige las filas indicadas por la vista previa.');
    const importId = randomUUID();
    await c.query('INSERT INTO agent_catalog_imports(id,operation_id,actor_id,branch_id,data) VALUES($1,$2,$3,$4,$5)', [importId, input.operationId, actor.user.id, input.branchId, JSON.stringify({ reason: input.reason, rows: checked.rows.map(row => ({ row: row.row, productId: row.product.id, recipeId: row.recipe?.id ?? null })) })]);
    const products: { row: number; productId: string; recipeId: string | null; version: number }[] = [];
    for (const row of checked.rows) {
      await c.query('INSERT INTO catalog_products(id,reference,kind,current_version,active_recipe_version) VALUES($1,$2,$3,1,$4)', [row.product.id, row.product.reference, row.product.type, row.recipe ? 1 : null]);
      await c.query('INSERT INTO product_versions(product_id,version,data) VALUES($1,1,$2)', [row.product.id, JSON.stringify(row.product)]);
      if (row.product.type === 'finished') await c.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$3,'finished','unit')", [row.product.id, row.product.name, row.product.reference]);
      if (row.recipe) await c.query('INSERT INTO recipe_versions(id,product_id,version,data) VALUES($1,$2,1,$3)', [row.recipe.id, row.product.id, JSON.stringify(row.recipe)]);
      products.push({ row: row.row, productId: row.product.id, recipeId: row.recipe?.id ?? null, version: 1 });
    }
    const response = { importId, operationId: input.operationId, products };
    await c.query('INSERT INTO catalog_operations(id,actor_id,fingerprint,response) VALUES($1,$2,$3,$4)', [input.operationId, actor.user.id, fingerprint, JSON.stringify(response)]);
    await audit(c, actor, 'agent.catalog_imported', input.reason, { importId, operationId: input.operationId, rows: products.length }, input.branchId, [input.branchId]);
    return response;
  }));
  app.post('/api/agent/v1/mcp', { bodyLimit: 1_100_000 }, async (req, reply) => {
    await authenticateAgent(pool, req);
    const body = req.body as McpRequest;
    const id = body?.id ?? null;
    const fail = (code: number, message: string) => reply.send({ jsonrpc: '2.0', id, error: { code, message } });
    if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return fail(-32600, 'Solicitud MCP inválida.');
    if (body.method === 'initialize') return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'nativos-agent-api', version: '1.0.0' } } };
    if (body.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: mcpTools } };
    if (body.method !== 'tools/call' || !body.params || typeof body.params.name !== 'string') return fail(-32601, 'Método MCP no disponible.');
    const route = mcpRoutes[body.params.name]; if (!route) return fail(-32602, 'Herramienta MCP no disponible.');
    const args = body.params.arguments ?? {};
    const path = route.path + (body.params.name === 'nativos_report_get' ? '/' + encodeURIComponent(String(args.kind ?? '')) : '');
    const url = route.method === 'GET' ? path + '?' + new URLSearchParams(Object.entries(args).filter(([key, value]) => key !== 'kind' && typeof value === 'string') as [string, string][]).toString() : path;
    const headers = { host: req.headers.host ?? 'localhost', authorization: req.headers.authorization ?? '', 'x-nativos-request': '1' };
    const delegated = route.method === 'POST'
      ? await app.inject({ method: 'POST', url, payload: args, headers })
      : await app.inject({ method: 'GET', url, headers });
    const content = { type: 'text', text: delegated.body };
    return { jsonrpc: '2.0', id, result: delegated.statusCode >= 400 ? { content: [content], isError: true } : { content: [content] } };
  });
}
