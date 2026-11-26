// The autopilot and the screenshot scenes behind ?shot=start|play|rings|
// landing. The autopilot flies the real rules: it steers and pitches toward
// the next ring, trims the throttle to turn tighter when it is off line, and
// on the night sortie it bleeds speed and descends onto the runway. Each
// scene plays the game forward from a fresh world for a fixed time, so the
// frame is what a real game looks like and the same seed always gives the
// same frame.
import { FLIGHT, SEG_LEN, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const RINGS_SECONDS = 48;
const LANDING_LIMIT_SECONDS = 420;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** How many segments ahead the next ring is, or Infinity when none is near. */
function nextRingDistance(flight, track) {
  const playerSeg = Math.floor(flight.z / SEG_LEN);
  for (let i = playerSeg; i < Math.min(track.segments.length, playerSeg + 80); i += 1) {
    const seg = track.segments[i];
    if (seg.ring && !seg.ring.passed) return i - playerSeg;
  }
  return Infinity;
}

/** Steer, pitch and throttle that fly toward the next ring (or the runway). */
export function autopilot(flight, track, mission) {
  const playerSeg = Math.floor(flight.z / SEG_LEN);
  const pos = track.positionAt(flight.z);
  let targetX = 0;
  let targetAlt = 26;
  let throttle = 0.62;

  // The next ring not yet passed.
  let ring = null;
  for (let i = playerSeg; i < Math.min(track.segments.length, playerSeg + 60); i += 1) {
    const seg = track.segments[i];
    if (seg.ring && !seg.ring.passed) {
      ring = seg.ring;
      const rpos = track.positionAt(i * SEG_LEN);
      targetX = ring.offset * rpos.halfWidth;
      targetAlt = ring.height;
      break;
    }
  }

  // On the night sortie, once the runway is near, fly the approach: hold
  // flying speed (never below stall), descend to the strip, hold the centreline.
  const runwayNear = mission.endKind === 'landing' && flight.z > track.runwayStartZ - 50 * SEG_LEN;
  if (runwayNear) {
    targetX = 0;
    targetAlt = flight.z > track.runwayStartZ ? 0 : 6;
    throttle = flight.z > track.runwayStartZ ? 0.45 : 0.4;
    if (flight.speed > 170) throttle = 0.3;
  } else if (ring) {
    const xErr = targetX - flight.x;
    if (Math.abs(xErr) > 25) throttle = 0.45;
    if (flight.speed < FLIGHT.stallSpeed + 15) throttle = 0.85;
    // Lean cruise when no ring is near: fuel is the long game's enemy.
    const d = nextRingDistance(flight, track);
    if (d > 40) throttle = Math.min(throttle, 0.5);
  }

  // A timed sortie wants full burn: the clock, not the fuel, is the enemy.
  if (mission.timeLimit > 0 && !runwayNear) {
    throttle = 0.95;
    const xErr = targetX - flight.x;
    if (Math.abs(xErr) > 30) throttle = 0.7;
    if (flight.speed < FLIGHT.stallSpeed + 15) throttle = 1;
  }

  // Never fly into a wall: hard over toward the centre when close to one.
  let steer = clamp((targetX - flight.x) * 0.045, -1, 1);
  if (Math.abs(flight.x) > pos.halfWidth - 8) {
    steer = clamp(-Math.sign(flight.x), -1, 1);
  }
  const pitch = clamp((flight.alt - targetAlt) * 0.09, -1, 1);
  return { steer, pitch, throttle };
}

/**
 * Set `world` to the named scene (start, play, rings or landing) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world, random) {
  const flight = world.flight;
  if (name === 'landing') {
    world.reset(7);
    world.loadMission(2);
    for (let i = 0; i < LANDING_LIMIT_SECONDS / STEP; i += 1) {
      const pilot = autopilot(flight.state, world.track, world.mission);
      const before = flight.state.z;
      flight.step(STEP, pilot, world.track, world.mission, random);
      // Stop on the approach: runway lights ahead, low and slow, HUD lit.
      if (flight.state.z > world.track.runwayStartZ - 6 * SEG_LEN && flight.state.alt < 12) break;
      if (flight.state.crashed || flight.state.landed || flight.state.z <= before) break;
    }
    world.state.toast = '';
    world.state.toastT = 0;
    return { screen: SCREEN_PLAY, best: flight.state.score };
  }
  if (name === 'rings') {
    world.reset(7);
    world.loadMission(1);
    for (let i = 0; i < RINGS_SECONDS / STEP; i += 1) {
      const pilot = autopilot(flight.state, world.track, world.mission);
      flight.step(STEP, pilot, world.track, world.mission, random);
      if (flight.state.crashed) break;
      // Stop with a gate close ahead, the plane banked into the turn.
      const d = nextRingDistance(flight.state, world.track);
      if (i > 20 * 60 && d >= 4 && d <= 9) break;
    }
    world.state.toast = '';
    world.state.toastT = 0;
    return { screen: SCREEN_PLAY, best: flight.state.score };
  }
  if (name === 'play') {
    world.reset(7);
    for (let i = 0; i < PLAY_SECONDS * 2 / STEP; i += 1) {
      const pilot = autopilot(flight.state, world.track, world.mission);
      flight.step(STEP, pilot, world.track, world.mission, random);
      if (flight.state.crashed) break;
      // Stop with a ring in clear view ahead, after at least 20 seconds of flight.
      const d = nextRingDistance(flight.state, world.track);
      if (i > 20 * 60 && d >= 4 && d <= 9) break;
    }
    world.state.toast = '';
    world.state.toastT = 0;
    return { screen: SCREEN_PLAY, best: flight.state.score };
  }
  world.reset(7);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    const pilot = autopilot(flight.state, world.track, world.mission);
    flight.step(STEP, pilot, world.track, world.mission, random);
    if (flight.state.crashed) break;
  }
  world.state.toast = '';
  world.state.toastT = 0;
  return { screen: SCREEN_TITLE, best: 0 };
}
