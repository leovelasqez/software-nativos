import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { serviceWorkerSource } from '../src/service-worker.ts';

test('AC-021-06: manifiesto offline reproducible entre Windows y Linux', async () => {
  const temporaryRoot = resolve('.local'); await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(join(temporaryRoot, 'sw-manifest-'));
  try {
    await mkdir(join(directory, 'dist/assets'), { recursive: true });
    await writeFile(join(directory, 'dist/index.html'), '<html>Administración sintética</html>');
    await writeFile(join(directory, 'dist/pos.html'), '<html>Caja sintética</html>');
    // Case-insensitive Windows enumeration differs from Linux for these names.
    for (const name of ['client-CtO.css', 'client-CUy.js']) await writeFile(join(directory, 'dist/assets', name), 'synthetic');
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../scripts/build-offline.ts', import.meta.url))], { cwd: directory, windowsHide: true });
    const source = await readFile(join(directory, 'dist/sw.js'), 'utf8');
    const paths = JSON.parse(source.match(/const PATHS=(\[[^\n]*\]);/)?.[1] ?? 'null');
    assert.deepEqual(paths, ['/', '/caja', '/theme.js', '/manifest.webmanifest', '/nativos-icon.svg', '/assets/client-CUy.js', '/assets/client-CtO.css']);
  } finally {
    const target = await realpath(directory); const root = await realpath(temporaryRoot); const inside = relative(root, target);
    assert.ok(inside && inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside));
    await rm(target, { recursive: true, force: true });
  }
});

test('AC-019-06: activación retira solo caches anteriores de la interfaz y excluye API', async () => {
  const caches = new Set(['nativos-shell-old', 'nativos-shell-current', 'other-cache']);
  const events = new Map<string, (event: unknown) => void>();
  let claimed = false;
  let skipped = false;
  let loginReady = true;
  runInNewContext(serviceWorkerSource('current', ['/', '/caja', '/assets/app.js']), {
    URL,
    MessageChannel,setTimeout,clearTimeout,
    self: { location: { origin: 'https://nativos.example' }, skipWaiting:async()=>{skipped=true;}, clients: { matchAll:async()=>[{postMessage:(_message:unknown,ports:MessagePort[])=>ports[0]!.postMessage({ready:loginReady})}],claim: async () => { claimed = true; } }, addEventListener: (kind: string, fn: (event: unknown) => void) => events.set(kind, fn) },
    caches: { keys: async () => [...caches], delete: async (name: string) => caches.delete(name) },
  });
  let activation: Promise<unknown> | undefined;
  events.get('activate')!({ waitUntil: (result: Promise<unknown>) => { activation = result; } });
  await activation;
  assert.equal(claimed, true);
  assert.equal(skipped,false);
  events.get('message')!({data:{type:'unrelated'},waitUntil:()=>{throw new Error('Unexpected update');}});
  assert.equal(skipped,false);
  let update:Promise<unknown>|undefined;
  events.get('message')!({data:{type:'nativos-login-update'},waitUntil:(promise:Promise<unknown>)=>{update=promise;}});
  await update;assert.equal(skipped,true);
  loginReady=false;skipped=false;
  events.get('message')!({data:{type:'nativos-login-update'},waitUntil:(promise:Promise<unknown>)=>{update=promise;}});
  await update;assert.equal(skipped,false);
  assert.deepEqual([...caches], ['nativos-shell-current', 'other-cache']);
  for (const url of ['https://nativos.example/api/me', 'https://other.example/assets/app.js']) {
    let intercepted = false;
    events.get('fetch')!({ request: { url, method: 'GET' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
