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
window.__onLoc=l=>{myLoc=l;renderArrow();renderPlaces();renderMapUser();renderLocStatus();if(curPage==='map')refreshPackEst()};

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
  if(name==='map')setTimeout(initMap,60);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));

/* ---------- caravan: painted caravan, 2-pose walk cycle, endless groups of 4 ---------- */
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
    const bob=motionWanted()?Math.sin(ph*2*Math.PI)*0.3:0;
    d.style.transform='translate3d('+x+'px,'+bob+'px,0)';
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

/* ---------- offline map (Leaflet + locally downloaded tiles) ---------- */
let mapObj=null,mapRoads=null,mapSat=null,mapUser=null,mapPlaceLayer=null,packRadius=50,packDownloading=false;
function openMap(){showPage('map')}
function initMap(){
  if(!window.L||!GN)return;
  if(!mapObj){
    mapObj=L.map('mapView');
    mapRoads=L.tileLayer('https://tiles.local/roads/{z}/{x}/{y}',{minZoom:3,maxZoom:13,attribution:'© Esri, HERE, Garmin, © OpenStreetMap contributors'});
    mapSat=L.tileLayer('https://tiles.local/sat/{z}/{x}/{y}',{minZoom:3,maxZoom:13,attribution:'© Esri, Maxar, Earthstar Geographics'});
    mapRoads.addTo(mapObj);
    mapPlaceLayer=L.layerGroup().addTo(mapObj);
    mapObj.setView(myLoc?[myLoc.lat,myLoc.lng]:[22.38,57.83],11);
    mapObj.on('moveend',()=>{if($('packCenter').value==='center')refreshPackEst()});
  }
  setTimeout(()=>{mapObj.invalidateSize();renderMapPlaces();renderMapUser()},80);
  fillPackCenters();refreshPackEst();renderPacks();renderLocStatus();updatePackButtons();
}
function setMapLayer(sat){
  if(!mapObj)return;
  if(sat){mapObj.removeLayer(mapRoads);mapSat.addTo(mapObj)}
  else{mapObj.removeLayer(mapSat);mapRoads.addTo(mapObj)}
  $('btnLayerRoads').classList.toggle('gold',!sat);
  $('btnLayerSat').classList.toggle('gold',sat);
}
function renderMapPlaces(){
  if(!mapObj||!mapPlaceLayer)return;
  mapPlaceLayer.clearLayers();
  (state.places||[]).forEach(p=>{
    L.marker([p.lat,p.lng],{icon:L.divIcon({className:'pinIcon',html:'<div class="pin">📍</div>',iconSize:[26,26],iconAnchor:[13,24]})})
      .bindPopup(p.name).addTo(mapPlaceLayer);
  });
}
function renderMapUser(){
  if(!mapObj||!myLoc)return;
  if(!mapUser){
    mapUser=L.marker([myLoc.lat,myLoc.lng],{icon:L.divIcon({className:'meIcon',html:'<div class="meDot"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(mapObj);
  }else mapUser.setLatLng([myLoc.lat,myLoc.lng]);
}
function packCenterCoords(){
  const v=$('packCenter').value;
  if(v==='center'&&mapObj){const c=mapObj.getCenter();return{lat:c.lat,lng:c.lng,name:'مركز الخريطة'}}
  if(v&&v[0]==='p'){const p=(state.places||[])[+v.slice(1)];if(p)return{lat:p.lat,lng:p.lng,name:p.name}}
  if(myLoc)return{lat:myLoc.lat,lng:myLoc.lng,name:'موقعي الحالي'};
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
    $('packEst').textContent='≈ '+info.tiles+' بلاطة (طبقتان) · ≈ '+info.mb+' ميغا · المركز: '+c.name+' · النطاق '+packRadius+' كم';
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
    const del=document.createElement('button');del.className='btn small danger';del.textContent='حذف السجل';
    del.onclick=()=>{GN.deletePack(i);renderPacks()};
    row.appendChild(del);list.appendChild(row);
  });
  partialTiles=data.partialTiles||0;updatePackButtons();
  if(!(data.packs||[]).length)list.innerHTML='<p class="dim">لا حزم بعد — نزّل أول حزمة من الأعلى.</p>';
  $('tilesSize').textContent='حجم الخرائط على هاتفك الآن: '+(data.tilesMB||0)+' ميغا';
  const hs=$('packStatus');
  if(hs)hs.textContent=(data.tilesMB>0)?('على هاتفك خرائط بحجم '+data.tilesMB+' ميغا — تعمل بلا إنترنت.'):'لا خرائط منزّلة بعد.';
}
let partialTiles=0;
function updatePackButtons(){
  $('btnStopPack').style.display=packDownloading?'':'none';
  $('btnDiscardPack').style.display=(packDownloading||partialTiles>0)?'':'none';
}
window.__onPackProgress=p=>{
  $('packProgWrap').classList.remove('hidden');
  const pct=p.total?Math.round(p.done/p.total*100):0;
  $('packProgBar').style.width=pct+'%';
  $('packProgTxt').textContent='جارٍ التنزيل… '+p.done+' / '+p.total+' بلاطة ('+pct+'٪) — '+(p.layer==='sat'?'طبقة الأقمار':'طبقة الطرق');
  updatePackButtons();
};
window.__onPackDone=r=>{
  packDownloading=false;
  $('btnDownloadPack').disabled=false;
  if(r.discarded){
    $('packProgTxt').textContent='أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.';
    $('packProgBar').style.width='0%';partialTiles=0;
  }else if(r.ok){
    $('packProgTxt').textContent='✅ اكتمل التنزيل: '+r.tiles+' بلاطة · '+r.mb+' ميغا. الخريطة جاهزة بلا إنترنت.';
    $('packProgBar').style.width='100%';partialTiles=0;
  }else if(r.cancelled){
    $('packProgTxt').textContent='أُوقف التنزيل — ما نزل يبقى محفوظًا ويُستكمل لاحقًا.';
  }else{
    $('packProgTxt').textContent='تعذّر إكمال التنزيل (انقطع الاتصال؟) — ما نزل محفوظ، أعد المحاولة لاستكمال الباقي.';
  }
  renderPacks();
};
$('btnOpenMap').onclick=openMap;
$('btnOpenMap2').onclick=openMap;
$('btnOpenMapDl').onclick=()=>{showPage('map');setTimeout(()=>{const el=$('packCard');if(el)el.scrollIntoView({behavior:'smooth'})},150)};
$('btnBackFromMap').onclick=()=>showPage('home');
$('btnLayerRoads').onclick=()=>setMapLayer(false);
$('btnLayerSat').onclick=()=>setMapLayer(true);
$('btnMyLoc').onclick=()=>{
  if(!myLoc){if(GN&&GN.requestLocation)GN.requestLocation();alert('لا إشارة GPS بعد: امنح التطبيق إذن الموقع وفعّل GPS ثم انتظر ثوانٍ.');return}
  if(mapObj)mapObj.setView([myLoc.lat,myLoc.lng],Math.max(mapObj.getZoom(),12));
};
$('packCenter').addEventListener('change',refreshPackEst);
document.querySelectorAll('.packR').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.packR').forEach(x=>x.classList.remove('sel'));
  b.classList.add('sel');packRadius=+b.dataset.r;refreshPackEst();
});
$('btnDownloadPack').onclick=()=>{
  if(packDownloading||!GN||!GN.downloadPack)return;
  const c=packCenterCoords();
  if(!c){alert('لا موقع معروف بعد: فعّل GPS وانتظر ثوانٍ، أو بدّل المركز إلى «مركز الخريطة».');return}
  packDownloading=true;$('btnDownloadPack').disabled=true;
  $('packProgWrap').classList.remove('hidden');
  $('packProgBar').style.width='0%';
  $('packProgTxt').textContent='بدأ التنزيل حول «'+c.name+'»…';
  GN.downloadPack(c.name+' ('+packRadius+' كم)',c.lat,c.lng,packRadius);
};
$('btnStopPack').onclick=()=>{if(GN&&GN.cancelPack)GN.cancelPack()};
$('btnDiscardPack').onclick=()=>{
  if(!confirm('إلغاء التنزيل وحذف البلاطات التي نزلت في هذه الجلسة؟'))return;
  if(GN&&GN.cancelPackDiscard)GN.cancelPackDiscard();
  if(!packDownloading){partialTiles=0;updatePackButtons();$('packProgTxt').textContent='أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.';$('packProgBar').style.width='0%';setTimeout(renderPacks,400)}
};
function renderLocStatus(){
  const el=$('locStatus');if(!el)return;
  if(myLoc){
    el.textContent='📍 موقعك معروف الآن'+(myLoc.acc?' — دقة ±'+Math.round(myLoc.acc)+'م':'');
    $('btnLocSettings').classList.add('hidden');
  }else{
    el.textContent='📍 موقعك غير معروف بعد — التطبيق لا يستطيع تشغيل GPS بنفسه؛ فعّله من إعدادات الهاتف وامنح التطبيق إذن الموقع.';
    $('btnLocSettings').classList.remove('hidden');
  }
}
$('btnLocSettings').onclick=()=>{if(GN&&GN.openLocationSettings)GN.openLocationSettings()};
$('btnClearTiles').onclick=()=>{
  if(!confirm('مسح كل الخرائط المنزّلة وسجلات الحزم؟'))return;
  GN.clearTiles();renderPacks();
  if(mapObj){mapObj.removeLayer(mapRoads);mapRoads.addTo(mapObj)}
};
