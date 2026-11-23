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
function gauge(net,obj){
  const bars=$(net==='lte'?'bars4':'bars2'),dbm=$(net==='lte'?'dbm4':'dbm2'),lab=$(net==='lte'?'lab4':'lab2');
  const has=obj&&typeof obj.level==='number';
  [...bars.children].forEach((b,i)=>b.className=has&&i<obj.level?'on':'');
  dbm.textContent=has?(obj.dbm+' dBm'):'—';
  lab.textContent=words(has?obj.level:-1,has);
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
    else{hp.innerHTML='';pl.slice(0,3).forEach(p=>{const d=document.createElement('div');d.className='placeRow';const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';d.innerHTML='<span>📍 <b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';hp.appendChild(d)})}
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
    const del=document.createElement('button');del.textContent='حذف';
    del.onclick=()=>{pl.splice(i,1);GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;renderPlaces();renderArrow()};
    d.appendChild(del);list.appendChild(d);
  });
}
function arrowTargetObj(){
  const v=$('arrowTarget').value;
  if(v==='w'){
    if(!myLoc||!(state.whispers||[]).length)return null;
    let best=null,bd=1e18;state.whispers.forEach(w=>{const d=hav(myLoc.lat,myLoc.lng,w.lat,w.lng);if(d<bd){bd=d;best=w}});
    return best?{lat:best.lat,lng:best.lng,label:'أقرب لمعة ('+(best.net||'')+' '+(best.dbm||'')+'dBm)'}:null;
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
  dEl.textContent=t.label+' • '+fmtDist(d);
}
$('arrowTarget').addEventListener('change',renderArrow);
window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){heading=360-e.alpha;renderArrow();renderHomeArrow()}});

/* ---------- SOS panels ---------- */
function renderSos(){
  const armed=!!state.armed,del=!!state.delivered,sp=!!state.safePending;
  if(armed&&curPage!=='home')showPage('home');
  $('sosIdle').classList.toggle('hidden',armed);
  $('sosArmed').classList.toggle('hidden',!(armed&&!del));
  $('sosSent').classList.toggle('hidden',!(armed&&del));
  $('sosPanel').classList.toggle('dangerCard',armed&&!del);
  if(!armed){
    $('sosReadyState').textContent=sp?'أُلغيت الاستغاثة — رسالة «أنا بخير» تنتظر أول لمعة لتطير.':
      (state.name&&state.recipients?'القوس مشدود: رسالتك مبنية وموقعك يُحدَّث — جاهز للضغطة الواحدة.':'أكمل «الإعداد» أسفل الصفحة أولًا: اسمك ورقم مستقبِل واحد على الأقل.');
  }
  if(armed&&!del)$('sosArmInfo').textContent='سُلّحت '+new Date(state.armedAt||Date.now()).toLocaleTimeString()+' — '+(sig.service?'توجد إشارة الآن، القوس يُطلِق…':'لا إشارة الآن؛ ستنطلق عند أول لمعة.');
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
  gauge('lte',sig.lte);gauge('gsm',sig.gsm);
  $('netState').textContent=(sig.carrier?('المشغّل: '+sig.carrier+' • '):'')+(sig.service?'الخدمة متاحة الآن ✓':'لا خدمة الآن — الحارس يراقب')+(typeof sig.battery==='number'&&sig.battery>=0?(' • البطارية '+sig.battery+'%'):'');
  renderSos();renderFlickers();renderPlaces();renderArrow();renderHome();updateMotion();
}
window.__onLoc=l=>{myLoc=l;renderArrow();renderPlaces()};

/* ---------- actions ---------- */
$('btnAddPlace').onclick=()=>{
  const nm=$('placeName').value.trim();if(!nm){$('placeName').focus();return}
  if(!myLoc){alert('بانتظار إشارة GPS… جرّب قرب نافذة أو في الخارج');return}
  const pl=state.places||[];pl.push({name:nm,lat:myLoc.lat,lng:myLoc.lng});
  GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;$('placeName').value='';renderPlaces();
};
$('btnLogFlicker').onclick=()=>{GN&&GN.addWhisper();setTimeout(refresh,450)};
$('btnNetSettings').onclick=()=>{GN&&GN.openNetworkSettings()};
$('btnNearestFlicker').onclick=()=>{$('arrowTarget').value='w';renderArrow()};
$('btnSOS').onclick=()=>{
  if(!state.name||!state.recipients){alert('أكمل الإعداد أولًا: اسمك ورقم مستقبِل واحد على الأقل (في صفحة «الإعداد»)');showPage('setup');return}
  GN&&GN.armSos();setTimeout(refresh,300);
};
function longPress(btn,fn){
  let timer=null,start=0;
  const down=e=>{e.preventDefault();start=Date.now();btn.style.opacity=.55;
    timer=setInterval(()=>{if(Date.now()-start>=2000){clearInterval(timer);btn.style.opacity=1;fn()}},60)};
  const up=()=>{if(timer)clearInterval(timer);btn.style.opacity=1};
  btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);
}
longPress($('btnCancelSOS'),()=>{GN&&GN.cancelSos();setTimeout(refresh,300)});
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
  curPage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));

/* ---------- caravan: painted caravan, 2-pose walk cycle, endless groups of 4 ---------- */
const wrap=$('sceneWrap'),layer=$('caravan');
let motionUser=true,camelEls=[],camelShadows=[],SLOTS=[],TRACK=0,CDW=0,CH=40,SHIFT=0,lastTs=0;
function caravanInit(){
  if(!ART)return;
  $('sceneBg').src=ART.scene;$('sceneFg').src=ART.scene;
  const k=CH/ART.cellH;CDW=Math.round(ART.cellW*k);
  for(let i=0;i<8;i++){
    const d=document.createElement('div');d.className='camel';
    d.style.width=CDW+'px';d.style.height=CH+'px';
    d.style.backgroundImage='url('+ART.camels+')';
    d.style.backgroundSize=(ART.stripW*k)+'px '+CH+'px';
    d.style.backgroundPosition=(-(i%ART.cells)*CDW)+'px 0px';
    layer.appendChild(d);camelEls.push(d);
    const sh=document.createElement('div');sh.className='cshadow';sh.style.width=Math.round(CDW*0.82)+'px';
    layer.appendChild(sh);camelShadows.push(sh);
  }
  const SP=CDW+6,GG=90;
  for(let g=0;g<2;g++)for(let i=0;i<4;i++)SLOTS.push(g*(4*SP+GG)+i*SP);
  TRACK=2*(4*SP+GG);
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
function caravanLoop(ts){
  requestAnimationFrame(caravanLoop);
  if(!camelEls.length)return;
  const dt=Math.min(250,ts-(lastTs||ts));lastTs=ts;
  const on=motionWanted();wrap.classList.toggle('frozen',!on);
  if(on&&dt>0)SHIFT=(SHIFT+13*dt/1000)%TRACK;
  const stridePx=30;
  camelEls.forEach((d,i)=>{
    let x=((SLOTS[i]-SHIFT)%TRACK+TRACK)%TRACK-CDW-24;
    const ph=(SHIFT+i*11)/stridePx;
    const fr=Math.floor(ph*2)%ART.frames;
    const bob=motionWanted()?Math.sin(ph*2*Math.PI)*0.3:0;
    d.style.transform='translate3d('+x+'px,'+bob+'px,0)';
    d.style.backgroundPosition=(-((fr*ART.cells)+(i%ART.cells))*CDW)+'px 0px';
    camelShadows[i].style.transform='translate3d('+(x+CDW*0.09)+'px,0,0)';
  });
}
caravanInit();
requestAnimationFrame(caravanLoop);
refresh();setInterval(refresh,2500);
