import { useEffect, useRef, useState } from 'react';
import './sellers.css';
import { api } from './api.ts';
import type { Me } from './api.ts';
import type { Seller } from '../src/sellers.ts';
import { Dialog, SaveForm, Reason, Heading, Notice } from './components.tsx';

export function Sellers({ me }: { me: Me }) {
  const [items, setItems] = useState<Seller[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Seller | 'new' | null>(null);
  const load = async () => setItems((await api<{ items: Seller[] }>('/sellers?branchId=all')).items);
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  return <><Heading eyebrow="EQUIPO DE VENTAS" title="Vendedores" action={<button className="primary" onClick={() => setEditing('new')}>+ Nuevo vendedor</button>}>
    Identifica quién realiza cada venta usando la misma cuenta de caja.
  </Heading>{error && <Notice error>{error}</Notice>}
    <section className="panel"><div className="seller-list">{items.map(seller => <article className="seller-row" key={seller.id}>
      <span className="avatar">{seller.name.slice(0, 1).toUpperCase()}</span>
      <div className="user-info"><strong>{seller.name}</strong><span>{me.branches.filter(b => seller.branchIds.includes(b.id)).map(b => b.name).join(' · ')}</span></div>
      <span className={`status ${seller.active ? '' : 'inactive'}`}>{seller.active ? 'Activo' : 'Inactivo'}</span>
      <button className="secondary" aria-label={`Editar vendedor ${seller.name}`} onClick={() => setEditing(seller)}>Editar</button>
    </article>)}{!items.length && <p className="empty">Aún no hay vendedores registrados. Agrega las personas que realizan ventas en tus locales.</p>}</div></section>
    <CommissionSettings />
    {editing && <SellerForm key={editing === 'new' ? 'new' : editing.id} me={me} seller={editing === 'new' ? null : editing}
      close={() => setEditing(null)} saved={async () => { setEditing(null); await load(); }} />}
  </>;
}

type CommissionSetting = { id: string; name: string; presentation: string; version: number; amount: string | null };
function CommissionSettings() {
  const [items, setItems] = useState<CommissionSetting[]>([]);
  const [editing, setEditing] = useState<CommissionSetting | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const load = async () => setItems((await api<{ items: CommissionSetting[] }>('/seller-commissions')).items);
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  return <section className="panel"><div className="panel-toolbar"><div><h2>Comisiones por producto</h2>
    <p className="small">Valor en COP por unidad, reducido según el descuento. Los cambios aplican a próximos cobros después de sincronizar Caja.</p></div>
    <label>Buscar producto<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {error && <Notice error>{error}</Notice>}
    <div className="commission-list">{items.filter(item => `${item.name} ${item.presentation}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(item => <article className="commission-row" key={item.id}>
      <div className="user-info"><strong>{item.name}</strong><span>{item.presentation}</span></div>
      <span>{item.amount === null ? 'Sin configurar' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 6 }).format(Number(item.amount))}</span>
      <button className="secondary" aria-label={`Configurar comisión de ${item.name}`} onClick={() => setEditing(item)}>Configurar comisión</button>
    </article>)}{!items.length && <p className="empty">Crea productos para configurar sus comisiones.</p>}</div>
    {editing && <CommissionForm key={editing.id} item={editing} close={() => setEditing(null)} saved={async () => { setEditing(null); await load(); }} />}
  </section>;
}

function CommissionForm({ item, close, saved }: { item: CommissionSetting; close: () => void; saved: () => Promise<void> }) {
  const operation = useRef({ fingerprint: '', id: '' });
  return <Dialog title="Comisión del producto" onClose={close}><SaveForm label="Guardar comisión" onSave={async data => {
    const amount = String(data.get('amount')).trim();
    const body = { expectedVersion: item.version, amount: amount || null, reason: String(data.get('reason')) };
    const fingerprint = JSON.stringify(body);
    if (operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, id: crypto.randomUUID() };
    await api(`/seller-commissions/${item.id}`, 'POST', { ...body, operationId: operation.current.id }); await saved();
  }}><p>{item.name} · {item.presentation}</p><label>Comisión por unidad (COP)<input name="amount" defaultValue={item.amount ?? ''} inputMode="decimal" pattern="(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?" autoFocus />
    <small>Déjalo vacío si está pendiente. Usa 0 para indicar que este producto no genera comisión.</small></label>
    <Notice>Una comisión de $1.000 con descuento del 10% genera $900. Las devoluciones revierten la comisión correspondiente. Las ventas ya cobradas conservan su valor original.</Notice>
    <Reason /></SaveForm></Dialog>;
}

function SellerForm({ me, seller, close, saved }: { me: Me; seller: Seller | null; close: () => void; saved: () => Promise<void> }) {
  const operation = useRef({ fingerprint: '', id: '' });
  return <Dialog title={seller ? 'Editar vendedor' : 'Nuevo vendedor'} onClose={close}>
    <SaveForm label={seller ? 'Guardar vendedor' : 'Crear vendedor'} onSave={async data => {
      const branchIds = data.getAll('branchIds') as string[];
      if (!branchIds.length) throw new Error('Selecciona al menos una sucursal.');
      const body = { name: String(data.get('name')), branchIds, active: data.get('active') === 'on',
        reason: String(data.get('reason')), ...(seller ? { expectedVersion: seller.version } : {}) };
      const fingerprint = JSON.stringify(body);
      if (operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, id: crypto.randomUUID() };
      await api(`/sellers${seller ? `/${seller.id}` : ''}`, seller ? 'PATCH' : 'POST', { ...body, operationId: operation.current.id });
      await saved();
    }}><label>Nombre del vendedor<input name="name" defaultValue={seller?.name} required minLength={2} maxLength={100} autoFocus /></label>
      <fieldset className="choice-group"><legend>Sucursales donde vende</legend>{me.branches.map(b => <label className="check" key={b.id}>
        <input type="checkbox" name="branchIds" value={b.id} defaultChecked={seller?.branchIds.includes(b.id)} />{b.name}</label>)}</fieldset>
      <label className="check"><input type="checkbox" name="active" defaultChecked={seller?.active ?? true} />Vendedor activo</label>
      <Reason />
    </SaveForm>
  </Dialog>;
}
