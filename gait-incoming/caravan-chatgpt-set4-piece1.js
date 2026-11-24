// ChatGPT set 4 — piece 1 of ??: replacement for the whole sprite
// section (from /* CAMEL SPRITE ORDER — CORRECTED to the end of
// getCamelSprite). Received via Hilal, 2026-11-24 11:01 Asia/Muscat.
// DO NOT BUILD until Hilal says the set is complete.
// NOTE (agent): (1) this camelFrame reads CAMEL_FRAME_ORDER /
// CAMEL_FRAME_ENDS — defined by set 3 piece 1; they must be kept with
// the section at assembly or the script dies. Boundary test is now
// phase < ENDS[j] (set 3 had <=). (2) getCamelSprite's return shape
// changed: cell is now the LOCAL cell within the sheet (same numeric
// semantics the loop's backgroundPosition already expects: 0..11),
// plus sheetIndex/poseIndex/variant; the old `frame` field is gone —
// the live loop uses only sprite.sheet and sprite.cell (verified).
// (3) OPEN: the span being replaced in our 1.126 file also contains
// the embedded CAMEL_GAIT data + camelPose sampler, which the 1.126
// loop calls for body motion. In the 1.90 baseline ChatGPT works
// from, the body was frozen. If no later piece addresses the loop's
// body lines, assembly must choose: keep data+sampler beside the new
// section, or revert the loop body to 1.90's frozen zeros.

/* ---------- ORIGINAL SPRITE MAPPING — FIXED ---------- */

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

  return CAMEL_FRAME_ORDER[5];
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
