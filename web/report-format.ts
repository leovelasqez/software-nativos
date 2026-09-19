const labels: Record<string, string> = {
  id:'Identificador', kind:'Tipo', branchId:'Sucursal', occurredAt:'Fecha', occurredAtMs:'Fecha', receiptNumber:'Comprobante',
  name:'Nombre', reference:'Referencia', presentation:'Presentación', customer:'Cliente', customerId:'Cliente', document:'Documento', phone:'Celular',
  products:'Productos', discounts:'Descuentos', discount:'Descuento', redemption:'Canje de puntos', redeemedAmount:'Valor canjeado', tips:'Propinas', tip:'Propina', shipping:'Domicilio', refunds:'Devoluciones', cash:'Efectivo', digital:'Pagos digitales',
  total:'Total', subtotal:'Subtotal', rounding:'Redondeo', gross:'Importe bruto', amount:'Importe', paidAmount:'Pagado', received:'Recibido', applied:'Aplicado', cashApplied:'Efectivo aplicado', cashDelta:'Movimiento de efectivo', change:'Cambio', tipPaid:'Propina pagada', shippingPaid:'Domicilio pagado',
  warehouse:'Bodega', warehouseId:'Bodega', item:'Artículo', itemId:'Artículo', quantity:'Cantidad', minimum:'Mínimo', supplier:'Proveedor', supplierId:'Proveedor', purchasedOn:'Fecha de compra', paymentMethod:'Medio de pago', method:'Medio',
  openingCash:'Base de apertura', expected:'Esperado', counted:'Contado', difference:'Diferencia', openedAt:'Apertura', closedAt:'Cierre', actorName:'Responsable', reason:'Motivo', class:'Clase',
  lines:'Productos', payments:'Pagos', payment:'Pago', consumption:'Consumo de inventario', loyalty:'Puntos', earned:'Ganados', redeemed:'Canjeados', earnedReversed:'Puntos revertidos', redeemedRestored:'Puntos restituidos',
  saleId:'Venta relacionada', orderId:'Pedido', shiftId:'Turno', deviceId:'Caja', productId:'Producto', lineId:'Línea', notes:'Notas', recoverable:'Reingresa al inventario',
};
const moneyFields = new Set(['products','discounts','discount','redemption','redeemedAmount','tips','tip','shipping','refunds','cash','digital','total','subtotal','rounding','gross','amount','paidAmount','received','applied','cashApplied','cashDelta','change','tipPaid','shippingPaid','openingCash','expected','counted','difference']);
const dateFields = new Set(['occurredAt','occurredAtMs','openedAt','closedAt','createdAt']);
const values: Record<string,string> = { sale:'Venta', refund:'Devolución', shift:'Turno', movement:'Movimiento', waste:'Desperdicio', internal_consumption:'Consumo interno', income:'Ingreso', expense:'Egreso', cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia',breb:'Bre-B',daviplata:'Daviplata',nequi:'Nequi',centro:'Centro',milan:'Milán' };
export const reportLabel = (key: string) => labels[key] ?? key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
export function reportValue(key: string, value: unknown): string {
  if(value===null || value===undefined || value==='') return '—';
  if(typeof value==='boolean') return value?'Sí':'No';
  if(moneyFields.has(key) && /^-?\d+(\.\d+)?$/.test(String(value))) return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:6}).format(Number(value));
  if(dateFields.has(key)) { const date = new Date(typeof value==='number'?value:String(value)); if(!Number.isNaN(date.valueOf())) return date.toLocaleString('es-CO',{timeZone:'America/Bogota'}); }
  if(key==='customer' && typeof value==='object') return String((value as {name?:string}).name ?? 'Consumidor final');
  if(typeof value==='object') return Array.isArray(value)?`${value.length} registros`:'Ver detalle';
  if(key==='quantity' || key==='minimum') return new Intl.NumberFormat('es-CO',{maximumFractionDigits:6}).format(Number(value));
  return ['kind','class','branchId','paymentMethod','method'].includes(key)?values[String(value)]??String(value):String(value);
}
export const reportColumns: Record<string,string[]> = {
  sales:['kind','receiptNumber','occurredAt','customer','total'],
  cash:['kind','openedAt','occurredAt','openingCash','expected','counted','difference','amount'],
  inventory:['name','reference','warehouse','quantity','minimum'],
  purchases:['purchasedOn','supplier','paymentMethod','paidAmount'],
  waste:['occurredAt','item','kind','quantity','reason'],
  loyalty:['customerId','saleId','earned','redeemed','earnedReversed','redeemedRestored'],
};
