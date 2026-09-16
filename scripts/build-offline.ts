import {readdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=(await readdir('dist/assets')).map(n=>'/assets/'+n);const paths=['/','/caja','/theme.js','/manifest.webmanifest','/nativos-icon.svg',...assets];
const version=createHash('sha256').update(await readFile('dist/index.html')).update(await readFile('dist/pos.html')).digest('hex').slice(0,16);
await writeFile('dist/sw.js',`const CACHE='nativos-shell-${version}';const PATHS=${JSON.stringify(paths)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PATHS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){if(!['/','/caja'].includes(u.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(u.pathname))));return;}if(PATHS.includes(u.pathname))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});`);
