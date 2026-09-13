import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, defaultActions, publicProduct } from '../src/authorization.ts';
import { isGrant, isPrincipal, WEEK_MS } from '../src/contracts.ts';
import type { Action, OfflineGrant, Principal, Role } from '../src/contracts.ts';

// Synthetic identities/time, never business configuration or real user records.
const start = 1_800_000_000_000;
function principal(role: Role = 'cashier'): Principal {
  return { version: 1, actorId: 'test-user', kind: 'human', role, active: true,
    branchIds: ['test-centro'], actions: defaultActions(role) };
}
function grant(): OfflineGrant {
  return { version: 1, grantId: 'test-grant', actorId: 'test-user', deviceId: 'test-device',
    branchId: 'test-centro', validatedAtMs: start, expiresAtMs: start + WEEK_MS,
    actions: defaultActions('cashier') };
}
function request(action: Action = 'sale.charge') {
  return { principal: principal(), action, branchId: 'test-centro', deviceId: 'test-device',
    mode: 'offline' as const, verifiedGrant: grant(), nowMs: start + 1, lastObservedAtMs: start };
}
test('AC-001-01 parcial: alcance explícito para todos los roles, incluso dueño', () => {
  for (const role of ['owner', 'manager', 'cashier'] as const) {
    assert.deepEqual(authorize({ ...request(), principal: principal(role), mode: 'online',
      branchId: 'test-milan' }), { allowed: false, reason: 'branch_denied' });
    assert.deepEqual(authorize({ ...request(), principal: principal(role), mode: 'online' }), { allowed: true });
  }
});
test('AC-001-03 parcial: altas, descuentos y cancelaciones sin aprobación online', () => {
  for (const role of ['owner', 'manager', 'cashier'] as const) {
    for (const action of ['product.create', 'recipe.create', 'customer.create',
      'sale.discount', 'sale.cancel', 'loyalty.enroll', 'loyalty.redeem'] as const) {
      assert.deepEqual(authorize({ ...request(action), principal: principal(role), mode: 'online' }), { allowed: true });
    }
  }
});
test('REQ-001-02: compras del encargado limitadas a su local; cajero sin acceso por defecto', () => {
  for (const action of ['purchase.read', 'purchase.write'] as const) {
    assert.equal(authorize({ ...request(action), principal: principal('manager'), mode: 'online' }).allowed, true);
    assert.equal(authorize({ ...request(action), principal: principal('manager'), branchId: 'test-milan', mode: 'online' }).allowed, false);
    assert.equal(authorize({ ...request(action), mode: 'online' }).allowed, false);
  }
});
test('REQ-001-02: costos y ajustes de puntos exclusivos del dueño incluso con concesión errónea', () => {
  for (const role of ['manager', 'cashier'] as const) {
    for (const action of ['cost.read', 'cost.write', 'loyalty.adjust'] as const) {
      const p = principal(role); p.actions.push(action);
      assert.equal(authorize({ ...request(action), principal: p, mode: 'online' }).allowed, false);
      assert.equal(authorize({ ...request(action), principal: principal('owner'), mode: 'online' }).allowed, true);
    }
  }
});
test('AC-001-02 parcial: proyección no filtra costos presentes ni campos futuros o anidados', () => {
  const stored = { id: 'test-product', name: 'Fixture', finalPrice: '1000',
    taxAssignment: { id: 'test-tax', label: 'Fixture', secretCost: '999' },
    unitCost: '999', margin: '1', purchase: { amount: '999' }, futureSecret: 'hidden' };
  assert.deepEqual(publicProduct(stored), { id: 'test-product', name: 'Fixture', finalPrice: '1000',
    taxAssignment: { id: 'test-tax', label: 'Fixture' } });
  assert.equal(publicProduct({ ...stored, taxAssignment: null }).taxAssignment, null);
  assert.equal(stored.unitCost, '999');
});
test('AC-007-03: matriz offline permite operación local y bloquea operaciones centrales', () => {
  const allowed = ['data.read', 'order.write', 'sale.discount', 'sale.cancel', 'sale.charge', 'shift.open', 'shift.close'];
  for (const action of defaultActions('owner')) {
    const r = request(action);
    r.verifiedGrant.actions = defaultActions('owner');
    assert.equal(authorize({ ...r, principal: principal('owner') }).allowed, allowed.includes(action), action);
  }
});
test('AC-007-06: cobra hasta el último ms, bloquea al límite exacto y después', () => {
  assert.equal(authorize({ ...request(), nowMs: start + WEEK_MS - 1 }).allowed, true);
  for (const delta of [WEEK_MS, WEEK_MS + 1, WEEK_MS * 2]) {
    for (const action of ['sale.charge', 'shift.open', 'sale.discount', 'sale.cancel'] as const) {
      assert.deepEqual(authorize({ ...request(action), nowMs: start + delta }), { allowed: false, reason: 'offline_expired' });
    }
    for (const action of ['data.read', 'order.write', 'shift.close'] as const) {
      assert.equal(authorize({ ...request(action), nowMs: start + delta }).allowed, true);
    }
  }
});
test('AC-007-03/06: reloj regresivo bloquea cobro, conserva recuperación autorizada', () => {
  for (const r of [{ ...request(), nowMs: start - 1 }, { ...request(), lastObservedAtMs: start + 2 }]) {
    assert.deepEqual(authorize(r), { allowed: false, reason: 'clock_untrusted' });
    assert.equal(authorize({ ...r, action: 'data.read' }).allowed, true);
  }
});
test('AC-007-03: no reutilizar concesión ajena ni ampliar permisos', () => {
  for (const key of ['actorId', 'deviceId', 'branchId'] as const) {
    const g = grant(); g[key] = 'other';
    assert.equal(authorize({ ...request(), verifiedGrant: g }).allowed, false);
  }
  assert.equal(authorize({ ...request(), verifiedGrant: { ...grant(), actions: [] } }).allowed, false);
  assert.equal(authorize({ ...request(), principal: { ...principal(), actions: [] } }).allowed, false);
  assert.equal(authorize({ ...request(), verifiedGrant: undefined }).allowed, false);
});
test('REQ-001-02 y REQ-007-03: revocación conocida y agentes offline denegados', () => {
  for (const mode of ['online', 'offline'] as const) {
    assert.equal(authorize({ ...request(), mode, principal: { ...principal(), active: false } }).allowed, false);
  }
  assert.equal(authorize({ ...request(), principal: { ...principal(), kind: 'agent' } }).allowed, false);
  assert.equal(authorize({ ...request(), mode: 'online', principal: { ...principal(), kind: 'agent' } }).allowed, true);
});
test('REQ-001-02/REQ-007-03: contratos rechazan contexto malformado y permisos desconocidos', () => {
  assert.equal(isPrincipal({ ...principal(), secret: 'unexpected' }), false);
  assert.equal(isPrincipal({ ...principal(), role: 'admin' }), false);
  assert.equal(isPrincipal({ ...principal(), actions: ['all'] }), false);
  assert.equal(isPrincipal({ ...principal(), actions: ['data.read', 'data.read'] }), false);
  for (const nowMs of [NaN, Infinity, -1, 1.5]) {
    assert.equal(authorize({ ...request(), nowMs }).allowed, false);
  }
  assert.equal(authorize({ ...request(), action: 'all' }).allowed, false);
  assert.equal(authorize({ ...request(), branchId: '' }).allowed, false);
  assert.equal(authorize({ ...request(), principal: null }).allowed, false);
});
test('AC-007-03: duración inválida, versión y fechas fuera de contrato rechazadas', () => {
  for (const expiresAtMs of [start, start - 1, start + WEEK_MS + 1, Infinity]) {
    assert.equal(isGrant({ ...grant(), expiresAtMs }), false);
  }
  assert.equal(isGrant({ ...grant(), version: 2 }), false);
  assert.equal(isGrant({ ...grant(), validatedAtMs: 1.5 }), false);
  assert.equal(isGrant(grant()), true);
});
