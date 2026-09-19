import { useEffect, useId, useRef, useState } from 'react';
import type { Dashboard as DashboardData } from '../src/dashboard.ts';
import type { Branch } from './api.ts';
import { api, date } from './api.ts';
import { Heading, Notice } from './components.tsx';
import { Icon } from './Icon.tsx';

const money = (value: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value));
const quantity = (value: string) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date(value + 'T12:00:00-05:00'));
const units: Record<string, string> = { unit: 'und', ml: 'ml', g: 'g' };

function SalesChart({ daily }: { daily: DashboardData['daily'] }) {
  const container = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(400); const gradient = useId().replace(/:/g, '');
  useEffect(() => { const element = container.current!; const observer = new ResizeObserver(() => setWidth(Math.max(element.clientWidth, 200))); observer.observe(element); return () => observer.disconnect(); }, []);
  const height = 224, left = 65, right = 14, top = 18, bottom = 35;
  const values = daily.map(d => Number(d.sales)); const low = Math.min(0, ...values), high = Math.max(1, ...values); const extent = high - low;
  const x = (index: number) => left + index / Math.max(1, daily.length - 1) * (width - left - right);
  const y = (value: number) => top + (high - value) / extent * (height - top - bottom);
  const path = daily.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(d.sales))}`).join(' ');
  const ticks = [...new Set([0, Math.floor((daily.length - 1) / 3), Math.floor(2 * (daily.length - 1) / 3), daily.length - 1])];
  const scale = high >= 1_000_000 || Math.abs(low) >= 1_000_000 ? 1_000_000 : high >= 1000 || Math.abs(low) >= 1000 ? 1000 : 1;
  return <div className="sales-chart" ref={container}><p className="chart-unit">{scale === 1_000_000 ? 'Millones de COP' : scale === 1000 ? 'Miles de COP' : 'COP'}</p>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ventas netas de productos por día del mes. El detalle se encuentra debajo de la gráfica.">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--brand)" stopOpacity=".015"/></linearGradient></defs>
      {[0, 1, 2, 3].map(index => { const value = low + extent * index / 3; return <g key={index}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-grid"/><text x={left - 10} y={y(value) + 4} textAnchor="end">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1, notation: 'compact' }).format(value / scale)}</text></g>; })}
      <path d={`${path} L${x(daily.length - 1)},${y(0)} L${left},${y(0)} Z`} fill={`url(#${gradient})`}/><path d={path} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round"/>
      {daily.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(Number(d.sales))} r={daily.length === 1 ? 4 : 6} fill={daily.length === 1 ? 'var(--brand)' : 'transparent'}><title>{dateLabel(d.date)}: {money(d.sales)}</title></circle>)}
      {ticks.map(index => <text key={index} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === daily.length - 1 ? 'end' : 'middle'}>{daily[index]!.date.slice(-2)}</text>)}
    </svg><details className="chart-data"><summary>Ver cifras por día</summary><table><thead><tr><th>Día</th><th>Ventas netas</th></tr></thead><tbody>{daily.map(day => <tr key={day.date}><td>{dateLabel(day.date)}</td><td>{money(day.sales)}</td></tr>)}</tbody></table></details></div>;
}

export function Dashboard({ branchId, branches, firstName, inventory }: { branchId: string; branches: Branch[]; firstName: string; inventory: (branchId?: string, warehouseId?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError('');
    void api<DashboardData>(`/dashboard?${new URLSearchParams({ branchId })}`).then(result => { if (active) setData(result); }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [branchId, refresh]);
  return <div className="dashboard"><Heading eyebrow="RESUMEN" title={`Hola, ${firstName}`} action={<button className="secondary" onClick={() => setRefresh(n => n + 1)}><Icon name="refresh"/>Actualizar</button>}>Tu negocio, de un vistazo{data ? ` · ${dateLabel(data.context.today)}` : ''}.</Heading>
    {error ? <Notice error>{error} Puedes volver a intentarlo con Actualizar.</Notice> : !data ? <section className="panel dashboard-loading" role="status">Consultando ventas e inventario…</section> : <>
      <div className="dashboard-kpis">
        <section className="panel dashboard-kpi"><span className="metric-label"><Icon name="wallet"/>Ventas del día</span><strong className="metric-value" data-testid="sales-today">{money(data.day.sales)}</strong><div className="metric-footer"><span>{data.day.saleCount} {data.day.saleCount === 1 ? 'venta' : 'ventas'}</span><span>Hoy · COP</span></div></section>
        <section className="panel dashboard-kpi"><span className="metric-label"><Icon name="month"/>Ventas del mes</span><strong className="metric-value" data-testid="sales-month">{money(data.month.sales)}</strong><div className="metric-footer"><span>{data.month.saleCount} {data.month.saleCount === 1 ? 'cobro' : 'cobros'}</span><span>Mes en curso</span></div></section>
        <section className="panel dashboard-kpi"><span className="metric-label"><Icon name="receipt"/>Ticket promedio</span><strong className="metric-value" data-testid="ticket-average">{data.ticketAverage === null ? '—' : money(data.ticketAverage)}</strong><div className="metric-footer"><span>{data.ticketAverage === null ? 'Sin cobros hoy' : 'Por cobro de hoy'}</span><span>COP</span></div></section>
      </div>
      <div className="dashboard-middle"><section className="panel"><header className="section-heading"><div><h2>Ventas del mes</h2><p className="small">Del {dateLabel(data.context.monthStart)} al {dateLabel(data.context.today)}</p></div><span className="badge">Productos</span></header><SalesChart daily={data.daily}/></section>
        <section className="panel stock-alert-panel"><header className="section-heading"><div><h2>Alertas de inventario</h2><p className="small">En mínimo o por debajo</p></div><span className="badge warning" data-testid="stock-alert-count">{data.inventoryAlerts.length}</span></header>
          {data.inventoryAlerts.length ? <div className="stock-alert-list">{data.inventoryAlerts.slice(0, 5).map(item => <button type="button" className="stock-alert-row" key={`${item.warehouseId}:${item.itemId}`} onClick={() => inventory(item.branchId, item.warehouseId)} aria-label={`Consultar ${item.name} en ${item.branchName}`}><span className={`stock-alert-icon ${Number(item.quantity) <= 0 ? 'is-empty' : ''}`}><Icon name={Number(item.quantity) <= 0 ? 'error' : 'warning'}/></span><span className="stock-alert-copy"><strong>{item.name}</strong><small>{item.branchName} · {item.warehouseName}</small><small>Mín. {quantity(item.minimum)} {units[item.baseUnit] ?? item.baseUnit}</small></span><span className={`badge ${Number(item.quantity) <= 0 ? 'danger' : 'warning'}`}>{quantity(item.quantity)} {units[item.baseUnit] ?? item.baseUnit}</span></button>)}</div> : <p className="empty">No hay existencias en mínimo o por debajo entre los artículos con mínimo configurado.</p>}
          <div className="dashboard-panel-footer"><button className="text-button" onClick={() => inventory()}>Consultar inventario<Icon name="link"/></button>{data.inventoryAlerts.length > 5 && <small>{data.inventoryAlerts.length - 5} alertas adicionales</small>}</div>
        </section></div>
      <section className="panel product-ranking"><header className="section-heading"><div><h2>Los 5 más vendidos</h2><p className="small">Unidades netas del mes · Después de devoluciones</p></div><Icon name="reports"/></header>{data.topProducts.length ? <div className="table-wrap"><table><thead><tr><th>Producto</th><th className="ranking-presentation">Presentación</th><th className="numeric">Unidades</th></tr></thead><tbody>{data.topProducts.map((product, index) => <tr key={product.productId}><td><span className="ranking-product"><span className="ranking-position">{index + 1}</span><span className="product-symbol"><Icon name="package"/></span><strong>{product.name}</strong></span></td><td className="ranking-presentation muted">{product.presentation}</td><td className="numeric">{quantity(product.quantity)}</td></tr>)}</tbody></table></div> : <p className="empty">Aún no hay productos con ventas netas en este mes.</p>}</section>
      <details className="dashboard-context"><summary>Datos confirmados y última sincronización</summary><p>Solo incluye operaciones recibidas por el servidor. Puede haber ventas offline pendientes de otras cajas.</p><ul>{data.context.branchIds.map(id => <li key={id}>{branches.find(b => b.id === id)?.name ?? id}: {data.context.lastSynchronizedAt[id] ? date(data.context.lastSynchronizedAt[id]!) : 'Sin sincronización confirmada'}</li>)}</ul><p>Ventas: productos efectivamente pagados, después de descuentos y puntos, menos devoluciones del período. No incluye propinas ni domicilios. Ticket promedio: productos pagados por cobro de hoy, antes de devoluciones posteriores.</p></details>
      <p className="dashboard-sync-note"><Icon name="refresh"/>Solo operaciones sincronizadas · Actualizado {date(data.context.generatedAt)}</p>
    </>}
  </div>;
}
