import { decimal, formatted } from './catalog.ts';

export interface DashboardLine { id: string; productId: string; name: string; presentation: string; quantity: string; paidAmount?: string }
export interface DashboardSale { id: string; day: string; occurredAt: string; total: string; lines: DashboardLine[] }
export interface DashboardRefund { day: string; total: string; tip: string; shipping: string; lines: { lineId: string; quantity: string }[]; sale: DashboardSale }
export interface InventoryAlert { itemId: string; name: string; branchId: string; branchName: string; warehouseId: string; warehouseName: string; baseUnit: string; quantity: string; minimum: string }
export interface Dashboard {
  context: { today: string; monthStart: string; timeZone: 'America/Bogota'; branchIds: string[]; generatedAt: string; lastSynchronizedAt: Record<string, string | null> };
  day: { sales: string; saleCount: number; refunds: string };
  month: { sales: string; saleCount: number; refunds: string };
  ticketAverage: string | null;
  daily: { date: string; sales: string }[];
  topProducts: { productId: string; name: string; presentation: string; quantity: string }[];
  inventoryAlerts: InventoryAlert[];
}

export function dashboardDates(now: Date) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { today, monthStart: today.slice(0, 8) + '01' };
}

// Use the stored allocation of paid pesos. Do not recalculate historical discounts,
// points or taxes, and do not convert redeemed points into money on a refund.
export function aggregateDashboard(today: string, sales: DashboardSale[], refunds: DashboardRefund[]) {
  const monthStart = today.slice(0, 8) + '01';
  const inMonth = (day: string) => day >= monthStart && day <= today;
  const daily = new Map<string, bigint>();
  for (let day = 1; day <= Number(today.slice(-2)); day++) daily.set(monthStart.slice(0, 8) + String(day).padStart(2, '0'), 0n);
  let grossDay = 0n, grossMonth = 0n, returnedDay = 0n, returnedMonth = 0n, dayCount = 0, monthCount = 0;
  const products = new Map<string, { productId: string; name: string; presentation: string; quantity: bigint; occurredAt: string }>();
  function addProduct(line: DashboardLine, quantity: bigint, occurredAt: string) {
    const existing = products.get(line.productId);
    if (!existing) products.set(line.productId, { productId: line.productId, name: line.name, presentation: line.presentation, quantity, occurredAt });
    else {
      existing.quantity += quantity;
      if (occurredAt > existing.occurredAt) Object.assign(existing, { name: line.name, presentation: line.presentation, occurredAt });
    }
  }
  for (const sale of sales) {
    if (!inMonth(sale.day)) continue;
    const paid = sale.lines.length && sale.lines.every(line => line.paidAmount !== undefined)
      ? sale.lines.reduce((sum, line) => sum + decimal(line.paidAmount!), 0n) : decimal(sale.total);
    grossMonth += paid; monthCount++;
    if (sale.day === today) { grossDay += paid; dayCount++; }
    daily.set(sale.day, daily.get(sale.day)! + paid);
    for (const line of sale.lines) addProduct(line, decimal(line.quantity), sale.occurredAt);
  }
  for (const refund of refunds) {
    if (!inMonth(refund.day)) continue;
    const returned = decimal(refund.total) - decimal(refund.tip) - decimal(refund.shipping);
    returnedMonth += returned;
    if (refund.day === today) returnedDay += returned;
    daily.set(refund.day, daily.get(refund.day)! - returned);
    for (const line of refund.lines) {
      const original = refund.sale.lines.find(value => value.id === line.lineId);
      if (original) addProduct(original, -decimal(line.quantity), refund.sale.occurredAt);
    }
  }
  const topProducts = [...products.values()].filter(p => p.quantity > 0n)
    .sort((a, b) => a.quantity === b.quantity ? a.name.localeCompare(b.name, 'es') || a.productId.localeCompare(b.productId) : a.quantity > b.quantity ? -1 : 1)
    .slice(0, 5).map(({ productId, name, presentation, quantity }) => ({ productId, name, presentation, quantity: formatted(quantity) }));
  return {
    day: { sales: formatted(grossDay - returnedDay), saleCount: dayCount, refunds: formatted(returnedDay) },
    month: { sales: formatted(grossMonth - returnedMonth), saleCount: monthCount, refunds: formatted(returnedMonth) },
    ticketAverage: dayCount ? String((grossDay + BigInt(dayCount) * 500_000n) / (BigInt(dayCount) * 1_000_000n)) : null,
    daily: [...daily].map(([date, value]) => ({ date, sales: formatted(value) })), topProducts,
  };
}
