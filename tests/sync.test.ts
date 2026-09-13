import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from '../src/sync.ts';
import { isOperation } from '../src/contracts.ts';
import type { Operation } from '../src/contracts.ts';

const operation: Operation = { version: 1, operationId: '00000000-0000-4000-8000-000000000001',
  deviceId: 'test-device', branchId: 'test-centro', actorId: 'test-user', sequence: 1,
  previousOperationId: null, payloadHash: 'a'.repeat(64), payloadVersion: 1 };
test('AC-007-02 parcial: respuesta perdida conserva pendiente; acuse repetido es terminal', () => {
  let state = transition('pending', operation, { kind: 'transport_failure' });
  assert.equal(state, 'retry');
  state = transition(state, operation, { kind: 'accepted', receipt: { ...operation } });
  assert.equal(state, 'acknowledged');
  assert.equal(transition(state, operation, { kind: 'accepted', receipt: operation }), state);
  assert.equal(transition(state, operation, { kind: 'transport_failure' }), state);
  assert.equal(transition(state, operation, { kind: 'rejected', reason: 'conflict' }), state);
});
test('REQ-007-02: cada campo del acuse debe corresponder, sin limpiar pendientes ajenos', () => {
  const mutations = { operationId: '00000000-0000-4000-8000-000000000002', deviceId: 'other-device',
    branchId: 'other-branch', actorId: 'other-user', sequence: 2, payloadHash: 'b'.repeat(64),
    payloadVersion: 2, version: 2, previousOperationId: '00000000-0000-4000-8000-000000000003' };
  for (const [key, value] of Object.entries(mutations)) {
    assert.equal(transition('pending', operation, { kind: 'accepted', receipt: { ...operation, [key]: value } }), 'pending', key);
  }
  for (const receipt of [null, {}, { ...operation, extra: true }]) {
    assert.equal(transition('retry', operation, { kind: 'accepted', receipt }), 'retry');
  }
});
test('REQ-007-02/04: conflicto y versión incompatible requieren conciliación sin pérdida', () => {
  for (const reason of ['conflict', 'invalid_payload', 'forbidden', 'unsupported_version'] as const) {
    const before = structuredClone(operation);
    assert.equal(transition('pending', operation, { kind: 'rejected', reason }), 'reconciliation_required');
    assert.equal(transition('reconciliation_required', operation, { kind: 'transport_failure' }), 'reconciliation_required');
    assert.deepEqual(operation, before);
  }
});
test('REQ-007-02/04: envoltura versionada y orden causal mínimo, sin aceptar payload opaco', () => {
  assert.equal(isOperation(operation), true);
  for (const invalid of [{ ...operation, payload: {} }, { ...operation, sequence: 0 },
    { ...operation, sequence: 2 }, { ...operation, payloadHash: 'bad' },
    { ...operation, version: 2 }, { ...operation, operationId: 'bad' }]) {
    assert.equal(isOperation(invalid), false);
    assert.throws(() => transition('pending', invalid as Operation, { kind: 'transport_failure' }), /invalid_operation/);
  }
  assert.equal(isOperation({ ...operation, sequence: 2, previousOperationId: operation.operationId }), false);
  assert.equal(isOperation({ ...operation, sequence: 2, previousOperationId: '00000000-0000-4000-8000-000000000002' }), true);
});
