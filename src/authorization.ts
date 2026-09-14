import { isAction, isGrant, isId, isPrincipal } from './contracts.ts';
import type { Action } from './contracts.ts';
export { defaultActions } from './permissions.ts';
const offline = new Set<Action>(['data.read', 'order.write', 'sale.discount', 'sale.cancel',
  'sale.charge', 'shift.open', 'shift.close']);
const recovery = new Set<Action>(['data.read', 'order.write', 'shift.close']);
export interface AccessRequest {
  principal: unknown; action: unknown; branchId: unknown; deviceId: unknown;
  mode: 'online' | 'offline';
  // Only a trusted authentication adapter may supply a verified grant.
  verifiedGrant?: unknown; nowMs?: number; lastObservedAtMs?: number;
}
type Reason = 'invalid_context' | 'inactive' | 'branch_denied' | 'permission_denied'
  | 'online_required' | 'invalid_grant' | 'offline_expired' | 'clock_untrusted';
export type AccessDecision = { allowed: true } | { allowed: false; reason: Reason };
const deny = (reason: Reason): AccessDecision => ({ allowed: false, reason });
const validTime = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;

// REQ-001-02/03; REQ-007-03/05. Pure policy, not authentication or persistence.
export function authorize(request: AccessRequest): AccessDecision {
  const { principal: p, action, branchId, deviceId, mode } = request;
  if (!isPrincipal(p) || !isAction(action) || !isId(branchId) || !isId(deviceId)
    || (mode !== 'online' && mode !== 'offline')) return deny('invalid_context');
  if (!p.active) return deny('inactive');
  if (!p.branchIds.includes(branchId)) return deny('branch_denied');
  if (!p.actions.includes(action)
    || ((action.startsWith('cost.') || action === 'loyalty.adjust')
      && p.role !== 'owner')) return deny('permission_denied');
  if (mode === 'online') return { allowed: true };
  if (p.kind === 'agent' || !offline.has(action)) return deny('online_required');
  const g = request.verifiedGrant;
  if (!isGrant(g) || g.actorId !== p.actorId || g.branchId !== branchId
    || g.deviceId !== deviceId || !g.actions.includes(action)) return deny('invalid_grant');
  const { nowMs, lastObservedAtMs } = request;
  if (!validTime(nowMs) || !validTime(lastObservedAtMs)) return deny('invalid_context');
  if (recovery.has(action)) return { allowed: true };
  if (nowMs < Math.max(g.validatedAtMs, lastObservedAtMs)) return deny('clock_untrusted');
  if (nowMs >= g.expiresAtMs) return deny('offline_expired');
  return { allowed: true };
}

// REQ-001-02: allowlist; never spread a stored record into public output.
export function publicProduct(record: {
  id: string; name: string; finalPrice: string;
  taxAssignment: null | { id: string; label: string };
}) {
  return {
    id: record.id, name: record.name, finalPrice: record.finalPrice,
    taxAssignment: record.taxAssignment === null ? null
      : { id: record.taxAssignment.id, label: record.taxAssignment.label },
  };
}
