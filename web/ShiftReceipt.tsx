import type { ShiftReport } from '../src/shift-receipt.ts';
import { Dialog, Logo, Notice } from './components.tsx';

const money = (n: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 6 }).format(Number(n));
const when = (n: number) => new Date(n).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
const methods = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', breb: 'Bre-B', daviplata: 'Daviplata', nequi: 'Nequi' };
const kinds = { sale: 'Venta', refund: 'Devolución', income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro', correction: 'Corrección' };

export function ShiftReceiptDialog({ receipt: r, pending, shared = false, onClose }: { receipt: ShiftReport; pending: boolean; shared?: boolean; onClose: () => void }) {
  const preview = 'viewedAtMs' in r;
  return <Dialog className="receipt-dialog" eyebrow="CAJA NATIVOS" title={preview ? 'Comprobante del turno en curso' : 'Comprobante de cierre'} onClose={onClose}>
    <div className="pos-receipt thermal-receipt shift-receipt">
      <Logo /><h2>{preview ? 'Revisión del turno abierto' : 'Cierre de caja'}</h2>
      <p>{r.branchId === 'milan' ? 'Milán' : r.branchId === 'centro' ? 'Centro' : r.branchId} · {r.deviceId}<br />Responsable: {r.shift.actorName}<br />Apertura: {when(r.shift.openedAtMs)}<br />{preview ? `Consulta: ${when(r.viewedAtMs)}` : `Cierre: ${when(r.shift.closedAtMs!)}`}</p>
      <small className="receipt-number">Turno: {r.shiftId}</small>
      <Notice>{preview ? 'Vista previa · El turno sigue abierto.' : pending ? 'Cierre guardado en este navegador · Pendiente de sincronización.' : 'Cierre sincronizado.'}</Notice>
      {preview && shared && <Notice>Incluye los movimientos guardados aquí y los últimos movimientos sincronizados de otros equipos. Sincroniza los otros equipos para comprobar el turno completo.</Notice>}
      <section><h2>Arqueo de efectivo</h2><p>Base: {money(r.shift.openingCash)}<br />Efectivo esperado: {money(r.shift.expected)}<br />Efectivo contado: {r.shift.counted === null ? 'Pendiente de conteo' : money(r.shift.counted)}<br /><strong>Diferencia: {r.shift.difference === null ? 'Pendiente de cierre' : money(r.shift.difference)}</strong></p></section>
      <section><h2>Resumen del turno</h2><p>Ventas ({r.totals.saleCount}): {money(r.totals.sales)}<br />Devoluciones ({r.totals.refundCount}): {money(r.totals.refunds)}<br />Ingresos: {money(r.totals.income)}<br />Gastos: {money(r.totals.expense)}<br />Retiros: {money(r.totals.withdrawal)}<br />Correcciones: {money(r.totals.correction)}<br /><strong>Neto de movimientos: {money(r.totals.net)}</strong></p>
        <p>Productos netos cobrados: {money(r.totals.products)}<br />Propina neta: {money(r.totals.tip)}<br />Domicilio neto: {money(r.totals.shipping)}<br />Cambio entregado: {money(r.totals.change)}</p><small>Propinas y domicilios incluidos en las ventas. La base se incluye solo en el arqueo.</small></section>
      <section><h2>Totales por medio de pago</h2>{r.payments.map(p => <div className="receipt-line" key={p.method}><p><strong>{methods[p.method]}</strong><br />Ventas: {money(p.sales)} · Devoluciones: {money(p.refunds)}<br />Ingresos: {money(p.income)} · Gastos: {money(p.expense)}<br />Retiros: {money(p.withdrawal)} · Correcciones: {money(p.correction)}<br /><strong>Neto: {money(p.net)}</strong></p></div>)}</section>
      <section><h2>Detalle de movimientos</h2>{!r.movements.length && <p>No hubo movimientos durante el turno.</p>}{r.movements.map(m => <div className="receipt-line" key={m.id}><p><strong>{kinds[m.kind]} · {money(m.amount)}</strong><br />{when(m.occurredAtMs)} · {m.actorName}<br /><small className="receipt-number">{m.reference}</small>{m.reason && <><br />{m.reason}</>}{m.payments.map((p, i) => <span className="shift-payment-line" key={i}>{methods[p.method]}: {money(p.amount)}</span>)}<small>Efecto en efectivo: {money(m.cashDelta)}</small></p></div>)}</section>
      <div className="receipt-actions"><button type="button" className="primary" onClick={() => window.print()}>{preview ? 'Imprimir revisión' : 'Imprimir cierre'}</button></div>
      <div className="receipt-screen-only"><Notice>{preview ? 'Consulta del turno en curso. Los totales se actualizan con los movimientos guardados y sincronizados. Revisarlo o imprimirlo mantiene el turno abierto.' : 'Copia del cierre guardado. Consultarlo o imprimirlo no registra movimientos nuevos.'}</Notice></div>
    </div>
  </Dialog>;
}
