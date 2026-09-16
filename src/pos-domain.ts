import { CatalogError, consumption, decimal, formatted, multiply } from './catalog.ts';
import type { Product, Recipe } from './catalog.ts';
import type { OfflineGrant, Principal } from './contracts.ts';
export interface Signed { document: string; signature: string }
export interface Authorization { grant: OfflineGrant; principal: Principal; actorName: string }
export interface Snapshot { id: string; createdAtMs: number; branchId: string; deviceId: string; warehouseId: string; serverSequence: number; products: Product[]; recipes: Recipe[]; stock: { itemId: string; quantity: string }[] }
export interface OrderLine { id: string; productId: string; snapshotId: string; quantity: string; optionIds: string[] }
export interface Order { id: string; revision: number; snapshotId: string; lines: OrderLine[] }
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'breb' | 'daviplata' | 'nequi';
export interface Payment { method: PaymentMethod; received: string }
export type CashMovementClass = 'income' | 'expense' | 'withdrawal' | 'correction';
export interface CashMovement { id: string; shiftId: string; class: CashMovementClass; method: PaymentMethod; amount: string; cashDelta: string; reason: string; reversesMovementId: string | null; occurredAtMs: number; actorName: string }
interface EventBase { occurredAtMs: number; shiftId: string }
export type PosEvent = EventBase & ({ kind: 'shift.open'; openingCash: string } | { kind: 'sale.charge'; orderId: string; snapshotId: string; lines: OrderLine[]; payment: Payment } | { kind: 'shift.close'; counted: string } | { kind: 'cash.movement'; movementId: string; class: CashMovementClass; method: PaymentMethod; amount: string; reason: string; reversesMovementId: string | null });
export function signedDecimal(n: string) { return n.startsWith('-') ? -decimal(n.slice(1)) : decimal(n); }
export function roundPeso(n: bigint) { return ((n + 500_000n) / 1_000_000n) * 1_000_000n; }
export function calculateSale(snapshot: Snapshot, input: OrderLine[], payment?: Payment, history: Snapshot[] = [snapshot]) {
  if (!input.length || input.length > 100 || new Set(input.map(l => l.id)).size !== input.length) throw new CatalogError('Agrega líneas válidas al pedido.');
  const stock = new Map<string, bigint>(); let exact = 0n;
  const lines = input.map(l => {
    const source = history.find(s => s.id === l.snapshotId); if (!source) throw new CatalogError('No se encontró la versión de esta línea.');
    const p = source.products.find(p => p.id === l.productId);
    if (!p || !p.sellable || decimal(l.quantity) <= 0n) throw new CatalogError('Producto no habilitado o cantidad inválida.');
    const r = p.type === 'prepared' ? source.recipes.find(r => r.productId === p.id && r.version === p.activeRecipeVersion) : undefined;
    if (p.type === 'prepared' && !r) throw new CatalogError('El preparado no tiene receta completa en esta versión.');
    if (p.type === 'finished' && l.optionIds.length) throw new CatalogError('Este producto no tiene opciones de receta.');
    const consumed = r ? consumption(r, l.optionIds) : { items: [{ itemId: p.id, quantity: '1' }], extraPrice: '0' };
    const unitPrice = formatted(decimal(p.price) + decimal(consumed.extraPrice));
    const amount = multiply(unitPrice, l.quantity); exact += decimal(amount);
    for (const c of consumed.items) stock.set(c.itemId, (stock.get(c.itemId) ?? 0n) + decimal(multiply(c.quantity, l.quantity)));
    const rate = p.tax ? decimal(p.tax.rate) : null;
    const tax = rate === null ? null : p.tax!.exempt ? '0' : formatted((decimal(amount) * rate + (100_000_000n + rate) / 2n) / (100_000_000n + rate));
    return { ...l, name: p.name, reference: p.reference, presentation: p.presentation, productVersion: p.version,
      recipeVersion: r?.version ?? null, unitPrice, amount, taxAssignment: p.tax, taxAmount: tax,
      options: l.optionIds.map(id => r!.options.find(o => o.id === id)!.name) };
  });
  const total = roundPeso(exact); if (total > decimal('999999999')) throw new CatalogError('El total supera el límite de esta versión de caja.');
  let change = 0n;
  if (payment) {
    const received = decimal(payment.received);
    if (payment.method === 'cash') { if (received < total) throw new CatalogError('El efectivo recibido es insuficiente.'); change = received - total; }
    else if (received !== total) throw new CatalogError('El pago digital debe coincidir exactamente con el total.');
  }
  return { customer: 'Consumidor final', lines, subtotal: formatted(exact), rounding: formatted(total - exact), total: formatted(total),
    change: formatted(change), cashApplied: payment?.method === 'cash' ? formatted(total) : '0',
    consumption: [...stock].map(([itemId, quantity]) => ({ itemId, quantity: formatted(quantity) })) };
}
export type SaleCalculation = ReturnType<typeof calculateSale>;
