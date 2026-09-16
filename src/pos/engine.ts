import type { Operation } from '../contracts.ts';
import { LoyaltyStore } from './loyalty-store.ts';
import type { LoyaltyCache } from '../loyalty.ts';
import { isCommandEventV3 } from '../orders-contract.ts';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { authorize } from '../authorization.ts';
import type { Action } from '../contracts.ts';
import { decimal, formatted } from '../catalog.ts';
import { calculateSale } from '../pos-domain.ts';
import { isSnapshot } from '../pos-contract.ts';
import type { Authorization, Order, Payment, PosEvent, Signed, Snapshot } from '../pos-domain.ts';
import { verifyAuthorization } from '../pos-crypto.ts';
import { hashPassword, verifyPassword } from '../server/security.ts';
import { OrdersStore } from './orders-store.ts';
import { eventAction, checkout, describeLine } from '../orders-domain.ts';
import type { CommandEvent, OrderEvent, Customer } from '../orders-domain.ts';
import { PosStore } from './store.ts';
import { Vault } from './vault.ts';
import type { Protector } from './vault.ts';
export class RemoteError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export type Requester = (url: string, init: RequestInit) => Promise<Response>;
export class PosEngine {
  readonly orders: OrdersStore; readonly loyalty:LoyaltyStore; readonly store: PosStore; readonly vault: Vault; readonly central: string; private readonly request: Requester;
  online = false; message = ''; private cookies = new Map<string,string>(); private queue: Promise<unknown> = Promise.resolve();
  private pendingLogin: { login: string; passwordHash: string; cookie: string; devices: { id: string; name: string; branchName: string }[] } | null = null;
  private startWall: number; private startMono = performance.now(); private readonly clock: () => number;
  private constructor(directory: string, central: string, vault: Vault, request: Requester, clock: () => number) {
    this.store = new PosStore(join(directory, 'pos.sqlite')); this.store.bindInstallation(vault.data.installationId); this.orders = new OrdersStore(this.store); this.loyalty=new LoyaltyStore(this.orders); this.vault = vault; this.central = central; this.request = request; this.clock = clock; this.startWall = clock();
  }
  static async open(directory: string, central: string, options: { protector?: Protector; request?: Requester; clock?: () => number } = {}) {
    const url = new URL(central); if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('El servidor remoto requiere HTTPS.');
    const vault = await Vault.open(directory, options.protector);
    return new PosEngine(directory, central.replace(/\/$/, ''), vault, options.request ?? fetch, options.clock ?? Date.now);
  }
  run<T>(task: () => Promise<T>): Promise<T> { const next = this.queue.then(task, task); this.queue = next.catch(() => {}); return next; }
  close() { this.store.close(); }
  private async remote<T>(path: string, body: object | undefined, cookie = ''): Promise<{ data: T; cookie: string }> {
    let response: Response;
    try { response = await this.request(this.central + '/api' + path, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(5000), headers: { 'content-type': 'application/json', 'x-nativos-request': '1', ...(cookie ? { cookie } : {}), ...(this.vault.data.terminal ? { 'x-pos-token': this.vault.data.terminal.token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { this.online = false; throw new RemoteError(0, 'network', 'Sin conexión con el servidor. Las operaciones permanecen en esta caja.'); }
    const data = await response.json() as T & { code?: string; message?: string }; this.online = true;
    if (!response.ok) throw new RemoteError(response.status, data.code ?? 'remote_error', data.message ?? 'El servidor rechazó la solicitud.');
    return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  status() { return { enrolled: Boolean(this.vault.data.terminal), online: this.online, message: this.message }; }
  private auth(login: string): Authorization {
    if(this.store.meta('browserTransferTarget'))throw new Error('Esta caja fue trasladada al sitio web. Conserva sus archivos como historial.');
    const cached = this.vault.data.users[login]; const terminal = this.vault.data.terminal;
    if (!cached || !terminal || cached.revoked) throw new Error('Tu acceso no está autorizado. Inicia sesión online.');
    const doc = verifyAuthorization(cached.signed, terminal.publicKey);
    if (doc.grant.deviceId !== terminal.deviceId || doc.grant.branchId !== terminal.branchId) throw new Error('La autorización corresponde a otra caja.'); return doc;
  }
  access(login: string, action: Action): Authorization {
    const a = this.auth(login); const now = this.clock(); const high = this.vault.data.lastObservedAtMs;
    const decision = authorize({ principal: a.principal, verifiedGrant: a.grant, action, branchId: a.grant.branchId, deviceId: a.grant.deviceId, mode: 'offline', nowMs: now, lastObservedAtMs: high });
    if (!decision.allowed) throw new Error(decision.reason === 'offline_expired' ? 'Han pasado siete días. Inicia sesión online para volver a cobrar.' : decision.reason === 'clock_untrusted' ? 'El reloj retrocedió. Revalida tu acceso online.' : 'No tienes permiso para esta operación.');
    if (['sale.charge','sale.refund','shift.open'].includes(action) && now + 1000 < this.startWall + performance.now() - this.startMono) throw new Error('El reloj retrocedió durante la sesión. Revalida tu acceso online.');
    return a;
  }
  async login(login: string, password: string) {
    login = login.toLowerCase();
    try {
      const session = await this.remote('/login', { login, password }); const passwordHash = await hashPassword(password); this.cookies.set(login, session.cookie);
      if (!this.vault.data.terminal) {
        const me = (await this.remote<{ user: { role: string }; branches: { id: string; name: string }[] }>('/me', undefined, session.cookie)).data;
        if (me.user.role !== 'owner') throw new Error('El dueño debe activar esta caja antes del primer uso.');
        const devices: { id: string; name: string; branchName: string }[] = [];
        for (const branch of me.branches) {
          const detail = (await this.remote<{ devices: { id: string; name: string; active: boolean }[] }>(`/branches/${branch.id}`, undefined, session.cookie)).data;
          devices.push(...detail.devices.filter(d => d.active).map(d => ({ id: d.id, name: d.name, branchName: branch.name })));
        }
        this.pendingLogin = { login, passwordHash, cookie: session.cookie, devices }; return { needsEnrollment: true, devices };
      }
      await this.sync(false);
      const result = (await this.remote<{ signed: Signed; snapshot: Snapshot; customers?: Customer[]; loyalty?:LoyaltyCache }>('/pos/authorize', { deviceId: this.vault.data.terminal.deviceId, previous: null }, session.cookie)).data;
      await this.accept(login, passwordHash, result); this.message = ''; return { needsEnrollment: false, login };
    } catch (e) {
      if (!(e instanceof RemoteError) || e.status !== 0) throw e;
      const cached = this.vault.data.users[login];
      if (!cached || !await verifyPassword(password, cached.passwordHash)) throw new Error('No fue posible iniciar sesión offline. Revisa tus credenciales.');
      this.access(login, 'data.read'); return { needsEnrollment: false, login };
    }
  }
  async enroll(deviceId: string, expectedLogin?: string) {
    const candidate = this.pendingLogin; if (!candidate || expectedLogin !== undefined && candidate.login !== expectedLogin || !candidate.devices.some(d => d.id === deviceId)) throw new Error('Inicia sesión con el dueño y elige una caja autorizada.');
    const result = (await this.remote<NonNullable<Vault['data']['terminal']>>('/pos/enroll', { deviceId, installationId: this.vault.data.installationId }, candidate.cookie)).data;
    this.vault.data.terminal = result; await this.vault.save();
    const auth = (await this.remote<{ signed: Signed; snapshot: Snapshot; customers?: Customer[]; loyalty?:LoyaltyCache }>('/pos/authorize', { deviceId, previous: null }, candidate.cookie)).data;
    await this.accept(candidate.login, candidate.passwordHash, auth); this.pendingLogin = null; return { login: candidate.login };
  }
  private async accept(login: string, passwordHash: string, result: { signed: Signed; snapshot: Snapshot; customers?: Customer[]; loyalty?:LoyaltyCache }) {
    const a = verifyAuthorization(result.signed, this.vault.data.terminal!.publicKey);
    if (!isSnapshot(result.snapshot) || result.snapshot.branchId !== a.grant.branchId || result.snapshot.deviceId !== a.grant.deviceId) throw new Error('La descarga de catálogo no está completa. Se conserva la anterior.');
    this.vault.data.users[login] = { signed: result.signed, passwordHash, revoked: false };
    this.vault.data.lastObservedAtMs = a.grant.validatedAtMs; this.startWall = this.clock(); this.startMono = performance.now();
    await this.vault.save();
    if (result.customers) this.orders.cache(result.customers);
    if(result.loyalty)this.loyalty.accept(result.loyalty);
    if (!this.store.pending().length || !this.store.snapshot()) this.store.applySnapshot(result.snapshot, a.grant.validatedAtMs);
  }
  state(login: string) {
    const a = this.access(login, 'data.read'); const order = this.store.newOrder(a.grant.actorId); const snapshot = this.store.snapshot();
    let preview: ReturnType<typeof calculateSale> | null = null;
    if (order.lines.length) preview = calculateSale(this.store.snapshot(order.snapshotId)!, order.lines, undefined, this.store.lineSnapshots(order));
    let canCharge = true; let restriction = '';
    try { this.access(login, 'sale.charge'); } catch (e) { canCharge = false; restriction = (e as Error).message; }
    return { user: { id: a.grant.actorId, name: a.actorName }, branchId: a.grant.branchId, deviceId: a.grant.deviceId, expiresAtMs: a.grant.expiresAtMs, online: this.online, message: this.message, canCharge, restriction, snapshot, orderSnapshots: this.store.lineSnapshots(order), order, preview, shift: this.store.shift(), lastClosedShift: this.store.lastClosedShift(), stock: this.store.balances(), sales: this.store.history(), pending: this.store.pending().map(o => ({ id: o.operation.operationId, sequence: o.operation.sequence, state: o.state, error: o.error })), lastSyncAtMs: this.store.meta<number>('lastSyncAtMs') };
  }
  stateV2(login: string) {
    const base = this.state(login); const actorId = this.access(login,'data.read').grant.actorId; const order = this.orders.current(actorId);
    let canRefund = true; try { this.access(login,'sale.refund'); } catch { canRefund=false; }
    return { ...base, loyalty:this.loyalty.cache(),loyaltyPending:this.loyalty.changes(), redemptionPending:this.loyalty.pending()?{id:this.loyalty.pending()!.id,actorId:this.loyalty.pending()!.auth.grant.actorId,total:this.loyalty.pending()!.result.sale?.total}:null, canCharge:base.canCharge&&!this.loyalty.pending(), shiftSummary:this.orders.shiftSummary(base.shift?.id??base.lastClosedShift?.id??null), order, orders:this.orders.list(actorId), snapshots:this.orders.snapshots(), customers:this.orders.customers(), sales:this.orders.history(), refunds:this.orders.refunds(), events:this.orders.events(actorId), canRefund, orderSnapshots:this.orders.snapshots(), preview:order.lines.length?{lines:order.lines.map(l=>describeLine(l,this.orders.snapshots())),total:formatted(order.lines.reduce((n,l)=>n+decimal(describeLine(l,this.orders.snapshots()).amount),0n))}:null };
  }
  async createCustomer(login:string, body:object) { this.access(login,'data.read'); const cookie=this.cookies.get(login); if(!cookie)throw new Error('Inicia sesión online para crear clientes.'); const result=await this.remote<Customer>('/customers',body,cookie); this.orders.cache([result.data]); return result.data; }
  selectOrder(login:string,id:string){this.orders.select(this.access(login,'data.read').grant.actorId,id);return this.stateV2(login);}
  async executeV2(login:string,operationId:string,input:CommandEvent){
    if(!isCommandEventV3(input))throw new Error('Revisa los campos del pedido.');
    const intent={kind:'orders.v2',event:input}; const auth=this.access(login,'data.read'); const replay=this.store.replay(operationId,intent,auth.grant.actorId);if(replay)return replay;
    if(this.loyalty.pending())throw new Error('Recupera o cancela el canje pendiente antes de continuar.');
    this.access(login,eventAction(input)); if(input.kind==='order.save'&&input.order.lines.some(l=>l.discount.value!=='0'))this.access(login,'sale.discount');
    this.vault.data.grants[auth.grant.grantId]=this.vault.data.users[login]!.signed;this.vault.data.lastObservedAtMs=Math.max(this.vault.data.lastObservedAtMs,this.clock());await this.vault.save();
    if(input.kind==='sale.split'&&BigInt(input.points??'0')>0n){if(!auth.principal.actions.includes('loyalty.redeem'))throw new Error('No tienes permiso para canjear.');await this.sync(false);if(this.store.pending().length||this.loyalty.pending())throw new Error('Sincroniza las operaciones pendientes antes de canjear.');await this.refreshLoyalty(login);}
    let body=structuredClone(input);
    if(body.kind==='sale.split'){const p=body.points??'0';delete body.points;const quoted=body.ruleId;delete body.ruleId;const cache=this.loyalty.cache();if(quoted&&quoted!==cache?.rule.id)throw new Error('Las reglas cambiaron. Actualiza el saldo y revisa el cobro.');const member=cache?.members.find(m=>m.customerId===body.customerId);if(BigInt(p)>0n&&!member)throw new Error('Inscribe y sincroniza al cliente antes de canjear.');if(cache&&member)body.loyalty={rule:cache.rule,redeemedPoints:p,knownBalance:member.balance,memberSince:member.enrolledAtMs};}
    if('orderId'in body){const old=this.orders.get(body.orderId);if(old?.revision===0&&body.revision===0){const seed:OrderEvent={kind:'order.save',order:old,occurredAtMs:this.clock(),shiftId:null};this.orders.command(randomUUID(),{kind:'legacy-order-import',id:old.id},auth,seed,this.vault.data.installationId);body.revision=1;}}
    const event:OrderEvent={...body,occurredAtMs:this.clock(),shiftId:this.store.shift()?.id??null};
    if(event.kind==='sale.split'&&BigInt(event.loyalty?.redeemedPoints??'0')>0n){this.loyalty.stage(operationId,intent,auth,event,this.vault.data.installationId);const recovered=await this.recoverRedemption();if(!recovered)throw new Error('No se recuperó el cobro.');return recovered;}
    return this.orders.command(operationId,intent,auth,event,this.vault.data.installationId);
  }
  async refreshLoyalty(login:string){const a=this.access(login,'data.read');const cookie=this.cookies.get(login);if(!cookie){const cached=this.vault.data.users[login]!;const r=await this.remote<{signed:Signed;snapshot:Snapshot;customers?:Customer[];loyalty?:LoyaltyCache}>('/pos/authorize',{deviceId:a.grant.deviceId,previous:cached.signed});await this.accept(login,cached.passwordHash,r.data);return this.loyalty.cache()!;}const r=await this.remote<LoyaltyCache>('/loyalty?branchId='+a.grant.branchId,undefined,cookie);this.loyalty.accept(r.data);return r.data;}
  async enrollLoyalty(login:string,body:object){this.access(login,'data.read');const cookie=this.cookies.get(login);if(!cookie)throw new Error('Inicia sesión online para inscribir.');const result=await this.remote('/loyalty/enroll',body,cookie);await this.refreshLoyalty(login);return result.data;}
  async recoverRedemption(cancel=false){const staged=this.loyalty.pending();if(!staged)return null;const signed=this.vault.data.grants[staged.auth.grant.grantId];if(!signed)throw new Error('Falta la autorización histórica del canje.');
    if(cancel){const r=await this.remote<{committed:boolean;response?:{kind:string;receipt:Operation}}>('/pos/redemption/cancel',{operationId:staged.id,deviceId:staged.operation.deviceId,signed});if(!r.data.committed){this.loyalty.clear();return null;}}
    const response=(await this.remote<{kind:string;receipt:Operation}>('/pos/sync',{operation:staged.operation,payload:staged.payload,signed})).data;
    if(response.kind!=='accepted'||Object.keys(staged.operation).some(k=>response.receipt[k as keyof Operation]!==staged.operation[k as keyof Operation]))throw new Error('Acuse de canje incorrecto; conserva el intento para recuperar.');
    const result=this.loyalty.finish();const pending=this.store.pending().find(p=>p.operation.operationId===staged.id);if(pending)this.store.mark(pending,{kind:'accepted',receipt:response.receipt});return result;
  }
  async resolveRedemption(login:string,cancel:boolean){const a=this.access(login,'data.read');if(this.loyalty.pending()?.auth.grant.actorId!==a.grant.actorId)throw new Error('El canje debe resolverlo su responsable.');return this.recoverRedemption(cancel);}
  async createProduct(login: string, body: object) {
    this.access(login, 'data.read'); const cookie = this.cookies.get(login);
    if (!cookie) throw new Error('Inicia sesión online nuevamente para crear productos.');
    const result = await this.remote('/products', body, cookie); await this.sync(); return result.data;
  }
  async saveOrder(login: string, order: Order) { if(this.loyalty.pending())throw new Error('Resuelve el canje pendiente.'); const a = this.access(login, 'order.write'); return this.store.saveOrder(a.grant.actorId, order); }
  async execute(login: string, kind: 'shift.open' | 'sale.charge' | 'shift.close', body: { operationId: string; openingCash?: string; counted?: string; orderId?: string; revision?: number; payment?: Payment }) {
    const a = this.access(login, 'data.read'); const intent = { kind, ...body };
    const replay = this.store.replay(body.operationId, intent, a.grant.actorId); if (replay) return replay;
    if(this.loyalty.pending())throw new Error('Recupera o cancela el canje pendiente.');
    this.access(login, kind); const now = this.clock();
    this.vault.data.grants[a.grant.grantId] = this.vault.data.users[login]!.signed;
    this.vault.data.lastObservedAtMs = Math.max(this.vault.data.lastObservedAtMs, now); await this.vault.save();
    const shift = this.store.shift(); let event: PosEvent;
    if (kind === 'shift.open') event = { kind, occurredAtMs: now, shiftId: randomUUID(), openingCash: body.openingCash! };
    else if (kind === 'shift.close') event = { kind, occurredAtMs: now, shiftId: shift?.id ?? '', counted: body.counted! };
    else {
      const order = this.store.order(a.grant.actorId);
      if (order && this.orders.get(order.id)) throw new Error('El pedido se actualizó. Recarga la caja para continuar.');
      if (!order || order.id !== body.orderId || order.revision !== body.revision) throw new Error('El pedido cambió o ya fue cobrado. Revisa los comprobantes.');
      event = { kind, occurredAtMs: now, shiftId: shift?.id ?? '', orderId: order.id, snapshotId: order.snapshotId, lines: order.lines, payment: body.payment! };
    }
    return this.store.command(body.operationId, intent, a, event, this.vault.data.installationId);
  }
  async sync(refresh = true) {
    if(this.store.meta('browserTransferTarget'))return;
    if (!this.vault.data.terminal) return;
    for (const o of this.store.pending()) {
      if (o.state === 'reconciliation_required') { this.message = o.error ?? 'Hay una operación pendiente de conciliación.'; return; }
      try {
        const signed = this.vault.data.grants[o.signedId]; if (!signed) throw new Error('Falta la autorización histórica. Conserva los archivos de caja.');
        const result = (await this.remote<{ kind: 'accepted'; receipt: unknown; reviewRequired: boolean }>('/pos/sync', { operation: o.operation, payload: o.payload, signed })).data;
        if (result.kind !== 'accepted') throw new Error('Acuse inesperado.');
        this.store.mark(o, { kind: 'accepted', receipt: result.receipt });
        if (this.store.pending().some(p => p.operation.operationId === o.operation.operationId)) throw new Error('El acuse no corresponde a la operación.');
        if (result.reviewRequired) this.message = 'Se sincronizaron operaciones que requieren revisión por cambios de acceso.';
      } catch (e) {
        const retry = e instanceof RemoteError && (e.status === 0 || e.status >= 500 || e.status === 429 || e.code === 'predecessor_required');
        this.message = (e as Error).message;
        if (e instanceof RemoteError && e.code === 'device_revoked') { for (const user of Object.values(this.vault.data.users)) user.revoked = true; await this.vault.save(); }
        this.store.mark(o, retry ? { kind: 'transport_failure' } : { kind: 'rejected', reason: 'conflict' }, this.message); return;
      }
    }
    if(this.loyalty.pending()){try{await this.recoverRedemption();}catch(e){this.message=(e as Error).message;return;}}
    if (!refresh) return;
    for (const [login, user] of Object.entries(this.vault.data.users)) {
      if (user.revoked) continue;
      try {
        const result = (await this.remote<{ signed: Signed; snapshot: Snapshot; customers?: Customer[]; loyalty?:LoyaltyCache }>('/pos/authorize', { deviceId: this.vault.data.terminal.deviceId, previous: user.signed })).data;
        await this.accept(login, user.passwordHash, result);
      } catch (e) {
        this.message = (e as Error).message;
        if (e instanceof RemoteError && e.status === 403) { user.revoked = true; await this.vault.save(); }
      }
    }
  }
}
