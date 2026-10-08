import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShiftReceipt } from '../src/shift-receipt.ts';
import type { ReceiptSale, ReceiptRefund } from '../src/shift-receipt.ts';
import type { CashMovement, PaymentMethod } from '../src/pos-domain.ts';
import type { Shift } from '../src/pos/store.ts';

const shift: Shift = { id: 'turno-1', actorId: 'cajero', actorName: 'Cajero', openingCash: '150000', expected: '157000', openedAtMs: 1, closedAtMs: 1000, counted: '156000', difference: '-1000' };
const sale: ReceiptSale = { id: 'venta-1', receiptNumber: 'centro-caja-1', occurredAtMs: 10, actorName: 'Cajero', total: '20000', tipPaid: '1000', shippingPaid: '2000', change: '3000', cashApplied: '7000', payments: [{ method: 'cash', received: '10000', applied: '7000' }, { method: 'nequi', received: '13000', applied: '13000' }] };
const refund: ReceiptRefund = { id: 'devolucion-1', saleId: sale.id, occurredAtMs: 30, actorName: 'Encargado', reason: 'Devolución parcial', total: '5000', tip: '500', shipping: '1000', cashApplied: '-2000', payments: [{ method: 'cash', received: '2000' }, { method: 'nequi', received: '3000' }] };
function manual(id: string, kind: CashMovement['class'], method: PaymentMethod, amount: string, cashDelta: string, reversesMovementId: string | null = null): CashMovement {
  return { id, shiftId: shift.id, class: kind, method, amount, cashDelta, reversesMovementId, actorName: 'Cajero', occurredAtMs: 20, reason: 'Movimiento ' + id };
}

test('AC-006-07/09 — medios combinados, cambio, devoluciones y contrapartida digital sin duplicados', () => {
  const movements = [manual('ingreso', 'income', 'cash', '5000', '5000'), manual('gasto', 'expense', 'cash', '2000', '-2000'), manual('retiro', 'withdrawal', 'cash', '1000', '-1000'), manual('digital', 'expense', 'card', '0.123456', '0'), manual('correccion', 'correction', 'card', '0.123456', '0', 'digital')];
  const r = buildShiftReceipt(shift, 'centro', 'centro-caja', { sales: [sale, sale], refunds: [refund, refund], cashMovements: [...movements, movements[0]!] });
  assert.deepEqual(r.payments.find(p => p.method === 'cash'), { method: 'cash', sales: '7000', refunds: '2000', income: '5000', expense: '2000', withdrawal: '1000', correction: '0', net: '7000' });
  assert.equal(r.payments.find(p => p.method === 'nequi')!.net, '10000');
  assert.equal(r.payments.find(p => p.method === 'card')!.correction, '0.123456');
  assert.equal(r.payments.find(p => p.method === 'card')!.net, '0');
  assert.equal(r.payments.length, 6);
  assert.deepEqual({ products: r.totals.products, tip: r.totals.tip, shipping: r.totals.shipping, change: r.totals.change, net: r.totals.net }, { products: '13500', tip: '500', shipping: '1000', change: '3000', net: '17000' });
  assert.equal(r.totals.saleCount, 1); assert.equal(r.totals.refundCount, 1); assert.equal(r.movements.length, 7);
  assert.equal(r.movements.find(m => m.kind === 'refund')!.reference, sale.receiptNumber);
  assert.equal(r.movements.find(m => m.kind === 'refund')!.cashDelta, '-2000');
  assert.equal(r.movements.find(m => m.kind === 'correction')!.payments[0]!.amount, '0.123456');
  assert.deepEqual(r.shift, shift); assert.notEqual(r.shift, shift);
});

test('AC-006-07 — los seis medios y más de 50 cobros integran el comprobante completo', () => {
  const methods: PaymentMethod[] = ['cash', 'card', 'transfer', 'breb', 'daviplata', 'nequi'];
  const sales = Array.from({ length: 60 }, (_, i) => { const method = methods[i % 6]!; return { ...sale, id: 'sale-' + i, total: '100', tipPaid: '0', shippingPaid: '0', change: '0', cashApplied: method === 'cash' ? '100' : '0', payments: [{ method, received: '100', applied: '100' }] }; });
  const r = buildShiftReceipt(shift, 'centro', 'centro-caja', { sales, refunds: [], cashMovements: [] });
  assert.equal(r.totals.sales, '6000'); assert.equal(r.totals.saleCount, 60); assert.equal(r.movements.length, 60);
  assert.deepEqual(r.payments.map(p => p.sales), Array(6).fill('1000'));
});

test('AC-006-08 — cierre vacío, saldo negativo y copia estable sin modificar las fuentes', () => {
  const closed = { ...shift, expected: '-1000', counted: '0', difference: '1000' };
  const input = { sales: [], refunds: [], cashMovements: [manual('retiro', 'withdrawal', 'cash', '151000', '-151000')] };
  const first = buildShiftReceipt(closed, 'centro', 'centro-caja', input);
  assert.deepEqual(first, buildShiftReceipt(closed, 'centro', 'centro-caja', input));
  assert.equal(first.shift.expected, '-1000'); assert.equal(first.totals.net, '-151000');
  assert.equal(buildShiftReceipt(shift, 'centro', 'centro-caja', { sales: [], refunds: [], cashMovements: [] }).movements.length, 0);
  assert.throws(() => buildShiftReceipt({ ...shift, closedAtMs: null }, 'centro', 'centro-caja', input), /cerrado/);
  assert.throws(() => buildShiftReceipt(shift, 'centro', 'centro-caja', { ...input, cashMovements: [manual('correccion', 'correction', 'nequi', '10', '0', 'ausente')] }), /original/);
});
