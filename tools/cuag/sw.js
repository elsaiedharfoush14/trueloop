const CACHE='tl-cuag-v3';
const ASSETS=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','maskable-512.png','qr-install.png','../../favicon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tl-cuag-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
/* network first, revalidating the HTTP cache, so a refresh always gets the newest version; cache only when offline; never answer with nothing */
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.origin!==location.origin){ // Firebase SDK (cloud beta): cache first so saving works offline; everything else cross-origin goes straight to the network
    if(u.hostname==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/'))e.respondWith(caches.match(e.request).then(m=>m||fetch(e.request).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return x;})));
    return;}
  const fresh=e.request.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('.json');
  e.respondWith(fetch(e.request,fresh?{cache:'no-cache'}:{}).then(r=>{if(r.ok&&!u.pathname.endsWith('version.json')){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html')).then(r=>r||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
