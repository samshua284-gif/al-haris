// ChatGPT set 3 — piece 2 of ??: دالة اختيار الإطار camelFrame(u)
// Received via Hilal, 2026-11-24 10:50 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete (standing protocol).
// NOTE (agent): sound segment lookup — phase normalised to [0,1), first
// ENDS[i] >= phase wins, fallback unreachable (ENDS[5]=1.00). The caller
// (a later piece, presumably) must feed per-camel phase u + offset.

function camelFrame(u) {
  const phase = ((u % 1) + 1) % 1;

  for (let i = 0; i < CAMEL_FRAME_ENDS.length; i++) {
    if (phase <= CAMEL_FRAME_ENDS[i]) {
      return CAMEL_FRAME_ORDER[i];
    }
  }

  return CAMEL_FRAME_ORDER[5];
}
