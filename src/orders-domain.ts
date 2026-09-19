import { loyaltyCalculation, proportional, apportion } from './loyalty.ts';
import type { LoyaltyMeta, LoyaltyResult } from './loyalty.ts';
import { decimal, formatted, multiply, CatalogError } from './catalog.ts';
import { calculateSale, roundPeso } from './pos-domain.ts';
import type { Order, OrderLine, Snapshot, Payment } from './pos-domain.ts';
import type { Action } from './contracts.ts';
export interface Customer { id: string; name: string; document: string; phone: string; email: string; address: string }
export interface Adjustment { kind: 'amount' | 'percent'; value: string }
export interface LineV2 extends OrderLine { notes: string; discount: Adjustment; sentQuantity: string }
export interface OrderV2 extends Omit<Order, 'lines'> { lines: LineV2[]; customerId: string | null; mode: 'counter' | 'table' | 'delivery'; label: string; address: string; rider: string; deliveryStatus: 'pending' | 'preparing' | 'dispatched' | 'delivered'; shipping: string; closed: boolean }
export interface Selection { lineId: string; quantity: string }
export type CommandEvent = { kind: 'order.save'; order: OrderV2 }
  | { kind: 'order.prepare'; orderId: string; revision: number }
  | { kind: 'order.cancel'; orderId: string; revision: number; lines: (Selection & { preparedQuantity: string })[]; reason: string }
  | { kind: 'sale.split'; orderId: string; revision: number; selection: Selection[]; customerId: string | null; tip: Adjustment; shipping: string; payments: Payment[]; points?:string; ruleId?:string; loyalty?:LoyaltyMeta }
  | { kind: 'sale.refund'; saleId: string; lines: (Selection & { recoverable: boolean })[]; tip: string; shipping: string; payments: Payment[]; reason: string };
export type OrderEvent = CommandEvent & { occurredAtMs: number; shiftId: string | null };
function fail(message: string): never { throw new CatalogError(message); }
const min = (a: bigint, b: bigint) => a < b ? a : b;
const ratio = (a: bigint, b: bigint, c: bigint) => c === 0n ? 0n : (a * b + c / 2n) / c;
export const emptyLine = (l: OrderLine): LineV2 => ({ ...l, notes: '', discount: { kind: 'amount', value: '0' }, sentQuantity: '0' });
export function upgradeOrder(o: Order): OrderV2 { return { ...o, lines: o.lines.map(emptyLine), customerId: null, mode: 'counter', label: '', address: '', rider: '', deliveryStatus: 'pending', shipping: '0', closed: false }; }
export function eventAction(e: CommandEvent): Action { return e.kind === 'sale.split' ? 'sale.charge' : e.kind === 'sale.refund' ? 'sale.refund' : e.kind === 'order.cancel' ? 'sale.cancel' : 'order.write'; }
export function discountValue(gross: bigint, a: Adjustment) {
  const value = decimal(a.value); const result = a.kind === 'percent' ? ratio(gross, value, decimal('100')) : value;
  if (value < 0n || result > gross || a.kind === 'percent' && value > decimal('100')) fail('El descuento no puede superar el importe de la línea.'); return result;
}
export function describeLine(line: LineV2, snapshots: Snapshot[]) {
  const source = snapshots.find(s => s.id === line.snapshotId) ?? fail('Falta la versión de catálogo.');
  const result = calculateSale(source, [line], undefined, snapshots).lines[0]!;
  const discount = discountValue(decimal(result.amount), line.discount); const net = decimal(result.amount) - discount;
  const rate = result.taxAssignment ? decimal(result.taxAssignment.rate) : null;
  return { ...result, notes: line.notes, productType: source.products.find(p => p.id === line.productId)!.type, gross: result.amount, discount: formatted(discount), amount: formatted(net), taxAmount: rate === null ? null : result.taxAssignment!.exempt ? '0' : formatted(ratio(net, rate, decimal('100') + rate)) };
}
export function splitLine(line: LineV2, quantity: string, snapshots: Snapshot[]) {
  const q = decimal(quantity); const original = decimal(line.quantity); if (q <= 0n || q > original) fail('Cantidad de cobro o cancelación fuera del pedido.');
  const totalDiscount = decimal(describeLine(line, snapshots).discount); const part = ratio(totalDiscount, q, original);
  const chosen = { ...line, quantity, discount: { kind: 'amount' as const, value: formatted(part) }, sentQuantity: formatted(min(q, decimal(line.sentQuantity))) };
  const remaining = q === original ? null : { ...line, quantity: formatted(original - q), discount: { kind: 'amount' as const, value: formatted(totalDiscount - part) }, sentQuantity: formatted(decimal(line.sentQuantity) - decimal(chosen.sentQuantity)) };
  return { chosen, remaining };
}
export function paymentTotals(total: string, payments: Payment[]) {
  if (!payments.length || payments.length > 6 || new Set(payments.map(p => p.method)).size !== payments.length) fail('Selecciona medios de pago distintos.');
  const due = decimal(total); let cash = 0n; let digital = 0n;
  for (const p of payments) { const n = decimal(p.received); if (p.method === 'cash') cash += n; else digital += n; }
  if (digital > due) fail('Los medios digitales no admiten excedentes para cambio.');
  if (cash + digital < due) fail('El pago recibido es insuficiente.');
  return { change: formatted(cash + digital - due), cashApplied: formatted(due - digital), payments: payments.map(p => ({ ...p, applied: p.method === 'cash' ? formatted(due - digital) : p.received })) };
}
// Allocate actual pesos to components once. Stable largest remainders make full refunds exact.
function allocate(total: bigint, amounts: bigint[]) {
  const sum = amounts.reduce((a,b) => a+b,0n); if (!sum) return amounts.map(() => '0');
  const pesos = total / decimal('1'); const entries = amounts.map((n,i) => ({ i, n: pesos*n/sum, remainder: pesos*n%sum }));
  let rest = pesos - entries.reduce((a,e) => a+e.n,0n);
  for (const e of [...entries].sort((a,b) => a.remainder === b.remainder ? a.i-b.i : a.remainder > b.remainder ? -1 : 1)) if (rest > 0n) { e.n++; rest--; }
  return entries.map(e => String(e.n));
}
export function checkout(order: OrderV2, selection: Selection[], snapshots: Snapshot[], tip: Adjustment, shipping: string, payments?: Payment[], loyalty?: LoyaltyMeta) {
  if (!selection.length || new Set(selection.map(s => s.lineId)).size !== selection.length) fail('Selecciona cantidades distintas para cobrar.');
  const chosen: LineV2[] = []; const remaining = [...order.lines];
  for (const pick of selection) {
    const index = remaining.findIndex(l => l.id === pick.lineId); if (index < 0) fail('La línea ya no está pendiente.');
    const split = splitLine(remaining[index]!, pick.quantity, snapshots); chosen.push(split.chosen);
    if (split.remaining) remaining[index] = split.remaining; else remaining.splice(index, 1);
  }
  const lines = chosen.map(l => describeLine(l, snapshots)); const products = lines.reduce((n,l) => n+decimal(l.amount),0n);
  const gratuity = tip.kind === 'percent' ? ratio(products, decimal(tip.value), decimal('100')) : decimal(tip.value);
  if (tip.kind === 'percent' && decimal(tip.value) > decimal('100')) fail('La propina porcentual debe estar entre 0 y 100.');
  const freight = decimal(shipping); if (freight > decimal(order.shipping)) fail('El envío supera el saldo pendiente del domicilio.');
  if (!remaining.length && freight !== decimal(order.shipping)) fail('Incluye el envío pendiente al finalizar el pedido.');
  const rewards=loyalty?loyaltyCalculation(products,loyalty):null;
  const redeemed=rewards?decimal(rewards.redeemedAmount):0n;
  const cashGoods=apportion(products-redeemed,lines.map(l=>decimal(l.amount)));
  const exact = products - redeemed + gratuity + freight; const total = roundPeso(exact); if (total > decimal('999999999')) fail('El total supera el límite permitido.');
  const allocation = allocate(total, [...cashGoods, gratuity, freight]);
  const source = snapshots.find(s => s.id === order.snapshotId) ?? fail('Falta la bodega del pedido.');
  const consumption = chosen.length ? calculateSale(source, chosen, undefined, snapshots).consumption : [];
  const result = { ...(rewards?{loyalty:rewards}:{}), lines: lines.map((l,i) => ({ ...l, paidAmount: allocation[i]! })), products: formatted(products), discount: formatted(lines.reduce((a,l) => a+decimal(l.discount),0n)), tip: formatted(gratuity), shipping, tipPaid: allocation[lines.length]!, shippingPaid: allocation[lines.length+1]!, subtotal: formatted(exact), rounding: formatted(total-exact), total: formatted(total), consumption, warehouseId: source.warehouseId,
    ...(payments ? paymentTotals(formatted(total), payments) : { payments: [], change: '0', cashApplied: '0' }) };
  return { sale: result, order: { ...order, lines: remaining, shipping: formatted(decimal(order.shipping)-freight), revision: order.revision+1, closed: remaining.length === 0 } };
}
export type SaleV2 = ReturnType<typeof checkout>['sale'] & { id: string; orderId: string; receiptNumber: string; occurredAtMs: number; actorName: string; branchId: string; deviceId: string; customer: Customer | null };
export interface RefundV2 { id: string; saleId: string; lines: (Selection & { recoverable: boolean; amount: string })[]; tip: string; shipping: string; total: string; cashApplied: string; loyalty?:{customerId:string;earnedReversed:string;redeemedRestored:string}; payments: Payment[]; consumption: { itemId: string; quantity: string }[]; reason: string; occurredAtMs: number; actorName: string }
export function legacySale(data: Record<string, unknown>, snapshots: Snapshot[]): SaleV2 {
  if ('products' in data) return data as unknown as SaleV2;
  const old = data as unknown as { id:string;receiptNumber:string;occurredAtMs:number;actorName:string;branchId:string;deviceId:string;lines:ReturnType<typeof calculateSale>['lines'];payment:Payment;total:string;subtotal:string;rounding:string;change:string;cashApplied:string;consumption:{itemId:string;quantity:string}[] };
  const assigned = allocate(decimal(old.total),old.lines.map(l=>decimal(l.amount)));
  return { ...old, orderId:'legacy-'+old.id,customer:null,products:old.subtotal,discount:'0',tip:'0',shipping:'0',tipPaid:'0',shippingPaid:'0',warehouseId:snapshots.find(s=>s.id===old.lines[0]?.snapshotId)?.warehouseId??'',payments:[{...old.payment,applied:old.cashApplied==='0'?old.total:old.cashApplied}],lines:old.lines.map((l,i)=>({...l,notes:'',productType:snapshots.find(s=>s.id===l.snapshotId)?.products.find(p=>p.id===l.productId)?.type??'prepared',gross:l.amount,discount:'0',paidAmount:assigned[i]!})) };
}
export function refund(sale: SaleV2, previous: RefundV2[], e: Extract<CommandEvent,{kind:'sale.refund'}>, verifyPayments = true) {
  if (new Set(e.lines.map(l => l.lineId)).size !== e.lines.length) fail('Línea de devolución repetida.');
  const restored: { itemId: string; quantity: string }[] = [];
  const lines = e.lines.map(pick => {
    const original = sale.lines.find(l => l.id === pick.lineId) ?? fail('La línea no pertenece al comprobante.');
    const prior = previous.flatMap(r => r.lines).filter(l => l.lineId === pick.lineId).reduce((a,l) => a+decimal(l.quantity),0n);
    const q = decimal(pick.quantity); const qty = decimal(original.quantity); if (q <= 0n || prior+q > qty) fail('La cantidad supera lo que falta por devolver.');
    if (pick.recoverable && original.productType !== 'finished') fail('Un preparado no devuelve ingredientes al inventario.');
    if (pick.recoverable) restored.push({ itemId: original.productId, quantity: pick.quantity });
    const cumulative = (n: bigint) => roundPeso(ratio(decimal(original.paidAmount), n, qty));
    return { ...pick, amount: formatted(cumulative(prior+q)-cumulative(prior)) };
  });
  for (const key of ['tip','shipping'] as const) if (decimal(e[key]) + previous.reduce((a,r) => a+decimal(r[key]),0n) > decimal(sale[key === 'tip' ? 'tipPaid' : 'shippingPaid'])) fail('El importe excede el saldo de propina o domicilio.');
  if (verifyPayments && e.reason.trim().length < 3) fail('Registra el motivo de devolución.');
  if (decimal(e.tip)%decimal('1') || decimal(e.shipping)%decimal('1')) fail('Devuelve importes de propina y domicilio en pesos enteros.');
  const total = lines.reduce((a,l) => a+decimal(l.amount), decimal(e.tip)+decimal(e.shipping));
  const pay = verifyPayments ? paymentTotals(formatted(total), e.payments) : {cashApplied:'0',change:'0'}; if (decimal(pay.change) !== 0n) fail('La devolución debe coincidir exactamente con el importe.');
  let loyalty:RefundV2['loyalty'];
  if(sale.loyalty&&sale.customer){const goods=decimal(sale.products);let returned=0n;for(const line of sale.lines){const qty=[...previous.flatMap(r=>r.lines),...e.lines].filter(l=>l.lineId===line.id).reduce((a,l)=>a+decimal(l.quantity),0n);returned+=proportional(decimal(line.amount),qty,decimal(line.quantity));}
    const delta=(total:string,key:'earnedReversed'|'redeemedRestored')=>String(proportional(BigInt(total),returned,goods)-previous.reduce((a,r)=>a+BigInt(r.loyalty?.[key]??'0'),0n));
    loyalty={customerId:sale.customer.id,earnedReversed:delta(sale.loyalty.earnedPoints,'earnedReversed'),redeemedRestored:delta(sale.loyalty.redeemedPoints,'redeemedRestored')};
  }
  if(total<=0n&&BigInt(loyalty?.redeemedRestored??'0')<=0n)fail('Selecciona un importe o producto con valor para devolver.');
  return { ...(loyalty?{loyalty}:{}), lines, tip: e.tip, shipping: e.shipping, total: formatted(total), cashApplied: '-' + pay.cashApplied, payments: e.payments, consumption: restored, reason: e.reason };
}
export function validateSave(old: OrderV2 | null, proposed: OrderV2, snapshots: Snapshot[]) {
  if (proposed.closed || old?.closed || (old ? old.id !== proposed.id || old.revision !== proposed.revision : proposed.revision !== 0)) fail('El pedido cambió o está cerrado. Recarga la caja.');
  if (old && old.snapshotId !== proposed.snapshotId) fail('La bodega original del pedido debe conservarse.');
  if (new Set(proposed.lines.map(l => l.id)).size !== proposed.lines.length) fail('Identificadores de línea repetidos.');
  if (proposed.mode === 'table' && !proposed.label.trim()) fail('Indica la mesa.');
  if (proposed.mode === 'delivery' && !proposed.address.trim()) fail('Indica la dirección del domicilio.');
  if (proposed.mode !== 'delivery' && decimal(proposed.shipping) > 0n) fail('El envío corresponde a un domicilio.');
  for (const l of proposed.lines) {
    describeLine(l, snapshots); const prior = old?.lines.find(p => p.id === l.id);
    if (l.sentQuantity !== (prior?.sentQuantity ?? '0')) fail('La cantidad enviada se cambia mediante comanda o cancelación.');
    if (prior && decimal(prior.sentQuantity) > 0n && (l.productId !== prior.productId || l.snapshotId !== prior.snapshotId || JSON.stringify(l.optionIds) !== JSON.stringify(prior.optionIds) || decimal(l.quantity) < decimal(prior.quantity))) fail('Cancela las unidades enviadas antes de cambiar su preparación.');
  }
  for (const prior of old?.lines ?? []) if (decimal(prior.sentQuantity) > 0n && !proposed.lines.some(l => l.id === prior.id)) fail('Registra la cancelación y las unidades preparadas.');
  return { ...proposed, revision: proposed.revision+1 };
}
export function cancelLines(order: OrderV2, event: Extract<CommandEvent,{kind:'order.cancel'}>, snapshots: Snapshot[]) {
  if ((!event.lines.length && order.lines.length > 0) || new Set(event.lines.map(l => l.lineId)).size !== event.lines.length || event.reason.trim().length < 3) fail('Selecciona líneas y registra un motivo.');
  const remaining = [...order.lines]; const wasted: LineV2[] = [];
  for (const pick of event.lines) {
    const index = remaining.findIndex(l => l.id === pick.lineId); if (index < 0) fail('La línea ya no está pendiente.'); const l = remaining[index]!;
    if (decimal(pick.preparedQuantity) > min(decimal(pick.quantity),decimal(l.sentQuantity))) fail('Las unidades preparadas no pueden exceder lo enviado y cancelado.');
    const split = splitLine(l,pick.quantity,snapshots); if (split.remaining) remaining[index] = split.remaining; else remaining.splice(index,1);
    if (decimal(pick.preparedQuantity) > 0n) wasted.push({ ...l, quantity: pick.preparedQuantity, discount: { kind:'amount',value:'0' } });
  }
  const source = snapshots.find(s => s.id === order.snapshotId) ?? fail('Falta la bodega del pedido.');
  return { order: { ...order, lines: remaining, revision: order.revision+1, closed: remaining.length === 0 }, consumption: wasted.length ? calculateSale(source,wasted,undefined,snapshots).consumption : [], warehouseId: source.warehouseId };
}
export interface OrderContext { id: string; receiptNumber: string; actorName: string; actorId: string; branchId: string; deviceId: string; order: OrderV2 | null; snapshots: Snapshot[]; customer: Customer | null; originalSale: SaleV2 | null; refunds: RefundV2[] }
export function applyOrderEvent(e: OrderEvent, c: OrderContext) {
  let order: OrderV2 | null = c.order; let sale: SaleV2 | null = null; let refundRecord: RefundV2 | null = null; let comanda: Record<string, unknown> | null = null;
  let movements: { itemId: string; quantity: string }[] = []; let warehouseId = ''; let cashDelta = '0';
  if (e.kind === 'order.save') order = validateSave(order, e.order, c.snapshots);
  else if (e.kind === 'sale.refund') {
    if (!c.originalSale || c.originalSale.deviceId !== c.deviceId || c.originalSale.branchId !== c.branchId) fail('Comprobante no disponible en esta caja.');
    const result = refund(c.originalSale, c.refunds, e); refundRecord = { ...result, id: c.id, saleId: e.saleId, occurredAtMs: e.occurredAtMs, actorName: c.actorName }; movements = result.consumption; warehouseId = c.originalSale.warehouseId; cashDelta = result.cashApplied;
  } else {
    if (!order || order.closed || order.id !== e.orderId || order.revision !== e.revision) fail('El pedido cambió o ya no está abierto.');
    if (e.kind === 'order.prepare') {
      if (!order.lines.length) fail('Agrega productos antes de enviar la comanda.');
      comanda = { id: c.id, orderId: order.id, label: order.label, mode: order.mode, actorName: c.actorName, occurredAtMs: e.occurredAtMs, lines: order.lines.map(l => ({ ...describeLine(l,c.snapshots), newlySent: formatted(decimal(l.quantity)-decimal(l.sentQuantity)) })) };
      order = { ...order, revision: order.revision+1, lines: order.lines.map(l => ({ ...l, sentQuantity: l.quantity })) };
    } else if (e.kind === 'order.cancel') {
      const result = cancelLines(order,e,c.snapshots); order = result.order; movements = result.consumption.map(l => ({ ...l, quantity: '-'+l.quantity })); warehouseId = result.warehouseId;
    } else {
      const result = checkout(order,e.selection,c.snapshots,e.tip,e.shipping,e.payments,e.loyalty); order = result.order;
      sale = { ...result.sale, id:c.id, orderId:e.orderId, customer:c.customer, receiptNumber:c.receiptNumber, occurredAtMs:e.occurredAtMs, actorName:c.actorName, branchId:c.branchId, deviceId:c.deviceId };
      movements = sale.consumption.map(l => ({ ...l,quantity:'-'+l.quantity })); warehouseId = sale.warehouseId; cashDelta = sale.cashApplied;
    }
  }
  return { order, sale, refund:refundRecord, comanda, movements, warehouseId, cashDelta };
}
