import { decimal, formatted } from './catalog.ts';
import { signedDecimal } from './pos-domain.ts';
import type { CashMovement, PaymentMethod } from './pos-domain.ts';
import type { SaleV2, RefundV2 } from './orders-domain.ts';
import type { Shift } from './pos/store.ts';

export const paymentMethods: PaymentMethod[] = ['cash', 'card', 'transfer', 'breb', 'daviplata', 'nequi'];
type Amounts = { sales: string; refunds: string; income: string; expense: string; withdrawal: string; correction: string; net: string };
export interface ShiftReceipt {
  id: string;
  shiftId: string;
  branchId: string;
  deviceId: string;
  shift: Shift & { closedAtMs: number; counted: string; difference: string };
  totals: Amounts & { saleCount: number; refundCount: number; products: string; tip: string; shipping: string; change: string };
  payments: (Amounts & { method: PaymentMethod })[];
  movements: { id: string; kind: 'sale' | 'refund' | CashMovement['class']; reference: string; occurredAtMs: number; actorName: string; reason: string; amount: string; cashDelta: string; payments: { method: PaymentMethod; amount: string }[] }[];
}
export type ReceiptSale = Pick<SaleV2, 'id' | 'receiptNumber' | 'occurredAtMs' | 'actorName' | 'total' | 'tipPaid' | 'shippingPaid' | 'change' | 'cashApplied' | 'payments'>;
export type ReceiptRefund = Pick<RefundV2, 'id' | 'saleId' | 'occurredAtMs' | 'actorName' | 'reason' | 'total' | 'tip' | 'shipping' | 'cashApplied' | 'payments'>;
const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(row => [row.id, row])).values()];

// AC-006-07/09: applied payments and causal corrections, with exact money.
export function buildShiftReceipt(shift: Shift, branchId: string, deviceId: string, input: { sales: ReceiptSale[]; refunds: ReceiptRefund[]; cashMovements: CashMovement[] }): ShiftReceipt {
  if (shift.closedAtMs === null || shift.counted === null || shift.difference === null) throw new Error('El turno debe estar cerrado para emitir su comprobante.');
  const sales = unique(input.sales), refunds = unique(input.refunds), manual = unique(input.cashMovements);
  const rows = paymentMethods.map(method => ({ method, sales: 0n, refunds: 0n, income: 0n, expense: 0n, withdrawal: 0n, correction: 0n }));
  const rowFor = (method: PaymentMethod) => rows.find(row => row.method === method)!;
  const movements: ShiftReceipt['movements'] = [];
  let tip = 0n, shipping = 0n, change = 0n, saleTotal = 0n, refundTotal = 0n;
  for (const sale of sales) {
    const payments = sale.payments.map(p => ({ method: p.method, amount: p.applied }));
    for (const p of payments) rowFor(p.method).sales += decimal(p.amount);
    saleTotal += decimal(sale.total); tip += decimal(sale.tipPaid); shipping += decimal(sale.shippingPaid); change += decimal(sale.change);
    movements.push({ id: sale.id, kind: 'sale', reference: sale.receiptNumber, occurredAtMs: sale.occurredAtMs, actorName: sale.actorName, reason: '', amount: sale.total, cashDelta: sale.cashApplied, payments });
  }
  for (const refund of refunds) {
    const payments = refund.payments.map(p => ({ method: p.method, amount: formatted(-decimal(p.received)) }));
    for (const p of payments) rowFor(p.method).refunds -= signedDecimal(p.amount);
    refundTotal += decimal(refund.total); tip -= decimal(refund.tip); shipping -= decimal(refund.shipping);
    movements.push({ id: refund.id, kind: 'refund', reference: sales.find(s => s.id === refund.saleId)?.receiptNumber ?? refund.saleId, occurredAtMs: refund.occurredAtMs, actorName: refund.actorName, reason: refund.reason, amount: formatted(-decimal(refund.total)), cashDelta: refund.cashApplied, payments });
  }
  for (const movement of manual) {
    const row = rowFor(movement.method), amount = decimal(movement.amount);
    let delta: bigint;
    if (movement.class === 'correction') {
      const original = manual.find(m => m.id === movement.reversesMovementId);
      if (!original || original.class === 'correction') throw new Error('Falta el movimiento original de una corrección del turno.');
      delta = original.class === 'income' ? -amount : amount;
      row.correction += delta;
    } else {
      row[movement.class] += amount;
      delta = movement.class === 'income' ? amount : -amount;
    }
    movements.push({ id: movement.id, kind: movement.class, reference: movement.reversesMovementId ?? movement.id, occurredAtMs: movement.occurredAtMs, actorName: movement.actorName, reason: movement.reason, amount: formatted(delta), cashDelta: movement.cashDelta, payments: [{ method: movement.method, amount: formatted(delta) }] });
  }
  const amounts = (row: typeof rows[number]): Amounts => ({ sales: formatted(row.sales), refunds: formatted(row.refunds), income: formatted(row.income), expense: formatted(row.expense), withdrawal: formatted(row.withdrawal), correction: formatted(row.correction), net: formatted(row.sales - row.refunds + row.income - row.expense - row.withdrawal + row.correction) });
  const total = { method: 'cash' as const, sales: 0n, refunds: 0n, income: 0n, expense: 0n, withdrawal: 0n, correction: 0n };
  for (const row of rows) for (const key of ['sales', 'refunds', 'income', 'expense', 'withdrawal', 'correction'] as const) total[key] += row[key];
  return { id: shift.id, shiftId: shift.id, branchId, deviceId, shift: structuredClone(shift) as ShiftReceipt['shift'],
    totals: { ...amounts(total), saleCount: sales.length, refundCount: refunds.length, products: formatted(saleTotal - refundTotal - tip - shipping), tip: formatted(tip), shipping: formatted(shipping), change: formatted(change) },
    payments: rows.map(row => ({ method: row.method, ...amounts(row) })), movements: movements.sort((a, b) => a.occurredAtMs - b.occurredAtMs || a.id.localeCompare(b.id)) };
}
