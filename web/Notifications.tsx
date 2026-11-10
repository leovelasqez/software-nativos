import { useEffect, useRef, useState } from 'react';
import { api, date } from './api.ts';
import { Heading, Notice } from './components.tsx';
import { branchStatus, money, paymentLabels, templateSummary } from '../src/notification-report.ts';
import type { NotificationReport } from '../src/notification-report.ts';
import { isNotificationState, notificationLabels as labels } from '../src/notification-state.ts';
import type { NotificationState } from '../src/notification-state.ts';

type Intent={id:string;type:string;recipientRole:string;state:NotificationState;mode:string;data:NotificationReport;createdAt:string;reportPath:string};
type Detail=Intent&{text:string;events:{status:string;safeCode:string|null;receivedAt:string}[]};
type Config={enabled:boolean;ready:boolean;recipient:string|null;schedulerError:boolean;lastEvaluationAt:string|null};
const modeLabel=(mode:string)=>mode==='preview'?'Prueba · sin envío':mode==='live'?'Real':'Histórico · sin envío';
const initialId=()=>{const value=new URLSearchParams(location.search).get('notification');return value&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)?value:'';};
export function Notifications({branchId}:{branchId:string}) {
  const [items,setItems]=useState<Intent[]>([]);const [cursor,setCursor]=useState<string|null>(null);
  const [config,setConfig]=useState<Config|null>(null);const [detail,setDetail]=useState<Detail|null>(null);const [selected,setSelected]=useState(initialId);
  const [revision,setRevision]=useState(0);
  const [state,setState]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const generation=useRef(0);
  async function load(after?:string) {
    const current=++generation.current;setBusy(true);setError('');
    try {
      const result=await api<{items:Intent[];nextCursor:string|null}>(`/notifications?branchId=${encodeURIComponent(branchId)}&limit=20${state?`&state=${state}`:''}${after?`&after=${encodeURIComponent(after)}`:''}`);
      if(current===generation.current){setItems(old=>after?[...old,...result.items]:result.items);setCursor(result.nextCursor);}
    }catch(e){if(current===generation.current)setError((e as Error).message);}finally{if(current===generation.current)setBusy(false);}
  }
  useEffect(()=>{setItems([]);setCursor(null);void load();return()=>{generation.current++;};},[branchId,state]);
  useEffect(()=>{let active=true;void api<Config>('/notifications/config').then(value=>{if(active)setConfig(value);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[revision]);
  useEffect(()=>{let active=true;setDetail(null);if(selected)void api<Detail>(`/notifications/${encodeURIComponent(selected)}`).then(value=>{if(active)setDetail(value);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[selected,revision]);
  function select(intentId:string){setError('');setSelected(intentId);history.replaceState(null,'',`/?notification=${encodeURIComponent(intentId)}`);}
  async function simulate(outcome:'delivered'|'uncertain') {
    if(!detail)return;setBusy(true);setError('');
    try{await api(`/notifications/${detail.id}/simulate`,'POST',{operationId:crypto.randomUUID(),reason:'Verificación del dueño sin envío externo',outcome});setNotice(`Prueba completada: ${outcome==='delivered'?'entrega simulada':'incertidumbre simulada'}. No se envió ningún mensaje ni se cambió el estado de entrega.`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function exportReport() {
    if(!detail)return;setBusy(true);setError('');
    try{const response=await fetch(`/api/notifications/${detail.id}/export`,{cache:'no-store',credentials:'same-origin'});if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));throw new Error('No se pudo descargar el reporte. Revisa tu acceso.');}const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`nativos-whatsapp-${detail.data.date}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <><Heading eyebrow="REPORTES PARA EL DUEÑO" title="WhatsApp" action={<button className="secondary" disabled={busy} onClick={()=>{void load();setRevision(r=>r+1);}}>Actualizar</button>}>Cierres y ventas consolidadas de Centro y Milán. Los avisos van del WhatsApp del negocio a tu celular personal.</Heading>
    {error&&<Notice error>{error}</Notice>}{notice&&<Notice>{notice}</Notice>}
    <section className="panel"><h2>Conexión y horarios</h2><p><strong>{config?.enabled?'Envío habilitado':'Envío desactivado'}</strong>{config?.recipient?` · Dueño ${config.recipient}`:' · Destinatario personal pendiente de configurar'}</p><p>Cada cierre confirmado y sincronizado prepara un resumen del turno y el consolidado del día. Los mínimos de ambos locales se agrupan a las 8:00 a. m., hora de Colombia.</p>
      {!config?.enabled&&<Notice>Ya puedes consultar y probar los reportes aquí. Para recibirlos en tu celular falta completar la conexión con Meta, el emisor, el destinatario y las plantillas. Los reportes de prueba nunca se enviarán al activar la conexión.</Notice>}
      {config?.schedulerError&&<Notice error>No se pudo completar la última evaluación automática. Se volverá a intentar; tus ventas y cierres se conservan.</Notice>}
      <p className="small">Sólo se incluyen operaciones sincronizadas. Puede haber información pendiente en los navegadores de Caja.</p>
      <button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await api<{lowStockRows:number}>('/notifications/low-stock/run','POST',{operationId:crypto.randomUUID(),branchId,reason:'Consulta del dueño de mínimos consolidados'});setNotice(`${r.lowStockRows} artículos/bodegas bajo mínimo. Se conserva una muestra manual por día; el corte automático es independiente.`);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Evaluar mínimos ahora</button>
    </section>
    <section className="panel"><div className="panel-toolbar"><label>Estado<select value={state} onChange={e=>setState(e.target.value)}><option value="">Todos</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><span className="muted">Destinatario único: dueño</span></div>
      <div className="table-wrap admin-table-region" role="region" aria-label="Reportes de WhatsApp" tabIndex={0}><table className="admin-data-table"><thead><tr><th>Preparado</th><th>Reporte</th><th>Modo</th><th>Estado</th><th>Consulta</th></tr></thead><tbody>{items.map(intent=><tr key={intent.id}><td>{date(intent.createdAt)}</td><td>{intent.type==='shift_closed'?'Cierre y consolidado':'Resumen de mínimos'}</td><td>{modeLabel(intent.mode)}</td><td>{labels[intent.state]??intent.state}</td><td><button className="secondary" onClick={()=>select(intent.id)}>Ver reporte</button></td></tr>)}</tbody></table></div>
      {!items.length&&<p className="empty" role="status">{busy?'Cargando reportes…':'No hay reportes para este filtro. Se preparan al sincronizar un cierre o evaluar mínimos.'}</p>}{cursor&&<button className="secondary" disabled={busy} onClick={()=>void load(cursor)}>Cargar más reportes</button>}
    </section>
    {detail&&<section className="panel whatsapp-report" aria-label="Detalle del reporte"><header className="section-heading"><div><h2>Reporte del {detail.data.date??date(detail.createdAt)}</h2><p>{modeLabel(detail.mode)} · {labels[detail.state]??detail.state}</p></div>{detail.data.version===2&&<button className="secondary" disabled={busy} onClick={()=>void exportReport()}>Descargar Excel del reporte</button>}</header>
      {detail.data.version===2&&<><h3>Vista previa de WhatsApp</h3><p className="whatsapp-message">{templateSummary(detail.data)}</p><p className="small">El mensaje incluye un enlace a este informe que requiere iniciar sesión como dueño.</p>
        {detail.data.partial&&<Notice>Consolidado parcial: hay un turno abierto o una sucursal sin cierre sincronizado de la fecha.</Notice>}
        {detail.data.branches.length>0&&<div className="summary-grid">{detail.data.branches.map(b=><section className="stat-card" key={b.branchId}><span>{b.name} · {branchStatus[b.status]}</span><strong>{money(b.products)}</strong><small>Ventas netas de productos · Recaudo {money(b.sales)} · {b.saleCount} ventas · Última sincronización: {b.lastSynchronizedAt?date(b.lastSynchronizedAt):'Sin confirmar'}</small></section>)}</div>}
        <h3>Informe completo</h3><p className="whatsapp-full-report">{detail.text}</p>
        {detail.data.close&&<><h3>Medios del turno</h3><div className="table-wrap" role="region" aria-label="Medios del turno" tabIndex={0}><table><thead><tr><th>Medio</th><th>Ventas</th><th>Devoluciones</th><th>Ingresos</th><th>Gastos</th><th>Retiros</th><th>Correcciones</th><th>Neto</th></tr></thead><tbody>{detail.data.close.payments.map(p=><tr key={p.method}><td>{paymentLabels[p.method]}</td>{[p.sales,p.refunds,p.income,p.expense,p.withdrawal,p.correction,p.net].map((v,i)=><td key={i}>{money(v)}</td>)}</tr>)}</tbody></table></div><details><summary>Movimientos del turno ({detail.data.close.movements.length})</summary>{detail.data.close.movements.map(m=><p key={m.id}>{date(new Date(m.occurredAtMs).toISOString())} · {m.reference} · {m.reason||m.kind} · {money(m.amount)}</p>)}</details></>}
        <div className="row-actions"><button className="secondary" disabled={busy} onClick={()=>void simulate('delivered')}>Probar entrega sin enviar</button><button className="secondary" disabled={busy} onClick={()=>void simulate('uncertain')}>Probar incertidumbre sin enviar</button></div></>}
      {detail.data.version!==2&&<p>{detail.text}</p>}
      {detail.events.length>0&&<details><summary>Seguimiento de entrega</summary>{detail.events.map((e,i)=><p key={i}>{date(e.receivedAt)} · {isNotificationState(e.status)?labels[e.status]:e.status}{e.safeCode?` · ${e.safeCode}`:''}</p>)}</details>}
    </section>}
  </>;
}
