// The flight model: speed follows the throttle, the turn rate depends on
// airspeed (tight when slow, wide when fast), the wing stalls below stall
// speed, fuel drains with throttle, and damage adds drag that cuts top speed
// and widens every turn. The model returns events the world scores.
import { DAMAGE, FLIGHT, FUEL, SCORE, SEG_LEN } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_PERFECT = 2;
export const EVENT_REPAIR = 4;
export const EVENT_HIT = 8;
export const EVENT_CRASH = 16;
export const EVENT_LANDED = 32;
export const EVENT_MISSION_END = 64;
export const EVENT_FUEL_EMPTY = 128;
export const EVENT_STALL = 256;
export const EVENT_EDGE = 512;

export function createFlight() {
  const state = {
    z: 0, x: 0, alt: 14, speed: 0, bank: 0,
    throttle: 0.55, fuel: FUEL.startFuel, damage: 0,
    heading: 0, verticalSpeed: 0, windPush: 0, windTimer: 0,
    ringsPassed: 0, ringsTotal: 0, score: 0,
    shake: 0, stalled: false, overspeed: false,
    crashed: false, landed: false, landedQuality: 0,
    hitCooldown: 0, lastRingIndex: -1, time: 0, elapsed: 0,
  };

  function reset(mission) {
    state.z = 0;
    state.x = 0;
    state.alt = 14;
    state.speed = 60;
    state.bank = 0;
    state.throttle = 0.55;
    state.fuel = FUEL.startFuel;
    state.damage = 0;
    state.heading = 0;
    state.verticalSpeed = 0;
    state.windPush = 0;
    state.windTimer = 0;
    state.ringsPassed = 0;
    state.ringsTotal = mission.rings;
    state.score = 0;
    state.shake = 0;
    state.stalled = false;
    state.overspeed = false;
    state.crashed = false;
    state.landed = false;
    state.landedQuality = 0;
    state.hitCooldown = 0;
    state.lastRingIndex = -1;
    state.time = 0;
    state.elapsed = 0;
  }

  /** Advance one fixed step. Returns event flags. */
  function step(dt, input, track, mission, random) {
    if (state.crashed || state.landed) return EVENT_NONE;
    let events = EVENT_NONE;
    state.elapsed += dt;

    // Wind gusts in the slalom push the plane sideways, changing every few seconds.
    if (mission.wind > 0) {
      state.windTimer -= dt;
      if (state.windTimer <= 0) {
        state.windTimer = 2.5;
        state.windPush = (random() * 2 - 1) * 55 * mission.wind;
      }
    } else {
      state.windPush = 0;
    }

    // Fuel: out of fuel the throttle dies and the plane glides down.
    const throttle = state.fuel > 0 ? input.throttle : 0;
    state.throttle = throttle;
    state.fuel = Math.max(0, state.fuel - (FUEL.drainIdle + throttle * (FUEL.drainFull - FUEL.drainIdle)) * dt);
    if (state.fuel <= 0 && !(events & EVENT_FUEL_EMPTY)) events |= EVENT_FUEL_EMPTY;

    // Speed chases the throttle's target; damage drag lowers the ceiling.
    const drag = 1 - (state.damage / 100) * DAMAGE.dragAtFull;
    const maxSpeed = FLIGHT.maxSpeed * drag;
    const targetSpeed = throttle * maxSpeed;
    state.speed += (targetSpeed - state.speed) * Math.min(1, FLIGHT.accel * dt);
    if (state.speed < 0) state.speed = 0;
    const speedFrac = state.speed / FLIGHT.maxSpeed;
    state.overspeed = speedFrac > FLIGHT.overspeed;
    state.shake = state.overspeed ? Math.min(1, state.shake + dt * 3) : Math.max(0, state.shake - dt * 3);

    // Bank follows the stick; the turn rate is airspeed-dependent.
    const bankTarget = input.steer * FLIGHT.maxBank;
    state.bank += (bankTarget - state.bank) * Math.min(1, FLIGHT.bankRate * dt);
    const turnRate = FLIGHT.turnAtSlow + (FLIGHT.turnAtFast - FLIGHT.turnAtSlow) * speedFrac;
    const turnDrag = 1 - (state.damage / 100) * DAMAGE.dragAtFull * 0.8;

    // The canyon bends under the plane: hold the stick or drift wide.
    const seg = track.segmentAt(state.z);
    const bendDrift = seg ? (seg.centreX - track.segmentAt(Math.max(0, state.z - SEG_LEN)).centreX) / SEG_LEN : 0;
    state.x += (state.bank * turnRate * turnDrag + state.windPush - bendDrift * state.speed * 0.9) * dt;
    state.heading = (((state.heading - bendDrift * state.speed * dt * 2.2) % 360) + 360) % 360;

    // Pitch: climb only while the wing flies; below stall speed the nose drops.
    const climbPower = Math.max(0, Math.min(1, (state.speed - FLIGHT.stallSpeed) / (FLIGHT.maxSpeed - FLIGHT.stallSpeed)));
    state.stalled = state.speed < FLIGHT.stallSpeed;
    if (state.stalled) events |= EVENT_STALL;
    let vSpeed = -input.pitch * FLIGHT.climbRate * climbPower;
    if (state.stalled) vSpeed -= FLIGHT.sinkRate * (1 - climbPower);
    if (input.pitch > 0) vSpeed -= FLIGHT.sinkRate * 0.4;
    state.verticalSpeed = vSpeed;
    state.alt += vSpeed * dt;
    if (state.alt > FLIGHT.ceiling) state.alt = FLIGHT.ceiling;

    // Forward motion. The floor rises and falls under the plane, so the
    // altitude follows it: a hill under a low plane is a crash, as it is.
    const floorBefore = track.positionAt(state.z).floorY;
    state.z += state.speed * dt;
    state.alt -= track.positionAt(state.z).floorY - floorBefore;
    state.time += dt;
    state.hitCooldown = Math.max(0, state.hitCooldown - dt);

    const pos = track.positionAt(state.z);

    // Canyon walls: clip one and it costs hull, speed and line.
    if (Math.abs(state.x) > pos.halfWidth - 1 && state.hitCooldown <= 0 && !seg?.runway) {
      state.damage = Math.min(100, state.damage + DAMAGE.wallClip);
      state.speed *= 0.94;
      state.x = Math.sign(state.x) * (pos.halfWidth - 1);
      state.hitCooldown = 0.6;
      events |= EVENT_HIT;
    }

    // Terrain: the floor is a crash unless this is the runway and we land right.
    if (state.alt <= 0) {
      if (seg?.runway) {
        return land(dt, seg, pos, events);
      }
      state.alt = 0;
      state.crashed = true;
      return events | EVENT_CRASH;
    }

    // Rings: passing one's plane scores by centredness and refunds fuel.
    if (seg?.ring && !seg.ring.passed && state.z >= seg.index * SEG_LEN) {
      seg.ring.passed = true;
      const ring = seg.ring;
      const dx = state.x - ring.offset * pos.halfWidth;
      const dy = state.alt - ring.height;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ring.radius) {
        const centred = 1 - dist / ring.radius;
        state.ringsPassed += 1;
        state.lastRingIndex = ring.index;
        if (ring.kind === 'repair') {
          state.damage = Math.max(0, state.damage - DAMAGE.repairRing);
          state.score += SCORE.repairRing;
          events |= EVENT_REPAIR;
        } else {
          const perfect = centred > 0.7;
          state.score += perfect ? SCORE.ringCentre : SCORE.ringEdge;
          state.fuel = Math.min(FUEL.tank, state.fuel + FUEL.ringRefund * centred);
          events |= EVENT_RING;
          if (perfect) events |= EVENT_PERFECT;
        }
      } else if (dist <= ring.radius + 7) {
        state.damage = Math.min(100, state.damage + DAMAGE.ringEdge);
        state.speed *= 0.96;
        events |= EVENT_EDGE | EVENT_HIT;
      }
    }

    // Mission end: reached the end of the canyon.
    if (state.z >= track.endZ - SEG_LEN * 2) {
      events |= EVENT_MISSION_END;
    }
    return events;
  }

  /** The landing mission's touchdown check, run when the wheels meet the runway. */
  function land(dt, seg, pos, events) {
    void dt;
    void seg;
    const speedOk = state.speed < 175;
    const gentle = Math.abs(state.verticalSpeed) < 9;
    const centred = Math.abs(state.x) < pos.halfWidth * 0.5;
    if (speedOk && gentle && centred) {
      state.landed = true;
      const quality = state.speed < 120 && Math.abs(state.verticalSpeed) < 5 ? 2 : state.speed < 150 ? 1 : 0;
      state.landedQuality = quality;
      state.score += quality === 2 ? SCORE.landingPerfect : quality === 1 ? SCORE.landingGood : SCORE.landingRough;
      return events | EVENT_LANDED;
    }
    if (!speedOk || !gentle) {
      state.damage = Math.min(100, state.damage + DAMAGE.hardLanding);
      state.crashed = true;
      return events | EVENT_CRASH;
    }
    // Off-centre but gentle: a rough landing that still counts, wheels in the dirt.
    state.landed = true;
    state.landedQuality = 0;
    state.score += SCORE.landingRough;
    return events | EVENT_LANDED;
  }

  return { state, reset, step };
}
