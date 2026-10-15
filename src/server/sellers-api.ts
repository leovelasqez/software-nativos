import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { audit, transaction } from './db.ts';
import { authenticate, requireAccess, requireAdmin, ApiError, notFound } from './security.ts';
import { payloadHash } from '../pos-crypto.ts';
import type { Seller, ProductCommission } from '../sellers.ts';
import contract from '../../contracts/sellers-v1.schema.json' with { type: 'json' };

type Input = Omit<Seller, 'id' | 'version'> & { operationId: string; reason: string; expectedVersion?: number };
const idSchema = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' };

export function registerSellers(app: FastifyInstance, pool: Pool) {
  app.get('/api/seller-options', { schema: { querystring: {
    type: 'object', additionalProperties: false, required: ['branchId'], properties: { branchId: idSchema },
  } } }, async req => {
    const { branchId } = req.query as { branchId: string };
    const actor = await authenticate(pool, req);
    const branches = branchId === 'all' ? actor.user.branch_ids : [branchId];
    for (const id of branches) requireAccess(actor, id);
    const rows = await pool.query(`SELECT DISTINCT ON(id) id,name FROM (
      SELECT s.id,s.name,1 AS priority,now() AS occurred FROM sellers s WHERE s.branch_ids && $1::text[]
      UNION ALL SELECT data->>'sellerId',data->>'sellerName',0,occurred_at FROM pos_sales
        WHERE branch_id=ANY($1::text[]) AND data->>'sellerId' IS NOT NULL
      ) options ORDER BY id,priority DESC,occurred DESC`, [branches]);
    return { items: rows.rows.sort((a, b) => a.name.localeCompare(b.name, 'es')) };
  });
  app.get('/api/seller-commissions', async req => {
    const actor = await authenticate(pool, req); requireAdmin(actor);
    const rows = await pool.query(`SELECT p.id,v.data->>'name' AS name,v.data->>'presentation' AS presentation,
      coalesce(c.current_version,0) AS version,r.data->>'amount' AS amount
      FROM catalog_products p JOIN product_versions v ON v.product_id=p.id AND v.version=p.current_version
      LEFT JOIN product_commissions c ON c.product_id=p.id
      LEFT JOIN product_commission_versions r ON r.product_id=p.id AND r.version=c.current_version
      WHERE p.archived_at IS NULL ORDER BY v.data->>'name',p.id`);
    return { items: rows.rows };
  });
  app.post('/api/seller-commissions/:id', { schema: {
    params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: idSchema } },
    body: { type: 'object', additionalProperties: false, required: ['operationId', 'expectedVersion', 'amount', 'reason'], properties: {
      operationId: contract.create.properties.operationId,
      expectedVersion: { type: 'integer', minimum: 0 },
      amount: { anyOf: [{ type: 'string', pattern: '^(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?$' }, { type: 'null' }] },
      reason: contract.create.properties.reason,
    } },
  } }, req => transaction(pool, async c => {
    await c.query('SELECT pg_advisory_xact_lock(7301)');
    const actor = await authenticate(c, req); requireAdmin(actor);
    const productId = (req.params as { id: string }).id;
    const b = req.body as { operationId: string; expectedVersion: number; amount: string | null; reason: string };
    if (b.reason.trim().length < 3) throw new ApiError(400, 'invalid_reason', 'Registra el motivo del cambio.');
    const fingerprint = payloadHash(JSON.stringify({ route: 'commission.save', productId, ...b }));
    const prior = (await c.query('SELECT * FROM catalog_operations WHERE id=$1', [b.operationId])).rows[0];
    if (prior) {
      if (prior.actor_id !== actor.user.id || prior.fingerprint !== fingerprint) throw new ApiError(409, 'operation_conflict', 'La operación pertenece a otro contenido.');
      return prior.response;
    }
    if (!(await c.query('SELECT 1 FROM catalog_products WHERE id=$1 AND archived_at IS NULL', [productId])).rowCount) throw notFound();
    const old = (await c.query('SELECT current_version FROM product_commissions WHERE product_id=$1', [productId])).rows[0];
    if ((old?.current_version ?? 0) !== b.expectedVersion) throw new ApiError(409, 'version_conflict', 'La comisión cambió. Actualiza la lista antes de editarla.');
    const value: ProductCommission = { productId, version: b.expectedVersion + 1, amount: b.amount };
    await c.query(`INSERT INTO product_commissions VALUES($1,$2) ON CONFLICT(product_id) DO UPDATE SET current_version=$2`, [productId, value.version]);
    await c.query('INSERT INTO product_commission_versions VALUES($1,$2,$3)', [productId, value.version, JSON.stringify(value)]);
    await audit(c, actor, 'seller.commission.updated', b.reason.trim(), { commission: value });
    await c.query('INSERT INTO catalog_operations VALUES($1,$2,$3,$4)', [b.operationId, actor.user.id, fingerprint, JSON.stringify(value)]);
    return value;
  }));
  app.get('/api/sellers', { schema: { querystring: {
    type: 'object', additionalProperties: false, required: ['branchId'],
    properties: { branchId: idSchema },
  } } }, async req => {
    const { branchId } = req.query as { branchId: string };
    const actor = await authenticate(pool, req);
    if (branchId === 'all') requireAdmin(actor); else requireAccess(actor, branchId);
    const rows = await pool.query(`SELECT v.data FROM sellers s JOIN seller_versions v
      ON v.seller_id=s.id AND v.version=s.current_version
      WHERE ${branchId === 'all' ? 's.branch_ids <@ $1::text[]' : 's.branch_ids && $1::text[] AND $2=ANY(s.branch_ids)'} ORDER BY s.name,s.id`,
    branchId === 'all' ? [actor.user.branch_ids] : [actor.user.branch_ids, branchId]);
    return { items: rows.rows.map(row => row.data as Seller) };
  });

  async function mutate(req: FastifyRequest, id?: string) {
    return transaction(pool, async c => {
      await c.query('SELECT pg_advisory_xact_lock(7301)');
      const actor = await authenticate(c, req); requireAdmin(actor);
      const b = req.body as Input;
      for (const branchId of b.branchIds) requireAccess(actor, branchId);
      const fingerprint = payloadHash(JSON.stringify({ route: 'seller.save', id: id ?? null, ...b }));
      const prior = (await c.query('SELECT * FROM catalog_operations WHERE id=$1', [b.operationId])).rows[0];
      if (prior) {
        if (prior.actor_id !== actor.user.id || prior.fingerprint !== fingerprint)
          throw new ApiError(409, 'operation_conflict', 'La operación pertenece a otro contenido.');
        return prior.response;
      }
      if (b.name.trim().length < 2 || b.reason.trim().length < 3)
        throw new ApiError(400, 'invalid_seller', 'Revisa el nombre del vendedor y el motivo.');
      const branches = await c.query('SELECT id FROM branches WHERE id=ANY($1::text[])', [b.branchIds]);
      if (branches.rowCount !== b.branchIds.length) throw new ApiError(400, 'invalid_branch', 'Sucursal no válida.');
      const old = id ? (await c.query('SELECT * FROM sellers WHERE id=$1', [id])).rows[0] : null;
      if (id && !old) throw notFound();
      if (old) {
        for (const branchId of old.branch_ids) requireAccess(actor, branchId);
        if (old.current_version !== b.expectedVersion)
          throw new ApiError(409, 'version_conflict', 'El vendedor cambió. Actualiza la lista antes de editarlo.');
      }
      const seller: Seller = { id: id ?? randomUUID(), version: old ? old.current_version + 1 : 1,
        name: b.name.trim(), active: b.active, branchIds: b.branchIds };
      await c.query(`INSERT INTO sellers(id,current_version,name,active,branch_ids) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET current_version=$2,name=$3,active=$4,branch_ids=$5`,
      [seller.id, seller.version, seller.name, seller.active, seller.branchIds]);
      await c.query('INSERT INTO seller_versions VALUES($1,$2,$3)', [seller.id, seller.version, JSON.stringify(seller)]);
      await audit(c, actor, old ? 'seller.updated' : 'seller.created', b.reason.trim(), { seller }, null, seller.branchIds);
      await c.query('INSERT INTO catalog_operations VALUES($1,$2,$3,$4)',
        [b.operationId, actor.user.id, fingerprint, JSON.stringify(seller)]);
      return seller;
    });
  }
  app.post('/api/sellers', { schema: { body: contract.create } }, req => mutate(req));
  app.patch('/api/sellers/:id', { schema: {
    params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: idSchema } },
    body: { ...contract.create, required: [...contract.create.required, 'expectedVersion'],
      properties: { ...contract.create.properties, expectedVersion: { type: 'integer', minimum: 1 } } },
  } }, req => mutate(req, (req.params as { id: string }).id));
}
