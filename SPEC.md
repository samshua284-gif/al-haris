# الحارس — Guardian · Build Spec (agreed with Hilal, night of 2026-11-22/23)

**Purpose (his condition):** a FREE desert-safety app for ALL countries, especially poor
countries. No accounts, no internet permission, light on cheap phones. GPS + SMS worldwide.

## Core organs
1. **Live network catcher / signal watch** — reads the air continuously; dual meter
   **4G and 2G separately** (bars + dBm + label). 2G is the survival gauge: when 4G is 0,
   a flicker of 2G decides whether the SOS can escape.
2. **The drawn bow (القوس المشدود)** — SOS message PRE-BUILT at setup (name + text),
   location kept WARM (last GPS fix cached, refreshed periodically and instantly when
   armed). At the first flicker of service the app fires programmatically in a fraction
   of a second and re-fires at every flicker until delivery is confirmed.
   Only unshortenable delay: the tower registration handshake (~1–2 s).
3. **Latched arming** — one press arms the SOS; it STAYS armed across screen-off and
   reboot until deliberate cancel or delivery confirmation. Status screen says
   «مُسلَّحة — أراقب».
4. **Cancel command** — long-press deliberate cancel. Before any send: silent disarm.
   After delivery: an «أنا بخير، أُلغيت الاستغاثة» follow-up is queued and fired at the
   next flicker by the same bow mechanism.
5. **Recipient needs NOTHING** — plain SMS to up to 3 preset numbers; self-explaining
   text; coordinates as plain digits (readable aloud to 9999), plus a maps link.
6. **Return arrow** — one button: arrow + distance to saved places, over GPS.
7. **Saved places** — FIRST RUN IS EMPTY AND NEUTRAL: no Adam, no preset places, for any
   person in any country. The user pins his own places; stored on his phone only.
   Region auto-detected from current GPS at launch (map/tower pack suggestion — later stage).
8. **Whisper map** — silent log of every spot where signal was glimpsed (place + strength
   + time); an arrow can guide to the NEAREST KNOWN SIGNAL SPOT.
9. **Tower radar** (later stage) — offline OpenCellID atlas per region; arrows to nearest
   known towers. Honest limits: approximate positions, thin rural coverage.
10. **Map packs** (later stage) — OSM data downloaded ONCE per country/region, offline
    forever. Whole planet inside the app is impossible (tens of GB) — per-country packs.
11. **Beacon + ID screen** — loud alarm, screen strobe, name/data for rescuers.

## Interface covenant
- Calm face: template ١ «غروب الكثبان» (chosen by Hilal 2026-11-23 00:22, v4 approved):
  dark glossy KuCoin-like dusk; animated flowing gold/green light streams around cards.
- Living desert scene: golden dunes, Omani camel caravan walking its normal gait in an
  ENDLESS LOOP — groups of four; before the 4th camel exits left, a new group enters
  right. ALL camels carry clear riders; the lead camel's rope is HELD by its rider.
  **«ممرّ القافلة خالٍ» rule:** camels walk a clear front sand lane; trees/bushes are a
  sliding background layer the caravan passes IN FRONT of (depth) — nothing ever blocks it.
- **Stop-motion button**: freezes the caravan into the still picture. Animation also
  freezes automatically in SOS mode and on low battery.
- Sun follows real time of day (dawn/noon/dusk/starred night). Light drawn animation,
  never heavy video.
- Danger face: all beauty dies — one palm-sized red SOS button, huge type, max contrast,
  zero animation.

## Honest limits (never to be marketed away)
- From absolute zero signal nothing sends — the app never claims otherwise.
- Recipient numbers are required for the SMS leg to mean anything.
- Battery is the guardian's life: aggressive scanning only while SOS is armed.

## Stages
- **v1 (this build):** skeleton + template-1 UI + animated caravan + dual 4G/2G live
  meter + GPS + saved places + return arrow + SOS arm/fire/cancel + I'm-safe follow-up
  + whisper log (basic) + beacon/ID screen.
- **v2:** tower radar (OpenCellID packs) + region auto-detect + pack manager.
- **v3:** offline map packs (OSM) with the return arrow over the map.
