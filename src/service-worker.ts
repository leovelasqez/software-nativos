// Public interface cache only. Business data belongs to IndexedDB.
export function serviceWorkerSource(version: string, paths: string[]) {
  return `const CACHE=${JSON.stringify('nativos-shell-' + version)};const PATHS=${JSON.stringify(paths)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PATHS))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('nativos-shell-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){if(!['/','/caja'].includes(u.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(u.pathname))));return;}if(PATHS.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});`;
}
