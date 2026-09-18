import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import contract from '../../contracts/foundation-api-v1.json' with { type: 'json' };
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { defaultActions } from '../../src/permissions.ts';
import { tokenHash } from '../../src/server/security.ts';
import type { UserRow } from '../../src/server/db.ts';

test('Incremento 1 — PostgreSQL real, API y persistencia', { timeout: 180_000 }, async t => {
  const directory = resolve(`.local/test-${randomUUID()}`);
  const dbPassword = randomBytes(32).toString('base64url');
  const password = randomBytes(24).toString('base64url');
  let db = await startLocalPostgres(directory, { password: dbPassword });
  let app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4310' });
  let ownerCookie = ''; let ownerId = ''; let managerCookie = ''; let managerId = ''; let cashierCookie = ''; let cashierId = '';
  let addressCounter = 1;
  const ajv = new Ajv2020({ strict: false });
  const responseValidators = new Map<string, ReturnType<typeof ajv.compile>>();
  const paths = contract.paths as unknown as Record<string, Record<string, { responses: Record<string, { content: { 'application/json': { schema: object } } }> }>>;
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      for (const [status, response] of Object.entries(op.responses)) {
        responseValidators.set(`${method} ${path} ${status}`, ajv.compile(response.content['application/json'].schema));
      }
    }
  }
  const request = async (method: 'GET' | 'POST' | 'PATCH', url: string, body?: object, cookie = ownerCookie, overrides: Record<string, string> = {}) => {
    const response = await app.inject({ method, url, ...(body === undefined ? {} : { payload: body }),
      remoteAddress: `127.1.0.${(addressCounter++ % 200) + 1}`,
      headers: { host: '127.0.0.1:4310', 'x-nativos-request': '1', ...(cookie ? { cookie } : {}), ...overrides } });
    const result = response.json();
    const spec = Object.keys(contract.paths).find(p => new RegExp(`^${p.replaceAll(/\{[^}]+\}/g, '[^/]+')}$`).test(url.split('?')[0]!));
    const validate = responseValidators.get(`${method.toLowerCase()} ${spec} ${response.statusCode}`);
    assert.ok(validate, `Respuesta sin contrato: ${method} ${url} ${response.statusCode}`);
    assert.ok(validate(result), JSON.stringify(validate.errors));
    assert.ok(!response.body.includes(password), 'No exponer contraseña');
    assert.ok(!response.body.includes('password_hash'), 'No exponer hash');
    assert.ok(!response.body.includes('token_hash'), 'No exponer sesión');
    return response;
  };
  const login = async (name: string) => {
    const r = await request('POST', '/api/login', { login: name, password }, '');
    assert.equal(r.statusCode, 200, r.body); return r.cookies[0]!.name + '=' + r.cookies[0]!.value;
  };
  try {
    await t.test('AC-001-05/09: migración repetible y configuración inicial concurrente', async () => {
      await migrate(db.pool); await migrate(db.pool);
      assert.equal((await db.pool.query('SELECT count(*) FROM branches')).rows[0].count, '2');
      assert.deepEqual((await request('GET', '/api/status', undefined, '')).json(), { setupRequired: true });
      const responses = await Promise.all(['owner-test', 'other-owner-test'].map(login => request('POST', '/api/setup', { name: 'Dueño de prueba', login, password }, '')));
      assert.deepEqual(responses.map(r => r.statusCode).sort(), [201, 409]);
      const success = responses.find(r => r.statusCode === 201)!;
      ownerCookie = success.cookies[0]!.name + '=' + success.cookies[0]!.value;
      assert.ok(success.headers['set-cookie']?.toString().includes('HttpOnly'));
      assert.ok(success.headers['set-cookie']?.toString().includes('SameSite=Strict'));
      const me = (await request('GET', '/api/me')).json(); ownerId = me.user.id;
      assert.deepEqual(me.branches.map((b: { id: string }) => b.id).sort(), ['centro', 'milan']);
      assert.equal((await db.pool.query('SELECT count(*) FROM app_users')).rows[0].count, '1');
      const raw = (await db.pool.query<UserRow>('SELECT * FROM app_users')).rows[0]!;
      assert.ok(raw.password_hash.startsWith('scrypt-v1$')); assert.notEqual(raw.password_hash, password);
      const checksum = (await db.pool.query("SELECT checksum FROM schema_migrations WHERE name='001-foundation.sql'")).rows[0].checksum;
      await db.pool.query("UPDATE schema_migrations SET checksum='invalid-test-checksum' WHERE name='001-foundation.sql'");
      try { await assert.rejects(migrate(db.pool), /migration_checksum_mismatch/); }
      finally { await db.pool.query("UPDATE schema_migrations SET checksum=$1 WHERE name='001-foundation.sql'", [checksum]); }
    });
    await t.test('AC-001-06: CSRF, origen, Host, cuerpo cerrado y sesión requerida', async () => {
      const health = await app.inject({ method: 'GET', url: '/health', headers: { host: 'railway-healthcheck.internal' } });
      assert.equal(health.statusCode, 200); assert.deepEqual(health.json(), { ok: true });
      assert.equal((await request('POST', '/api/branches', { name: 'No crear', reason: 'Prueba' }, ownerCookie, { 'x-nativos-request': '' })).statusCode, 403);
      assert.equal((await request('POST', '/api/branches', { name: 'No crear', reason: 'Prueba' }, ownerCookie, { origin: 'https://other.invalid' })).statusCode, 403);
      assert.equal((await request('GET', '/api/me', undefined, ownerCookie, { host: 'other.invalid' })).statusCode, 403);
      assert.equal((await request('GET', '/api/me', undefined, '')).statusCode, 401);
      assert.equal((await request('POST', '/api/branches', { name: 'No crear', reason: 'Prueba', role: 'owner' })).statusCode, 400);
      assert.equal((await request('GET', '/api/audit?limit=101')).statusCode, 400);
    });
    await t.test('AC-001-07: alta de usuarios y límites de permisos exclusivos', async () => {
      for (const role of ['manager', 'cashier'] as const) {
        const r = await request('POST', '/api/users', { name: `${role} de prueba`, login: `${role}-test`, password, role, branchIds: ['centro'], reason: 'Fixture aislada' });
        assert.equal(r.statusCode, 201, r.body);
        if (role === 'manager') managerId = r.json().id; else cashierId = r.json().id;
      }
      managerCookie = await login('manager-test'); cashierCookie = await login('cashier-test');
      const bad = await request('PATCH', `/api/users/${cashierId}`, { actions: ['data.read', 'cost.read'], reason: 'No permitido' });
      assert.equal(bad.statusCode, 400);
      assert.equal((await request('POST', '/api/users', { name: 'Duplicado', login: 'CASHIER-TEST', password, role: 'cashier', branchIds: ['centro'], reason: 'Prueba duplicado' })).statusCode, 409);
    });
    await t.test('AC-001-01/07: alcance de Centro aplicado en API y administración denegada', async () => {
      for (const cookie of [managerCookie, cashierCookie]) {
        assert.equal((await request('GET', '/api/branches/milan', undefined, cookie)).statusCode, 403);
        const detail = await request('GET', '/api/branches/centro', undefined, cookie); assert.equal(detail.statusCode, 200);
        assert.equal(detail.json().devices[0].printerModel, 'T82E');
        assert.equal((await request('GET', '/api/branches', undefined, cookie)).json().items.length, 1);
        assert.equal((await request('GET', '/api/users', undefined, cookie)).statusCode, 403);
        assert.equal((await request('GET', '/api/audit', undefined, cookie)).statusCode, 403);
        assert.equal((await request('PATCH', `/api/users/${ownerId}`, { role: 'cashier', reason: 'Intento indebido' }, cookie)).statusCode, 403);
      }
      assert.equal((await request('GET', '/api/branches/milan')).json().devices[0].printerModel, 'T80A');
    });
    await t.test('AC-001-06/07: cambios revocan sesiones y protegen último administrador', async () => {
      assert.equal((await request('PATCH', `/api/users/${managerId}`, { active: false, reason: 'Prueba revocación' })).statusCode, 200);
      assert.equal((await request('GET', '/api/me', undefined, managerCookie)).statusCode, 401);
      assert.equal((await request('PATCH', `/api/users/${managerId}`, { active: true, reason: 'Reactivar fixture' })).statusCode, 200);
      managerCookie = await login('manager-test');
      const results = await Promise.all([
        request('PATCH', `/api/users/${ownerId}`, { active: false, reason: 'Prueba último dueño' }),
        request('PATCH', `/api/users/${ownerId}`, { actions: ['data.read'], reason: 'Prueba último dueño' }),
      ]);
      assert.deepEqual(results.map(r => r.statusCode), [409, 409]);
      assert.equal((await request('GET', '/api/me')).statusCode, 200);
      const cookie = await login('cashier-test');
      await db.pool.query('UPDATE sessions SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1', [tokenHash(cookie.split('=')[1]!)]);
      assert.equal((await request('GET', '/api/me', undefined, cookie)).statusCode, 401);
      assert.equal((await request('POST', '/api/logout', {}, cashierCookie)).statusCode, 200);
      assert.equal((await request('GET', '/api/me', undefined, cashierCookie)).statusCode, 401);
    });
    await t.test('AC-001-08: bodega predeterminada y caja activa únicas, referencias de local', async () => {
      const w = await request('POST', '/api/branches/centro/warehouses', { name: 'Bodega de prueba', isDefault: true, reason: 'Fixture de bodega' }); assert.equal(w.statusCode, 201);
      const detail = (await request('GET', '/api/branches/centro')).json();
      assert.equal(detail.warehouses.filter((w: { isDefault: boolean }) => w.isDefault).length, 1);
      assert.equal((await request('PATCH', `/api/branches/centro/warehouses/${w.json().id}`, { isDefault: false, reason: 'No dejar sin predeterminada' })).statusCode, 409);
      assert.equal((await request('POST', '/api/branches/centro/devices', { name: 'Otra caja', active: true, printerModel: null, reason: 'No duplicar caja' })).statusCode, 409);
      assert.equal((await request('PATCH', '/api/branches/milan/devices/centro-caja', { name: 'Cruce incorrecto', reason: 'Referencia ajena' })).statusCode, 404);
    });
    await t.test('AC-001-08/09: auditoría atómica, rollback y append-only en PostgreSQL', async () => {
      const before = (await db.pool.query('SELECT count(*) FROM branches')).rows[0].count;
      await db.pool.query("CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='branch.created' THEN RAISE EXCEPTION 'injected_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_audit_test BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_audit()");
      try { assert.equal((await request('POST', '/api/branches', { name: 'Debe revertirse', reason: 'Fallo inducido en prueba' })).statusCode, 500); }
      finally { await db.pool.query('DROP TRIGGER reject_audit_test ON audit_events; DROP FUNCTION test_reject_audit()'); }
      assert.equal((await db.pool.query('SELECT count(*) FROM branches')).rows[0].count, before);
      const r = await request('POST', '/api/branches', { name: 'Local sintético', reason: 'Fixture aislada' }); assert.equal(r.statusCode, 201);
      assert.equal((await request('GET', `/api/branches/${r.json().id}`)).json().warehouses.length, 1);
      for (const sql of ["UPDATE audit_events SET reason='cambio'", 'DELETE FROM audit_events', 'TRUNCATE audit_events']) await assert.rejects(db.pool.query(sql), /audit_is_append_only/);
    });
    await t.test('AC-001-07/09: auditoría paginada, cambios públicos y scope histórico', async () => {
      const first = (await request('GET', '/api/audit?limit=2')).json(); assert.equal(first.items.length, 2); assert.ok(first.nextCursor);
      const next = (await request('GET', `/api/audit?limit=2&before=${first.nextCursor}`)).json();
      assert.ok(next.items.every((item: { id: string }) => BigInt(item.id) < BigInt(first.nextCursor)));
      const auditRows = (await request('GET', '/api/audit?limit=100')).json().items;
      assert.ok(auditRows.some((row: { action: string; changes: object }) => row.action === 'user.updated' && Object.keys(row.changes).length > 0));
      const limited = await request('POST', '/api/users', { name: 'Dueño limitado', login: 'limited-owner', password, role: 'owner', branchIds: ['centro'], reason: 'Prueba aislamiento dueño' });
      assert.equal(limited.statusCode, 201); const cookie = await login('limited-owner');
      const ids = (await request('GET', '/api/users', undefined, cookie)).json().items.map((u: { id: string }) => u.id);
      assert.ok(!ids.includes(ownerId));
      assert.equal((await request('PATCH', `/api/users/${ownerId}`, { name: 'No cambiar', reason: 'Fuera de alcance' }, cookie)).statusCode, 404);
      const filtered = (await request('GET', '/api/audit', undefined, cookie)).json().items;
      assert.ok(!filtered.some((a: { action: string }) => a.action === 'setup.completed'));
      assert.equal((await request('GET', '/api/audit?branchId=milan', undefined, cookie)).statusCode, 403);
    });
    await t.test('AC-001-06: error de login genérico y bloqueo persistente por cuenta', async () => {
      const wrong = randomBytes(18).toString('hex');
      const known = await request('POST', '/api/login', { login: 'manager-test', password: wrong }, '');
      const absent = await request('POST', '/api/login', { login: 'not-existing', password: wrong }, '');
      assert.deepEqual(known.json(), absent.json());
      for (let i = 1; i < 5; i++) await request('POST', '/api/login', { login: 'manager-test', password: wrong }, '');
      assert.equal((await request('POST', '/api/login', { login: 'manager-test', password }, '')).statusCode, 401);
    });
    await t.test('AC-001-09: reinicio real de PostgreSQL/servidor conserva usuarios, sesiones, auditoría y bloqueo', async () => {
      const counts = (await db.pool.query('SELECT (SELECT count(*) FROM app_users) AS users,(SELECT count(*) FROM audit_events) AS events')).rows[0];
      await app.close(); await db.stop();
      db = await startLocalPostgres(directory, { password: dbPassword }); await migrate(db.pool);
      app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4310' });
      assert.deepEqual((await db.pool.query('SELECT (SELECT count(*) FROM app_users) AS users,(SELECT count(*) FROM audit_events) AS events')).rows[0], counts);
      assert.equal((await request('GET', '/api/me')).json().user.id, ownerId);
      assert.equal((await request('POST', '/api/login', { login: 'manager-test', password }, '')).statusCode, 401);
    });
    await t.test('AC-001-06: límite por IP también para cuentas inexistentes', async () => {
      let status = 0;
      for (let i = 0; i < 11; i++) {
        const response = await app.inject({ method: 'POST', url: '/api/login', remoteAddress: '127.2.2.2',
          headers: { host: '127.0.0.1:4310', 'x-nativos-request': '1' }, payload: { login: 'rate-test', password: 'invalid' } });
        status = response.statusCode;
      }
      assert.equal(status, 429);
    });
  } finally { await app.close(); await db.stop(); }
});
