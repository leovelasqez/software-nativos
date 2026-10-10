import test from 'node:test';
import assert from 'node:assert/strict';
import { cashMovementDelta, canCorrectCashMovement } from '../src/pos-domain.ts';
import type { CashMovement } from '../src/pos-domain.ts';

const withdrawal: CashMovement = { id: 'withdrawal', shiftId: 'shift', class: 'withdrawal', method: 'cash', amount: '5000', cashDelta: '-5000', reason: 'Retiro autorizado', reversesMovementId: null, occurredAtMs: 1, actorName: 'Responsable' };
const correction: CashMovement = { ...withdrawal, id: 'correction', class: 'correction', cashDelta: '5000', reversesMovementId: withdrawal.id };

test('AC-019-03: contrapartida exacta, una sola vez, tanto local como descargada', () => {
  assert.equal(cashMovementDelta('shift', [withdrawal], correction), 5_000_000_000n);
  assert.equal(canCorrectCashMovement(withdrawal, [withdrawal]), true);
  const history = structuredClone([withdrawal, correction]);
  const before = structuredClone(history);
  assert.throws(() => cashMovementDelta('shift', history, { ...correction, reason: 'Otra corrección' }), /ya tiene una corrección/);
  assert.equal(canCorrectCashMovement(withdrawal, history), false);
  assert.equal(canCorrectCashMovement(correction, history), false);
  assert.deepEqual(history, before);
  for (const invalid of [{ ...correction, method: 'nequi' as const }, { ...correction, amount: '5001' }, { ...correction, reversesMovementId: correction.id }])
    assert.throws(() => cashMovementDelta('shift', history, invalid), /movimiento vigente/);
  assert.throws(() => cashMovementDelta('other-shift', [withdrawal], correction), /movimiento vigente/);
});

test('AC-019-03: digital no altera efectivo; entradas y salidas conservan signo y precisión', () => {
  assert.equal(cashMovementDelta('shift', [], { ...withdrawal, class: 'income', amount: '0.123456' }), 123456n);
  assert.equal(cashMovementDelta('shift', [], withdrawal), -5_000_000_000n);
  const digital: CashMovement = { ...withdrawal, method: 'card', cashDelta: '0' };
  assert.equal(cashMovementDelta('shift', [], digital), 0n);
  assert.equal(cashMovementDelta('shift', [digital], { ...correction, method: 'card' }), 0n);
});
