# Canyon Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Takoyaki061/make-fun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Takoyaki061/make-fun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A chase-view flight game: fly a prop plane down a golden-hour desert canyon, thread the glowing rings, manage throttle, fuel and hull damage across three sorties, and land on a lit runway at night. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## How to play

- **W/S or Up/Down** — pitch (climb / descend)
- **A/D or Left/Right** — bank and turn
- **Shift / Ctrl** — throttle up / down (mouse wheel trims it, keys 1–9 set it)
- **Mouse** — steer by position, pitch by height
- **P** pause · **R** restart · **M** mute · **Enter** confirm

Thread rings dead-centre: a centred ring refunds fuel and pays 500 points, an edge clip costs hull. Slow flight turns tight but stalls; fast flight turns wide and shakes past the redline. Damage adds drag — green repair rings patch the hull. Three sorties: Dawn Patrol (12 rings, fuel is the enemy), Canyon Slalom (timed, wind gusts, rings add time), Night Landing (slow down and put her on the lit runway).

## Screenshots

The four screenshots under `screenshots/` are real renders of the game's own code, staged by its autopilot: `?shot=play`, `?shot=start`, `?shot=rings`, `?shot=landing` (each with `&seed=7`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=hw8m84ng&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
