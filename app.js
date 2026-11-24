'use strict';
const $=id=>document.getElementById(id);
const GN=window.GN||null;
const ART=window.ART||null;
const J=(s,d)=>{try{return JSON.parse(s)}catch(e){return d}};
let state={},sig={},myLoc=null,heading=null,beaconOn=false,setupFilled=false;

/* ---------- gauges ---------- */
function buildBars(el){el.innerHTML='';for(let i=0;i<5;i++){const b=document.createElement('i');b.style.height=(7+i*5.5)+'px';el.appendChild(b)}}
buildBars($('bars4'));buildBars($('bars2'));
function words(level,has){if(!has)return'لا قياس الآن';return['شبه معدوم','ضعيف','متوسط','جيد','ممتاز'][level]||'—'}
// 1.84: the age label tells the truth — «فوري» only while the snapshot is
// genuinely fresh (<=30s); after that it is «آخر قياس» with minutes.
function freshTxt(sec){
  if(typeof sec!=='number'||sec<0)return'';
  if(sec<=30)return' • قياس فوري قبل '+sec+' ث';
  if(sec<120)return' • آخر قياس قبل '+sec+' ث';
  return' • آخر قياس قبل '+Math.round(sec/60)+' د';
}
/* 1.83 (Hilal: bars that mirror the phone + honest words): the level is no
   longer Samsung's getLevel() — at -123 dBm it reported 0 while the phone
   showed bars and service worked, so the meter showed all-dim bars and the
   word «شبه معدوم». Our own ladder from the dBm number now drives the green
   bars and the word together, per technology. */
function lvlFor(tech,dbm){
  if(tech==='gsm')return dbm>=-77?4:dbm>=-87?3:dbm>=-97?2:dbm>=-107?1:0;
  if(tech==='wcdma')return dbm>=-85?4:dbm>=-95?3:dbm>=-105?2:dbm>=-115?1:0;
  return dbm>=-95?4:dbm>=-105?3:dbm>=-115?2:dbm>=-127?1:0; // lte + nr (RSRP scale)
}
function gauge(net,obj,otherHas,otherName,tech){
  const bars=$(net==='lte'?'bars4':'bars2'),dbm=$(net==='lte'?'dbm4':'dbm2'),lab=$(net==='lte'?'lab4':'lab2');
  const has=obj&&typeof obj.dbm==='number';
  const lvl=has?lvlFor(tech||(net==='lte'?'lte':'gsm'),obj.dbm):-1;
  [...bars.children].forEach((b,i)=>b.className=has&&i<lvl+1?'on':'');
  dbm.textContent=has?(obj.dbm+' dBm'):'—';
  // One SIM camps on one generation at a time: when the other generation is the
  // camped one, say so instead of a bare "no measurement" (1.35).
  lab.textContent=has?words(lvl,true):(otherHas?('هاتفك على '+otherName+' الآن'):'لا قياس الآن');
}

/* ---------- geo helpers ---------- */
function hav(a,b,c,d){const R=6371000,t=Math.PI/180;const x=(c-a)*t,y=(d-b)*t;const h=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function brg(a,b,c,d){const t=Math.PI/180;const y=Math.sin((d-b)*t)*Math.cos(c*t);const x=Math.cos(a*t)*Math.sin(c*t)-Math.sin(a*t)*Math.cos(c*t)*Math.cos((d-b)*t);return (Math.atan2(y,x)/t+360)%360}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' كم':Math.round(m)+' م'}
function chipDist(m){return m<1000?Math.round(m/5)*5+' م':(m<10000?(m/1000).toFixed(2)+' كم':fmtDist(m))}

/* ---------- places & arrow ---------- */
function renderHome(){
  const pl=state.places||[];const hp=$('homePlaces');
  if(hp){
    if(!pl.length)hp.innerHTML='<p class="dim">لا أماكن بعد — ثبّت أماكنك من تبويب «الأماكن» فتظهر هنا.</p>';
    else{hp.innerHTML='';pl.slice(0,3).forEach(p=>{const d=document.createElement('div');d.className='placeRow';const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';d.innerHTML='<span>📍 <b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';d.onclick=()=>openMapAt(p.lat,p.lng);hp.appendChild(d)})}
  }
  renderHomeArrow();
}
function renderHomeArrow(){
  const g=$('homeArrowGlyph'),tEl=$('homeArrowText');if(!g||!tEl)return;
  const pl=state.places||[];
  let t=null;try{t=arrowTargetObj()}catch(_){}
  if(!t&&!pl.length){g.style.opacity=.3;tEl.textContent='أضف مكانًا محفوظًا أولًا';return}
  if(startedOver){g.style.opacity=.3;tEl.textContent='بدأت من جديد — اختر مكانًا للعودة إليه';return}
  if(!myLoc){g.style.opacity=.3;tEl.textContent='بانتظار موقعك…';return}
  let name,bd,b;
  if(t){name=t.label;bd=hav(myLoc.lat,myLoc.lng,t.lat,t.lng);b=brg(myLoc.lat,myLoc.lng,t.lat,t.lng)}
  else{let best=pl[0];bd=1e18;pl.forEach(p=>{const d=hav(myLoc.lat,myLoc.lng,p.lat,p.lng);if(d<bd){bd=d;best=p}});name=best.name;b=brg(myLoc.lat,myLoc.lng,best.lat,best.lng)}
  const rel=heading==null?b:b-heading;
  g.style.opacity=1;g.style.transform='rotate('+(rel-90)+'deg)';
  tEl.textContent='العودة إلى: '+name+' • '+fmtDist(bd);
}
let _selSig='';let placeEditOpen=false;
function renderPlaces(){
  renderHome();
  if(placeEditOpen)return;
  const list=$('placesList');const pl=state.places||[];
  const sel=$('arrowTarget');
  // 1.96: rebuild the target menu ONLY when its options truly change, and
  // never while it is open — rebuilding it every refresh/location fix made
  // the open menu flicker (Hilal's report, 2026-11-23).
  const sig=pl.map(p=>p.name).join('|')+'#'+((state.whispers||[]).length?1:0);
  if(sig!==_selSig&&document.activeElement!==sel){
    _selSig=sig;
    const cur=sel.value;
    sel.innerHTML='<option value="">— اختر هدف العودة —</option>';
    pl.forEach((p,i)=>{const o=document.createElement('option');o.value='p'+i;o.textContent='📍 '+p.name;sel.appendChild(o)});
    if((state.whispers||[]).length){const o=document.createElement('option');o.value='w';o.textContent='📶 أقرب لمعة معروفة';sel.appendChild(o)}
    if(cur)sel.value=cur;
  }
  if(!pl.length){list.innerHTML='<p class="dim">لا أماكن بعد — التطبيق يبدأ فارغًا تمامًا لأي إنسان في أي بلد، وأنت تثبّت أماكنك بنفسك.</p>';return}
  list.innerHTML='';
  pl.forEach((p,i)=>{
    const d=document.createElement('div');d.className='placeRow';
    const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';
    d.innerHTML='<span><b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';
    d.onclick=e=>{if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT')return;openMapAt(p.lat,p.lng)};
    const ren=document.createElement('button');ren.textContent='تسمية';ren.className='ren';
    ren.onclick=()=>{placeEditOpen=true;
      const inp=document.createElement('input');inp.className='inp';inp.value=p.name;
      const save=document.createElement('button');save.textContent='حفظ';save.className='ren';
      d.innerHTML='';d.appendChild(inp);d.appendChild(save);inp.focus();inp.select();
      save.onclick=()=>{placeEditOpen=false;const nn=inp.value.trim();if(nn&&nn!==p.name){p.name=nn;GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;try{renderMapPlaces()}catch(_){}}renderPlaces();renderArrow()};
    };
    const del=document.createElement('button');del.textContent='حذف';
    del.onclick=()=>{pl.splice(i,1);GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;renderPlaces();renderArrow()};
    d.appendChild(ren);d.appendChild(del);list.appendChild(d);
  });
}
function arrowTargetObj(){
  const v=$('arrowTarget').value;
  if(v==='w'){
    if(!myLoc||!(state.whispers||[]).length)return null;
    let best=null,bd=1e18,near=null,nd=1e18;
    state.whispers.forEach(w=>{const d=hav(myLoc.lat,myLoc.lng,w.lat,w.lng);
      if(d<nd){nd=d;near=w}
      if(d>=30&&d<bd){bd=d;best=w}});
    const pick=best||near;
    return pick?{lat:pick.lat,lng:pick.lng,here:!best,
      label:'أقرب لمعة ('+(pick.net||'')+' '+(pick.dbm||'')+'dBm)'}:null;
  }
  if(v&&v[0]==='p'){const p=(state.places||[])[+v.slice(1)];if(p)return{lat:p.lat,lng:p.lng,label:p.name}}
  return null;
}
function renderArrow(){
  const t=arrowTargetObj(),g=$('arrowGlyph'),dEl=$('arrowDist');
  if(!t){g.style.opacity=.3;dEl.textContent='—';return}
  if(!myLoc){g.style.opacity=.3;dEl.textContent='بانتظار موقعك…';return}
  const d=hav(myLoc.lat,myLoc.lng,t.lat,t.lng),b=brg(myLoc.lat,myLoc.lng,t.lat,t.lng);
  const rel=heading==null?b:b-heading;
  g.style.opacity=1;g.style.transform='rotate('+(rel-90)+'deg)';
  dEl.textContent=t.label+' • '+(t.here?('أنت عندها الآن — على بُعد '+fmtDist(d)+' فقط'):fmtDist(d));
}
$('arrowTarget').addEventListener('change',()=>{startedOver=false;renderArrow();renderHomeArrow()});
/* Return-target two windows (1.116, Hilal's design): «البدء من جديد»
   wipes the current target and stops guidance entirely; «العودة إلى
   مكان مثبّت» unfolds the saved places — rendered live from state, so
   renamed places appear under their NEW names — and a tap makes one
   the target. The old <select> stays hidden as the value store. */
let returnListOpen=false,_retSig='',startedOver=false;
function renderReturnLists(){
  const pl=state.places||[],sel=$('arrowTarget');
  const sig=(returnListOpen?'1':'0')+'#'+(sel?sel.value:'')+'#'+pl.map(p=>p.name+'@'+(myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'')).join('|')+'#'+((state.whispers||[]).length?1:0);
  if(sig===_retSig)return;_retSig=sig;
  [$('returnList'),$('homeReturnList')].forEach(box=>{
    if(!box)return;
    box.style.display=returnListOpen?'block':'none';
    box.innerHTML='';
    if(!returnListOpen)return;
    if(!pl.length&&!(state.whispers||[]).length){box.innerHTML='<p class="dim">لا أماكن مثبّتة بعد — ثبّت مكانك أولًا من تبويب «الأماكن».</p>';return}
    const mk=(label,dist,val)=>{
      const d=document.createElement('div');d.className='placeRow retChip'+(sel&&sel.value===val?' sel':'');
      d.innerHTML='<span>'+label+' <span class="dim">'+dist+'</span></span>';
      d.onclick=()=>{if(sel)sel.value=val;startedOver=false;renderArrow();renderHomeArrow();
        if(val==='w'){const t=arrowTargetObj();if(t)openMapAt(t.lat,t.lng);else openMap()}
        else{const p=pl[+val.slice(1)];if(p)openMapAt(p.lat,p.lng)}
        renderReturnLists()};
      box.appendChild(d);
    };
    pl.forEach((p,i)=>mk('📍 <b>'+p.name+'</b>',myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'','p'+i));
    if((state.whispers||[]).length)mk('📶 <b>أقرب لمعة معروفة</b>','','w');
  });
}
function startOver(){
  const sel=$('arrowTarget');if(sel)sel.value='';
  startedOver=true;
  navTarget=null;try{updateNav()}catch(_){}
  renderArrow();renderHomeArrow();renderReturnLists();
  openMap();
  if(myLoc&&mapObj){try{mapObj.easeTo({center:[myLoc.lng,myLoc.lat],zoom:Math.max(mapObj.getZoom(),15)})}catch(_){}}
}
[['btnStartOver',startOver],['btnStartOverH',startOver],
 ['btnReturnPick',()=>{returnListOpen=!returnListOpen;renderReturnLists()}],
 ['btnReturnPickH',()=>{returnListOpen=!returnListOpen;renderReturnLists()}]
].forEach(([id,fn])=>{const b=$(id);if(b)b.onclick=fn});
$('arrowBox').onclick=()=>{const t=arrowTargetObj();if(t)openMapAt(t.lat,t.lng);else openMap()};
$('homeArrowGlyph').onclick=()=>{if(startedOver){returnListOpen=true;renderReturnLists();return}const t=arrowTargetObj();if(t){openMapAt(t.lat,t.lng);return}const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
$('homeArrowText').onclick=()=>{if(startedOver){returnListOpen=true;renderReturnLists();return}const t=arrowTargetObj();if(t){openMapAt(t.lat,t.lng);return}const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
let headingUp=false,lastBearingApplied=null,courseFix=null,gpsCourse=null,gpsCourseTs=0;
function effHeading(){return (gpsCourse!=null&&Date.now()-gpsCourseTs<25000)?gpsCourse:heading}
function applyHeadingUp(){if(!headingUp||!mapObj)return;const eh=effHeading();if(eh==null)return;let d=lastBearingApplied==null?99:Math.abs(((eh-lastBearingApplied+540)%360)-180);if(d<3)return;lastBearingApplied=eh;try{mapObj.easeTo({bearing:eh,duration:250})}catch(e){}}
window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){heading=360-e.alpha;renderArrow();renderHomeArrow();applyHeadingUp()}});

/* ---------- SOS panels ---------- */
let sosWasArmed=false;
function renderSos(){
  const armed=!!state.armed,del=!!state.delivered,sp=!!state.safePending,sent=!!state.sent;
  // Bring him home only at the moment of arming — not on every refresh, which
  // trapped him on the home tab for as long as the SOS stayed armed (1.50).
  if(armed&&!sosWasArmed&&curPage!=='home')showPage('home');
  sosWasArmed=armed;
  $('sosIdle').classList.toggle('hidden',armed);
  $('sosArmed').classList.toggle('hidden',!(armed&&!del));
  $('sosSent').classList.toggle('hidden',!(armed&&del));
  $('sosPanel').classList.toggle('dangerCard',armed&&!del);
  if(!armed){
    $('sosReadyState').textContent=sp?'أُلغيت الاستغاثة — رسالة «أنا بخير» تنتظر أول لمعة لتطير.':
      (state.name&&state.recipients?'رسالتك مبنية وموقعك يُحدَّث — الزرّ يفتحها في تطبيق رسائلك جاهزة، وتضغط «إرسال» هناك.':'أكمل «الإعداد» أسفل الصفحة أولًا: اسمك ورقم مستقبِل واحد على الأقل.');
  }
  if(armed&&!del){
    // 1.54: the rejection reason must show in BOTH armed branches — after a
    // radio rejection sent_at clears, so 1.52/1.53 (error line only in the
    // "sent" branch) never displayed the very code they captured.
    const errSuffix=(state.sendError>0)?(()=>{const errs={1:'خطأ عام من الشبكة',2:'الراديو مغلق (وضع طيران؟)',3:'بنية رسالة فارغة',4:'لا خدمة خلوية في تلك اللحظة',5:'تجاوز حدّ إرسال الرسائل',6:'قيود أرقام ثابتة (FDN)',7:'الرقم القصير محظور',8:'الرقم القصير محظور دائمًا',9:'الراديو غير متاح',10:'رفض صريح من الشبكة',15:'خطأ في النظام',16:'خطأ في المودم',17:'خطأ شبكة لحظة الإرسال — كثيرًا ما يرتبط بمكالمات الواي فاي؛ جرّب إطفاء الواي فاي',18:'خطأ في ترميز الرسالة',30:'فشلت إعادة محاولة الإرسال'};return ' ⚠ آخر محاولة رفضها الهاتف: '+(errs[state.sendError]||('رمز '+state.sendError))+' — تُعاد المحاولة تلقائيًا كل دقيقة.';})():'';
    if(sent){
      $('sosArmHead').textContent='🔴 أُطلقت الرسالة — أراقب تأكيد الوصول من الشبكة…';
      $('sosArmInfo').textContent='أُطلقت '+new Date(state.sentAt||Date.now()).toLocaleTimeString()+' إلى '+(state.recipients||'').replace(/\s*\n\s*/g,'، ')+' — إن لم يتأكد الوصول خلال ٣ دقائق تُعاد تلقائيًا عند أول لمعة.'+errSuffix;
    }else{
      $('sosArmHead').textContent='🔴 مُسلَّحة — أراقب الشبكة… ستطير رسالتك عند أول لمعة تغطية.';
      $('sosArmInfo').textContent='سُلّحت '+new Date(state.armedAt||Date.now()).toLocaleTimeString()+' — '+(sig.service?'توجد إشارة الآن، القوس يُطلِق…':'لا إشارة الآن؛ ستنطلق عند أول لمعة.')+errSuffix;
    }
  }
  $('idCard').innerHTML='<b>'+(state.name||'—')+'</b><br>'+(myLoc?('آخر موقع معروف: '+myLoc.lat.toFixed(5)+' , '+myLoc.lng.toFixed(5)):'الموقع: بانتظار GPS')+'<br><span class="dim">للمنقذين: هذا هاتف صاحبه؛ أرقام الاستغاثة محفوظة في التطبيق.</span>';
}

/* ---------- flickers ---------- */
let _flickSig='';
function renderFlickers(){
  const list=$('flickerList');const ws=state.whispers||[];
  // 1.96: same anti-flicker guard — redraw only when the log truly changes.
  const fsig=ws.length+'|'+(ws.length?ws[ws.length-1].at:'');
  if(fsig===_flickSig)return; _flickSig=fsig;
  if(!ws.length){list.innerHTML='<p class="dim">لا لمعات مسجلة بعد — كل موضع تلمع فيه شبكة يُحفَظ هنا بصمت، وزرّ «سجّل لمعة هنا» يحفظ موضعك الحالي يدويًا.</p>';return}
  list.innerHTML='';
  ws.slice(-8).reverse().forEach(w=>{
    const d=document.createElement('div');d.className='flickRow';
    d.innerHTML='<span>📶 '+(w.net||'شبكة')+' '+(w.dbm||'')+'dBm</span><span class="dim">'+new Date(w.at).toLocaleString()+'</span>';
    // 1.99 (Hilal): a flicker row was display-only — now, like a saved
    // place, tapping it opens the map at the flicker and guides to it.
    d.onclick=()=>{if(w.lat&&w.lng)openMapAt(w.lat,w.lng)};
    list.appendChild(d);
  });
}

/* ---------- refresh ---------- */
function refresh(){
  if(GN){
    sig=J(GN.getSignal(),{});state=J(GN.getState(),{});
    const loc=J(GN.getLocation(),{});if(loc.lat)myLoc=loc;
    if(!setupFilled&&(state.name!==undefined||state.template!==undefined)){fillSetup();setupFilled=true}
  }
  // 1.57: the "modern" tile shows the best modern reading — 4G, else 5G,
  // else 3G — and the camp line names the actual generation, so a phone
  // camped on 5G no longer looks like a dead meter.
  const modern=(sig.lte&&typeof sig.lte.level==='number')?sig.lte:((sig.nr&&typeof sig.nr.level==='number')?sig.nr:((sig.wcdma&&typeof sig.wcdma.level==='number')?sig.wcdma:{}));
  if($('gnameModern'))$('gnameModern').textContent=(sig.nr&&typeof sig.nr.level==='number')?'5G':((sig.lte&&typeof sig.lte.level==='number')?'4G':((sig.wcdma&&typeof sig.wcdma.level==='number')?'3G':'4G/5G'));
  const modernTech=(sig.lte&&typeof sig.lte.level==='number')?'lte':((sig.nr&&typeof sig.nr.level==='number')?'nr':((sig.wcdma&&typeof sig.wcdma.level==='number')?'wcdma':'lte'));
  gauge('lte',modern,!!(sig.gsm&&typeof sig.gsm.level==='number'),'2G',modernTech);
  gauge('gsm',sig.gsm,!!(modern&&typeof modern.level==='number'),'شبكة حديثة');
  $('netState').textContent=(sig.carrier?('المشغّل: '+sig.carrier+' • '):'')+(sig.service?'الخدمة متاحة الآن ✓':'لا خدمة الآن — الحارس يراقب')+(sig.camp?(' • مخيّم الآن على '+sig.camp):'')+(typeof sig.battery==='number'&&sig.battery>=0?(' • البطارية '+sig.battery+'%'):'')+freshTxt(sig.freshSec);
  const _lo=$('sigLocOff');if(_lo)_lo.classList.toggle('hidden',sig.locOn!==false);
  renderSos();renderFlickers();renderPlaces();renderArrow();renderHome();updateMotion();renderReturnLists();
}
window.__onLoc=l=>{if(l&&l.lat){if(courseFix&&hav(courseFix.lat,courseFix.lng,l.lat,l.lng)>=6){gpsCourse=brg(courseFix.lat,courseFix.lng,l.lat,l.lng);gpsCourseTs=Date.now();courseFix=l}else if(!courseFix)courseFix=l}myLoc=l;renderArrow();renderPlaces();renderMapUser();renderLocStatus();updateNav();applyHeadingUp();if(curPage==='map')refreshPackEst()}

/* ---------- actions ---------- */
$('btnAddPlace').onclick=()=>{
  let nm=$('placeName').value.trim();
  if(!nm){ // no name typed: auto-name by time, exactly like the map's quick pin (1.40)
    const d=new Date();const pad=n=>(''+n).padStart(2,'0');
    nm='مكاني — '+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  if(!myLoc){alert('بانتظار إشارة GPS… جرّب قرب نافذة أو في الخارج');return}
  const pl=state.places||[];pl.push({name:nm,lat:myLoc.lat,lng:myLoc.lng});
  GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;$('placeName').value='';renderPlaces();
};
$('btnLogFlicker').onclick=()=>{GN&&GN.addWhisper();setTimeout(refresh,450)};
/* ---------- signal hunt (1.46) ---------- */
let huntTimer=null,huntNet='gsm',huntSamples=[],huntBest=null;
function huntTick(){
  if(!GN)return;
  const s=J(GN.getSignal(),{});
  const o=huntNet==='gsm'?s.gsm:s.lte;
  const dbm=(o&&typeof o.dbm==='number')?o.dbm:null;
  const now=Date.now();
  if(dbm!==null&&myLoc){
    const smp={t:now,dbm,lat:myLoc.lat,lng:myLoc.lng};
    huntSamples.push(smp);
    if(!huntBest||dbm>huntBest.dbm)huntBest=smp;
  }
  huntSamples=huntSamples.filter(x=>now-x.t<=90000);
  $('huntDbm').textContent=dbm===null?'لا إشارة':(dbm+' dBm');
  const recent=huntSamples.filter(x=>now-x.t<=12000),prior=huntSamples.filter(x=>now-x.t>12000&&now-x.t<=24000);
  const mean=a=>a.reduce((x,y)=>x+y.dbm,0)/a.length;
  const tr=$('huntTrend');
  if(dbm===null){tr.className='flat';tr.textContent='لا إشارة الآن على '+(huntNet==='gsm'?'2G':'4G')+' — تحرّك، أو بدّل الشبكة، أو افرضها من الإعدادات.'}
  else if(recent.length>=3&&prior.length>=3){
    const d=mean(recent)-mean(prior);
    if(d>=2){tr.className='up';tr.textContent='▲ الإشارة تقوى — واصل بهذا الاتجاه'}
    else if(d<=-2){tr.className='down';tr.textContent='▼ الإشارة تضعف — ارجع أو غيّر اتجاهك'}
    else{tr.className='flat';tr.textContent='● ثابتة تقريبًا — جرّب اتجاهًا آخر'}
  }else{tr.className='flat';tr.textContent='أجمع القراءات… واصل المشي'}
  if(huntBest){
    const bd=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,huntBest.lat,huntBest.lng)):'';
    $('huntBest').textContent='أفضل نقطة في هذا الصيد: '+huntBest.dbm+' dBm'+(bd?' — على بُعد '+bd+' منك الآن':'');
    $('btnHuntBestMap').disabled=false;
  }
}
function openHunt(){
  huntSamples=[];huntBest=null;
  $('huntBest').textContent='أفضل نقطة في هذا الصيد: —';$('btnHuntBestMap').disabled=true;
  showPage('hunt');
  huntTick();if(huntTimer)clearInterval(huntTimer);huntTimer=setInterval(huntTick,2000);
}
function closeHunt(){
  if(huntTimer)clearInterval(huntTimer);huntTimer=null;
  showPage('home');
}
$('btnHunt').onclick=openHunt;
$('btnHuntClose').onclick=closeHunt;
$('huntNet2').onclick=()=>{huntNet='gsm';huntSamples=[];huntBest=null;$('huntNet2').classList.add('sel');$('huntNet4').classList.remove('sel');huntTick()};
$('huntNet4').onclick=()=>{huntNet='lte';huntSamples=[];huntBest=null;$('huntNet4').classList.add('sel');$('huntNet2').classList.remove('sel');huntTick()};
$('btnHuntBestMap').onclick=()=>{if(huntBest){closeHunt();openMapAt(huntBest.lat,huntBest.lng)}};
$('btnHuntForce').onclick=()=>{GN&&GN.openNetworkSettings()};
$('btnNetSettings').onclick=()=>{GN&&GN.openNetworkSettings()};
$('btnNearestFlicker').onclick=()=>{
  $('arrowTarget').value='w';renderArrow();
  const card=$('arrowCard');
  if(card){card.scrollIntoView({behavior:'smooth',block:'center'});
    card.classList.remove('flash');void card.offsetWidth;card.classList.add('flash');
    setTimeout(()=>card.classList.remove('flash'),1500);}
};
$('btnSOS').onclick=()=>{
  if(!state.name||!state.recipients){alert('أكمل الإعداد أولًا: اسمك ورقم مستقبِل واحد على الأقل (في صفحة «الإعداد»)');showPage('setup');return}
  // 1.59 (Hilal's order): the SOS button no longer arms or sends anything —
  // it opens the stock Messages app with the SOS built and addressed; his
  // own tap on Send there is the only send. A stale arm is disarmed silently.
  if(state.armed&&GN&&GN.disarmSilent)GN.disarmSilent();
  GN&&GN.sendViaComposer&&GN.sendViaComposer();
  setTimeout(refresh,300);
};
function longPress(btn,fn){
  let timer=null,start=0;
  const down=e=>{e.preventDefault();start=Date.now();btn.style.opacity=.55;
    timer=setInterval(()=>{if(Date.now()-start>=2000){clearInterval(timer);btn.style.opacity=1;fn()}},60)};
  const up=()=>{if(timer)clearInterval(timer);btn.style.opacity=1};
  btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);
}
longPress($('btnCancelSOS'),()=>{GN&&GN.cancelSos();setTimeout(refresh,300)});
$('btnComposer').onclick=()=>{GN&&GN.sendViaComposer&&GN.sendViaComposer()};
if($('btnRefreshSignal'))$('btnRefreshSignal').onclick=()=>{const b=$('btnRefreshSignal');GN&&GN.refreshSignal&&GN.refreshSignal();b.textContent='جارٍ القياس…';setTimeout(refresh,700);setTimeout(refresh,1800);setTimeout(()=>{refresh();b.textContent='🔄 تحديث القياس الآن'},3500);};
longPress($('btnCancelAfter'),()=>{GN&&GN.cancelSos();setTimeout(refresh,300)});
$('btnBeacon').onclick=()=>{beaconOn=true;GN&&GN.beacon(true);document.body.classList.add('beaconOn');$('btnBeacon').classList.add('hidden');$('btnBeaconOff').classList.remove('hidden')};
$('btnBeaconOff').onclick=()=>{beaconOn=false;GN&&GN.beacon(false);document.body.classList.remove('beaconOn');$('btnBeacon').classList.remove('hidden');$('btnBeaconOff').classList.add('hidden')};
$('btnSaveSetup').onclick=()=>{
  GN&&GN.saveSetup($('inName').value,$('inNumbers').value,$('inMsg').value,$('inOkMsg').value);
  setupFilled=true;setTimeout(refresh,300);alert('حُفظ الإعداد على هاتفك ✓');
};
$('btnResetSetup').onclick=()=>{
  if(!confirm('سيُمسح الاسم وأرقام الاستغاثة وأي نص كتبتَه بيدك، وتعود القوالب الافتراضية. متأكد؟'))return;
  GN&&GN.saveSetup('','','','');
  setupFilled=false;setTimeout(refresh,300);alert('أُعيد الضبط — عاد الإعداد كما في أول تشغيل ✓');
};
function fillSetup(){
  $('inName').value=state.name||'';$('inNumbers').value=state.recipients||'';
  $('inMsg').value=state.template||'';$('inOkMsg').value=state.safeTemplate||'';
}

/* ---------- tabs ---------- */
let curPage='home';
function showPage(name){
  if(name!=='hunt'&&typeof huntTimer!=='undefined'&&huntTimer){clearInterval(huntTimer);huntTimer=null}
  placeEditOpen=false;
  curPage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
  window.scrollTo(0,0);
  if(name==='map')setTimeout(initMap,60);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));

/* =========================================================
   CAMEL CARAVAN 1.81 — PACING GAIT RESTORED
   Based on original camel_gait.js + approved caravan 1.80

   Preserves:
   - 8 camel sprites / 2 groups of 4
   - Endless right-to-left caravan
   - Original ART sprite sheets
   - Six-pose image sequence
   - Shadows and footprint particles
   - Motion controls and safety freeze

   Fixes:
   - Correct 3.2-second gait cycle
   - Correct stride-to-speed synchronization
   - No artificial body jumping
   - Smooth cyclic body sway
   ========================================================= */


/* ---------- caravan setup ---------- */

const wrap = $('sceneWrap');
const layer = $('caravan');

let motionUser = true;

let camelEls = [];
let camelShadows = [];
let printPool = [];

let lastStep = [];
let printIdx = 0;

let SLOTS = [];

let TRACK = 0;
let CDW = 0;
let CH = 52;

let SHIFT = 0;

let lastTs = 0;


/* ---------- gait constants ---------- */

// Original caravan speed (the live gait clock is the CAMEL_GAIT
// duration below; the old stride/sway tables and the six-pose
// sequencer were removed in the 1.102 dead-code cleanup —
// uncalled since the 1.89 sprite clock took over. The gait
// data itself stays preserved in gait-incoming/.)
const CARAVAN_SPEED = 11;


/* ---------- initialize caravan ---------- */

function caravanInit() {

  if (!ART) return;

  $('sceneBg').src = ART.scene;

  const k = CH / ART.cellH;

  CDW = Math.round(ART.cellW * k);

  // Eight camels
  for (let i = 0; i < 8; i++) {

    const d = document.createElement('div');

    d.className = 'camel';

    d.style.width = CDW + 'px';
    d.style.height = CH + 'px';

    d.style.backgroundImage =
      'url(' + ART.camelsA + ')';

    d.style.backgroundSize =
      (ART.halfW * k) + 'px ' + CH + 'px';

    d.style.backgroundRepeat = 'no-repeat';

    d.style.backgroundPosition = '0px 0px';

    d.style.transformOrigin = '50% 100%';

    d._h = 0;

    layer.appendChild(d);

    camelEls.push(d);


    // Ground shadow
    const sh = document.createElement('div');

    sh.className = 'cshadow';

    sh.style.width =
      Math.round(CDW * 1.30) + 'px';

    layer.appendChild(sh);

    camelShadows.push(sh);
  }


  // Original spacing
  const SP = CDW + 6;
  const GG = 90;

  for (let g = 0; g < 2; g++) {

    for (let i = 0; i < 4; i++) {

      SLOTS.push(
        g * (4 * SP + GG) + i * SP
      );
    }
  }

  TRACK = 2 * (4 * SP + GG);


  // Footprint particle pool
  for (let j = 0; j < 30; j++) {

    const u = document.createElement('div');

    u.className = 'puff';

    u.style.opacity = '0';

    layer.appendChild(u);

    printPool.push({
      puff: u,
      born: -1e9,
      fx: 0
    });
  }
}


/* ---------- motion control ---------- */

function motionWanted() {

  if (!motionUser) return false;

  if (curPage !== 'home') return false;

  if (state.armed) return false;

  if (
    typeof sig.battery === 'number' &&
    sig.battery >= 0 &&
    sig.battery < 20
  ) return false;

  if (document.hidden) return false;

  return true;
}


function updateMotion() {

  const on = motionWanted();

  $('animState').textContent =
    state.armed
      ? 'الحركة مجمّدة — وضع الخطر'
      : (!motionUser
        ? 'القافلة ثابتة'
        : (typeof sig.battery === 'number' &&
           sig.battery < 20
          ? 'الحركة مجمّدة — البطارية ضعيفة'
          : 'قافلتك تمشي…'));

  $('btnAnim').textContent =
    motionUser
      ? 'إيقاف الحركة'
      : 'تشغيل الحركة';
}


$('btnAnim').onclick = () => {

  motionUser = !motionUser;

  updateMotion();
};


/* ---------- salawat (1.97): persistent antique frame, top-right of the
   scene, carrying the interval chips (5/10/15/30 min). One chosen voice.
   State (on / interval / last-played) lives in native prefs via GN and
   is shared with the WatchService, which plays when the UI is away. --- */
const SALAWAT_FILE = 'salawat2.mp3';
let salawatOn = true, salawatMin = 15, salawatLast = 0, salawatPrimed = false;
try {
  if (window.GN && GN.getSalawatState) {
    const st = J(GN.getSalawatState(), {});
    if (st.on !== undefined) salawatOn = !!st.on;
    if (st.min) salawatMin = st.min;
    if (st.last) salawatLast = st.last;
  }
} catch (e) {}
const salawatAudio = new Audio();
salawatAudio.preload = 'auto';
document.addEventListener('pointerdown', () => {
  if (salawatPrimed) return; salawatPrimed = true;
  try { salawatAudio.src = 'https://app.local/' + SALAWAT_FILE; salawatAudio.load(); } catch (e) {}
}, { passive: true });
function salawatPlay() {
  salawatLast = Date.now();
  try { if (window.GN && GN.markSalawatPlayed) GN.markSalawatPlayed(); } catch (e) {}
  const p = $('salawatBanner');
  if (p) { p.classList.remove('playing'); void p.offsetWidth; p.classList.add('playing'); setTimeout(() => p.classList.remove('playing'), 5000); }
  try {
    salawatAudio.src = 'https://app.local/' + SALAWAT_FILE;
    const pr = salawatAudio.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (e) {}
}
function salawatPaint() {
  const b = $('btnSalawat');
  if (b) b.textContent = salawatOn ? '🔔 الصلاة: تعمل' : '🔕 الصلاة: صامتة';
  const f = $('salawatFace');
  if (f) f.textContent = ({5:'٥',10:'١٠',15:'١٥',30:'٣٠'})[salawatMin] + ' د ▾';
  const p = $('salawatBanner');
  if (p) p.classList.toggle('off', !salawatOn);
  document.querySelectorAll('.sal-opt').forEach(c =>
    c.classList.toggle('sel', +c.getAttribute('data-min') === salawatMin));
}
(function () {
  const b = $('btnSalawat');
  if (b) b.onclick = () => {
    salawatOn = !salawatOn;
    try { if (window.GN && GN.setSalawatOn) GN.setSalawatOn(salawatOn); } catch (e) {}
    salawatPaint();
  };
  const bn = $('salawatBanner'), bar = $('salawatBar'), face = $('salawatFace');
  function placeBar() {
    if (!bn || !bar) return;
    const w = $('sceneWrap'); if (!w) return;
    const r = bn.getBoundingClientRect(), wr = w.getBoundingClientRect();
    bar.style.top = (r.bottom - wr.top) + 'px';
    bar.style.right = (wr.right - r.right) + 'px';
  }
  if (bar && face) {
    placeBar();
    face.addEventListener('click', () => { placeBar(); bar.classList.toggle('open'); });
    if (bn) bn.addEventListener('click', () => { placeBar(); bar.classList.toggle('open'); });
    document.addEventListener('pointerdown', ev => {
      if (bar.classList.contains('open') && !bar.contains(ev.target) && !(bn && bn.contains(ev.target)))
        bar.classList.remove('open');
    });
  }
  document.querySelectorAll('.sal-opt').forEach(c => {
    c.onclick = () => {
      salawatMin = +c.getAttribute('data-min');
      try { if (window.GN && GN.setSalawatInterval) GN.setSalawatInterval(salawatMin); } catch (e) {}
      salawatPaint();
      if (bar) bar.classList.remove('open');
      salawatPlay();
    };
  });
  salawatPaint();
})();
setInterval(() => { try { if (window.GN && GN.uiPing) GN.uiPing(); } catch (e) {} }, 20000);
setInterval(() => {
  if (!salawatOn || document.hidden) return;
  if (Date.now() - salawatLast >= salawatMin * 60000) salawatPlay();
}, 20000);


/* CAMEL SPRITE ORDER — CORRECTED (constants measured from the
   artwork itself in 1.90: 4 variants x 3 poses per sheet x 6 poses;
   the 3/4/8 constants made each camel change colours every step) */

const CAMEL_VARIANTS = 4;
const CAMEL_FRAMES_PER_SHEET = 3;
const CAMEL_TOTAL_FRAMES = 6;

function getCamelSprite(u, variant) {
  const phase = ((u % 1) + 1) % 1;

  const frame = Math.min(
    CAMEL_TOTAL_FRAMES - 1,
    Math.floor(phase * CAMEL_TOTAL_FRAMES)
  );

  const sheetIndex = Math.floor(
    frame / CAMEL_FRAMES_PER_SHEET
  );

  const frameInSheet =
    frame % CAMEL_FRAMES_PER_SHEET;

  // Image order: frame first, camel variant second
  const cell =
    frameInSheet * CAMEL_VARIANTS +
    (variant % CAMEL_VARIANTS);

  return {
    sheet: sheetIndex === 0
      ? ART.camelsA
      : ART.camelsB,
    cell,
    frame
  };
}


/* INDEPENDENT GAIT CLOCK */

const CAMEL_GAIT_DURATION = 3.2;

let camelGaitTime = 0;

function updateCamelGait(dt, on) {
  if (!on) return;

  camelGaitTime += dt / 1000;

  if (camelGaitTime >= CAMEL_GAIT_DURATION) {
    camelGaitTime %= CAMEL_GAIT_DURATION;
  }
}

function getCamelGaitPhase(index) {
  const offset = index * 0.12;

  return (
    (camelGaitTime / CAMEL_GAIT_DURATION + offset) % 1
  );
}


/* ---------- endless caravan animation ---------- */

function caravanLoop(ts) {

  requestAnimationFrame(caravanLoop);

  if (!camelEls.length) return;

  const dt = Math.min(
    250,
    ts - (lastTs || ts)
  );

  lastTs = ts;

  const on = motionWanted();

  updateCamelGait(dt, on);

  wrap.classList.toggle('frozen', !on);


  // Keep movement and gait synchronized
  if (on && dt > 0) {

    const distance =
      CARAVAN_SPEED * dt / 1000;

    SHIFT = (SHIFT + distance) % TRACK;

  }


  camelEls.forEach((d, i) => {

    /* ----- caravan position ----- */

    const x =
      ((SLOTS[i] - SHIFT) % TRACK + TRACK)
      % TRACK - CDW - 24;


    /* ----- gait phase: independent clock (set 2) ----- */

    const uu = getCamelGaitPhase(i);
    const sprite = getCamelSprite(uu, i % CAMEL_VARIANTS);


    /* ----- body movement: frozen (set 2) — data height/sway stay
       off until the frame sequence is verified ----- */

    const bob = 0;
    const sway = 0;


    /* ----- apply body movement ----- */

    d.style.transform =
      'translate3d(' +
      x.toFixed(2) + 'px,' +
      bob.toFixed(2) + 'px,0) ' +
      'rotate(' +
      sway.toFixed(2) + 'deg)';


    /* ----- sprite image from the precomputed sprite (set 2) ----- */

    const half =
      sprite.sheet === ART.camelsB ? 1 : 0;


    if (d._h !== half) {

      d.style.backgroundImage =
        'url(' + sprite.sheet + ')';

      d._h = half;
    }


    d.style.backgroundPosition =
      (-(sprite.cell * CDW)) + 'px 0px';


    /* ----- ground shadow ----- */

    const shadowX =
      x - CDW * 0.26;

    camelShadows[i].style.transform =
      'translate3d(' +
      shadowX.toFixed(2) +
      'px,0,0) ' +
      'rotate(-3deg) scaleX(1)';


    /* ----- footprint timing ----- */

    const sIdx = Math.floor(uu * 2);

    if (lastStep[i] === undefined) {

      lastStep[i] = sIdx;
    }

    if (
      on &&
      sIdx !== lastStep[i] &&
      printPool.length
    ) {

      lastStep[i] = sIdx;

      const pr =
        printPool[
          printIdx++ % printPool.length
        ];

      pr.born = ts;

      pr.fx =
        x + CDW * 0.42 + (sIdx % 2) * 4;
    }

  });


  /* ---------- footprint particles ---------- */

  printPool.forEach(pr => {

    const age = (ts - pr.born) / 1000;

    if (age < 1.2) {

      const opacity =
        Math.max(0, 1 - age / 1.2) * 0.5;

      pr.puff.style.opacity =
        String(opacity);

      pr.puff.style.transform =
        'translate3d(' +
        (pr.fx - 5 + 7 * age) + 'px,' +
        (-3 * age) + 'px,0) ' +
        'scale(' +
        (1 + 1.1 * age) + ')';

    } else {

      pr.puff.style.opacity = '0';
    }

  });

}


/* ---------- start caravan ---------- */

caravanInit();

requestAnimationFrame(caravanLoop);


/* =========================================================
   END CAMEL CARAVAN 1.81
   ========================================================= */
refresh();setInterval(refresh,2500);
// 1.83 (Hilal: live sync with the network): the 2.5s loop only re-reads the
// last snapshot, which can be up to 2 minutes old — pull a MODEM-fresh
// measurement every 20s while the app is visible so the ladders breathe
// with the network as he moves.
setInterval(()=>{if(!document.hidden&&GN&&GN.refreshSignal)GN.refreshSignal()},20000);

/* ---------- offline map (MapLibre vector engine + locally downloaded tiles) ---------- */
let mapObj=null,mapSatMode=false,mapMarkers=[],mapUserMarker=null,mapStyleOk=false,packRadius=50,packDownloading=false;
let navTarget=null,navArrowMarker=null,navTgtMarker=null,navB=null;
function rotDart(){if(!navArrowMarker||navB==null||!mapObj)return;const sp=navArrowMarker.getElement().firstChild;if(sp)sp.style.transform='rotate('+(navB-mapObj.getBearing())+'deg)'}
function openMap(){showPage('map')}
function openMapAt(lat,lng){
  navTarget={lat:lat,lng:lng};
  openMap();
  let n=0;
  const iv=setInterval(()=>{
    n++;
    if(mapObj){clearInterval(iv);
      if(myLoc&&hav(myLoc.lat,myLoc.lng,lat,lng)>400)mapObj.fitBounds([[myLoc.lng,myLoc.lat],[lng,lat]],{padding:70,maxZoom:15});
      else mapObj.flyTo({center:[lng,lat],zoom:Math.max(mapObj.getZoom(),14)});
      updateNav();}
    else if(n>24)clearInterval(iv);
  },150);
}
function nearestPlace(){
  const pl=state.places||[];
  if(!pl.length||!myLoc)return pl[0]||null;
  let best=pl[0],bd=1e18;
  pl.forEach(p=>{const d=hav(myLoc.lat,myLoc.lng,p.lat,p.lng);if(d<bd){bd=d;best=p}});
  return best;
}
function satStyle(){
  const base=window.MAP_STYLE_ROADS;
  const st=JSON.parse(JSON.stringify(base));
  st.sources.satimg={type:'raster',tiles:['https://app.local/sat/{z}/{x}/{y}'],tileSize:256,maxzoom:18,attribution:'© Esri, Maxar, Earthstar Geographics'};
  const keep=[{id:'satimg',type:'raster',source:'satimg'}];
  base.layers.forEach(l=>{
    if(l.type==='symbol')keep.push(JSON.parse(JSON.stringify(l)));
    else if(l.type==='line'&&(l['source-layer']==='transportation'||l['source-layer']==='boundary')){
      const c=JSON.parse(JSON.stringify(l));
      c.paint=Object.assign({},c.paint,{'line-opacity':0.45});
      keep.push(c);
    }
  });
  st.layers=keep;
  return st;
}
function refreshMapStyle(){
  if(mapObj)mapObj.setStyle(mapSatMode?satStyle():window.MAP_STYLE_ROADS);
}
function initMap(){
  if(!GN)return;
  if(!window.maplibregl||!window.MAP_STYLE_ROADS){
    $('mapView').innerHTML='<p class="dim" style="padding:16px">تعذّر تحميل محرك الخريطة على هذا الهاتف — أخبر جدّتك.</p>';
    fillPackCenters();refreshPackEst();renderPacks();renderLocStatus();updatePackButtons();
    return;
  }
  if(!mapObj){
    try{
      // Arabic/Hebrew shaping plugin — MapLibre normally fetches it from a CDN,
      // which is useless offline; bundled and served from app.local instead (1.31).
      if(maplibregl.getRTLTextPluginStatus&&maplibregl.getRTLTextPluginStatus()==='unavailable')
        maplibregl.setRTLTextPlugin('https://app.local/rtl-text.js', true);
    }catch(e){}
    try{
      mapObj=new maplibregl.Map({container:'mapView',style:window.MAP_STYLE_ROADS,
        center:myLoc?[myLoc.lng,myLoc.lat]:[57.83,22.38],zoom:11,
        attributionControl:{compact:true},minZoom:7,maxZoom:18});
      mapObj.addControl(new maplibregl.NavigationControl({showCompass:false}));
      mapObj.on('load',()=>{mapStyleOk=true;renderMapPlaces();renderMapUser()});
      mapObj.on('style.load',()=>{ensureNav();updateNav()});
      mapObj.on('rotate',()=>rotDart());
      // (1.100: the TEMP DIAGNOSTIC error box from the 1.81 blank-band
      // hunt was removed for good at Hilal's order — the hunt is over.)

      mapObj.on('moveend',()=>{if($('packCenter').value==='center')refreshPackEst()});
      setTimeout(()=>{if(!mapStyleOk&&mapObj)$('mapView').insertAdjacentHTML('beforeend','<div class="mapWarn">المحرك المتجهي لم يكتمل تحميله — إن بقيت الخريطة فارغة أخبر جدّتك.</div>')},8000);
    }catch(e){
      $('mapView').innerHTML='<p class="dim" style="padding:16px">محرك الخريطة المتجهية (WebGL) لا يعمل على هذا الهاتف — أخبر جدّتك لتعيد المحرك القديم.</p>';
    }
  }
  setTimeout(()=>{if(mapObj)mapObj.resize();renderMapPlaces();renderMapUser()},80);
  fillPackCenters();refreshPackEst();renderPacks();renderLocStatus();updatePackButtons();
}
function setMapLayer(sat){
  if(!mapObj)return;
  mapSatMode=sat;
  refreshMapStyle();
  $('btnLayerRoads').classList.toggle('gold',!sat);
  $('btnLayerSat').classList.toggle('gold',sat);
}
function renderMapPlaces(){
  if(!mapObj)return;
  mapMarkers.forEach(m=>m.remove());mapMarkers=[];
  (state.places||[]).forEach(p=>{
    const el=document.createElement('div');el.className='pin';el.textContent='📍';
    const pop=new maplibregl.Popup({offset:20,closeButton:false,closeOnClick:true,maxWidth:'250px'});
    const dv=document.createElement('div');dv.className='pinPop';
    dv.innerHTML='<div class="pinPopName">📍 '+p.name+'</div>';
    const del=document.createElement('button');del.className='pinDel';del.textContent='✕ حذف هذا المكان';
    del.addEventListener('click',e=>{
      // 1.82 fix (Hilal: popup delete did nothing): remove exactly one place
      // matched by VALUE (name+coords) with a reference fallback, stop the tap
      // from reaching the map, and re-render the pins FIRST so a later render
      // error can never strand the deleted pin on the map.
      e.stopPropagation();e.preventDefault();
      const arr=(state.places||[]).slice();
      let idx=arr.findIndex(q=>q.name===p.name&&q.lat===p.lat&&q.lng===p.lng);
      if(idx<0)idx=arr.indexOf(p);
      if(idx>=0)arr.splice(idx,1);
      GN&&GN.savePlaces(JSON.stringify(arr));state.places=arr;
      try{pop.remove()}catch(_){}
      try{renderMapPlaces()}catch(_){}
      try{renderPlaces()}catch(_){}
      try{renderArrow()}catch(_){}
    });
    dv.appendChild(del);pop.setDOMContent(dv);
    const mk=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([p.lng,p.lat])
      .setPopup(pop).addTo(mapObj);
    mapMarkers.push(mk);
  });
}
function renderMapUser(){
  if(!mapObj||!myLoc)return;
  if(!mapUserMarker){
    const el=document.createElement('div');el.className='meDot';
    mapUserMarker=new maplibregl.Marker({element:el}).setLngLat([myLoc.lng,myLoc.lat]).addTo(mapObj);
  }else mapUserMarker.setLngLat([myLoc.lng,myLoc.lat]);
}
/* 1.64 (Hilal's order): the guidance arrow ON the map itself — a dashed gold
   line from his position to the chosen target with an arrowhead at 85% of
   the way, rotated to the true bearing, refreshed on every GPS fix. The
   style.load hook re-adds the layer after roads/satellite style switches. */
function ensureNav(){
  if(!mapObj)return;
  try{
    if(!mapObj.getSource('navsrc')){
      mapObj.addSource('navsrc',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});
      mapObj.addLayer({id:'navline',type:'line',source:'navsrc',paint:{'line-color':'#ffcf4d','line-width':3,'line-dasharray':[2,1.5],'line-opacity':0.95}});
    }
  }catch(e){}
}
function updateNav(){
  if(!mapObj)return;
  ensureNav();
  let src=null;try{src=mapObj.getSource('navsrc')}catch(e){}
  if(!src)return;
  if(!navTarget||!myLoc){
    const nd0=$('navDist');if(nd0)nd0.style.display='none';
    src.setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});
    if(navArrowMarker){navArrowMarker.remove();navArrowMarker=null}
    if(navTgtMarker){navTgtMarker.remove();navTgtMarker=null}
    return;
  }
  src.setData({type:'Feature',geometry:{type:'LineString',coordinates:[[myLoc.lng,myLoc.lat],[navTarget.lng,navTarget.lat]]}});
  const b=brg(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
  const nd=$('navDist');if(nd){nd.textContent='المتبقي: '+chipDist(hav(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng));nd.style.display='block'}
  // 1.72: place the head in SCREEN space — a fixed pixel distance short of
  // the target pin, so it stands visibly apart from the pin at every zoom
  // (1.71's metre rule collapsed to the same pixel when zoomed out, and
  // Hilal found the arrow "hiding under its mother"). Midway when the two
  // points are 40–140 px apart; a clear 70 px off when they nearly coincide.
  let ax,ay;
  const pA=mapObj.project([myLoc.lng,myLoc.lat]),pB=mapObj.project([navTarget.lng,navTarget.lat]);
  const dx=pA.x-pB.x,dy=pA.y-pB.y,pd=Math.hypot(dx,dy);
  if(pd>1){
    const backPx=pd>=140?Math.min(170,Math.max(70,pd*0.18)):(pd>=40?pd*0.5:70);
    const t=backPx/pd,ll=mapObj.unproject([pB.x+dx*t,pB.y+dy*t]);
    ax=ll.lng;ay=ll.lat;
  }else{ax=myLoc.lng+(navTarget.lng-myLoc.lng)*0.85;ay=myLoc.lat+(navTarget.lat-myLoc.lat)*0.85;}
  if(!navArrowMarker){
    const el=document.createElement('div');el.className='navArrow';el.innerHTML='<span></span>';
    navArrowMarker=new maplibregl.Marker({element:el}).setLngLat([ax,ay]).addTo(mapObj);
  }else navArrowMarker.setLngLat([ax,ay]);
  if(!navTgtMarker){
    const te=document.createElement('div');te.className='navTgt';te.innerHTML='<span></span>';
    navTgtMarker=new maplibregl.Marker({element:te,anchor:'center'}).setLngLat([navTarget.lng,navTarget.lat]).addTo(mapObj);
  }else navTgtMarker.setLngLat([navTarget.lng,navTarget.lat]);
  navB=b;rotDart();
}
function packCenterCoords(){
  const v=$('packCenter').value;
  if(v==='center'&&mapObj){const c=mapObj.getCenter();return{lat:c.lat,lng:c.lng,name:'مركز الخريطة'}}
  if(v&&v[0]==='p'){const p=(state.places||[])[+v.slice(1)];if(p)return{lat:p.lat,lng:p.lng,name:p.name}}
  if(myLoc)return{lat:myLoc.lat,lng:myLoc.lng,name:fixAgeMs()<180000?'موقعي الحالي':'آخر موقع معروف ('+fmtAge(fixAgeMs())+')'};
  return null;
}
function fillPackCenters(){
  const sel=$('packCenter');const cur=sel.value;
  sel.innerHTML='';
  const o1=document.createElement('option');o1.value='loc';o1.textContent='موقعي الحالي';sel.appendChild(o1);
  const o2=document.createElement('option');o2.value='center';o2.textContent='مركز الخريطة الحالي';sel.appendChild(o2);
  (state.places||[]).forEach((p,i)=>{const o=document.createElement('option');o.value='p'+i;o.textContent='مكان محفوظ: '+p.name;sel.appendChild(o)});
  if(cur)sel.value=cur;
}
function refreshPackEst(){
  if(!GN||!GN.packInfo)return;
  const c=packCenterCoords();
  if(!c){
    $('packEst').textContent='لم يُحدَّد موقعك بعد — فعّل GPS وامنح التطبيق إذن الموقع وانتظر ثوانٍ حتى تظهر نقطتك، أو اختر «مركز الخريطة» وحرّك الخريطة إلى أي بقعة ونزّل حولها (يعمل بلا GPS تمامًا).';
    if(!packDownloading)$('btnDownloadPack').disabled=true;
    return;
  }
  if(!packDownloading)$('btnDownloadPack').disabled=false;
  try{
    const info=JSON.parse(GN.packInfo(c.lat,c.lng,packRadius));
    $('packEst').textContent='≈ '+info.tiles+' عنصر (طرق متجهية + أقمار) · ≈ '+info.mb+' ميغا · المركز: '+c.name+' · النطاق '+packRadius+' كم'+(info.glyphs?' · يشمل خطوط الأسماء العربية (~٥ ميغا، تُنزَّل مرة واحدة فقط)':'');
  }catch(e){$('packEst').textContent=''}
}
function renderPacks(){
  if(!GN||!GN.listPacks)return;
  let data={};try{data=JSON.parse(GN.listPacks())}catch(e){}
  const list=$('packsList');list.innerHTML='';
  (data.packs||[]).forEach((pk,i)=>{
    const row=document.createElement('div');row.className='row spread';
    const d=new Date(pk.at);
    row.innerHTML='<span class="grow">🗺️ '+pk.name+' — نطاق '+pk.radiusKm+' كم · '+pk.mb+' ميغا · '+d.toLocaleDateString('ar')+'</span>';
    const del=document.createElement('button');del.className='btn small danger';del.textContent='حذف الحزمة';
    let armed=false,armT=null;
    del.onclick=()=>{
      if(!armed){armed=true;del.textContent='متأكد؟ احذف بلاطاتها';armT=setTimeout(()=>{armed=false;del.textContent='حذف الحزمة'},4000);return}
      clearTimeout(armT);del.textContent='جارٍ الحذف…';del.disabled=true;
      setTimeout(()=>{
        let res={};try{res=JSON.parse(GN.deletePackTiles(i))}catch(e){}
        renderPacks();
        if(res.ok)$('packProgTxt').textContent='حُذفت بلاطات الحزمة الخاصة بها: '+res.deleted+' بلاطة · '+res.mb+' ميغا حُرّرت. البلاطات المشتركة مع حزم أخرى وطبقة الزوم البعيد بقيت.';
        else $('packProgTxt').textContent='تعذّر الحذف — أعد المحاولة.';
      },30);
    };
    row.appendChild(del);list.appendChild(row);
  });
  partialTiles=data.partialTiles||0;updatePackButtons();renderMapStats();
  if(!(data.packs||[]).length)list.innerHTML='<p class="dim">لا حزم بعد — نزّل أول حزمة من الأعلى.</p>';
  $('tilesSize').textContent='حجم الخرائط على هاتفك الآن: '+(data.tilesMB||0)+' ميغا';
  const hs=$('packStatus');
  if(hs)hs.textContent=(data.tilesMB>0)?('على هاتفك خرائط بحجم '+data.tilesMB+' ميغا — تعمل بلا إنترنت.'):'لا خرائط منزّلة بعد.';
}
let partialTiles=0;
let packQueue=[];
function startPackJob(job){
  packDownloading=true;
  $('packProgWrap').classList.remove('hidden');
  $('packProgBar').style.width='0%';
  if(job.kind==='base'){$('packProgTxt').textContent='بدأ تنزيل خريطة أساس عُمان…';GN.downloadBase()}
  else{$('packProgTxt').textContent='بدأ التنزيل حول «'+job.name+'»…';GN.downloadPack(job.name,job.lat,job.lng,job.radius)}
  updatePackButtons();
}
function queuePack(job){
  if(packQueue.some(q=>q.kind===job.kind&&q.name===job.name)){$('packProgTxt').textContent='«'+job.name+'» في الانتظار أصلًا.';return}
  packQueue.push(job);
  $('packProgTxt').textContent='أُضيفت «'+job.name+'» إلى الانتظار — ستُنزّل تلقائيًا بعد الحالية، دون ضغطة أخرى. ('+packQueue.length+' في الانتظار)';
}
function renderMapStats(){
  const el=$('mapStats');if(!el||!GN||!GN.mapStats)return;
  try{const s=JSON.parse(GN.mapStats());
    el.textContent='على الهاتف الآن: بلاطات متجهية '+(s.vec||0)+' · بلاطات أقمار '+(s.sat||0)+' · ملفات خطوط الأسماء '+(s.glyphs||0)+'/57';
  }catch(e){}
}
function updatePackButtons(){
  $('btnStopPack').style.display=packDownloading?'':'none';
  $('btnDiscardPack').style.display=(packDownloading||partialTiles>0)?'':'none';
}
window.__onPackProgress=p=>{
  $('packProgWrap').classList.remove('hidden');
  const pct=p.total?Math.round(p.done/p.total*100):0;
  $('packProgBar').style.width=pct+'%';
  $('packProgTxt').textContent='جارٍ التنزيل… '+p.done+' / '+p.total+' ('+pct+'٪) — '+(p.layer==='sat'?'طبقة الأقمار':(p.layer==='glyphs'?'خطوط الأسماء العربية':'طبقة الطرق المتجهية'));
  updatePackButtons();
};
window.__onPackDone=r=>{
  packDownloading=false;
  $('btnDownloadPack').disabled=false;
  if(r.discarded){
    $('packProgTxt').textContent='أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.';
    $('packProgBar').style.width='0%';partialTiles=0;
  }else if(r.ok){
    if(r.fresh===0){
      $('packProgTxt').textContent='✅ فُحص '+r.tiles+' عنصرًا — كلها موجودة على هاتفك أصلًا، فلم يُنزَّل شيء جديد. الخريطة جاهزة بلا إنترنت.';
    }else if(r.base){
      $('packProgTxt').textContent='✅ اكتملت حزمة الأساس: '+r.fresh+' عنصر جديد — كل عُمان ظاهرة الآن عند الزوم البعيد.';
    }else{
      $('packProgTxt').textContent='✅ اكتمل التنزيل: '+r.fresh+' عنصر جديد · '+r.mb+' ميغا (من أصل '+r.tiles+' عنصرًا — والباقي كان موجودًا). الخريطة جاهزة بلا إنترنت.';
    }
    $('packProgBar').style.width='100%';partialTiles=0;
    refreshMapStyle();
  }else if(r.cancelled){
    $('packProgTxt').textContent='أُوقف التنزيل — ما نزل يبقى محفوظًا ويُستكمل لاحقًا.';
  }else{
    $('packProgTxt').textContent='تعذّر إكمال التنزيل (انقطع الاتصال؟) — ما نزل محفوظ، أعد المحاولة لاستكمال الباقي.';
  }
  renderPacks();
  // Queue (1.45): a finished download starts the next queued one by itself;
  // any cancel (keep or discard) stops the whole line — predictable.
  if(r.cancelled||r.discarded){packQueue=[]}
  else if(packQueue.length){
    const nxt=packQueue.shift();
    $('packProgTxt').textContent+=' — ويبدأ الآن: '+nxt.name;
    setTimeout(()=>startPackJob(nxt),700);
  }
};
$('btnOpenMap').onclick=openMap;
$('btnOpenMap2').onclick=openMap;
$('btnOpenMapDl').onclick=()=>{showPage('map');setTimeout(()=>{const el=$('packCard');if(el)el.scrollIntoView({behavior:'smooth'})},150)};
$('btnBackFromMap').onclick=()=>showPage('home');
$('btnLayerRoads').onclick=()=>setMapLayer(false);
$('btnLayerSat').onclick=()=>setMapLayer(true);
$('btnHeadingUp').onclick=()=>{headingUp=!headingUp;$('btnHeadingUp').classList.toggle('gold',headingUp);lastBearingApplied=null;if(headingUp){applyHeadingUp()}else if(mapObj){try{mapObj.easeTo({bearing:0,duration:300})}catch(e){}}};
$('btnMyLoc').onclick=()=>{
  if(!myLoc){if(GN&&GN.requestLocation)GN.requestLocation();alert('لا إشارة GPS بعد: امنح التطبيق إذن الموقع وفعّل GPS ثم انتظر ثوانٍ.');return}
  if(mapObj)mapObj.flyTo({center:[myLoc.lng,myLoc.lat],zoom:Math.max(mapObj.getZoom(),12)});
};
let mapFs=false;
$('btnFullMap').onclick=()=>{
  mapFs=!mapFs;
  $('mapCard').classList.toggle('fs',mapFs);
  document.body.classList.toggle('mapfs',mapFs);
  $('btnFullMap').textContent=mapFs?'✕ إغلاق':'⛶ ملء الشاشة';
  try{if(GN&&GN.setImmersive)GN.setImmersive(mapFs)}catch(_){}
  setTimeout(()=>{if(mapObj)mapObj.resize()},140);
  setTimeout(()=>{if(mapObj)mapObj.resize()},450);
};
$('btnPinHere').onclick=()=>{
  if(!myLoc){alert('بانتظار إشارة GPS…');return}
  const d=new Date();const pad=n=>(''+n).padStart(2,'0');
  const nm='مكاني — '+pad(d.getHours())+':'+pad(d.getMinutes());
  const pl=state.places||[];pl.push({name:nm,lat:myLoc.lat,lng:myLoc.lng});
  GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;
  renderPlaces();renderMapPlaces();
  const b=$('btnPinHere');const t=b.textContent;b.textContent='✓ ثُبّت: '+nm;
  setTimeout(()=>{b.textContent=t},2400);
};
$('packCenter').addEventListener('change',refreshPackEst);
document.querySelectorAll('.packR').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.packR').forEach(x=>x.classList.remove('sel'));
  b.classList.add('sel');packRadius=+b.dataset.r;refreshPackEst();
});
$('btnDownloadPack').onclick=()=>{
  if(!GN||!GN.downloadPack)return;
  const c=packCenterCoords();
  if(!c){alert('لا موقع معروف بعد: فعّل GPS وانتظر ثوانٍ، أو بدّل المركز إلى «مركز الخريطة».');return}
  const job={kind:'pack',name:c.name+' ('+packRadius+' كم)',lat:c.lat,lng:c.lng,radius:packRadius};
  if(packDownloading){queuePack(job);return}
  startPackJob(job);
};
$('btnStopPack').onclick=()=>{if(GN&&GN.cancelPack)GN.cancelPack()};
$('btnDiscardPack').onclick=()=>{
  if(!confirm('إلغاء التنزيل وحذف البلاطات التي نزلت في هذه الجلسة؟'))return;
  if(GN&&GN.cancelPackDiscard)GN.cancelPackDiscard();
  if(!packDownloading){partialTiles=0;updatePackButtons();$('packProgTxt').textContent='أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.';$('packProgBar').style.width='0%';setTimeout(renderPacks,400)}
};
function fixAgeMs(){return (myLoc&&myLoc.at)?(Date.now()-myLoc.at):Infinity}
function fmtAge(ms){
  const s=Math.round(ms/1000);
  if(s<90)return'الآن تقريبًا';
  const m=Math.round(s/60);if(m<60)return'قبل '+m+' دقيقة';
  const h=Math.round(m/60);if(h<24)return'قبل '+h+' ساعة';
  return'قبل '+Math.round(h/24)+' يوم';
}
function renderLocStatus(){
  const el=$('locStatus');if(!el)return;
  if(myLoc&&fixAgeMs()<180000){
    el.textContent='📍 موقعك الآن (قراءة حية)'+(myLoc.acc?' — دقة ±'+Math.round(myLoc.acc)+'م':'');
    $('btnLocSettings').classList.add('hidden');
  }else if(myLoc){
    el.textContent='📍 آخر موقع يتذكّره الهاتف — '+fmtAge(fixAgeMs())+(myLoc.acc?'، دقة ±'+Math.round(myLoc.acc)+'م':'')+' — قد لا يكون مكانك الحالي؛ فعّل GPS لتحديثه.';
    $('btnLocSettings').classList.remove('hidden');
  }else{
    el.textContent='📍 موقعك غير معروف بعد — التطبيق لا يستطيع تشغيل GPS بنفسه؛ فعّله من إعدادات الهاتف وامنح التطبيق إذن الموقع.';
    $('btnLocSettings').classList.remove('hidden');
  }
}
$('btnLocSettings').onclick=()=>{if(GN&&GN.openLocationSettings)GN.openLocationSettings()};
$('btnLocOn').onclick=()=>{if(GN&&GN.openLocationSettings)GN.openLocationSettings()};
$('btnClearTiles').onclick=()=>{
  if(!confirm('مسح كل الخرائط المنزّلة وسجلات الحزم؟'))return;
  GN.clearTiles();renderPacks();
  refreshMapStyle();
};
