# ChatGPT set 4 — assembled as Guardian 1.127 (2026-11-24)

Pieces via Hilal 11:00–11:03 (caravan-chatgpt-set4-piece1..4.js) +
his closing directive: test this correction ALONE, no other changes;
if the jumping persists, review the six poses' content itself.
Pre-assembly backup: app.js.1.126.bak.

Assembly = approved-1.90 baseline caravan + set 4 only:
- Sprite section replaced wholesale (comment -> end of getCamelSprite)
  with set 4 piece 1; CAMEL_FRAME_ORDER/ENDS (set 3 piece 1's data,
  which the new camelFrame reads) kept at the head of the section.
- Display block replaced by piece 3 (guard keyed on sprite.sheetIndex);
  old const sprite line deleted per piece 4 — exactly one definition.
- Set 3's body-pose lines reverted to 1.90's frozen bob=0/sway=0 and
  the embedded CAMEL_GAIT data + camelPose sampler removed from app.js
  (the correction tested ALONE; data remains preserved in
  gait-incoming/ per Hilal's standing order).
Simulation (719 frames x 8 camels, shipped code): zero errors; pose
sequence cycles exactly 0,4,3,5,1,2; dwell matches ENDS; zero
variant/cell drift; sheetIndex consistent. Hilal's eye judges next.

VERDICT (Hilal, 2026-11-24 11:05): «نفس المشية قبل التعديلات، لم تتغير
كثيرًا» — set 4's frame correction changed almost nothing by eye.
Frame order/timing is thereby exonerated. Agent's pose measurement
(variant 0, alpha bbox): ALL six poses share identical vertical
geometry — h=271, top=59, bottom=330; centroid-Y swings at most 8px
(pose 5). No pose sits higher or lower, in either order. The perceived
jump therefore lives in the leg content inside the frames and/or the
unlocked ground-speed vs stride — the pose-content review ChatGPT
announced. Contact strip of the six poses saved at /tmp/pose-strip.png
and delivered to Hilal for forwarding.
