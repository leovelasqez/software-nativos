import { useEffect, useState } from 'react';
import { api, roles } from './api.ts';
import type { Me, User } from './api.ts';
import { Dialog, SaveForm, Reason, Heading, Notice } from './components.tsx';
import { defaultActions } from '../src/permissions.ts';
import type { Action, Role } from '../src/contracts.ts';

const labels: Record<Action, string> = {
  'data.read': 'Consultar datos', 'order.write': 'Gestionar pedidos', 'sale.discount': 'Aplicar descuentos',
  'sale.cancel': 'Cancelar antes del cobro', 'sale.charge': 'Cobrar', 'shift.open': 'Abrir turno', 'shift.close': 'Cerrar turno', 'cash.movement': 'Registrar movimientos de caja',
  'product.create': 'Crear productos', 'recipe.create': 'Crear recetas', 'customer.create': 'Crear clientes',
  'loyalty.enroll': 'Inscribir a fidelización', 'loyalty.redeem': 'Canjear puntos', 'purchase.read': 'Consultar compras',
  'purchase.write': 'Registrar compras', 'inventory.manage': 'Administrar inventario', 'sale.refund': 'Autorizar devoluciones',
  'cost.read': 'Consultar costos y márgenes', 'cost.write': 'Editar costos', 'loyalty.adjust': 'Ajustar puntos y reglas', 'settings.manage': 'Administrar configuración',
};
export function Users({ me, onSessionRefresh }: { me: Me; onSessionRefresh: () => Promise<void> }) {
  const [users, setUsers] = useState<User[]>([]); const [error, setError] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null); const [search, setSearch] = useState(''); const [notice, setNotice] = useState('');
  const load = async () => { const result = await api<{ items: User[] }>('/users'); setUsers(result.items); };
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  const filtered = users.filter(u => `${u.name} ${u.login}`.toLowerCase().includes(search.toLowerCase()));
  return <><Heading eyebrow="ACCESOS" title="Usuarios y roles" action={<button className="primary" onClick={() => setEditing('new')}>+ Nuevo usuario</button>}>Cada persona, con los permisos y locales que necesita.</Heading>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <section className="panel"><div className="panel-toolbar"><label className="search">Buscar usuario<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o usuario" /></label><span className="muted">{filtered.length} usuarios</span></div>
      <div className="user-list">{filtered.map(user => <article className="user-row" key={user.id}>
        <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div className="user-info"><strong>{user.name}{user.id === me.user.id && <small className="self-tag">Tú</small>}</strong><span>{user.login}</span></div>
        <div><span className="badge">{roles[user.role]}</span><p className="small">{me.branches.filter(b => user.branchIds.includes(b.id)).map(b => b.name).join(' · ')}</p></div>
        <span className={`status ${user.active ? '' : 'inactive'}`}>{user.active ? 'Activo' : 'Inactivo'}</span>
        <button className="secondary" aria-label={`Editar ${user.name}`} onClick={() => setEditing(user)}>Editar</button>
      </article>)}{filtered.length === 0 && <p className="empty">No hay usuarios que coincidan con esta búsqueda.</p>}</div>
    </section><p className="footnote">Los cambios de acceso cierran las sesiones del usuario afectado. Los costos y ajustes de puntos son exclusivos del dueño.</p>
    {editing && <UserForm key={editing === 'new' ? 'new' : editing.id} me={me} user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => {
      setEditing(null); setNotice('Usuario guardado. Sus permisos ya están actualizados.'); await onSessionRefresh(); await load();
    }} />}</>;
}
function UserForm({ me, user, onClose, onSaved }: { me: Me; user: User | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [role, setRole] = useState<Role>(user?.role ?? 'cashier');
  const [actions, setActions] = useState<Action[]>(user?.actions ?? defaultActions('cashier'));
  return <Dialog title={user ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
    <SaveForm label={user ? 'Guardar cambios' : 'Crear usuario'} onSave={async data => {
      const branchIds = data.getAll('branchIds') as string[];
      if (!branchIds.length) throw new Error('Selecciona al menos una sucursal.');
      const body = { name: String(data.get('name')), login: String(data.get('login')), role, branchIds, actions,
        reason: String(data.get('reason')), ...(user ? { active: data.get('active') === 'on' } : {}),
        ...(data.get('password') ? { password: String(data.get('password')) } : {}) };
      await api(`/users${user ? `/${user.id}` : ''}`, user ? 'PATCH' : 'POST', body); await onSaved();
    }}><div className="fields"><label>Nombre completo<input name="name" defaultValue={user?.name} minLength={2} maxLength={100} required autoFocus /></label>
      <label>Usuario de acceso<input name="login" defaultValue={user?.login} minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" required autoComplete="off" /></label>
      <label>{user ? 'Nueva contraseña (opcional)' : 'Contraseña'}<input type="password" name="password" aria-label={user ? 'Nueva contraseña (opcional)' : 'Contraseña'} aria-describedby="user-password-help" minLength={12} maxLength={128} required={!user} autoComplete="new-password" /><small id="user-password-help">Mínimo 12 caracteres.</small></label>
      <label>Rol<select value={role} onChange={e => { const value = e.target.value as Role; setRole(value); setActions(defaultActions(value)); }}>{Object.entries(roles).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label></div>
      <fieldset className="choice-group"><legend>Sucursales autorizadas</legend>{me.branches.map(b => <label className="check" key={b.id}><input type="checkbox" name="branchIds" value={b.id} defaultChecked={user?.branchIds.includes(b.id)} />{b.name}</label>)}</fieldset>
      {user && <label className="check"><input type="checkbox" name="active" defaultChecked={user.active} />Usuario activo</label>}
      <details className="permissions"><summary>Configurar permisos del perfil</summary><div className="checks">{defaultActions('owner').map(action => {
        const exclusive = role !== 'owner' && (action.startsWith('cost.') || action === 'loyalty.adjust');
        return <label className="check" key={action}><input type="checkbox" checked={actions.includes(action)} disabled={exclusive} onChange={e => setActions(e.target.checked ? [...actions, action] : actions.filter(a => a !== action))} />{labels[action]}</label>;
      })}</div><p className="small">Administrar usuarios y sucursales requiere rol Dueño y permiso de configuración. Las funciones comerciales se habilitarán al completar sus módulos.</p></details><Reason />
    </SaveForm></Dialog>;
}
