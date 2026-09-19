import './offline/register.ts';
import './theme.css';
import { Loyalty } from './Loyalty.tsx';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, roles } from './api.ts';
import type { Me } from './api.ts';
import { Logo, ThemeToggle, SaveForm, Notice } from './components.tsx';
import { Dashboard } from './Dashboard.tsx';
import { Icon } from './Icon.tsx';
import type { IconName } from './Icon.tsx';
import { Users } from './Users.tsx';
import { Branches } from './Branches.tsx';
import { Audit } from './Audit.tsx';
import { Customers } from './Customers.tsx';
import { Catalog, Recipes, Inventory } from './Catalog.tsx';
import { Purchases } from './Purchases.tsx';
import { Counts, Transfers } from './InventoryOperations.tsx';
import { Reports } from './Reports.tsx';
import { Backups } from './Backups.tsx';
import { Notifications } from './Notifications.tsx';

type Page = 'summary' | 'users' | 'branches' | 'audit' | 'products' | 'recipes' | 'inventory' | 'transfers' | 'counts' | 'purchases' | 'customers' | 'loyalty' | 'reports' | 'backups' | 'notifications';
const pages: { id: Page; name: string; icon: string; admin?: boolean }[] = [
  { id: 'summary', name: 'Resumen', icon: '◫' }, { id: 'branches', name: 'Sucursales y bodegas', icon: '⌂' },
  { id: 'products', name: 'Productos', icon: '◇' }, { id: 'recipes', name: 'Recetas', icon: '≋' }, { id: 'inventory', name: 'Inventario', icon: '▤' },
  { id: 'purchases', name: 'Compras y proveedores', icon: '▧' },
  { id: 'transfers', name: 'Traslados', icon: '⇄' }, { id: 'counts', name: 'Conteos y ajustes', icon: '±' },
  {id:'customers',name:'Clientes',icon:'♧'}, {id:'loyalty',name:'Fidelización',icon:'☆'},
  {id:'reports',name:'Informes',icon:'▥'},
  { id: 'users', name: 'Usuarios y roles', icon: '♧', admin: true }, { id: 'audit', name: 'Auditoría', icon: '≡', admin: true }, { id: 'notifications', name: 'Notificaciones', icon: '◌', admin: true }, { id: 'backups', name: 'Respaldo y recuperación', icon: '▣', admin: true },
];
const pending = ['WhatsApp', 'Agentes de IA'];
const pageIcons: Record<Page, IconName> = { summary: 'dashboard', branches: 'branches', products: 'package', recipes: 'recipes', inventory: 'boxes', purchases: 'purchases', transfers: 'transfers', counts: 'counts', customers: 'users', loyalty: 'loyalty', reports: 'reports', users: 'users', audit: 'audit', notifications: 'notifications', backups: 'backup' };
function App() {
  const [me, setMe] = useState<Me | null>(null); const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [page, setPage] = useState<Page>('summary'); const [branchId, setBranchId] = useState(''); const [menuOpen, setMenuOpen] = useState(false);
  const [overviewBranch, setOverviewBranch] = useState('all'); const [inventoryWarehouse, setInventoryWarehouse] = useState('');
  function navigate(next: Page, targetBranch?: string, warehouse = '') { setInventoryWarehouse(next === 'inventory' ? warehouse : ''); if (targetBranch) { setBranchId(targetBranch); setOverviewBranch(targetBranch); } setPage(next); setMenuOpen(false); }
  async function refresh() {
    const value = await api<Me>('/me'); setMe(value); setBranchId(old => value.branches.some(b => b.id === old) ? old : value.branches[0]?.id ?? '');
  }
  async function init() {
    setError('');
    try {
      const status = await api<{ setupRequired: boolean }>('/status'); setSetup(status.setupRequired);
      if (!status.setupRequired) {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (response.ok) { const value: Me = await response.json(); setMe(value); setBranchId(value.branches[0]?.id ?? ''); }
        else if (response.status !== 401) throw new Error('No se pudo consultar el servidor.');
      }
    } catch (e) { setError((e as Error).message); } finally { setReady(true); }
  }
  useEffect(() => { void init(); const expire = () => { setMe(null); setPage('summary'); };
    window.addEventListener('session-expired', expire); return () => window.removeEventListener('session-expired', expire);
  }, []);
  if (!ready) return <div className="loading"><Logo /><p role="status">Preparando tu espacio…</p></div>;
  if (!me) return <div className="auth-shell"><div className="auth-story"><Logo /><div className="story-copy"><span className="eyebrow">NATIVOS · VIDA Y BIENESTAR</span><h1>Todo tu negocio.<br /><span>Un mismo lugar.</span></h1><p>Una vista clara de tus ventas, tu inventario y cada uno de tus locales.</p><div className="story-locations"><span>Milán</span><span>Centro</span></div></div><span className="story-footer">Nativos · Vida y bienestar</span></div>
    <main className="auth-main"><div className="auth-theme"><ThemeToggle /></div><div className="auth-card"><span className="eyebrow">{setup ? 'PRIMER ACCESO' : 'BIENVENIDO DE NUEVO'}</span><h2>{setup ? 'Configura tu acceso' : 'Inicia sesión'}</h2><p>{setup ? 'Crea el usuario del dueño para comenzar a administrar Nativos.' : 'Ingresa con el usuario asignado a tu equipo.'}</p>
      {error ? <><Notice error>{error}</Notice><button className="secondary" onClick={() => void init()}>Volver a conectar</button></> : <SaveForm label={setup ? 'Crear mi acceso' : 'Entrar a Nativos'} onSave={async data => {
        await api(setup ? '/setup' : '/login', 'POST', { ...(setup ? { name: String(data.get('name')) } : {}), login: String(data.get('login')), password: String(data.get('password')) });
        setSetup(false); await refresh(); setPage('summary');
      }}>{setup && <label>Nombre completo<input name="name" minLength={2} maxLength={100} required autoComplete="name" /></label>}
        <label>Usuario<input name="login" minLength={3} maxLength={64} required pattern="[a-zA-Z0-9_.\-]+" autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
        <label>Contraseña<input name="password" type="password" aria-label="Contraseña" aria-describedby={setup ? 'password-help' : undefined} minLength={setup ? 12 : 1} maxLength={128} required autoComplete={setup ? 'new-password' : 'current-password'} />{setup && <small id="password-help">Usa al menos 12 caracteres. Tú eliges tus credenciales.</small>}</label>
      </SaveForm>}<p className="auth-footnote"><a href="/caja">Abrir Caja, incluso sin conexión</a></p></div></main></div>;
  const admin = me.user.role === 'owner' && me.user.actions.includes('settings.manage');
  const allowAll = (page === 'summary') && me.branches.length > 1;
  const activeBranch = allowAll && (overviewBranch === 'all' || me.branches.some(b => b.id === overviewBranch)) ? overviewBranch : branchId;
  return <div className="app-shell"><a className="skip-link" href="#main">Ir al contenido</a><aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}><div className="sidebar-brand"><Logo /><button className="mobile-menu" aria-label="Mostrar navegación" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'}/></button></div>
    <nav aria-label="Navegación principal"><span className="nav-label">TU ESPACIO</span><button aria-current={page === 'summary' ? 'page' : undefined} onClick={() => navigate('summary')}><Icon name="dashboard"/>Resumen</button><a className="nav-link" href="/caja"><Icon name="store"/>Caja y ventas</a>{pages.filter(p => p.id !== 'summary' && (!p.admin || admin)).map(p => <button key={p.id} aria-current={page === p.id ? 'page' : undefined} onClick={() => navigate(p.id)}><Icon name={pageIcons[p.id]}/>{p.name}</button>)}
      <details className="upcoming"><summary>Módulos en preparación</summary>{pending.map(name => <span key={name}>{name}<small>Pendiente</small></span>)}</details></nav>
    <div className="sidebar-account"><span className="avatar">{me.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{me.user.name}</strong><small>{roles[me.user.role]}</small></div><button className="icon-button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={async () => { try { await api('/logout', 'POST', {}); setMe(null); setPage('summary'); } catch (e) { setError((e as Error).message); } }}><Icon name="logout"/></button></div></aside>
    <div className="workspace"><header className="topbar"><span className="page-breadcrumb"><Icon name={pageIcons[page]}/>{pages.find(p => p.id === page)?.name}</span><div className="topbar-actions"><label>Sucursal<select aria-label="Sucursal" value={activeBranch} onChange={e => { setOverviewBranch(e.target.value); if (e.target.value !== 'all') setBranchId(e.target.value); }}>{allowAll && <option value="all">Todas las sucursales</option>}{me.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><ThemeToggle /></div></header>
      <div className="mobile-consultations" role="group" aria-label="Consultas rápidas"><button aria-pressed={page === 'summary'} onClick={() => navigate('summary')}><Icon name="reports"/>Ventas</button><button aria-pressed={page === 'inventory'} onClick={() => navigate('inventory')}><Icon name="boxes"/>Inventario</button></div>
      <main id="main" tabIndex={-1} className="content">{error && <Notice error>{error}</Notice>}
        {page === 'summary' && <Dashboard key={activeBranch} branchId={activeBranch} branches={me.branches} firstName={me.user.name.split(' ')[0]!} inventory={(id, warehouse) => navigate('inventory', id, warehouse)} />}
        {page === 'loyalty' && <Loyalty key={branchId} branchId={branchId} me={me} />}
        {page === 'customers' && <Customers key={branchId} branchId={branchId} />}
        {page === 'products' && <Catalog key={branchId} me={me} branchId={branchId} />}
        {page === 'recipes' && <Recipes key={branchId} me={me} branchId={branchId} />}
        {page === 'inventory' && <Inventory key={`${branchId}:${inventoryWarehouse}`} me={me} branchId={branchId} initialWarehouse={inventoryWarehouse} />}
        {page === 'purchases' && <Purchases key={branchId} me={me} branchId={branchId} />}
        {page === 'transfers' && <Transfers key={branchId} me={me} branchId={branchId} />}
        {page === 'counts' && <Counts key={branchId} me={me} branchId={branchId} />}
        {page === 'reports' && <Reports key={activeBranch} branchId={activeBranch} />}
        {page === 'backups' && admin && <Backups />}
        {page === 'notifications' && admin && <Notifications key={branchId} branchId={branchId} />}
        {page === 'users' && admin && <Users me={me} onSessionRefresh={refresh} />}
        {page === 'branches' && branchId && <Branches me={me} branchId={branchId} refresh={refresh} />}
        {page === 'audit' && admin && <Audit me={me} />}
      </main><footer className="workspace-footer">Nativos · Vida y bienestar<span>Administración y Caja · Sitio web</span></footer></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
