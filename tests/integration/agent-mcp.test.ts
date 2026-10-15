import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { startLocalPostgres, freePort } from '../../scripts/local-postgres.ts';
import { createApp } from '../../src/server/app.ts';
import { migrate } from '../../src/server/db.ts';
import { READ_ONLY_MCP_PATH, MCP_PATH } from '../../src/server/agent-mcp.ts';

// SDK 1.32.1's client .d.ts redeclares sessionId with explicit undefined, conflicting
// with exactOptionalPropertyTypes. Load its real runtime with the minimal transport
// contract used by this test; keep strict checking enabled for all project sources.
const { StreamableHTTPClientTransport } = createRequire(import.meta.url)('@modelcontextprotocol/sdk/client/streamableHttp.js') as {
  StreamableHTTPClientTransport: new (url: URL, options: { requestInit: RequestInit }) => Transport;
};

test('AC-010-05/06/07 — conexión MCP HTTP real de consulta y administración protegida', { timeout: 180_000 }, async t => {
  const db = await startLocalPostgres(resolve('.local/agent-mcp-' + randomUUID()), { password: randomBytes(32).toString('hex') });
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const app = await createApp({ pool: db.pool, origin });
  const clients: Client[] = [];
  try {
    await migrate(db.pool); await app.listen({ port, host: '127.0.0.1' });
    const setup = await app.inject({ method: 'POST', url: '/api/setup', headers: { host: `127.0.0.1:${port}`, 'x-nativos-request': '1' }, payload: { name: 'Dueño MCP', login: 'mcp-owner', password: randomBytes(24).toString('base64url') } });
    assert.equal(setup.statusCode, 201, setup.body);
    const ownerId = setup.json().actorId as string;
    const admin = { host: `127.0.0.1:${port}`, cookie: `nativos_session=${setup.cookies[0]!.value}`, 'x-nativos-request': '1' };
    const create = await app.inject({ method: 'POST', url: '/api/agents/read-only', headers: admin, payload: { name: 'MCP Centro', branchIds: ['centro'], reason: 'Consulta sintética MCP' } });
    assert.equal(create.statusCode, 201, create.body);
    const agent = create.json() as { id: string; token: string; actions: string[] };
    assert.deepEqual(agent.actions, ['data.read']);
    await db.pool.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES('mcp-a','Insumo A','mcp-a','raw','unit'),('mcp-b','Insumo B','mcp-b','raw','unit')");
    await db.pool.query("INSERT INTO inventory_movements(id,item_id,warehouse_id,kind,quantity,reason) VALUES('mcp-stock','mcp-a','centro-venta','initial','7','Cantidad sintética')");
    await db.pool.query("INSERT INTO pos_shifts(id,device_id,branch_id,actor_id,opening_cash,opened_at) VALUES('mcp-shift','centro-caja','centro',$1,0,'2026-10-15T12:00:00Z')", [ownerId]);
    const sale = { id: 'mcp-sale', customer: { id: 'mcp-customer' }, lines: [{ productId: 'mcp-product' }], products: '1000', discount: '0', tipPaid: '0', shippingPaid: '0', cashApplied: '1000', payments: [{ method: 'cash', applied: '1000' }] };
    await db.pool.query("INSERT INTO pos_sales(id,order_id,shift_id,device_id,branch_id,actor_id,receipt_number,data,cash_applied,occurred_at,review_required) VALUES('mcp-sale','mcp-order','mcp-shift','centro-caja','centro',$1,'mcp-receipt',$2,'1000','2026-10-15T13:00:00Z',false)", [ownerId, JSON.stringify(sale)]);
    async function connect(token: string, path = READ_ONLY_MCP_PATH) {
      const client = new Client({ name: 'nativos-acceptance', version: '1.0.0' }); clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(origin + path), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
      return client;
    }
    const client = await connect(agent.token);
    const parse = (result: Awaited<ReturnType<Client['callTool']>>) => {
      const content = result.content as { type: string; text: string }[];
      return JSON.parse(content[0]!.text);
    };
    await t.test('AC-010-05: SDK inicializa, notifica y descubre consultas con esquemas completos', async () => {
      const { tools } = await client.listTools();
      assert.equal(tools.length, 6); assert.ok(tools.every(tool => tool.annotations?.readOnlyHint));
      assert.ok(!tools.some(tool => tool.name.includes('import')));
      const report = tools.find(tool => tool.name === 'nativos_report_get')!;
      assert.ok(report.inputSchema.properties?.from); assert.ok(report.inputSchema.properties?.limit);
      const context = parse(await client.callTool({ name: 'nativos_context_get', arguments: {} }));
      assert.deepEqual(context.branches.map((branch: { id: string }) => branch.id), ['centro']);
      assert.equal(context.branches[0].lastSynchronizedAt, null); assert.ok(context.branches[0].warehouses.every((warehouse: { id: string }) => warehouse.id.startsWith('centro')));
      const first = parse(await client.callTool({ name: 'nativos_inventory_list', arguments: { branchId: 'centro', limit: 1 } }));
      assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
      const second = parse(await client.callTool({ name: 'nativos_inventory_list', arguments: { branchId: 'centro', limit: '1', after: first.nextCursor } }));
      assert.notEqual(second.items[0].id, first.items[0].id); assert.doesNotMatch(JSON.stringify(first), /cost|token|hash/i);
      for (const name of ['nativos_products_list', 'nativos_recipes_list', 'nativos_movements_list']) assert.notEqual((await client.callTool({ name, arguments: { branchId: 'centro' } })).isError, true);
    });
    await t.test('AC-010-05: informes filtran fechas de Colombia, producto, cliente y medio', async () => {
      const args = { branchId: 'centro', kind: 'sales', from: '2026-10-15', to: '2026-10-15', productId: 'mcp-product', customerId: 'mcp-customer', paymentMethod: 'cash', limit: 1 };
      const report = parse(await client.callTool({ name: 'nativos_report_get', arguments: args }));
      assert.equal(report.items.length, 1); assert.equal(report.items[0].id, 'mcp-sale'); assert.equal(report.context.from, args.from);
      assert.equal(report.context.lastSynchronizedAt.centro, null);
      const empty = parse(await client.callTool({ name: 'nativos_report_get', arguments: { ...args, from: '2026-10-14', to: '2026-10-14' } }));
      assert.equal(empty.items.length, 0);
      const all = parse(await client.callTool({ name: 'nativos_report_get', arguments: { branchId: 'all', kind: 'sales' } }));
      assert.deepEqual(all.context.branchIds, ['centro']);
      for (const arguments_ of [{ ...args, from: '2026-02-30' }, { ...args, sql: 'SELECT 1' }, { ...args, limit: 101 }, { ...args, supplierId: 'supplier' }])
        assert.equal((await client.callTool({ name: 'nativos_report_get', arguments: arguments_ })).isError, true);
    });
    await t.test('AC-010-06: sucursal, compras y escritura denegadas sin efectos comerciales', async () => {
      const before = (await db.pool.query('SELECT count(*) FROM inventory_movements')).rows[0].count;
      assert.equal((await client.callTool({ name: 'nativos_inventory_list', arguments: { branchId: 'milan' } })).isError, true);
      assert.equal((await client.callTool({ name: 'nativos_report_get', arguments: { branchId: 'centro', kind: 'purchases' } })).isError, true);
      assert.equal((await client.callTool({ name: 'nativos_inventory_import_confirm', arguments: {} })).isError, true);
      const privileged = await app.inject({ method: 'POST', url: '/api/agents', headers: admin, payload: { name: 'MCP amplio', branchIds: ['centro'], actions: ['data.read', 'inventory.manage'], reason: 'Verificación de endpoint de consulta' } });
      const wide = await connect(privileged.json().token);
      assert.equal((await wide.listTools()).tools.length, 6);
      assert.equal((await wide.callTool({ name: 'nativos_inventory_import_confirm', arguments: { previewFingerprint: 'x' } })).isError, true);
      const legacy = await connect(privileged.json().token, MCP_PATH);
      assert.ok((await legacy.listTools()).tools.some(tool => tool.name === 'nativos_inventory_import_confirm'));
      assert.equal((await db.pool.query('SELECT count(*) FROM inventory_movements')).rows[0].count, before);
    });
    await t.test('AC-010-05/07: Bearer obligatorio, origen/host/CSRF protegidos y secretos ausentes', async () => {
      const list = await app.inject({ method: 'GET', url: '/api/agents', headers: admin });
      assert.equal(list.statusCode, 200); assert.ok(list.json().items.some((item: { id: string }) => item.id === agent.id));
      assert.doesNotMatch(list.body, /token|hash|password/i);
      assert.equal((await app.inject({ method: 'POST', url: '/api/agents/read-only', headers: admin, payload: { name: 'No', branchIds: ['centro'], actions: ['inventory.manage'], reason: 'Intento' } })).statusCode, 400);
      const rpc = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
      const bearer = { host: admin.host, authorization: `Bearer ${agent.token}`, accept: 'application/json, text/event-stream' };
      for (const path of [MCP_PATH, READ_ONLY_MCP_PATH]) {
        assert.equal((await app.inject({ method: 'POST', url: path, headers: { ...admin, accept: bearer.accept }, payload: rpc })).statusCode, 401);
        assert.equal((await app.inject({ method: 'POST', url: path, headers: { ...bearer, origin: 'https://otro.example' }, payload: rpc })).statusCode, 403);
        assert.equal((await app.inject({ method: 'POST', url: path, headers: { ...bearer, host: 'otro.example' }, payload: rpc })).statusCode, 403);
        assert.equal((await app.inject({ method: 'GET', url: path, headers: bearer })).statusCode, 405);
        assert.equal((await app.inject({ method: 'DELETE', url: path, headers: bearer })).statusCode, 405);
      }
      assert.equal((await app.inject({ method: 'POST', url: '/api/logout', headers: { host: admin.host, cookie: admin.cookie }, payload: {} })).statusCode, 403);
      const password = randomBytes(24).toString('base64url');
      const cashier = await app.inject({ method: 'POST', url: '/api/users', headers: admin, payload: { name: 'Cajero MCP', login: 'mcp-cashier', password, role: 'cashier', branchIds: ['centro'], reason: 'Prueba sintética de permisos' } });
      assert.equal(cashier.statusCode, 201, cashier.body);
      const login = await app.inject({ method: 'POST', url: '/api/login', headers: admin, payload: { login: 'mcp-cashier', password } });
      const cashierHeaders = { ...admin, cookie: `nativos_session=${login.cookies[0]!.value}` };
      assert.equal((await app.inject({ method: 'GET', url: '/api/agents', headers: cashierHeaders })).statusCode, 403);
      assert.equal((await app.inject({ method: 'POST', url: '/api/agents/read-only', headers: cashierHeaders, payload: { name: 'No permitido', branchIds: ['centro'], reason: 'Prueba' } })).statusCode, 403);
      await db.pool.query("UPDATE app_users SET branch_ids=ARRAY['milan'] WHERE id=$1", [ownerId]);
      assert.equal((await app.inject({ method: 'GET', url: '/api/agents', headers: admin })).json().items.length, 0);
      assert.equal((await app.inject({ method: 'POST', url: `/api/agents/${agent.id}/rotate`, headers: admin, payload: { reason: 'Fuera de alcance' } })).statusCode, 403);
      await db.pool.query("UPDATE app_users SET branch_ids=ARRAY['centro','milan'] WHERE id=$1", [ownerId]);
    });
    await t.test('AC-010-07: renovación y revocación invalidan clientes ya conectados', async () => {
      const rotated = await app.inject({ method: 'POST', url: `/api/agents/${agent.id}/rotate`, headers: admin, payload: { reason: 'Rotación sintética' } });
      assert.equal(rotated.statusCode, 200); assert.notEqual(rotated.json().token, agent.token);
      await assert.rejects(() => client.listTools());
      const replacement = await connect(rotated.json().token);
      assert.equal((await replacement.listTools()).tools.length, 6);
      const revoked = await app.inject({ method: 'PATCH', url: `/api/agents/${agent.id}`, headers: admin, payload: { active: false, reason: 'Fin de prueba' } });
      assert.equal(revoked.statusCode, 200);
      await assert.rejects(() => replacement.listTools());
      const audit = (await db.pool.query("SELECT changes FROM audit_events WHERE action LIKE 'agent.%'")).rows;
      assert.ok(audit.length >= 4); assert.doesNotMatch(JSON.stringify(audit), /token|password|hash/i);
    });
  } finally { for (const client of clients) await client.close(); await app.close(); await db.stop(); }
});
