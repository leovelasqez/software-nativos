import loyaltyContract from '../../contracts/loyalty-v1.schema.json' with {type:'json'};
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Order, Payment } from '../pos-domain.ts';
import localContract from '../../contracts/pos-local-v1.schema.json' with { type: 'json' };
import { routeSchema } from '../server/api-contract.ts';
import ordersContract from '../../contracts/orders-v3.schema.json' with { type: 'json' };
import customersContract from '../../contracts/customers-v1.schema.json' with { type: 'json' };
import type { CommandEvent } from '../orders-domain.ts';
import { PosEngine } from './engine.ts';
const id = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' };
const uuid = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' };
const decimal = { type: 'string', pattern: '^(0|[1-9][0-9]{0,8})(\\.[0-9]{1,6})?$' };
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export async function createPosApp(engine: PosEngine, origin: string, staticRoot?: string, automaticSync = true) {
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  await app.register(cookie); await app.register(rateLimit, { global: false });
  const sessions = new Map<string, { login: string; expires: number }>();
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin || !['GET','HEAD'].includes(req.method) && req.headers['x-nativos-request'] !== '1') return reply.code(403).send({ code: 'origin_denied', message: 'Origen no permitido.' });
  });
  app.setErrorHandler((e, _req, reply) => {
    const error = e as Error & { validation?: unknown; statusCode?: number; code?: string };
    return reply.code(error.statusCode === 401 ? 401 : error.statusCode === 429 ? 429 : 400).send({ code: error.validation ? 'invalid_input' : 'pos_error', message: error.validation ? 'Revisa los campos y formatos.' : error.code?.startsWith('ERR_SQLITE') ? 'No fue posible guardar la operación local. Conserva los archivos y vuelve a intentarlo.' : error.message });
  });
  const login = (req: FastifyRequest) => {
    const token = req.cookies.nativos_pos_session; const session = token ? sessions.get(token) : undefined;
    if (!session || session.expires <= Date.now()) { const e = new Error('Inicia sesión en esta caja.'); Object.assign(e, { statusCode: 401 }); throw e; } return session.login;
  };
  const createSession = (reply: FastifyReply, name: string) => {
    const token = randomBytes(32).toString('base64url'); sessions.set(token, { login: name, expires: Date.now() + 12 * 3600_000 });
    reply.setCookie('nativos_pos_session', token, { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 12 * 3600 });
  };
  app.get('/api/pos-local/status', () => engine.status());
  app.post('/api/pos-local/login', { schema: { body: object({ login: { type: 'string', minLength: 3, maxLength: 64 }, password: { type: 'string', minLength: 1, maxLength: 128 } }) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => engine.run(async () => {
    const b = req.body as { login: string; password: string }; const result = await engine.login(b.login, b.password);
    createSession(reply, b.login.toLowerCase()); return result;
  }));
  app.post('/api/pos-local/enroll', { schema: { body: object({ deviceId: id }) } }, async (req, reply) => engine.run(async () => {
    const result = await engine.enroll((req.body as { deviceId: string }).deviceId, login(req)); createSession(reply, result.login); return { ok: true };
  }));
  app.post('/api/pos-local/logout', { schema: { body: object({}) } }, async (req, reply) => {
    const token = req.cookies.nativos_pos_session; if (token) sessions.delete(token); reply.clearCookie('nativos_pos_session', { path: '/' }); return { ok: true };
  });
  app.post('/api/products', { schema: routeSchema('/api/products', 'post') }, req => engine.run(() => engine.createProduct(login(req), req.body as object)));
  app.post('/api/customers',{schema:{body:customersContract.create}},req=>engine.run(()=>engine.createCustomer(login(req),req.body as object)));
  app.post('/api/pos-local/loyalty/enroll',{schema:{body:loyaltyContract.enroll}},req=>engine.run(()=>engine.enrollLoyalty(login(req),req.body as object)));
  app.post('/api/pos-local/loyalty/refresh',{schema:{body:object({})}},req=>engine.run(()=>engine.refreshLoyalty(login(req))));
  app.post('/api/pos-local/loyalty/resolve',{schema:{body:object({cancel:{type:'boolean'}})}},req=>engine.run(()=>engine.resolveRedemption(login(req),(req.body as {cancel:boolean}).cancel)));
  app.get('/api/pos-local/v2/state',req=>engine.stateV2(login(req)));
  app.post('/api/pos-local/v2/select',{schema:{body:object({orderId:id})}},req=>engine.run(async()=>engine.selectOrder(login(req),(req.body as {orderId:string}).orderId)));
  app.post('/api/pos-local/v2/command',{schema:{body:object({operationId:uuid,event:ordersContract.commandEvent})}},req=>engine.run(()=>{const b=req.body as {operationId:string;event:CommandEvent};return engine.executeV2(login(req),b.operationId,b.event);}));
  app.get('/api/pos-local/state', req => engine.state(login(req)));
  app.put('/api/pos-local/order', { schema: { body: object({ order: localContract.draft }) } }, req => engine.run(() => engine.saveOrder(login(req), (req.body as { order: Order }).order)));
  for (const [path, kind, fields] of [
    ['/shift/open', 'shift.open', { operationId: uuid, openingCash: decimal }],
    ['/charge', 'sale.charge', { operationId: uuid, orderId: id, revision: { type: 'integer', minimum: 1 }, payment: localContract.payment }],
    ['/shift/close', 'shift.close', { operationId: uuid, counted: decimal }],
  ] as const) app.post('/api/pos-local' + path, { schema: { body: object(fields) } }, req => engine.run(() => engine.execute(login(req), kind, req.body as { operationId: string; openingCash?: string; counted?: string; orderId?: string; revision?: number; payment?: Payment })));
  app.post('/api/pos-local/sync', { schema: { body: object({}) } }, req => engine.run(async () => { login(req); await engine.sync(); return engine.state(login(req)); }));
  app.get('/api/pos-local/receipt/:id', { schema: { params: object({ id }) } }, req => {
    engine.access(login(req), 'data.read'); const receipt = engine.store.receipt((req.params as { id: string }).id); if (!receipt) throw new Error('No se encontró el comprobante.'); return receipt;
  });
  if (staticRoot) { await app.register(serveStatic, { root: staticRoot, index: false }); app.get('/', (_req, reply) => reply.sendFile('pos.html')); }
  let syncing = false;
  const timer = automaticSync ? setInterval(() => {
    if (syncing) return; syncing = true;
    void engine.run(() => engine.sync()).catch(e => { engine.message = (e as Error).message; }).finally(() => { syncing = false; });
  }, 15_000) : null;
  timer?.unref(); app.addHook('onClose', async () => { if (timer) clearInterval(timer); await engine.run(async () => engine.close()); });
  return app;
}
