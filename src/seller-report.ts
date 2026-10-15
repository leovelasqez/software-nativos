import { decimal, formatted } from './catalog.ts';
import { signedDecimal } from './pos-domain.ts';
import type { SaleV2, RefundV2 } from './orders-domain.ts';

export type SellerReportMovement = {
  id: string; saleId: string; kind: 'sale' | 'refund'; branchId: string; occurredAtMs: number;
  sellerId: string | null; sellerName: string; products: string; tip: string; shipping: string;
  commissionKnown: string; commissionPending: number;
  pendingLines: { id: string; quantity: string }[];
};
const proportional = (amount: bigint, quantity: bigint, total: bigint) => (amount * quantity + total / 2n) / total;

export function sellerSaleMovement(sale: SaleV2): SellerReportMovement {
  return { id: sale.id, saleId: sale.id, kind: 'sale', branchId: sale.branchId, occurredAtMs: sale.occurredAtMs,
    sellerId: sale.sellerId ?? null, sellerName: sale.sellerName ?? 'Sin vendedor registrado', products: sale.products,
    tip: sale.tipPaid, shipping: sale.shippingPaid, commissionKnown: sale.commissionKnown ?? '0', commissionPending: sale.commissionPending ?? sale.lines.length,
    pendingLines: sale.lines.filter(line => !sale.commissionLines || sale.commissionLines.find(c => c.lineId === line.id)?.amount === null)
      .map(line => ({ id: `${sale.id}:${line.id}`, quantity: line.quantity })) };
}

export function sellerRefundMovement(sale: SaleV2, refund: RefundV2, prior: RefundV2[]): SellerReportMovement {
  const products = refund.lines.reduce((sum, line) => {
    const original = sale.lines.find(item => item.id === line.lineId)!;
    const previous = prior.flatMap(item => item.lines).filter(item => item.lineId === line.lineId)
      .reduce((qty, item) => qty + decimal(item.quantity), 0n);
    const total = decimal(original.quantity), amount = decimal(original.amount);
    return sum + proportional(amount, previous + decimal(line.quantity), total) - proportional(amount, previous, total);
  }, 0n);
  return { id: refund.id, saleId: sale.id, kind: 'refund', branchId: sale.branchId, occurredAtMs: refund.occurredAtMs,
    sellerId: sale.sellerId ?? null, sellerName: sale.sellerName ?? 'Sin vendedor registrado', products: formatted(-products),
    tip: formatted(-decimal(refund.tip)), shipping: formatted(-decimal(refund.shipping)),
    commissionKnown: formatted(-decimal(refund.commissionKnown ?? '0')), commissionPending: refund.commissionPending ?? refund.lines.length,
    pendingLines: refund.lines.filter(line => !sale.commissionLines || sale.commissionLines.find(c => c.lineId === line.lineId)?.amount === null)
      .map(line => ({ id: `${sale.id}:${line.lineId}`, quantity: formatted(-decimal(line.quantity)) })) };
}

/** REQ-020-05: include refunds in their own period, attributed to the original seller. */
export function summarizeSellers(movements: SellerReportMovement[]) {
  const groups = new Map<string, { sellerId: string | null; sellerName: string; latest: number; saleCount: number; refundCount: number;
    products: bigint; tips: bigint; shipping: bigint; commissionKnown: bigint; pending: Map<string, bigint> }>();
  for (const row of movements) {
    const key = row.sellerId ?? 'unassigned';
    let group = groups.get(key);
    if (!group) { group = { sellerId: row.sellerId, sellerName: row.sellerName, latest: row.occurredAtMs, saleCount: 0, refundCount: 0,
      products: 0n, tips: 0n, shipping: 0n, commissionKnown: 0n, pending: new Map() }; groups.set(key, group); }
    if (row.occurredAtMs >= group.latest) { group.latest = row.occurredAtMs; group.sellerName = row.sellerName; }
    if (row.kind === 'sale') group.saleCount++; else group.refundCount++;
    group.products += signedDecimal(row.products); group.tips += signedDecimal(row.tip); group.shipping += signedDecimal(row.shipping);
    group.commissionKnown += signedDecimal(row.commissionKnown);
    for (const pending of row.pendingLines) group.pending.set(pending.id, (group.pending.get(pending.id) ?? 0n) + signedDecimal(pending.quantity));
  }
  return [...groups.entries()].map(([id, group]) => {
    const commissionPending = [...group.pending.values()].filter(quantity => quantity !== 0n).length;
    const commissionKnown = formatted(group.commissionKnown);
    return { id, sellerId: group.sellerId, sellerName: group.sellerName, saleCount: group.saleCount, refundCount: group.refundCount,
      products: formatted(group.products), tips: formatted(group.tips), shipping: formatted(group.shipping),
      commissionKnown, commissionPending, commissionAmount: commissionPending ? null : commissionKnown,
      commissionStatus: commissionPending ? 'Pendiente de configurar' : 'Calculada' };
  });
}
