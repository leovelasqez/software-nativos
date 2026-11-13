import { useEffect, useState } from 'react';
import { api, date } from './api.ts';
import { AdminTable, Dialog, Heading, Notice } from './components.tsx';

type Backup = { version: 1; id: string; createdAt: string; schemaVersion: string; sha256: string; bytes: number; coverage: 'server-synchronized-only'; verified: boolean; verifiedAt: string | null };
type BackupList = { status: 'loading' } | { status: 'unavailable'; message: string } | { status: 'ready'; items: Backup[] };
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

export function Backups() {
  const [list, setList] = useState<BackupList>({ status: 'loading' }); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [restoring, setRestoring] = useState<Backup | null>(null); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false);
  async function load() {
    setList({ status: 'loading' });
    try { const { items } = await api<{ items: Backup[] }>('/backups'); setList({ status: 'ready', items }); }
    catch (e) { setList({ status: 'unavailable', message: (e as Error).message }); }
  }
  useEffect(() => { void load(); }, []);
  async function create() {
    if (busy || list.status !== 'ready') return;
    setBusy(true); setError(''); setNotice('');
    try { await api('/backups', 'POST', {}); setNotice('Respaldo lógico local creado. No cubre operaciones sin sincronizar ni el perfil del navegador.'); }
    catch (e) { setError((e as Error).message); }
    finally { await load(); setBusy(false); }
  }
  async function verify(item: Backup) { setBusy(true); setError(''); try { await api(`/backups/${item.id}/verify`, 'POST', {}); setNotice('Integridad verificada con SHA-256.'); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function restore() { if (!restoring || confirmation !== `RESTORE ${restoring.id}`) return; setBusy(true); setError(''); try { const result = await api<{ destination: string; reconciled: boolean }>(`/backups/${restoring.id}/restore-check`, 'POST', { confirm: confirmation }); setNotice(`Restauración aislada conciliada en ${result.destination}. La base activa no fue modificada.`); setRestoring(null); setConfirmation(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <><Heading eyebrow="RECUPERACIÓN LOCAL" title="Respaldo y recuperación" action={<div className="prerequisite-actions">
    <button className="primary" disabled={busy || list.status !== 'ready'} aria-describedby={list.status !== 'ready' ? 'backup-availability' : undefined} onClick={() => void create()}>Crear respaldo</button>
    {list.status !== 'ready' && <small id="backup-availability" role="status">{list.status === 'loading' ? 'Consultando el destino del respaldo…' : list.message}</small>}
    {list.status === 'unavailable' && <button className="text-button" onClick={() => { setError(''); void load(); }}>Volver a comprobar</button>}
  </div>}>Incluye solo hechos confirmados por el servidor. No reemplaza una copia externa ni protege operaciones pendientes de Caja.</Heading>
    {error && (list.status !== 'unavailable' || list.message !== error) && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <section className="panel"><p className="footnote">Los respaldos se guardan localmente. La retención, ubicación externa, RPO y RTO requieren la decisión DEC-012.</p>
      {list.status === 'ready' && <AdminTable label="Respaldos locales" rows={list.items} empty="Aún no hay respaldos locales." columns={[
        { heading: 'Creado', cell: item => date(item.createdAt) },
        { heading: 'Esquema', cell: item => item.schemaVersion },
        { heading: 'Tamaño', cell: item => size(item.bytes) },
        { heading: 'Integridad', cell: item => item.verified ? 'Verificado' : 'Pendiente' },
        { heading: 'Acciones', cell: item => <div className="admin-table-actions">
          <button className="secondary" disabled={busy} onClick={() => void verify(item)}>Verificar</button>
          <button className="secondary" disabled={busy} onClick={() => { setRestoring(item); setConfirmation(''); }}>Ensayar restauración</button>
        </div> },
      ]}/>}
    </section>
    {restoring && <Dialog title="Ensayar restauración aislada" onClose={() => !busy && setRestoring(null)}><p>Se creará una base sintética nueva y se conciliará con este respaldo. Nunca se reemplaza la base activa; si el destino ya existe, se rechaza.</p><label>Escribe <code>{`RESTORE ${restoring.id}`}</code> para confirmar<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoFocus /></label><div className="dialog-actions"><button className="secondary" disabled={busy} onClick={() => setRestoring(null)}>Cancelar</button><button className="primary" disabled={busy || confirmation !== `RESTORE ${restoring.id}`} onClick={() => void restore()}>Restaurar y conciliar</button></div></Dialog>}
  </>;
}
