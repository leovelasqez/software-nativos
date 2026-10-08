import type { ShiftReceipt } from '../src/shift-receipt.ts';
import { Dialog, Logo, Notice } from './components.tsx';

const money = (n: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 6 }).format(Number(n));
const when = (n: number) => new Date(n).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
const methods = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', breb: 'Bre-B', daviplata: 'Daviplata', nequi: 'Nequi' };
const kinds = { sale: 'Venta', refund: 'Devolución', income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro', correction: 'Corrección' };

export function ShiftReceiptDialog({ receipt: r, pending, onClose }: { receipt: ShiftReceipt; pending: boolean; onClose: () => void }) {
  return <Dialog className="receipt-dialog" eyebrow="CAJA NATIVOS" title="Comprobante de cierre" onClose={onClose}>
    <div className="pos-receipt thermal-receipt shift-receipt">
      <Logo /><h2>Cierre de caja</h2>
      <p>{r.branchId === 'milan' ? 'Milán' : r.branchId === 'centro' ? 'Centro' : r.branchId} · {r.deviceId}<br />Responsable: {r.shift.actorName}<br />Apertura: {when(r.shift.openedAtMs)}<br />Cierre: {when(r.shift.closedAtMs)}</p>
      <small className="receipt-number">Turno: {r.shiftId}</small>
      <Notice>{pending ? 'Cierre guardado en este navegador · Pendiente de sincronización.' : 'Cierre sincronizado.'}</Notice>
      <section><h2>Arqueo de efectivo</h2><p>Base: {money(r.shift.openingCash)}<br />Efectivo esperado: {money(r.shift.expected)}<br />Efectivo contado: {money(r.shift.counted)}<br /><strong>Diferencia: {money(r.shift.difference)}</strong></p></section>
      <section><h2>Resumen del turno</h2><p>Ventas ({r.totals.saleCount}): {money(r.totals.sales)}<br />Devoluciones ({r.totals.refundCount}): {money(r.totals.refunds)}<br />Ingresos: {money(r.totals.income)}<br />Gastos: {money(r.totals.expense)}<br />Retiros: {money(r.totals.withdrawal)}<br />Correcciones: {money(r.totals.correction)}<br /><strong>Neto de movimientos: {money(r.totals.net)}</strong></p>
        <p>Productos netos cobrados: {money(r.totals.products)}<br />Propina neta: {money(r.totals.tip)}<br />Domicilio neto: {money(r.totals.shipping)}<br />Cambio entregado: {money(r.totals.change)}</p><small>Propinas y domicilios incluidos en las ventas. La base se incluye solo en el arqueo.</small></section>
      <section><h2>Totales por medio de pago</h2>{r.payments.map(p => <div className="receipt-line" key={p.method}><p><strong>{methods[p.method]}</strong><br />Ventas: {money(p.sales)} · Devoluciones: {money(p.refunds)}<br />Ingresos: {money(p.income)} · Gastos: {money(p.expense)}<br />Retiros: {money(p.withdrawal)} · Correcciones: {money(p.correction)}<br /><strong>Neto: {money(p.net)}</strong></p></div>)}</section>
      <section><h2>Detalle de movimientos</h2>{!r.movements.length && <p>No hubo movimientos durante el turno.</p>}{r.movements.map(m => <div className="receipt-line" key={m.id}><p><strong>{kinds[m.kind]} · {money(m.amount)}</strong><br />{when(m.occurredAtMs)} · {m.actorName}<br /><small className="receipt-number">{m.reference}</small>{m.reason && <><br />{m.reason}</>}{m.payments.map((p, i) => <span className="shift-payment-line" key={i}>{methods[p.method]}: {money(p.amount)}</span>)}<small>Efecto en efectivo: {money(m.cashDelta)}</small></p></div>)}</section>
      <div className="receipt-actions"><button type="button" className="primary" onClick={() => window.print()}>Imprimir cierre</button></div>
      <div className="receipt-screen-only"><Notice>Copia del cierre guardado. Consultarlo o imprimirlo no registra movimientos nuevos.</Notice></div>
    </div>
  </Dialog>;
}
