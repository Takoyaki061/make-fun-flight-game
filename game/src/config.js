// Canyon Courier — every tuning number, colour and mission in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One track segment is this long, in world units. */
export const SEG_LEN = 200;
/** How many segments ahead the renderer draws. */
export const DRAW_DISTANCE = 140;
/** Camera depth for the perspective projection (1 / tan(fov / 2)). */
export const CAMERA_DEPTH = 0.84;
/** How far the camera sits above the plane, in world units. */
export const CAMERA_HEIGHT = 13;

/** Flight model. Speeds are world units per second; altitude is world units above the canyon floor. */
export const FLIGHT = {
  maxSpeed: 340,
  minSpeed: 60,
  /** Below this speed the wing stops flying and the nose drops. */
  stallSpeed: 95,
  /** How fast speed chases the throttle's target speed. */
  accel: 0.9,
  /** Climb rate at full pitch, world units per second. */
  climbRate: 26,
  /** Sink rate when stalled or throttled back. */
  sinkRate: 18,
  /** Highest the plane may fly above the floor. */
  ceiling: 90,
  /** Turn rate (lateral units per second) at stall speed; falls as speed rises. */
  turnAtSlow: 150,
  turnAtFast: 55,
  /** Lateral push from a canyon bend, scaled by speed. */
  curvePush: 0.55,
  /** How fast the bank angle follows the steering input. */
  bankRate: 3.2,
  maxBank: 0.85,
  /** Overspeed shakes the airframe above this fraction of max speed. */
  overspeed: 0.92,
};

/** Fuel: a full tank, in seconds of full-throttle flight, and the drain rates. */
export const FUEL = {
  tank: 120,
  drainFull: 1.0,
  drainIdle: 0.25,
  /** Fuel a ring refunds, scaled by how close to its centre you thread it. */
  ringRefund: 18,
  /** Fuel a missed ring costs you in time alone (nothing back). */
  startFuel: 100,
};

/** Damage: 100 is a wreck. Each hit adds drag, which cuts top speed and turn rate. */
export const DAMAGE = {
  wallClip: 9,
  ringEdge: 5,
  hardLanding: 40,
  /** Repair rings restore this much hull. */
  repairRing: 45,
  /** Top-speed and turn-rate loss at 100 damage. */
  dragAtFull: 0.35,
};

/** Lives, and the score table. */
export const LIVES = 3;
export const SCORE = {
  ringCentre: 500,
  ringEdge: 150,
  repairRing: 200,
  timeBonusPerSecond: 25,
  landingPerfect: 1500,
  landingGood: 800,
  landingRough: 300,
};

/** Wind gusts in the slalom: lateral push, world units per second, changing this often. */
export const WIND = { maxPush: 55, changeEvery: 2.5 };

/** The three sorties of the campaign, in order. */
export const MISSIONS = [
  {
    id: 'patrol',
    name: 'Dawn Patrol',
    goal: 'Thread 12 rings to the end of the canyon. Centred rings refund fuel.',
    palette: 'dawn',
    rings: 12,
    timeLimit: 0,
    wind: 0,
    length: 260,
    bends: 5,
    endKind: 'rings',
  },
  {
    id: 'slalom',
    name: 'Canyon Slalom',
    goal: 'Timed run: gates swing left and right, gusts push you sideways. Rings add time.',
    palette: 'day',
    rings: 16,
    timeLimit: 240,
    wind: 1,
    length: 240,
    bends: 9,
    endKind: 'timed',
  },
  {
    id: 'landing',
    name: 'Night Landing',
    goal: 'Land on the lit runway: slow down, descend, touch down inside the zone.',
    palette: 'night',
    rings: 8,
    timeLimit: 0,
    wind: 0.4,
    length: 180,
    bends: 3,
    endKind: 'landing',
  },
];

/** Sky, terrain and light per palette. */
export const PALETTES = {
  dawn: {
    skyTop: '#2b3a6b', skyMid: '#e8825a', skyLow: '#f7b267',
    sun: '#ffd9a0', sunX: 0.72, sunY: 0.30,
    haze: 'rgba(247,178,103,0.35)',
    mesaFar: '#8a5f6d', mesaNear: '#6e4a52',
    floorA: '#c98d54', floorB: '#b57a45',
    wallA: '#a55f3d', wallB: '#8f4f33', wallTop: '#d9a06b',
    river: '#5fb4c9',
    ring: '#ffd23f', ringEdge: '#ff9d00',
    repair: '#4ade80',
    runway: '#3a3f4a', runwayLine: '#ffe9a8', runwayLight: '#ff5d5d',
  },
  day: {
    skyTop: '#3d7ac2', skyMid: '#7fb2e5', skyLow: '#cfe8f7',
    sun: '#fff3c4', sunX: 0.25, sunY: 0.22,
    haze: 'rgba(207,232,247,0.30)',
    mesaFar: '#7d8aa8', mesaNear: '#5f6f8f',
    floorA: '#d9a05e', floorB: '#c68d4e',
    wallA: '#b06a42', wallB: '#96552f', wallTop: '#e0aa6e',
    river: '#3f9ec2',
    ring: '#ffd23f', ringEdge: '#ff9d00',
    repair: '#4ade80',
    runway: '#3a3f4a', runwayLine: '#ffe9a8', runwayLight: '#ff5d5d',
  },
  night: {
    skyTop: '#0a0e24', skyMid: '#1c2450', skyLow: '#3a2b55',
    sun: '#e8ecff', sunX: 0.68, sunY: 0.24,
    haze: 'rgba(58,43,85,0.40)',
    mesaFar: '#2c3355', mesaNear: '#1f2540',
    floorA: '#5d4a68', floorB: '#4e3e58',
    wallA: '#43324e', wallB: '#362741', wallTop: '#6b5578',
    river: '#2c5f7a',
    ring: '#ffd23f', ringEdge: '#ff9d00',
    repair: '#4ade80',
    runway: '#23262e', runwayLine: '#ffe9a8', runwayLight: '#ff5d5d',
  },
};

export const PALETTE = PALETTES.dawn;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'canyon-courier.best';

/** Plane drawing: the aircraft on screen, in pixels at 1280x720. */
export const PLANE = {
  x: 640, y: 492,
  wingSpan: 300,
  bodyLength: 150,
  /** Lateral screen shift per unit of lateral world position. */
  screenShift: 120,
};
