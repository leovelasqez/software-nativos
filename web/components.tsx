import { useEffect, useRef, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';

export function Logo() { return <div className="brand"><span>nativos<span className="brand-dot">.</span></span><small>VIDA Y BIENESTAR</small></div>; }
export function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  return <button className="theme" type="button" role="switch" aria-checked={dark} aria-label="Modo oscuro" onClick={() => {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('nativos-theme', next ? 'dark' : 'light'); } catch { /* usable without storage */ }
  }}><span aria-hidden="true">{dark ? '☾' : '☀'}</span><span>{dark ? 'Oscuro' : 'Claro'}</span><span className="switch-track" aria-hidden="true"><span /></span></button>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>{children}</div>;
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!; el.showModal();
    // React autofocus runs before a closed dialog is shown; focus after showModal.
    el.querySelector<HTMLElement>('input:not([type="checkbox"]),select,textarea')?.focus({ preventScroll: true });
    return () => el.close();
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onClose={onClose}>
    <header className="dialog-header"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2 id="dialog-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={onClose}>×</button></header>{children}</dialog>;
}
export function SaveForm({ children, onSave, label = 'Guardar cambios' }: { children: ReactNode; onSave: (data: FormData) => Promise<void>; label?: string }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await onSave(new FormData(event.currentTarget)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="form"><fieldset disabled={busy}>{children}</fieldset>
    {error && <Notice error>{error}</Notice>}<div className="form-footer"><span>Los cambios quedan registrados.</span><button className="primary" disabled={busy}>{busy ? 'Guardando…' : label}</button></div></form>;
}
export function Reason() { return <label>Motivo del cambio<textarea name="reason" minLength={3} maxLength={500} required placeholder="Describe por qué realizas este cambio" rows={2} /></label>; }
export function Heading({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{children}</p></div>{action}</div>;
}
