import { formatted } from './catalog.ts';
import { signedDecimal } from './pos-domain.ts';
import type { ShiftReceipt } from './shift-receipt.ts';

// products: net paid products (same measure as Dashboard); sales: net total collected,
// including tips/shipping. Keep both amounts explicit in every user-facing report.
export type SalesSummary = { products: string; sales: string; refunds: string; saleCount: number; tips: string; shipping: string; payments: Record<string,string> };
export type BranchSales = SalesSummary & { branchId: string; name: string; status: 'open'|'closed'|'no_close'; lastSynchronizedAt: string|null };
export type StockRow = { branchId:string; branchName:string; warehouseId:string; warehouseName:string; itemId:string; itemName:string; reference:string; baseUnit:string; quantity:string; minimum:string };
export type NotificationReport = {
  version:2; kind:'shift_closed'|'low_stock_daily'; branchIds:string[]; date:string; preparedAt:string;
  coverage:'server-synchronized-only'; partial:boolean; branches:BranchSales[]; totals:SalesSummary;
  close:ShiftReceipt|null; stock:StockRow[];
};
export function money(value:string) {
  const amount=signedDecimal(value),absolute=amount<0n?-amount:amount;
  const fraction=String(absolute%1_000_000n).padStart(6,'0').replace(/0+$/,'');
  return `${amount<0n?'-':''}$ ${new Intl.NumberFormat('es-CO').format(absolute/1_000_000n)}${fraction?','+fraction:''}`;
}
export const paymentLabels:Record<string,string> = {cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia',breb:'Bre-B',daviplata:'Daviplata',nequi:'Nequi'};
export const branchStatus = {open:'Turno abierto',closed:'Cierre sincronizado',no_close:'Sin cierre de la fecha'};
const localTime=(value:string|number)=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export function colombiaDate(now = new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;
}
export function sumSales(branches:SalesSummary[]):SalesSummary {
  const result:SalesSummary={products:'0',sales:'0',refunds:'0',saleCount:0,tips:'0',shipping:'0',payments:{}};
  for(const branch of branches) {
    for(const key of ['products','sales','refunds','tips','shipping'] as const) result[key]=formatted(signedDecimal(result[key])+signedDecimal(branch[key]));
    result.saleCount+=branch.saleCount;
    for(const [method,value] of Object.entries(branch.payments)) result.payments[method]=formatted(signedDecimal(result.payments[method]??'0')+signedDecimal(value));
  }
  return result;
}
export function reportText(report:NotificationReport) {
  if(report.kind==='low_stock_daily') return `Nativos · Mínimos · ${report.date}\n${report.stock.map(r=>`${r.branchName} / ${r.warehouseName}: ${r.itemName} ${r.quantity} ${r.baseUnit} (mínimo ${r.minimum})`).join('\n')}\nSaldo confirmado al preparar. Sólo operaciones sincronizadas.`;
  const close=report.close!;
  return [`Nativos · Cierre y consolidado · ${report.date}${report.partial?' · PARCIAL':''}`,
    `Cierre: ${report.branches.find(b=>b.branchId===close.branchId)?.name??close.branchId} · ${close.shift.actorName}`,
    `Turno: ${localTime(close.shift.openedAtMs)} a ${localTime(close.shift.closedAtMs)} (Colombia)`,
    `Ventas del turno ${money(close.totals.sales)} · Devoluciones ${money(close.totals.refunds)} · Propinas netas ${money(close.totals.tip)} · Domicilios netos ${money(close.totals.shipping)}`,
    `Base ${money(close.shift.openingCash)} · Esperado ${money(close.shift.expected)} · Contado ${money(close.shift.counted)} · Diferencia ${money(close.shift.difference)}`,
    `Entradas ${money(close.totals.income)} · Gastos ${money(close.totals.expense)} · Retiros ${money(close.totals.withdrawal)} · Correcciones ${money(close.totals.correction)}`,
    ...report.branches.map(b=>`${b.name}: ventas netas de productos ${money(b.products)}, ${b.saleCount} ventas · Recaudo neto ${money(b.sales)} · ${branchStatus[b.status]} · Última sincronización: ${b.lastSynchronizedAt?localTime(b.lastSynchronizedAt):'sin confirmar'}`),
    `Ventas netas de productos ${money(report.totals.products)} · Recaudo neto ${money(report.totals.sales)} · Devoluciones totales ${money(report.totals.refunds)}`,
    Object.entries(report.totals.payments).filter(([,v])=>v!=='0').map(([m,v])=>`${paymentLabels[m]??m} ${money(v)}`).join(' · '),
    `Propinas netas ${money(report.totals.tips)} · Domicilios netos ${money(report.totals.shipping)}`,
    'Sólo operaciones sincronizadas. Puede haber pendientes en los navegadores.'].filter(Boolean).join('\n');
}
// A template parameter must fit a single line. The authenticated detail preserves every row.
export function templateSummary(report:NotificationReport) {
  const text=report.kind==='low_stock_daily'
    ? `Nativos ${report.date}: ${report.stock.length} artículos/bodegas en mínimos. ${report.stock.slice(0,3).map(r=>`${r.branchName}: ${r.itemName} ${r.quantity} ${r.baseUnit}`).join('; ')}. Consulta el detalle completo.`
    : `Nativos ${report.date}${report.partial?' PARCIAL':''}. Cierre ${report.branches.find(b=>b.branchId===report.close?.branchId)?.name??''}. Ventas netas de productos: ${report.branches.map(b=>`${b.name} ${money(b.products)} (${branchStatus[b.status]})`).join('; ')}. Total ventas ${money(report.totals.products)}. Recaudo neto ${money(report.totals.sales)}. Propinas ${money(report.totals.tips)}. Domicilios ${money(report.totals.shipping)}. Sólo datos sincronizados; consulta el detalle.`;
  return text.replace(/\s+/g,' ').slice(0,900);
}
export function reportSheets(report:NotificationReport) {
  const sheets:{name:string;rows:unknown[][]}[]=[{name:'Contexto',rows:[['Nativos','Reporte WhatsApp'],['Fecha Colombia',report.date],['Preparado',report.preparedAt],['Cobertura','Sólo operaciones sincronizadas; puede haber pendientes offline'],['Parcial',report.partial?'Sí':'No'],['Tipo',report.kind]]}];
  if(report.kind==='low_stock_daily') sheets.push({name:'Mínimos',rows:[['Sucursal','Bodega','Artículo','Referencia','Unidad','Saldo','Mínimo'],...report.stock.map(r=>[r.branchName,r.warehouseName,r.itemName,r.reference,r.baseUnit,r.quantity,r.minimum])]});
  else {
    sheets.push({name:'Ventas del día',rows:[['Sucursal','Estado','Última sincronización','Recaudo neto','Ventas netas de productos','Devoluciones totales','Cantidad ventas','Propinas netas','Domicilios netos'],...report.branches.map(b=>[b.name,branchStatus[b.status],b.lastSynchronizedAt??'Sin confirmar',b.sales,b.products,b.refunds,b.saleCount,b.tips,b.shipping]),['TOTAL','','',report.totals.sales,report.totals.products,report.totals.refunds,report.totals.saleCount,report.totals.tips,report.totals.shipping]]});
    sheets.push({name:'Medios del día',rows:[['Sucursal','Medio','Importe neto'],...report.branches.flatMap(b=>Object.entries(b.payments).map(([m,v])=>[b.name,paymentLabels[m]??m,v]))]});
    const close=report.close!;
    const totalLabels:Record<string,string>={sales:'Ventas cobradas',refunds:'Devoluciones',income:'Entradas',expense:'Gastos',withdrawal:'Retiros',correction:'Correcciones',net:'Neto con movimientos',saleCount:'Cantidad de ventas',refundCount:'Cantidad de devoluciones',products:'Ventas netas de productos',tip:'Propinas netas',shipping:'Domicilios netos',change:'Cambio entregado'};
    sheets.push({name:'Cierre',rows:[['Turno',close.shiftId],['Responsable',close.shift.actorName],['Apertura',localTime(close.shift.openedAtMs)],['Cierre',localTime(close.shift.closedAtMs)],['Zona horaria','America/Bogota'],['Base',close.shift.openingCash],['Esperado',close.shift.expected],['Contado',close.shift.counted],['Diferencia',close.shift.difference],...Object.entries(close.totals).map(([key,value])=>[totalLabels[key]??key,value])]});
    sheets.push({name:'Medios del turno',rows:[['Medio','Ventas','Devoluciones','Ingresos','Gastos','Retiros','Correcciones','Neto'],...close.payments.map(p=>[paymentLabels[p.method],p.sales,p.refunds,p.income,p.expense,p.withdrawal,p.correction,p.net])]});
    sheets.push({name:'Movimientos del turno',rows:[['ID','Tipo','Referencia','Fecha','Responsable','Motivo','Importe','Efectivo'],...close.movements.map(m=>[m.id,m.kind,m.reference,new Date(m.occurredAtMs).toISOString(),m.actorName,m.reason,m.amount,m.cashDelta])]});
  }
  return sheets;
}
