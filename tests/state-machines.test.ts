import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncOperation } from '../src/async-operation.ts';
import { isNotificationState, notificationLabels, notificationStates, transitionDelivery } from '../src/notification-state.ts';
import { initialCatalogImport, transitionCatalogImport } from '../web/catalog-import-state.ts';
import type { ExcelImportResult, ExcelPreview } from '../src/catalog-import.ts';

test('AC-021-02 — dos envíos en el mismo turno ejecutan una sola operación', async () => {
  const operation = createAsyncOperation();
  const history: string[] = [];
  const unsubscribe = operation.subscribe(() => history.push(operation.getSnapshot().status));
  let calls = 0;
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const task = async () => { calls++; await wait; };
  const first = operation.run(task);
  assert.equal(operation.getSnapshot().status, 'running');
  const snapshot = operation.getSnapshot();
  operation.reset();
  assert.equal(operation.getSnapshot(), snapshot, 'Reset cannot release an in-flight operation');
  await operation.run(task);
  assert.equal(calls, 1);
  release(); await first;
  assert.equal(operation.getSnapshot().status, 'succeeded');
  assert.deepEqual(history, ['running', 'succeeded']);
  unsubscribe(); operation.reset();
  assert.deepEqual(operation.getSnapshot(), { status: 'idle' });
  assert.equal(history.length, 2);
});

test('AC-021-02 — excepción sincrónica/rechazo permiten corregir y reintentar', async () => {
  const operation = createAsyncOperation('Error de prueba');
  await operation.run(() => { throw new Error('Corrige el campo'); });
  assert.deepEqual(operation.getSnapshot(), { status: 'failed', message: 'Corrige el campo' });
  await operation.run(async () => { throw null; });
  assert.deepEqual(operation.getSnapshot(), { status: 'failed', message: 'Error de prueba' });
  let succeeded = false;
  await operation.run(async () => { succeeded = true; });
  assert.equal(succeeded, true);
  assert.deepEqual(operation.getSnapshot(), { status: 'succeeded' });
});

test('AC-021-03 — confirmar es irreversible aunque falle el refresco de catálogo', () => {
  const preview = { valid: true, previewId: 'synthetic-preview' } as ExcelPreview;
  const result: ExcelImportResult = { importId: 'synthetic-import', summary: { products: 1, recipes: 0, items: 0, lines: 0, options: 0 } };
  const ready = transitionCatalogImport(initialCatalogImport, { kind: 'preview', preview });
  assert.deepEqual(transitionCatalogImport(ready, { kind: 'edit' }), initialCatalogImport);
  assert.equal(transitionCatalogImport(initialCatalogImport, { kind: 'confirmed', result }), initialCatalogImport);
  const invalid = transitionCatalogImport(initialCatalogImport, { kind: 'preview', preview: { ...preview, valid: false } });
  assert.equal(transitionCatalogImport(invalid, { kind: 'confirmed', result }), invalid);
  const completed = transitionCatalogImport(ready, { kind: 'confirmed', result });
  const failed = transitionCatalogImport(completed, { kind: 'refresh_failed', message: 'Sin conexión' });
  assert.deepEqual(failed, { status: 'completed', result, refresh: { status: 'failed', message: 'Sin conexión' } });
  for (const event of [{ kind: 'edit' }, { kind: 'preview', preview }, { kind: 'confirmed', result: { ...result, importId: 'another' } }] as const) {
    assert.equal(transitionCatalogImport(failed, event), failed);
  }
  const retry = transitionCatalogImport(failed, { kind: 'refresh_started' });
  assert.deepEqual(retry, { status: 'completed', result, refresh: { status: 'pending' } });
  assert.deepEqual(transitionCatalogImport(retry, { kind: 'refresh_succeeded' }), { status: 'completed', result, refresh: { status: 'succeeded' } });
});

test('AC-021-04 — respuesta de transporte tardía no reemplaza evidencia del callback', () => {
  const transportStates = ['accepted', 'failed_retryable', 'failed_terminal', 'uncertain'] as const;
  for (const current of ['accepted', 'sent', 'delivered', 'read', 'failed_terminal'] as const) {
    for (const state of transportStates) assert.equal(transitionDelivery(current, { kind: 'transport', state }), current, `${current} + transport ${state}`);
  }
  for (const current of ['sending', 'uncertain', 'failed_retryable'] as const) {
    for (const state of transportStates) assert.equal(transitionDelivery(current, { kind: 'transport', state }), state);
  }
});

test('AC-021-04 — evidencia positiva progresa y entrega/lectura resisten fallos tardíos', () => {
  for (const current of notificationStates) {
    assert.equal(transitionDelivery(current, { kind: 'webhook', state: 'read' }), 'read');
    assert.equal(transitionDelivery(current, { kind: 'webhook', state: 'delivered' }), current === 'read' ? 'read' : 'delivered');
  }
  assert.equal(transitionDelivery('accepted', { kind: 'webhook', state: 'failed_terminal' }), 'failed_terminal');
  assert.equal(transitionDelivery('sent', { kind: 'webhook', state: 'failed_terminal' }), 'failed_terminal');
  for (const current of ['delivered', 'read'] as const) for (const state of ['sent', 'failed_terminal'] as const) assert.equal(transitionDelivery(current, { kind: 'webhook', state }), current);
  assert.deepEqual(Object.keys(notificationLabels), [...notificationStates]);
  for (const state of notificationStates) assert.equal(isNotificationState(state), true);
  for (const value of ['', 'failed', null, {}, 'toString', 'constructor']) assert.equal(isNotificationState(value), false);
});
