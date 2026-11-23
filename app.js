'use strict';
const $=id=>document.getElementById(id);
const GN=window.GN||null;
const J=(s,d)=>{try{return JSON.parse(s)}catch(e){return d}};
let state={},sig={},myLoc=null,heading=null,target=null,targetKind='place',beaconOn=false;

function words(level,has){if(!has)return'لا قياس الآن';return['شبه معدوم','ضعيف','متوسط','جيد','ممتاز'][level]||'—'}
function gauge(net,obj){
  const bars=$(net==='lte'?'bars4':'bars2'),dbm=$(net==='lte'?'dbm4':'dbm2'),w=$(net==='lte'?'word4':'word2');
  const has=obj&&typeof obj.level==='number';
  [...bars.children].forEach((b,i)=>b.className=has&&i<obj.level?'on':'');
  dbm.textContent=has?(obj.dbm+' dBm'):'—';
  w.textContent=words(obj?obj.level:-1,has);
}
function hav(a,b,c,d){const R=6371000,t=Math.PI/180;const x=(c-a)*t,y=(d-b)*t;const h=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function brg(a,b,c,d){const t=Math.PI/180;const y=Math.sin((d-b)*t)*Math.cos(c*t);const x=Math.cos(a*t)*Math.sin(c*t)-Math.sin(a*t)*Math.cos(c*t)*Math.cos((d-b)*t);return (Math.atan2(y,x)/t+360)%360}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' كم':Math.round(m)+' م'}

function renderPlaces(){
  const list=$('placesList');const pl=state.places||[];
  if(!pl.length){list.innerHTML='<div class="mut">لا أماكن بعد — التطبيق يبدأ فارغًا، وأنت تثبّت أماكنك بنفسك.</div>';return}
  list.innerHTML='';
  pl.forEach((p,i)=>{
    const d=document.createElement('div');d.className='place'+(target&&targetKind==='place'&&target.i===i?' sel':'');
    const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';
    d.innerHTML='<b>'+p.name+'</b><span class="mut">'+dist+'</span>';
    const btn=document.createElement('button');btn.textContent='هدف';btn.onclick=()=>{target={i};targetKind='place';renderPlaces();renderArrow()};
    const del=document.createElement('button');del.textContent='✕';del.onclick=()=>{pl.splice(i,1);GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;renderPlaces()};
    const r=document.createElement('span');r.append(btn,document.createTextNode(' '),del);d.appendChild(r);list.appendChild(d);
  });
}
function nearestWhisper(){
  if(!myLoc||!state.whispers||!state.whispers.length)return null;
  let best=null,bd=1e18;state.whispers.forEach(w=>{const d=hav(myLoc.lat,myLoc.lng,w.lat,w.lng);if(d<bd){bd=d;best=w}});
  return best?{w:best,d:bd}:null;
}
function renderArrow(){
  const t=$('arrowText'),ar=$('arrow');
  let tgt=null,label='';
  if(targetKind==='whisper'){const n=nearestWhisper();if(n){tgt=n.w;label='أقرب لمعة ('+(n.w.net||'')+' '+(n.w.dbm||'')+'dBm)'}}
  else if(target&&state.places&&state.places[target.i]){tgt=state.places[target.i];label=tgt.name}
  if(!tgt||!myLoc){t.textContent=tgt?'بانتظار موقعك…':'ثبّت مكانًا واختره هدفًا';return}
  const d=hav(myLoc.lat,myLoc.lng,tgt.lat,tgt.lng),b=brg(myLoc.lat,myLoc.lng,tgt.lat,tgt.lng);
  const rel=heading==null?b:b-heading;
  ar.style.transform='rotate('+(rel-90)+'deg)';
  t.textContent=label+' • '+fmtDist(d)+' • اتجاه '+Math.round(b)+'°'+(heading==null?' (حرّك هاتفك للمعايرة)':'');
}
function renderSos(){
  const armed=state.armed,del=state.delivered,sp=state.safePending;
  $('sosPanel').classList.toggle('hidden',!(armed||sp));
  $('btnSos').classList.toggle('hidden',!!armed);
  $('sceneCard').classList.toggle('hidden',!!armed);
  if(armed&&!del){$('sosStatus').textContent='الاستغاثة مُسلَّحة — أراقب الإشارة';$('sosDetail').textContent=sig.service?'توجد إشارة الآن — يُطلَق القوس…':'لا إشارة الآن — ضغطتك محفوظة وستطير عند أول لمعة'}
  if(armed&&del){$('sosStatus').textContent='✓ وصلت رسالة الاستغاثة';$('sosDetail').textContent='أُرسلت '+new Date(state.deliveredAt).toLocaleTimeString()}
  if(!armed&&sp){$('sosStatus').textContent='أُلغيت الاستغاثة — رسالة «أنا بخير» تنتظر أول لمعة';$('sosDetail').textContent=''}
  $('idName').textContent=state.name||'—';
  $('idLoc').textContent=myLoc?('آخر موقع: '+myLoc.lat.toFixed(5)+', '+myLoc.lng.toFixed(5)):'';
}
function renderWhispers(){
  const n=(state.whispers||[]).length;
  $('whisperInfo').textContent=n?('سُجّلت '+n+' لمعة. آخرها: '+new Date(state.whispers[n-1].at).toLocaleString()):'لا لمعات مسجلة بعد. كل موضع تلمع فيه شبكة يُحفظ هنا بصمت.';
}
function refresh(){
  if(!GN)return;
  sig=J(GN.getSignal(),{});state=J(GN.getState(),{});
  const loc=J(GN.getLocation(),{});if(loc.lat)myLoc=loc;
  gauge('lte',sig.lte);gauge('gsm',sig.gsm);
  $('carrierLine').textContent=(sig.carrier?('المشغّل: '+sig.carrier+' • '):'')+(sig.service?'الخدمة متاحة الآن ✓':'لا خدمة الآن — الحارس يراقب')+' • البطارية '+(sig.battery>=0?sig.battery+'%':'—');
  renderSos();renderWhispers();renderPlaces();renderArrow();
  if(state.armed&&motionOn)setMotion(false);
}
window.__onLoc=l=>{myLoc=l;renderArrow();renderPlaces()};
window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){heading=360-e.alpha;renderArrow()}});

/* ---- actions ---- */
$('btnAddPlace').onclick=()=>{
  const nm=$('placeName').value.trim();if(!nm){$('placeName').focus();return}
  if(!myLoc){alert('بانتظار إشارة GPS…');return}
  const pl=state.places||[];pl.push({name:nm,lat:myLoc.lat,lng:myLoc.lng});
  GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;$('placeName').value='';renderPlaces();
};
$('btnNearWhisper').onclick=()=>{targetKind='whisper';renderArrow()};
$('btnClearTarget').onclick=()=>{targetKind='place';renderArrow()};
$('btnWhisper').onclick=()=>{GN&&GN.addWhisper();setTimeout(refresh,400)};
$('btn2g').onclick=()=>{GN&&GN.openNetworkSettings()};
$('btnSos').onclick=()=>{
  if(!state.name||!state.recipients){$('sosWarn').classList.remove('hidden');window.scrollTo(0,document.body.scrollHeight);return}
  $('sosWarn').classList.add('hidden');GN&&GN.armSos();setTimeout(refresh,300);
};
let cancelTimer=null,cancelStart=0;
const cbtn=$('btnCancel');
function cancelDown(e){e.preventDefault();cancelStart=Date.now();$('cancelProg').style.width='0';
  cancelTimer=setInterval(()=>{const f=(Date.now()-cancelStart)/2500;$('cancelProg').style.width=Math.min(100,f*100)+'%';
    if(f>=1){clearInterval(cancelTimer);$('cancelProg').style.width='0';GN&&GN.cancelSos();setTimeout(refresh,300)}},50)}
function cancelUp(){if(cancelTimer){clearInterval(cancelTimer);$('cancelProg').style.width='0'}}
cbtn.addEventListener('pointerdown',cancelDown);cbtn.addEventListener('pointerup',cancelUp);cbtn.addEventListener('pointerleave',cancelUp);
$('btnBeacon').onclick=()=>{beaconOn=!beaconOn;GN&&GN.beacon(beaconOn);document.body.classList.toggle('strobe',beaconOn);$('btnBeacon').textContent=beaconOn?'إيقاف المنارة':'تشغيل المنارة (صوت + وميض)'};
$('btnSaveSetup').onclick=()=>{
  GN&&GN.saveSetup($('inName').value,$('inRecipients').value,$('inTemplate').value,$('inSafe').value);
  $('setupOk').classList.remove('hidden');setTimeout(refresh,300);
};
function fillSetup(){
  if(state.name!==undefined){$('inName').value=state.name||'';$('inRecipients').value=state.recipients||'';$('inTemplate').value=state.template||'';$('inSafe').value=state.safeTemplate||''}
}

/* ---- caravan: endless loop, groups of 4, clear lane, trees behind ---- */
const cv=$('scene'),ctx=cv.getContext('2d');
let W=0,H=0,motionOn=true,trees=[],train=[],CYCLE=0;
const GAP=64,GROUPGAP=110,NCAM=4;
function buildTrain(){
  train=[];const total=3;let x=W+40;
  for(let g=0;g<total;g++){for(let i=0;i<NCAM;i++){train.push({x:x,ph:Math.random()*6.28});x+=GAP}x+=GROUPGAP}
  CYCLE=total*(NCAM*GAP+GROUPGAP);
  trees=[];for(let i=0;i<6;i++)trees.push({x:Math.random()*(W+200)-100,s:.6+Math.random()*.7,bush:Math.random()<.4});
}
function resize(){const r=cv.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);cv.width=r.width*dpr;cv.height=150*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);W=r.width;H=150;if(!train.length)buildTrain()}
window.addEventListener('resize',resize);
function palette(){
  const h=new Date().getHours()+new Date().getMinutes()/60;
  if(h>=19.5||h<4.5)return{sky:['#060a18','#141b33'],dune:'#3a2c1c',dune2:'#2a2013',sil:'#120b06',sun:null,stars:true};
  if(h<6.5)return{sky:['#2b1a2e','#c96f35'],dune:'#8a5c2c',dune2:'#66431f',sil:'#241407',sun:.12,stars:false};
  if(h<16.5)return{sky:['#7db4e6','#e8d9a8'],dune:'#d9ab5e',dune2:'#b98a3e',sil:'#4a2f14',sun:.85,stars:false};
  return{sky:['#1c1430','#e07f2e'],dune:'#9c6527',dune2:'#75501f',sil:'#2a180a',sun:.3,stars:false};
}
function drawCamel(x,ground,ph,t,sil){
  const s=1.0,bob=Math.sin(ph*2)*1.1;
  ctx.save();ctx.translate(x,ground+bob);ctx.fillStyle=sil;ctx.strokeStyle=sil;
  // legs — pacing gait: same-side legs together
  ctx.lineWidth=2.4;ctx.lineCap='round';
  const sw=Math.sin(ph)*7,sw2=Math.sin(ph+Math.PI)*7;
  const leg=(hx,off)=>{const kx=hx+off*.55,fx=hx+off;ctx.beginPath();ctx.moveTo(hx,-20);ctx.lineTo(kx,-10);ctx.lineTo(fx,0);ctx.stroke()};
  ctx.globalAlpha=.55;leg(-15,sw2);leg(14,sw);ctx.globalAlpha=1;leg(-15,sw);leg(14,sw2);
  // body
  ctx.beginPath();ctx.ellipse(0,-25,23,7.5,0,0,6.29);ctx.fill();
  // hump (dromedary: one)
  ctx.beginPath();ctx.ellipse(1,-31,8.5,5.5,0,Math.PI,0);ctx.fill();
  // neck + head, facing left
  ctx.beginPath();ctx.moveTo(-19,-28);ctx.quadraticCurveTo(-27,-36,-31,-43);ctx.lineTo(-27,-45);ctx.quadraticCurveTo(-22,-37,-15,-31);ctx.fill();
  ctx.beginPath();ctx.ellipse(-33,-44,4.6,2.6,-.5,0,6.29);ctx.fill();
  // tail
  ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(22,-27);ctx.quadraticCurveTo(26,-20,25,-13+Math.sin(t/300+x)*1.5);ctx.stroke();
  // saddle + rider, rope HELD in rider's hand to the head
  ctx.fillStyle='#7a4a21';ctx.fillRect(-5,-36,12,4);
  ctx.fillStyle=sil;
  ctx.beginPath();ctx.ellipse(1,-41,3.4,4.6,0,0,6.29);ctx.fill(); // torso
  ctx.beginPath();ctx.arc(1,-48.5,2.7,0,6.29);ctx.fill(); // head
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-44);ctx.lineTo(-7,-33);ctx.stroke(); // leg
  ctx.beginPath();ctx.moveTo(0,-43);ctx.lineTo(-24,-45);ctx.stroke(); // arm forward holding rope
  ctx.strokeStyle='rgba(230,200,140,.85)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(-24,-45);ctx.lineTo(-32,-44);ctx.stroke(); // the held rope
  ctx.restore();
}
function drawScene(t){
  const p=palette();const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,p.sky[0]);g.addColorStop(1,p.sky[1]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(p.stars){ctx.fillStyle='#fff';for(let i=0;i<40;i++){ctx.globalAlpha=.35+.3*Math.sin(t/700+i);ctx.fillRect((i*97)%W,(i*53)%70,1.6,1.6)}ctx.globalAlpha=1}
  if(p.sun!=null){const sx=W*.78,sy=H*(0.75-p.sun*.55);const sg=ctx.createRadialGradient(sx,sy,2,sx,sy,34);sg.addColorStop(0,'rgba(255,214,120,.95)');sg.addColorStop(1,'rgba(255,160,60,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy,34,0,6.29);ctx.fill();ctx.fillStyle='#ffd678';ctx.beginPath();ctx.arc(sx,sy,10,0,6.29);ctx.fill()}
  // far dunes
  ctx.fillStyle=p.dune2;ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=8)ctx.lineTo(x,H-38+Math.sin(x*.012+2)*7);
  ctx.lineTo(W,H);ctx.fill();
  // background trees/bushes — behind the lane, sliding slowly
  trees.forEach(tr=>{const bx=((tr.x-(t*.006))%(W+160)+(W+160))%(W+160)-80;const gy=H-34;
    ctx.strokeStyle=p.sil;ctx.fillStyle=p.sil;
    if(tr.bush){ctx.beginPath();ctx.ellipse(bx,gy-3,10*tr.s,4*tr.s,0,0,6.29);ctx.fill()}
    else{ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(bx,gy);ctx.lineTo(bx,gy-20*tr.s);ctx.stroke();
      ctx.beginPath();ctx.ellipse(bx,gy-24*tr.s,15*tr.s,5.5*tr.s,0,0,6.29);ctx.fill()}});
  // near dune + clear walking lane
  ctx.fillStyle=p.dune;ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=8)ctx.lineTo(x,H-16+Math.sin(x*.02)*3);
  ctx.lineTo(W,H);ctx.fill();
  const ground=H-14;
  // caravan (draw right-to-left so leaders overlap correctly), inter-camel ropes
  const sorted=[...train].sort((a,b)=>b.x-a.x);
  ctx.strokeStyle='rgba(60,35,15,.6)';ctx.lineWidth=1;
  for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];if(b.x-a.x<GAP+30){ctx.beginPath();ctx.moveTo(a.x+20,ground-33);ctx.lineTo(b.x-30,ground-42);ctx.stroke()}}
  sorted.forEach(c=>drawCamel(c.x,ground,c.ph+t*.005,t,p.sil));
}
let lastT=0;
function loop(t){
  if(motionOn){train.forEach(c=>{c.x-=.55;if(c.x<-70)c.x+=CYCLE});drawScene(t)}
  requestAnimationFrame(loop);
}
function setMotion(on){motionOn=on;$('btnMotion').textContent=on?'إيقاف الحركة':'تشغيل الحركة';$('sceneNote').textContent=on?'قافلتك تمشي…':'القافلة ثابتة — كما في الصورة';if(!on)drawScene(performance.now())}
$('btnMotion').onclick=()=>setMotion(!motionOn);
resize();requestAnimationFrame(loop);
refresh();fillSetup();setInterval(refresh,2500);
