// The procedural canyon: a list of segments the renderer projects and the
// flight model flies along. One segment is SEG_LEN world units long. Each one
// carries the canyon centre's lateral offset (from the bends), the floor
// height, the half-width, the wall height, and optionally a ring, a landmark
// or a piece of runway. Everything comes from the seed, so the same seed
// builds the same canyon.
import { SEG_LEN } from './config.js';
import { range } from './random.js';

/** How many straight segments open a mission, before the first bend. */
const LEAD_IN = 14;
/** Rings sit this far apart, in segments, at least. */
const RING_GAP = 16;

export function createTrack(random, mission) {
  const total = mission.length + LEAD_IN + 30;
  const segments = [];
  let centreX = 0;
  let floorY = 0;
  let width = 46;
  let wallH = 44;
  let bendLeft = 0;
  let bendCurve = 0;
  let bendsDone = 0;
  let nextRingAt = LEAD_IN + 12;
  let ringCount = 0;
  let lastRingOffset = 0;
  let lastRingHeight = 26;

  for (let i = 0; i < total; i += 1) {
    // Bends: pick a new bend every so often, ease the curve in and out.
    if (bendLeft <= 0 && i > LEAD_IN && bendsDone < mission.bends && random() < 0.02) {
      bendLeft = Math.floor(range(random, 28, 52));
      bendCurve = range(random, -2.4, 2.4);
      bendsDone += 1;
    }
    let curve = 0;
    if (bendLeft > 0) {
      const phase = 1 - bendLeft / 52;
      curve = bendCurve * Math.sin(Math.min(1, phase) * Math.PI);
      bendLeft -= 1;
    }
    centreX += curve;
    // Gentle floor hills, and a slow drift so the canyon never feels flat.
    floorY += range(random, -0.5, 0.5);
    floorY = Math.max(-14, Math.min(14, floorY * 0.985));
    // The canyon narrows and widens; walls rise and fall with it.
    width += range(random, -0.9, 0.9);
    width = Math.max(26, Math.min(58, width));
    wallH += range(random, -1.2, 1.2);
    wallH = Math.max(28, Math.min(68, wallH));

    const segment = {
      index: i,
      centreX,
      floorY,
      halfWidth: width,
      wallH,
      ring: null,
      landmark: null,
      runway: false,
      band: i % 2,
    };

    // Landmarks: a rock arch and a river bridge, so the canyon has places.
    if (i === Math.floor(total * 0.38)) segment.landmark = 'arch';
    if (i === Math.floor(total * 0.66)) segment.landmark = 'bridge';

    // Rings: spaced out, swinging side to side and up and down, never two
    // in a row at the same place. Every fifth ring repairs the hull.
    if (i >= nextRingAt && ringCount < mission.rings && i < total - 40) {
      const offset = Math.max(-0.62, Math.min(0.62, lastRingOffset + range(random, -0.55, 0.55)));
      const height = Math.max(12, Math.min(52, lastRingHeight + range(random, -16, 16)));
      const kind = (ringCount + 1) % 5 === 0 ? 'repair' : 'ring';
      segment.ring = { offset, height, radius: 26, kind, index: ringCount, passed: false };
      lastRingOffset = offset;
      lastRingHeight = height;
      ringCount += 1;
      nextRingAt = i + RING_GAP + Math.floor(random() * 8);
    }
    segments.push(segment);
  }

  // The landing mission ends on a runway: flat, wide, straight, lit. The
  // approach is flattened too, so the final descent is over level ground.
  if (mission.endKind === 'landing') {
    for (let i = total - 60; i < total; i += 1) {
      segments[i].floorY = 0;
    }
    for (let i = total - 30; i < total; i += 1) {
      const s = segments[i];
      s.runway = true;
      s.halfWidth = 34;
      s.wallH = 6;
      s.floorY = 0;
      s.centreX = segments[total - 31].centreX;
      s.ring = null;
    }
  }

  const length = total * SEG_LEN;

  function segmentAt(z) {
    const i = Math.max(0, Math.min(segments.length - 1, Math.floor(z / SEG_LEN)));
    return segments[i];
  }

  /** The canyon centre and floor at a world z, interpolated between segments. */
  function positionAt(z) {
    const f = Math.max(0, Math.min(segments.length - 1.001, z / SEG_LEN));
    const i = Math.floor(f);
    const t = f - i;
    const a = segments[i];
    const b = segments[Math.min(segments.length - 1, i + 1)];
    return {
      centreX: a.centreX + (b.centreX - a.centreX) * t,
      floorY: a.floorY + (b.floorY - a.floorY) * t,
      halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * t,
      wallH: a.wallH + (b.wallH - a.wallH) * t,
    };
  }

  return {
    segments,
    length,
    total,
    segmentAt,
    positionAt,
    ringCount,
    runwayStartZ: mission.endKind === 'landing' ? (total - 30) * SEG_LEN : Infinity,
    endZ: length,
  };
}
