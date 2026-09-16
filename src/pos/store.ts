import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { calculateSale, signedDecimal } from '../pos-domain.ts';
import type { Authorization, Order, PosEvent, Snapshot } from '../pos-domain.ts';
import { payloadHash } from '../pos-crypto.ts';
import { decimal, formatted } from '../catalog.ts';
import type { Operation } from '../contracts.ts';
import { transition } from '../sync.ts';
import type { SyncEvent, SyncState } from '../sync.ts';
export interface Outbox { operation: Operation; payload: string; signedId: string; state: SyncState; error: string | null }
export interface Shift { id: string; actorId: string; actorName: string; openingCash: string; expected: string; openedAtMs: number; closedAtMs: number | null; counted: string | null; difference: string | null }
export class PosStore {
  readonly db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const schema = `
      CREATE TABLE IF NOT EXISTS meta(name TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(actor_id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,closed INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift ON shifts(closed) WHERE closed=0;
      CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cash_entries(id TEXT PRIMARY KEY,shift_id TEXT NOT NULL,amount TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stock_entries(id TEXT NOT NULL,item_id TEXT NOT NULL,sequence INTEGER NOT NULL,delta TEXT NOT NULL,PRIMARY KEY(id,item_id));
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,sequence INTEGER NOT NULL UNIQUE,envelope TEXT NOT NULL,payload TEXT NOT NULL,signed TEXT NOT NULL,state TEXT NOT NULL,error TEXT,receipt TEXT);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,response TEXT NOT NULL);
      INSERT OR IGNORE INTO meta VALUES('schema','1');`;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec(schema);
      const checksum = payloadHash(schema); const previous = this.meta<string>('schemaChecksum');
      if (previous && previous !== checksum) throw new Error('El esquema local cambió. Conserva los pendientes antes de migrar.');
      this.setMeta('schemaChecksum', checksum); this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); this.db.close(); throw e; }
    if (this.meta('schema') !== 1) throw new Error('Versión local incompatible. Conserva los pendientes.');
  }
  bindInstallation(id: string) { const previous = this.meta<string>('installationId'); if (previous && previous !== id) throw new Error('La base local pertenece a otra instalación. Conserva sus archivos y pendientes.'); this.tx(() => this.setMeta('installationId', id)); }
  close() { this.db.close(); }
  private tx<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  meta<T = unknown>(key: string): T | null { const row = this.db.prepare('SELECT value FROM meta WHERE name=?').get(key); return row ? JSON.parse(String(row.value)) as T : null; }
  private setMeta(key: string, value: unknown) { this.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
  snapshot(id = this.meta<string>('snapshot') ?? ''): Snapshot | null { const r = this.db.prepare('SELECT data FROM snapshots WHERE id=?').get(id); return r ? JSON.parse(String(r.data)) as Snapshot : null; }
  applySnapshot(s: Snapshot, confirmedAtMs = s.createdAtMs) { this.tx(() => { this.db.prepare('INSERT OR IGNORE INTO snapshots VALUES(?,?)').run(s.id, JSON.stringify(s)); this.setMeta('snapshot', s.id); this.setMeta('lastSyncAtMs', confirmedAtMs); }); }
  lineSnapshots(order: { lines: Order['lines'] }) { return [...new Set(order.lines.map(l => l.snapshotId))].map(id => { const s = this.snapshot(id); if (!s) throw new Error('Versión de catálogo desconocida.'); return s; }); }
  order(actorId: string): Order | null { const r = this.db.prepare('SELECT data FROM orders WHERE actor_id=?').get(actorId); return r ? JSON.parse(String(r.data)) as Order : null; }
  saveOrder(actorId: string, order: Order) {
    return this.tx(() => {
      const old = this.order(actorId);
      if (old && (old.id !== order.id || old.revision !== order.revision) || !old && order.revision !== 0) throw new Error('El pedido cambió. Recarga la caja.');
      if (this.db.prepare('SELECT 1 FROM sales WHERE order_id=?').get(order.id)) throw new Error('Este pedido ya fue cobrado.');
      const snapshot = this.snapshot(order.snapshotId); if (!snapshot) throw new Error('Catálogo no disponible.');
      if (order.lines.length) calculateSale(snapshot, order.lines, undefined, this.lineSnapshots(order));
      const updated = { ...order, revision: order.revision + 1 };
      this.db.prepare('INSERT INTO orders VALUES(?,?) ON CONFLICT(actor_id) DO UPDATE SET data=excluded.data').run(actorId, JSON.stringify(updated)); return updated;
    });
  }
  shift(): Shift | null { const r = this.db.prepare('SELECT data FROM shifts WHERE closed=0').get(); return r ? JSON.parse(String(r.data)) as Shift : null; }
  lastClosedShift(): Shift | null { const r = this.db.prepare('SELECT data FROM shifts WHERE closed=1 ORDER BY rowid DESC LIMIT 1').get(); return r ? JSON.parse(String(r.data)) as Shift : null; }
  history() { return this.db.prepare('SELECT data FROM sales ORDER BY rowid DESC LIMIT 50').all().map(r => JSON.parse(String(r.data)) as Record<string, unknown>); }
  receipt(id: string) { const r = this.db.prepare('SELECT data FROM sales WHERE id=?').get(id); return r ? JSON.parse(String(r.data)) as Record<string, unknown> : null; }
  balances() {
    const s = this.snapshot(); if (!s) return [];
    const balances = new Map(s.stock.map(i => [i.itemId, signedDecimal(i.quantity)]));
    for (const r of this.db.prepare('SELECT item_id,delta FROM stock_entries WHERE sequence>?').all(s.serverSequence)) balances.set(String(r.item_id), (balances.get(String(r.item_id)) ?? 0n) + signedDecimal(String(r.delta)));
    return [...balances].map(([itemId, qty]) => ({ itemId, quantity: formatted(qty), negative: qty < 0n }));
  }
  pending(): Outbox[] { return this.db.prepare("SELECT * FROM outbox WHERE state!='acknowledged' ORDER BY sequence").all().map(r => ({ operation: JSON.parse(String(r.envelope)) as Operation, payload: String(r.payload), signedId: String(r.signed), state: String(r.state) as SyncState, error: r.error === null ? null : String(r.error) })); }
  mark(o: Outbox, event: SyncEvent, message: string | null = null) {
    this.tx(() => {
      const row = this.db.prepare('SELECT state FROM outbox WHERE id=?').get(o.operation.operationId); if (!row) throw new Error('Operación local no encontrada.');
      const state = transition(String(row.state) as SyncState, o.operation, event);
      this.db.prepare('UPDATE outbox SET state=?,error=?,receipt=? WHERE id=?').run(state, state === 'acknowledged' ? null : message, state === 'acknowledged' ? JSON.stringify(event) : null, o.operation.operationId);
    });
  }
  command(commandId: string, intent: unknown, auth: Authorization, event: PosEvent, installationId: string, failure?: () => void) {
    const fingerprint = payloadHash(JSON.stringify({ actor: auth.grant.actorId, intent }));
    return this.tx(() => {
      const old = this.db.prepare('SELECT * FROM commands WHERE id=?').get(commandId);
      if (old) { if (old.fingerprint !== fingerprint) throw new Error('Identificador utilizado por otro comando.'); return JSON.parse(String(old.response)) as Record<string, unknown>; }
      const existing = this.shift(); const actorId = auth.grant.actorId;
      if (event.kind === 'shift.open' ? existing !== null : !existing || existing.id !== event.shiftId || existing.actorId !== actorId) throw new Error('La caja tiene otro turno o el turno no te pertenece.');
      const sequence = (this.meta<number>('sequence') ?? 0) + 1;
      const payload = JSON.stringify(event); const operation: Operation = { version: 1, operationId: commandId, deviceId: auth.grant.deviceId, branchId: auth.grant.branchId, actorId, sequence, previousOperationId: this.meta<string>('previous'), payloadHash: payloadHash(payload), payloadVersion: 1 };
      let response: Record<string, unknown>;
      if (event.kind === 'shift.open') {
        const shift: Shift = { id: event.shiftId, actorId, actorName: auth.actorName, openingCash: event.openingCash, expected: event.openingCash, openedAtMs: event.occurredAtMs, closedAtMs: null, counted: null, difference: null };
        this.db.prepare('INSERT INTO shifts(id,actor_id,data) VALUES(?,?,?)').run(shift.id, actorId, JSON.stringify(shift)); response = { shift };
      } else if (event.kind === 'sale.charge') {
        const order = this.order(actorId); if (!order || order.id !== event.orderId) throw new Error('El pedido no está disponible.');
        const snapshot = this.snapshot(event.snapshotId); if (!snapshot) throw new Error('No se encontró la versión de catálogo.');
        const sale = calculateSale(snapshot, event.lines, event.payment, this.lineSnapshots({ lines: event.lines }));
        const receipt = { id: commandId, receiptNumber: `${auth.grant.branchId}-${auth.grant.deviceId}-${installationId}-${sequence}`, occurredAtMs: event.occurredAtMs, actorName: auth.actorName, branchId: auth.grant.branchId, deviceId: auth.grant.deviceId, payment: event.payment, ...sale };
        this.db.prepare('INSERT INTO sales VALUES(?,?,?)').run(commandId, event.orderId, JSON.stringify(receipt));
        this.db.prepare('INSERT INTO cash_entries VALUES(?,?,?)').run(commandId, existing!.id, sale.cashApplied);
        for (const item of sale.consumption) this.db.prepare('INSERT INTO stock_entries VALUES(?,?,?,?)').run(commandId, item.itemId, sequence, '-' + item.quantity);
        existing!.expected = formatted(signedDecimal(existing!.expected) + decimal(sale.cashApplied)); this.db.prepare('UPDATE shifts SET data=? WHERE id=?').run(JSON.stringify(existing), existing!.id);
        this.db.prepare('DELETE FROM orders WHERE actor_id=?').run(actorId); response = { receipt };
      } else if (event.kind === 'shift.close') {
        const shift = { ...existing!, closedAtMs: event.occurredAtMs, counted: event.counted, difference: formatted(decimal(event.counted) - signedDecimal(existing!.expected)) };
        this.db.prepare('UPDATE shifts SET closed=1,data=? WHERE id=?').run(JSON.stringify(shift), shift.id); response = { shift };
      } else {
        throw new Error('Los movimientos manuales se registran en la Caja web actualizada.');
      }
      this.db.prepare("INSERT INTO outbox(id,sequence,envelope,payload,signed,state) VALUES(?,?,?,?,?,'pending')").run(commandId, sequence, JSON.stringify(operation), payload, auth.grant.grantId);
      this.setMeta('sequence', sequence); this.setMeta('previous', commandId);
      this.db.prepare('INSERT INTO commands VALUES(?,?,?)').run(commandId, fingerprint, JSON.stringify(response));
      failure?.(); return response;
    });
  }
  replay(commandId: string, intent: unknown, actorId: string) {
    const row = this.db.prepare('SELECT * FROM commands WHERE id=?').get(commandId); if (!row) return null;
    if (row.fingerprint !== payloadHash(JSON.stringify({ actor: actorId, intent }))) throw new Error('Identificador utilizado por otro comando.');
    return JSON.parse(String(row.response)) as Record<string, unknown>;
  }
  newOrder(actorId: string): Order { return this.order(actorId) ?? { id: randomUUID(), revision: 0, snapshotId: this.snapshot()?.id ?? '', lines: [] }; }
}
