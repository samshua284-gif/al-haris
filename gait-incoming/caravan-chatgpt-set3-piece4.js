// ChatGPT set 3 — piece 4 of ??: «داخل حلقة الحركة»
// Received via Hilal, 2026-11-24 10:51 Asia/Muscat. DO NOT BUILD until
// Hilal says the set is complete (standing protocol).
// NOTE (agent): this set RE-LINKS body motion — camelPose(uu) samples
// the preserved CAMEL_GAIT data — but now pose and frame share ONE
// phase uu, unlike the rejected 1.86/1.87 attempt where body data and
// frames ran on separate clocks. Wiring care at assembly:
// updateCamelGait(dt) must run ONCE per animation frame, before the
// per-camel loop — as pasted inside a per-camel loop it would advance
// the clock once per camel (4 camels = 4x speed).

updateCamelGait(dt);

const uu = getCamelGaitPhase(i);

const pose = camelPose(uu);
const fr = camelFrame(uu);
