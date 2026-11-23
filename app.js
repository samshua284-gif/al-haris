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
function gauge(net,obj,otherHas,otherName){
  const bars=$(net==='lte'?'bars4':'bars2'),dbm=$(net==='lte'?'dbm4':'dbm2'),lab=$(net==='lte'?'lab4':'lab2');
  const has=obj&&typeof obj.level==='number';
  [...bars.children].forEach((b,i)=>b.className=has&&i<obj.level?'on':'');
  dbm.textContent=has?(obj.dbm+' dBm'):'—';
  // One SIM camps on one generation at a time: when the other generation is the
  // camped one, say so instead of a bare "no measurement" (1.35).
  lab.textContent=has?words(obj.level,true):(otherHas?('هاتفك على '+otherName+' الآن'):'لا قياس الآن');
}

/* ---------- geo helpers ---------- */
function hav(a,b,c,d){const R=6371000,t=Math.PI/180;const x=(c-a)*t,y=(d-b)*t;const h=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function brg(a,b,c,d){const t=Math.PI/180;const y=Math.sin((d-b)*t)*Math.cos(c*t);const x=Math.cos(a*t)*Math.sin(c*t)-Math.sin(a*t)*Math.cos(c*t)*Math.cos((d-b)*t);return (Math.atan2(y,x)/t+360)%360}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' كم':Math.round(m)+' م'}

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
  if(!pl.length){g.style.opacity=.3;tEl.textContent='أضف مكانًا محفوظًا أولًا';return}
  if(!myLoc){g.style.opacity=.3;tEl.textContent='بانتظار موقعك…';return}
  let best=pl[0],bd=1e18;pl.forEach(p=>{const d=hav(myLoc.lat,myLoc.lng,p.lat,p.lng);if(d<bd){bd=d;best=p}});
  const b=brg(myLoc.lat,myLoc.lng,best.lat,best.lng);const rel=heading==null?b:b-heading;
  g.style.opacity=1;g.style.transform='rotate('+(rel-90)+'deg)';
  tEl.textContent='العودة إلى: '+best.name+' • '+fmtDist(bd);
}
function renderPlaces(){
  renderHome();
  const list=$('placesList');const pl=state.places||[];
  const sel=$('arrowTarget');const cur=sel.value;
  sel.innerHTML='<option value="">— اختر هدف العودة —</option>';
  pl.forEach((p,i)=>{const o=document.createElement('option');o.value='p'+i;o.textContent='📍 '+p.name;sel.appendChild(o)});
  if((state.whispers||[]).length){const o=document.createElement('option');o.value='w';o.textContent='📶 أقرب لمعة معروفة';sel.appendChild(o)}
  if(cur)sel.value=cur;
  if(!pl.length){list.innerHTML='<p class="dim">لا أماكن بعد — التطبيق يبدأ فارغًا تمامًا لأي إنسان في أي بلد، وأنت تثبّت أماكنك بنفسك.</p>';return}
  list.innerHTML='';
  pl.forEach((p,i)=>{
    const d=document.createElement('div');d.className='placeRow';
    const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';
    d.innerHTML='<span><b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';
    d.onclick=e=>{if(e.target.tagName==='BUTTON')return;openMapAt(p.lat,p.lng)};
    const del=document.createElement('button');del.textContent='حذف';
    del.onclick=()=>{pl.splice(i,1);GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;renderPlaces();renderArrow()};
    d.appendChild(del);list.appendChild(d);
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
$('arrowTarget').addEventListener('change',renderArrow);
$('arrowBox').onclick=()=>{const t=arrowTargetObj();if(t)openMapAt(t.lat,t.lng);else openMap()};
$('homeArrowGlyph').onclick=()=>{const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
$('homeArrowText').onclick=()=>{const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){heading=360-e.alpha;renderArrow();renderHomeArrow()}});

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
function renderFlickers(){
  const list=$('flickerList');const ws=state.whispers||[];
  if(!ws.length){list.innerHTML='<p class="dim">لا لمعات مسجلة بعد — كل موضع تلمع فيه شبكة يُحفَظ هنا بصمت، وزرّ «سجّل لمعة هنا» يحفظ موضعك الحالي يدويًا.</p>';return}
  list.innerHTML='';
  ws.slice(-8).reverse().forEach(w=>{
    const d=document.createElement('div');d.className='flickRow';
    d.innerHTML='<span>📶 '+(w.net||'شبكة')+' '+(w.dbm||'')+'dBm</span><span class="dim">'+new Date(w.at).toLocaleString()+'</span>';
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
  gauge('lte',modern,!!(sig.gsm&&typeof sig.gsm.level==='number'),'2G');
  gauge('gsm',sig.gsm,!!(modern&&typeof modern.level==='number'),'شبكة حديثة');
  $('netState').textContent=(sig.carrier?('المشغّل: '+sig.carrier+' • '):'')+(sig.service?'الخدمة متاحة الآن ✓':'لا خدمة الآن — الحارس يراقب')+(sig.camp?(' • مخيّم الآن على '+sig.camp):'')+(typeof sig.battery==='number'&&sig.battery>=0?(' • البطارية '+sig.battery+'%'):'')+(typeof sig.freshSec==='number'&&sig.freshSec>=0?(' • قياس فوري قبل '+sig.freshSec+' ث'):'');
  renderSos();renderFlickers();renderPlaces();renderArrow();renderHome();updateMotion();
}
window.__onLoc=l=>{myLoc=l;renderArrow();renderPlaces();renderMapUser();renderLocStatus();updateNav();if(curPage==='map')refreshPackEst()};

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
function fillSetup(){
  $('inName').value=state.name||'';$('inNumbers').value=state.recipients||'';
  $('inMsg').value=state.template||'';$('inOkMsg').value=state.safeTemplate||'';
}

/* ---------- tabs ---------- */
let curPage='home';
function showPage(name){
  if(name!=='hunt'&&typeof huntTimer!=='undefined'&&huntTimer){clearInterval(huntTimer);huntTimer=null}
  curPage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
  window.scrollTo(0,0);
  if(name==='map')setTimeout(initMap,60);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));

/* ---------- caravan: painted caravan, 6-pose pacing cycle, endless groups of 4 ----------
   1.62 gait merge (Hilal's order): body vertical + sway curves are sampled
   VERBATIM from the CAMEL_GAIT model he brought (double bob, peaks at
   25%/75%; sway ±4.5° damped ×0.25 for a side-view sprite). Pose fractions
   and stride stay as measured from his real camel video — measured beats
   constructed where they overlap. */
const wrap=$('sceneWrap'),layer=$('caravan');
let motionUser=true,camelEls=[],camelShadows=[],printPool=[],lastStep=[],printIdx=0,SLOTS=[],TRACK=0,CDW=0,CH=52,SHIFT=0,lastTs=0;
function caravanInit(){
  if(!ART)return;
  $('sceneBg').src=ART.scene;
  const k=CH/ART.cellH;CDW=Math.round(ART.cellW*k);
  for(let i=0;i<8;i++){
    const d=document.createElement('div');d.className='camel';
    d.style.width=CDW+'px';d.style.height=CH+'px';
    d.style.backgroundImage='url('+ART.camelsA+')';d._h=0;
    d.style.backgroundSize=(ART.halfW*k)+'px '+CH+'px';
    d.style.backgroundPosition=(-(i%ART.cells)*CDW)+'px 0px';
    d.style.transformOrigin='50% 100%';
    layer.appendChild(d);camelEls.push(d);
    const sh=document.createElement('div');sh.className='cshadow';sh.style.width=Math.round(CDW*1.30)+'px';
    layer.appendChild(sh);camelShadows.push(sh);
  }
  const SP=CDW+6,GG=90;
  for(let g=0;g<2;g++)for(let i=0;i<4;i++)SLOTS.push(g*(4*SP+GG)+i*SP);
  TRACK=2*(4*SP+GG);
  for(let j=0;j<30;j++){const u=document.createElement('div');u.className='puff';u.style.opacity='0';layer.appendChild(u);printPool.push({puff:u,born:-1e9,fx:0})}
}
function motionWanted(){
  if(!motionUser)return false;
  if(curPage!=='home')return false;
  if(state.armed)return false;
  if(typeof sig.battery==='number'&&sig.battery>=0&&sig.battery<20)return false;
  if(document.hidden)return false;
  return true;
}
function updateMotion(){
  const on=motionWanted();
  $('animState').textContent=state.armed?'الحركة مجمّدة — وضع الخطر':(!motionUser?'القافلة ثابتة — كما في الصورة':(typeof sig.battery==='number'&&sig.battery<20?'الحركة مجمّدة — البطارية ضعيفة':'قافلتك تمشي…'));
  $('btnAnim').textContent=motionUser?'إيقاف الحركة':'تشغيل الحركة';
}
$('btnAnim').onclick=()=>{motionUser=!motionUser;updateMotion()};
/* CAMEL_GAIT body curves (model Hilal brought, 2026-11-23): vertical_m and
   sway_deg at 13 keyframes 0..100% — sampled with the same lerp as camelPose. */
const GAIT_V=[0.035,0.048,0.073,0.085,0.073,0.048,0.035,0.048,0.072,0.085,0.073,0.048,0.035];
const GAIT_S=[0,2.2,3.9,4.5,3.9,2.2,0,-2.3,-3.9,-4.5,-3.9,-2.3,0];
function gaitSample(arr,u){const x=u*(arr.length-1),i=Math.min(Math.floor(x),arr.length-2),a=x-i;return arr[i]+(arr[i+1]-arr[i])*a}
function caravanLoop(ts){
  requestAnimationFrame(caravanLoop);
  if(!camelEls.length)return;
  const dt=Math.min(250,ts-(lastTs||ts));lastTs=ts;
  const on=motionWanted();wrap.classList.toggle('frozen',!on);
  if(on&&dt>0)SHIFT=(SHIFT+11*dt/1000)%TRACK;
  const stridePx=24;
  camelEls.forEach((d,i)=>{
    let x=((SLOTS[i]-SHIFT)%TRACK+TRACK)%TRACK-CDW-24;
    const ph=(SHIFT+i*11)/stridePx;
    const uu=ph-Math.floor(ph);const fr=uu<0.22?0:uu<0.35?4:uu<0.53?3:uu<0.66?5:uu<0.88?1:2;
    const bob=on?-(gaitSample(GAIT_V,uu)-0.06)*44:0;
    const sway=on?gaitSample(GAIT_S,uu)*0.25:0;
    d.style.transform='translate3d('+x+'px,'+bob.toFixed(2)+'px,0) rotate('+sway.toFixed(2)+'deg)';
    const cell=(fr*ART.cells)+(i%ART.cells),half=cell>=12?1:0;
    if(d._h!==half){d.style.backgroundImage='url('+(half?ART.camelsB:ART.camelsA)+')';d._h=half}
    d.style.backgroundPosition=(-((cell%12)*CDW))+'px 0px';
    camelShadows[i].style.transform='translate3d('+(x-CDW*0.26)+'px,0,0) rotate(-3deg)';
    const sIdx=Math.floor(ph*2);
    if(lastStep[i]===undefined)lastStep[i]=sIdx;
    if(motionWanted()&&sIdx!==lastStep[i]&&printPool.length){
      lastStep[i]=sIdx;
      const pr=printPool[printIdx++%printPool.length];pr.born=ts;
      pr.fx=x+CDW*0.42+(sIdx%2)*4;
    }
  });
  printPool.forEach(pr=>{const age=(ts-pr.born)/1000;
    if(age<1.2){pr.puff.style.opacity=String(Math.max(0,1-age/1.2)*0.5);pr.puff.style.transform='translate3d('+(pr.fx-5+7*age)+'px,'+(-3*age)+'px,0) scale('+(1+1.1*age)+')'}
    else{pr.puff.style.opacity='0'}
  });
}
caravanInit();
requestAnimationFrame(caravanLoop);
refresh();setInterval(refresh,2500);

/* ---------- offline map (MapLibre vector engine + locally downloaded tiles) ---------- */
let mapObj=null,mapSatMode=false,mapMarkers=[],mapUserMarker=null,mapStyleOk=false,packRadius=50,packDownloading=false;
let navTarget=null,navArrowMarker=null;
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
  st.sources.satimg={type:'raster',tiles:['https://app.local/sat/{z}/{x}/{y}'],tileSize:256,maxzoom:15,attribution:'© Esri, Maxar, Earthstar Geographics'};
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
        attributionControl:{compact:true},minZoom:7,maxZoom:17});
      mapObj.addControl(new maplibregl.NavigationControl({showCompass:false}));
      mapObj.on('load',()=>{mapStyleOk=true;renderMapPlaces();renderMapUser()});
      mapObj.on('style.load',()=>{ensureNav();updateNav()});
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
    del.onclick=()=>{
      const pl=(state.places||[]).filter(q=>q!==p);
      GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;
      pop.remove();renderPlaces();renderArrow();renderMapPlaces();
    };
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
    src.setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});
    if(navArrowMarker){navArrowMarker.remove();navArrowMarker=null}
    return;
  }
  src.setData({type:'Feature',geometry:{type:'LineString',coordinates:[[myLoc.lng,myLoc.lat],[navTarget.lng,navTarget.lat]]}});
  const b=brg(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
  const ax=myLoc.lng+(navTarget.lng-myLoc.lng)*0.85,ay=myLoc.lat+(navTarget.lat-myLoc.lat)*0.85;
  if(!navArrowMarker){
    const el=document.createElement('div');el.className='navArrow';el.innerHTML='<span></span>';
    navArrowMarker=new maplibregl.Marker({element:el}).setLngLat([ax,ay]).addTo(mapObj);
  }else navArrowMarker.setLngLat([ax,ay]);
  const sp=navArrowMarker.getElement().firstChild;
  if(sp)sp.style.transform='rotate('+b+'deg)';
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
  if(GN.basePackInfo){try{
    const bi=JSON.parse(GN.basePackInfo());
    $('baseInfo').textContent='حزمة الأساس: كل عُمان عند الزوم البعيد (طرق + أقمار، ~'+bi.mb+' ميغابايت) — تُنزَّل مرة واحدة فلا يختفي ما حول منطقتك عند التصغير.';
  }catch(e){}}
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
$('btnBasePack').onclick=()=>{
  if(!GN||!GN.downloadBase)return;
  const job={kind:'base',name:'خريطة أساس عُمان'};
  if(packDownloading){queuePack(job);return}
  startPackJob(job);
};
$('btnOpenMap').onclick=openMap;
$('btnOpenMap2').onclick=openMap;
$('btnOpenMapDl').onclick=()=>{showPage('map');setTimeout(()=>{const el=$('packCard');if(el)el.scrollIntoView({behavior:'smooth'})},150)};
$('btnBackFromMap').onclick=()=>showPage('home');
$('btnLayerRoads').onclick=()=>setMapLayer(false);
$('btnLayerSat').onclick=()=>setMapLayer(true);
$('btnMyLoc').onclick=()=>{
  if(!myLoc){if(GN&&GN.requestLocation)GN.requestLocation();alert('لا إشارة GPS بعد: امنح التطبيق إذن الموقع وفعّل GPS ثم انتظر ثوانٍ.');return}
  if(mapObj)mapObj.flyTo({center:[myLoc.lng,myLoc.lat],zoom:Math.max(mapObj.getZoom(),12)});
};
let mapFs=false;
$('btnFullMap').onclick=()=>{
  mapFs=!mapFs;
  $('mapCard').classList.toggle('fs',mapFs);
  $('btnFullMap').textContent=mapFs?'✕ إغلاق':'⛶ ملء الشاشة';
  setTimeout(()=>{if(mapObj)mapObj.resize()},140);
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
$('btnClearTiles').onclick=()=>{
  if(!confirm('مسح كل الخرائط المنزّلة وسجلات الحزم؟'))return;
  GN.clearTiles();renderPacks();
  refreshMapStyle();
};
