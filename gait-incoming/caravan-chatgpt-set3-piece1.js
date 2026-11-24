// ChatGPT set 3 — piece 1 of ??: «تصحيح تسلسل المشية»
// Received via Hilal, 2026-11-24 10:50 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete (standing protocol).
// NOTE (agent): the order [0,4,3,5,1,2] is the pre-1.89 camelFrame order
// table (removed as dead code in 1.102); the ENDS give uneven dwell per
// frame: .22/.13/.18/.13/.22/.12 of the cycle. 1.90 (approved) plays the
// sheet order 0..5 uniformly. Full comparison at assembly time.

const CAMEL_FRAME_ORDER = [0, 4, 3, 5, 1, 2];

const CAMEL_FRAME_ENDS = [
  0.22,
  0.35,
  0.53,
  0.66,
  0.88,
  1.00
];
