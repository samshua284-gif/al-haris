# ChatGPT set 3 — assembled as Guardian 1.126 (2026-11-24)

Pieces received via Hilal 10:50–10:53 (caravan-chatgpt-set3-piece1..7.js),
assembled after his «الآن انتهى». Pre-assembly backup: app.js.1.125.bak.

What changed vs the approved 1.90:
1. Frame choice: camelFrame(uu) — ORDER [0,4,3,5,1,2] with ENDS dwell
   .22/.35/.53/.66/.88/1.00 — replaces floor(u*6) uniform sheet order.
   Wired inside getCamelSprite (one line), so piece 6's cell math and
   piece 7's 1.90 background binding remain the single source of truth.
2. Body motion RE-LINKED to the preserved CAMEL_GAIT data (embedded
   verbatim from gait-incoming, exactly as it ran in 1.86) with the
   1.86 application: bob = -(vertical_m - 0.035) * 70 px (range
   0..-3.5), sway = sway_deg raw (±4.5°) — BUT frame and pose now share
   the ONE phase uu (pieces 3+4), the synchronisation the rejected
   1.86 attempt lacked.

Already live, needed no change: piece 3's clock (updateCamelGait(dt, on)
— the `on` parameter adaptation from set 2 was already in place;
getCamelGaitPhase identical), piece 5's constants (CAMEL_VARIANTS=4,
FRAMES_PER_SHEET=3, TOTAL_FRAMES=6).

Simulation (Node VM, 719 frames x 8 camels, assembled code extracted
from the shipped app.js): zero errors; camel 0 sequence cycles exactly
0,4,3,5,1,2; dwell .23/.14/.19/.14/.20/.10 vs ENDS .22/.13/.18/.13/.22/.12;
zero variant drift (no colour swapping); bob -3.50..0 px, sway -4.5..+4.5°.
Hilal's eye is the final judge, as with every gait set.
