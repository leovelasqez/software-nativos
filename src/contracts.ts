import { Ajv2020 } from 'ajv/dist/2020.js';
import identity from '../contracts/identity-v1.schema.json' with { type: 'json' };
import grant from '../contracts/offline-grant-v1.schema.json' with { type: 'json' };
import operation from '../contracts/sync-v1.schema.json' with { type: 'json' };

export type Action = 'data.read' | 'order.write' | 'sale.discount' | 'sale.cancel'
  | 'sale.charge' | 'shift.open' | 'shift.close' | 'product.create' | 'recipe.create'
  | 'customer.create' | 'loyalty.enroll' | 'loyalty.redeem' | 'purchase.read'
  | 'purchase.write' | 'inventory.manage' | 'sale.refund' | 'cost.read'
  | 'cost.write' | 'loyalty.adjust' | 'settings.manage';
export type Role = 'owner' | 'manager' | 'cashier';
export interface Principal {
  version: 1; actorId: string; kind: 'human' | 'agent'; role: Role;
  active: boolean; branchIds: string[]; actions: Action[];
}
export interface OfflineGrant {
  version: 1; grantId: string; actorId: string; deviceId: string; branchId: string;
  validatedAtMs: number; expiresAtMs: number; actions: Action[];
}
export interface Operation {
  version: 1; operationId: string; deviceId: string; branchId: string;
  actorId: string; sequence: number; previousOperationId: string | null;
  payloadHash: string; payloadVersion: 1;
}
const ajv = new Ajv2020({ strict: true, allErrors: true });
export const isPrincipal = ajv.compile<Principal>(identity);
const grantShape = ajv.compile<OfflineGrant>(grant);
const operationShape = ajv.compile<Operation>(operation);
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export function isGrant(value: unknown): value is OfflineGrant {
  return grantShape(value) && value.expiresAtMs > value.validatedAtMs
    && value.expiresAtMs - value.validatedAtMs <= WEEK_MS;
}
export function isOperation(value: unknown): value is Operation {
  return operationShape(value)
    && (value.sequence === 1 ? value.previousOperationId === null
      : value.previousOperationId !== null && value.previousOperationId !== value.operationId);
}
export function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}
export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && identity.properties.actions.items.enum.includes(value);
}
