import { useEffect, useState } from 'react';
import { api, date } from './api.ts';
import type { Audit as AuditEntry, Me } from './api.ts';
import { Heading, Notice } from './components.tsx';
const actions: Record<string, string> = { 'setup.completed': 'Configuración inicial', 'session.login': 'Inicio de sesión', 'session.logout': 'Cierre de sesión',
  'user.created': 'Usuario creado', 'user.updated': 'Usuario actualizado', 'branch.created': 'Sucursal creada', 'branch.updated': 'Sucursal actualizada',
  'warehouses.created': 'Bodega creada', 'warehouses.updated': 'Bodega actualizada', 'devices.created': 'Equipo creado', 'devices.updated': 'Equipo actualizado' };
export function Audit({ me }: { me: Me }) {
  const [items, setItems] = useState<AuditEntry[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setBusy(true); setError(''); setItems([]); setCursor(null);
    void api<{ items: AuditEntry[]; nextCursor: string | null }>(`/audit?limit=20${filter ? `&branchId=${filter}` : ''}`)
      .then(r => { if (active) { setItems(r.items); setCursor(r.nextCursor); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [filter, revision]);
  return <><Heading eyebrow="TRAZABILIDAD" title="Auditoría" action={<button className="secondary" disabled={busy} onClick={() => setRevision(revision + 1)}>Actualizar</button>}>Quién cambió qué, cuándo y por qué.</Heading>
    {error && <Notice error>{error}</Notice>}<section className="panel"><div className="panel-toolbar"><label>Filtrar por sucursal<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Todos mis locales y accesos</option>{me.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><span className="muted">Hora de Colombia</span></div>
      <div className="audit-list">{items.map(item => <article key={item.id} className="audit-row"><span className="audit-dot" aria-hidden="true" /><div><div className="audit-title"><strong>{actions[item.action] ?? item.action}</strong><time dateTime={item.occurredAt}>{date(item.occurredAt)}</time></div><p>{item.reason}</p><span className="small">{me.branches.find(b => b.id === item.branchId)?.name ?? 'Accesos y usuarios'} · Registro #{item.id}</span>
        <details><summary>Ver detalle del registro</summary><dl className="audit-meta"><dt>Actor</dt><dd>{item.actorId}</dd><dt>Sesión de equipo</dt><dd>{item.deviceId}</dd><dt>Operación</dt><dd>{item.operationId}</dd></dl><pre>{JSON.stringify(item.changes, null, 2)}</pre></details></div></article>)}</div>
      {!items.length && <p className="empty" role="status">{busy ? 'Cargando registros…' : 'No hay registros para este filtro.'}</p>}
      {cursor && <div className="panel-footer"><button className="secondary" disabled={busy} onClick={async () => {
        setBusy(true); try { const r = await api<{ items: AuditEntry[]; nextCursor: string | null }>(`/audit?limit=20&before=${cursor}${filter ? `&branchId=${filter}` : ''}`); setItems([...items, ...r.items]); setCursor(r.nextCursor); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? 'Cargando…' : 'Ver registros anteriores'}</button></div>}</section></>;
}
