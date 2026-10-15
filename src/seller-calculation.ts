import { CatalogError, decimal, formatted } from './catalog.ts';
import { roundPeso } from './pos-domain.ts';
import type { Snapshot } from './pos-domain.ts';
import type { SaleV2, RefundV2 } from './orders-domain.ts';
import type { CommissionLine, SellerAttribution } from './sellers.ts';
import { isWithinGrantClock } from './authorization-clock.ts';

function totals(lines: CommissionLine[]) {
  const pending = lines.filter(line => line.amount === null).length;
  const known = formatted(lines.reduce((sum, line) => sum + decimal(line.amount ?? '0'), 0n));
  return { commissionLines: lines, commissionKnown: known, commissionPending: pending, commissionAmount: pending ? null : known };
}

/** REQ-020-07: all operations are integer rational arithmetic, rounded once to COP. */
export function commissionForLine(unit: string, quantity: string, net: string, gross: string) {
  const denominator = decimal('1') * decimal(gross);
  if (!denominator) return '0';
  const numerator = decimal(unit) * decimal(quantity) * decimal(net);
  const peso = decimal('1');
  return formatted(((numerator * 2n + denominator * peso) / (2n * denominator * peso)) * peso);
}

export function attributeSale(sale: SaleV2, snapshots: Snapshot[], branchId: string,
  selection: { sellerId: string; sellerSnapshotId: string }, occurredAtMs: number): SellerAttribution {
  const source = snapshots.find(snapshot => snapshot.id === selection.sellerSnapshotId);
  if (!source || source.branchId !== branchId || source.deviceId !== sale.deviceId || !isWithinGrantClock(occurredAtMs, source.createdAtMs))
    throw new CatalogError('Falta la versión de vendedores de esta sucursal. Sincroniza Caja.');
  const seller = source.sellers?.find(item => item.id === selection.sellerId && item.active && item.branchIds.includes(branchId));
  if (!seller) throw new CatalogError('Selecciona un vendedor activo de esta sucursal.');
  const lines = sale.lines.map(line => {
    const rule = source.commissions?.find(item => item.productId === line.productId);
    const unit = rule?.amount ?? null;
    return { lineId: line.id, productId: line.productId, quantity: line.quantity, unitAmount: unit,
      ruleVersion: rule?.version ?? null, amount: unit === null ? null : commissionForLine(unit, line.quantity, line.amount, line.gross) };
  });
  return { sellerId: seller.id, sellerName: seller.name, sellerVersion: seller.version,
    sellerSnapshotId: source.id, ...totals(lines) };
}

/** Cumulative rounding prevents partial refunds from leaving a commission residue. */
export function attributeRefund(sale: SaleV2, prior: RefundV2[], lines: RefundV2['lines']): SellerAttribution | undefined {
  if (!sale.sellerId || !sale.commissionLines) return undefined;
  const returned = lines.map(line => {
    const original = sale.commissionLines!.find(item => item.lineId === line.lineId);
    if (!original) throw new CatalogError('Falta la comisión original de la línea.');
    const before = prior.flatMap(item => item.lines).filter(item => item.lineId === line.lineId)
      .reduce((sum, item) => sum + decimal(item.quantity), 0n);
    const originalQuantity = decimal(original.quantity);
    const cumulative = (quantity: bigint) => roundPeso((decimal(original.amount ?? '0') * quantity + originalQuantity / 2n) / originalQuantity);
    return { ...original, quantity: line.quantity,
      amount: original.amount === null ? null : formatted(cumulative(before + decimal(line.quantity)) - cumulative(before)) };
  });
  return { sellerId: sale.sellerId, sellerName: sale.sellerName!, sellerVersion: sale.sellerVersion!,
    sellerSnapshotId: sale.sellerSnapshotId!, ...totals(returned) };
}
