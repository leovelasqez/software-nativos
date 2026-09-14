import { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { BranchDetail, Me, Warehouse, Device } from './api.ts';
import { Dialog, SaveForm, Reason, Heading, Notice } from './components.tsx';

type Editor = { kind: 'branch'; isNew: boolean } | { kind: 'warehouse'; value: Warehouse | null } | { kind: 'device'; value: Device | null };
export function Branches({ me, branchId, refresh }: { me: Me; branchId: string; refresh: () => Promise<void> }) {
  const [detail, setDetail] = useState<BranchDetail | null>(null); const [error, setError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null); const [notice, setNotice] = useState('');
  const admin = me.user.role === 'owner' && me.user.actions.includes('settings.manage');
  const load = async () => { setDetail(await api<BranchDetail>(`/branches/${branchId}`)); };
  useEffect(() => { let active = true; setDetail(null); setError('');
    void api<BranchDetail>(`/branches/${branchId}`).then(value => { if (active) setDetail(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [branchId]);
  return <><Heading eyebrow="ORGANIZACIÓN" title="Sucursales y bodegas" action={admin && <button className="primary" onClick={() => setEditor({ kind: 'branch', isNew: true })}>+ Nueva sucursal</button>}>La operación de cada local, organizada en un solo lugar.</Heading>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {detail ? <><section className="branch-hero"><div className="branch-symbol" aria-hidden="true">⌂</div><div><span className="eyebrow">SUCURSAL SELECCIONADA</span><h2>{detail.branch.name}</h2><p>{detail.warehouses.length} bodegas · {detail.devices.filter(d => d.active).length} caja activa</p></div>{admin && <button className="secondary" onClick={() => setEditor({ kind: 'branch', isNew: false })}>Editar sucursal</button>}</section>
      <div className="two-columns"><section className="panel"><header className="section-heading"><h2>Bodegas</h2>{admin && <button className="text-button" onClick={() => setEditor({ kind: 'warehouse', value: null })}>+ Agregar bodega</button>}</header>
        {detail.warehouses.map(w => <article key={w.id} className="resource-row"><div><strong>{w.name}</strong><p className="small">{w.isDefault ? 'Bodega predeterminada para ventas' : 'Bodega de abastecimiento'}</p></div>{admin && <button className="secondary" onClick={() => setEditor({ kind: 'warehouse', value: w })} aria-label={`Editar bodega ${w.name}`}>Editar</button>}</article>)}</section>
      <section className="panel"><header className="section-heading"><h2>Equipos de caja</h2>{admin && <button className="text-button" onClick={() => setEditor({ kind: 'device', value: null })}>+ Agregar equipo</button>}</header>
        {detail.devices.map(d => <article key={d.id} className="resource-row"><div><strong>{d.name}</strong><p className="small">{d.printerModel ?? 'Impresora sin configurar'} · {d.active ? 'Activo' : 'Inactivo'}</p></div>{admin && <button className="secondary" onClick={() => setEditor({ kind: 'device', value: d })} aria-label={`Editar equipo ${d.name}`}>Editar</button>}</article>)}</section></div>
      <p className="footnote">Una caja activa por local. El registro de impresora conserva la configuración; la prueba física de impresión y cajón sigue pendiente.</p></> : !error && <p role="status">Cargando sucursal…</p>}
    {editor && <Dialog title={editor.kind === 'branch' ? editor.isNew ? 'Nueva sucursal' : 'Editar sucursal' : editor.kind === 'warehouse' ? editor.value ? 'Editar bodega' : 'Nueva bodega' : editor.value ? 'Editar equipo' : 'Nuevo equipo'} onClose={() => setEditor(null)}>
      <SaveForm onSave={async form => {
        const body = { name: String(form.get('name')), reason: String(form.get('reason')) };
        if (editor.kind === 'branch') await api(editor.isNew ? '/branches' : `/branches/${branchId}`, editor.isNew ? 'POST' : 'PATCH', body);
        else if (editor.kind === 'warehouse') await api(`/branches/${branchId}/warehouses${editor.value ? `/${editor.value.id}` : ''}`, editor.value ? 'PATCH' : 'POST', { ...body, isDefault: form.get('isDefault') === 'on' });
        else await api(`/branches/${branchId}/devices${editor.value ? `/${editor.value.id}` : ''}`, editor.value ? 'PATCH' : 'POST', { ...body, active: form.get('active') === 'on', printerModel: String(form.get('printerModel')).trim() || null });
        setEditor(null); setNotice('Configuración guardada y registrada en auditoría.'); await refresh(); await load();
      }}><label>Nombre<input name="name" minLength={2} maxLength={100} required autoFocus defaultValue={editor.kind === 'branch' ? editor.isNew ? '' : detail?.branch.name : editor.value?.name} /></label>
        {editor.kind === 'branch' && editor.isNew && <p className="small">Se creará una bodega de venta y una caja para este local. Quedará asignado a tu usuario.</p>}
        {editor.kind === 'warehouse' && <label className="check"><input type="checkbox" name="isDefault" defaultChecked={editor.value?.isDefault} />Usar como bodega predeterminada de venta</label>}
        {editor.kind === 'device' && <><label>Modelo de impresora<input name="printerModel" maxLength={100} defaultValue={editor.value?.printerModel ?? ''} placeholder="Sin configurar" /></label><label className="check"><input type="checkbox" name="active" defaultChecked={editor.value?.active ?? false} />Equipo activo</label><p className="small">Desactiva la caja anterior antes de activar otra en este local.</p></>}<Reason />
      </SaveForm></Dialog>}
  </>;
}
