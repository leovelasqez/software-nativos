import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { aggregateDashboard, dashboardDates } from '../dashboard.ts';
import type { Dashboard, DashboardLine, DashboardSale } from '../dashboard.ts';
import { ApiError, authenticate, requireAccess } from './security.ts';

type StoredSale = { total: string; lines: DashboardLine[] };
export function registerDashboard(app: FastifyInstance, pool: Pool) {
  app.get('/api/dashboard', async request => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const actor = await authenticate(client, request);
      const query = request.query as { branchId?: unknown };
      if (Object.keys(query).some(key => key !== 'branchId') || typeof query.branchId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(query.branchId))
        throw new ApiError(400, 'invalid_filter', 'Selecciona una sucursal válida.');
      const branchIds = query.branchId === 'all' ? actor.user.branch_ids : [query.branchId];
      if (!branchIds.length) throw new ApiError(403, 'forbidden', 'No tienes sucursales para consultar.');
      for (const branchId of branchIds) requireAccess(actor, branchId, 'data.read');
      const now = new Date(); const { today, monthStart } = dashboardDates(now);
      const params = [branchIds, monthStart, today];
      const saleRows = await client.query<{ id: string; data: StoredSale; day: string; occurred_at: Date }>(`
        SELECT id,data,occurred_at,(occurred_at AT TIME ZONE 'America/Bogota')::date::text AS day
        FROM pos_sales WHERE branch_id=ANY($1::text[])
          AND occurred_at >= ($2::date::timestamp AT TIME ZONE 'America/Bogota')
          AND occurred_at < (($3::date+1)::timestamp AT TIME ZONE 'America/Bogota') ORDER BY occurred_at,id`, params);
      const sales: DashboardSale[] = saleRows.rows.map(row => ({ id: row.id, day: row.day, occurredAt: row.occurred_at.toISOString(), total: row.data.total, lines: row.data.lines }));
      const refundRows = await client.query<{
        data: { total: string; tip: string; shipping: string; lines: { lineId: string; quantity: string }[] };
        day: string; sale_id: string; sale_data: StoredSale; occurred_at: Date;
      }>(`SELECT r.data,r.sale_id,s.data AS sale_data,s.occurred_at,
          (to_timestamp((r.data->>'occurredAtMs')::numeric/1000) AT TIME ZONE 'America/Bogota')::date::text AS day
        FROM pos_refunds r JOIN pos_sales s ON s.id=r.sale_id
        WHERE s.branch_id=ANY($1::text[])
          AND to_timestamp((r.data->>'occurredAtMs')::numeric/1000) >= ($2::date::timestamp AT TIME ZONE 'America/Bogota')
          AND to_timestamp((r.data->>'occurredAtMs')::numeric/1000) < (($3::date+1)::timestamp AT TIME ZONE 'America/Bogota')`, params);
      const refunds = refundRows.rows.map(row => ({ day: row.day, total: row.data.total, tip: row.data.tip, shipping: row.data.shipping, lines: row.data.lines,
        sale: { id: row.sale_id, day: dashboardDates(row.occurred_at).today, occurredAt: row.occurred_at.toISOString(), total: row.sale_data.total, lines: row.sale_data.lines } }));
      const inventory = await client.query<Dashboard['inventoryAlerts'][number]>(`
        SELECT i.id AS "itemId",i.name,w.branch_id AS "branchId",b.name AS "branchName",
          w.id AS "warehouseId",w.name AS "warehouseName",i.base_unit AS "baseUnit",
          coalesce(sum(m.quantity),0)::text AS quantity,n.minimum::text AS minimum
        FROM inventory_minimums n JOIN inventory_items i ON i.id=n.item_id
        JOIN warehouses w ON w.id=n.warehouse_id JOIN branches b ON b.id=w.branch_id
        LEFT JOIN inventory_movements m ON m.item_id=i.id AND m.warehouse_id=w.id
        WHERE w.branch_id=ANY($1::text[]) AND i.archived_at IS NULL
        GROUP BY i.id,i.name,i.base_unit,w.id,w.name,w.branch_id,b.name,n.minimum
        HAVING coalesce(sum(m.quantity),0)<=n.minimum
        ORDER BY coalesce(sum(m.quantity),0),b.name,w.name,i.name,i.id`, [branchIds]);
      const synchronization = await client.query<{ id: string; synchronized: Date | null }>(`
        SELECT b.id,max(t.last_sync_at) AS synchronized FROM branches b
        LEFT JOIN devices d ON d.branch_id=b.id LEFT JOIN pos_terminals t ON t.device_id=d.id
        WHERE b.id=ANY($1::text[]) GROUP BY b.id`, [branchIds]);
      const response: Dashboard = {
        context: { today, monthStart, timeZone: 'America/Bogota', branchIds, generatedAt: now.toISOString(),
          lastSynchronizedAt: Object.fromEntries(synchronization.rows.map(row => [row.id, row.synchronized?.toISOString() ?? null])) },
        ...aggregateDashboard(today, sales, refunds), inventoryAlerts: inventory.rows,
      };
      await client.query('COMMIT'); return response;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
}
