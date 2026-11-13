/* TrueLoop Field service worker: precaches the app and tools so they open offline; network first (revalidated) for pages so a refresh always gets the newest release. */
const CACHE='tl-app-2026.11.14.6';
const ASSETS=['./','index.html','favicon.svg','assets/tl.css','assets/tl-core.js',
  'app/','app/index.html','app/manifest.webmanifest','app/icon-192.png','app/icon-512.png','app/maskable-512.png','app/apple-touch-icon.png','app/qr.png',
  'tools/booster/','tools/booster/qr.png','tools/booster/ls-h100/','tools/booster/ls-h100/qr.png','tools/flowmeter/','tools/flowmeter/qr.png','tools/parts/','tools/instruments/','tools/instruments/qr.png','tools/chw/','tools/chw/qr.png','tools/ipc-calculator/',
  'tools/loop-check.html','tools/ro-normalization.html','tools/calibration-certificate.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tl-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  if(u.origin!==location.origin){ // fonts + Firebase SDK files: cache first so the app keeps working offline. Never Firestore / sign-in traffic (*.googleapis.com APIs).
    if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'||(u.hostname==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/')))e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(r,c));return x;})));
    return;}
  if(u.pathname.endsWith('.mp4')||u.pathname.endsWith('.pdf'))return;
  const fresh=r.mode==='navigate'||/\.(html|json|js|css)$/.test(u.pathname)||u.pathname.endsWith('/');
  e.respondWith(fetch(r,fresh?{cache:'no-cache'}:{}).then(x=>{if(x.ok&&!u.pathname.endsWith('version.json')){const c=x.clone();caches.open(CACHE).then(k=>k.put(r,c));}return x;})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('app/index.html'):null)).then(m=>m||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
