import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeOrder, emptyLine, applyOrderEvent } from '../src/orders-domain.ts';
import type { OrderContext, RefundV2 } from '../src/orders-domain.ts';
import type { Snapshot } from '../src/pos-domain.ts';
import { commissionForLine, attributeSale } from '../src/seller-calculation.ts';
import { sellerSaleMovement, sellerRefundMovement, summarizeSellers } from '../src/seller-report.ts';
import { isOrderEventV4, isOrderEventV3 } from '../src/orders-contract.ts';

const snapshot: Snapshot = { id: 'snapshot', createdAtMs: 1, deviceId: 'device', branchId: 'centro', warehouseId: 'warehouse',
  serverSequence: 0, stock: [], recipes: [], products: [{ id: 'product', name: 'Sintético', reference: 'TEST', type: 'finished', category: 'Pruebas',
    presentation: 'Unidad', unit: 'unit', price: '10000', tax: null, description: '', version: 1, activeRecipeVersion: null, sellable: true }],
  sellers: [{ id: 'seller-a', name: 'Ana sintética', version: 1, active: true, branchIds: ['centro'] },
    { id: 'seller-b', name: 'Luis sintético', version: 1, active: true, branchIds: ['centro'] }],
  commissions: [{ productId: 'product', version: 1, amount: '1000' }] };
const context = (): OrderContext => ({ id: 'sale', receiptNumber: 'receipt', actorId: 'shared-account', actorName: 'Caja compartida',
  branchId: 'centro', deviceId: 'device', snapshots: [structuredClone(snapshot)], customer: null, originalSale: null, refunds: [],
  order: { ...upgradeOrder({ id: 'order', revision: 1, snapshotId: 'snapshot', lines: [] }),
    lines: [{ ...emptyLine({ id: 'line', productId: 'product', snapshotId: 'snapshot', quantity: '3', optionIds: [] }), discount: { kind: 'percent', value: '10' } }] } });
const charge = { kind: 'sale.split' as const, orderId: 'order', revision: 1, selection: [{ lineId: 'line', quantity: '3' }],
  customerId: null, tip: { kind: 'amount' as const, value: '3000' }, shipping: '0', payments: [{ method: 'cash' as const, received: '30000' }],
  sellerId: 'seller-a', sellerSnapshotId: 'snapshot', occurredAtMs: 2, shiftId: 'shift' };

test('AC-020-02/07: vendedor separado del actor, contrato v4 y compatibilidad v3', () => {
  const result = applyOrderEvent(charge, context()).sale!;
  assert.equal(result.sellerId, 'seller-a'); assert.equal(result.actorName, 'Caja compartida'); assert.equal(result.commissionAmount, '2700');
  assert.equal(isOrderEventV4(charge), true); assert.equal(isOrderEventV3(charge), false);
  const legacy = { ...charge }; delete (legacy as Partial<typeof charge>).sellerId; delete (legacy as Partial<typeof charge>).sellerSnapshotId;
  assert.equal(isOrderEventV4(legacy), false); assert.equal(isOrderEventV3(legacy), true);
  assert.equal(applyOrderEvent(legacy, context()).sale!.sellerId, undefined);
});

test('AC-020-04: snapshot conserva identidad/regla y rechaza vendedor ajeno o inactivo', () => {
  const sale = applyOrderEvent(charge, context()).sale!;
  const next = structuredClone(snapshot); next.id = 'new-snapshot'; next.sellers![0]!.active = false;
  next.sellers![0]!.name = 'Nombre nuevo'; next.commissions![0]!.amount = '9000';
  assert.equal(attributeSale(sale, [snapshot, next], 'centro', charge, 3).commissionAmount, '2700');
  assert.throws(() => attributeSale(sale, [next], 'centro', { sellerId: 'seller-a', sellerSnapshotId: next.id }, 3), /vendedor activo/);
  assert.throws(() => attributeSale(sale, [snapshot], 'milan', charge, 3), /sucursal/);
  assert.throws(() => attributeSale(sale, [snapshot], 'centro', { ...charge, sellerId: 'missing' }, 3), /vendedor activo/);
});

test('AC-020-05/06: devolver desde otro turno revierte vendedor, propina y comisión originales', () => {
  const sale = applyOrderEvent(charge, context()).sale!;
  const event = { kind: 'sale.refund' as const, saleId: sale.id, lines: [{ lineId: 'line', quantity: '1', recoverable: true }],
    tip: '1000', shipping: '0', payments: [{ method: 'cash' as const, received: '10000' }], reason: 'Devolución sintética', occurredAtMs: 3, shiftId: 'other-shift' };
  const a = applyOrderEvent(event, { ...context(), id: 'refund-1', actorName: 'Otro operador', originalSale: sale }).refund!;
  assert.equal(a.actorName, 'Otro operador'); assert.equal(a.sellerId, 'seller-a'); assert.equal(a.commissionAmount, '900');
  const b = applyOrderEvent({ ...event, lines: [{ lineId: 'line', quantity: '2', recoverable: false }], tip: '2000',
    payments: [{ method: 'cash', received: '20000' }] }, { ...context(), id: 'refund-2', originalSale: sale, refunds: [a] }).refund!;
  assert.equal(b.commissionAmount, '1800');
  const movements = [sellerSaleMovement(sale), sellerRefundMovement(sale, a, []), sellerRefundMovement(sale, b, [a])];
  const summary = summarizeSellers(movements)[0]!;
  assert.equal(summary.products, '0'); assert.equal(summary.tips, '0'); assert.equal(summary.commissionAmount, '0');
  assert.equal(summary.saleCount, 1); assert.equal(summary.refundCount, 2);
  const refundPeriod = summarizeSellers([movements[1]!])[0]!;
  assert.equal(refundPeriod.products, '-9000'); assert.equal(refundPeriod.commissionAmount, '-900');
});

test('AC-020-05: tres devoluciones parciales revierten exactamente el redondeo original', () => {
  const c = context(); c.snapshots[0]!.commissions![0]!.amount = '1'; c.order!.lines[0]!.discount.value = '50';
  const sale = applyOrderEvent({ ...charge, tip: { kind: 'amount', value: '0' }, payments: [{ method: 'cash', received: '15000' }] }, c).sale!;
  assert.equal(sale.commissionAmount, '2');
  const refunds: RefundV2[] = [];
  for (let i = 0; i < 3; i++) refunds.push(applyOrderEvent({ kind: 'sale.refund', saleId: sale.id,
    lines: [{ lineId: 'line', quantity: '1', recoverable: false }], tip: '0', shipping: '0', payments: [{ method: 'cash', received: '5000' }],
    reason: 'Parcial sintética', occurredAtMs: 3 + i, shiftId: 'shift' }, { ...c, id: `r-${i}`, originalSale: sale, refunds: [...refunds] }).refund!);
  assert.deepEqual(refunds.map(r => r.commissionAmount), ['1', '0', '1']);
});

test('AC-020-06/07: comisión pendiente distinta de cero y cancelada por devolución completa', () => {
  const c = context(); c.snapshots[0]!.commissions = [];
  const sale = applyOrderEvent(charge, c).sale!;
  assert.equal(sale.commissionAmount, null); assert.equal(sale.commissionPending, 1);
  const r = applyOrderEvent({ kind: 'sale.refund', saleId: sale.id, lines: [{ lineId: 'line', quantity: '3', recoverable: false }],
    tip: '3000', shipping: '0', payments: [{ method: 'cash', received: '30000' }], reason: 'Devolución completa', occurredAtMs: 3, shiftId: 'shift' },
  { ...c, originalSale: sale }).refund!;
  assert.equal(summarizeSellers([sellerSaleMovement(sale)])[0]!.commissionAmount, null);
  assert.equal(summarizeSellers([sellerSaleMovement(sale), sellerRefundMovement(sale, r, [])])[0]!.commissionAmount, '0');
  c.snapshots[0]!.commissions = [{ productId: 'product', version: 2, amount: '0' }];
  assert.equal(applyOrderEvent(charge, c).sale!.commissionAmount, '0');
});

test('REQ-020-07: proporción de descuento, cantidad fraccionaria y redondeo al peso', () => {
  assert.equal(commissionForLine('1000', '1', '9000', '10000'), '900');
  assert.equal(commissionForLine('1000', '0.5', '4500', '5000'), '450');
  assert.equal(commissionForLine('1', '1', '5000', '10000'), '1');
  assert.equal(commissionForLine('1000', '1', '0', '0'), '0');
});
