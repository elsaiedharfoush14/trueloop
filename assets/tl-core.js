/* TrueLoop field app — shared runtime for tools: language, rendering helpers, storage, pipe sizing, offline, auto-update. */
(function(w){
  var MARK='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+
    '<linearGradient id="gDrop" x1="25" y1="85" x2="72" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1268d3"/><stop offset=".5" stop-color="#16b9e0"/><stop offset=".78" stop-color="#16b9e0"/><stop offset="1" stop-color="#ffb21e"/></linearGradient>'+
    '<linearGradient id="gBolt" x1="66" y1="2" x2="66" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe066"/><stop offset=".55" stop-color="#ffb21e"/><stop offset="1" stop-color="#ff8a00"/></linearGradient>'+
    '<symbol id="mark" viewBox="0 -4 100 104"><path d="M50 9 C50 9 21 43 21 61 A29 29 0 0 0 79 61 C79 55 77 49 74 44" fill="none" stroke="url(#gDrop)" stroke-width="7" stroke-linecap="round"/>'+
    '<path d="M70 2 L54 26 L64 26 L58 44 L80 18 L69 18 L76 2 Z" fill="url(#gBolt)" stroke="#ff9f0a" stroke-width="1.5" stroke-linejoin="round"/>'+
    '<path d="M37.3 62.3 L45 70 L59.7 55.3" fill="none" stroke="#1db57a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+
    '<circle cx="33" cy="58" r="4.5" fill="none" stroke="#1db57a" stroke-width="3"/><circle cx="64" cy="51" r="4.5" fill="none" stroke="#1db57a" stroke-width="3"/></symbol></defs></svg>';

  var COMMON={
    ar:{copy:'نسخ الملخص',copied:'اتنسخ',copyFallback:'اختار النص وانسخه',reset:'جديد',resetConfirm:'اضغط تاني للمسح',print:'تقرير PDF',
      back:'← TrueLoop · الرئيسية',backApp:'← TrueLoop · كل الأدوات',brandSub:'أدوات هندسية مجانية',updating:'فيه نسخة جديدة، بيتحدث…',offline:'من غير نت',
      shareT:'شارك الأداة',shareP:'امسح الباركود من موبايل تاني، أو ابعت اللينك. التطبيق بيتسطّب ويشتغل من غير نت.',copyLink:'نسخ اللينك',linkCopied:'اللينك اتنسخ',
      installHow:'<b>آيفون:</b> Safari ← زرار المشاركة ← Add to Home Screen<br><b>أندرويد:</b> Chrome ← ⋮ ← Install app',
      ctaT:'تشغيل محطات المياه من غير تخمين.',ctaP:'TrueLoop بتعمل تشغيل ومعايرة في الموقع: فلوميترات، أجهزة تحليل، درايفات، وأنظمة تعقيم.',city:'الرياض، السعودية',
      thMenu:'المنيو',thCode:'الكود',thName:'الاسم',thVal:'القيمة',thWhy:'ليه',thSet:'الإعداد',thWhen:'إمتى',thWhat:'تعمل إيه',thSign:'العَرَض',thCause:'السبب الغالب',thDo:'تعمل إيه',
      repLine:'تقرير · {s} · {d}'},
    en:{copy:'Copy summary',copied:'Copied',copyFallback:'Select the text and copy it',reset:'New',resetConfirm:'Tap again to clear',print:'PDF report',
      back:'← TrueLoop · home',backApp:'← TrueLoop · all tools',brandSub:'free engineering tools',updating:'New version, updating…',offline:'Offline',
      shareT:'Share this tool',shareP:'Scan from another phone or send the link. The app installs and works offline.',copyLink:'Copy link',linkCopied:'Link copied',
      installHow:'<b>iPhone:</b> Safari → Share → Add to Home Screen<br><b>Android:</b> Chrome → ⋮ → Install app',
      ctaT:'Water plant commissioning without guesswork.',ctaP:'TrueLoop commissions and calibrates on site: flowmeters, analysers, drives and disinfection systems.',city:'Riyadh, Saudi Arabia',
      thMenu:'Menu',thCode:'Code',thName:'Name',thVal:'Value',thWhy:'Why',thSet:'Setting',thWhen:'When',thWhat:'What to do',thSign:'Symptom',thCause:'Likely cause',thDo:'Action',
      repLine:'Report · {s} · {d}'}
  };

  var TL={lang:'ar',dict:null,_onLang:null};
  TL.$=function(id){return document.getElementById(id);};
  TL.num=function(id){var x=parseFloat(TL.$(id).value);return isNaN(x)?null:x;};
  TL.esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  TL.t=function(k,v){var d=TL.dict[TL.lang]||{},a=TL.dict.ar||{};var s=(d[k]!=null?d[k]:a[k]);if(s==null)s=k;if(v)Object.keys(v).forEach(function(n){s=String(s).split('{'+n+'}').join(v[n]);});return s;};
  TL.msg=function(el,items){el.innerHTML=(items||[]).map(function(m){return '<div class="msg '+m[0]+'">'+TL.esc(m[1])+'</div>';}).join('');};
  var AR=/[؀-ۿ]/;
  function cell(x){return '<td class="'+(AR.test(String(x))?'tx':'v')+'">'+TL.esc(x)+'</td>';}
  TL.rows=function(rows,cols){cols=cols||3;return rows.map(function(r){
    if(r[0]==='§')return '<tr class="grp"><td colspan="'+cols+'">'+TL.esc(r[1])+'</td></tr>';
    var cls=r[cols]?' class="key"':'',out='<tr'+cls+'>';for(var i=0;i<cols;i++)out+=(i<cols-1?cell(r[i]):'<td>'+TL.esc(r[i])+'</td>');return out+'</tr>';}).join('');};
  TL.worst=function(items){var o={ok:1,warn:2,bad:3},w='';(items||[]).forEach(function(m){if(m&&(!w||o[m[0]]>o[w]))w=m[0];});return w;};
  TL.prog=function(n,state){var a=TL.$('pg'+n);if(a)a.className=state||'';};
  TL.toast=function(s){var el=TL.$('toast');if(!el)return;el.textContent=s;clearTimeout(TL._tt);TL._tt=setTimeout(function(){el.textContent='';},2200);};
  TL.copy=function(text,ok,selectEl){
    var fail=function(){if(selectEl)selectEl.select();TL.toast(TL.t('copyFallback'));};
    try{navigator.clipboard.writeText(text).then(function(){TL.toast(ok||TL.t('copied'));},fail);}catch(e){fail();}
  };
  TL.store=function(key,fields){return {
    save:function(extra){try{var d={};fields.forEach(function(f){var el=TL.$(f);if(el)d[f]=el.type==='checkbox'?el.checked:el.value;});if(extra)d._x=extra;localStorage.setItem(key,JSON.stringify(d));}catch(e){}},
    load:function(){try{var d=JSON.parse(localStorage.getItem(key)||'null');if(!d)return null;fields.forEach(function(f){var el=TL.$(f);if(el&&d[f]!==undefined){if(el.type==='checkbox')el.checked=!!d[f];else el.value=d[f];}});return d._x||null;}catch(e){return null;}},
    clear:function(){try{localStorage.removeItem(key);}catch(e){}}
  };};

  TL.applyLang=function(){
    var h=document.documentElement;h.lang=TL.lang;h.dir=TL.lang==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-t]').forEach(function(el){var v=TL.t(el.getAttribute('data-t'));if(el.hasAttribute('data-html'))el.innerHTML=v;else el.textContent=v;});
    document.querySelectorAll('[data-tp]').forEach(function(el){el.setAttribute('placeholder',TL.t(el.getAttribute('data-tp')));});
    var a=TL.$('lnAr'),e=TL.$('lnEn');if(a)a.setAttribute('aria-pressed',TL.lang==='ar');if(e)e.setAttribute('aria-pressed',TL.lang==='en');
    if(TL.title)document.title='TrueLoop · '+TL.t(TL.title);
    TL.back();
    if(TL._onLang)TL._onLang();
  };
  TL.setLang=function(l){TL.lang=l;try{localStorage.setItem('tl_lang',l);}catch(e){}TL.applyLang();};

  /* Inside the installed app, "back" goes to the app home; on the website it goes to the site. */
  TL.inApp=function(){var m=false;try{m=w.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||sessionStorage.getItem('tl_app')==='1'||/[?&]app=1/.test(location.search);if(m)sessionStorage.setItem('tl_app','1');}catch(e){}return m;};
  TL.back=function(){var app=TL.inApp(),b=TL.$('backLink');if(b){b.href=TL.root+(app?'app/':'');b.textContent=TL.t(app?'backApp':'back');}var h=TL.$('homeLink');if(h)h.href=TL.root+'app/';};

  TL.update=function(ver){
    TL.ver=ver;
    function check(){
      if(location.protocol!=='https:')return;
      fetch(TL.root+'app/version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        if(!j||!j.v||j.v===ver)return;
        var k='tl_upd_'+j.v;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');}catch(e){}
        TL.toast(TL.t('updating'));
        Promise.resolve(TL.reg&&TL.reg.update()).catch(function(){}).then(function(){setTimeout(function(){location.reload();},700);});
      }).catch(function(){});
    }
    check();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check();});
  };
  TL.offline=function(){var el=TL.$('offBadge');if(!el)return;var f=function(){el.hidden=navigator.onLine!==false;el.textContent=TL.t('offline');};f();w.addEventListener('online',f);w.addEventListener('offline',f);};

  /* opts: {root:'../../', dict:{ar,en}, title:'key', ver:'x', onLang:fn} */
  TL.init=function(opts){
    TL.root=opts.root||'../../';TL.title=opts.title;TL._onLang=opts.onLang;
    TL.dict={ar:Object.assign({},COMMON.ar,opts.dict.ar),en:Object.assign({},COMMON.en,opts.dict.en)};
    document.body.insertAdjacentHTML('afterbegin',MARK);
    var saved=null;try{saved=localStorage.getItem('tl_lang');}catch(e){}
    TL.lang=saved||((navigator.language||'').slice(0,2)==='en'?'en':'ar');if(!TL.dict[TL.lang])TL.lang='ar';
    var a=TL.$('lnAr'),e=TL.$('lnEn');if(a)a.onclick=function(){TL.setLang('ar');};if(e)e.onclick=function(){TL.setLang('en');};
    if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register(TL.root+'sw.js',{scope:TL.root}).then(function(r){TL.reg=r;}).catch(function(){});
    try{var rec=JSON.parse(localStorage.getItem('tl_recent')||'[]');var id=opts.id||location.pathname;rec=rec.filter(function(x){return x!==id;});rec.unshift(id);localStorage.setItem('tl_recent',JSON.stringify(rec.slice(0,6)));}catch(e2){}
    TL.offline();
    if(opts.ver)TL.update(opts.ver);
    if(TL.beta())TL.cloud();
  };

  /* TrueLoop Field cloud (phase 1, beta): Google sign-in + projects/sites + sync, in assets/tl-cloud.js.
     Loaded only while the beta flag is on: ?beta=1 / ?beta=0, or TL.beta(true/false) (5 taps on the version in the app home). */
  TL.beta=function(on){try{var q=location.search.match(/[?&]beta=([01])/);if(q)localStorage.setItem('tl_beta',q[1]);
    if(on!==undefined)localStorage.setItem('tl_beta',on?'1':'0');return localStorage.getItem('tl_beta')==='1';}catch(e){return false;}};
  TL.cloud=function(){if(TL._cl)return;TL._cl=1;var s=document.createElement('script');s.type='module';s.src=TL.root+'assets/tl-cloud.js';document.head.appendChild(s);};

  /* ---------- pipe sizing shared by the flowmeter tools ---------- */
  var STEEL=[['1/2"',21.3,2.11,2.77,3.73],['3/4"',26.7,2.11,2.87,3.91],['1"',33.4,2.77,3.38,4.55],['1-1/4"',42.2,2.77,3.56,4.85],
    ['1-1/2"',48.3,2.77,3.68,5.08],['2"',60.3,2.77,3.91,5.54],['2-1/2"',73.0,3.05,5.16,7.01],['3"',88.9,3.05,5.49,7.62],
    ['4"',114.3,3.05,6.02,8.56],['5"',141.3,3.40,6.55,9.53],['6"',168.3,3.40,7.11,10.97],['8"',219.1,3.76,8.18,12.70],
    ['10"',273.0,4.19,9.27,15.09],['12"',323.8,4.57,10.31,17.48],['14"',355.6,4.78,11.13,19.05],['16"',406.4,4.78,12.70,21.44],
    ['18"',457.0,4.78,14.27,23.83],['20"',508.0,5.54,15.09,26.19],['24"',610.0,6.35,17.48,30.96]];
  var PE_OD=[20,25,32,40,50,63,75,90,110,125,140,160,180,200,225,250,280,315,355,400,450,500,560,630,710,800];
  var PE_WALL={'280|11':25.4};
  var PPR_OD=[20,25,32,40,50,63,75,90,110,125,160];
  var PVC_OD=[20,25,32,40,50,63,75,90,110,125,140,160,200,225,250,315,355,400];
  var CU_OD=[15,22,28,35,42,54,67,76.1,108];
  function nearest(list,v){var b=list[0];list.forEach(function(x){if(Math.abs(x-v)<Math.abs(b-v))b=x;});return b;}
  function r1(x){return Math.round(x*10)/10;}
  TL.r1=r1;
  TL.pipe={
    M14:{cs:'0. Carbon Steel',ss:'1. Stainless Steel',ci:'2. Cast Iron',di:'3. Ductile Iron',cu:'4. Copper',pvc:'5. PVC',hdpe:'9. Other',ppr:'9. Other'},
    SOUND:{hdpe:2400,ppr:2600},
    sizeFromCirc:function(mat,circCm,opt){
      if(!(circCm>0))return null;
      var od=circCm*10/Math.PI,res;
      if(mat==='cs'||mat==='ss'){var row=STEEL[0];STEEL.forEach(function(r){if(Math.abs(r[1]-od)<Math.abs(row[1]-od))row=r;});
        res={od:row[1],wall:row[{'10':2,'40':3,'80':4}[opt.sch]||3],label:row[0]+' Sch '+opt.sch};}
      else if(mat==='hdpe'){var o=nearest(PE_OD,od);res={od:o,wall:PE_WALL[o+'|'+opt.pn]||r1(o/opt.pn),label:'PE100 '+o+' SDR'+opt.pn};}
      else if(mat==='ppr'){var p=nearest(PPR_OD,od);res={od:p,wall:r1(p/opt.sdr),label:'PP-R '+p+' SDR'+opt.sdr};}
      else if(mat==='pvc')res={od:nearest(PVC_OD,od),wall:null,label:'PVC'};
      else if(mat==='cu')res={od:nearest(CU_OD,od),wall:null,label:'Copper'};
      else res={od:r1(od),wall:null,label:''};
      res.measured=r1(od);res.diffPct=Math.abs(res.od-od)/res.od*100;return res;
    },
    perMs:function(id){return Math.PI*Math.pow(id/1000,2)/4*60000;}, // L/min at 1 m/s
    transducer:function(od){ // manual: TS-2 DN25-100, TM-1 DN50-700, TL-1 DN300-6000
      if(od<60)return 'TS-2';if(od<=114.3)return 'TS-2 / TM-1';if(od<=320)return 'TM-1';if(od<=711)return 'TM-1 / TL-1';return 'TL-1';}
  };
  w.TL=TL;
})(window);
