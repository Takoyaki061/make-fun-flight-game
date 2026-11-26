// The game state: screens, the three-sortie campaign, scoring, lives and
// the events the flight model raises. One mission at a time; finishing one
// opens the next, and finishing the night landing ends the campaign.
import { LIVES, MISSIONS, SCORE, SEG_LEN } from './config.js';
import { createRandom } from './random.js';
import { createTrack } from './track.js';
import { autopilot } from './shots.js';
import {
  EVENT_CRASH, EVENT_EDGE, EVENT_FUEL_EMPTY, EVENT_HIT, EVENT_LANDED,
  EVENT_MISSION_END, EVENT_PERFECT, EVENT_REPAIR, EVENT_RING, EVENT_STALL,
  createFlight,
} from './physics.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

export const EVENT_OVER = 1;

export function createWorld(random, audio) {
  const flight = createFlight();
  const state = {
    screen: SCREEN_TITLE,
    missionIndex: 0,
    lives: LIVES,
    score: 0,
    best: 0,
    overReason: '',
    completeTitle: '',
    completeLine: '',
    completeNext: '',
    rank: '',
    toast: '',
    toastT: 0,
    timeLeft: 0,
    time: 0,
    seed: 1,
    campaignDone: false,
  };
  let track = null;
  let mission = MISSIONS[0];
  let warnCooldown = 0;

  function loadMission(index) {
    state.missionIndex = index;
    mission = MISSIONS[index];
    const missionRandom = createRandom(state.seed * 1000 + index * 77 + 13);
    track = createTrack(missionRandom, mission);
    flight.reset(mission);
    state.timeLeft = mission.timeLimit;
    state.toast = mission.goal;
    state.toastT = 3;
  }

  function reset(seed) {
    state.seed = seed;
    state.missionIndex = 0;
    state.lives = LIVES;
    state.score = 0;
    state.screen = SCREEN_TITLE;
    state.campaignDone = false;
    state.overReason = '';
    state.toast = '';
    state.toastT = 0;
    state.time = 0;
    loadMission(0);
  }

  function rankFor(score, rings, total) {
    const ringFrac = total > 0 ? rings / total : 0;
    if (score >= 9000 && ringFrac >= 0.85) return 'ACE';
    if (score >= 5000 && ringFrac >= 0.6) return 'WINGMAN';
    return 'ROOKIE';
  }

  function missionComplete(landed) {
    state.score += flight.state.score;
    const totalScore = state.score;
    state.rank = rankFor(totalScore, flight.state.ringsPassed, flight.state.ringsTotal);
    if (mission.endKind === 'timed') {
      state.score += Math.round(state.timeLeft) * SCORE.timeBonusPerSecond;
    }
    if (state.missionIndex + 1 < MISSIONS.length) {
      state.completeTitle = `${mission.name.toUpperCase()} — COMPLETE`;
      state.completeLine = landed ? 'Wheels down, in one piece. The tower is impressed.' : 'All rings threaded. The canyon lets you pass.';
      state.completeNext = `Press ENTER for ${MISSIONS[state.missionIndex + 1].name}`;
      state.screen = SCREEN_COMPLETE;
      audio.fanfare();
    } else {
      state.campaignDone = true;
      state.completeTitle = 'CAMPAIGN COMPLETE';
      state.completeLine = 'Three sorties, one canyon, and you brought her home every time.';
      state.completeNext = 'Press ENTER to fly the campaign again';
      state.screen = SCREEN_COMPLETE;
      audio.fanfare();
    }
    if (totalScore > state.best) state.best = totalScore;
  }

  function crash(reason) {
    audio.crash();
    state.lives -= 1;
    state.score += flight.state.score;
    if (state.lives <= 0) {
      state.overReason = reason;
      state.screen = SCREEN_OVER;
      if (state.score > state.best) state.best = state.score;
      return;
    }
    // A crash costs a life but the sortie continues from the last ring.
    state.overReason = reason;
    state.screen = SCREEN_OVER;
    state.completeNext = '';
    if (state.score > state.best) state.best = state.score;
  }

  function startGame() {
    loadMission(state.missionIndex);
    state.screen = SCREEN_PLAY;
    state.time = 0;
    audio.click();
  }

  function nextMission() {
    if (state.campaignDone) {
      reset(state.seed);
      state.screen = SCREEN_PLAY;
      return;
    }
    loadMission(state.missionIndex + 1);
    state.screen = SCREEN_PLAY;
  }

  /** Advance one fixed step. Returns EVENT_OVER when the game ends. */
  function step(dt, input) {
    state.time += dt;
    warnCooldown = Math.max(0, warnCooldown - dt);
    if (state.toastT > 0) state.toastT -= dt;
    // On the title screen the canyon flies itself, so the backdrop is alive.
    if (state.screen === SCREEN_TITLE) {
      const pilot = autopilot(flight.state, track, mission);
      flight.step(dt, pilot, track, mission, random);
      if (flight.state.z >= track.endZ - SEG_LEN * 2 || flight.state.crashed) loadMission(0);
      return 0;
    }
    if (state.screen !== SCREEN_PLAY) return 0;
    const f = flight.state;
    const throttle = input.throttle(dt);

    // The timed sortie's clock.
    if (mission.timeLimit > 0) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        crash('Out of time over the canyon.');
        return EVENT_OVER;
      }
    }

    const events = flight.step(dt, {
      steer: input.steer(),
      pitch: input.pitch(),
      throttle,
    }, track, mission, random);

    audio.update(throttle, f.speed / 340, f.stalled);

    if (events & EVENT_RING) {
      state.toast = 'RING  +150';
      state.toastT = 1.4;
      audio.ring(false);
      if (mission.timeLimit > 0) state.timeLeft += 4;
    }
    if (events & EVENT_PERFECT) {
      state.toast = 'PERFECT CENTRE  +500';
      state.toastT = 1.6;
      audio.ring(true);
      if (mission.timeLimit > 0) state.timeLeft += 4;
    }
    if (events & EVENT_REPAIR) {
      state.toast = 'REPAIR RING  +200  ·  HULL PATCHED';
      state.toastT = 1.8;
      audio.repair();
    }
    if (events & EVENT_EDGE) {
      state.toast = 'CLIPPED THE RING EDGE';
      state.toastT = 1.2;
    }
    if (events & EVENT_HIT) {
      if (warnCooldown <= 0) {
        audio.warn();
        warnCooldown = 0.5;
      }
    }
    if (events & EVENT_STALL) {
      if (warnCooldown <= 0) {
        audio.warn();
        warnCooldown = 1.2;
      }
    }
    if (events & EVENT_FUEL_EMPTY) {
      state.toast = 'FUEL EMPTY — GLIDING';
      state.toastT = 2;
    }
    if (events & EVENT_CRASH) {
      const reason = f.alt <= 0 && track.segmentAt(f.z)?.runway
        ? 'Too fast, too hard, or off the centreline on the runway.'
        : f.speed < 95
          ? 'Stalled into the canyon floor.'
          : 'The canyon wall had the last word.';
      crash(reason);
      return EVENT_OVER;
    }
    if (events & EVENT_LANDED) {
      const quality = f.landedQuality === 2 ? 'A perfect landing — greased it.'
        : f.landedQuality === 1 ? 'Down safe. The tower nods approvingly.'
          : 'Down, but the wheels found the dirt. It counts.';
      state.completeLine = quality;
      missionComplete(true);
      return 0;
    }
    if (events & EVENT_MISSION_END) {
      if (mission.endKind === 'landing' && !f.landed) {
        crash('Overshot the runway into the dark.');
        return EVENT_OVER;
      }
      missionComplete(false);
      return 0;
    }
    return 0;
  }

  /** The view the renderer draws: flight, track, mission and screen state. */
  function view() {
    return {
      flight: flight.state,
      track,
      mission,
      screen: state.screen,
      best: state.best,
      lives: state.lives,
      toast: state.toastT > 0 ? state.toast : '',
      toastT: state.toastT,
      timeLeft: state.timeLeft,
      time: state.time,
      overReason: state.overReason,
      completeTitle: state.completeTitle,
      completeLine: state.completeLine,
      completeNext: state.completeNext,
      rank: state.rank,
    };
  }

  function setBest(value) { state.best = value; }

  return {
    state, flight, reset, step, view, startGame, nextMission, loadMission, setBest,
    get mission() { return mission; },
    get track() { return track; },
    get screen() { return state.screen; },
  };
}
