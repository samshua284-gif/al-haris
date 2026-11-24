/* =========================================================
   CAMEL CARAVAN 1.80 — SMOOTH PACING GAIT
   Based on original 1.64 caravan system.
   Preserves:
   - 8 camel sprites / 2 groups of 4
   - Endless right-to-left caravan
   - Original six-pose sequence
   - Original ART sprite sheets
   - Shadows and footprint particles
   - Motion controls and safety freeze
   ========================================================= */

/* ---------- caravan setup ---------- */

const wrap=$('sceneWrap');
const layer=$('caravan');

let motionUser=true;
let camelEls=[];
let camelShadows=[];
let printPool=[];
let lastStep=[];
let printIdx=0;

let SLOTS=[];
let TRACK=0;
let CDW=0;
let CH=52;
let SHIFT=0;
let lastTs=0;

/* ---------- initialize caravan ---------- */

function caravanInit(){

  if(!ART)return;

  $('sceneBg').src=ART.scene;

  const k=CH/ART.cellH;

  CDW=Math.round(ART.cellW*k);

  // Eight camels: two endless groups of four
  for(let i=0;i<8;i++){

    const d=document.createElement('div');

    d.className='camel';
    d.style.width=CDW+'px';
    d.style.height=CH+'px';

    d.style.backgroundImage='url('+ART.camelsA+')';

    d._h=0;

    d.style.backgroundSize=
      (ART.halfW*k)+'px '+CH+'px';

    d.style.backgroundPosition=
      (-(i%ART.cells)*CDW)+'px 0px';

    d.style.transformOrigin='50% 100%';

    layer.appendChild(d);

    camelEls.push(d);

    // Ground shadow
    const sh=document.createElement('div');

    sh.className='cshadow';

    sh.style.width=
      Math.round(CDW*1.30)+'px';

    layer.appendChild(sh);

    camelShadows.push(sh);
  }

  // Original group spacing preserved
  const SP=CDW+6;
  const GG=90;

  for(let g=0;g<2;g++){

    for(let i=0;i<4;i++){

      SLOTS.push(
        g*(4*SP+GG)+i*SP
      );
    }
  }

  TRACK=2*(4*SP+GG);

  // Footprint particle pool
  for(let j=0;j<30;j++){

    const u=document.createElement('div');

    u.className='puff';
    u.style.opacity='0';

    layer.appendChild(u);

    printPool.push({
      puff:u,
      born:-1e9,
      fx:0
    });
  }
}

/* ---------- motion control ---------- */

function motionWanted(){

  if(!motionUser)return false;

  if(curPage!=='home')return false;

  if(state.armed)return false;

  if(
    typeof sig.battery==='number' &&
    sig.battery>=0 &&
    sig.battery<20
  )return false;

  if(document.hidden)return false;

  return true;
}

function updateMotion(){

  const on=motionWanted();

  $('animState').textContent=
    state.armed
      ?'الحركة مجمّدة — وضع الخطر'
      :(!motionUser
        ?'القافلة ثابتة — كما في الصورة'
        :(typeof sig.battery==='number'&&sig.battery<20
          ?'الحركة مجمّدة — البطارية ضعيفة'
          :'قافلتك تمشي…'));

  $('btnAnim').textContent=
    motionUser
      ?'إيقاف الحركة'
      :'تشغيل الحركة';
}

$('btnAnim').onclick=()=>{

  motionUser=!motionUser;

  updateMotion();
};

/* ---------- body gait curves ---------- */

// Original double-bob vertical curve
const GAIT_V=[
  0.035,0.048,0.073,0.085,
  0.073,0.048,0.035,
  0.048,0.072,0.085,
  0.073,0.048,0.035
];

// Original lateral sway curve
const GAIT_S=[
  0,2.2,3.9,4.5,
  3.9,2.2,0,
  -2.3,-3.9,-4.5,
  -3.9,-2.3,0
];

/* ---------- periodic smooth interpolation ---------- */

function gaitSample(arr,u){

  const n=arr.length-1;

  u=((u%1)+1)%1;

  const x=u*n;

  const i=Math.floor(x);
  const t=x-i;

  // Periodic Catmull-Rom
  const p0=arr[(i-1+n)%n];
  const p1=arr[i];
  const p2=arr[(i+1)%n];
  const p3=arr[(i+2)%n];

  const t2=t*t;
  const t3=t2*t;

  return 0.5*(
    2*p1+
    (-p0+p2)*t+
    (2*p0-5*p1+4*p2-p3)*t2+
    (-p0+3*p1-3*p2+p3)*t3
  );
}

/* ---------- six-pose sequence ---------- */

// Preserve original measured frame order
const CAMEL_FRAME_ORDER=[
  0,4,3,5,1,2
];

// Original pose timing
const CAMEL_FRAME_ENDS=[
  0.22,
  0.35,
  0.53,
  0.66,
  0.88,
  1.00
];

function camelFrame(u){

  for(let j=0;j<CAMEL_FRAME_ENDS.length;j++){

    if(u<CAMEL_FRAME_ENDS[j]){
      return CAMEL_FRAME_ORDER[j];
    }
  }

  return CAMEL_FRAME_ORDER[5];
}

/* ---------- endless caravan animation ---------- */

function caravanLoop(ts){

  requestAnimationFrame(caravanLoop);

  if(!camelEls.length)return;

  const dt=Math.min(
    250,
    ts-(lastTs||ts)
  );

  lastTs=ts;

  const on=motionWanted();

  wrap.classList.toggle('frozen',!on);

  // Original caravan speed preserved
  if(on&&dt>0){

    SHIFT=(
      SHIFT+11*dt/1000
    )%TRACK;
  }

  // Original walking cycle length
  const stridePx=24;

  camelEls.forEach((d,i)=>{

    /* ----- caravan position ----- */

    const x=
      ((SLOTS[i]-SHIFT)%TRACK+TRACK)
      %TRACK-CDW-24;

    /* ----- individual gait phase ----- */

    const ph=(SHIFT+i*11)/stridePx;

    const uu=ph-Math.floor(ph);

    /* ----- sprite pose ----- */

    const fr=camelFrame(uu);

    /* ----- smooth body bounce ----- */

    const vertical=gaitSample(
      GAIT_V,
      uu
    );

    const bob=on
      ?-(vertical-0.06)*44
      :0;

    /* ----- smooth body sway ----- */

    const sway=on
      ?gaitSample(GAIT_S,uu)*0.25
      :0;

    /* ----- apply body movement ----- */

    d.style.transform=
      'translate3d('+
      x.toFixed(2)+'px,'+
      bob.toFixed(2)+'px,0) '+
      'rotate('+
      sway.toFixed(2)+'deg)';

    /* ----- select correct sprite sheet ----- */

    const variant=i%ART.cells;

    const cell=
      fr*ART.cells+variant;

    const cellsPerSheet=
      ART.cells*3;

    const half=
      cell>=cellsPerSheet?1:0;

    const localCell=
      cell%cellsPerSheet;

    if(d._h!==half){

      d.style.backgroundImage=
        'url('+
        (half?ART.camelsB:ART.camelsA)+
        ')';

      d._h=half;
    }

    d.style.backgroundPosition=
      (-(localCell*CDW))+'px 0px';

    /* ----- ground shadow ----- */

    const shadowX=x-CDW*0.26;

    const shadowScale=
      1-Math.max(0,-bob)*0.008;

    camelShadows[i].style.transform=
      'translate3d('+
      shadowX.toFixed(2)+'px,0,0) '+
      'rotate(-3deg) '+
      'scaleX('+shadowScale.toFixed(3)+')';

    /* ----- footprint timing ----- */

    const sIdx=Math.floor(ph*2);

    if(lastStep[i]===undefined){

      lastStep[i]=sIdx;
    }

    if(
      on&&
      sIdx!==lastStep[i]&&
      printPool.length
    ){

      lastStep[i]=sIdx;

      const pr=
        printPool[
          printIdx++%printPool.length
        ];

      pr.born=ts;

      pr.fx=
        x+CDW*0.42+(sIdx%2)*4;
    }

  });

  /* ---------- footprint particles ---------- */

  printPool.forEach(pr=>{

    const age=(ts-pr.born)/1000;

    if(age<1.2){

      const opacity=
        Math.max(0,1-age/1.2)*0.5;

      pr.puff.style.opacity=
        String(opacity);

      pr.puff.style.transform=
        'translate3d('+
        (pr.fx-5+7*age)+'px,'+
        (-3*age)+'px,0) '+
        'scale('+
        (1+1.1*age)+')';

    }else{

      pr.puff.style.opacity='0';
    }
  });
}

/* ---------- start caravan ---------- */

caravanInit();

requestAnimationFrame(caravanLoop);

/* =========================================================
   END CAMEL CARAVAN 1.80
   ========================================================= */
