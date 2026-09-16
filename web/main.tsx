import './offline/register.ts';
import { Loyalty } from './Loyalty.tsx';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, roles } from './api.ts';
import type { Me } from './api.ts';
import { Logo, ThemeToggle, SaveForm, Notice, Heading } from './components.tsx';
import { Users } from './Users.tsx';
import { Branches } from './Branches.tsx';
import { Audit } from './Audit.tsx';
import './styles.css';
import { Customers } from './Customers.tsx';
import { Catalog, Recipes, Inventory } from './Catalog.tsx';
import { Purchases } from './Purchases.tsx';
import { Counts, Transfers } from './InventoryOperations.tsx';
import { Reports } from './Reports.tsx';
import { Backups } from './Backups.tsx';

type Page = 'summary' | 'users' | 'branches' | 'audit' | 'products' | 'recipes' | 'inventory' | 'transfers' | 'counts' | 'purchases' | 'customers' | 'loyalty' | 'reports' | 'backups';
const pages: { id: Page; name: string; icon: string; admin?: boolean }[] = [
  { id: 'summary', name: 'Resumen', icon: '◫' }, { id: 'branches', name: 'Sucursales y bodegas', icon: '⌂' },
  { id: 'products', name: 'Productos', icon: '◇' }, { id: 'recipes', name: 'Recetas', icon: '≋' }, { id: 'inventory', name: 'Inventario', icon: '▤' },
  { id: 'purchases', name: 'Compras y proveedores', icon: '▧' },
  { id: 'transfers', name: 'Traslados', icon: '⇄' }, { id: 'counts', name: 'Conteos y ajustes', icon: '±' },
  {id:'customers',name:'Clientes',icon:'♧'}, {id:'loyalty',name:'Fidelización',icon:'☆'},
  {id:'reports',name:'Informes',icon:'▥'},
  { id: 'users', name: 'Usuarios y roles', icon: '♧', admin: true }, { id: 'audit', name: 'Auditoría', icon: '≡', admin: true }, { id: 'backups', name: 'Respaldo y recuperación', icon: '▣', admin: true },
];
const pending = ['WhatsApp', 'Agentes de IA'];
function App() {
  const [me, setMe] = useState<Me | null>(null); const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [page, setPage] = useState<Page>('summary'); const [branchId, setBranchId] = useState(''); const [menuOpen, setMenuOpen] = useState(false);
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
  if (!me) return <div className="auth-shell"><div className="auth-story"><Logo /><div className="story-copy"><span className="eyebrow">NATIVOS · TU NEGOCIO</span><h1>Todo empieza<br />por una buena base.</h1><p>Organiza tus locales y los accesos de tu equipo.<br />Un espacio para trabajar con claridad.</p><div className="story-locations"><span>Milán</span><span>Centro</span></div></div><span className="story-footer">Hecho para la operación de Nativos.</span><div className="leaf leaf-one" aria-hidden="true"/><div className="leaf leaf-two" aria-hidden="true"/></div>
    <main className="auth-main"><div className="auth-theme"><ThemeToggle /></div><div className="auth-card"><span className="eyebrow">{setup ? 'PRIMER ACCESO' : 'BIENVENIDO DE NUEVO'}</span><h2>{setup ? 'Configura tu acceso' : 'Inicia sesión'}</h2><p>{setup ? 'Crea el usuario del dueño para comenzar a administrar Nativos.' : 'Ingresa con el usuario asignado a tu equipo.'}</p>
      {error ? <><Notice error>{error}</Notice><button className="secondary" onClick={() => void init()}>Volver a conectar</button></> : <SaveForm label={setup ? 'Crear mi acceso' : 'Entrar a Nativos'} onSave={async data => {
        await api(setup ? '/setup' : '/login', 'POST', { ...(setup ? { name: String(data.get('name')) } : {}), login: String(data.get('login')), password: String(data.get('password')) });
        setSetup(false); await refresh(); setPage('summary');
      }}>{setup && <label>Nombre completo<input name="name" minLength={2} maxLength={100} required autoComplete="name" /></label>}
        <label>Usuario<input name="login" minLength={3} maxLength={64} required pattern="[a-zA-Z0-9_.\-]+" autoComplete="username" autoCapitalize="none" spellCheck={false} /></label>
        <label>Contraseña<input name="password" type="password" aria-label="Contraseña" aria-describedby={setup ? 'password-help' : undefined} minLength={setup ? 12 : 1} maxLength={128} required autoComplete={setup ? 'new-password' : 'current-password'} />{setup && <small id="password-help">Usa al menos 12 caracteres. Tú eliges tus credenciales.</small>}</label>
      </SaveForm>}<p className="auth-footnote"><a href="/caja">Abrir Caja, incluso sin conexión</a></p></div></main></div>;
  const admin = me.user.role === 'owner' && me.user.actions.includes('settings.manage');
  const selected = me.branches.find(b => b.id === branchId);
  return <div className="app-shell"><a className="skip-link" href="#main">Ir al contenido</a><aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}><div className="sidebar-brand"><Logo /><button className="mobile-menu" aria-label="Mostrar navegación" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button></div>
    <nav aria-label="Navegación principal"><span className="nav-label">TU ESPACIO</span>{pages.filter(p => !p.admin || admin).map(p => <button key={p.id} aria-current={page === p.id ? 'page' : undefined} onClick={() => { setPage(p.id); setMenuOpen(false); }}><span className="nav-icon" aria-hidden="true">{p.icon}</span>{p.name}</button>)}
      <a className="secondary" href="/caja">Caja y ventas</a><details className="upcoming"><summary>Módulos en preparación</summary>{pending.map(name => <span key={name}>{name}<small>Pendiente</small></span>)}</details></nav>
    <div className="sidebar-account"><span className="avatar">{me.user.name.slice(0, 1).toUpperCase()}</span><div><strong>{me.user.name}</strong><small>{roles[me.user.role]}</small></div><button className="icon-button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={async () => { try { await api('/logout', 'POST', {}); setMe(null); setPage('summary'); } catch (e) { setError((e as Error).message); } }}>↪</button></div></aside>
    <div className="workspace"><header className="topbar"><label>Sucursal<select aria-label="Sucursal" value={branchId} onChange={e => setBranchId(e.target.value)}>{me.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><div className="topbar-actions"><span className="local-label"><span />Administración local</span><ThemeToggle /></div></header>
      <main id="main" tabIndex={-1} className="content">{error && <Notice error>{error}</Notice>}
        {page === 'summary' && <><Heading eyebrow="TU ESPACIO NATIVOS" title={`Hola, ${me.user.name.split(' ')[0]}`}>Tu equipo y tus locales, listos para organizarse.</Heading>
          <section className="welcome-panel"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>Una base clara<br />para cada día.</h2><p>Gestiona los accesos de tu equipo y la configuración de tus sucursales.</p><button className="primary" onClick={() => setPage('branches')}>Ver mis sucursales <span aria-hidden="true">↗</span></button></div><div className="welcome-mark" aria-hidden="true"><span>N</span><i /></div></section>
          <div className="summary-grid"><section className="stat-card"><span className="eyebrow">MIS SUCURSALES</span><strong>{me.branches.length.toString().padStart(2, '0')}</strong><p>{me.branches.map(b => b.name).join(' · ')}</p></section><section className="stat-card"><span className="eyebrow">PERFIL DE ACCESO</span><strong className="word-stat">{roles[me.user.role]}</strong><p>Permisos individuales por sucursal</p></section><section className="stat-card"><span className="eyebrow">LOCAL SELECCIONADO</span><strong className="word-stat">{selected?.name}</strong><p>COP · Hora de Colombia</p></section></div>
          <div className="two-columns"><section className="panel quick-links"><header className="section-heading"><h2>Accesos rápidos</h2></header><button onClick={() => setPage('branches')}><span><strong>Sucursales y bodegas</strong><small>Consulta locales, bodegas y equipos.</small></span><span aria-hidden="true">↗</span></button>{admin && <><button onClick={() => setPage('users')}><span><strong>Usuarios y roles</strong><small>Administra quién accede a cada local.</small></span><span aria-hidden="true">↗</span></button><button onClick={() => setPage('audit')}><span><strong>Auditoría</strong><small>Consulta el historial de cambios.</small></span><span aria-hidden="true">↗</span></button></>}</section>
            <section className="panel readiness"><span className="badge">Construcción en curso</span><h2>La administración<br />ya tiene su espacio.</h2><p>La caja local permite abrir turno y cobrar pedidos. Fidelización permite inscribir clientes, consultar puntos y canjear online.</p><p className="small">Abre la caja desde el menú para comenzar.</p></section></div></>}
        {page === 'loyalty' && <Loyalty key={branchId} branchId={branchId} me={me} />}
        {page === 'customers' && <Customers key={branchId} branchId={branchId} />}
        {page === 'products' && <Catalog key={branchId} me={me} branchId={branchId} />}
        {page === 'recipes' && <Recipes key={branchId} me={me} branchId={branchId} />}
        {page === 'inventory' && <Inventory key={branchId} me={me} branchId={branchId} />}
        {page === 'purchases' && <Purchases key={branchId} me={me} branchId={branchId} />}
        {page === 'transfers' && <Transfers key={branchId} me={me} branchId={branchId} />}
        {page === 'counts' && <Counts key={branchId} me={me} branchId={branchId} />}
        {page === 'reports' && <Reports key={branchId} branchId={branchId} />}
        {page === 'backups' && admin && <Backups />}
        {page === 'users' && admin && <Users me={me} onSessionRefresh={refresh} />}
        {page === 'branches' && branchId && <Branches me={me} branchId={branchId} refresh={refresh} />}
        {page === 'audit' && admin && <Audit me={me} />}
      </main><footer className="workspace-footer">Nativos · Vida y bienestar<span>Administración y Caja · Sitio web</span></footer></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
