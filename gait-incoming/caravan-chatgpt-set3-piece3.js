// ChatGPT set 3 — piece 3 of ?? (his item «2. تصحيح مزامنة الإطار مع دورة المشية»)
// Received via Hilal, 2026-11-24 10:51 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete (standing protocol).
// NOTE (agent): duration 3.2s and per-camel offset 0.12 match the
// approved 1.90 constants, and getCamelGaitPhase feeds camelFrame(u)
// coherently. ONE forced adaptation at assembly, same as set 2 (1.89):
// updateCamelGait reads a free variable `on` — in our app the on/off
// state arrives as a PARAMETER, updateCamelGait(dt, on); wiring it as
// pasted would throw ReferenceError and kill the whole script.

const CAMEL_GAIT_DURATION = 3.2;

let camelGaitTime = 0;

function updateCamelGait(dt) {
  if (!on) return;

  camelGaitTime += Math.max(0, dt) / 1000;

  camelGaitTime %= CAMEL_GAIT_DURATION;
}

function getCamelGaitPhase(index) {
  const offset = index * 0.12;

  return (
    (camelGaitTime / CAMEL_GAIT_DURATION + offset) % 1
  );
}
