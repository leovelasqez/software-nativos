// Public interface cache only. Business data belongs to IndexedDB.
export function serviceWorkerSource(version: string, paths: string[]) {
  return `const CACHE=${JSON.stringify('nativos-shell-' + version)};const PATHS=${JSON.stringify(paths)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PATHS))));
self.addEventListener('message',e=>{if(e.data?.type==='nativos-login-update')e.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const ready=await Promise.all(windows.map(client=>new Promise(resolve=>{
    const channel=new MessageChannel();
    const finish=value=>{clearTimeout(timeout);channel.port1.close();resolve(value);};
    const timeout=setTimeout(()=>finish(false),1000);
    channel.port1.onmessage=event=>finish(event.data?.ready===true);
    client.postMessage({type:'nativos-check-login'},[channel.port2]);
  })));
  if(ready.length&&ready.every(Boolean))await self.skipWaiting();
})());});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('nativos-shell-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){if(!['/','/caja'].includes(u.pathname))return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(c=>c.match(u.pathname))));return;}if(PATHS.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});`;
}
