import { useEffect, useRef, useState } from 'react';
import { api, date } from './api.ts';
import type { BranchDetail, Me, Warehouse } from './api.ts';
import type { Item } from '../src/catalog.ts';
import { allPages, DecimalField } from './Catalog.tsx';
import { Dialog, Heading, Notice, Reason, SaveForm } from './components.tsx';

type Supplier = { id: string; name: string; document: string | null; contact: string | null };
type Purchase = { id: string; supplierId: string; supplierName: string; warehouseId: string; purchasedOn: string; paymentMethod: string; paidAmount: string; lines: { itemId: string; quantity: string; unit: string; baseQuantity: string; unitPrice: string; lineTotal: string }[] };
type Line = { id: string; itemId: string; quantity: string; unit: string; unitPrice: string };
const money = (n: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(n));
const text = (d: FormData, key: string) => String(d.get(key) ?? '');
function useOperation(branchId: string) {
  const last = useRef({ payload: '', id: '' });
  return async (url: string, body: object) => {
    const payload = JSON.stringify({ url, branchId, ...body });
    if (last.current.payload !== payload) last.current = { payload, id: crypto.randomUUID() };
    return api(url, 'POST', { ...body, branchId, operationId: last.current.id });
  };
}
const newLine = (): Line => ({ id: crypto.randomUUID(), itemId: '', quantity: '', unit: '', unitPrice: '' });

export function Purchases({ me, branchId }: { me: Me; branchId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); const [items, setItems] = useState<Item[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]); const [error, setError] = useState(''); const [dialog, setDialog] = useState<'supplier' | 'purchase' | null>(null);
  const refreshId = useRef(0);
  const canWrite = me.user.actions.includes('purchase.write');
  async function refresh() {
    const generation = ++refreshId.current;
    try {
      const [s, i, p, branch] = await Promise.all([
        allPages<Supplier>(`/suppliers?branchId=${branchId}`), allPages<Item>(`/items?branchId=${branchId}`), allPages<Purchase>(`/purchases?branchId=${branchId}`), api<BranchDetail>(`/branches/${branchId}`),
      ]);
      if (generation !== refreshId.current) return;
      setSuppliers(s); setItems(i.filter(i => i.kind !== 'finished')); setPurchases(p); setWarehouses(branch.warehouses); setError('');
    } catch (e) { if (generation === refreshId.current) setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); return () => { refreshId.current++; }; }, [branchId]);
  return <><Heading eyebrow="ABASTECIMIENTO" title="Compras y proveedores" action={canWrite && <div className="row-actions"><button className="secondary" onClick={() => setDialog('supplier')}>+ Proveedor</button><button className="primary" onClick={() => setDialog('purchase')}>+ Registrar compra</button></div>}>Compras pagadas de esta sucursal y sus entradas de inventario.</Heading>
    {error && <Notice error>{error}</Notice>}<section className="panel"><header className="section-heading"><h2>Compras registradas</h2><span className="muted">{purchases.length} {purchases.length === 1 ? 'compra' : 'compras'}</span></header>
      {!purchases.length && <p className="empty">Aún no hay compras registradas en esta sucursal.</p>}
      {[...purchases].reverse().map(p => <article className="catalog-row" key={p.id}><div><span className="eyebrow">{p.paymentMethod.toUpperCase()}</span><h2>{p.supplierName}</h2><p>{date(p.purchasedOn + 'T12:00:00-05:00')} · {warehouses.find(w => w.id === p.warehouseId)?.name ?? 'Bodega'}</p><details><summary>{p.lines.length} {p.lines.length === 1 ? 'artículo' : 'artículos'}</summary>{p.lines.map(l => <p key={l.itemId}>{items.find(i => i.id === l.itemId)?.name ?? 'Artículo'}: {l.quantity} {l.unit} · entrada {l.baseQuantity} base · {money(l.lineTotal)}</p>)}</details></div><strong>{money(p.paidAmount)}</strong></article>)}
    </section>{dialog === 'supplier' && <SupplierForm branchId={branchId} close={() => setDialog(null)} saved={async () => { setDialog(null); await refresh(); }} />}{dialog === 'purchase' && <PurchaseForm branchId={branchId} suppliers={suppliers} items={items} warehouses={warehouses} close={() => setDialog(null)} saved={async () => { setDialog(null); await refresh(); }} />}</>;
}
function SupplierForm({ branchId, close, saved }: { branchId: string; close: () => void; saved: () => Promise<void> }) {
  const send = useOperation(branchId);
  return <Dialog title="Nuevo proveedor" onClose={close}><SaveForm label="Guardar proveedor" onSave={async d => { await send('/suppliers', { name: text(d, 'name'), document: text(d, 'document'), contact: text(d, 'contact'), reason: text(d, 'reason') }); await saved(); }}>
    <label>Nombre<input name="name" minLength={2} maxLength={100} required /></label><label>Documento / NIT (opcional)<input name="document" maxLength={160} /></label><label>Contacto (opcional)<input name="contact" maxLength={160} /></label><Reason />
  </SaveForm></Dialog>;
}
function PurchaseForm({ branchId, suppliers, items, warehouses, close, saved }: { branchId: string; suppliers: Supplier[]; items: Item[]; warehouses: Warehouse[]; close: () => void; saved: () => Promise<void> }) {
  const send = useOperation(branchId); const [lines, setLines] = useState<Line[]>([newLine()]); const defaultWarehouse = warehouses.find(w => w.isDefault)?.id ?? warehouses[0]?.id ?? '';
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  return <Dialog title="Registrar compra pagada" onClose={close}><SaveForm label="Registrar compra" onSave={async d => {
    await send('/purchases', { supplierId: text(d, 'supplierId'), warehouseId: text(d, 'warehouseId'), purchasedOn: text(d, 'purchasedOn'), paymentMethod: text(d, 'paymentMethod'), paidAmount: text(d, 'paidAmount'), reason: text(d, 'reason'), lines: lines.map(l => ({ itemId: l.itemId, quantity: l.quantity, unit: l.unit, conversion: null, unitPrice: l.unitPrice })) }); await saved();
  }}>
    {!suppliers.length ? <Notice error>Crea un proveedor antes de registrar una compra.</Notice> : <div className="fields"><label>Proveedor<select name="supplierId" required><option value="">Selecciona un proveedor</option>{suppliers.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Bodega de entrada<select name="warehouseId" defaultValue={defaultWarehouse} required>{warehouses.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select></label><label>Fecha de compra<input name="purchasedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Medio registrado<select name="paymentMethod" defaultValue="efectivo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label></div>}
    {lines.map((line, index) => {
      const item = items.find(i => i.id === line.itemId);
      const set = (next: Partial<Line>) => setLines(lines.map(l => l.id === line.id ? { ...l, ...next } : l));
      return <section className="recipe-line" key={line.id}>
        <div className="fields">
          <label>Artículo {index + 1}<select value={line.itemId} required onChange={e => { const next = items.find(i => i.id === e.target.value); set({ itemId: e.target.value, unit: next?.baseUnit ?? '' }); }}><option value="">Selecciona un artículo</option>{items.map(i => <option value={i.id} key={i.id}>{i.name} ({i.baseUnit})</option>)}</select></label>
          <label>Cantidad {index + 1}<input value={line.quantity} inputMode="decimal" pattern="(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?" required onChange={e => set({ quantity: e.target.value })} /></label>
          <label>Unidad<input value={line.unit} readOnly aria-label={`Unidad ${index + 1}`} /></label>
          <label>Precio unitario {index + 1} (COP)<input value={line.unitPrice} inputMode="decimal" pattern="(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?" required onChange={e => set({ unitPrice: e.target.value })} /></label>
        </div>
        <div className="row-actions">{lines.length > 1 && <button type="button" className="secondary" onClick={() => setLines(lines.filter(l => l.id !== line.id))}>Quitar</button>}</div>
        {item && <p className="muted">La entrada se registra en {item.baseUnit}; no se calcula costo promedio hasta resolver la regla pendiente.</p>}
      </section>;
    })}
    <button type="button" className="secondary" onClick={() => setLines([...lines, newLine()])}>+ Agregar artículo</button><DecimalField label="Importe pagado (debe coincidir con las líneas)" name="paidAmount" initial={Number.isFinite(total) ? String(total) : ''} /><p className="muted">Suma de líneas actual: {money(String(total))}. El importe se valida en el servidor.</p><Reason />
  </SaveForm></Dialog>;
}
