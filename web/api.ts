import type { Action, Role } from '../src/contracts.ts';
export interface User { id: string; name: string; login: string; role: Role; active: boolean; branchIds: string[]; actions: Action[] }
export interface Branch { id: string; name: string }
export interface Warehouse { id: string; branchId: string; name: string; isDefault: boolean }
export interface Device { id: string; branchId: string; name: string; active: boolean; printerModel: string | null }
export interface Me { user: User; branches: Branch[]; deviceId: string }
export interface BranchDetail { branch: Branch; warehouses: Warehouse[]; devices: Device[] }
export interface Audit { id: string; actorId: string; actorKind: string; deviceId: string; branchId: string | null; operationId: string; action: string; occurredAt: string; receivedAt: string; reason: string; changes: object }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', cache: 'no-store',
    headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Nativos-Request': '1' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') window.dispatchEvent(new Event('session-expired'));
    throw new Error(result.message ?? 'No se pudo completar la solicitud.');
  }
  return result as T;
}
export const roles = { owner: 'Dueño', manager: 'Encargado', cashier: 'Cajero' };
export const date = (value: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
