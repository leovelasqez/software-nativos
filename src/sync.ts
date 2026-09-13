import { isOperation } from './contracts.ts';
import type { Operation } from './contracts.ts';

export type SyncState = 'pending' | 'retry' | 'reconciliation_required' | 'acknowledged';
export type SyncEvent = { kind: 'transport_failure' }
  | { kind: 'rejected'; reason: 'conflict' | 'invalid_payload' | 'forbidden' | 'unsupported_version' }
  | { kind: 'accepted'; receipt: unknown };

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
