// ChatGPT set 3 — piece 6 of ??: اختيار الخلية وفق الترتيب الأصلي
// Received via Hilal, 2026-11-24 10:52 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete (standing protocol).
// NOTE (agent): cell = fr*4 + variant, sheet A = cells 0-11, sheet B =
// 12-23 — exactly the measured frame-first layout our 1.87/1.90
// getCamelSprite already uses. Assembly must confirm the live camel
// elements carry dataset.camelVariant (or wire variant from the camel
// record, as the current code does).

const variant = Number(el.dataset.camelVariant);

const cell = fr * ART_CELLS + variant;

const half = cell >= ART_CELLS * FRAMES_PER_SHEET ? 1 : 0;

const localCell = cell % (ART_CELLS * FRAMES_PER_SHEET);

const sheet = half === 0 ? ART.camelsA : ART.camelsB;
