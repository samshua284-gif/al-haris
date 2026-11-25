'use strict';
const $=id=>document.getElementById(id);
const GN=window.GN||null;
const ART=window.ART||null;
const J=(s,d)=>{try{return JSON.parse(s)}catch(e){return d}};
let state={},sig={},myLoc=null,heading=null,beaconOn=false,setupFilled=false;

/* ---------- i18n (1.138, Hilal's order): Arabic + English ----------
   uiLang persists on the phone; L(ar,en) picks per call site; static
   HTML texts swap through the AR2EN table by exact text-node match;
   the frozen prayer sentence is never translated (data-nolang). */
let uiLang='ar';try{uiLang=localStorage.getItem('uiLang')||'ar'}catch(e){}
function L(ar,en){return uiLang==='en'?en:ar}
const AR2EN={
'الحارس':'The Guardian','سلامة صحراوية — يعمل بلا إنترنت':'Desert safety — works with no internet',
'قافلتك تمشي…':'Your caravan is walking…','إيقاف الحركة':'Stop motion',
'عدّاد قوة إشارة':'Signal strength meter','🔄 تحديث القياس الآن':'🔄 Measure now',
'📍 قوة الإشارة تنتظر تشغيل الموقع — أندرويد يحجب قراءات الأبراج والموقع مغلق.':'📍 Signal strength needs Location on — Android hides tower readings while Location is off.',
'افتح إعدادات الموقع في الهاتف':"Open the phone's Location settings",'فتح إعدادات الموقع':'Open Location settings',
'سجّل لمعة هنا':'Log a flicker here','فتح إعدادات الشبكة (فرض 2G)':'Open network settings (force 2G)','فتح إعدادات الشبكة':'Open network settings',
'🎯 صيد الإشارة':'🎯 Signal hunt','دلّني إلى أقرب لمعة معروفة':'Guide me to the nearest known flicker',
'سهم اتجاه العودة':'Return direction arrow','المكان المثبّت الجديد':'Newest pinned place',
'اضغط السهم لعرض الهدف على الخريطة، واتبع إشارة السهم إلى مكانك.':'Tap the arrow to show the target on the map, and follow the arrow back to your place.',
'🔄 البدء من جديد':'🔄 Start over','↩ العودة إلى مكان مثبّت':'↩ Return to a pinned place',
'«البدء من جديد» يمسح هدف العودة ويوقف الإرشاد. و«العودة إلى مكان مثبّت» تفتح أماكنك المحفوظة بأسمائها الحالية — اختر واحدًا فيشير السهم إليه، واضغط السهم نفسه لعرضه على الخريطة.':'"Start over" clears the return target and stops guidance. "Return to a pinned place" opens your saved places under their current names — pick one and the arrow points to it; tap the arrow itself to show it on the map.',
'🆘 استغاثة SOS':'🆘 SOS',
'زرّ الاستغاثة يفتح تطبيق رسائلك ورسالتك مبنية كاملة بموقعك الحي — تضغط «إرسال» هناك مرة واحدة. لا يُرسَل شيء تلقائيًا من هنا.':'The SOS button opens your Messages app with your message fully built with your live location — you tap "Send" there once. Nothing is sent automatically from here.',
'📩 افتحها في تطبيق الرسائل — إرسال مضمون من هاتفك':'📩 Open it in Messages — sending guaranteed from your phone',
'إلغاء الاستغاثة (اضغط مطوّلًا)':'Cancel SOS (press and hold)','أنا بخير — ألغِ الاستغاثة (اضغط مطوّلًا)':"I'm fine — cancel the SOS (press and hold)",
'ستُرسَل رسالة «أنا بخير» عند أول لمعة بنفس آلية القوس المشدود.':'An "I am fine" message will be sent at the first flicker, with the same drawn-bow mechanism.',
'🔴 مُسلَّحة — أراقب الشبكة… ستطير رسالتك عند أول لمعة تغطية.':'🔴 Armed — watching the network… your message will fly at the first flicker of coverage.',
'الضغطة المطوّلة مقصودة — حماية من اللمس العارض في الجيب.':'The long press is intentional — protection against accidental touches in your pocket.',
'الخريطة — تعمل بلا إنترنت':'The map — works with no internet','افتح الخريطة':'Open the map',
'الرئيسية':'Home','الأماكن':'Places','المنارة':'Beacon','الإعداد':'Settings',
'أماكن محفوظة':'Saved places','اضغط أي مكان محفوظ لعرضه على الخريطة.':'Tap any saved place to show it on the map.',
'📌 ثبّت مكاني':'📌 Pin my location','الخريطة دون اتصال':'The offline map',
'أماكنك المحفوظة وموقعك على خريطة منزّلة تعمل في قلب الصحراء.':'Your saved places and your position on a downloaded map that works in the heart of the desert.',
'تظهر فقط المناطق التي نزّلتها. النقطة الزرقاء موقعك، والدبابيس أماكنك المحفوظة. الأسماء بالعربية من بيانات © OpenStreetMap contributors عبر OpenFreeMap · صور الأقمار © Esri':'Only areas you downloaded appear. The blue dot is you; the pins are your saved places. Names from © OpenStreetMap contributors data via OpenFreeMap · Satellite imagery © Esri',
'طرق':'Roads','أقمار':'Satellite','🧭 اتجاهي':'🧭 My heading','◎ موقعي':'◎ My location','⛶ ملء الشاشة':'⛶ Fullscreen','→ عودة إلى الرئيسية':'→ Back to home',
'تنزيل حزمة خرائط':'Download a map pack',
'نزّل وأنت متصل بالإنترنت. إذن الإنترنت في هذا التطبيق للتنزيل وحده — الخريطة نفسها تعمل بلا اتصال.':'Download while you are online. Internet permission in this app is for downloading only — the map itself works offline.',
'مركز الحزمة':'Pack centre','موقعي الحالي':'My current location','النطاق':'Range',
'٢٥ كم':'25 km','٥٠ كم':'50 km','٥٠٠ كم':'500 km',
'حزمة ٥٠٠ كم «ذكية»: أدقّ التفاصيل قرب المركز، وتقلّ تدريجيًا كلما ابتعدت — فتبقى بحجم معقول بدل أكثر من غيغا.':'The 500 km pack is "smart": finest detail near the centre, easing off as you go further — so it stays a reasonable size instead of over a gigabyte.',
'نزّل الحزمة (طرق متجهية + أقمار — أسماء الأماكن بلغة التطبيق)':'Download the pack (vector roads + satellite — place names in the app language)',
'إيقاف التنزيل (يبقى ما نزل)':'Stop download (keep what arrived)','إلغاء التنزيل (حذف ما نزل)':'Cancel download (delete what arrived)',
'حزمي المنزّلة':'My downloaded packs','إيقاف التحديث':'Stop update',
'مسح كل الخرائط المنزّلة':'Erase all downloaded maps','منارة وبطاقة هوية':'Beacon & ID card',
'المنارة: صوت إنذار ووميض شاشة يدلّ المنقذين عليك في الظلام. وبطاقة الهوية تحمل اسمك وآخر موقع معروف لمن يجد هاتفك.':'The beacon: an alarm sound and a flashing screen to guide rescuers to you in the dark. The ID card carries your name and last known location for whoever finds your phone.',
'تشغيل المنارة':'Start the beacon','إيقاف المنارة':'Stop the beacon',
'اسمك':'Your name','أرقام الاستغاثة (حتى ٣، واحد في كل سطر)':'SOS numbers (up to 3, one per line)',
'نص الرسالة — المتغيرات: {name} {loc} {bat} {time}':'Message text — variables: {name} {loc} {bat} {time}',
'نص رسالة الطمأنينة':'The "I am fine" message text',
'اكتب اسمك ورقم الهاتف فقط، والباقي — موقعك وبطاريتك والوقت — يُكتب تلقائيًا عند ضغط زر الاستغاثة.':'Write only your name and the phone number; the rest — your location, battery and the time — is written automatically when you press the SOS button.',
'✅ تأكّد وصول رسالة الاستغاثة إلى هاتف المستقبِل (تقرير تسليم من الشبكة).':"✅ Confirm the SOS message reached the recipient's phone (a delivery report from the network).",
'حفظ الإعداد':'Save settings','مستودع المشروع على GitHub':'Project repository on GitHub','📋 نسخ الرابط':'📋 Copy link','إعادة الضبط — مسح ما كتبتُه بيدي':'Reset — erase what I wrote by hand',
'كل شيء يُحفَظ على هاتفك فقط. لا حسابات ولا خوادم ولا إنترنت.':'Everything is stored on your phone only. No accounts, no servers, no internet.',
'الحارس 1.143 — مشروع مجاني لكل إنسان، في كل بلد.':'The Guardian 1.143 — a free project for every human, in every country.',
'✅ أنا بخير — ألغِ الاستغاثة':'✅ I am fine — cancel the SOS',
'🎯 وضع صيد الإشارة — امشِ واتبع القوة':'🎯 Signal hunt mode — walk and follow the strength',
'2G — شبكة الاستغاثة':'2G — the SOS network',
'الصيد يحتاج حركة: امشِ ١٠–٢٠ مترًا في اتجاه، وراقب المؤشّر، ثم جرّب اتجاهًا آخر وقارن.':'Hunting needs movement: walk 10–20 metres in one direction, watch the indicator, then try another direction and compare.',
'أفضل نقطة في هذا الصيد: —':'Best point in this hunt: —','أرني الأفضل على الخريطة':'Show me the best on the map','✕ إنهاء الصيد':'✕ End the hunt',
'خريطة اللمعات':'Flicker map','خرائط طرق + صور أقمار — تُنزَّل مرة واحدة ثم تعمل بلا إنترنت أبدًا.':'Road maps + satellite imagery — downloaded once, then they work with no internet, ever.',
'لا خرائط منزّلة بعد.':'No downloaded maps yet.','تنزيل حزمة':'Download a pack',
'ابدأ المشي…':'Start walking…','ثبّت مكاني':'Pin my location','حزمة خرائط للتحميل':'A map pack to download',
'٥ د':'5 min','١٠ د':'10 min','١٥ د':'15 min','٣٠ د':'30 min','٥ د ▾':'5 min ▾',
'المؤشّر يقارن قوة آخر ثوانٍ بما قبلها على الشبكة المختارة وحدها. يقودك إلى نقطة تعمل فيها الإشارة — لا إلى البرج نفسه. القوة تتذبذب ±٥ dBm طبيعيًا، فاعتمد اتجاه المؤشّر عبر خطوات، لا قراءة واحدة.':'The indicator compares the last few seconds with what came before, on the chosen network only. It leads you to a point where the signal works — not to the tower itself. Strength naturally fluctuates ±5 dBm, so trust the indicator across steps, not a single reading.'
};
function applyStaticLang(){
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
    const p=n.parentElement;if(!p)return NodeFilter.FILTER_REJECT;
    if(p.closest('[data-nolang]'))return NodeFilter.FILTER_REJECT;
    if(p.tagName==='SCRIPT'||p.tagName==='STYLE')return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;}});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(n=>{
    if(n.__ar===undefined)n.__ar=n.nodeValue;
    const ar=n.__ar,t=ar.trim();
    if(uiLang==='en'){if(AR2EN[t])n.nodeValue=ar.replace(t,AR2EN[t])}
    else n.nodeValue=ar;
  });
  document.querySelectorAll('[data-ph-ar]').forEach(el=>{el.placeholder=uiLang==='en'?el.dataset.phEn:el.dataset.phAr});
  document.title=uiLang==='en'?'The Guardian':'الحارس';
}
function localizeStyle(st){
  if(uiLang!=='en'||!st)return st;
  const c=JSON.parse(JSON.stringify(st));
  (c.layers||[]).forEach(ly=>{const tf=ly.layout&&ly.layout['text-field'];
    if(Array.isArray(tf)&&tf[0]==='coalesce')ly.layout['text-field']=['coalesce',['get','name_en'],['get','name'],['get','name:nonlatin'],['get','name:ar']];});
  return c;
}
function setLang(l){
  uiLang=l;try{localStorage.setItem('uiLang',l)}catch(e){}
  document.documentElement.lang=l;document.documentElement.dir=(l==='en'?'ltr':'rtl');
  if(GN&&GN.setUiLang)GN.setUiLang(l);
  const bl=$('btnLang');if(bl)bl.textContent=(l==='en'?'🌐 عربي':'🌐 English');
  const ta=$('tickAr'),te=$('tickEn');
  if(ta)ta.style.visibility=l==='ar'?'visible':'hidden';
  if(te)te.style.visibility=l==='en'?'visible':'hidden';
  applyStaticLang();
  // 1.140: refill the setup fields too — fillSetup runs only once per
  // session, so after a language switch the template fields kept
  // showing the previous language's default (Hilal's report). The
  // native side already returns the current language's template;
  // a custom text is returned unchanged in both languages, so
  // refilling never loses his own words.
  setupFilled=false;
  try{refresh()}catch(e){}
  try{renderPacks()}catch(e){}
  try{salawatPaint()}catch(e){}
  try{renderLocStatus()}catch(e){}
  try{fillPackCenters();refreshPackEst()}catch(e){}
  if(typeof mapObj!=='undefined'&&mapObj)try{refreshMapStyle()}catch(e){}
}


/* ---------- gauges ---------- */
function buildBars(el){el.innerHTML='';for(let i=0;i<5;i++){const b=document.createElement('i');b.style.height=(7+i*5.5)+'px';el.appendChild(b)}}
buildBars($('bars4'));buildBars($('bars2'));
function words(level,has){if(!has)return L('لا قياس الآن','No reading yet');return[L('شبه معدوم','Almost none'),L('ضعيف','Weak'),L('متوسط','Medium'),L('جيد','Good'),L('ممتاز','Excellent')][level]||'—'}
// 1.84: the age label tells the truth — «فوري» only while the snapshot is
// genuinely fresh (<=30s); after that it is «آخر قياس» with minutes.
function freshTxt(sec){
  if(typeof sec!=='number'||sec<0)return'';
  if(uiLang==='en'){
    if(sec<=30)return' • live reading '+sec+'s ago';
    if(sec<120)return' • last reading '+sec+'s ago';
    return' • last reading '+Math.round(sec/60)+' min ago';
  }
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
  lab.textContent=has?words(lvl,true):(otherHas?L('هاتفك على '+otherName+' الآن','Your phone is on '+otherName+' now'):L('لا قياس الآن','No reading yet'));
}

/* ---------- geo helpers ---------- */
function hav(a,b,c,d){const R=6371000,t=Math.PI/180;const x=(c-a)*t,y=(d-b)*t;const h=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function brg(a,b,c,d){const t=Math.PI/180;const y=Math.sin((d-b)*t)*Math.cos(c*t);const x=Math.cos(a*t)*Math.sin(c*t)-Math.sin(a*t)*Math.cos(c*t)*Math.cos((d-b)*t);return (Math.atan2(y,x)/t+360)%360}
function fmtDist(m){if(m==null||!isFinite(m))return '—';return m>=1000?(m/1000).toFixed(1)+L(' كم',' km'):Math.round(m)+L(' م',' m')}
function chipDist(m){return m<1000?Math.round(m/5)*5+L(' م',' m'):(m<10000?(m/1000).toFixed(2)+L(' كم',' km'):fmtDist(m))}

/* ---------- places & arrow ---------- */
function renderHome(){
  const pl=state.places||[];const hp=$('homePlaces');
  if(hp){
    if(!pl.length)hp.innerHTML='<p class="dim">'+L('لا أماكن بعد — ثبّت أماكنك من تبويب «الأماكن» فتظهر هنا.','No places yet — pin your places from the Places tab and they will appear here.')+'</p>';
    else{hp.innerHTML='';pl.slice(0,3).forEach(p=>{const d=document.createElement('div');d.className='placeRow';const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';d.innerHTML='<span>📍 <b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';d.onclick=()=>openMapAt(p.lat,p.lng);hp.appendChild(d)})}
  }
  renderHomeArrow();
}
function renderHomeArrow(){
  const g=$('homeArrowGlyph'),tEl=$('homeArrowText');if(!g||!tEl)return;
  const pl=state.places||[];
  let t=null;try{t=arrowTargetObj()}catch(_){}
  if(!t&&!pl.length){g.style.opacity=.3;tEl.textContent=L('أضف مكانًا محفوظًا أولًا','Add a saved place first');return}
  if(startedOver){g.style.opacity=.3;tEl.textContent=L('بدأت من جديد — اختر مكانًا للعودة إليه','Started over — choose a place to return to');return}
  if(!myLoc){g.style.opacity=.3;tEl.textContent=L('بانتظار موقعك…','Waiting for your location…');return}
  let name,bd,b;
  if(t){name=t.label;bd=hav(myLoc.lat,myLoc.lng,t.lat,t.lng);b=brg(myLoc.lat,myLoc.lng,t.lat,t.lng)}
  else{/* 1.156 (Hilal's field discovery, 2026-11-24): skip the pin he is
     standing on (<=30 m) when another place exists. He would pin a
     destination, walk back to his start pin, and the auto arrow kept
     pointing at the START pin under his feet while nothing pointed at the
     destination pin. The flicker picker already had this "you are here"
     skip; places now have it too. */
    let best=null,near=pl[0],nd2=1e18;bd=1e18;pl.forEach(p=>{const d=hav(myLoc.lat,myLoc.lng,p.lat,p.lng);if(d<nd2){nd2=d;near=p}if(d>30&&d<bd){bd=d;best=p}});if(!best){best=near;bd=nd2}name=best.name;b=brg(myLoc.lat,myLoc.lng,best.lat,best.lng)}
  const _ph=phoneHeading();const rel=_ph==null?b:b-_ph;
  g.style.opacity=1;g.style.transform='rotate('+(rel-90)+'deg)';
  tEl.textContent=L('العودة إلى: ','Back to: ')+name+' • '+fmtDist(bd);
}
let _selSig='';let placeEditOpen=false;
function renderPlaces(){
  renderHome();renderJourney();
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
    sel.innerHTML='<option value="">'+L('— اختر هدف العودة —','— Choose a return target —')+'</option>';
    pl.forEach((p,i)=>{const o=document.createElement('option');o.value='p'+i;o.textContent='📍 '+p.name;sel.appendChild(o)});
    if((state.whispers||[]).length){const o=document.createElement('option');o.value='w';o.textContent=L('📶 أقرب لمعة معروفة','📶 Nearest known flicker');sel.appendChild(o)}
    if(cur)sel.value=cur;
  }
  if(!pl.length){list.innerHTML='<p class="dim">'+L('لا أماكن بعد — التطبيق يبدأ فارغًا تمامًا لأي إنسان في أي بلد، وأنت تثبّت أماكنك بنفسك.','No places yet — the app starts completely empty for any person in any country; you pin your own places yourself.')+'</p>';return}
  list.innerHTML='';
  pl.forEach((p,i)=>{
    const d=document.createElement('div');d.className='placeRow';
    const dist=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)):'';
    d.innerHTML='<span><b>'+p.name+'</b> <span class="dim">'+dist+'</span></span>';
    d.onclick=e=>{if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT')return;const sel=$('arrowTarget');if(sel)sel.value='p'+i;startedOver=false;journeyPin=null;openMapAt(p.lat,p.lng);renderArrow();renderHomeArrow()};
    const ren=document.createElement('button');ren.textContent=L('تسمية','Rename');ren.className='ren';
    ren.onclick=()=>{placeEditOpen=true;
      const inp=document.createElement('input');inp.className='inp';inp.value=p.name;
      const save=document.createElement('button');save.textContent=L('حفظ','Save');save.className='ren';
      d.innerHTML='';d.appendChild(inp);d.appendChild(save);inp.focus();inp.select();
      save.onclick=()=>{placeEditOpen=false;const nn=inp.value.trim();if(nn&&nn!==p.name){p.name=nn;GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;try{renderMapPlaces()}catch(_){}}renderPlaces();renderArrow()};
    };
    const del=document.createElement('button');del.textContent=L('حذف','Delete');
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
      label:L('أقرب لمعة (','Nearest flicker (')+(pick.net||'')+' '+(pick.dbm||'')+'dBm)'}:null;
  }
  if(v&&v[0]==='p'){const p=(state.places||[])[+v.slice(1)];if(p)return{lat:p.lat,lng:p.lng,label:p.name}}
  return null;
}
function renderArrow(){
  const t=arrowTargetObj(),g=$('arrowGlyph'),dEl=$('arrowDist');
  if(!g||!dEl)return; // 1.154: the places-page arrow card no longer exists
  if(!t){g.style.opacity=.3;dEl.textContent='—';return}
  if(!myLoc){g.style.opacity=.3;dEl.textContent=L('بانتظار موقعك…','Waiting for your location…');return}
  const d=hav(myLoc.lat,myLoc.lng,t.lat,t.lng),b=brg(myLoc.lat,myLoc.lng,t.lat,t.lng);
  const _ph=phoneHeading();const rel=_ph==null?b:b-_ph;
  g.style.opacity=1;g.style.transform='rotate('+(rel-90)+'deg)';
  dEl.textContent=t.label+' • '+(t.here?L('أنت عندها الآن — على بُعد '+fmtDist(d)+' فقط','You are there now — only '+fmtDist(d)+' away'):fmtDist(d));
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
    if(!pl.length&&!(state.whispers||[]).length){box.innerHTML='<p class="dim">'+L('لا أماكن مثبّتة بعد — ثبّت مكانك أولًا من تبويب «الأماكن».','No pinned places yet — pin your place first from the Places tab.')+'</p>';return}
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
    if((state.whispers||[]).length)mk(L('📶 <b>أقرب لمعة معروفة</b>','📶 <b>Nearest known flicker</b>'),'','w');
  });
}
function startOver(){
  const sel=$('arrowTarget');if(sel)sel.value='';
  startedOver=true;
  journeyPin=null;
  navLine=null;
  navTarget=null;locCadence();try{updateNav()}catch(_){}
  renderArrow();renderHomeArrow();renderReturnLists();
  openMap();
  if(myLoc&&mapObj){try{mapObj.easeTo({center:[myLoc.lng,myLoc.lat],zoom:Math.max(mapObj.getZoom(),15)})}catch(_){}}
}
[['btnStartOverH',startOver],
 ['btnReturnPickH',()=>{returnListOpen=!returnListOpen;renderReturnLists()}]
].forEach(([id,fn])=>{const b=$(id);if(b)b.onclick=fn});
const jpEl=$('journeyPlace');if(jpEl)jpEl.onclick=()=>{const pl=state.places||[];if(!pl.length)return;const p=pl[pl.length-1];journeyPin={lat:p.lat,lng:p.lng};openMapAt(p.lat,p.lng)};
$('homeArrowGlyph').onclick=()=>{if(startedOver){returnListOpen=true;renderReturnLists();return}const t=arrowTargetObj();if(t){openMapAt(t.lat,t.lng);return}const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
$('homeArrowText').onclick=()=>{if(startedOver){returnListOpen=true;renderReturnLists();return}const t=arrowTargetObj();if(t){openMapAt(t.lat,t.lng);return}const p=nearestPlace();if(p)openMapAt(p.lat,p.lng);else openMap()};
let headingUp=false,lastBearingApplied=null,courseFix=null,gpsCourse=null,gpsCourseTs=0;
function effHeading(){return (gpsCourse!=null&&Date.now()-gpsCourseTs<25000)?gpsCourse:phoneHeading()}
let azNative=null,azNativeTs=0;
window.__onAz=a=>{if(isFinite(a)){azNative=+a;azNativeTs=Date.now();renderCompass();renderArrow();renderHomeArrow();applyHeadingUp();updatePtr()}};
function phoneHeading(){return (azNative!=null&&Date.now()-azNativeTs<3000)?azNative:heading}
let calmBeyondSince=0,calmBeyondDir=0;
function applyHeadingUp(){if(!headingUp||!mapObj)return;const eh=effHeading();if(eh==null)return;
  // 1.176 (Hilal asked why the map moves so much, then ruled: "if the
  // map calms, the pointer calms" — the pointer counter-rotates against
  // the map's bearing, so a swimming map swims it too). The old 3-deg
  // deadband was crossed by every handheld wobble, so the map eased
  // constantly. Now the applied bearing is a HELD reference: headings
  // within 8 deg of it are shiver — the map holds perfectly still. A
  // real turn re-aims by gliding the reference 35% of the arc per call,
  // settling within the 8-deg band of his true front (invisible against
  // 45-deg compass sectors).
  if(lastBearingApplied==null){lastBearingApplied=eh;try{mapObj.easeTo({bearing:eh,duration:250})}catch(e){}return}
  const err=((eh-lastBearingApplied+540)%360)-180;
  if(Math.abs(err)<=8){calmBeyondSince=0;calmBeyondDir=0;return}
  // A slow wander can sit beyond 8 deg too — so a re-aim must be PROVEN:
  // the heading has to stay beyond the band, on the same side, for
  // 600 ms before the map believes it is a real turn. Shiver flickers
  // back inside the band and keeps resetting the proof.
  const dir=err>0?1:-1,now=Date.now();
  if(dir!==calmBeyondDir){calmBeyondDir=dir;calmBeyondSince=now;return}
  if(now-calmBeyondSince<600)return;
  lastBearingApplied=(lastBearingApplied+err*0.35+360)%360;
  try{mapObj.easeTo({bearing:lastBearingApplied,duration:200})}catch(e){}}
window.addEventListener('deviceorientation',e=>{if(e.alpha!=null){heading=360-e.alpha;renderArrow();renderHomeArrow();applyHeadingUp();renderCompass();updatePtr()}});

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
    $('sosReadyState').textContent=sp?L('أُلغيت الاستغاثة — رسالة «أنا بخير» تنتظر أول لمعة لتطير.','The SOS was cancelled — the "I am fine" message waits for the first flicker to fly.'):
      (state.name&&state.recipients?L('رسالتك مبنية وموقعك يُحدَّث — الزرّ يفتحها في تطبيق رسائلك جاهزة، وتضغط «إرسال» هناك.','Your message is built and your location updates — the button opens it ready in your Messages app, and you tap "Send" there.'):L('أكمل «الإعداد» أسفل الصفحة أولًا: اسمك ورقم مستقبِل واحد على الأقل.','Complete "Settings" at the bottom of the page first: your name and at least one recipient number.'));
  }
  if(armed&&!del){
    // 1.54: the rejection reason must show in BOTH armed branches — after a
    // radio rejection sent_at clears, so 1.52/1.53 (error line only in the
    // "sent" branch) never displayed the very code they captured.
    const errSuffix=(state.sendError>0)?(()=>{const errs={1:L('خطأ عام من الشبكة','General network error'),2:L('الراديو مغلق (وضع طيران؟)','Radio off (airplane mode?)'),3:L('بنية رسالة فارغة','Empty message body'),4:L('لا خدمة خلوية في تلك اللحظة','No cellular service at that moment'),5:L('تجاوز حدّ إرسال الرسائل','Message sending limit exceeded'),6:L('قيود أرقام ثابتة (FDN)','Fixed dialling number (FDN) restrictions'),7:L('الرقم القصير محظور','Short code blocked'),8:L('الرقم القصير محظور دائمًا','Short code permanently blocked'),9:L('الراديو غير متاح','Radio not available'),10:L('رفض صريح من الشبكة','Explicit network rejection'),15:L('خطأ في النظام','System error'),16:L('خطأ في المودم','Modem error'),17:L('خطأ شبكة لحظة الإرسال — كثيرًا ما يرتبط بمكالمات الواي فاي؛ جرّب إطفاء الواي فاي','Network error at send time — often linked to Wi-Fi calling; try turning Wi-Fi off'),18:L('خطأ في ترميز الرسالة','Message encoding error'),30:L('فشلت إعادة محاولة الإرسال','The send retry failed')};return L(' ⚠ آخر محاولة رفضها الهاتف: ',' ⚠ The phone rejected the last attempt: ')+(errs[state.sendError]||(L('رمز ','code ')+state.sendError))+L(' — تُعاد المحاولة تلقائيًا كل دقيقة.',' — it retries automatically every minute.');})():'';
    if(sent){
      $('sosArmHead').textContent=L('🔴 أُطلقت الرسالة — أراقب تأكيد الوصول من الشبكة…','🔴 Message launched — watching for the network delivery confirmation…');
      $('sosArmInfo').textContent=L('أُطلقت ','Launched at ')+new Date(state.sentAt||Date.now()).toLocaleTimeString()+L(' إلى ',' to ')+(state.recipients||'').replace(/\s*\n\s*/g,L('، ', ', '))+L(' — إن لم يتأكد الوصول خلال ٣ دقائق تُعاد تلقائيًا عند أول لمعة.',' — if delivery is not confirmed within 3 minutes, it retries automatically at the first flicker.')+errSuffix;
    }else{
      $('sosArmHead').textContent=L('🔴 مُسلَّحة — أراقب الشبكة… ستطير رسالتك عند أول لمعة تغطية.','🔴 Armed — watching the network… your message will fly at the first flicker of coverage.');
      $('sosArmInfo').textContent=L('سُلّحت ','Armed at ')+new Date(state.armedAt||Date.now()).toLocaleTimeString()+' — '+(sig.service?L('توجد إشارة الآن، القوس يُطلِق…','There is signal now — the bow is loosing…'):L('لا إشارة الآن؛ ستنطلق عند أول لمعة.','No signal now; it will launch at the first flicker.'))+errSuffix;
    }
  }
  $('idCard').innerHTML='<b>'+(state.name||'—')+'</b><br>'+(myLoc?(L('آخر موقع معروف: ','Last known location: ')+myLoc.lat.toFixed(5)+' , '+myLoc.lng.toFixed(5)):L('الموقع: بانتظار GPS','Location: waiting for GPS'))+'<br><span class="dim">'+L('للمنقذين: هذا هاتف صاحبه؛ أرقام الاستغاثة محفوظة في التطبيق.',"For rescuers: this is the owner's phone; the SOS numbers are saved in the app.")+'</span>';
}

/* ---------- flickers ---------- */
let _flickSig='';
function renderFlickers(){
  const list=$('flickerList');const ws=state.whispers||[];
  // 1.96: same anti-flicker guard — redraw only when the log truly changes.
  const fsig=ws.length+'|'+(ws.length?ws[ws.length-1].at:'');
  if(fsig===_flickSig)return; _flickSig=fsig;
  if(!ws.length){list.innerHTML='<p class="dim">'+L('لا لمعات مسجلة بعد — كل موضع تلمع فيه شبكة يُحفَظ هنا بصمت، وزرّ «سجّل لمعة هنا» يحفظ موضعك الحالي يدويًا.','No flickers recorded yet — every spot where a network flickers is saved here silently, and the Log-a-flicker button saves your current spot manually.')+'</p>';return}
  list.innerHTML='';
  ws.slice(-8).reverse().forEach(w=>{
    const d=document.createElement('div');d.className='flickRow';
    d.innerHTML='<span>📶 '+(w.net||L('شبكة','network'))+' '+(w.dbm||'')+'dBm</span><span class="dim">'+new Date(w.at).toLocaleString()+'</span>';
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
  gauge('gsm',sig.gsm,!!(modern&&typeof modern.level==='number'),L('شبكة حديثة','a modern network'));
  // 1.173: airplane mode gets its own truthful line — no service claim,
  // no camp, and no «fresh measurement» stamp on a frozen snapshot.
  $('netState').textContent=sig.airplane
    ?(L('✈ وضع الطيران مفعّل — الإشارات مطفأة الآن','✈ Airplane mode is on — the radios are off now')+(typeof sig.battery==='number'&&sig.battery>=0?(L(' • البطارية ',' • battery ')+sig.battery+'%'):''))
    :(sig.carrier?(L('المشغّل: ','Carrier: ')+sig.carrier+' • '):'')+(sig.service?L('الخدمة متاحة الآن ✓','Service available now ✓'):L('لا خدمة الآن — الحارس يراقب','No service now — the Guardian is watching'))+(sig.camp?(L(' • مخيّم الآن على ',' • camped now on ')+sig.camp):'')+(typeof sig.battery==='number'&&sig.battery>=0?(L(' • البطارية ',' • battery ')+sig.battery+'%'):'')+freshTxt(sig.freshSec);
  const _lo=$('sigLocOff');if(_lo)_lo.classList.toggle('hidden',sig.locOn!==false);
  renderSos();renderFlickers();renderPlaces();renderArrow();renderHome();updateMotion();renderReturnLists();
  if(uiLang==='en')applyStaticLang();
}
/* 1.157 (Hilal's field report, 2026-11-24): "large metre numbers appear
   then disappear, and the arrow is unstable". Root cause: this phone also
   delivers NETWORK fixes, which in open desert can land hundreds of metres
   away; each one teleported his dot, swung every arrow and made the
   counter leap. fixSane refuses a reading that is far coarser than the one
   already held, or that jumps farther in under 10 s than its own accuracy
   allows. releaseArrivedTarget closes the first/second pin file at the
   root: when he ARRIVES at the explicitly chosen return pin (<=30 m) the
   choice is released, so the home arrow rolls on to the next pin instead
   of clinging to the one under his feet. */
const sessionStartTs=Date.now();
function fixSane(l){
  if(!myLoc)return true;
  const la=+l.acc, ma=+myLoc.acc;
  if(isFinite(la)&&la>150&&(!isFinite(ma)||ma<=150))return false;
  if(l.at&&myLoc.at&&l.at>myLoc.at&&l.at-myLoc.at<10000){
    // 1.168: cold-start correction — in the first 15 s of a session a fix
    // at least 3x more accurate than the planted one may jump freely to
    // the truth (a coarse first fix after reopening must not imprison
    // the dot hundreds of metres away until the jump window passes).
    if(Date.now()-sessionStartTs<15000&&isFinite(la)&&isFinite(ma)&&la*3<=ma)return true;
    const jump=hav(myLoc.lat,myLoc.lng,l.lat,l.lng);
    if(jump>120+(isFinite(la)?la:0)+(isFinite(ma)?ma:0))return false;
  }
  return true;
}
/* 1.158: a soft bell for every pin (Hilal's idea) — when he steps into a
   pin's ZERO ZONE (the pin inside his own accuracy halo, at least 15 m,
   at most 50 m) the bell rings ONCE; it re-arms only after he walks
   25 m beyond the zone, so boundary jitter never repeats it. The active
   navigation target and every saved place are watched. */
let pinBellState={}, pinBellSeen={}, lastBellTs=0;
function checkPinBells(){
  if(!myLoc)return;
  // 1.162: the bell belongs to a JOURNEY, not to sitting in the app —
  // Hilal reported it chiming on its own in the interface while he sat at
  // his campsite, where both his pins are. Two rules: it rings only while
  // guidance is active (a nav target or a journey pin is set), and only
  // on a genuine ENTRY crossing — a session that starts inside a zone
  // counts as already inside and stays silent until he leaves the zone
  // (25 m past it) and truly returns.
  const active=!!(navTarget||journeyPin);
  const zone=Math.min(50,Math.max(15,(+myLoc.acc)||0));
  const targets=[];
  if(navTarget)targets.push({k:'nav:'+navTarget.lat.toFixed(5)+','+navTarget.lng.toFixed(5),lat:navTarget.lat,lng:navTarget.lng});
  (state.places||[]).forEach(p=>targets.push({k:'p:'+p.lat.toFixed(5)+','+p.lng.toFixed(5),lat:p.lat,lng:p.lng}));
  targets.forEach(t=>{
    const d=hav(myLoc.lat,myLoc.lng,t.lat,t.lng);
    if(!pinBellSeen[t.k]){pinBellSeen[t.k]=true;pinBellState[t.k]=(d<=zone);return}
    if(d<=zone&&!pinBellState[t.k]){
      pinBellState[t.k]=true;
      if(active&&Date.now()-lastBellTs>=3000){lastBellTs=Date.now();try{GN&&GN.playBell&&GN.playBell()}catch(_){}}
    }else if(d>zone+25&&pinBellState[t.k])pinBellState[t.k]=false;
  });
}
function releaseArrivedTarget(){
  const sel=$('arrowTarget');
  if(!sel||!sel.value||sel.value[0]!=='p'||!myLoc)return;
  const t=arrowTargetObj();
  if(t&&hav(myLoc.lat,myLoc.lng,t.lat,t.lng)<=30){sel.value='';startedOver=false}
}
window.__onLoc=l=>{if(l&&l.lat){if(!fixSane(l))return;if(courseFix&&hav(courseFix.lat,courseFix.lng,l.lat,l.lng)>=6){gpsCourse=brg(courseFix.lat,courseFix.lng,l.lat,l.lng);gpsCourseTs=Date.now();courseFix=l}else if(!courseFix)courseFix=l}myLoc=l;releaseArrivedTarget();renderArrow();renderPlaces();renderJourney();renderMapUser();renderLocStatus();updateNav();checkPinBells();renderCompass();applyHeadingUp();if(curPage==='map')refreshPackEst()}

/* ---------- actions ---------- */
$('btnAddPlace').onclick=()=>{
  let nm=$('placeName').value.trim();
  if(!nm){ // no name typed: auto-name by time, exactly like the map's quick pin (1.40)
    const d=new Date();const pad=n=>(''+n).padStart(2,'0');
    nm=L('مكاني — ','My place — ')+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  if(!myLoc){alert(L('بانتظار إشارة GPS… جرّب قرب نافذة أو في الخارج','Waiting for a GPS signal… try near a window or outdoors'));return}
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
  $('huntDbm').textContent=dbm===null?L('لا إشارة','No signal'):(dbm+' dBm');
  const recent=huntSamples.filter(x=>now-x.t<=12000),prior=huntSamples.filter(x=>now-x.t>12000&&now-x.t<=24000);
  const mean=a=>a.reduce((x,y)=>x+y.dbm,0)/a.length;
  const tr=$('huntTrend');
  if(dbm===null){tr.className='flat';tr.textContent=L('لا إشارة الآن على ','No signal now on ')+(huntNet==='gsm'?'2G':'4G')+L(' — تحرّك، أو بدّل الشبكة، أو افرضها من الإعدادات.',' — move, switch network, or force it in Settings.')}
  else if(recent.length>=3&&prior.length>=3){
    const d=mean(recent)-mean(prior);
    if(d>=2){tr.className='up';tr.textContent=L('▲ الإشارة تقوى — واصل بهذا الاتجاه','▲ Signal strengthening — keep going this way')}
    else if(d<=-2){tr.className='down';tr.textContent=L('▼ الإشارة تضعف — ارجع أو غيّر اتجاهك','▼ Signal weakening — go back or change direction')}
    else{tr.className='flat';tr.textContent=L('● ثابتة تقريبًا — جرّب اتجاهًا آخر','● Roughly steady — try another direction')}
  }else{tr.className='flat';tr.textContent=L('أجمع القراءات… واصل المشي','Collecting readings… keep walking')}
  if(huntBest){
    const bd=myLoc?fmtDist(hav(myLoc.lat,myLoc.lng,huntBest.lat,huntBest.lng)):'';
    $('huntBest').textContent=L('أفضل نقطة في هذا الصيد: ','Best point in this hunt: ')+huntBest.dbm+' dBm'+(bd?L(' — على بُعد ',' — ')+bd+L(' منك الآن',' from you now'):'');
    $('btnHuntBestMap').disabled=false;
  }
}
function openHunt(){
  huntSamples=[];huntBest=null;
  $('huntBest').textContent=L('أفضل نقطة في هذا الصيد: —','Best point in this hunt: —');$('btnHuntBestMap').disabled=true;
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
  if(!state.name||!state.recipients){alert(L('أكمل الإعداد أولًا: اسمك ورقم مستقبِل واحد على الأقل (في صفحة «الإعداد»)','Complete the setup first: your name and at least one recipient number (on the Settings page)'));showPage('setup');return}
  // 1.59 (Hilal's order): the SOS button no longer arms or sends anything —
  // it opens the stock Messages app with the SOS built and addressed; his
  // own tap on Send there is the only send. A stale arm is disarmed silently.
  if(state.armed&&GN&&GN.disarmSilent)GN.disarmSilent();
  GN&&GN.sendViaComposer&&GN.sendViaComposer();
  setTimeout(refresh,300);
};
$('btnSafeSend').onclick=()=>{
  if(!state.name||!state.recipients){alert(L('أكمل الإعداد أولًا: اسمك ورقم مستقبِل واحد على الأقل (في صفحة «الإعداد»)','Complete the setup first: your name and at least one recipient number (on the Settings page)'));showPage('setup');return}
  // 1.142: the all-clear twin of the SOS button — opens the stock
  // Messages composer with the safe template built; he sends it himself.
  GN&&GN.sendSafeViaComposer&&GN.sendSafeViaComposer();
};
// 1.144: project-repository row at the foot of the Settings page —
// tapping the link hands the URL to the phone's browser (the app
// itself stays permission-free), and the copy button puts the link
// on the clipboard for sharing onward.
$('repoLink').onclick=e=>{
  e.preventDefault();
  if(GN&&GN.openRepo)GN.openRepo();
  else alert('github.com/samshua284-gif/al-haris');
};
$('btnCopyRepo').onclick=()=>{
  if(GN&&GN.copyRepoLink)GN.copyRepoLink();
  toast(L('نُسخ الرابط — الصقه أين تشاء','Link copied — paste it anywhere'));
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
if($('btnRefreshSignal'))$('btnRefreshSignal').onclick=()=>{const b=$('btnRefreshSignal');GN&&GN.refreshSignal&&GN.refreshSignal();b.textContent=L('جارٍ القياس…','Measuring…');setTimeout(refresh,700);setTimeout(refresh,1800);setTimeout(()=>{refresh();b.textContent=L('🔄 تحديث القياس الآن','🔄 Measure now')},3500);};
longPress($('btnCancelAfter'),()=>{GN&&GN.cancelSos();setTimeout(refresh,300)});
$('btnBeacon').onclick=()=>{beaconOn=true;GN&&GN.beacon(true);document.body.classList.add('beaconOn');$('btnBeacon').classList.add('hidden');$('btnBeaconOff').classList.remove('hidden')};
$('btnBeaconOff').onclick=()=>{beaconOn=false;GN&&GN.beacon(false);document.body.classList.remove('beaconOn');$('btnBeacon').classList.remove('hidden');$('btnBeaconOff').classList.add('hidden')};
$('btnSaveSetup').onclick=()=>{
  GN&&GN.saveSetup($('inName').value,$('inNumbers').value,$('inMsg').value,$('inOkMsg').value);
  setupFilled=true;setTimeout(refresh,300);alert(L('حُفظ الإعداد على هاتفك ✓','Settings saved on your phone ✓'));
};
$('btnResetSetup').onclick=()=>{
  if(!confirm(L('سيُمسح الاسم وأرقام الاستغاثة وأي نص كتبتَه بيدك، وتعود القوالب الافتراضية. متأكد؟','Your name, SOS numbers and any text you wrote by hand will be erased, and the default templates return. Are you sure?')))return;
  GN&&GN.saveSetup('','','','');
  setupFilled=false;setTimeout(refresh,300);alert(L('أُعيد الضبط — عاد الإعداد كما في أول تشغيل ✓','Reset done — settings are back to first-run ✓'));
};
function fillSetup(){
  $('inName').value=state.name||'';$('inNumbers').value=state.recipients||'';
  $('inMsg').value=state.template||'';$('inOkMsg').value=state.safeTemplate||'';
}

/* ---------- tabs ---------- */
let curPage='home';
let locFastWanted=null;
function locCadence(){
  const fast=(curPage==='map'||!!navTarget||!!journeyPin);
  if(fast===locFastWanted)return;
  locFastWanted=fast;
  try{GN&&GN.setLocFast&&GN.setLocFast(fast)}catch(_){}
}
function showPage(name){
  if(name!=='hunt'&&typeof huntTimer!=='undefined'&&huntTimer){clearInterval(huntTimer);huntTimer=null}
  placeEditOpen=false;
  curPage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
  window.scrollTo(0,0);
  locCadence();
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
const CARAVAN_SPEED = 10; // 1.129: slowed a little (~9%, Hilal: «قليلًا ليس كثيرًا») with the gait clock (3.2s -> 3.5s); stride per cycle ~unchanged (35px)


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
      ? L('الحركة مجمّدة — وضع الخطر','Motion frozen — danger mode')
      : (!motionUser
        ? L('القافلة ثابتة','The caravan is still')
        : (typeof sig.battery === 'number' &&
           sig.battery < 20
          ? L('الحركة مجمّدة — البطارية ضعيفة','Motion frozen — low battery')
          : L('قافلتك تمشي…','Your caravan is walking…')));

  $('btnAnim').textContent =
    motionUser
      ? L('إيقاف الحركة','Stop motion')
      : L('تشغيل الحركة','Start motion');
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
  if (b) b.textContent = salawatOn ? L('🔔 الصلاة: تعمل','🔔 Prayer: on') : L('🔕 الصلاة: صامتة','🔕 Prayer: muted');
  const f = $('salawatFace');
  if (f) f.textContent = uiLang==='en' ? (salawatMin + ' min ▾') : (({5:'٥',10:'١٠',15:'١٥',30:'٣٠'})[salawatMin] + ' د ▾');
  const p = $('salawatBanner');
  if (p) p.classList.toggle('off', !salawatOn);
  document.querySelectorAll('.sal-opt').forEach(c => {
    c.classList.toggle('sel', +c.getAttribute('data-min') === salawatMin);
    const m = +c.getAttribute('data-min');
    c.textContent = uiLang==='en' ? (m + ' min') : (({5:'٥',10:'١٠',15:'١٥',30:'٣٠'})[m] + ' د');
  });
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


/* ---------- ORIGINAL SPRITE MAPPING — FIXED (ChatGPT set 4) --- */

// Frame order + dwell — FIVE-pose cycle (1.128, agent's build on
// Hilal's order): pose 5 is never visited. Measured reason: in the
// artwork itself pose 5 folds BOTH front legs high under the chest
// in all four variants (front lowest pixel 265-299 vs the 329 ground
// line) — a painted defect no order or timing can fix, since every
// six-pose order must pass through it. Dwell widths are set 4's,
// renormalised after dropping pose 5's slot (.22 of .78 total).
const CAMEL_FRAME_ORDER = [0, 4, 3, 1, 2];

const CAMEL_FRAME_ENDS = [
  0.28,
  0.45,
  0.68,
  0.85,
  1.00
];

// Four fixed camel variants
const CAMEL_VARIANTS = 4;

// Three poses in each sprite sheet
const CAMEL_FRAMES_PER_SHEET = 3;

// Six poses across both sheets
const CAMEL_TOTAL_FRAMES = 6;


/* ---------- six-pose sequence ---------- */

function camelFrame(u) {

  const phase = ((u % 1) + 1) % 1;

  for (let j = 0; j < CAMEL_FRAME_ENDS.length; j++) {
    if (phase < CAMEL_FRAME_ENDS[j]) {
      return CAMEL_FRAME_ORDER[j];
    }
  }

  return CAMEL_FRAME_ORDER[CAMEL_FRAME_ORDER.length - 1];
}


/* ---------- stable camel identity ---------- */

function getCamelSprite(u, variant) {

  const fixedVariant =
    ((Math.floor(Number(variant) || 0) % CAMEL_VARIANTS)
      + CAMEL_VARIANTS) % CAMEL_VARIANTS;

  // IMPORTANT:
  // Use the original biomechanical frame order.
  const poseIndex = camelFrame(u);

  // Each pose contains four camel variants.
  const absoluteCell =
    poseIndex * CAMEL_VARIANTS + fixedVariant;

  const cellsPerSheet =
    CAMEL_VARIANTS * CAMEL_FRAMES_PER_SHEET;

  const sheetIndex =
    Math.floor(absoluteCell / cellsPerSheet);

  const localCell =
    absoluteCell % cellsPerSheet;

  return {
    sheet: sheetIndex === 0
      ? ART.camelsA
      : ART.camelsB,

    sheetIndex,
    cell: localCell,
    poseIndex,
    variant: fixedVariant
  };
}


/* INDEPENDENT GAIT CLOCK */

const CAMEL_GAIT_DURATION = 3.5; // 1.129: was 3.2 — a slightly slower walk, per Hilal

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


    /* ----- body movement: frozen, as in approved 1.90 — set 4
       tests the frame correction ALONE, no other change ----- */

    const bob = 0;
    const sway = 0;


    /* ----- apply body movement ----- */

    d.style.transform =
      'translate3d(' +
      x.toFixed(2) + 'px,' +
      bob.toFixed(2) + 'px,0) ' +
      'rotate(' +
      sway.toFixed(2) + 'deg)';


    /* ----- sprite selection: original pose order (set 4) ----- */

    const sprite = getCamelSprite(
      uu,
      i % CAMEL_VARIANTS
    );

    if (d._h !== sprite.sheetIndex) {

      d.style.backgroundImage =
        'url(' + sprite.sheet + ')';

      d._h = sprite.sheetIndex;
    }

    d.style.backgroundPosition =
      (-sprite.cell * CDW) + 'px 0px';


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
let mapObj=null,mapSatMode=false,mapMarkers=[],mapUserMarker=null,mapStyleOk=false,packRadius=500,packDownloading=false;
let navTarget=null,navArrowMarker=null,navTgtMarker=null,navB=null;
let journeyPin=null;
function rotDart(){if(!navArrowMarker||navB==null||!mapObj)return;const sp=navArrowMarker.getElement().firstChild;if(sp)sp.style.transform='rotate('+(navB-mapObj.getBearing())+'deg)'}
function openMap(){showPage('map')}
// 1.145 (Hilal, field report 2026-11-24): walking back to his start pin, the
// map opened on an unpainted view — roads cream-empty, satellite all black —
// until «موقعي» was pressed. His tile store was proven healthy (one press
// restored everything), so the fault is a stale view/source state after the
// return-navigation opening. Self-heal: shortly after any map opening,
// resize + repaint; if tiles still have not loaded, reload the style once so
// every tile is re-requested.
let mapHealT=null;
function healMapSoon(){
  if(mapHealT)clearTimeout(mapHealT);
  mapHealT=setTimeout(()=>{
    if(!mapObj||curPage!=='map')return;
    try{mapObj.resize();mapObj.triggerRepaint()}catch(e){}
    setTimeout(()=>{
      if(!mapObj||curPage!=='map')return;
      let loaded=true;
      try{loaded=mapObj.loaded()&&mapObj.areTilesLoaded()}catch(e){}
      if(!loaded){try{refreshMapStyle()}catch(e){}}
    },1200);
  },350);
}
let navLine=null;
function openMapAt(lat,lng){
  navTarget={lat:lat,lng:lng};
  if(!journeyPin||journeyPin.lat!==lat||journeyPin.lng!==lng)journeyPin=null;
  /* 1.160: open a LINE SESSION for the along-track counter — the origin is
     the saved place he is standing on (<=30 m) when there is one (the
     pin-to-pin case), otherwise his position right now; the baseline is
     that origin-to-target distance and never changes during the walk. */
  navLine=null;
  if(myLoc){let o={lat:myLoc.lat,lng:myLoc.lng};(state.places||[]).forEach(p=>{if(hav(myLoc.lat,myLoc.lng,p.lat,p.lng)<=30)o={lat:p.lat,lng:p.lng}});if(hav(o.lat,o.lng,lat,lng)>=1)navLine={oLat:o.lat,oLng:o.lng,tLat:lat,tLng:lng}}
  locCadence();
  openMap();
  let n=0;
  const iv=setInterval(()=>{
    n++;
    if(mapObj){clearInterval(iv);
      /* 1.178 (Hilal, field verdict 2026-11-25 10:36): 1.177's zoom cap
         did NOT cure the far-tap black screen, and his second screenshot
         disproved the coverage theory — after pressing «موقعي» the SAME
         frame painted fully, tiles and all. The one call that differs
         between the broken path and every working path (near tap,
         «موقعي») is fitBounds itself: on this WebView it settles the
         camera without ever painting. So compute the fit with
         cameraForBounds (same z14 cap / 110 padding as 1.177) but travel
         with flyTo — the motion that has never failed him — then verify
         on arrival that the target is truly inside the view; if it is
         not, fly straight to the target. */
      if(myLoc&&hav(myLoc.lat,myLoc.lng,lat,lng)>400){
        let cam=null;
        try{cam=mapObj.cameraForBounds([[myLoc.lng,myLoc.lat],[lng,lat]],{padding:110,maxZoom:14})}catch(e){}
        if(cam&&cam.center)mapObj.flyTo({center:cam.center,zoom:Math.min(cam.zoom,14)});
        else mapObj.flyTo({center:[lng,lat],zoom:14});
        setTimeout(()=>{
          if(!mapObj||curPage!=='map')return;
          let inside=false;
          try{inside=mapObj.getBounds().contains([lng,lat])}catch(e){}
          if(!inside){try{mapObj.flyTo({center:[lng,lat],zoom:14})}catch(e){}}
          try{mapObj.triggerRepaint()}catch(e){}
        },1800);
      }
      else mapObj.flyTo({center:[lng,lat],zoom:Math.max(mapObj.getZoom(),14)});
      updateNav();renderCompass();healMapSoon();}
    else if(n>24)clearInterval(iv);
  },150);
}
function nearestPlace(){
  const pl=state.places||[];
  if(!pl.length||!myLoc)return pl[0]||null;
  let best=null,bd=1e18,near=pl[0],nd2=1e18;
  pl.forEach(p=>{const d=hav(myLoc.lat,myLoc.lng,p.lat,p.lng);if(d<nd2){nd2=d;near=p}if(d>30&&d<bd){bd=d;best=p}});
  return best||near;
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
  if(mapObj)mapObj.setStyle(localizeStyle(mapSatMode?satStyle():window.MAP_STYLE_ROADS));
}
function initMap(){
  if(!GN)return;
  if(!window.maplibregl||!window.MAP_STYLE_ROADS){
    $('mapView').innerHTML='<p class="dim" style="padding:16px">'+L('تعذّر تحميل محرك الخريطة على هذا الهاتف — أخبر جدّتك.','The map engine could not load on this phone — tell Grandma.')+'</p>';
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
      mapObj=new maplibregl.Map({container:'mapView',style:localizeStyle(window.MAP_STYLE_ROADS),
        center:myLoc?[myLoc.lng,myLoc.lat]:[57.83,22.38],zoom:11,
        attributionControl:{compact:true},minZoom:7,maxZoom:18});
      mapObj.addControl(new maplibregl.NavigationControl({showCompass:false}));
      mapObj.on('load',()=>{mapStyleOk=true;renderMapPlaces();renderMapUser()});
      mapObj.on('style.load',()=>{updateNav();renderMapUser()});
      mapObj.on('rotate',()=>{rotDart();updatePtr()});
      // (1.100: the TEMP DIAGNOSTIC error box from the 1.81 blank-band
      // hunt was removed for good at Hilal's order — the hunt is over.)

      mapObj.on('moveend',()=>{if($('packCenter').value==='center')refreshPackEst()});
      setTimeout(()=>{if(!mapStyleOk&&mapObj)$('mapView').insertAdjacentHTML('beforeend','<div class="mapWarn">'+L('المحرك المتجهي لم يكتمل تحميله — إن بقيت الخريطة فارغة أخبر جدّتك.','The vector engine did not finish loading — if the map stays empty, tell Grandma.')+'</div>')},8000);
    }catch(e){
      $('mapView').innerHTML='<p class="dim" style="padding:16px">'+L('محرك الخريطة المتجهية (WebGL) لا يعمل على هذا الهاتف — أخبر جدّتك لتعيد المحرك القديم.','The vector map engine (WebGL) does not work on this phone — tell Grandma to bring back the old engine.')+'</p>';
    }
  }
  setTimeout(()=>{if(mapObj)mapObj.resize();renderMapPlaces();renderMapUser()},80);
  healMapSoon();
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
  if(!mapObj||placeEditOpen)return;
  mapMarkers.forEach(m=>m.remove());mapMarkers=[];
  (state.places||[]).forEach(p=>{
    const el=document.createElement('div');el.className='pin';el.textContent='📍';
    const pop=new maplibregl.Popup({offset:20,closeButton:false,closeOnClick:true,maxWidth:'250px'});
    const dv=document.createElement('div');dv.className='pinPop';
    dv.innerHTML='<div class="pinPopName">📍 '+p.name+'</div>';
    // 1.161 (Hilal): rename right here, at the pin — an inline editor in
    // the popup, saved by value-match exactly like the popup delete.
    const ren=document.createElement('button');ren.className='pinRen';ren.textContent=L('✎ تغيير الاسم','✎ Rename');
    ren.addEventListener('click',e=>{
      e.stopPropagation();e.preventDefault();
      placeEditOpen=true;
      const inp=document.createElement('input');inp.className='pinNameInp';inp.value=p.name;
      const save=document.createElement('button');save.className='pinRen';save.textContent=L('حفظ','Save');
      dv.innerHTML='';dv.appendChild(inp);dv.appendChild(save);inp.focus();inp.select();
      save.addEventListener('click',ev=>{
        ev.stopPropagation();ev.preventDefault();
        placeEditOpen=false;
        const nn=inp.value.trim();
        if(nn&&nn!==p.name){
          const arr=(state.places||[]).slice();
          let idx=arr.findIndex(q=>q.name===p.name&&q.lat===p.lat&&q.lng===p.lng);
          if(idx<0)idx=arr.indexOf(p);
          if(idx>=0){arr[idx]={name:nn,lat:p.lat,lng:p.lng};GN&&GN.savePlaces(JSON.stringify(arr));state.places=arr}
        }
        try{pop.remove()}catch(_){}
        try{renderMapPlaces()}catch(_){}
        try{renderPlaces()}catch(_){}
        try{renderArrow();renderHomeArrow()}catch(_){}
      });
    });
    dv.appendChild(ren);
    const del=document.createElement('button');del.className='pinDel';del.textContent=L('✕ حذف هذا المكان','✕ Delete this place');
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
    const ptr=document.createElement('div');ptr.className='mePtr';ptr.id='mePtr';ptr.style.display='none';
    ptr.innerHTML='<div class="mePtrLine"></div><div class="mePtrHead"></div>';
    el.appendChild(ptr);
    mapUserMarker=new maplibregl.Marker({element:el}).setLngLat([myLoc.lng,myLoc.lat]).addTo(mapObj);
  }else mapUserMarker.setLngLat([myLoc.lng,myLoc.lat]);
  renderHalo();
  updatePtr();
}
/* 1.164: Hilal's pointer — a short YELLOW LINE glued to the front of his
   blue dot, tipped with a small BLUE arrowhead, walking with the dot and
   always aimed at the target. It succeeds the free-floating gold dart,
   which he found unstable: the dart hovered off-target in screen space
   and swung with every fix, while this pointer is bolted to the dot
   itself and only ever rotates. Fades when he is on the pin (<=12 m),
   where a direction is meaningless. */
function angDiff(a,b){return Math.abs(((a-b+540)%360)-180)}
/* 1.166: the colour judges by a FRESH course only (<=8 s). effHeading
   keeps a walking course "fresh" for 25 s, so after Hilal stopped and
   turned in place the colour lagged seconds behind him; the phone's
   front answers immediately when he is still. */
function ptrHeading(){
  if(gpsCourse!=null&&Date.now()-gpsCourseTs<8000)return gpsCourse;
  return phoneHeading();
}
let ptrGreen=false;
let ptrSmooth=null, ptrKey='';
function updatePtr(){
  const ptr=document.getElementById('mePtr');if(!ptr)return;
  if(!navTarget||!myLoc||!mapObj){ptr.style.display='none';ptrSmooth=null;ptrKey='';return}
  ptr.style.display='block';
  const tb=brg(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
  // 1.170: glide the pointer's rotation — at 1 s fixes near a pin, raw
  // bearing noise (metres of GPS wander against a few metres of range)
  // twitched the line every second (Hilal: "the line is more disturbed
  // now"). The displayed angle now advances only a fraction of the
  // shortest arc per update, and a smaller fraction the closer he is,
  // where bearing noise is largest. A new target resets the glide.
  const key=navTarget.lat+','+navTarget.lng;
  if(key!==ptrKey){ptrKey=key;ptrSmooth=null}
  const raw=tb-mapObj.getBearing();
  if(ptrSmooth==null)ptrSmooth=raw;
  else{
    const ddS=hav(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
    let f=ddS<25?0.15:(ddS<60?0.25:0.4);
    // 1.171: while he stands still, the raw angle is fed by a cold-shaken
    // phone front and a heading-up map that keeps re-easing — the 1.170
    // glide turned that jitter into a slow visible CIRCLING of the line
    // around his dot (Hilal's report). Standing still now glides at 3%
    // per update: shiver noise averages to near-stillness, while a
    // deliberate turn still arrives within a couple of seconds because
    // azimuth events fire many times a second.
    const still=!(gpsCourse!=null&&Date.now()-gpsCourseTs<8000);
    if(still){
      // Two tiers: a LARGE error is a deliberate turn (glide 12%/update —
      // its bulk lands within a second of azimuth events); a small one
      // is shiver territory (5%/update — noise averages to ~2 deg).
      const err=Math.abs(((raw-ptrSmooth+540)%360)-180);
      f=Math.min(f,err>25?0.12:0.05);
    }
    ptrSmooth=(ptrSmooth+(((raw-ptrSmooth+540)%360)-180)*f+360)%360;
  }
  ptr.style.transform='translate(-50%,-50%) rotate('+ptrSmooth+'deg)';
  ptr.style.opacity=hav(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng)<=12?'.25':'1';
  // 1.165 (Hilal): the pointer's line carries his alignment signal — when
  // HIS heading (GPS course while walking, the phone's front while still)
  // runs straight at the target (within 18 deg) the line turns GLOWING
  // GREEN; deviating past 26 deg returns it to yellow. The band between
  // is a dead zone so the colour never flickers on the boundary. The
  // blue arrowhead stays blue, as he drew it.
  const line=ptr.children&&ptr.children[0];
  if(line){
    const eh=ptrHeading();
    if(eh==null)ptrGreen=false;
    else{const d=angDiff(eh,tb);if(!ptrGreen&&d<=18)ptrGreen=true;else if(ptrGreen&&d>=26)ptrGreen=false}
    line.className=ptrGreen?'mePtrLine on':'mePtrLine';
  }
}
/* 1.151: an accuracy halo around his blue dot, drawn at the fix's OWN
   reported accuracy in metres — the honest picture of GPS: the dot is the
   phone's best guess and he is somewhere inside the disc. It answers his
   2026-11-24 field report "the blue circle overshot the place": the pin was
   recorded by one reading and he is located by another, and the two errors
   add up (his screenshot: 30 m). When the pin falls inside the halo, he has
   arrived — whatever side of the pin the dot itself sits on. */
function ensureHalo(){
  if(!mapObj)return false;
  try{
    if(!mapObj.getSource('halosrc')){
      mapObj.addSource('halosrc',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[[]]}}});
      mapObj.addLayer({id:'halofill',type:'fill',source:'halosrc',paint:{'fill-color':'#4db2ff','fill-opacity':0.13}});
      mapObj.addLayer({id:'haloline',type:'line',source:'halosrc',paint:{'line-color':'#4db2ff','line-width':1.5,'line-opacity':0.55}});
    }
    return true;
  }catch(e){return false}
}
function renderHalo(){
  if(!mapObj||!myLoc)return;
  if(!ensureHalo())return;
  let src=null;try{src=mapObj.getSource('halosrc')}catch(e){}
  if(!src)return;
  const acc=(myLoc&&isFinite(myLoc.acc)&&myLoc.acc>0)?myLoc.acc:0;
  if(!acc||acc>1000){src.setData({type:'Feature',geometry:{type:'Polygon',coordinates:[[]]}});return}
  const r=Math.max(8,acc),pts=[],clat=Math.cos(myLoc.lat*Math.PI/180);
  for(let k=0;k<=48;k++){
    const t=k/48*2*Math.PI;
    pts.push([myLoc.lng+(r*Math.sin(t))/(111320*clat),myLoc.lat+(r*Math.cos(t))/111320]);
  }
  src.setData({type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}});
}
/* 1.148 (Hilal's order, 2026-11-24): NO lines on the map at all. He tested
   the dashed lines in the field and found them useless — the straight gold
   nav line (1.64) and the walked-path trail with its blue arrows
   (1.146/1.147) are both deleted. Guidance is now exactly what he praised:
   his small blue position dot, the gold dart, the target ring and the
   remaining-distance chip. */
/* 1.160: remaining ALONG THE LINE (Hilal's design): the counter falls
   only by progress projected onto the straight origin-to-target line.
   Sideways deviation does not reduce it; backward deviation increases
   it — the increase is the deviation itself. */
function lineRemaining(){
  if(!navLine||!myLoc)return null;
  const R=6371000,rad=Math.PI/180,latO=navLine.oLat*rad;
  const dxT=(navLine.tLng-navLine.oLng)*rad*R*Math.cos(latO),dyT=(navLine.tLat-navLine.oLat)*rad*R;
  const L2=dxT*dxT+dyT*dyT;if(L2<1)return null;
  const dxP=(myLoc.lng-navLine.oLng)*rad*R*Math.cos(latO),dyP=(myLoc.lat-navLine.oLat)*rad*R;
  const prog=(dxP*dxT+dyP*dyT)/Math.sqrt(L2);
  return Math.max(0,Math.sqrt(L2)-prog);
}
function updateNav(){
  if(!mapObj)return;
  if(!navTarget||!myLoc){
    const nd0=$('navDist');if(nd0)nd0.style.display='none';
    if(navArrowMarker){navArrowMarker.remove();navArrowMarker=null}
    if(navTgtMarker){navTgtMarker.remove();navTgtMarker=null}
    updatePtr();
    return;
  }
  const b=brg(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
  const nd=$('navDist');if(nd){const dd=hav(myLoc.lat,myLoc.lng,navTarget.lat,navTarget.lng);
    // 1.169 (Hilal's correction of 1.168): the arrival tag fired at the
    // 15 m zone and SWALLOWED the remaining-on-line number. The numbers
    // now never leave; "arrived" is a small green tag under them that
    // appears only when he is truly on the pin (<=10 m), and the chip's
    // border alone takes a green tint.
    const arrived=dd<=10;
    const tag=arrived?(' <span style="color:#7dff9e;font-size:.72em;display:block">'+(journeyPin?L('✓ عند الدبوس','✓ At the pin'):L('✓ وصلت إلى الدبوس','✓ Arrived'))+'</span>'):'';
    nd.style.borderColor=arrived?'rgba(61,255,122,.65)':'';
    if(journeyPin){nd.innerHTML=L('البُعد عن الدبوس: ','From the pin: ')+chipDist(dd)+tag}
    else{const lr=lineRemaining();
      if(lr!=null)nd.innerHTML=L('المتبقّي على الخط: ','Left on the line: ')+chipDist(lr)+' <span style="opacity:.72;font-size:.72em;display:block">'+L('مباشر ','direct ')+chipDist(dd)+'</span>'+tag;
      else nd.innerHTML=L('المتبقي: ','Remaining: ')+chipDist(dd)+tag}
    nd.style.display='block'}
  // 1.164: the free-floating gold dart (1.72's screen-space head) is
  // retired — Hilal found it unstable and designed its successor himself:
  // the dot-glued pointer (updatePtr above). The target ring stays.
  if(!navTgtMarker){
    const te=document.createElement('div');te.className='navTgt';te.innerHTML='<span></span>';
    navTgtMarker=new maplibregl.Marker({element:te,anchor:'center'}).setLngLat([navTarget.lng,navTarget.lat]).addTo(mapObj);
  }else navTgtMarker.setLngLat([navTarget.lng,navTarget.lat]);
  updatePtr();
}
/* 1.149 (Hilal's request, 2026-11-24): a REAL compass at the map's top-left.
   The dial ring rotates against his effective heading — GPS course while he
   walks, the phone's compass while he stands (effHeading, the same source
   the heading-up map uses) — so the gold pin at the top always marks the
   direction he is actually moving/facing, and the centre names it in words
   (شمال / شرق / جنوب / غرب and the in-betweens) with the degrees. */
/* 1.152: the compass got its own heading rule, separate from the map's
   effHeading (which holds the last GPS course for 25 s — right for rotating
   the map, wrong for a compass: Hilal would arrive, turn around, and the
   dial still showed his WALKING direction while he faced the opposite way).
   1.153 (Hilal's explicit order, 2026-11-24): the compass follows THE
   PHONE'S FRONT, always — the direction the top of the phone points,
   walking or standing. GPS course no longer feeds the dial at all; the
   map's heading-up mode keeps its own rule, untouched. */
let compassSmooth=null;
function compassHeading(){return phoneHeading()}
function renderCompass(){
  const ring=$('compassRing');if(!ring)return;
  const letters=[L('ش','N'),L('ق','E'),L('ج','S'),L('غ','W')];
  const key=letters.join('|');
  if(renderCompass._k!==key){
    renderCompass._k=key;
    const ids=['cN','cE','cS','cW'];
    for(let i=0;i<4;i++){const el=$(ids[i]);if(el)el.textContent=letters[i]}
  }
  let h=compassHeading();
  if(h!=null){ // 1.157: glide — advance 40% of the shortest arc per update, so raw sensor noise never makes the dial tremble
    if(compassSmooth==null)compassSmooth=h;else{const d=((h-compassSmooth+540)%360)-180;compassSmooth=(compassSmooth+d*0.4+360)%360}
    h=compassSmooth;
  }else compassSmooth=null;
  const dirEl=$('compassDir'),degEl=$('compassDeg');
  const cIds=['cN','cE','cS','cW'];
  const upright=hdeg=>{
    for(let i=0;i<4;i++){const el=$(cIds[i]);if(el)el.style.transform=((i===0||i===2)?'translateX(-50%)':'translateY(-50%)')+(hdeg?' rotate('+hdeg+'deg)':'')}
  };
  if(h==null){ring.style.transform='';upright(0);if(dirEl)dirEl.textContent='—';if(degEl)degEl.textContent='';return}
  ring.style.transform='rotate('+(-h)+'deg)';
  // 1.150: the letters travel around the dial but stay UPRIGHT — in 1.149
  // they spun with the ring, lying sideways and upside down, which read as
  // scrambled/reversed directions on Hilal's phone.
  upright(h);
  const names=L('شمال|شمال شرق|شرق|جنوب شرق|جنوب|جنوب غرب|غرب|شمال غرب','North|North-east|East|South-east|South|South-west|West|North-west').split('|');
  if(dirEl)dirEl.textContent=names[Math.round(h/45)%8];
  if(degEl)degEl.textContent=Math.round(h)+'°';
}
/* 1.154 (Hilal's order, 2026-11-24): the places-page return-arrow card is
   replaced by a NEWEST PINNED PLACE card. It shows the last place he pinned;
   tapping it starts a JOURNEY on the map from that pin: the map chip stops
   reading "remaining" and reads "distance from the pin" — zero while he
   stands on the pin, growing as he walks away, shrinking as he returns —
   with the gold dart still guiding. Any other navigation (a return target
   chosen elsewhere, start-over) ends journey mode. The card carries its own
   summary line, exactly as he asked. */
function renderJourney(){
  const nm=$('journeyName'),ds=$('journeyDist'),sm=$('journeySummary');
  if(!nm||!ds)return;
  if(sm)sm.textContent=L('وظيفة هذه البطاقة: تعرض آخر مكان ثبّتّه. اضغط المكان فتبدأ رحلة على الخريطة من ذلك الدبوس بعدّاد يبدأ من الصفر — يزيد كلما ابتعدت عن الدبوس وينقص كلما رجعت إليه، وخطٌّ صغير برأس أزرق ملتصق بدائرة زرقاء يرشدك إليه — أصفر عند الانحراف، وأخضر مضيء حين تتجه إلى المكان مستقيمًا.','What this card does: it shows the last place you pinned. Tap the place and a journey starts on the map from that pin, with a counter that starts at zero — it grows as you walk away from the pin and shrinks as you return to it, while a small line with a blue head, glued to a blue dot, guides you to it — yellow when you drift, glowing green when you head straight to the place.');
  const pl=state.places||[];
  if(!pl.length){nm.textContent=L('لا مكان مثبّت بعد','No pinned place yet');ds.textContent=L('ثبّت مكانك وسيظهر هنا','Pin your place and it will appear here');return}
  const p=pl[pl.length-1];
  nm.textContent='📍 '+p.name;
  ds.textContent=myLoc?(fmtDist(hav(myLoc.lat,myLoc.lng,p.lat,p.lng))+L(' منك الآن — اضغط لبدء الرحلة',' from you now — tap to start the journey')):L('اضغط لبدء الرحلة على الخريطة','Tap to start the journey on the map');
}
function packCenterCoords(){
  const v=$('packCenter').value;
  if(v==='center'&&mapObj){const c=mapObj.getCenter();return{lat:c.lat,lng:c.lng,name:L('مركز الخريطة','Map centre')}}
  if(v&&v[0]==='p'){const p=(state.places||[])[+v.slice(1)];if(p)return{lat:p.lat,lng:p.lng,name:p.name}}
  if(myLoc)return{lat:myLoc.lat,lng:myLoc.lng,name:fixAgeMs()<180000?L('موقعي الحالي','My current location'):L('آخر موقع معروف (','Last known location (')+fmtAge(fixAgeMs())+')'};
  return null;
}
function fillPackCenters(){
  const sel=$('packCenter');const cur=sel.value;
  sel.innerHTML='';
  const o1=document.createElement('option');o1.value='loc';o1.textContent=L('موقعي الحالي','My current location');sel.appendChild(o1);
  const o2=document.createElement('option');o2.value='center';o2.textContent=L('مركز الخريطة الحالي','Current map centre');sel.appendChild(o2);
  // 1.130: saved places no longer offered as pack centres (Hilal: the list would keep accumulating) — centres are current location or map centre only.
  if(cur)sel.value=cur;
}
function refreshPackEst(){
  if(!GN||!GN.packInfo)return;
  const c=packCenterCoords();
  if(!c){
    $('packEst').textContent=L('لم يُحدَّد موقعك بعد — فعّل GPS وامنح التطبيق إذن الموقع وانتظر ثوانٍ حتى تظهر نقطتك، أو اختر «مركز الخريطة» وحرّك الخريطة إلى أي بقعة ونزّل حولها (يعمل بلا GPS تمامًا).','Your location is not fixed yet — turn on GPS, grant the app location permission and wait a few seconds for your dot, or choose Map centre, move the map to any spot and download around it (works with no GPS at all).');
    if(!packDownloading)$('btnDownloadPack').disabled=true;
    return;
  }
  if(!packDownloading)$('btnDownloadPack').disabled=false;
  try{
    const info=JSON.parse(GN.packInfo(c.lat,c.lng,packRadius));
    $('packEst').textContent='≈ '+info.tiles+L(' عنصر (طرق متجهية + أقمار) · ≈ ',' items (vector roads + satellite) · ≈ ')+info.mb+L(' ميغا · المركز: ',' MB · centre: ')+c.name+L(' · النطاق ',' · range ')+packRadius+L(' كم',' km')+(info.glyphs?L(' · يشمل خطوط الأسماء (عربية ولاتينية) (~٥ ميغا، تُنزَّل مرة واحدة فقط)',' · includes the name fonts (Arabic and Latin) (~5 MB, downloaded once only)'):'');
  }catch(e){$('packEst').textContent=''}
}
function renderPacks(){
  if(!GN||!GN.listPacks)return;
  let data={};try{data=JSON.parse(GN.listPacks())}catch(e){}
  const list=$('packsList');list.innerHTML='';
  (data.packs||[]).forEach((pk,i)=>{
    const row=document.createElement('div');row.className='row spread';
    const d=new Date(pk.at);
    row.innerHTML='<span class="grow">🗺️ '+pk.name+L(' — نطاق ',' — range ')+pk.radiusKm+L(' كم · ',' km · ')+pk.mb+L(' ميغا · ',' MB · ')+d.toLocaleDateString(uiLang==='en'?'en':'ar')+'</span>';
    const upd=document.createElement('button');upd.className='btn small';upd.textContent=L('تحديث','Update');
    upd.onclick=()=>{
      // 1.133: SMART update — native checks first (vec build stamp +
      // per-tile sat ETags), counts what is new/changed, and fetches
      // only that. Same pack name => registry refreshed in place.
      const job={kind:'pack',name:pk.name,lat:pk.lat,lng:pk.lng,radius:pk.radiusKm,smart:true};
      if(packDownloading){queuePack(job);return}
      startPackJob(job);
    };
    row.appendChild(upd);
    const del=document.createElement('button');del.className='btn small danger';del.textContent=L('حذف الحزمة','Delete pack');
    let armed=false,armT=null;
    del.onclick=()=>{
      if(!armed){armed=true;del.textContent=L('متأكد؟ احذف بلاطاتها','Sure? Delete its tiles');armT=setTimeout(()=>{armed=false;del.textContent=L('حذف الحزمة','Delete pack')},4000);return}
      clearTimeout(armT);del.textContent=L('جارٍ الحذف…','Deleting…');del.disabled=true;
      setTimeout(()=>{
        let res={};try{res=JSON.parse(GN.deletePackTiles(i))}catch(e){}
        renderPacks();
        if(res.ok)$('packProgTxt').textContent=L('حُذفت بلاطات الحزمة الخاصة بها: ',"Deleted this pack's own tiles: ")+res.deleted+L(' بلاطة · ',' tiles · ')+res.mb+L(' ميغا حُرّرت. البلاطات المشتركة مع حزم أخرى وطبقة الزوم البعيد بقيت.',' MB freed. Tiles shared with other packs and the far-zoom layer stayed.');
        else $('packProgTxt').textContent=L('تعذّر الحذف — أعد المحاولة.','Deletion failed — try again.');
      },30);
    };
    row.appendChild(del);list.appendChild(row);
  });
  partialTiles=data.partialTiles||0;updatePackButtons();renderMapStats();
  if(!(data.packs||[]).length)list.innerHTML='<p class="dim">'+L('لا حزم بعد — نزّل أول حزمة من الأعلى.','No packs yet — download your first pack above.')+'</p>';
  $('tilesSize').textContent=L('حجم الخرائط على هاتفك الآن: ','Map size on your phone now: ')+(data.tilesMB||0)+L(' ميغا',' MB');
  const hs=$('packStatus');
  if(hs)hs.textContent=(data.tilesMB>0)?(L('على هاتفك خرائط بحجم ','You have maps of ')+data.tilesMB+L(' ميغا — تعمل بلا إنترنت.',' MB on your phone — they work with no internet.')):L('لا خرائط منزّلة بعد.','No downloaded maps yet.');
}
let partialTiles=0;
let packQueue=[];
let packJobRefresh=false,packJobName=''; // 1.132: the running job's kind — updates report in their own counter inside the packs card, never in the download section
let packJobKey=''; // 1.134: identity of the RUNNING job — a second press for the same pack must not queue a twin that restarts it at 100%
function startPackJob(job){
  packDownloading=true;packJobRefresh=!!job.refresh||!!job.smart;packJobName=job.name||'';packJobKey=job.kind+'|'+job.name;
  if(job.refresh){
    $('updProgWrap').classList.remove('hidden');
    $('updProgBar').style.width='0%';
    $('updProgTxt').textContent=job.smart?(L('بدأ تحديث «','Update started for “')+job.name+L('»…','”…')):(L('بدأ تحديث «','Update started for “')+job.name+L('» — يُعاد جلب كل بلاطاتها من جديد…','” — re-fetching all of its tiles…'));
  }else{
    $('packProgWrap').classList.remove('hidden');
    $('packProgBar').style.width='0%';
  }
  if(job.kind==='base'){$('packProgTxt').textContent=L('بدأ تنزيل خريطة أساس عُمان…','Started downloading the Oman base map…');GN.downloadBase()}
  else{if(!job.refresh)$('packProgTxt').textContent=L('بدأ التنزيل حول «','Download started around “')+job.name+L('»…','”…');GN.downloadPack(job.name,job.lat,job.lng,job.radius,!!job.refresh,!!job.smart)}
  updatePackButtons();
}
function queuePack(job){
  if(packJobKey===(job.kind+'|'+job.name)){
    // 1.134: the same pack is already running — a queued twin would
    // restart the job the moment it reaches 100%.
    if(job.smart){$('updProgWrap').classList.remove('hidden');$('updProgTxt').textContent=L('«','“')+job.name+L('» قيد التحديث الآن — الضغطة الثانية لا تضيف شيئًا.','” is already updating — a second tap adds nothing.')}
    else $('packProgTxt').textContent=L('«','“')+job.name+L('» قيد التنزيل الآن — الضغطة الثانية لا تضيف شيئًا.','” is already downloading — a second tap adds nothing.');
    return;
  }
  if(packQueue.some(q=>q.kind===job.kind&&q.name===job.name)){$('packProgTxt').textContent=L('«','“')+job.name+L('» في الانتظار أصلًا.','” is already in the queue.');return}
  packQueue.push(job);
  $('packProgTxt').textContent=L('أُضيفت «','Added “')+job.name+L('»','”')+(job.smart?L(' (تحديث ذكي)',' (smart update)'):(job.refresh?L(' (تحديث كامل)',' (full update)'):''))+L(' إلى الانتظار — ستُنزّل تلقائيًا بعد الحالية، دون ضغطة أخرى. (',' to the queue — it will run automatically after the current one, with no second tap. (')+packQueue.length+L(' في الانتظار)',' in queue)');
}
function renderMapStats(){
  const el=$('mapStats');if(!el||!GN||!GN.mapStats)return;
  try{const s=JSON.parse(GN.mapStats());
    el.textContent=L('على الهاتف الآن: بلاطات متجهية ','On the phone now: vector tiles ')+(s.vec||0)+L(' · بلاطات أقمار ',' · satellite tiles ')+(s.sat||0)+L(' · ملفات خطوط الأسماء ',' · name font files ')+(s.glyphs||0)+'/57';
  }catch(e){}
}
function updatePackButtons(){
  // 1.137: an update carries its OWN stop button in the packs card;
  // the download card's stop/discard belong to downloads only.
  const updRun=packDownloading&&packJobRefresh;
  $('btnStopPack').style.display=(packDownloading&&!packJobRefresh)?'':'none';
  $('btnDiscardPack').style.display=((packDownloading&&!packJobRefresh)||(partialTiles>0&&!updRun))?'':'none';
  const cu=$('btnCancelUpdate');if(cu)cu.classList.toggle('hidden',!updRun);
}
window.__onPackProgress=p=>{
  if(packJobRefresh){
    $('updProgWrap').classList.remove('hidden');
    const pctU=p.total?Math.round(p.done/p.total*100):0;
    $('updProgBar').style.width=pctU+'%';
    $('updProgTxt').textContent=L('جارٍ تحديث «','Updating “')+packJobName+L('»… ','”… ')+p.done+' / '+p.total+' ('+pctU+L('٪','%')+L(') — حُدّثت حتى الآن: ',') — updated so far: ')+(p.updated||0)+L(' بلاطة',' tiles');
    updatePackButtons();
    return;
  }
  $('packProgWrap').classList.remove('hidden');
  const pct=p.total?Math.round(p.done/p.total*100):0;
  $('packProgBar').style.width=pct+'%';
  $('packProgTxt').textContent=L('جارٍ التنزيل… ','Downloading… ')+p.done+' / '+p.total+' ('+pct+L('٪','%')+') — '+(p.layer==='sat'?L('طبقة الأقمار','Satellite layer'):(p.layer==='glyphs'?L('خطوط الأسماء العربية','Arabic name fonts'):L('طبقة الطرق المتجهية','Vector roads layer')));
  updatePackButtons();
};
window.__onPackDone=r=>{
  packDownloading=false;packJobKey='';
  $('btnDownloadPack').disabled=false;
  const PT=packJobRefresh?$('updProgTxt'):$('packProgTxt');
  const PB=packJobRefresh?$('updProgBar'):$('packProgBar');
  if(r.discarded){
    PT.textContent=packJobRefresh?L('أُلغي التحديث وحُذفت بلاطات هذه الجلسة.','Update cancelled — this session’s tiles were deleted.'):L('أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.','Download cancelled — this session’s tiles were deleted.');
    PB.style.width='0%';partialTiles=0;
  }else if(r.ok){
    if(packJobRefresh&&r.smart){
      const sm=r.sourceMissing||0;
      if(r.ready===0&&sm===0){
        PT.textContent=L('✅ لا تحديثات لـ«','✅ No updates for “')+packJobName+L('»: فُحصت ','”: checked ')+r.tiles+L(' بلاطة وكلها متزامنة أصلًا.',' tiles, and all are already in sync.')+(r.fast?L(' (منها ',' (of them, ')+r.fast+L(' من ذاكرة التحقق — لم يُسأل الخادم عنها)',' came from the verification cache — the server was not asked)'):'')+(r.unverifiable?' ('+r.unverifiable+L(' بلاطة أقمار بلا بصمة محفوظة لم تُفحص — تُغطّى بحذف الحزمة وإعادة تنزيلها.)',' satellite tiles have no saved fingerprint and were not checked — they are covered by deleting the pack and re-downloading it.)'):'')+(r.baseline?L(' وسُجّلت نسخة بيانات الطرق الحالية خطَّ أساس للفحص القادم.',' The current roads-data build was recorded as the baseline for the next check.'):'');
      }else if(r.fresh===0&&sm>0&&r.ready<=sm){
        PT.textContent=L('✅ لا تحديثات حقيقية لـ«','✅ No real updates for “')+packJobName+L('»: فُحصت ','”: checked ')+r.tiles+L(' بلاطة وكل الموجود متزامن؛ و',' tiles and everything present is in sync; and ')+sm+L(' بلاطة غير موجودة في المصدر أصلًا — سُجّلت الآن وستُتخطّى في كل فحص قادم فلا تُهدر وقتًا عليها.',' tiles do not exist at the source at all — recorded now, and skipped in every future check so no time is wasted on them.')+(r.baseline?L(' وسُجّلت نسخة الطرق الحالية خطَّ أساس.',' The current roads build was recorded as a baseline.'):'');
      }else{
        PT.textContent=L('✅ اكتمل التحديث الذكي لـ«','✅ Smart update for “')+packJobName+L('»: فُحصت ','” complete: checked ')+r.tiles+L(' بلاطة — حُدّثت ',' tiles — updated only ')+r.fresh+L(' فقط (',' (')+r.newTiles+L(' جديدة + ',' new + ')+r.changedTiles+L(' متغيّرة)، و',' changed), and ')+r.synced+L(' كانت متزامنة أصلًا.',' were already in sync.')+(r.fast?L(' (منها ',' (of them, ')+r.fast+L(' من ذاكرة التحقق)',' via the verification cache)'):'')+(sm?L(' و',' And ')+sm+L(' بلاطة غير موجودة في المصدر — سُجّلت لتُتخطّى لاحقًا.',' tiles do not exist at the source — recorded to be skipped later.'):'')+(r.fails?L(' وتعذّر جلب ',' And ')+r.fails+L('.',' could not be fetched.'):'')+(r.unverifiable?L(' و',' And ')+r.unverifiable+L(' بلاطة أقمار بلا بصمة لم تُفحص.',' satellite tiles without a fingerprint were not checked.'):'')+(r.baseline?L(' وسُجّلت نسخة الطرق الحالية خطَّ أساس.',' The current roads build was recorded as a baseline.'):'');
      }
    }else if(packJobRefresh){
      PT.textContent=L('✅ اكتمل تحديث «','✅ Update for “')+packJobName+L('»: أُعيد جلب ','” complete: re-fetched ')+r.fresh+L(' عنصرًا · ',' items · ')+r.mb+L(' ميغا — الحزمة الآن متزامنة مع بيانات المصدر.',' MB — the pack is now in sync with the source data.');
    }else if(r.fresh===0){
      PT.textContent=L('✅ فُحص ','✅ Checked ')+r.tiles+L(' عنصرًا — كلها موجودة على هاتفك أصلًا، فلم يُنزَّل شيء جديد. الخريطة جاهزة بلا إنترنت.',' items — all already on your phone, so nothing new was downloaded. The map is ready with no internet.');
    }else if(r.base){
      PT.textContent=L('✅ اكتملت حزمة الأساس: ','✅ Base pack complete: ')+r.fresh+L(' عنصر جديد — كل عُمان ظاهرة الآن عند الزوم البعيد.',' new items — all of Oman now appears at far zoom.');
    }else{
      PT.textContent=L('✅ اكتمل التنزيل: ','✅ Download complete: ')+r.fresh+L(' عنصر جديد · ',' new items · ')+r.mb+L(' ميغا (من أصل ',' MB (of ')+r.tiles+L(' عنصرًا — والباقي كان موجودًا). الخريطة جاهزة بلا إنترنت.',' items — the rest were already present). The map is ready with no internet.');
    }
    PB.style.width='100%';partialTiles=0;
    refreshMapStyle();
  }else if(r.cancelled){
    PT.textContent=packJobRefresh?L('أُوقف التحديث — ما جُلب حُدّث، والباقي بقي بنسخته السابقة صالحًا.','Update stopped — what was fetched is updated; the rest kept its previous version, still valid.'):L('أُوقف التنزيل — ما نزل يبقى محفوظًا ويُستكمل لاحقًا.','Download stopped — what arrived stays saved and can be completed later.');
  }else{
    PT.textContent=packJobRefresh?L('تعذّر إكمال التحديث (انقطع الاتصال؟) — ما جُلب حُدّث والباقي بقي صالحًا؛ أعد التحديث لاستكماله.','The update could not finish (connection lost?) — what was fetched is updated and the rest stays valid; run the update again to complete it.'):L('تعذّر إكمال التنزيل (انقطع الاتصال؟) — ما نزل محفوظ، أعد المحاولة لاستكمال الباقي.','The download could not finish (connection lost?) — what arrived is saved; try again to complete the rest.');
  }
  renderPacks();
  // Queue (1.45): a finished download starts the next queued one by itself;
  // any cancel (keep or discard) stops the whole line — predictable.
  if(r.cancelled||r.discarded){packQueue=[]}
  else if(packQueue.length){
    const nxt=packQueue.shift();
    (packJobRefresh?$('updProgTxt'):$('packProgTxt')).textContent+=L(' — ويبدأ الآن: ',' — starting now: ')+nxt.name;
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
  if(!myLoc){if(GN&&GN.requestLocation)GN.requestLocation();alert(L('لا إشارة GPS بعد: امنح التطبيق إذن الموقع وفعّل GPS ثم انتظر ثوانٍ.','No GPS signal yet: grant the app location permission, turn on GPS, then wait a few seconds.'));return}
  if(mapObj)mapObj.flyTo({center:[myLoc.lng,myLoc.lat],zoom:Math.max(mapObj.getZoom(),12)});
};
let mapFs=false;
$('btnFullMap').onclick=()=>{
  mapFs=!mapFs;
  $('mapCard').classList.toggle('fs',mapFs);
  document.body.classList.toggle('mapfs',mapFs);
  $('btnFullMap').textContent=mapFs?L('✕ إغلاق','✕ Close'):L('⛶ ملء الشاشة','⛶ Fullscreen');
  try{if(GN&&GN.setImmersive)GN.setImmersive(mapFs)}catch(_){}
  setTimeout(()=>{if(mapObj)mapObj.resize()},140);
  setTimeout(()=>{if(mapObj)mapObj.resize()},450);
};
$('btnPinHere').onclick=()=>{
  if(!myLoc){alert(L('بانتظار إشارة GPS…','Waiting for a GPS signal…'));return}
  const d=new Date();const pad=n=>(''+n).padStart(2,'0');
  const nm=L('مكاني — ','My place — ')+pad(d.getHours())+':'+pad(d.getMinutes());
  const pl=state.places||[];pl.push({name:nm,lat:myLoc.lat,lng:myLoc.lng});
  GN&&GN.savePlaces(JSON.stringify(pl));state.places=pl;
  renderPlaces();renderMapPlaces();
  const mkNew=mapMarkers[mapMarkers.length-1];
  if(mkNew){try{mkNew.togglePopup()}catch(_){}
    setTimeout(()=>{const rb=document.querySelector('.pinRen');if(rb)rb.click()},300);}
  const b=$('btnPinHere');const t=b.textContent;b.textContent=L('✓ ثُبّت: ','✓ Pinned: ')+nm;
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
  if(!c){alert(L('لا موقع معروف بعد: فعّل GPS وانتظر ثوانٍ، أو بدّل المركز إلى «مركز الخريطة».','No known location yet: turn on GPS and wait a few seconds, or switch the centre to Map centre.'));return}
  const job={kind:'pack',name:c.name+' ('+packRadius+L(' كم',' km')+')',lat:c.lat,lng:c.lng,radius:packRadius};
  if(packDownloading){queuePack(job);return}
  startPackJob(job);
};
$('btnStopPack').onclick=()=>{if(GN&&GN.cancelPack)GN.cancelPack()};
$('btnCancelUpdate').onclick=()=>{if(GN&&GN.cancelPack)GN.cancelPack()};
$('btnDiscardPack').onclick=()=>{
  if(!confirm(L('إلغاء التنزيل وحذف البلاطات التي نزلت في هذه الجلسة؟','Cancel the download and delete the tiles that arrived in this session?')))return;
  if(GN&&GN.cancelPackDiscard)GN.cancelPackDiscard();
  if(!packDownloading){partialTiles=0;updatePackButtons();$('packProgTxt').textContent=L('أُلغي التنزيل وحُذفت بلاطات هذه الجلسة.','Download cancelled — this session’s tiles were deleted.');$('packProgBar').style.width='0%';setTimeout(renderPacks,400)}
};
function fixAgeMs(){return (myLoc&&myLoc.at)?(Date.now()-myLoc.at):Infinity}
function fmtAge(ms){
  const s=Math.round(ms/1000);
  if(uiLang==='en'){
    if(s<90)return'just now';
    const m=Math.round(s/60);if(m<60)return m+' min ago';
    const h=Math.round(m/60);if(h<24)return h+' h ago';
    return Math.round(h/24)+' d ago';
  }
  if(s<90)return'الآن تقريبًا';
  const m=Math.round(s/60);if(m<60)return'قبل '+m+' دقيقة';
  const h=Math.round(m/60);if(h<24)return'قبل '+h+' ساعة';
  return'قبل '+Math.round(h/24)+' يوم';
}
function renderLocStatus(){
  const el=$('locStatus');if(!el)return;
  if(myLoc&&fixAgeMs()<180000){
    el.textContent=L('📍 موقعك الآن (قراءة حية)','📍 Your location now (live reading)')+(myLoc.acc?L(' — دقة ±',' — accuracy ±')+Math.round(myLoc.acc)+L('م','m'):'');
    $('btnLocSettings').classList.add('hidden');
  }else if(myLoc){
    el.textContent=L('📍 آخر موقع يتذكّره الهاتف — ','📍 Last location the phone remembers — ')+fmtAge(fixAgeMs())+(myLoc.acc?L('، دقة ±',', accuracy ±')+Math.round(myLoc.acc)+L('م','m'):'')+L(' — قد لا يكون مكانك الحالي؛ فعّل GPS لتحديثه.',' — it may not be where you are now; turn on GPS to update it.');
    $('btnLocSettings').classList.remove('hidden');
  }else{
    el.textContent=L('📍 موقعك غير معروف بعد — التطبيق لا يستطيع تشغيل GPS بنفسه؛ فعّله من إعدادات الهاتف وامنح التطبيق إذن الموقع.','📍 Your location is not known yet — the app cannot switch GPS on by itself; turn it on in the phone settings and grant the app location permission.');
    $('btnLocSettings').classList.remove('hidden');
  }
}
$('btnLocSettings').onclick=()=>{if(GN&&GN.openLocationSettings)GN.openLocationSettings()};
$('btnLocOn').onclick=()=>{if(GN&&GN.openLocationSettings)GN.openLocationSettings()};
$('btnClearTiles').onclick=()=>{
  if(!confirm(L('مسح كل الخرائط المنزّلة وسجلات الحزم؟','Erase all downloaded maps and pack records?')))return;
  GN.clearTiles();renderPacks();
  refreshMapStyle();
};

/* ---------- language dialog wiring (1.138) ---------- */
$('btnLang').onclick=()=>{$('langDlg').classList.remove('hidden')};
$('langClose').onclick=()=>{$('langDlg').classList.add('hidden')};
$('langDlg').addEventListener('click',e=>{if(e.target===$('langDlg'))$('langDlg').classList.add('hidden')});
$('langOptAr').onclick=()=>{setLang('ar');$('langDlg').classList.add('hidden')};
$('langOptEn').onclick=()=>{setLang('en');$('langDlg').classList.add('hidden')};
setLang(uiLang);
