// ============================================================
// Guardian 1.90 — caravan block, EXACTLY as shipped in the
// approved 1.90 APK: from the camelEls definition to the end
// of caravanLoop. Extracted 2026-11-24 for ChatGPT's frame-
// synchronisation correction. Do not edit this copy.
// ============================================================

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
let GAIT_DISTANCE = 0;

let lastTs = 0;


/* ---------- gait constants ---------- */

// Original biomechanical model
const GAIT_DURATION = 3.2;

// Original caravan speed
const CARAVAN_SPEED = 11;

// Distance travelled during one complete gait cycle
const STRIDE_PX =
  GAIT_DURATION * CARAVAN_SPEED;

// Original sprite frame order
const CAMEL_FRAME_ORDER = [
  0, 4, 3, 5, 1, 2
];

// Six-pose timing
const CAMEL_FRAME_ENDS = [
  0.22,
  0.35,
  0.53,
  0.66,
  0.88,
  1.00
];

// Minimal body sway
const GAIT_S = [
  0, 2.2, 3.9, 4.5,
  3.9, 2.2, 0,
  -2.3, -3.9, -4.5,
  -3.9, -2.3, 0
];


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
        ? 'القافلة ثابتة — كما في الصورة'
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


/* ---------- smooth periodic interpolation ---------- */

function gaitSample(arr, u) {

  const n = arr.length - 1;

  u = ((u % 1) + 1) % 1;

  const x = u * n;

  const i = Math.floor(x);
  const t = x - i;

  const p0 = arr[(i - 1 + n) % n];
  const p1 = arr[i];
  const p2 = arr[(i + 1) % n];
  const p3 = arr[(i + 2) % n];

  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
    (-p0 + 3*p1 - 3*p2 + p3) * t3
  );
}


/* ---------- six-pose sequence ---------- */

function camelFrame(u) {

  for (
    let j = 0;
    j < CAMEL_FRAME_ENDS.length;
    j++
  ) {

    if (u < CAMEL_FRAME_ENDS[j]) {

      return CAMEL_FRAME_ORDER[j];
    }
  }

  return CAMEL_FRAME_ORDER[5];
}


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

    GAIT_DISTANCE += distance;
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