import type { OrderV2 } from '../src/orders-domain.ts';

// Include closed orders so numbers do not change when a neighbouring sale closes.
export function orderNumbers(orders: OrderV2[], current?: OrderV2): Record<string, number> {
  const numbered = current && !orders.some(order => order.id === current.id) ? [...orders, current] : orders;
  return Object.fromEntries(numbered.map((order, index) => [order.id, index + 1]));
}

export function orderTabLabel(order: OrderV2, number = 1): string {
  if (order.label.trim()) return order.mode === 'table' ? `Mesa · ${order.label}` : order.label;
  return number === 1 ? 'Venta principal' : `Venta ${number}`;
}

export function selectionAfterUpdate(orders: OrderV2[], selected: string | undefined, updated: OrderV2): string | undefined {
  if (!updated.closed) return updated.id;
  const remaining = orders.filter(order => !order.closed && order.id !== updated.id);
  if (remaining.some(order => order.id === selected)) return selected;
  const index = orders.filter(order => !order.closed).findIndex(order => order.id === updated.id);
  return remaining[Math.max(0, index)]?.id ?? remaining.at(-1)?.id;
}
