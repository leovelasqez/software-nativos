import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { serviceWorkerSource } from '../src/service-worker.ts';

test('AC-019-06: activación retira solo caches anteriores de la interfaz y excluye API', async () => {
  const caches = new Set(['nativos-shell-old', 'nativos-shell-current', 'other-cache']);
  const events = new Map<string, (event: unknown) => void>();
  let claimed = false;
  runInNewContext(serviceWorkerSource('current', ['/', '/caja', '/assets/app.js']), {
    URL,
    self: { location: { origin: 'https://nativos.example' }, clients: { claim: async () => { claimed = true; } }, addEventListener: (kind: string, fn: (event: unknown) => void) => events.set(kind, fn) },
    caches: { keys: async () => [...caches], delete: async (name: string) => caches.delete(name) },
  });
  let activation: Promise<unknown> | undefined;
  events.get('activate')!({ waitUntil: (result: Promise<unknown>) => { activation = result; } });
  await activation;
  assert.equal(claimed, true);
  assert.deepEqual([...caches], ['nativos-shell-current', 'other-cache']);
  for (const url of ['https://nativos.example/api/me', 'https://other.example/assets/app.js']) {
    let intercepted = false;
    events.get('fetch')!({ request: { url, method: 'GET' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
