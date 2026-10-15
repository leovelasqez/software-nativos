import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { Ajv } from 'ajv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Action } from '../contracts.ts';
import { authenticateAgent } from './security.ts';

export const MCP_PATH = '/api/agent/v1/mcp';
export const READ_ONLY_MCP_PATH = MCP_PATH + '/read-only';
const id = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' };
const paging = {
  after: { type: 'string', maxLength: 257 },
  limit: { anyOf: [{ type: 'integer', minimum: 1, maximum: 100 }, { type: 'string', pattern: '^(0*[1-9][0-9]?|0*100)$' }] }
};
type Definition = { tool: Tool; path: string; method: 'GET' | 'POST'; action: Action };
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
function read(name: string, description: string, path: string, properties: Record<string, object>, required: string[]): Definition {
  return { tool: { name, description, inputSchema: { type: 'object', additionalProperties: false, properties, required }, annotations: readAnnotations }, path, method: 'GET', action: 'data.read' };
}
const definitions: Definition[] = [
  read('nativos_context_get', 'Descubre sucursales y bodegas autorizadas y su última sincronización. Consúltalo primero. Los datos centrales pueden excluir ventas todavía offline.', '/api/agent/v1/context', {}, []),
  read('nativos_products_list', 'Consulta productos sin costos. Catálogo compartido; branchId es una sucursal autorizada. Recorre nextCursor para completar resultados.', '/api/agent/v1/products', { branchId: id, ...paging, q: { type: 'string', maxLength: 100 } }, ['branchId']),
  read('nativos_recipes_list', 'Consulta recetas activas sin costos. Catálogo compartido; recorre nextCursor para completar resultados.', '/api/agent/v1/recipes', { branchId: id, ...paging }, ['branchId']),
  read('nativos_inventory_list', 'Existencias y mínimos por bodega de la sucursal. Datos centrales; revisa contexto de sincronización. Recorre nextCursor.', '/api/agent/v1/inventory', { branchId: id, ...paging }, ['branchId']),
  read('nativos_movements_list', 'Consulta movimientos de inventario sin costos de la sucursal. Recorre nextCursor.', '/api/agent/v1/movements', { branchId: id, ...paging }, ['branchId']),
  read('nativos_report_get', 'Informe con totales, filtros y última sincronización. Fechas inclusivas de Colombia YYYY-MM-DD. branchId admite all para las sucursales autorizadas. sales/sellers: producto, cliente, vendedor, medio; purchases: proveedor/medio (requiere purchase.read); waste: producto; loyalty: cliente. Otros filtros incompatibles se rechazan. Recorre nextCursor; no sumes totales de nuevo por página.', '/api/agent/v1/reports', {
    branchId: id, ...paging, kind: { type: 'string', enum: ['sales', 'sellers', 'cash', 'inventory', 'purchases', 'waste', 'loyalty'] },
    from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    productId: id, customerId: id, supplierId: id, sellerId: id, paymentMethod: { type: 'string', maxLength: 30 }
  }, ['branchId', 'kind']),
  ...(['inventory', 'catalog'] as const).flatMap(kind => (['preview', 'confirm'] as const).map(stage => ({
    tool: { name: `nativos_${kind}_import_${stage}`, description: `${stage === 'preview' ? 'Valida sin aplicar' : 'Confirma'} un lote de ${kind === 'catalog' ? 'productos y recetas' : 'inventario'}.`,
      inputSchema: { type: 'object' as const, ...(stage === 'confirm' ? { required: ['previewFingerprint'] } : {}) },
      annotations: { readOnlyHint: stage === 'preview', destructiveHint: stage === 'confirm', idempotentHint: true, openWorldHint: false } },
    path: `/api/agent/v1/imports/${kind === 'catalog' ? 'catalog/' : ''}${stage}`, method: 'POST' as const,
    action: (kind === 'catalog' ? 'product.create' : 'inventory.manage') as Action
  })))
];
const validator = new Ajv({ strict: false, coerceTypes: false, removeAdditional: false });
const validators = new Map(definitions.map(definition => [definition.tool.name, validator.compile(definition.tool.inputSchema)]));

export function registerAgentMcp(app: FastifyInstance, pool: Pool) {
  for (const path of [MCP_PATH, READ_ONLY_MCP_PATH]) {
    app.route({ method: ['GET', 'DELETE'], url: path, handler: async (req, reply) => {
      await authenticateAgent(pool, req);
      return reply.header('Allow', 'POST').code(405).send({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Usa POST; el servidor no mantiene sesiones ni un canal SSE.' } });
    } });
    app.post(path, { bodyLimit: 1_100_000 }, async (req, reply) => {
      const actor = await authenticateAgent(pool, req);
      const available = definitions.filter(definition => actor.user.actions.includes(definition.action)
        && (path !== READ_ONLY_MCP_PATH || definition.method === 'GET'));
      // Low-level SDK server preserves the existing versioned JSON Schemas; AJV validates every call.
      const server = new Server({ name: path === READ_ONLY_MCP_PATH ? 'nativos-read-only' : 'nativos-agent-api', version: '1.1.0' }, {
        capabilities: { tools: {} }, instructions: 'Consulta primero nativos_context_get. Usa sólo sucursales autorizadas y completa nextCursor. Comprueba lastSynchronizedAt antes de presentar los datos como actuales. Moneda COP, zona America/Bogota.'
      });
      server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: available.map(definition => definition.tool) }));
      server.setRequestHandler(CallToolRequestSchema, async request => {
        const definition = available.find(candidate => candidate.tool.name === request.params.name);
        const args = request.params.arguments ?? {};
        if (!definition || !validators.get(definition.tool.name)!(args)) return {
          content: [{ type: 'text' as const, text: JSON.stringify({ code: definition ? 'invalid_arguments' : 'forbidden', message: definition ? 'Revisa los argumentos de la herramienta.' : 'Herramienta no autorizada para esta conexión.' }) }], isError: true
        };
        const route = definition.path + (definition.tool.name === 'nativos_report_get' ? '/' + encodeURIComponent(String(args.kind)) : '');
        const query = new URLSearchParams(Object.entries(args).filter(([key]) => key !== 'kind').map(([key, value]) => [key, String(value)]));
        const headers = { host: req.headers.host!, authorization: req.headers.authorization!, 'x-nativos-request': '1' };
        const response = await app.inject({ method: definition.method, url: definition.method === 'GET' ? route + '?' + query : route,
          headers, ...(definition.method === 'POST' ? { payload: args } : {}) });
        return { content: [{ type: 'text' as const, text: response.body }], ...(response.statusCode >= 400 ? { isError: true } : {}) };
      });
      // Omitted sessionIdGenerator selects stateless mode. Use the web-standard SDK transport
      // so Fastify retains ownership of the response and its security headers.
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      await server.connect(transport);
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        const response = await transport.handleRequest(new Request(`http://${req.headers.host}${req.url}`, { method: 'POST', headers, body: JSON.stringify(req.body) }), { parsedBody: req.body });
        response.headers.forEach((value, name) => reply.header(name, value));
        return reply.code(response.status).send(response.status === 202 ? undefined : await response.text());
      } finally { await server.close(); }
    });
  }
}
