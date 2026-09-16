import { registerLoyalty } from './loyalty-api.ts';
import Fastify from 'fastify';
import { registerCustomers } from './customers-api.ts';
import { registerPos } from './pos-api.ts';
import { registerCatalog } from './catalog-api.ts';
import { registerReports } from './reports-api.ts';
import { registerBackups } from './backup-api.ts';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { defaultActions } from '../authorization.ts';
import type { Action, Role } from '../contracts.ts';
import { transaction, audit, publicUser } from './db.ts';
import type { Actor, UserRow } from './db.ts';
import { ApiError, authenticate, requireAccess, requireAdmin, notFound,
  hashPassword, verifyPassword, newSession, SESSION_MS } from './security.ts';
import { routeSchema } from './api-contract.ts';

interface UserInput { name: string; login: string; password: string; role: Role; branchIds: string[]; actions?: Action[]; active?: boolean; reason: string }
interface ResourceInput { name: string; reason: string; active: boolean; isDefault: boolean; printerModel: string | null }
type Params = { id: string; resourceId: string };
export interface AppOptions { pool: Pool; origin: string; staticRoot?: string; backupDirectory?: string; backupRestoreDatabase?: string; backupRestoreConnection?: PoolConfig }

export async function createApp({ pool, origin, staticRoot, backupDirectory, backupRestoreDatabase, backupRestoreConnection }: AppOptions) {
  const allowed = new URL(origin);
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerCatalog(app, pool);
  registerReports(app, pool);
  registerBackups(app, pool, backupDirectory, backupRestoreDatabase, backupRestoreConnection);
  registerPos(app, pool);
  registerCustomers(app, pool);
  registerLoyalty(app, pool);
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.headers.host !== allowed.host) throw new ApiError(403, 'invalid_host', 'Origen no permitido.');
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (req.headers.origin && req.headers.origin !== origin) throw new ApiError(403, 'invalid_origin', 'Origen no permitido.');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-nativos-request'] !== '1')
      throw new ApiError(403, 'csrf_required', 'Solicitud no permitida. Recarga la aplicación.');
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as { validation?: unknown; code?: string; statusCode?: number; message?: string };
    if (e.validation) return reply.code(400).send({ code: 'invalid_input', message: 'Revisa los campos y sus formatos.' });
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    if (e.code === '23505') return reply.code(409).send({ code: 'conflict', message: 'El registro ya existe o el local ya tiene una caja activa.' });
    if (e.code === '23503' || e.code === '23514') return reply.code(400).send({ code: 'invalid_reference', message: 'Revisa las referencias y los permisos.' });
    if (e.statusCode === 429) return reply.code(429).send({ code: 'rate_limited', message: 'Demasiados intentos. Espera un minuto.' });
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ code: 'invalid_request', message: 'Solicitud inválida.' });
    return reply.code(500).send({ code: 'internal_error', message: 'No se pudo completar la operación. Intenta de nuevo.' });
  });
  function sessionCookie(reply: FastifyReply, token: string) {
    reply.setCookie('nativos_session', token, { httpOnly: true, sameSite: 'strict',
      path: '/', secure: allowed.protocol === 'https:', maxAge: SESSION_MS / 1000 });
  }
  async function mutate<T>(req: FastifyRequest, run: (c: PoolClient, actor: Actor) => Promise<T>) {
    return transaction(pool, async c => {
      await c.query('SELECT pg_advisory_xact_lock(7301)');
      const actor = await authenticate(c, req); requireAdmin(actor);
      return run(c, actor);
    });
  }
  async function validateUser(c: PoolClient, actor: Actor, input: { role: Role; branchIds: string[]; actions: Action[] }) {
    if (input.branchIds.some(id => !actor.user.branch_ids.includes(id))) throw new ApiError(403, 'branch_denied', 'No puedes asignar otra sucursal.');
    const valid = await c.query('SELECT id FROM branches WHERE id=ANY($1::text[])', [input.branchIds]);
    if (valid.rowCount !== input.branchIds.length) throw new ApiError(400, 'invalid_branch', 'Sucursal no válida.');
    if (input.role !== 'owner' && input.actions.some(a => a.startsWith('cost.') || a === 'loyalty.adjust'))
      throw new ApiError(400, 'exclusive_permission', 'Costos y ajustes de puntos son exclusivos del dueño.');
  }
  app.get('/api/status', { schema: routeSchema('/api/status', 'get') }, async () => {
    const result = await pool.query('SELECT 1 FROM app_users LIMIT 1'); return { setupRequired: result.rowCount === 0 };
  });
  app.post('/api/setup', { schema: routeSchema('/api/setup', 'post'), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = req.body as Pick<UserInput, 'name' | 'login' | 'password'>;
    const session = await transaction(pool, async c => {
      await c.query('SELECT pg_advisory_xact_lock(7301)');
      if ((await c.query('SELECT 1 FROM app_users LIMIT 1')).rowCount) throw new ApiError(409, 'already_configured', 'El dueño inicial ya está configurado.');
      const ids = (await c.query<{ id: string }>('SELECT id FROM branches ORDER BY id')).rows.map(r => r.id);
      const user = (await c.query<UserRow>(`INSERT INTO app_users(id,name,login,password_hash,role,branch_ids,actions)
        VALUES($1,$2,$3,$4,'owner',$5,$6) RETURNING *`, [randomUUID(), body.name.trim(), body.login.toLowerCase(),
        await hashPassword(body.password), ids, defaultActions('owner')])).rows[0]!;
      const session = await newSession(c, user.id);
      await audit(c, { user, ...session }, 'setup.completed', 'Configuración inicial', { after: publicUser(user) });
      return session;
    });
    sessionCookie(reply, session.token); return reply.code(201).send({ ok: true });
  });
  app.post('/api/login', { schema: routeSchema('/api/login', 'post'), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = req.body as { login: string; password: string }; const login = body.login.toLowerCase();
    const session = await transaction(pool, async c => {
      await c.query('SELECT pg_advisory_xact_lock(7301)');
      const attempts = (await c.query<{ failures: number; blocked_until: Date | null }>('SELECT * FROM login_attempts WHERE login=$1', [login])).rows[0];
      if (attempts?.blocked_until && attempts.blocked_until.getTime() > Date.now()) return null;
      const user = (await c.query<UserRow>('SELECT * FROM app_users WHERE login=$1', [login])).rows[0];
      const valid = await verifyPassword(body.password, user?.password_hash ?? dummyHash);
      if (!user || !user.active || !valid) {
        const count = attempts?.blocked_until ? 1 : (attempts?.failures ?? 0) + 1;
        await c.query(`INSERT INTO login_attempts(login,failures,blocked_until) VALUES($1,$2,$3)
          ON CONFLICT(login) DO UPDATE SET failures=$2,blocked_until=$3`, [login, count, count >= 5 ? new Date(Date.now() + 15 * 60_000) : null]);
        return null;
      }
      await c.query('DELETE FROM login_attempts WHERE login=$1', [login]);
      const session = await newSession(c, user.id);
      await audit(c, { user, ...session }, 'session.login', 'Inicio de sesión', {});
      return session;
    });
    if (!session) throw new ApiError(401, 'invalid_credentials', 'No fue posible iniciar sesión. Revisa tus credenciales o espera si hubo varios intentos.');
    sessionCookie(reply, session.token); return { ok: true };
  });
  app.post('/api/logout', { schema: routeSchema('/api/logout', 'post') }, async (req, reply) => {
    await transaction(pool, async c => {
      const actor = await authenticate(c, req);
      await c.query('DELETE FROM sessions WHERE token_hash=$1', [actor.tokenHash]);
      await audit(c, actor, 'session.logout', 'Cierre de sesión', {});
    });
    reply.clearCookie('nativos_session', { path: '/' }); return { ok: true };
  });
  app.get('/api/me', { schema: routeSchema('/api/me', 'get') }, async req => {
    const actor = await authenticate(pool, req);
    const branches = (await pool.query('SELECT id,name FROM branches WHERE id=ANY($1::text[]) ORDER BY name', [actor.user.branch_ids])).rows;
    return { user: publicUser(actor.user), branches, deviceId: actor.deviceId };
  });
  app.get('/api/users', { schema: routeSchema('/api/users', 'get') }, async req => {
    const actor = await authenticate(pool, req); requireAdmin(actor);
    const users = await pool.query<UserRow>('SELECT id,name,login,role,active,branch_ids,actions FROM app_users WHERE branch_ids <@ $1::text[] ORDER BY name,id', [actor.user.branch_ids]);
    return { items: users.rows.map(publicUser) };
  });
  app.post('/api/users', { schema: routeSchema('/api/users', 'post') }, async (req, reply) => {
    const body = req.body as UserInput;
    const value = await mutate(req, async (c, actor) => {
      const actions = body.actions ?? defaultActions(body.role);
      await validateUser(c, actor, { ...body, actions });
      const user = (await c.query<UserRow>(`INSERT INTO app_users(id,name,login,password_hash,role,branch_ids,actions)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [randomUUID(), body.name.trim(), body.login.toLowerCase(),
        await hashPassword(body.password), body.role, body.branchIds, actions])).rows[0]!;
      await audit(c, actor, 'user.created', body.reason, { after: publicUser(user) }, null, user.branch_ids);
      return publicUser(user);
    });
    return reply.code(201).send(value);
  });
  app.patch('/api/users/:id', { schema: routeSchema('/api/users/{id}', 'patch') }, async req => {
    const body = req.body as Partial<UserInput> & { reason: string };
    return mutate(req, async (c, actor) => {
      const old = (await c.query<UserRow>('SELECT * FROM app_users WHERE id=$1 AND branch_ids <@ $2::text[] FOR UPDATE',
        [(req.params as Params).id, actor.user.branch_ids])).rows[0];
      if (!old) throw notFound();
      const role = body.role ?? old.role;
      const actions = body.actions ?? (role !== old.role ? defaultActions(role) : old.actions);
      const branchIds = body.branchIds ?? old.branch_ids;
      await validateUser(c, actor, { role, branchIds, actions });
      const user = (await c.query<UserRow>(`UPDATE app_users SET name=$2,login=$3,password_hash=$4,role=$5,active=$6,branch_ids=$7,actions=$8
        WHERE id=$1 RETURNING *`, [old.id, body.name?.trim() ?? old.name, body.login?.toLowerCase() ?? old.login,
        body.password ? await hashPassword(body.password) : old.password_hash, role, body.active ?? old.active, branchIds, actions])).rows[0]!;
      if (!(await c.query("SELECT 1 FROM app_users WHERE active AND role='owner' AND 'settings.manage'=ANY(actions)")).rowCount)
        throw new ApiError(409, 'last_admin', 'Debe quedar al menos un dueño activo con administración.');
      await c.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
      await audit(c, actor, 'user.updated', body.reason, { before: publicUser(old), after: publicUser(user), passwordChanged: Boolean(body.password) },
        null, [...new Set([...old.branch_ids, ...user.branch_ids])]);
      return publicUser(user);
    });
  });
  app.get('/api/branches', { schema: routeSchema('/api/branches', 'get') }, async req => {
    const actor = await authenticate(pool, req);
    return { items: (await pool.query('SELECT id,name FROM branches WHERE id=ANY($1::text[]) ORDER BY name', [actor.user.branch_ids])).rows };
  });
  app.get('/api/branches/:id', { schema: routeSchema('/api/branches/{id}', 'get') }, async req => {
    const actor = await authenticate(pool, req); const { id } = req.params as Params; requireAccess(actor, id);
    const branch = (await pool.query('SELECT id,name FROM branches WHERE id=$1', [id])).rows[0];
    if (!branch) throw notFound();
    const warehouses = (await pool.query('SELECT id,branch_id AS "branchId",name,is_default AS "isDefault" FROM warehouses WHERE branch_id=$1 ORDER BY name', [id])).rows;
    const devices = (await pool.query('SELECT id,branch_id AS "branchId",name,active,printer_model AS "printerModel" FROM devices WHERE branch_id=$1 ORDER BY name', [id])).rows;
    return { branch, warehouses, devices };
  });
  app.post('/api/branches', { schema: routeSchema('/api/branches', 'post') }, async (req, reply) => {
    const body = req.body as { name: string; reason: string };
    const branch = await mutate(req, async (c, actor) => {
      const branch = (await c.query('INSERT INTO branches(id,name) VALUES($1,$2) RETURNING *', [randomUUID(), body.name.trim()])).rows[0];
      await c.query('INSERT INTO warehouses(id,branch_id,name,is_default) VALUES($1,$2,$3,true)', [randomUUID(), branch.id, 'Bodega de venta']);
      await c.query('INSERT INTO devices(id,branch_id,name,active) VALUES($1,$2,$3,true)', [randomUUID(), branch.id, `Caja ${branch.name}`]);
      await c.query('UPDATE app_users SET branch_ids=array_append(branch_ids,$2) WHERE id=$1', [actor.user.id, branch.id]);
      await audit(c, actor, 'branch.created', body.reason, { after: branch }, branch.id, [branch.id]); return branch;
    }); return reply.code(201).send(branch);
  });
  app.patch('/api/branches/:id', { schema: routeSchema('/api/branches/{id}', 'patch') }, async req => {
    const body = req.body as { name: string; reason: string };
    return mutate(req, async (c, actor) => {
      const { id } = req.params as Params; requireAccess(actor, id, 'settings.manage');
      const before = (await c.query('SELECT * FROM branches WHERE id=$1', [id])).rows[0]; if (!before) throw notFound();
      const branch = (await c.query('UPDATE branches SET name=$2 WHERE id=$1 RETURNING *', [id, body.name.trim()])).rows[0];
      await audit(c, actor, 'branch.updated', body.reason, { before, after: branch }, id, [id]); return branch;
    });
  });
  for (const kind of ['warehouses', 'devices'] as const) {
    for (const method of ['post', 'patch'] as const) {
      const editing = method === 'patch';
      const specPath = `/api/branches/{id}/${kind}${editing ? '/{resourceId}' : ''}`;
      const path = `/api/branches/:id/${kind}${editing ? '/:resourceId' : ''}`;
      app.route({ method: method.toUpperCase() as 'POST' | 'PATCH', url: path, schema: routeSchema(specPath, method), handler: async (req, reply) => {
        const body = req.body as Partial<ResourceInput> & { reason: string };
        const value = await mutate(req, async (c, actor) => {
          const { id, resourceId } = req.params as Params; requireAccess(actor, id, 'settings.manage');
          if (!(await c.query('SELECT 1 FROM branches WHERE id=$1', [id])).rowCount) throw notFound();
          // Identifiers below come from fixed enums, never user input.
          const columns = kind === 'warehouses' ? 'id,branch_id AS "branchId",name,is_default AS "isDefault"'
            : 'id,branch_id AS "branchId",name,active,printer_model AS "printerModel"';
          const before = editing ? (await c.query(`SELECT ${columns} FROM ${kind} WHERE id=$1 AND branch_id=$2`, [resourceId, id])).rows[0] : null;
          if (editing && !before) throw notFound();
          const key = editing ? resourceId : randomUUID();
          let result;
          let previousDefaultWarehouseId: string | null = null;
          if (kind === 'warehouses') {
            const isDefault = body.isDefault ?? before?.isDefault ?? false;
            if (before?.isDefault && !isDefault) throw new ApiError(409, 'default_required', 'Selecciona otra bodega de venta antes de quitar esta asignación.');
            if (isDefault) {
              previousDefaultWarehouseId = (await c.query<{ id: string }>('SELECT id FROM warehouses WHERE branch_id=$1 AND is_default', [id])).rows[0]?.id ?? null;
              await c.query('UPDATE warehouses SET is_default=false WHERE branch_id=$1', [id]);
            }
            result = editing ? await c.query(`UPDATE warehouses SET name=$3,is_default=$4 WHERE id=$1 AND branch_id=$2 RETURNING ${columns}`, [key, id, body.name?.trim() ?? before.name, isDefault])
              : await c.query(`INSERT INTO warehouses(id,branch_id,name,is_default) VALUES($1,$2,$3,$4) RETURNING ${columns}`, [key, id, body.name!.trim(), isDefault]);
          } else {
            const model = body.printerModel === undefined ? before?.printerModel ?? null : body.printerModel;
            result = editing ? await c.query(`UPDATE devices SET name=$3,active=$4,printer_model=$5 WHERE id=$1 AND branch_id=$2 RETURNING ${columns}`, [key, id, body.name?.trim() ?? before.name, body.active ?? before.active, model])
              : await c.query(`INSERT INTO devices(id,branch_id,name,active,printer_model) VALUES($1,$2,$3,$4,$5) RETURNING ${columns}`, [key, id, body.name!.trim(), body.active!, model]);
          }
          const after = result.rows[0];
          await audit(c, actor, `${kind}.${editing ? 'updated' : 'created'}`, body.reason,
            { before, after, ...(kind === 'warehouses' ? { previousDefaultWarehouseId } : {}) }, id, [id]); return after;
        });
        return reply.code(editing ? 200 : 201).send(value);
      } });
    }
  }
  app.get('/api/audit', { schema: routeSchema('/api/audit', 'get') }, async req => {
    const actor = await authenticate(pool, req); requireAdmin(actor);
    const q = req.query as { branchId?: string; before?: string; limit?: string };
    if (q.branchId) requireAccess(actor, q.branchId, 'settings.manage');
    const limit = Number(q.limit ?? '30');
    const result = await pool.query(`SELECT id::text,actor_id AS "actorId",actor_kind AS "actorKind",device_id AS "deviceId",
      branch_id AS "branchId",operation_id AS "operationId",action,occurred_at AS "occurredAt",received_at AS "receivedAt",reason,changes
      FROM audit_events WHERE scope_branch_ids <@ $1::text[] AND ($2::text IS NULL OR branch_id=$2)
      AND ($3::bigint IS NULL OR id<$3::bigint) ORDER BY id DESC LIMIT $4`, [actor.user.branch_ids, q.branchId ?? null, q.before ?? null, limit + 1]);
    const items = result.rows.slice(0, limit).map(row => ({ ...row, occurredAt: row.occurredAt.toISOString(), receivedAt: row.receivedAt.toISOString() }));
    return { items, nextCursor: result.rows.length > limit ? items.at(-1)?.id ?? null : null };
  });
  if (staticRoot) {
    await app.register(serveStatic, { root: staticRoot });
    app.get('/caja', (_req,reply)=>reply.sendFile('pos.html'));
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.code(404).send({ code: 'not_found', message: 'Ruta no disponible.' }) : reply.sendFile('index.html'));
  }
  return app;
}
