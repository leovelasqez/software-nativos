import { formatted } from '../src/catalog.ts';
import { signedDecimal } from '../src/pos-domain.ts';
import type { ShiftReport } from '../src/shift-receipt.ts';
import { Dialog, Logo, Notice } from './components.tsx';

const money = (n: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 6 }).format(Number(n));
const when = (n: number) => new Date(n).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
const methods = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', breb: 'Bre-B', daviplata: 'Daviplata', nequi: 'Nequi' };
const salesLabels = { cash: 'Ventas en efectivo', card: 'Ventas por tarjeta', transfer: 'Ventas por transferencias', breb: 'Ventas por Bre-B', daviplata: 'Ventas por Daviplata', nequi: 'Ventas por Nequi' };
const kinds = { sale: 'Venta', refund: 'Devolución', income: 'Ingreso', expense: 'Gasto', withdrawal: 'Retiro', correction: 'Corrección' };

export function ShiftReceiptDialog({ receipt: r, pending, shared = false, onClose }: { receipt: ShiftReport; pending: boolean; shared?: boolean; onClose: () => void }) {
  const preview = 'viewedAtMs' in r;
  const cash = r.payments.find(p => p.method === 'cash')!;
  const digitalWithdrawals = formatted(signedDecimal(r.totals.withdrawal) - signedDecimal(cash.withdrawal));
  const negative = (amount: string) => formatted(-signedDecimal(amount));
  const rows = [
    { label: 'Base inicial', amount: r.shift.openingCash },
    ...r.payments.map(p => ({ label: salesLabels[p.method], amount: p.sales })),
    { label: 'Devolución de dinero', amount: negative(r.totals.refunds) },
    ...(signedDecimal(r.totals.income) !== 0n ? [{ label: 'Ingresos', amount: r.totals.income }] : []),
    ...(signedDecimal(r.totals.expense) !== 0n ? [{ label: 'Gastos', amount: negative(r.totals.expense) }] : []),
    { label: 'Retiros en efectivo', amount: negative(cash.withdrawal) },
    ...(signedDecimal(digitalWithdrawals) !== 0n ? [{ label: 'Retiros por otros medios', amount: negative(digitalWithdrawals) }] : []),
    ...(signedDecimal(r.totals.correction) !== 0n ? [{ label: 'Correcciones', amount: r.totals.correction }] : [])
  ];
  const totalMovements = formatted(signedDecimal(r.shift.openingCash) + signedDecimal(r.totals.net));
  return <Dialog className="receipt-dialog" eyebrow="CAJA NATIVOS" title={preview ? 'Comprobante del turno en curso' : 'Comprobante de cierre'} onClose={onClose}>
    <div className="pos-receipt thermal-receipt shift-receipt">
      <Logo /><h2>{preview ? 'Revisión del turno abierto' : 'Cierre de caja'}</h2>
      <p className="shift-identity">{r.branchId === 'milan' ? 'Milán' : r.branchId === 'centro' ? 'Centro' : r.branchId} · {r.shift.actorName}</p>
      <small className="receipt-number">N.º de turno: {r.shiftId}</small>
      <div className="shift-period"><strong>Fecha</strong><span>{when(r.shift.openedAtMs)} — {preview ? when(r.viewedAtMs) : when(r.shift.closedAtMs!)}</span></div>
      <p className="shift-status">{preview ? 'Vista previa · El turno sigue abierto.' : pending ? 'Cierre guardado en este navegador · Pendiente de sincronización.' : 'Cierre sincronizado.'}</p>
      {preview && shared && <div className="receipt-screen-only"><Notice>Incluye los movimientos guardados aquí y los últimos movimientos sincronizados de otros equipos. Sincroniza los otros equipos para comprobar el turno completo.</Notice></div>}
      <dl className="shift-compact-summary">
        <div className="shift-summary-total"><dt>Total de ventas</dt><dd>{money(r.totals.sales)}</dd></div>
        {rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{money(row.amount)}</dd></div>)}
        <div className="shift-summary-total"><dt>Total de movimientos</dt><dd>{money(totalMovements)}</dd></div>
      </dl>
      <dl className="shift-cash-summary">
        <div className="shift-summary-total"><dt>{preview ? 'Dinero en efectivo esperado' : 'Dinero en efectivo del cierre'}</dt><dd>{money(preview ? r.shift.expected : r.shift.counted!)}</dd></div>
        {!preview && <div><dt>Efectivo esperado</dt><dd>{money(r.shift.expected)}</dd></div>}
        <div><dt>Diferencia</dt><dd>{r.shift.difference === null ? 'Pendiente de cierre' : money(r.shift.difference)}</dd></div>
      </dl>
      {(signedDecimal(r.totals.tip) !== 0n || signedDecimal(r.totals.shipping) !== 0n) && <p className="shift-included">Propina neta: {money(r.totals.tip)} · Domicilio neto: {money(r.totals.shipping)}. Incluidos en los totales.</p>}
      <div className="shift-observations"><strong>Observaciones:</strong><span aria-hidden="true" /></div>
      <div className="receipt-actions"><button type="button" className="primary" onClick={() => window.print()}>{preview ? 'Imprimir revisión' : 'Imprimir cierre'}</button></div>
      <details className="receipt-screen-only shift-full-detail"><summary>Ver detalle completo</summary>
      <section><h2>Arqueo de efectivo</h2><p>Base: {money(r.shift.openingCash)}<br />Efectivo esperado: {money(r.shift.expected)}<br />Efectivo contado: {r.shift.counted === null ? 'Pendiente de conteo' : money(r.shift.counted)}<br /><strong>Diferencia: {r.shift.difference === null ? 'Pendiente de cierre' : money(r.shift.difference)}</strong></p></section>
      <section><h2>Resumen del turno</h2><p>Ventas ({r.totals.saleCount}): {money(r.totals.sales)}<br />Devoluciones ({r.totals.refundCount}): {money(r.totals.refunds)}<br />Ingresos: {money(r.totals.income)}<br />Gastos: {money(r.totals.expense)}<br />Retiros: {money(r.totals.withdrawal)}<br />Correcciones: {money(r.totals.correction)}<br /><strong>Neto de movimientos: {money(r.totals.net)}</strong></p>
        <p>Productos netos cobrados: {money(r.totals.products)}<br />Propina neta: {money(r.totals.tip)}<br />Domicilio neto: {money(r.totals.shipping)}<br />Cambio entregado: {money(r.totals.change)}</p><small>Propinas y domicilios incluidos en las ventas. El neto de movimientos excluye la base.</small></section>
      <section><h2>Totales por medio de pago</h2>{r.payments.map(p => <div className="receipt-line" key={p.method}><p><strong>{methods[p.method]}</strong><br />Ventas: {money(p.sales)} · Devoluciones: {money(p.refunds)}<br />Ingresos: {money(p.income)} · Gastos: {money(p.expense)}<br />Retiros: {money(p.withdrawal)} · Correcciones: {money(p.correction)}<br /><strong>Neto: {money(p.net)}</strong></p></div>)}</section>
      <section><h2>Detalle de movimientos</h2>{!r.movements.length && <p>No hubo movimientos durante el turno.</p>}{r.movements.map(m => <div className="receipt-line" key={m.id}><p><strong>{kinds[m.kind]} · {money(m.amount)}</strong><br />{when(m.occurredAtMs)} · {m.actorName}<br /><small className="receipt-number">{m.reference}</small>{m.reason && <><br />{m.reason}</>}{m.payments.map((p, i) => <span className="shift-payment-line" key={i}>{methods[p.method]}: {money(p.amount)}</span>)}<small>Efecto en efectivo: {money(m.cashDelta)}</small></p></div>)}</section>
      </details>
      <div className="receipt-screen-only"><Notice>{preview ? 'Consulta del turno en curso. Los totales se actualizan con los movimientos guardados y sincronizados. Revisarlo o imprimirlo mantiene el turno abierto.' : 'Copia del cierre guardado. Consultarlo o imprimirlo no registra movimientos nuevos.'}</Notice></div>
    </div>
  </Dialog>;
}
