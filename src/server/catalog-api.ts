import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { audit, transaction } from './db.ts';
import type { Actor } from './db.ts';
import { authenticate, requireAccess, ApiError, notFound } from './security.ts';
import { routeSchema } from './api-contract.ts';
import { CatalogError, decimal, formatted, freezeRecipe, multiply, toBase, recipeCost } from '../catalog.ts';
import type { Item, Product, Recipe } from '../catalog.ts';
import type { Action } from '../contracts.ts';

interface Common { branchId: string; operationId: string; reason: string }
interface Query { branchId: string; after?: string; limit?: string; q?: string }
type Params = { id: string; productId: string };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
function page<T>(rows: T[], limit: number, key: (row: T) => string) {
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? key(rows[limit - 1]!) : null };
}
function signedDecimal(value: string): bigint { return value.startsWith('-') ? -decimal(value.slice(1)) : decimal(value); }
const itemSelect = 'SELECT id,name,reference,kind,base_unit AS "baseUnit" FROM inventory_items';
const movementSelect = `SELECT id,item_id AS "itemId",warehouse_id AS "warehouseId",kind,quantity::text,entry,sale_id AS "saleId",purchase_id AS "purchaseId",transfer_event_id AS "transferEventId",count_id AS "countId",internal_consumption_id AS "internalConsumptionId","reverses_id" AS "reversesId",reason,created_at AS "createdAt" FROM inventory_movements`;
function validateNames(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, v] of Object.entries(value)) {
    if (['name', 'reference', 'category', 'presentation', 'label', 'reason'].includes(key) && typeof v === 'string' && v.trim().length < (key === 'reason' ? 3 : 2)) throw new CatalogError('Completa los nombres, referencias y motivo sin usar espacios de relleno.');
    if (typeof v === 'object') validateNames(v);
  }
}
function publicProduct(row: { data: Product; active_recipe_version: number | null }): Product {
  return { ...row.data, activeRecipeVersion: row.active_recipe_version, sellable: row.data.type === 'finished' || row.active_recipe_version !== null };
}
function costAccess(actor: Actor, branch: string, action: 'cost.read' | 'cost.write') {
  requireAccess(actor, branch, action);
  if (actor.user.role !== 'owner') throw new ApiError(403, 'cost_denied', 'Costos disponibles solo para el dueño.');
}
export function registerCatalog(app: FastifyInstance, pool: Pool) {
  async function read(req: FastifyRequest, action: Action = 'data.read') {
    const q = req.query as Query; const actor = await authenticate(pool, req); requireAccess(actor, q.branchId, action);
    return { q, actor, limit: Number(q.limit ?? 50), after: q.after ?? '' };
  }
  async function warehouse(db: Pool | PoolClient, id: string, branchId: string) {
    if (!(await db.query('SELECT 1 FROM warehouses WHERE id=$1 AND branch_id=$2', [id, branchId])).rowCount) throw notFound();
  }
  async function mutate(req: FastifyRequest, action: Action, run: (c: PoolClient, actor: Actor) => Promise<object>) {
    try {
      return await transaction(pool, async c => {
        await c.query('SELECT pg_advisory_xact_lock(7301)');
        const actor = await authenticate(c, req); const body = req.body as Common;
        requireAccess(actor, body.branchId, action);
        validateNames(body);
        const fingerprint = createHash('sha256').update(req.method + req.url + canonical(body)).digest('hex');
        const old = (await c.query('SELECT * FROM catalog_operations WHERE id=$1', [body.operationId])).rows[0];
        if (old) {
          if (old.actor_id !== actor.user.id || old.fingerprint !== fingerprint) throw new ApiError(409, 'operation_conflict', 'El identificador ya pertenece a otra operación.');
          return old.response;
        }
        const response = await run(c, actor);
        await c.query('INSERT INTO catalog_operations(id,actor_id,fingerprint,response) VALUES($1,$2,$3,$4)', [body.operationId, actor.user.id, fingerprint, JSON.stringify(response)]);
        await audit(c, actor, 'catalog.' + req.method.toLowerCase() + '.' + req.routeOptions.url, body.reason,
          { operationId: body.operationId, result: response }, body.branchId);
        return response;
      });
    } catch (e) { if (e instanceof CatalogError) throw new ApiError(400, 'catalog_invalid', e.message); throw e; }
  }
  app.get('/api/products', { schema: routeSchema('/api/products', 'get') }, async req => {
    const { q, limit, after } = await read(req);
    const rows = (await pool.query(`SELECT v.data,p.active_recipe_version FROM catalog_products p JOIN product_versions v ON v.product_id=p.id AND v.version=p.current_version
      WHERE p.id>$1 AND (v.data->>'name' ILIKE $2 OR p.reference ILIKE $2) ORDER BY p.id LIMIT $3`, [after, '%' + (q.q ?? '') + '%', limit + 1])).rows.map(publicProduct);
    return page(rows, limit, p => p.id);
  });
  async function saveProduct(req: FastifyRequest, edit: boolean) {
    return mutate(req, 'product.create', async c => {
      const body = req.body as Common & Product & { expectedVersion: number };
      const id = edit ? (req.params as Params).id : randomUUID();
      const old = edit ? (await c.query('SELECT * FROM catalog_products WHERE id=$1', [id])).rows[0] : null;
      if (edit && !old) throw notFound();
      if (old && old.current_version !== body.expectedVersion) throw new ApiError(409, 'version_conflict', 'El producto cambió. Recarga antes de editar.');
      if (body.tax && (Number(body.tax.rate) > 100 || body.tax.exempt && Number(body.tax.rate) !== 0)) throw new CatalogError('Revisa la tasa de impuesto y la exención.');
      const value: Product = { id, name: body.name.trim(), reference: body.reference.trim(), category: body.category.trim(), unit: body.unit,
        type: old?.kind ?? body.type, presentation: body.presentation.trim(), price: body.price, tax: body.tax,
        description: body.description, version: old ? old.current_version + 1 : 1, activeRecipeVersion: old?.active_recipe_version ?? null,
        sellable: (old?.kind ?? body.type) === 'finished' || old?.active_recipe_version != null };
      if (edit) await c.query('UPDATE catalog_products SET reference=$2,current_version=$3 WHERE id=$1', [id, value.reference, value.version]);
      else await c.query('INSERT INTO catalog_products(id,reference,kind,current_version) VALUES($1,$2,$3,1)', [id, value.reference, value.type]);
      await c.query('INSERT INTO product_versions(product_id,version,data) VALUES($1,$2,$3)', [id, value.version, JSON.stringify(value)]);
      if (value.type === 'finished') {
        if (edit) await c.query('UPDATE inventory_items SET name=$2,reference=$3 WHERE id=$1', [id, value.name, value.reference]);
        else await c.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$3,'finished','unit')", [id, value.name, value.reference]);
      }
      return value;
    });
  }
  app.post('/api/products', { schema: routeSchema('/api/products', 'post') }, req => saveProduct(req, false));
  app.put('/api/products/:id', { schema: routeSchema('/api/products/{id}', 'put') }, req => saveProduct(req, true));
  app.get('/api/products/:id/versions', { schema: routeSchema('/api/products/{id}/versions', 'get') }, async req => {
    const { limit, after } = await read(req);
    const rows = (await pool.query('SELECT data FROM product_versions WHERE product_id=$1 AND version>$2 ORDER BY version LIMIT $3', [(req.params as Params).id, /^\d+$/.test(after) ? after : '0', limit + 1])).rows.map(r => r.data as Product);
    return page(rows, limit, p => String(p.version));
  });
  app.get('/api/items', { schema: routeSchema('/api/items', 'get') }, async req => {
    const { limit, after } = await read(req);
    return page((await pool.query<Item>(itemSelect + ' WHERE id>$1 ORDER BY id LIMIT $2', [after, limit + 1])).rows, limit, i => i.id);
  });
  app.post('/api/items', { schema: routeSchema('/api/items', 'post') }, req => mutate(req, 'inventory.manage', async c => {
    const b = req.body as Common & Item; const id = randomUUID();
    await c.query('INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$3,$4,$5)', [id, b.name.trim(), b.reference.trim(), b.kind, b.baseUnit]);
    return (await c.query(itemSelect + ' WHERE id=$1', [id])).rows[0];
  }));
  app.get('/api/products/:id/recipes', { schema: routeSchema('/api/products/{id}/recipes', 'get') }, async req => {
    const { limit, after } = await read(req);
    const rows = (await pool.query('SELECT data FROM recipe_versions WHERE product_id=$1 AND version>$2 ORDER BY version LIMIT $3', [(req.params as Params).id, /^\d+$/.test(after) ? after : '0', limit + 1])).rows.map(r => r.data as Recipe);
    return page(rows, limit, r => String(r.version));
  });
  app.post('/api/products/:id/recipes', { schema: routeSchema('/api/products/{id}/recipes', 'post') }, req => mutate(req, 'recipe.create', async c => {
    const body = req.body as Common & Recipe & { expectedActiveVersion: number }; const productId = (req.params as Params).id;
    const product = (await c.query('SELECT * FROM catalog_products WHERE id=$1', [productId])).rows[0];
    if (!product) throw notFound(); if (product.kind !== 'prepared') throw new CatalogError('Solo los productos preparados tienen receta.');
    if (body.state === 'active' && (product.active_recipe_version ?? 0) !== body.expectedActiveVersion) throw new ApiError(409, 'recipe_conflict', 'La receta activa cambió. Recarga antes de publicar.');
    const version = Number((await c.query('SELECT coalesce(max(version),0)+1 AS v FROM recipe_versions WHERE product_id=$1', [productId])).rows[0].v);
    const ids = [...body.lines, ...body.options.map(o => o.line)].map(l => l.itemId);
    const items = new Map((await c.query<Item>(itemSelect + ' WHERE id=ANY($1::text[])', [ids])).rows.map(i => [i.id, i]));
    const recipe = freezeRecipe({ id: randomUUID(), productId, version, name: body.name.trim(), instructions: body.instructions, state: body.state, lines: body.lines, options: body.options }, items);
    await c.query('INSERT INTO recipe_versions(id,product_id,version,data) VALUES($1,$2,$3,$4)', [recipe.id, productId, version, JSON.stringify(recipe)]);
    if (recipe.state === 'active') await c.query('UPDATE catalog_products SET active_recipe_version=$2 WHERE id=$1', [productId, version]);
    return recipe;
  }));
  app.get('/api/warehouses/:id/stock', { schema: routeSchema('/api/warehouses/{id}/stock', 'get') }, async req => {
    const { q, limit, after } = await read(req); const id = (req.params as Params).id; await warehouse(pool, id, q.branchId);
    const rows = (await pool.query(`SELECT i.id AS "itemId",i.name,i.reference,i.base_unit AS "baseUnit",coalesce(s.quantity,0)::text AS quantity,
      coalesce(m.minimum,0)::text AS minimum, coalesce(s.quantity,0)<=coalesce(m.minimum,0) AS low FROM inventory_items i
      LEFT JOIN (SELECT item_id,sum(quantity) AS quantity FROM inventory_movements WHERE warehouse_id=$1 GROUP BY item_id) s ON s.item_id=i.id
      LEFT JOIN inventory_minimums m ON m.item_id=i.id AND m.warehouse_id=$1 WHERE i.id>$2 ORDER BY i.id LIMIT $3`, [id, after, limit + 1])).rows;
    return page(rows, limit, r => r.itemId);
  });
  app.get('/api/warehouses/:id/movements', { schema: routeSchema('/api/warehouses/{id}/movements', 'get') }, async req => {
    const { q, limit, after } = await read(req); const id = (req.params as Params).id; await warehouse(pool, id, q.branchId);
    return page((await pool.query(movementSelect + ' WHERE warehouse_id=$1 AND id>$2 ORDER BY id LIMIT $3', [id, after, limit + 1])).rows, limit, r => r.id);
  });
  app.post('/api/warehouses/:id/initial', { schema: routeSchema('/api/warehouses/{id}/initial', 'post') }, req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common & { itemId: string; quantity: string; unit: string; conversion: { factor: string; source: string } | null; unitCost: string | null };
    const warehouseId = (req.params as Params).id; await warehouse(c, warehouseId, b.branchId);
    if (b.unitCost !== null) costAccess(actor, b.branchId, 'cost.write');
    const item = (await c.query<Item>(itemSelect + ' WHERE id=$1', [b.itemId])).rows[0]; if (!item) throw notFound();
    if ((await c.query(`SELECT 1 FROM inventory_movements m WHERE item_id=$1 AND warehouse_id=$2 AND kind='initial'
      AND NOT EXISTS(SELECT 1 FROM inventory_movements r WHERE r.reverses_id=m.id)`, [b.itemId, warehouseId])).rowCount) throw new ApiError(409, 'initial_exists', 'Ya existe un inicial vigente. Revierte el anterior para corregirlo.');
    const quantity = toBase(b.quantity, b.unit, item.baseUnit, b.conversion); const id = randomUUID();
    await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,unit_cost,reason,entry) VALUES($1,$2,$3,'initial',$4,$5,$6,$7)`, [id, item.id, warehouseId, quantity, b.unitCost, b.reason, JSON.stringify({ quantity: b.quantity, unit: b.unit, conversion: b.conversion })]);
    return (await c.query(movementSelect + ' WHERE id=$1', [id])).rows[0];
  }));
  app.post('/api/warehouses/:id/reversals', { schema: routeSchema('/api/warehouses/{id}/reversals', 'post') }, req => mutate(req, 'inventory.manage', async c => {
    const b = req.body as Common & { movementId: string }; const warehouseId = (req.params as Params).id; await warehouse(c, warehouseId, b.branchId);
    const old = (await c.query("SELECT * FROM inventory_movements WHERE id=$1 AND warehouse_id=$2 AND kind='initial'", [b.movementId, warehouseId])).rows[0]; if (!old) throw notFound();
    if ((await c.query('SELECT 1 FROM inventory_movements WHERE reverses_id=$1', [old.id])).rowCount) throw new ApiError(409, 'already_reversed', 'El movimiento ya fue revertido.');
    const id = randomUUID();
    await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,reverses_id,reason) VALUES($1,$2,$3,'reversal',-$4::numeric,$5,$6)`, [id, old.item_id, warehouseId, old.quantity, old.id, b.reason]);
    return (await c.query(movementSelect + ' WHERE id=$1', [id])).rows[0];
  }));
  app.put('/api/warehouses/:id/minimum', { schema: routeSchema('/api/warehouses/{id}/minimum', 'put') }, req => mutate(req, 'inventory.manage', async c => {
    const b = req.body as Common & { itemId: string; minimum: string }; const warehouseId = (req.params as Params).id; await warehouse(c, warehouseId, b.branchId);
    await c.query('INSERT INTO inventory_minimums(warehouse_id,item_id,minimum) VALUES($1,$2,$3) ON CONFLICT(warehouse_id,item_id) DO UPDATE SET minimum=$3', [warehouseId, b.itemId, b.minimum]);
    return { ok: true };
  }));
  // REQ-003-02 / AC-003-09. Purchases are intentionally online-only and do not
  // calculate average cost: DEC-005 remains unresolved.
  app.get('/api/suppliers', async req => {
    const { q, limit, after } = await read(req, 'purchase.read');
    const rows = (await pool.query(`SELECT id,data,created_at AS "createdAt" FROM suppliers
      WHERE branch_id=$1 AND id>$2 AND data->>'name' ILIKE $3 ORDER BY id LIMIT $4`, [q.branchId, after, '%' + (q.q ?? '') + '%', limit + 1])).rows
      .map(r => ({ id: r.id, ...r.data, createdAt: r.createdAt }));
    return page(rows, limit, r => r.id);
  });
  app.post('/api/suppliers', async req => mutate(req, 'purchase.write', async c => {
    const b = req.body as Common & { name: string; document?: string; contact?: string };
    if (typeof b.name !== 'string' || b.name.trim().length < 2 || b.name.trim().length > 100) throw new CatalogError('Completa el nombre del proveedor.');
    for (const key of ['document', 'contact'] as const) if (b[key] !== undefined && (typeof b[key] !== 'string' || b[key]!.trim().length > 160)) throw new CatalogError('Revisa los datos del proveedor.');
    const id = randomUUID(); const data = { name: b.name.trim(), document: b.document?.trim() || null, contact: b.contact?.trim() || null };
    await c.query('INSERT INTO suppliers(id,branch_id,data) VALUES($1,$2,$3)', [id, b.branchId, JSON.stringify(data)]);
    return { id, ...data };
  }));
  app.get('/api/purchases', async req => {
    const { q, limit, after } = await read(req, 'purchase.read');
    const rows = (await pool.query(`SELECT p.id,p.warehouse_id AS "warehouseId",p.supplier_id AS "supplierId",s.data->>'name' AS "supplierName",
      p.paid_amount::text AS "paidAmount",p.payment_method AS "paymentMethod",p.purchased_on::text AS "purchasedOn",p.created_at AS "createdAt",p.data
      FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.branch_id=$1 AND p.id>$2 ORDER BY p.id LIMIT $3`, [q.branchId, after, limit + 1])).rows
      .map(r => ({ ...r, ...r.data }));
    return page(rows, limit, r => r.id);
  });
  app.post('/api/purchases', async req => mutate(req, 'purchase.write', async (c, actor) => {
    const b = req.body as Common & { supplierId: string; warehouseId: string; purchasedOn: string; paymentMethod: string; paidAmount: string;
      lines: { itemId: string; quantity: string; unit: string; conversion: { factor: string; source: string } | null; unitPrice: string }[] };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.purchasedOn ?? '') || typeof b.paymentMethod !== 'string' || b.paymentMethod.trim().length < 2 || b.paymentMethod.length > 50) throw new CatalogError('Revisa fecha y medio de pago.');
    if (!Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 100 || new Set(b.lines.map(l => l.itemId)).size !== b.lines.length) throw new CatalogError('Incluye líneas de artículos distintas para la compra.');
    await warehouse(c, b.warehouseId, b.branchId);
    if (!(await c.query('SELECT 1 FROM suppliers WHERE id=$1 AND branch_id=$2', [b.supplierId, b.branchId])).rowCount) throw notFound();
    const items = new Map((await c.query<Item>(itemSelect + ' WHERE id=ANY($1::text[])', [b.lines.map(l => l.itemId)])).rows.map(i => [i.id, i]));
    let total = 0n;
    const lines = b.lines.map(line => {
      const item = items.get(line.itemId); if (!item) throw notFound();
      if (!line || typeof line.unit !== 'string' || item.kind === 'finished') throw new CatalogError('Selecciona una materia prima o consumible y su unidad.');
      const baseQuantity = toBase(line.quantity, line.unit, item.baseUnit, line.conversion);
      if (decimal(line.quantity) <= 0n || decimal(line.unitPrice) < 0n) throw new CatalogError('Cantidad y precio inválidos.');
      const lineTotal = multiply(line.quantity, line.unitPrice); total += decimal(lineTotal);
      return { ...line, baseQuantity, lineTotal };
    });
    if (decimal(b.paidAmount) !== total) throw new CatalogError('El importe pagado debe coincidir exactamente con las líneas.');
    const id = randomUUID();
    await c.query(`INSERT INTO purchases(id,branch_id,warehouse_id,supplier_id,actor_id,paid_amount,payment_method,purchased_on,data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, b.branchId, b.warehouseId, b.supplierId, actor.user.id, formatted(total), b.paymentMethod.trim(), b.purchasedOn, JSON.stringify({ lines: lines.map(({ itemId, quantity, unit, conversion, unitPrice, baseQuantity, lineTotal }) => ({ itemId, quantity, unit, conversion, unitPrice, baseQuantity, lineTotal })) })]);
    for (const line of lines) {
      const lineId = randomUUID(); const movementId = randomUUID();
      await c.query(`INSERT INTO purchase_lines(id,purchase_id,item_id,quantity,base_quantity,unit,conversion,unit_price,line_total)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [lineId, id, line.itemId, line.quantity, line.baseQuantity, line.unit, JSON.stringify(line.conversion), line.unitPrice, line.lineTotal]);
      await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,purchase_id,reason,entry)
        VALUES($1,$2,$3,'purchase',$4,$5,$6,$7)`, [movementId, line.itemId, b.warehouseId, line.baseQuantity, id, b.reason, JSON.stringify({ purchaseId: id, lineId, quantity: line.quantity, unit: line.unit, conversion: line.conversion })]);
    }
    return { id, supplierId: b.supplierId, warehouseId: b.warehouseId, purchasedOn: b.purchasedOn, paymentMethod: b.paymentMethod.trim(), paidAmount: formatted(total), lines: lines.map(({ itemId, quantity, unit, baseQuantity, unitPrice, lineTotal }) => ({ itemId, quantity, unit, baseQuantity, unitPrice, lineTotal })) };
  }));
  app.get('/api/transfers', async req => {
    const { q, limit, after } = await read(req, 'inventory.manage');
    const rows = (await pool.query(`SELECT t.id,t.source_warehouse_id AS "sourceWarehouseId",t.target_warehouse_id AS "targetWarehouseId",t.data,t.created_at AS "createdAt",
      exists(SELECT 1 FROM inventory_transfer_events e WHERE e.transfer_id=t.id AND e.kind='dispatch') AS dispatched,
      coalesce((SELECT sum(l.base_quantity) FROM inventory_transfer_lines l WHERE l.transfer_id=t.id),0)::text AS "requestedQuantity",
      coalesce((SELECT sum(el.base_quantity) FROM inventory_transfer_event_lines el JOIN inventory_transfer_events e ON e.id=el.event_id WHERE e.transfer_id=t.id AND e.kind='receipt'),0)::text AS "receivedQuantity"
      FROM inventory_transfers t JOIN warehouses s ON s.id=t.source_warehouse_id WHERE s.branch_id=$1 AND t.id>$2 ORDER BY t.id LIMIT $3`, [q.branchId, after, limit + 1])).rows;
    return page(rows, limit, r => r.id);
  });
  app.get('/api/transfers/:id', async req => {
    const { q, actor } = await read(req, 'inventory.manage'); const id = (req.params as Params).id;
    const transfer = (await pool.query(`SELECT t.id,t.source_warehouse_id AS "sourceWarehouseId",t.target_warehouse_id AS "targetWarehouseId",t.created_at AS "createdAt",t.data,
      exists(SELECT 1 FROM inventory_transfer_events e WHERE e.transfer_id=t.id AND e.kind='dispatch') AS dispatched
      FROM inventory_transfers t JOIN warehouses s ON s.id=t.source_warehouse_id WHERE t.id=$1 AND s.branch_id=$2`, [id, q.branchId])).rows[0]; if (!transfer) throw notFound();
    const target = (await pool.query<{ branch_id: string }>('SELECT branch_id FROM warehouses WHERE id=$1', [transfer.targetWarehouseId])).rows[0]; if (!target) throw notFound(); requireAccess(actor, target.branch_id, 'inventory.manage');
    const lines = (await pool.query(`SELECT l.id,l.item_id AS "itemId",l.base_quantity::text AS "baseQuantity",l.entry,
      coalesce((SELECT sum(el.base_quantity) FROM inventory_transfer_event_lines el JOIN inventory_transfer_events e ON e.id=el.event_id WHERE el.line_id=l.id AND e.kind='receipt'),0)::text AS "receivedQuantity"
      FROM inventory_transfer_lines l WHERE l.transfer_id=$1 ORDER BY l.id`, [id])).rows;
    return { ...transfer, lines };
  });
  app.post('/api/transfers', async req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common & { sourceWarehouseId: string; targetWarehouseId: string; lines: { itemId: string; quantity: string; unit: string; conversion: { factor: string; source: string } | null }[] };
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100 || new Set(b.lines.map(l => l.itemId)).size !== b.lines.length) throw new CatalogError('Incluye artículos distintos para el traslado.');
    await warehouse(c, b.sourceWarehouseId, b.branchId);
    const target = (await c.query<{ branch_id: string }>('SELECT branch_id FROM warehouses WHERE id=$1', [b.targetWarehouseId])).rows[0]; if (!target) throw notFound();
    requireAccess(actor, target.branch_id, 'inventory.manage');
    if (b.sourceWarehouseId === b.targetWarehouseId) throw new CatalogError('El origen y destino del traslado deben ser distintos.');
    const items = new Map((await c.query<Item>(itemSelect + ' WHERE id=ANY($1::text[])', [b.lines.map(l => l.itemId)])).rows.map(i => [i.id, i]));
    const lines = b.lines.map(line => { const item = items.get(line.itemId); if (!item || item.kind === 'finished') throw new CatalogError('Selecciona una materia prima o consumible.'); const baseQuantity = toBase(line.quantity, line.unit, item.baseUnit, line.conversion); if (decimal(baseQuantity) <= 0n) throw new CatalogError('La cantidad debe ser mayor que cero.'); return { ...line, baseQuantity }; });
    const id = randomUUID(); await c.query('INSERT INTO inventory_transfers(id,source_warehouse_id,target_warehouse_id,actor_id,data) VALUES($1,$2,$3,$4,$5)', [id, b.sourceWarehouseId, b.targetWarehouseId, actor.user.id, JSON.stringify({ reason: b.reason })]);
    const persisted = lines.map(line => ({ ...line, id: randomUUID() }));
    for (const line of persisted) await c.query('INSERT INTO inventory_transfer_lines(id,transfer_id,item_id,base_quantity,entry) VALUES($1,$2,$3,$4,$5)', [line.id, id, line.itemId, line.baseQuantity, JSON.stringify({ quantity: line.quantity, unit: line.unit, conversion: line.conversion })]);
    return { id, sourceWarehouseId: b.sourceWarehouseId, targetWarehouseId: b.targetWarehouseId, lines: persisted.map(({ id, itemId, quantity, unit, baseQuantity }) => ({ id, itemId, quantity, unit, baseQuantity })), state: 'draft' };
  }));
  app.post('/api/transfers/:id/dispatch', async req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common; const transfer = (await c.query(`SELECT t.*,s.branch_id AS source_branch FROM inventory_transfers t JOIN warehouses s ON s.id=t.source_warehouse_id WHERE t.id=$1`, [(req.params as Params).id])).rows[0]; if (!transfer) throw notFound();
    requireAccess(actor, transfer.source_branch, 'inventory.manage'); if ((await c.query("SELECT 1 FROM inventory_transfer_events WHERE transfer_id=$1 AND kind='dispatch'", [transfer.id])).rowCount) throw new ApiError(409, 'already_dispatched', 'El traslado ya fue despachado.');
    const lines = (await c.query('SELECT * FROM inventory_transfer_lines WHERE transfer_id=$1 ORDER BY id', [transfer.id])).rows; const eventId = randomUUID();
    await c.query("INSERT INTO inventory_transfer_events(id,transfer_id,kind,actor_id) VALUES($1,$2,'dispatch',$3)", [eventId, transfer.id, actor.user.id]);
    for (const line of lines) { await c.query('INSERT INTO inventory_transfer_event_lines(event_id,line_id,base_quantity) VALUES($1,$2,$3)', [eventId, line.id, line.base_quantity]); await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,transfer_event_id,reason,entry) VALUES($1,$2,$3,'transfer_dispatch',-$4::numeric,$5,$6,$7)`, [randomUUID(), line.item_id, transfer.source_warehouse_id, line.base_quantity, eventId, b.reason, JSON.stringify({ transferId: transfer.id, lineId: line.id })]); }
    return { id: transfer.id, state: 'dispatched', eventId };
  }));
  app.post('/api/transfers/:id/receive', async req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common & { lines: { lineId: string; quantity: string }[] }; const transfer = (await c.query(`SELECT t.*,d.branch_id AS target_branch FROM inventory_transfers t JOIN warehouses d ON d.id=t.target_warehouse_id WHERE t.id=$1`, [(req.params as Params).id])).rows[0]; if (!transfer) throw notFound();
    requireAccess(actor, transfer.target_branch, 'inventory.manage'); if (!(await c.query("SELECT 1 FROM inventory_transfer_events WHERE transfer_id=$1 AND kind='dispatch'", [transfer.id])).rowCount) throw new ApiError(409, 'not_dispatched', 'Despacha el traslado antes de recibirlo.');
    if (!Array.isArray(b.lines) || !b.lines.length || new Set(b.lines.map(l => l.lineId)).size !== b.lines.length) throw new CatalogError('Incluye las cantidades recibidas por línea.');
    const expected = new Map((await c.query('SELECT id,item_id,base_quantity FROM inventory_transfer_lines WHERE transfer_id=$1', [transfer.id])).rows.map(r => [r.id, r]));
    const prior = await c.query(`SELECT el.line_id,coalesce(sum(el.base_quantity),0)::text AS quantity FROM inventory_transfer_event_lines el JOIN inventory_transfer_events e ON e.id=el.event_id WHERE e.transfer_id=$1 AND e.kind='receipt' GROUP BY el.line_id`, [transfer.id]); const received = new Map(prior.rows.map(r => [r.line_id, decimal(r.quantity)]));
    const lines = b.lines.map(line => { const original = expected.get(line.lineId); if (!original || decimal(line.quantity) <= 0n) throw new CatalogError('La línea o cantidad recibida no es válida.'); if ((received.get(line.lineId) ?? 0n) + decimal(line.quantity) > decimal(original.base_quantity)) throw new CatalogError('La recepción excede lo despachado.'); return { ...line, original }; });
    const eventId = randomUUID(); await c.query("INSERT INTO inventory_transfer_events(id,transfer_id,kind,actor_id) VALUES($1,$2,'receipt',$3)", [eventId, transfer.id, actor.user.id]);
    for (const line of lines) { await c.query('INSERT INTO inventory_transfer_event_lines(event_id,line_id,base_quantity) VALUES($1,$2,$3)', [eventId, line.lineId, line.quantity]); await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,transfer_event_id,reason,entry) VALUES($1,$2,$3,'transfer_receipt',$4,$5,$6,$7)`, [randomUUID(), line.original.item_id, transfer.target_warehouse_id, line.quantity, eventId, b.reason, JSON.stringify({ transferId: transfer.id, lineId: line.lineId })]); }
    return { id: transfer.id, state: 'dispatched', eventId, received: lines.map(l => ({ lineId: l.lineId, quantity: l.quantity })) };
  }));
  app.post('/api/warehouses/:id/counts', async req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common & { lines: { itemId: string; quantity: string; unit: string; conversion: { factor: string; source: string } | null }[] };
    const warehouseId = (req.params as Params).id; await warehouse(c, warehouseId, b.branchId);
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 500 || new Set(b.lines.map(l => l.itemId)).size !== b.lines.length) throw new CatalogError('Incluye artículos distintos para el conteo.');
    const items = new Map((await c.query<Item>(itemSelect + ' WHERE id=ANY($1::text[])', [b.lines.map(l => l.itemId)])).rows.map(i => [i.id, i]));
    const stock = new Map((await c.query<{ item_id: string; quantity: string }>('SELECT item_id,coalesce(sum(quantity),0)::text AS quantity FROM inventory_movements WHERE warehouse_id=$1 AND item_id=ANY($2::text[]) GROUP BY item_id', [warehouseId, b.lines.map(l => l.itemId)])).rows.map(r => [r.item_id, r.quantity]));
    const lines = b.lines.map(line => { const item = items.get(line.itemId); if (!item) throw notFound(); const actualQuantity = toBase(line.quantity, line.unit, item.baseUnit, line.conversion); if (decimal(actualQuantity) < 0n) throw new CatalogError('La cantidad contada no puede ser negativa.'); const expectedQuantity = stock.get(item.id) ?? '0'; const differenceAtomic = decimal(actualQuantity) - signedDecimal(expectedQuantity); return { ...line, expectedQuantity, actualQuantity, differenceAtomic, difference: formatted(differenceAtomic) }; });
    const id = randomUUID(); await c.query('INSERT INTO inventory_counts(id,warehouse_id,actor_id,data) VALUES($1,$2,$3,$4)', [id, warehouseId, actor.user.id, JSON.stringify({ reason: b.reason })]);
    for (const line of lines) { const lineId = randomUUID(); await c.query('INSERT INTO inventory_count_lines(id,count_id,item_id,expected_quantity,actual_quantity,difference,entry) VALUES($1,$2,$3,$4,$5,$6,$7)', [lineId, id, line.itemId, line.expectedQuantity, line.actualQuantity, line.difference, JSON.stringify({ quantity: line.quantity, unit: line.unit, conversion: line.conversion })]); if (line.differenceAtomic !== 0n) await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,count_id,reason,entry) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), line.itemId, warehouseId, line.differenceAtomic > 0n ? 'adjustment_in' : 'adjustment_out', line.difference, id, b.reason, JSON.stringify({ countId: id, lineId })]); }
    return { id, warehouseId, lines: lines.map(({ itemId, expectedQuantity, actualQuantity, difference }) => ({ itemId, expectedQuantity, actualQuantity, difference })) };
  }));
  app.post('/api/warehouses/:id/internal-consumptions', async req => mutate(req, 'inventory.manage', async (c, actor) => {
    const b = req.body as Common & { lines: { itemId: string; quantity: string; unit: string; conversion: { factor: string; source: string } | null }[] }; const warehouseId = (req.params as Params).id; await warehouse(c, warehouseId, b.branchId);
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100 || new Set(b.lines.map(l => l.itemId)).size !== b.lines.length) throw new CatalogError('Incluye artículos distintos para el consumo interno.');
    const items = new Map((await c.query<Item>(itemSelect + ' WHERE id=ANY($1::text[])', [b.lines.map(l => l.itemId)])).rows.map(i => [i.id, i]));
    const lines = b.lines.map(line => { const item = items.get(line.itemId); if (!item || item.kind === 'finished') throw new CatalogError('Selecciona una materia prima o consumible.'); const baseQuantity = toBase(line.quantity, line.unit, item.baseUnit, line.conversion); if (decimal(baseQuantity) <= 0n) throw new CatalogError('La cantidad debe ser mayor que cero.'); return { ...line, baseQuantity }; });
    const id = randomUUID(); await c.query('INSERT INTO inventory_internal_consumptions(id,warehouse_id,actor_id,data) VALUES($1,$2,$3,$4)', [id, warehouseId, actor.user.id, JSON.stringify({ reason: b.reason })]);
    for (const line of lines) { const lineId = randomUUID(); await c.query('INSERT INTO inventory_internal_consumption_lines(id,consumption_id,item_id,base_quantity,entry) VALUES($1,$2,$3,$4,$5)', [lineId, id, line.itemId, line.baseQuantity, JSON.stringify({ quantity: line.quantity, unit: line.unit, conversion: line.conversion })]); await c.query(`INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,internal_consumption_id,reason,entry) VALUES($1,$2,$3,'internal_consumption',-$4::numeric,$5,$6,$7)`, [randomUUID(), line.itemId, warehouseId, line.baseQuantity, id, b.reason, JSON.stringify({ consumptionId: id, lineId })]); }
    return { id, warehouseId, lines: lines.map(({ itemId, baseQuantity }) => ({ itemId, baseQuantity })) };
  }));
  async function costs(warehouseId: string, after = '', limit = 101) {
    return (await pool.query(`SELECT i.id AS "itemId",m.unit_cost::text AS "unitCost" FROM inventory_items i LEFT JOIN inventory_movements m
      ON m.item_id=i.id AND m.warehouse_id=$1 AND m.kind='initial' AND NOT EXISTS(SELECT 1 FROM inventory_movements r WHERE r.reverses_id=m.id)
      WHERE i.id>$2 ORDER BY i.id LIMIT $3`, [warehouseId, after, limit])).rows as { itemId: string; unitCost: string | null }[];
  }
  app.get('/api/warehouses/:id/costs', { schema: routeSchema('/api/warehouses/{id}/costs', 'get') }, async req => {
    const { q, actor, after, limit } = await read(req); costAccess(actor, q.branchId, 'cost.read'); const id = (req.params as Params).id;
    await warehouse(pool, id, q.branchId); return page(await costs(id, after, limit + 1), limit, r => r.itemId);
  });
  app.get('/api/warehouses/:id/recipe-cost/:productId', { schema: routeSchema('/api/warehouses/{id}/recipe-cost/{productId}', 'get') }, async req => {
    const { q, actor } = await read(req); costAccess(actor, q.branchId, 'cost.read'); const { id, productId } = req.params as Params;
    await warehouse(pool, id, q.branchId);
    const recipe = (await pool.query('SELECT r.data FROM recipe_versions r JOIN catalog_products p ON p.id=r.product_id AND p.active_recipe_version=r.version WHERE p.id=$1', [productId])).rows[0]?.data as Recipe | undefined;
    if (!recipe) throw notFound();
    const rows = (await pool.query(`SELECT m.item_id AS "itemId",m.unit_cost::text AS "unitCost" FROM inventory_movements m WHERE m.warehouse_id=$1 AND m.kind='initial'
      AND NOT EXISTS(SELECT 1 FROM inventory_movements r WHERE r.reverses_id=m.id)`, [id])).rows;
    try { return { cost: recipeCost(recipe, new Map(rows.map(r => [r.itemId, r.unitCost]))), recipeVersion: recipe.version }; }
    catch (e) { if (e instanceof CatalogError) return { cost: null, recipeVersion: recipe.version }; throw e; }
  });
}
