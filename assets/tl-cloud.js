/* TrueLoop Field cloud, phase 1: Google sign-in, projects -> sites -> runs, offline-first sync (Firestore persistent cache).
   Loaded as a module by tl-core.js (and by the self-contained tools cuag / ipc) only while the beta flag is on (localStorage tl_beta=1).
   Tool pages: a "Save to site" button snapshots the tool's own localStorage keys into a run; ?run=pid/sid/rid opens a saved run.
   App home: account, projects, sites, run history, compare with the previous run, move this phone's work into the account.
   Data: users/{uid} -> projects/{pid} -> sites/{sid} -> runs/{rid} -> photos/{n}. Owner-only access is enforced by firestore.rules. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut,deleteUser} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,setDoc,getDoc,getDocs,onSnapshot,query,orderBy,limit,
  serverTimestamp,writeBatch,waitForPendingWrites,terminate,clearIndexedDbPersistence} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const CFG={apiKey:'AIzaSyDUMcD1vwG8AYZh8p_G1TZOrNQ7S6hgh3A',authDomain:'trueloop-field.firebaseapp.com',projectId:'trueloop-field',
  storageBucket:'trueloop-field.firebasestorage.app',messagingSenderId:'156636242290',appId:'1:156636242290:web:e9913e54f67fbb25dbfdeb'};
const ROOT=new URL('../',import.meta.url).href;   // .../trueloop/
/* tool id -> page (from ROOT), localStorage keys that hold its inputs, names */
const TOOLS={
  cuag:{p:'tools/cuag/',k:['tl_cuag_v1'],ar:'تشغيل النحاس والفضة',en:'Cu/Ag Commissioning'},
  'booster-ls':{p:'tools/booster/ls-h100/',k:['tl_boost_v1'],ar:'البوستر · LS H100',en:'Booster · LS H100'},
  ipc:{p:'tools/ipc-calculator/',k:['ipc-setup-cfg-v1'],ar:'IPC على ABB ACH480',en:'IPC · ABB ACH480'},
  instruments:{p:'tools/instruments/',k:['tl_inst_v1'],ar:'تشغيل أجهزة القياس',en:'Instrumentation'},
  chw:{p:'tools/chw/',k:['tl_chw_v1'],ar:'معالجة مياه التشيلر',en:'CHW & Cooling Tower'},
  flowmeter:{p:'tools/flowmeter/',k:['tl_flow_v1'],ar:'فلوميتر التراسونيك',en:'Ultrasonic Flowmeter'},
  loop:{p:'tools/loop-check.html',k:['tl-loopcheck-v1'],ar:'Loop Check و FAT',en:'Loop Check & FAT'},
  ro:{p:'tools/ro-normalization.html',k:['tl-ronorm-v1'],ar:'RO Normalization',en:'RO Normalization'},
  cal:{p:'tools/calibration-certificate.html',k:['tl-calcert-v1'],ar:'شهادة معايرة',en:'Calibration Certificate'}
};
const T={
 ar:{save:'احفظ في موقع',signT:'احفظ شغلك في مشروع',signP:'ادخل بحساب جوجل علشان تحفظ التشغيل في موقع، ويظهرلك على أي جهاز. الأدوات نفسها شغالة من غير حساب.',
  google:'الدخول بجوجل',needNet:'أول دخول محتاج نت. بعد كده يشتغل من غير نت.',signErr:'الدخول ماتمّش: {c}',
  project:'المشروع',site:'الموقع',newP:'＋ مشروع جديد',newS:'＋ موقع جديد',pName:'اسم المشروع (مثلًا: برج النخيل)',sName:'اسم الموقع (مثلًا: غرفة الطلمبات)',
  tag:'الجهاز / التاج (اختياري)',tagPh:'مثلًا: بوستر LS · P-101',note:'ملاحظة (اختياري)',photos:'صور (اختياري، لحد 3): nameplate أو الشاشة',
  doSave:'احفظ',saving:'بيتحفظ…',savedOn:'اتحفظ واترفع ✓',savedOff:'اتحفظ على الموبايل. هيترفع لوحده لما النت يرجع.',synced:'اترفع ✓',
  err:'ماتحفظش: {c}',denied:'السيرفر رافض: قواعد الأمان لسه متلزقتش في Firestore.',noData:'الأداة دي لسه مفيهاش بيانات تتحفظ.',needPS:'اختار مشروع وموقع أو اكتب اسم جديد.',
  close:'إقفل',opened:'ده تشغيل محفوظ: {w}',openErr:'التشغيل ده مش موجود على الموبايل ده ومفيش نت.',
  cloudT:'مشاريعي',cloudP:'سجل التشغيل لكل موقع، على موبايلك واللابتوب، وبيشتغل من غير نت.',account:'حسابي',
  noProj:'لسه مفيش مشاريع. افتح أي أداة واضغط «احفظ في موقع»، أو اعمل مشروع من هنا.',noSite:'لسه مفيش مواقع في المشروع ده.',noRun:'لسه مفيش تشغيلات في الموقع ده.',
  sites:'{n} مواقع',runs:'{n} تشغيلات',back:'رجوع',rename:'تغيير الاسم',del:'مسح',delQ:'اضغط تاني علشان تمسح «{n}» وكل اللي جواه',open:'افتح',cmp:'قارن بالسابق',
  pend:'مستني النت',photosN:'{n} صور',cmpT:'اللي اتغيّر من {a} لـ {b}',field:'البند',before:'قبل',now:'دلوقتي',same:'مفيش أي فرق في المدخلات.',
  migT:'لقيت شغل على الموبايل ده',migP:'فيه بيانات محفوظة في {n} أدوات من قبل ما تدخل. انقلها لحسابك في مشروع «شغل قبل الحساب»؟',migDo:'انقلها',migNo:'لا شكرًا',
  migProj:'شغل قبل الحساب',migSite:'الموبايل · {d}',migDone:'اتنقلت ✓',
  name:'الاسم',email:'الإيميل',company:'الشركة',lang:'لغة التطبيق',saveAcc:'احفظ البيانات',accSaved:'اتحفظ ✓',export:'تصدير بياناتي (JSON)',out:'خروج',
  outP:'الخروج بيمسح البيانات من الموبايل ده، وبتفضل في حسابك.',outWait:'فيه حاجات لسه ماترفعتش. وصّل النت الأول وبعدين اخرج.',
  delAcc:'مسح حسابي وكل بياناتي',delAccQ:'اضغط تاني: هيتمسح كل مشاريعك نهائيًا',delAccDone:'اتمسح.',reauth:'ادخل بجوجل تاني وبعدين امسح.',
  ver:'نسخة الأداة'},
 en:{save:'Save to site',signT:'Save your work to a project',signP:'Sign in with Google to save this run to a site and see it on any device. The tools work without an account.',
  google:'Sign in with Google',needNet:'The first sign-in needs internet. After that it works offline.',signErr:'Sign-in failed: {c}',
  project:'Project',site:'Site',newP:'＋ New project',newS:'＋ New site',pName:'Project name (e.g. Palm Tower)',sName:'Site name (e.g. Pump room)',
  tag:'Equipment / tag (optional)',tagPh:'e.g. LS booster · P-101',note:'Note (optional)',photos:'Photos (optional, up to 3): nameplate or screen',
  doSave:'Save',saving:'Saving…',savedOn:'Saved and synced ✓',savedOff:'Saved on this phone. It uploads by itself when internet is back.',synced:'Synced ✓',
  err:'Not saved: {c}',denied:'Server refused: the security rules are not pasted in Firestore yet.',noData:'This tool has no data to save yet.',needPS:'Pick a project and a site, or type a new name.',
  close:'Close',opened:'Saved run: {w}',openErr:'This run is not on this phone and there is no internet.',
  cloudT:'My projects',cloudP:'Run history per site, on your phone and laptop, works offline.',account:'Account',
  noProj:'No projects yet. Open any tool and tap “Save to site”, or create a project here.',noSite:'No sites in this project yet.',noRun:'No runs on this site yet.',
  sites:'{n} sites',runs:'{n} runs',back:'Back',rename:'Rename',del:'Delete',delQ:'Tap again to delete “{n}” and everything in it',open:'Open',cmp:'Compare with previous',
  pend:'Waiting for internet',photosN:'{n} photos',cmpT:'What changed from {a} to {b}',field:'Field',before:'Before',now:'Now',same:'No difference in the inputs.',
  migT:'Work found on this phone',migP:'There is saved data in {n} tools from before you signed in. Move it to your account in a project “Before sign-in”?',migDo:'Move it',migNo:'No thanks',
  migProj:'Before sign-in',migSite:'Phone · {d}',migDone:'Moved ✓',
  name:'Name',email:'Email',company:'Company',lang:'App language',saveAcc:'Save',accSaved:'Saved ✓',export:'Export my data (JSON)',out:'Sign out',
  outP:'Signing out clears the data from this phone; it stays in your account.',outWait:'Some changes are not uploaded yet. Connect to the internet first, then sign out.',
  delAcc:'Delete my account and all my data',delAccQ:'Tap again: all your projects will be deleted for good',delAccDone:'Deleted.',reauth:'Sign in with Google again, then delete.',
  ver:'Tool version'}};
const lang=()=>document.documentElement.lang==='en'?'en':'ar';
const t=(k,v)=>{let s=(T[lang()][k]??T.ar[k]??k);if(v)for(const n in v)s=s.split('{'+n+'}').join(v[n]);return s;};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}},del:k=>{try{localStorage.removeItem(k);}catch(e){}}};
const fmt=ms=>{try{return new Date(ms).toLocaleString(lang()==='ar'?'ar-EG':'en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return new Date(ms).toISOString();}};
const toolName=id=>(TOOLS[id]?TOOLS[id][lang()]:id);

/* ---------- Firebase ---------- */
const app=initializeApp(CFG);
const auth=getAuth(app);
let db;
try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});}
catch(e){db=initializeFirestore(app,{});}   // private mode / no IndexedDB: memory cache
let user=null,ready=false;
const C={  // collection / doc refs
  user:()=>doc(db,'users',user.uid),
  projects:()=>collection(db,'users',user.uid,'projects'),
  sites:pid=>collection(db,'users',user.uid,'projects',pid,'sites'),
  runs:(pid,sid)=>collection(db,'users',user.uid,'projects',pid,'sites',sid,'runs'),
  photos:(pid,sid,rid)=>collection(db,'users',user.uid,'projects',pid,'sites',sid,'runs',rid,'photos')
};

/* ---------- UI shell (works on tool pages without tl.css too) ---------- */
document.head.insertAdjacentHTML('beforeend',`<style id="tlc-css">
.tlc-fab{position:fixed;z-index:30;inset-inline-start:max(14px,env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;align-items:center;
 background:var(--navy,#071b2b);color:#fff;border:1px solid var(--aqua,#16b9e0);border-radius:99px;padding:9px 16px;font:600 .9rem var(--f-body,system-ui),sans-serif;box-shadow:0 8px 24px -8px rgba(0,0,0,.45);cursor:pointer}
.tlc-fab svg{width:18px;height:18px}
.tlc-ov{position:fixed;inset:0;z-index:40;background:rgba(4,16,26,.55);display:flex;align-items:flex-end;justify-content:center}
.tlc-sh{background:var(--card,#fff);color:var(--ink,#071b2b);width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));display:grid;gap:12px;font-family:var(--f-body,system-ui),sans-serif}
@media (min-width:700px){.tlc-ov{align-items:center}.tlc-sh{border-radius:16px}}
.tlc-sh h3{margin:0;font-size:1.05rem;font-family:var(--f-display,inherit)}
.tlc-hd{display:flex;justify-content:space-between;align-items:center;gap:8px}
.tlc-x{border:0;background:transparent;color:var(--muted,#566a77);font-size:1.3rem;padding:2px 8px;cursor:pointer}
.tlc label{display:grid;gap:4px;font-size:.85rem;font-weight:600;color:var(--muted,#566a77)}
.tlc input,.tlc select,.tlc textarea{font:inherit;font-size:.95rem;color:var(--ink,#071b2b);background:var(--soft,#f5f9fb);border:1px solid var(--line,#d3dde3);border-radius:8px;padding:8px 10px;width:100%;box-sizing:border-box;min-width:0}
.tlc textarea{min-height:60px;resize:vertical}
.tlc .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tlc button{font:inherit;font-size:.88rem;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid var(--water,#1268d3);background:transparent;color:var(--water,#1268d3);font-weight:600}
.tlc button.pri{background:var(--water,#1268d3);color:#fff}
.tlc button.dng{border-color:var(--crit,#b42318);color:var(--crit,#b42318)}
.tlc button.gg{display:flex;gap:10px;align-items:center;justify-content:center;background:#fff;color:#1f1f1f;border-color:#dadce0;padding:10px 16px;width:100%}
.tlc .mu{color:var(--muted,#566a77);font-size:.86rem;margin:0}
.tlc .msg{border-radius:8px;padding:8px 10px;font-size:.88rem;background:var(--soft,#f5f9fb);border:1px solid var(--line,#d3dde3)}
.tlc .msg.bad{background:var(--crit-bg,#fde4e1);color:var(--crit,#b42318);border-color:transparent}
.tlc .msg.ok{background:var(--good-bg,#dff3ea);color:var(--good,#1a8f5c);border-color:transparent}
.tlc .thumbs{display:flex;gap:6px;flex-wrap:wrap}.tlc .thumbs img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--line,#d3dde3)}
.tlc-toast{position:fixed;z-index:50;left:50%;transform:translateX(-50%);bottom:calc(70px + env(safe-area-inset-bottom,0px));background:#071b2b;color:#fff;border-radius:10px;padding:9px 14px;font:500 .9rem system-ui,sans-serif;max-width:min(92vw,480px);box-shadow:0 8px 24px -8px rgba(0,0,0,.5)}
.tlc-ban{position:sticky;top:0;z-index:5;background:var(--good-bg,#dff3ea);color:var(--good,#1a8f5c);font:600 .85rem var(--f-body,system-ui),sans-serif;padding:6px 14px;text-align:center}
.tlc-list{display:grid;gap:8px}
.tlc-it{display:grid;gap:4px;background:var(--soft,#f5f9fb);border:1px solid var(--line,#d3dde3);border-radius:10px;padding:10px 12px;text-align:start;color:var(--ink,#071b2b);width:100%}
button.tlc-it{border-color:var(--line,#d3dde3);color:var(--ink,#071b2b);font-weight:400}
.tlc-it b{font-size:.95rem}.tlc-it .mu{font-size:.8rem}
.tlc-pill{display:inline-block;font-size:.72rem;font-weight:600;border-radius:99px;padding:1px 8px;background:var(--warn-bg,#fdf0d9);color:var(--warn,#a15c00)}
.tlc-av{width:36px;height:36px;border-radius:50%;object-fit:cover;background:var(--soft,#f5f9fb);flex:none}
.tlc table{width:100%;border-collapse:collapse;font-size:.84rem}.tlc td,.tlc th{border-bottom:1px solid var(--line,#d3dde3);padding:5px 6px;text-align:start;vertical-align:top;word-break:break-word}
.tlc .crumb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.86rem}
@media print{.tlc-fab,.tlc-ov,.tlc-toast,.tlc-ban{display:none!important}}
</style>`);
const G_ICON='<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
let toastT;
function toast(s){let el=document.querySelector('.tlc-toast');if(!el){el=document.createElement('div');el.className='tlc-toast';el.setAttribute('role','status');document.body.appendChild(el);}
  el.textContent=s;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{el.hidden=true;},3200);}
function sheet(title,html){
  close();const ov=document.createElement('div');ov.className='tlc-ov';
  ov.innerHTML=`<div class="tlc-sh tlc" role="dialog" aria-modal="true" dir="${lang()==='ar'?'rtl':'ltr'}"><div class="tlc-hd"><h3>${esc(title)}</h3><button class="tlc-x" type="button" aria-label="${esc(t('close'))}">✕</button></div>${html}</div>`;
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('.tlc-x'))close();});
  document.body.appendChild(ov);return ov.firstElementChild;}
function close(){document.querySelectorAll('.tlc-ov').forEach(x=>x.remove());}
/* two-tap confirm for destructive buttons */
function arm(btn,msg,fn){btn.onclick=()=>{if(btn.dataset.armed){fn();return;}btn.dataset.armed='1';const old=btn.textContent;btn.textContent=msg;setTimeout(()=>{delete btn.dataset.armed;btn.textContent=old;},4000);};}
const codeMsg=e=>e&&e.code==='permission-denied'?t('denied'):t('err',{c:(e&&(e.code||e.message))||'?'});

/* ---------- sign in / out ---------- */
async function signIn(){
  if(navigator.onLine===false){toast(t('needNet'));return;}
  const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
  try{await signInWithPopup(auth,p);close();}
  catch(e){
    if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported'].includes(e.code)){try{await signInWithRedirect(auth,p);}catch(e2){toast(t('signErr',{c:e2.code||e2.message}));}}
    else if(e.code!=='auth/popup-closed-by-user'&&e.code!=='auth/cancelled-popup-request')toast(t('signErr',{c:e.code||e.message}));
  }
}
getRedirectResult(auth).catch(e=>{if(e&&e.code)toast(t('signErr',{c:e.code}));});
async function doSignOut(){
  if(navigator.onLine===false){toast(t('outWait'));return;}
  try{await Promise.race([waitForPendingWrites(db),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),10000))]);}catch(e){toast(t('outWait'));return;}
  await signOut(auth);
  try{await terminate(db);await clearIndexedDbPersistence(db);}catch(e){}
  location.reload();
}
const signHtml=()=>`<p class="mu">${esc(t('signP'))}</p><button class="gg" type="button" data-act="google">${G_ICON}<span>${esc(t('google'))}</span></button>`;
function wireSign(root){root.querySelectorAll('[data-act=google]').forEach(b=>b.onclick=signIn);}

/* ---------- tool snapshot / restore ---------- */
function currentTool(){const path=location.href.split(/[?#]/)[0];
  for(const id in TOOLS){const u=ROOT+TOOLS[id].p;if(path===u||path===u+'index.html')return id;}return null;}
function snapshot(id){const o={};TOOLS[id].k.forEach(k=>{const v=ls.get(k);if(v!=null)o[k]=v;});return Object.keys(o).length?o:null;}
function summaryText(){const el=document.getElementById('summary');if(!el)return '';return String(el.value!=null&&el.tagName!=='DIV'?el.value:el.innerText||'').trim().slice(0,8000);}
function toolVer(){return String((window.TL&&window.TL.ver)||document.querySelector('[data-ver]')?.dataset.ver||'').slice(0,40);}
async function compress(file){  // -> JPEG data URL, longest side 1280 px
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    const s=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);let q=.72,d=c.toDataURL('image/jpeg',q);while(d.length>900000&&q>.3){q-=.12;d=c.toDataURL('image/jpeg',q);}return d;}
  finally{URL.revokeObjectURL(url);}
}
const newId=col=>doc(col).id;

/* write one run (+ photos) and touch its site / project; returns the commit promise (resolves when the server has it) */
function writeRun(pid,sid,run,photos){
  const b=writeBatch(db),rref=doc(C.runs(pid,sid));
  b.set(rref,Object.assign({by:user.uid,at:serverTimestamp(),clientAt:Date.now(),photos:photos.length,device:navigator.userAgent.slice(0,160)},run));
  photos.forEach((img,i)=>b.set(doc(C.photos(pid,sid,rref.id),String(i+1)),{img,at:serverTimestamp()}));
  b.set(doc(C.sites(pid),sid),{updatedAt:serverTimestamp(),lastTool:run.tool},{merge:true});
  b.set(doc(C.projects(),pid),{updatedAt:serverTimestamp()},{merge:true});
  return b.commit();
}
function ensureProject(name){const ref=doc(C.projects());setDoc(ref,{name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}).catch(e=>toast(codeMsg(e)));return ref.id;}
function ensureSite(pid,name){const ref=doc(C.sites(pid));setDoc(ref,{name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}).catch(e=>toast(codeMsg(e)));return ref.id;}

function afterCommit(p){
  toast(navigator.onLine===false?t('savedOff'):t('saving'));
  p.then(()=>toast(t('savedOn'))).catch(e=>toast(codeMsg(e)));
}

async function saveSheet(id){
  if(!user){wireSign(sheet(t('signT'),signHtml()));return;}
  const data=snapshot(id);if(!data){toast(t('noData'));return;}
  const last=JSON.parse(ls.get('tlc_last')||'{}');
  const sh=sheet(t('save')+' · '+toolName(id),`
    <label>${esc(t('project'))}<select id="tlcP"></select></label><input id="tlcPn" placeholder="${esc(t('pName'))}" hidden maxlength="120">
    <label>${esc(t('site'))}<select id="tlcS"></select></label><input id="tlcSn" placeholder="${esc(t('sName'))}" hidden maxlength="120">
    <label>${esc(t('tag'))}<input id="tlcTag" maxlength="120" placeholder="${esc(t('tagPh'))}"></label>
    <label>${esc(t('note'))}<textarea id="tlcNote" maxlength="2000"></textarea></label>
    <label>${esc(t('photos'))}<input id="tlcPh" type="file" accept="image/*" capture="environment" multiple></label>
    <div class="thumbs" id="tlcTh"></div><div id="tlcMsg"></div>
    <div class="row"><button class="pri" type="button" id="tlcGo">${esc(t('doSave'))}</button></div>`);
  const $=s=>sh.querySelector(s),selP=$('#tlcP'),selS=$('#tlcS');let photos=[],unsubS=null;
  const opts=(list,cur,neu)=>list.map(x=>`<option value="${esc(x.id)}"${x.id===cur?' selected':''}>${esc(x.name)}</option>`).join('')+`<option value="+"${!list.length?' selected':''}>${esc(neu)}</option>`;
  const unsubP=onSnapshot(query(C.projects(),orderBy('updatedAt','desc')),snap=>{
    const list=snap.docs.map(d=>({id:d.id,name:d.data().name}));const cur=selP.value&&selP.value!=='+'?selP.value:last.p;
    selP.innerHTML=opts(list,cur,t('newP'));onP();});
  function onP(){$('#tlcPn').hidden=selP.value!=='+';if(unsubS){unsubS();unsubS=null;}
    if(selP.value==='+'){selS.innerHTML=opts([],null,t('newS'));onS();return;}
    unsubS=onSnapshot(query(C.sites(selP.value),orderBy('updatedAt','desc')),snap=>{
      const list=snap.docs.map(d=>({id:d.id,name:d.data().name}));const cur=selS.value&&selS.value!=='+'?selS.value:last.s;selS.innerHTML=opts(list,cur,t('newS'));onS();});}
  function onS(){$('#tlcSn').hidden=selS.value!=='+';}
  selP.onchange=()=>{selS.value='';onP();};selS.onchange=onS;
  $('#tlcPh').onchange=async e=>{for(const f of [...e.target.files].slice(0,3-photos.length))photos.push(await compress(f));
    $('#tlcTh').innerHTML=photos.map(p=>`<img src="${p}" alt="">`).join('');e.target.value='';};
  const stop=()=>{unsubP();if(unsubS)unsubS();};
  new MutationObserver((m,o)=>{if(!sh.isConnected){stop();o.disconnect();}}).observe(document.body,{childList:true});
  $('#tlcGo').onclick=()=>{
    let pid=selP.value,sid=selS.value;const pn=$('#tlcPn').value.trim(),sn=$('#tlcSn').value.trim();
    if(!pid||(pid==='+'&&!pn)||!sid||(sid==='+'&&!sn)){$('#tlcMsg').innerHTML=`<div class="msg bad">${esc(t('needPS'))}</div>`;return;}
    if(pid==='+')pid=ensureProject(pn);
    if(sid==='+')sid=ensureSite(pid,sn);
    ls.set('tlc_last',JSON.stringify({p:pid,s:sid}));
    const run={tool:id,toolName:toolName(id),ver:toolVer(),data:JSON.stringify(data),summary:summaryText(),tag:$('#tlcTag').value.trim().slice(0,120),note:$('#tlcNote').value.trim().slice(0,2000)};
    afterCommit(writeRun(pid,sid,run,photos));stop();close();
  };
}

async function restore(path){  // ?run=pid/sid/rid on a tool page
  const [pid,sid,rid]=path.split('/');
  try{const r=await getDoc(doc(C.runs(pid,sid),rid));if(!r.exists())throw new Error('missing');
    const d=r.data(),data=JSON.parse(d.data||'{}');Object.keys(data).forEach(k=>ls.set(k,data[k]));
    let w=fmt(d.clientAt);try{const s=await getDoc(doc(C.sites(pid),sid)),p=await getDoc(doc(C.projects(),pid));w=(p.data()?.name||'')+' › '+(s.data()?.name||'')+(d.tag?' · '+d.tag:'')+' · '+w;}catch(e){}
    ls.set('tlc_last',JSON.stringify({p:pid,s:sid}));
    try{sessionStorage.setItem('tlc_opened',w);}catch(e){}
    const u=new URL(location.href);u.searchParams.delete('run');location.replace(u.href);
  }catch(e){toast(t('openErr'));}
}

function toolPage(id){
  const b=document.createElement('button');b.type='button';b.className='tlc-fab';
  const paint=()=>{b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/></svg><span>'+esc(t('save'))+'</span>';};
  paint();b.onclick=()=>saveSheet(id);document.body.appendChild(b);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  let w=null;try{w=sessionStorage.getItem('tlc_opened');sessionStorage.removeItem('tlc_opened');}catch(e){}
  if(w){const ban=document.createElement('div');ban.className='tlc-ban';ban.textContent=t('opened',{w});document.body.prepend(ban);}
  const run=new URLSearchParams(location.search).get('run');
  if(run)onReady(()=>{if(user)restore(run);else saveSheet(id);});
}

/* ---------- app home: account + projects ---------- */
let view={k:'projects'},unsub=[];
function stopAll(){unsub.forEach(f=>f());unsub=[];}
function homePage(box){
  box.hidden=false;box.classList.add('card','tlc');
  const render=()=>{stopAll();
    if(!user){box.innerHTML=`<div class="tlc-hd"><h3>${esc(t('cloudT'))}</h3></div><p class="mu">${esc(t('cloudP'))}</p><button class="gg" type="button" data-act="google">${G_ICON}<span>${esc(t('google'))}</span></button><p class="mu">${esc(t('needNet'))}</p>`;wireSign(box);return;}
    const head=`<div class="row" style="justify-content:space-between"><div class="row" style="min-width:0">${user.photoURL?`<img class="tlc-av" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`:''}
      <div style="min-width:0"><b>${esc(t('cloudT'))}</b><p class="mu">${esc(user.displayName||user.email||'')}</p></div></div><button type="button" data-act="acc">${esc(t('account'))}</button></div><div id="tlcMig"></div><div id="tlcView"></div>`;
    box.innerHTML=head;box.querySelector('[data-act=acc]').onclick=accountSheet;migrateOffer(box.querySelector('#tlcMig'));draw();
  };
  const go=v=>{view=v;draw();};
  function draw(){stopAll();const el=box.querySelector('#tlcView');if(!el)return;
    if(view.k==='projects'){
      el.innerHTML=`<div class="row"><input id="tlcNewP" placeholder="${esc(t('pName'))}" maxlength="120" style="flex:1"><button type="button" id="tlcAddP">${esc(t('newP'))}</button></div><div class="tlc-list" id="tlcL"></div>`;
      el.querySelector('#tlcAddP').onclick=()=>{const n=el.querySelector('#tlcNewP').value.trim();if(n){ensureProject(n);el.querySelector('#tlcNewP').value='';}};
      unsub.push(onSnapshot(query(C.projects(),orderBy('updatedAt','desc')),snap=>{
        const L=el.querySelector('#tlcL');if(!L)return;
        L.innerHTML=snap.empty?`<p class="mu">${esc(t('noProj'))}</p>`:snap.docs.map(d=>{const x=d.data({serverTimestamps:'estimate'});
          return `<button class="tlc-it" type="button" data-p="${esc(d.id)}"><b>${esc(x.name)}</b><span class="mu">${x.updatedAt?esc(fmt(x.updatedAt.toMillis())):''}${d.metadata.hasPendingWrites?' · <span class="tlc-pill">'+esc(t('pend'))+'</span>':''}</span></button>`;}).join('');
        L.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>go({k:'project',pid:b.dataset.p,pn:b.querySelector('b').textContent}));},{includeMetadataChanges:true}));
    }else if(view.k==='project'){
      el.innerHTML=crumb([[t('cloudT'),{k:'projects'}],[view.pn]])+`<div class="row"><input id="tlcNewS" placeholder="${esc(t('sName'))}" maxlength="120" style="flex:1"><button type="button" id="tlcAddS">${esc(t('newS'))}</button></div>
        <div class="tlc-list" id="tlcL"></div><div class="row"><button type="button" id="tlcRen">${esc(t('rename'))}</button><button type="button" class="dng" id="tlcDel">${esc(t('del'))}</button></div>`;
      wireCrumb(el,go);
      el.querySelector('#tlcAddS').onclick=()=>{const n=el.querySelector('#tlcNewS').value.trim();if(n){ensureSite(view.pid,n);setDoc(doc(C.projects(),view.pid),{updatedAt:serverTimestamp()},{merge:true}).catch(()=>{});el.querySelector('#tlcNewS').value='';}};
      el.querySelector('#tlcRen').onclick=()=>{const n=prompt(t('rename'),view.pn);if(n&&n.trim()){setDoc(doc(C.projects(),view.pid),{name:n.trim().slice(0,120),updatedAt:serverTimestamp()},{merge:true}).catch(e=>toast(codeMsg(e)));view.pn=n.trim();draw();}};
      arm(el.querySelector('#tlcDel'),t('delQ',{n:view.pn}),async()=>{await delProject(view.pid);go({k:'projects'});});
      unsub.push(onSnapshot(query(C.sites(view.pid),orderBy('updatedAt','desc')),snap=>{
        const L=el.querySelector('#tlcL');if(!L)return;
        L.innerHTML=snap.empty?`<p class="mu">${esc(t('noSite'))}</p>`:snap.docs.map(d=>{const x=d.data({serverTimestamps:'estimate'});
          return `<button class="tlc-it" type="button" data-s="${esc(d.id)}"><b>${esc(x.name)}</b><span class="mu">${x.lastTool?esc(toolName(x.lastTool))+' · ':''}${x.updatedAt?esc(fmt(x.updatedAt.toMillis())):''}${d.metadata.hasPendingWrites?' · <span class="tlc-pill">'+esc(t('pend'))+'</span>':''}</span></button>`;}).join('');
        L.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>go({k:'site',pid:view.pid,pn:view.pn,sid:b.dataset.s,sn:b.querySelector('b').textContent}));},{includeMetadataChanges:true}));
    }else if(view.k==='site'){
      el.innerHTML=crumb([[t('cloudT'),{k:'projects'}],[view.pn,{k:'project',pid:view.pid,pn:view.pn}],[view.sn]])+`<div class="tlc-list" id="tlcL"></div>
        <div class="row"><button type="button" id="tlcRen">${esc(t('rename'))}</button><button type="button" class="dng" id="tlcDel">${esc(t('del'))}</button></div>`;
      wireCrumb(el,go);
      el.querySelector('#tlcRen').onclick=()=>{const n=prompt(t('rename'),view.sn);if(n&&n.trim()){setDoc(doc(C.sites(view.pid),view.sid),{name:n.trim().slice(0,120),updatedAt:serverTimestamp()},{merge:true}).catch(e=>toast(codeMsg(e)));view.sn=n.trim();draw();}};
      arm(el.querySelector('#tlcDel'),t('delQ',{n:view.sn}),async()=>{await delSite(view.pid,view.sid);go({k:'project',pid:view.pid,pn:view.pn});});
      unsub.push(onSnapshot(query(C.runs(view.pid,view.sid),orderBy('clientAt','desc'),limit(200)),snap=>{
        const L=el.querySelector('#tlcL');if(!L)return;const runs=snap.docs.map(d=>Object.assign({id:d.id,pend:d.metadata.hasPendingWrites},d.data()));
        L.innerHTML=runs.length?runs.map((r,i)=>{const prev=runs.slice(i+1).find(x=>x.tool===r.tool);
          return `<div class="tlc-it"><b>${esc(toolName(r.tool))}${r.tag?' · '+esc(r.tag):''}</b><span class="mu">${esc(fmt(r.clientAt))}${r.photos?' · '+esc(t('photosN',{n:r.photos})):''}${r.pend?' · <span class="tlc-pill">'+esc(t('pend'))+'</span>':''}</span>
            ${r.note?`<span>${esc(r.note)}</span>`:''}<div class="row">${TOOLS[r.tool]?`<a href="${esc(ROOT+TOOLS[r.tool].p)}?app=1&run=${encodeURIComponent(view.pid+'/'+view.sid+'/'+r.id)}"><button type="button" class="pri">${esc(t('open'))}</button></a>`:''}
            ${prev?`<button type="button" data-cmp="${esc(r.id)}|${esc(prev.id)}">${esc(t('cmp'))}</button>`:''}${r.photos?`<button type="button" data-ph="${esc(r.id)}">${esc(t('photosN',{n:r.photos}))}</button>`:''}
            <button type="button" class="dng" data-del="${esc(r.id)}">${esc(t('del'))}</button></div></div>`;}).join(''):`<p class="mu">${esc(t('noRun'))}</p>`;
        const byId=Object.fromEntries(runs.map(r=>[r.id,r]));
        L.querySelectorAll('[data-cmp]').forEach(b=>b.onclick=()=>{const [a,p]=b.dataset.cmp.split('|');compare(byId[p],byId[a]);});
        L.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>showPhotos(view.pid,view.sid,b.dataset.ph));
        L.querySelectorAll('[data-del]').forEach(b=>arm(b,t('delQ',{n:toolName(byId[b.dataset.del].tool)}),()=>delRun(view.pid,view.sid,b.dataset.del)));
      },{includeMetadataChanges:true}));
    }
  }
  onUser(render);
  new MutationObserver(()=>user?draw():render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
function crumb(parts){return `<div class="crumb">${parts.map((p,i)=>p[1]?`<a href="#" data-go='${esc(JSON.stringify(p[1]))}'>${esc(p[0])}</a> ›`:`<b>${esc(p[0])}</b>`).join(' ')}</div>`;}
function wireCrumb(el,go){el.querySelectorAll('[data-go]').forEach(a=>a.onclick=e=>{e.preventDefault();go(JSON.parse(a.dataset.go));});}

/* flatten a run's saved inputs (localStorage JSON strings) into field -> value */
function flat(run){const out={};let data={};try{data=JSON.parse(run.data||'{}');}catch(e){}
  const walk=(o,p)=>{if(o&&typeof o==='object'&&!Array.isArray(o)){for(const k in o)walk(o[k],p?p+'.'+k:k);}else out[p]=Array.isArray(o)?JSON.stringify(o):String(o);};
  for(const k in data){let v=data[k];try{v=JSON.parse(v);}catch(e){}walk(v,'');}return out;}
function compare(a,b){const A=flat(a),B=flat(b),keys=[...new Set([...Object.keys(A),...Object.keys(B)])].filter(k=>A[k]!==B[k]).sort();
  sheet(t('cmpT',{a:fmt(a.clientAt),b:fmt(b.clientAt)}),keys.length?`<table><tr><th>${esc(t('field'))}</th><th>${esc(t('before'))}</th><th>${esc(t('now'))}</th></tr>${keys.map(k=>`<tr><td>${esc(k)}</td><td>${esc(A[k]??'—')}</td><td><b>${esc(B[k]??'—')}</b></td></tr>`).join('')}</table>`:`<p class="mu">${esc(t('same'))}</p>`);}
async function showPhotos(pid,sid,rid){try{const s=await getDocs(C.photos(pid,sid,rid));
  sheet(t('photosN',{n:s.size}),`<div style="display:grid;gap:8px">${s.docs.map(d=>`<img src="${d.data().img}" alt="" style="width:100%;border-radius:10px">`).join('')}</div>`);}catch(e){toast(codeMsg(e));}}

/* deletes (client side, children first) */
async function delRun(pid,sid,rid){try{const b=writeBatch(db);(await getDocs(C.photos(pid,sid,rid))).forEach(d=>b.delete(d.ref));b.delete(doc(C.runs(pid,sid),rid));b.commit().catch(e=>toast(codeMsg(e)));}catch(e){toast(codeMsg(e));}}
async function delSite(pid,sid){for(const r of (await getDocs(C.runs(pid,sid))).docs)await delRun(pid,sid,r.id);writeBatch(db).delete(doc(C.sites(pid),sid)).commit().catch(e=>toast(codeMsg(e)));}
async function delProject(pid){for(const s of (await getDocs(C.sites(pid))).docs)await delSite(pid,s.id);writeBatch(db).delete(doc(C.projects(),pid)).commit().catch(e=>toast(codeMsg(e)));}

/* move this phone's pre-sign-in tool data into the account, once per device and account */
function migrateOffer(el){
  const flag='tlc_mig_'+user.uid;if(ls.get(flag))return;
  const found=Object.keys(TOOLS).map(id=>[id,snapshot(id)]).filter(x=>x[1]);if(!found.length){ls.set(flag,'none');return;}
  el.innerHTML=`<div class="msg"><b>${esc(t('migT'))}</b><p class="mu" style="margin:4px 0 8px">${esc(t('migP',{n:found.length}))}</p><div class="row"><button class="pri" type="button" id="tlcMy">${esc(t('migDo'))}</button><button type="button" id="tlcMn">${esc(t('migNo'))}</button></div></div>`;
  el.querySelector('#tlcMn').onclick=()=>{ls.set(flag,'no');el.innerHTML='';};
  el.querySelector('#tlcMy').onclick=()=>{
    const pid=ensureProject(t('migProj')),sid=ensureSite(pid,t('migSite',{d:new Date().toLocaleDateString(lang()==='ar'?'ar-EG':'en-GB')}));
    const ps=found.map(([id,data])=>writeRun(pid,sid,{tool:id,toolName:toolName(id),ver:'',data:JSON.stringify(data),summary:'',tag:'',note:''},[]));
    ls.set(flag,'done');el.innerHTML=`<div class="msg ok">${esc(t('migDone'))}</div>`;Promise.all(ps).catch(e=>toast(codeMsg(e)));
  };
}

async function accountSheet(){
  let prof={};try{prof=(await getDoc(C.user())).data()||{};}catch(e){}
  const sh=sheet(t('account'),`<div class="row">${user.photoURL?`<img class="tlc-av" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`:''}<div><b>${esc(user.displayName||'')}</b><p class="mu">${esc(user.email||'')}</p></div></div>
    <label>${esc(t('name'))}<input id="tlcAn" maxlength="120" value="${esc(prof.name||user.displayName||'')}"></label>
    <label>${esc(t('company'))}<input id="tlcAc" maxlength="120" value="${esc(prof.company||'')}"></label>
    <label>${esc(t('lang'))}<select id="tlcAl"><option value="ar">عربي</option><option value="en">English</option></select></label>
    <div class="row"><button class="pri" type="button" id="tlcAs">${esc(t('saveAcc'))}</button><button type="button" id="tlcEx">${esc(t('export'))}</button></div>
    <p class="mu">${esc(t('outP'))}</p><div class="row"><button type="button" id="tlcOut">${esc(t('out'))}</button><button type="button" class="dng" id="tlcDelA">${esc(t('delAcc'))}</button></div>`);
  const $=s=>sh.querySelector(s);$('#tlcAl').value=prof.lang||lang();
  $('#tlcAs').onclick=()=>{const l=$('#tlcAl').value;
    setDoc(C.user(),{name:$('#tlcAn').value.trim().slice(0,120),company:$('#tlcAc').value.trim().slice(0,120),lang:l},{merge:true}).catch(e=>toast(codeMsg(e)));
    if(window.TL&&TL.setLang)TL.setLang(l);else ls.set('tl_lang',l);toast(t('accSaved'));close();};
  $('#tlcEx').onclick=exportAll;$('#tlcOut').onclick=doSignOut;
  arm($('#tlcDelA'),t('delAccQ'),async()=>{
    try{for(const p of (await getDocs(C.projects())).docs)await delProject(p.id);await writeBatch(db).delete(C.user()).commit();await waitForPendingWrites(db);
      await deleteUser(user);try{await terminate(db);await clearIndexedDbPersistence(db);}catch(e){}toast(t('delAccDone'));setTimeout(()=>location.reload(),900);}
    catch(e){toast(e.code==='auth/requires-recent-login'?t('reauth'):codeMsg(e));}});
}
async function exportAll(){
  try{const out={user:{uid:user.uid,email:user.email,name:user.displayName},exportedAt:new Date().toISOString(),projects:[]};
    for(const p of (await getDocs(C.projects())).docs){const P=Object.assign({id:p.id},p.data(),{sites:[]});
      for(const s of (await getDocs(C.sites(p.id))).docs){const S=Object.assign({id:s.id},s.data(),{runs:[]});
        for(const r of (await getDocs(C.runs(p.id,s.id))).docs)S.runs.push(Object.assign({id:r.id},r.data()));P.sites.push(S);}
      out.projects.push(P);}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
    a.download='trueloop-field-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();}
  catch(e){toast(codeMsg(e));}
}

/* ---------- auth state ---------- */
const waiters=[],userCbs=[];
function onReady(f){ready?f():waiters.push(f);}
function onUser(f){userCbs.push(f);if(ready)f();}
onAuthStateChanged(auth,u=>{
  user=u;
  if(u){const k='tlc_seen_'+u.uid;let seen=null;try{seen=sessionStorage.getItem(k);sessionStorage.setItem(k,'1');}catch(e){}
    if(!seen)setDoc(C.user(),{name:u.displayName||'',email:u.email||'',photo:u.photoURL||'',lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});}
  if(!ready){ready=true;waiters.splice(0).forEach(f=>f());}
  userCbs.forEach(f=>f());
});

/* ---------- start ---------- */
const box=document.getElementById('cloud');
if(box)homePage(box);
else{const id=currentTool();if(id)toolPage(id);}
window.TLC={signIn,signOut:doSignOut,get user(){return user;}};
