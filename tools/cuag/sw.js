const CACHE='tl-cuag-v1';
const ASSETS=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','maskable-512.png','qr-install.png','../../favicon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tl-cuag-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
/* network first for the page so updates arrive, cache when offline; never answer with nothing */
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html')).then(r=>r||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
