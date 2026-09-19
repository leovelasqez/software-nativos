import { isOperation } from './contracts.ts';
import type { Operation } from './contracts.ts';

export type SyncState = 'pending' | 'retry' | 'reconciliation_required' | 'acknowledged';
export type SyncEvent = { kind: 'transport_failure' }
  | { kind: 'rejected'; reason: 'conflict' | 'invalid_payload' | 'forbidden' | 'unsupported_version' }
  | { kind: 'accepted'; receipt: unknown };

export interface SyncCursor { sequence: number; operationId: string | null }
export interface ReconciliationIssue { state: SyncState; error?: string | null; errorCode?: string | null; payload: string }

const insufficientStockMessage = /^Existencias insuficientes para \d+ artículos\. Registra una compra, traslado o inventario inicial antes de cobrar\.$/u;

// AC-012-07. Some development builds rejected sales that produced negative
// inventory even though REQ-003-03 explicitly permits it. Only those preserved
// sale operations may return to the ordinary idempotent retry path.
export function isRetryableInventoryRejection(issue: ReconciliationIssue): boolean {
  if (issue.state !== 'reconciliation_required') return false;
  let kind: unknown;
  try { kind = (JSON.parse(issue.payload) as { kind?: unknown }).kind; } catch { return false; }
  if (kind !== 'sale.charge' && kind !== 'sale.split') return false;
  return issue.errorCode === 'insufficient_stock' || issue.errorCode === 'stock_insufficient'
    || insufficientStockMessage.test(issue.error ?? '');
}

// A deployment that compared browser and server clocks without tolerance may
// have preserved an otherwise valid operation as rejected. Retrying keeps the
// immutable operation, grant and payload; the central validator decides again.
export function isRetryableClockAuthorizationRejection(issue: ReconciliationIssue): boolean {
  if (issue.state !== 'reconciliation_required' || issue.errorCode !== 'grant_denied') return false;
  try {
    const event = JSON.parse(issue.payload) as { occurredAtMs?: unknown };
    return Number.isSafeInteger(event.occurredAtMs) && Number(event.occurredAtMs) >= 0;
  } catch { return false; }
}

export function rebaseOperations(operations: Operation[], cursor: SyncCursor): Operation[] {
  if (!Number.isSafeInteger(cursor.sequence) || cursor.sequence < 0
    || (cursor.sequence === 0 ? cursor.operationId !== null : typeof cursor.operationId !== 'string')) {
    throw new Error('invalid_sync_cursor');
  }
  let sequence = cursor.sequence;
  let previousOperationId = cursor.operationId;
  return operations.map(operation => {
    const rebased = { ...operation, sequence: ++sequence, previousOperationId };
    if (!isOperation(rebased)) throw new Error('invalid_rebased_operation');
    previousOperationId = rebased.operationId;
    return rebased;
  });
}

// AC-007-02 (contract only). Accepted receipt repeats immutable envelope exactly.
// An authenticated transport must supply it AFTER the central transaction commits.
export function transition(state: SyncState, operation: Operation, event: SyncEvent): SyncState {
  if (!isOperation(operation)) throw new Error('invalid_operation');
  if (state === 'acknowledged') return state;
  if (event.kind === 'accepted') {
    const r = event.receipt;
    if (!isOperation(r)) return state;
    const keys = Object.keys(operation) as (keyof Operation)[];
    return keys.every(key => operation[key] === r[key]) ? 'acknowledged' : state;
  }
  if (state === 'reconciliation_required') return state;
  return event.kind === 'rejected' ? 'reconciliation_required' : 'retry';
}
