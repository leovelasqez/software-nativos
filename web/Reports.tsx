import { useEffect, useRef, useState } from 'react';
import { Heading, Notice } from './components.tsx';
import { api, date } from './api.ts';
import { reportColumns, reportLabel, reportValue } from './report-format.ts';

const kinds = [{ id: 'sales', name: 'Ventas' }, { id: 'cash', name: 'Caja' }, { id: 'inventory', name: 'Inventario' }, { id: 'purchases', name: 'Compras' }, { id: 'waste', name: 'Desperdicio y consumo' }, { id: 'loyalty', name: 'Fidelización' }];
type Report = { context: { lastSynchronizedAt: Record<string, string | null> }; items: Record<string, unknown>[]; totals: Record<string, string>; nextCursor: string | null };
type Choice = { id: string; name: string };
const methods = [{ id: 'cash', name: 'Efectivo' }, { id: 'card', name: 'Tarjeta' }, { id: 'transfer', name: 'Transferencia' }, { id: 'breb', name: 'Bre-B' }, { id: 'daviplata', name: 'Daviplata' }, { id: 'nequi', name: 'Nequi' }];

function RecordDetails({ value }: { value: Record<string, unknown> }) {
  return <dl className="report-details">{Object.entries(value).map(([key,item]) => <div key={key}><dt>{reportLabel(key)}</dt><dd>{item !== null && typeof item === 'object'
    ? <details><summary>{Array.isArray(item) ? `${item.length} registros` : 'Ver datos'}</summary>{(Array.isArray(item)?item:[item]).map((entry,index) => typeof entry === 'object' && entry !== null ? <RecordDetails key={index} value={entry as Record<string,unknown>}/> : <p key={index}>{String(entry)}</p>)}</details>
    : reportValue(key,item)}</dd></div>)}</dl>;
}

export function Reports({ branchId }: { branchId: string }) {
  const [kind, setKind] = useState('sales'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [productId, setProductId] = useState(''); const [customerId, setCustomerId] = useState(''); const [supplierId, setSupplierId] = useState(''); const [paymentMethod, setPaymentMethod] = useState('');
  const [products, setProducts] = useState<Choice[]>([]); const [customers, setCustomers] = useState<Choice[]>([]); const [suppliers, setSuppliers] = useState<Choice[]>([]);
  const [report, setReport] = useState<Report | null>(null); const [error, setError] = useState(''); const [loading,setLoading] = useState(false); const generation=useRef(0);
  const query = () => new URLSearchParams({ branchId, limit: '20', ...(from ? { from } : {}), ...(to ? { to } : {}), ...((kind === 'sales' || kind === 'waste') && productId ? { productId } : {}), ...((kind === 'sales' || kind === 'loyalty') && customerId ? { customerId } : {}), ...(kind === 'purchases' && supplierId ? { supplierId } : {}), ...((kind === 'sales' || kind === 'purchases') && paymentMethod ? { paymentMethod } : {}) });
  async function load() {
    const current=++generation.current; setError(''); setReport(null); setLoading(true);
    try { const result=await api<Report>(`/reports/${kind}?${query()}`); if(current===generation.current)setReport(result); }
    catch(e) { if(current===generation.current)setError((e as Error).message); }
    finally { if(current===generation.current)setLoading(false); }
  }
  async function exportXlsx() {
    setError('');
    try { const response = await fetch(`/api/reports/${kind}/export?${query()}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { const body = await response.json() as { message?: string }; throw new Error(body.message ?? 'No se pudo exportar el informe.'); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = `nativos-${kind}.xlsx`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); return()=>{generation.current++;}; }, [branchId, kind]);
  useEffect(() => { let active=true; void Promise.all([api<{ items: Choice[] }>(`/products?branchId=${branchId}&limit=100`), api<{ items: Choice[] }>(`/customers?branchId=${branchId}`)]).then(([product, customer]) => { if(active){setProducts(product.items); setCustomers(customer.items);} }).catch(() => { if(active){setProducts([]); setCustomers([]);} }); return()=>{active=false;}; }, [branchId]);
  useEffect(() => { let active=true; void api<{ items: Choice[] }>(`/suppliers?branchId=${branchId}`).then(result => {if(active)setSuppliers(result.items);}).catch(() => {if(active)setSuppliers([]);}); return()=>{active=false;}; }, [branchId]);
  const columns=(reportColumns[kind]??[]).filter(key=>report?.items.some(item=>item[key]!==undefined));
  return <><Heading eyebrow="CONSULTA ONLINE" title="Informes">Consulta ventas, inventario y movimientos confirmados. Las operaciones offline aparecen después de sincronizarse.</Heading>
    <section className="panel report-filters"><div className="fields">
      <label>Informe<select value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      {(kind === 'sales' || kind === 'waste') && <label>Producto<select value={productId} onChange={e => setProductId(e.target.value)}><option value="">Todos</option>{products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
      {(kind === 'sales' || kind === 'loyalty') && <label>Cliente<select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Todos</option>{customers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
      {kind === 'purchases' && <label>Proveedor<select value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Todos</option>{suppliers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
      {(kind === 'sales' || kind === 'purchases') && <label>Medio<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="">Todos</option>{methods.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
      <div className="row-actions"><button className="secondary" disabled={loading} onClick={() => void load()}>Aplicar filtros</button><button className="primary" onClick={() => void exportXlsx()}>Exportar Excel</button></div>
    </div></section>
    {error && <Notice error>{error}</Notice>}{loading && <p className="empty" role="status">Consultando informe…</p>}
    {report && <section className="panel report-results"><header className="section-heading"><div><h2>{kinds.find(k=>k.id===kind)?.name}</h2><p className="small">Última sincronización: {Object.values(report.context.lastSynchronizedAt).some(Boolean) ? Object.values(report.context.lastSynchronizedAt).filter((value):value is string=>Boolean(value)).map(date).join(' · ') : 'Sin confirmar'}</p></div><span className="badge">{report.items.length} registros</span></header>
      {Object.values(report.totals).some(value=>value!=='0') && <div className="summary-grid">{Object.entries(report.totals).filter(([,value])=>value!=='0').map(([label,value])=><section className="stat-card" key={label}><span className="eyebrow">{reportLabel(label)}</span><strong>{reportValue(label,value)}</strong></section>)}</div>}
      {report.items.length ? <div className="table-wrap"><table><thead><tr>{columns.map(key=><th key={key}>{reportLabel(key)}</th>)}<th>Detalle</th></tr></thead><tbody>{report.items.map(item=><tr key={String(item.id)}>{columns.map(key=><td key={key}>{reportValue(key,item[key])}</td>)}<td><details className="report-record"><summary>Ver detalle</summary><RecordDetails value={item}/></details></td></tr>)}</tbody></table></div> : <p className="empty">No hay registros para estos filtros.</p>}
      {report.nextCursor && <Notice>La pantalla muestra una página; Excel incluye todas las filas autorizadas.</Notice>}
    </section>}</>;
}
