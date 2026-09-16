import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { startLocalPostgres } from '../../scripts/local-postgres.ts';
import { migrate } from '../../src/server/db.ts';
import { createApp } from '../../src/server/app.ts';
import { payloadHash, verifyAuthorization } from '../../src/pos-crypto.ts';
import type { Authorization, PosEvent, Signed } from '../../src/pos-domain.ts';

test('Incremento 6 — movimientos manuales de caja conservan libro, corrección y cierre', { timeout: 120_000 }, async () => {
  const directory = resolve('.local/cash-test-' + randomUUID()); const password = randomBytes(24).toString('base64url');
  const db = await startLocalPostgres(directory, { password: randomBytes(32).toString('hex') });
  const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4340' });
  try {
    await migrate(db.pool);
    const inject = (url: string, payload?: object, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url, ...(payload === undefined ? {} : { payload }), headers: { host: '127.0.0.1:4340', 'x-nativos-request': '1', ...headers } });
    const setup = await inject('/api/setup', { name: 'Dueño Caja', login: 'owner-cash', password }); assert.equal(setup.statusCode, 201, setup.body);
    const cookie = `nativos_session=${setup.cookies[0]!.value}`;
    const branch = await app.inject({ method: 'GET', url: '/api/branches/centro', headers: { host: '127.0.0.1:4340', cookie } });
    const deviceId = branch.json().devices[0].id as string;
    const enrolled = await inject('/api/pos/enroll', { deviceId, installationId: randomUUID() }, { cookie }); assert.equal(enrolled.statusCode, 200, enrolled.body);
    const token = enrolled.json().token as string;
    const authorized = await inject('/api/pos/authorize', { deviceId, previous: null }, { cookie, 'x-pos-token': token }); assert.equal(authorized.statusCode, 200, authorized.body);
    const signed = authorized.json().signed as Signed; assert.equal(typeof signed?.document, 'string', authorized.body); assert.equal(typeof signed?.signature, 'string', authorized.body); assert.equal(typeof enrolled.json().publicKey, 'string', enrolled.body); let grant:Authorization;try{grant=verifyAuthorization(signed,enrolled.json().publicKey);}catch{throw new Error(authorized.body+'\n'+enrolled.body);}
    assert.ok(grant.grant.actions.includes('cash.movement'));
    let sequence = 0; let previous: string | null = null;
    const sync = async (event: PosEvent, operationId = randomUUID()) => {
      const payload = JSON.stringify(event); const operation = { version: 1 as const, operationId, deviceId, branchId: 'centro', actorId: grant.grant.actorId, sequence: ++sequence, previousOperationId: previous, payloadHash: payloadHash(payload), payloadVersion: 1 as const };
      const r = await inject('/api/pos/sync', { operation, payload, signed }, { 'x-pos-token': token }); if (r.statusCode === 200) previous = operationId; return r;
    };
    const openedAtMs = Date.now(); const shiftId = randomUUID();
    const opening = await sync({ kind: 'shift.open', shiftId, openingCash: '150000', occurredAtMs: openedAtMs }); assert.equal(opening.statusCode, 200, opening.body);
    const incomeId = randomUUID(); const income: PosEvent = { kind: 'cash.movement', shiftId, movementId: incomeId, class: 'income', method: 'cash', amount: '386000', reason: 'Ingreso sintético', reversesMovementId: null, occurredAtMs: openedAtMs + 1 };
    const incomeOp = randomUUID(); const retryPayload = JSON.stringify(income); const retryOperation = { version: 1 as const, operationId: incomeOp, deviceId, branchId: 'centro', actorId: grant.grant.actorId, sequence: ++sequence, previousOperationId: previous, payloadHash: payloadHash(retryPayload), payloadVersion: 1 as const };
    const first = await inject('/api/pos/sync', { operation: retryOperation, payload: retryPayload, signed }, { 'x-pos-token': token }); assert.equal(first.statusCode, 200, first.body); previous = incomeOp;
    // Exact retry returns the first receipt and does not add another movement.
    const retry = await inject('/api/pos/sync', { operation: retryOperation, payload: retryPayload, signed }, { 'x-pos-token': token }); assert.equal(retry.statusCode, 200, retry.body);
    assert.equal((await sync({ kind: 'cash.movement', shiftId, movementId: randomUUID(), class: 'withdrawal', method: 'cash', amount: '50000', reason: 'Retiro sintético', reversesMovementId: null, occurredAtMs: openedAtMs + 2 })).statusCode, 200);
    const correction = await sync({ kind: 'cash.movement', shiftId, movementId: randomUUID(), class: 'correction', method: 'cash', amount: '50000', reason: 'Corrección de retiro', reversesMovementId: (await db.pool.query("SELECT id FROM pos_cash_movements WHERE class='withdrawal'")).rows[0].id, occurredAtMs: openedAtMs + 3 }); assert.equal(correction.statusCode, 200, correction.body);
    const digital = await sync({ kind: 'cash.movement', shiftId, movementId: randomUUID(), class: 'income', method: 'nequi', amount: '99999', reason: 'Ingreso digital sintético', reversesMovementId: null, occurredAtMs: openedAtMs + 4 }); assert.equal(digital.statusCode, 200, digital.body);
    const closed = await sync({ kind: 'shift.close', shiftId, counted: '536000', occurredAtMs: openedAtMs + 5 }); assert.equal(closed.statusCode, 200, closed.body);
    const shift = (await db.pool.query('SELECT expected::text,difference::text FROM pos_shifts WHERE id=$1', [shiftId])).rows[0];
    assert.deepEqual(shift, { expected: '536000.000000', difference: '0.000000' });
    const movements = await db.pool.query('SELECT class,payment_method,amount::text,cash_delta::text,reverses_id FROM pos_cash_movements ORDER BY occurred_at');
    assert.deepEqual(movements.rows.map(r => ({ ...r, reverses_id: r.reverses_id === null ? null : 'linked' })), [
      { class: 'income', payment_method: 'cash', amount: '386000.000000', cash_delta: '386000.000000', reverses_id: null },
      { class: 'withdrawal', payment_method: 'cash', amount: '50000.000000', cash_delta: '-50000.000000', reverses_id: null },
      { class: 'correction', payment_method: 'cash', amount: '50000.000000', cash_delta: '50000.000000', reverses_id: 'linked' },
      { class: 'income', payment_method: 'nequi', amount: '99999.000000', cash_delta: '0.000000', reverses_id: null }
    ]);
  } finally { await app.close(); await db.stop(); }
});
