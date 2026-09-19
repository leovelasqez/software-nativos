import { decimal, formatted } from '../src/catalog.ts';
import { paymentTotals } from '../src/orders-domain.ts';
import type { Payment } from '../src/pos-domain.ts';

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
export function matchesSearch(value: string, query: string) {
  const normalized = normalizeSearch(value);
  return normalizeSearch(query).split(' ').every(word => normalized.includes(word));
}

// Derived UI state uses the same decimal precision and validation as the sale.
export function paymentPreview(total: string, payments: Payment[]) {
  const due = decimal(total);
  let received: bigint;
  try { received = payments.reduce((sum, payment) => sum + decimal(payment.received), 0n); }
  catch { return { received: null, missing: null, change: null, error: 'Revisa los importes: usa números positivos con punto decimal, sin separadores de miles.' }; }
  let change: string | null = null;
  let error = '';
  try { change = paymentTotals(total, payments).change; }
  catch (e) { error = (e as Error).message; }
  return { received: formatted(received), missing: formatted(due > received ? due - received : 0n), change, error };
}

export function exactPayment(total: string, payments: Payment[], index: number): Payment[] {
  const other = payments.reduce((sum, p, i) => i === index ? sum : sum + decimal(p.received), 0n);
  const remaining = decimal(total) - other;
  if (remaining < 0n) throw new Error('Los otros pagos ya superan el total. Corrígelos antes de completar este medio.');
  return payments.map((p, i) => i === index ? { ...p, received: formatted(remaining) } : p);
}
