import { useEffect, useState } from 'react';
import { api, date } from './api.ts';
import type { Me } from './api.ts';
import { Dialog, Heading, Notice, Reason, SaveForm } from './components.tsx';

type Agent = { id: string; name: string; active: boolean; branchIds: string[]; actions: string[]; createdAt: string; rotatedAt: string };
type Change = { agent: Agent; kind: 'rotate' | 'revoke' };
export function Agents({ me }: { me: Me }) {
  const [items, setItems] = useState<Agent[]>([]); const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false); const [change, setChange] = useState<Change | null>(null);
  const [credential, setCredential] = useState<{ name: string; token: string } | null>(null);
  const endpoint = window.location.origin + '/api/agent/v1/mcp/read-only';
  const codex = `[mcp_servers.nativos]\nurl = ${JSON.stringify(endpoint)}\nbearer_token_env_var = "NATIVOS_AGENT_TOKEN"`;
  const claude = JSON.stringify({ mcpServers: { nativos: { type: 'http', url: endpoint, headers: { Authorization: 'Bearer ${NATIVOS_AGENT_TOKEN}' } } } }, null, 2);
  async function load() {
    try { setItems((await api<{ items: Agent[] }>('/agents')).items); setError(''); }
    catch (e) { setError((e as Error).message); } finally { setLoaded(true); }
  }
  useEffect(() => { void load(); }, []);
  async function copyToken() {
    if (!credential) return;
    try { await navigator.clipboard.writeText(credential.token); setNotice('Credencial copiada. Guárdala en la configuración privada de tu equipo.'); }
    catch { setNotice('No fue posible copiar automáticamente. Selecciona la credencial y cópiala.'); }
  }
  return <>
    <Heading eyebrow="CONEXIONES" title="Agentes de IA" action={<button className="primary" onClick={() => setCreating(true)}>+ Nueva conexión</button>}>Conecta Codex o Claude Code para consultar productos, recetas, inventario y ventas de las sucursales que elijas.</Heading>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <section className="panel"><div className="panel-toolbar"><div><h2>Conexiones autorizadas</h2><p>Las nuevas conexiones tienen permiso de solo lectura. Puedes retirar su acceso en cualquier momento.</p></div><button className="secondary" onClick={() => void load()}>Actualizar conexiones</button></div>
      <div className="table-wrap admin-table-region" role="region" aria-label="Conexiones de agentes" tabIndex={0}><table className="admin-data-table"><thead><tr><th>Nombre</th><th>Sucursales</th><th>Acceso</th><th>Estado</th><th>Última credencial</th><th>Acciones</th></tr></thead><tbody>{items.map(agent => <tr key={agent.id}>
        <td>{agent.name}</td><td>{agent.branchIds.map(id => me.branches.find(branch => branch.id === id)?.name ?? id).join(', ')}</td><td>{agent.actions.length === 1 && agent.actions[0] === 'data.read' ? 'Solo lectura' : 'Permisos personalizados'}</td><td>{agent.active ? 'Activa' : 'Revocada'}</td><td>{date(agent.rotatedAt)}</td>
        <td><div className="admin-table-actions"><button className="secondary" disabled={!agent.active} onClick={() => setChange({ agent, kind: 'rotate' })} aria-label={`Renovar ${agent.name}`}>Renovar credencial</button><button className="secondary" disabled={!agent.active} onClick={() => setChange({ agent, kind: 'revoke' })} aria-label={`Revocar ${agent.name}`}>Revocar acceso</button></div></td>
      </tr>)}</tbody></table>{!items.length && <p className="empty" role="status">{loaded ? 'Todavía no tienes conexiones de agentes.' : 'Cargando conexiones…'}</p>}</div>
    </section>
    <section className="panel agent-connection-guide"><h2>Conectar tu asistente</h2><p>Crea una conexión por asistente. Guarda su credencial en la variable de entorno <code>NATIVOS_AGENT_TOKEN</code> del equipo desde el que abrirás el asistente. La credencial sólo se muestra al crearla o renovarla.</p>
      <label>Dirección de conexión<input readOnly value={endpoint} onFocus={e => e.currentTarget.select()} /></label>
      <details><summary>Configuración para Codex</summary><p>Añade este bloque a la configuración MCP de Codex. Define la variable privada y vuelve a abrir Codex para cargarla.</p><pre>{codex}</pre></details>
      <details><summary>Configuración para Claude Code</summary><p>Combina esta entrada con tu archivo <code>.mcp.json</code>. Define la variable privada antes de iniciar Claude Code. Comprueba el estado con <code>/mcp</code>.</p><pre>{claude}</pre></details>
      <p>Después de conectar, prueba: «Muéstrame mis sucursales y la última sincronización» o «Consulta las ventas de Centro de ayer». Los informes centrales pueden excluir operaciones que la caja todavía no haya sincronizado.</p>
    </section>
    {creating && <Dialog title="Nueva conexión de consulta" onClose={() => setCreating(false)}><SaveForm label="Crear conexión" onSave={async data => {
      const result = await api<{ token: string }>('/agents/read-only', 'POST', { name: String(data.get('name')), branchIds: data.getAll('branchId').map(String), reason: String(data.get('reason')) });
      setCredential({ name: String(data.get('name')), token: result.token }); setCreating(false); setNotice(''); await load();
    }}><label>Nombre de la conexión<input name="name" minLength={2} maxLength={100} placeholder="Por ejemplo: Codex consultas" required /></label>
      <fieldset><legend>Sucursales autorizadas</legend>{me.branches.map(branch => <label className="check" key={branch.id}><input type="checkbox" name="branchId" value={branch.id} />{branch.name}</label>)}<small>Selecciona al menos una sucursal.</small></fieldset>
      <p>Solo permite consultar. Esta conexión no podrá crear productos ni cambiar inventario o ventas.</p><Reason />
    </SaveForm></Dialog>}
    {change && <Dialog title={change.kind === 'rotate' ? 'Renovar credencial' : 'Revocar acceso'} onClose={() => setChange(null)}><SaveForm label={change.kind === 'rotate' ? 'Confirmar renovación' : 'Confirmar revocación'} onSave={async data => {
      const { agent, kind } = change;
      const result = await api<{ token?: string }>(`/agents/${agent.id}${kind === 'rotate' ? '/rotate' : ''}`, kind === 'rotate' ? 'POST' : 'PATCH', { reason: String(data.get('reason')), ...(kind === 'revoke' ? { active: false } : {}) });
      setChange(null); if (result.token) { setCredential({ name: agent.name, token: result.token }); setNotice(''); } else setNotice(`Acceso revocado para ${agent.name}.`);
      await load();
    }}><p>{change.kind === 'rotate' ? `La credencial anterior de ${change.agent.name} dejará de funcionar. Actualiza después la configuración privada de ese asistente.` : `${change.agent.name} dejará de tener acceso a Nativos.`}</p><Reason /></SaveForm></Dialog>}
    {credential && <Dialog title="Guarda tu credencial" onClose={() => setCredential(null)}><p>Conexión: <strong>{credential.name}</strong>. Al cerrar esta ventana no podrás consultar esta credencial de nuevo; podrás renovarla.</p><label>Credencial nueva<input type="password" readOnly value={credential.token} autoComplete="off" onFocus={e => e.currentTarget.select()} /></label><div className="form-footer"><button className="secondary" onClick={() => void copyToken()}>Copiar credencial</button><button className="primary" onClick={() => setCredential(null)}>Ya la guardé</button></div></Dialog>}
  </>;
}
