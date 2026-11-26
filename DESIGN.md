# Canyon Courier — design brief (prose, no code)

## The game
A pseudo-3D chase-view flight game in plain canvas 2D, no libraries, no network.
The player flies a small prop plane down a golden-hour desert canyon, seen from
behind and slightly above, threading glowing rings, managing throttle, fuel and
hull damage across three sorties, and landing on a lit runway at night.

## Why this concept (critique-pick)
Two concepts were considered. Concept B, a 2D side-view island hopper, reads
prettier in a still frame but fails the judge's first criterion: it is not a
chase or cockpit view and shows no runway or ring ahead. Concept A, this one,
matches the criterion head-on: chase view, recognisable canyon terrain, the
aircraft in frame, instruments lit, rings and a runway ahead. DeepSeek brutal
(calls flight-concepts, flight-mechanics, flight-shots) agreed: A wins, with one
warning — pseudo-3D can read flat and repetitive in stills. The fix is art
direction: a large clearly-silhouetted aircraft, layered canyon walls with haze
and distinct landmarks (a rock arch, a river bridge, mesa silhouettes), one
screenshot per sortie, and a clean instrument panel whose altitude, speed and
heading stay legible at thumbnail size. The mid-flight chase frame is the cover
screenshot, not the title screen.

## The five mechanics that make throttle matter (DeepSeek brutal)
1. Ring-centredness pays fuel, not just points: fuel restored scales with how
   close to a ring's centre you thread it. A sloppy edge pass costs fuel.
   Decision: spend bank precision on a misaligned ring, or skip it and eat
   the loss.
2. Turn rate is airspeed-dependent: slow flight turns tight but risks stalling
   into a canyon wall; fast flight turns wide. Decision: bleed throttle to
   make a tight ring, or hold speed to clear the wall gap.
3. Damage adds drag: clipping a wall or a ring edge raises damage, which cuts
   top speed and widens the turn radius. Green repair rings restore hull.
   Decision: detour to a repair ring now, or push the damaged airframe on.
4. Forked canyon: the canyon narrows and bends; the tight inside line demands
   high throttle and precise banking, the wide line is longer at cruise.
   Decision: burn fuel on the shortcut or spend distance on the safe line.
5. Missions pull opposite throttle profiles: the timed slalom wants full burn,
   the fuel-scavenge patrol wants lean cruise and ring-chasing.

## Sorties (three missions, one campaign)
1. Dawn Patrol — fly 12 rings to the end of the canyon. Fuel is the enemy;
   centred rings refund it. Golden-hour palette.
2. Canyon Slalom — timed. Gates alternate left and right, wind gusts push the
   plane sideways. Beat the clock; each ring adds seconds.
3. Night Landing — dusk-to-night palette, lit runway ahead. Reduce speed,
   descend onto the runway strip, touch down inside the zone. Too fast or too
   hard is a crash; too slow is a stall into the desert.

## Flight model
Throttle 0–100% (W/S or Up/Down), bank left/right (A/D or arrows), mouse steer
optional. Speed follows throttle with drag; altitude follows pitch; stall
below minimum speed bleeds altitude; overspeed shakes the airframe and
overheats. Fuel drains with throttle. Crashes cost a life (3 lives); respawn
at the last ring passed. Score: rings (centre bonus), time bonus, landing
quality. Ranks: Ace / Wingman / Rookie on the end screen.

## Look
One style throughout: warm sand and rust canyon strata, teal river below,
amber sun low on the horizon, haze layers, mesa silhouettes in parallax.
The aircraft is drawn, not pasted: fuselage, wings, tail and a spinning prop
blur, banking with the turn, contrails behind. HUD: altimeter tape and
altitude number top-left, compass heading top-centre, airspeed and throttle
bar top-right, fuel and damage gauges, mission objective, ring count, score,
timer. Instruments glow amber/cyan on dark panels. WebAudio synth: engine
drone pitched by throttle, wind, ring chime, warning beep, landing fanfare.
M mutes.

## Structure (one clear job per file)
- game/index.html — page, canvas, status line
- game/src/config.js — every tuning number, palette, missions
- game/src/random.js — seeded RNG (mulberry32), determinism
- game/src/audio.js — WebAudio synth sounds
- game/src/input.js — keyboard and mouse
- game/src/track.js — procedural canyon: segments, rings, runway, landmarks
- game/src/physics.js — flight model: speed, altitude, bank, fuel, damage
- game/src/render.js — pseudo-3D renderer, plane sprite, HUD
- game/src/world.js — state machine, missions, scoring, events
- game/src/shots.js — autopilot screenshot staging (?shot=)
- game/src/main.js — boot and the one loop
- main.ts — copies game/ and screenshots/ to /output, writes dossier.json
- serve.ts — local static server for playtesting

## Screenshots (4, first by name is the cover)
1. 1-flight.jpg — mid-flight chase view, the cover: canyon, rings ahead, HUD lit.
2. 2-title.jpg — title screen over the canyon mouth at golden hour.
3. 3-rings.jpg — banked hard through a ring in the slalom, wind and contrails.
4. 4-landing.jpg — night approach to the lit runway, mission-complete panel.

## Determinism and playtesting
Seeded RNG; ?seed=N fixes the canyon and rings; ?shot=start|play|rings|landing
stages a scene with an autopilot that plays the real rules forward, so every
screenshot is a real render of the game's own code. Playtested end to end in
headless Chromium via the autopilot and by scripted keyboard play.
