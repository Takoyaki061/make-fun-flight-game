// The pseudo-3D renderer: a chase view down a canyon, drawn on one canvas.
// The canyon is a ribbon of segments projected with a pinhole camera; the
// plane is drawn fixed on screen, banking with the stick; the HUD is drawn
// on top. Far segments are drawn first so nearer ones cover them, and rings
// are drawn in the same pass, so a nearer wall hides a farther ring.
import { CAMERA_DEPTH, CAMERA_HEIGHT, DRAW_DISTANCE, FIELD, FLIGHT, FUEL, PALETTES, PLANE, SEG_LEN } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_COMPLETE = 4;

const W = FIELD.width;
const H = FIELD.height;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scaleX = 1;
  let scaleY = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    scaleX = canvas.width / W;
    scaleY = canvas.height / H;
  }

  function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ) {
    const dz = worldZ - cameraZ;
    if (dz < 2) return null;
    const scale = CAMERA_DEPTH / dz;
    return {
      x: W / 2 + scale * (worldX - cameraX) * (W / 2),
      y: H / 2 - scale * (worldY - cameraY) * (H / 2),
      w: scale * (W / 2),
      scale,
    };
  }

  function quad(x1, y1, x2, y2, x3, y3, x4, y4, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function drawSky(palette, time, curveTotal, night) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, palette.skyTop);
    g.addColorStop(0.55, palette.skyMid);
    g.addColorStop(1, palette.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.62);
    // Stars at night.
    if (night) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 90; i += 1) {
        const sx = ((i * 137.5) % W + W) % W;
        const sy = ((i * 89.3) % (H * 0.34));
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.7 + i));
        ctx.globalAlpha = tw * 0.8;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // The sun (or moon) with a halo.
    const sunX = palette.sunX * W;
    const sunY = palette.sunY * H;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    halo.addColorStop(0, palette.sun);
    halo.addColorStop(0.25, 'rgba(255,220,160,0.45)');
    halo.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Drifting clouds, parallaxed by the canyon's bend, warm and soft.
    ctx.fillStyle = 'rgba(255,228,196,0.38)';
    for (let i = 0; i < 7; i += 1) {
      const cx = (((i * 211 + time * 6 - curveTotal * 30) % (W + 320)) + W + 320) % (W + 320) - 160;
      const cy = 40 + (i % 4) * 42;
      const cw = 70 + (i % 3) * 36;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 13 + (i % 3) * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mesa silhouettes in two parallax layers, scrolling with the bends.
    drawMesaLayer(palette.mesaFar, curveTotal * 0.12, 0.48, 46);
    drawMesaLayer(palette.mesaNear, curveTotal * 0.3, 0.55, 64);
  }

  function drawMesaLayer(color, offset, baseY, height) {
    // A ridgeline, not a city: layered sines make flat tops and sloped sides,
    // and the band closes at its own base so it never paints the lower screen.
    ctx.fillStyle = color;
    ctx.beginPath();
    const base = H * baseY + 26;
    ctx.moveTo(-40, base);
    const step = 26;
    for (let x = -40; x <= W + 40; x += step) {
      const n = Math.sin((x + offset * 40) * 0.016) * 0.55
        + Math.sin((x + offset * 13) * 0.041) * 0.3
        + Math.sin((x + offset * 71) * 0.11) * 0.15;
      const top = H * baseY - Math.abs(n) * height - (Math.sin(x * 0.006 + offset) > 0.93 ? 18 : 0);
      ctx.lineTo(x, top);
    }
    ctx.lineTo(W + 40, base);
    ctx.closePath();
    ctx.fill();
  }

  function drawRing(p, ring, palette, time) {
    const r = p.w * ring.radius;
    if (r < 2) return;
    const cx = p.x;
    const cy = p.y;
    const color = ring.kind === 'repair' ? palette.repair : palette.ring;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.94);
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.min(26, r * 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    // Chevrons that march around the ring so it reads as a gate, not a disc.
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    for (let i = 0; i < 4; i += 1) {
      const a = time * 1.4 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, a, a + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLandmark(p1, p2, kind, palette) {
    if (!p1 || !p2) return;
    if (kind === 'arch') {
      const w1 = Math.max(2, p1.w * 4);
      const w2 = Math.max(2, p2.w * 4);
      const top1 = p1.y - p1.w * 26;
      const top2 = p2.y - p2.w * 26;
      quad(p1.x - p1.w * 52 - w1, p1.y, p1.x - p1.w * 52 + w1, p1.y, p2.x - p2.w * 52 + w2, top2, p2.x - p2.w * 52 - w2, top2, palette.wallA);
      quad(p1.x + p1.w * 52 - w1, p1.y, p1.x + p1.w * 52 + w1, p1.y, p2.x + p2.w * 52 + w2, top2, p2.x + p2.w * 52 - w2, top2, palette.wallA);
      quad(p1.x - p1.w * 58, top1, p1.x + p1.w * 58, top1, p2.x + p2.w * 58, top2, p2.x - p2.w * 58, top2, palette.wallTop);
    } else if (kind === 'bridge') {
      const deck1 = p1.y - p1.w * 10;
      const deck2 = p2.y - p2.w * 10;
      quad(p1.x - p1.w * 56, deck1, p1.x + p1.w * 56, deck1, p2.x + p2.w * 56, deck2, p2.x - p2.w * 56, deck2, '#7a5a44');
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, p1.w * 0.6);
      ctx.beginPath();
      ctx.moveTo(p1.x - p1.w * 56, deck1);
      ctx.lineTo(p2.x - p2.w * 56, deck2);
      ctx.moveTo(p1.x + p1.w * 56, deck1);
      ctx.lineTo(p2.x + p2.w * 56, deck2);
      ctx.stroke();
    }
  }

  function drawWorld(v) {
    const flight = v.flight;
    const track = v.track;
    const palette = PALETTES[v.mission.palette];
    const night = v.mission.palette === 'night';
    const playerSeg = Math.floor(flight.z / SEG_LEN);
    const baseSeg = track.segments[playerSeg] || track.segments[0];
    const cameraX = baseSeg.centreX + flight.x;
    const cameraY = baseSeg.floorY + flight.alt + CAMERA_HEIGHT;
    const cameraZ = flight.z;
    const shakeX = flight.shake > 0 ? (Math.random() * 2 - 1) * flight.shake * 5 : 0;
    const shakeY = flight.shake > 0 ? (Math.random() * 2 - 1) * flight.shake * 4 : 0;

    ctx.save();
    ctx.translate(shakeX * scaleX, shakeY * scaleY);
    drawSky(palette, v.time, baseSeg.centreX, night);

    // Haze band where the sky meets the terrain.
    const haze = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.62);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, palette.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.42, W, H * 0.2);

    // Segments far to near. A segment whose near edge sits behind the camera
    // is clipped to just in front of it, so the ground fills the bottom of
    // the screen instead of stopping a segment ahead.
    const end = Math.min(track.segments.length - 1, playerSeg + DRAW_DISTANCE);
    for (let i = end; i > playerSeg; i -= 1) {
      const a = track.segments[i];
      const b = track.segments[i - 1];
      if (!a || !b) continue;
      const zA = i * SEG_LEN;
      let zB = (i - 1) * SEG_LEN;
      let bEff = b;
      if (zB <= cameraZ + 1) {
        const t = (cameraZ + 2 - zB) / (zA - zB);
        bEff = {
          centreX: lerp(b.centreX, a.centreX, t),
          floorY: lerp(b.floorY, a.floorY, t),
          halfWidth: lerp(b.halfWidth, a.halfWidth, t),
          wallH: lerp(b.wallH, a.wallH, t),
          band: b.band,
        };
        zB = cameraZ + 2;
      }
      const pAL = project(a.centreX - a.halfWidth, a.floorY, zA, cameraX, cameraY, cameraZ);
      const pAR = project(a.centreX + a.halfWidth, a.floorY, zA, cameraX, cameraY, cameraZ);
      const pBL = project(bEff.centreX - bEff.halfWidth, bEff.floorY, zB, cameraX, cameraY, cameraZ);
      const pBR = project(bEff.centreX + bEff.halfWidth, bEff.floorY, zB, cameraX, cameraY, cameraZ);
      if (!pAL || !pAR || !pBL || !pBR) continue;
      if (pAL.y < H * 0.3 && pBL.y < H * 0.3) continue;

      // Canyon floor, alternating bands; the runway replaces it at the end.
      const floorColor = a.runway ? palette.runway : a.band === 0 ? palette.floorA : palette.floorB;
      quad(pBL.x, pBL.y, pBR.x, pBR.y, pAR.x, pAR.y, pAL.x, pAL.y, floorColor);
      // The river ribbon down the middle of the floor.
      if (!a.runway) {
        const rw = pAL.w * 3;
        const cxA = (pAL.x + pAR.x) / 2 + Math.sin(i * 0.11) * pAL.w * 13;
        const cxB = (pBL.x + pBR.x) / 2 + Math.sin((i - 1) * 0.11) * pBL.w * 13;
        quad(cxB - rw, pBL.y, cxB + rw, pBL.y, cxA + rw, pAL.y, cxA - rw, pAL.y, palette.river);
      }
      // Runway centre line and edge lights.
      if (a.runway) {
        if (i % 4 < 2) {
          const lw = pAL.w * 1.6;
          const cxA = (pAL.x + pAR.x) / 2;
          const cxB = (pBL.x + pBR.x) / 2;
          quad(cxB - lw, pBL.y, cxB + lw, pBL.y, cxA + lw, pAL.y, cxA - lw, pAL.y, palette.runwayLine);
        }
        if (i % 2 === 0) {
          ctx.save();
          ctx.shadowColor = '#ff8080';
          ctx.shadowBlur = Math.max(3, pAL.w * 6);
          ctx.fillStyle = i % 6 === 0 ? palette.runwayLight : '#ffffff';
          ctx.beginPath();
          ctx.arc(pAL.x, pAL.y - 1, Math.max(2, pAL.w * 2.2), 0, Math.PI * 2);
          ctx.arc(pAR.x, pAR.y - 1, Math.max(2, pAR.w * 2.2), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      // Canyon walls, leaning outward, with a lighter cap.
      const lean = 0.38;
      const wAL = project(a.centreX - a.halfWidth - a.wallH * lean, a.floorY + a.wallH, zA, cameraX, cameraY, cameraZ);
      const wBL = project(bEff.centreX - bEff.halfWidth - bEff.wallH * lean, bEff.floorY + bEff.wallH, zB, cameraX, cameraY, cameraZ);
      const wAR = project(a.centreX + a.halfWidth + a.wallH * lean, a.floorY + a.wallH, zA, cameraX, cameraY, cameraZ);
      const wBR = project(bEff.centreX + bEff.halfWidth + bEff.wallH * lean, bEff.floorY + bEff.wallH, zB, cameraX, cameraY, cameraZ);
      if (wAL && wBL) {
        quad(pBL.x, pBL.y, wBL.x, wBL.y, wAL.x, wAL.y, pAL.x, pAL.y, a.band === 0 ? palette.wallA : palette.wallB);
        quad(pBR.x, pBR.y, wBR.x, wBR.y, wAR.x, wAR.y, pAR.x, pAR.y, a.band === 0 ? palette.wallB : palette.wallA);
        // Strata: a darker lower half on each wall, so the rock reads in bands.
        const midL = { x: (pBL.x + wBL.x) / 2, y: (pBL.y + wBL.y) / 2 };
        const midLA = { x: (pAL.x + wAL.x) / 2, y: (pAL.y + wAL.y) / 2 };
        const midR = { x: (pBR.x + wBR.x) / 2, y: (pBR.y + wBR.y) / 2 };
        const midRA = { x: (pAR.x + wAR.x) / 2, y: (pAR.y + wAR.y) / 2 };
        quad(pBL.x, pBL.y, midL.x, midL.y, midLA.x, midLA.y, pAL.x, pAL.y, 'rgba(0,0,0,0.20)');
        quad(pBR.x, pBR.y, midR.x, midR.y, midRA.x, midRA.y, pAR.x, pAR.y, 'rgba(0,0,0,0.20)');
        // A thin lit edge along each wall's top, so the rim catches the sun.
        ctx.strokeStyle = palette.wallTop;
        ctx.lineWidth = Math.max(1, pAL.w * 1.4);
        ctx.beginPath();
        ctx.moveTo(wBL.x, wBL.y);
        ctx.lineTo(wAL.x, wAL.y);
        ctx.moveTo(wBR.x, wBR.y);
        ctx.lineTo(wAR.x, wAR.y);
        ctx.stroke();
      }
      // Landmarks stand in the canyon at their segment.
      if (a.landmark) {
        const q1 = project(a.centreX, a.floorY, zA, cameraX, cameraY, cameraZ);
        const q2 = project(b.centreX, b.floorY, zB, cameraX, cameraY, cameraZ);
        drawLandmark(q1, q2, a.landmark, palette);
      }
      // Rings ride in the same pass, so nearer walls hide farther rings.
      if (a.ring) {
        const rp = project(a.centreX + a.ring.offset * a.halfWidth, a.floorY + a.ring.height, zA, cameraX, cameraY, cameraZ);
        if (rp) drawRing(rp, a.ring, palette, v.time);
      }
    }

    drawPlaneShadow(v, cameraX, cameraY, cameraZ);
    drawPlane(v);
    ctx.restore();
  }

  function drawPlaneShadow(v, cameraX, cameraY, cameraZ) {
    const flight = v.flight;
    const track = v.track;
    const pos = track.positionAt(flight.z + 60);
    const p = project(pos.centreX + flight.x, pos.floorY + 0.4, flight.z + 60, cameraX, cameraY, cameraZ);
    if (!p) return;
    const h = Math.max(0, 1 - flight.alt / FLIGHT.ceiling);
    ctx.fillStyle = `rgba(0,0,0,${0.15 * h})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(4, p.w * 10 * h + 4), Math.max(2, p.w * 2.5 * h + 1.5), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlane(v) {
    const flight = v.flight;
    const bank = flight.bank;
    const px = PLANE.x + flight.x * 1.6 + bank * 46;
    const py = PLANE.y + flight.verticalSpeed * 0.9;
    const s = 1;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bank * 0.55);
    ctx.scale(s, s);
    // Contrails from the wingtips, trailing toward the viewer.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-PLANE.wingSpan / 2 + 8, 26);
    ctx.quadraticCurveTo(-PLANE.wingSpan / 2 - 26, 74, -PLANE.wingSpan / 2 - 44, 128);
    ctx.moveTo(PLANE.wingSpan / 2 - 8, 26);
    ctx.quadraticCurveTo(PLANE.wingSpan / 2 + 26, 74, PLANE.wingSpan / 2 + 44, 128);
    ctx.stroke();
    // Main wings with dihedral and a teal stripe.
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath();
    ctx.moveTo(-PLANE.wingSpan / 2, 18);
    ctx.lineTo(-26, -6);
    ctx.lineTo(26, -6);
    ctx.lineTo(PLANE.wingSpan / 2, 18);
    ctx.lineTo(PLANE.wingSpan / 2 - 14, 34);
    ctx.lineTo(-PLANE.wingSpan / 2 + 14, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0e7c86';
    ctx.beginPath();
    ctx.moveTo(-PLANE.wingSpan / 2 + 26, 16);
    ctx.lineTo(-26, -2);
    ctx.lineTo(26, -2);
    ctx.lineTo(PLANE.wingSpan / 2 - 26, 16);
    ctx.lineTo(PLANE.wingSpan / 2 - 40, 26);
    ctx.lineTo(-PLANE.wingSpan / 2 + 40, 26);
    ctx.closePath();
    ctx.fill();
    // Fuselage, tapering away from the viewer, cream with an orange spine.
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.moveTo(-30, 34);
    ctx.lineTo(-16, -58);
    ctx.lineTo(16, -58);
    ctx.lineTo(30, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e07840';
    ctx.beginPath();
    ctx.moveTo(-8, 34);
    ctx.lineTo(-5, -58);
    ctx.lineTo(5, -58);
    ctx.lineTo(8, 34);
    ctx.closePath();
    ctx.fill();
    // Tail fin and elevators.
    ctx.fillStyle = '#0e7c86';
    ctx.beginPath();
    ctx.moveTo(-4, -52);
    ctx.lineTo(0, -96);
    ctx.lineTo(5, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath();
    ctx.moveTo(-64, -44);
    ctx.lineTo(64, -44);
    ctx.lineTo(52, -30);
    ctx.lineTo(-52, -30);
    ctx.closePath();
    ctx.fill();
    // Canopy hump and navigation lights.
    ctx.fillStyle = '#274b5c';
    ctx.beginPath();
    ctx.ellipse(0, -30, 13, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.arc(-PLANE.wingSpan / 2 + 4, 24, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(PLANE.wingSpan / 2 - 4, 24, 4, 0, Math.PI * 2);
    ctx.fill();
    // Engine glow when the throttle is up.
    if (flight.throttle > 0.7) {
      ctx.fillStyle = `rgba(255,170,60,${(flight.throttle - 0.7) * 1.6})`;
      ctx.beginPath();
      ctx.ellipse(0, 40, 12, 20 + flight.throttle * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(8,12,20,${alpha ?? 0.62})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, frac))), h, h / 2);
    ctx.fill();
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.fillStyle = color;
    ctx.font = `${weight || 600} ${size}px ${'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawHUD(v) {
    const f = v.flight;
    const palette = PALETTES[v.mission.palette];
    const altFt = Math.round(f.alt * 32);
    const spdKt = Math.round(f.speed * 1.9);
    const hdg = Math.round(f.heading);
    // Top-left: altitude.
    panel(18, 16, 196, 64, 0.62);
    text('ALT', 32, 34, 12, '#9fb4c8', 'left', 700);
    text(`${altFt.toLocaleString()} FT`, 32, 58, 26, '#ffe9a8');
    // Top-centre: compass heading.
    panel(W / 2 - 150, 16, 300, 64, 0.62);
    text('HDG', W / 2 - 136, 34, 12, '#9fb4c8', 'left', 700);
    text(`${String(hdg).padStart(3, '0')}°`, W / 2, 58, 26, '#ffe9a8', 'center');
    ctx.strokeStyle = 'rgba(255,233,168,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 76);
    ctx.lineTo(W / 2 - 5, 68);
    ctx.lineTo(W / 2 + 5, 68);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,233,168,0.7)';
    ctx.fill();
    // Top-right: speed and throttle.
    panel(W - 214, 16, 196, 64, 0.62);
    text('SPD', W - 200, 34, 12, '#9fb4c8', 'left', 700);
    text(`${spdKt} KT`, W - 32, 58, 26, '#ffe9a8', 'right');
    bar(W - 200, 70, 168, 7, f.throttle, '#4ade80');
    text('THR', W - 200, 58, 11, '#9fb4c8', 'left', 700);
    // Bottom-left: fuel and hull.
    panel(18, H - 92, 240, 76, 0.62);
    text('FUEL', 32, H - 72, 12, '#9fb4c8', 'left', 700);
    bar(32, H - 58, 212, 10, f.fuel / FUEL.tank, f.fuel < 25 ? '#ff5d5d' : '#ffd23f');
    text('HULL', 32, H - 34, 12, '#9fb4c8', 'left', 700);
    bar(32, H - 20, 212, 10, 1 - f.damage / 100, f.damage > 60 ? '#ff5d5d' : '#4ade80');
    // Bottom-right: mission, rings, score.
    panel(W - 258, H - 92, 240, 76, 0.62);
    text(v.mission.name.toUpperCase(), W - 32, H - 72, 13, '#ffe9a8', 'right', 700);
    text(`RINGS ${f.ringsPassed}/${f.ringsTotal}`, W - 32, H - 46, 15, '#eef1f5', 'right');
    text(`SCORE ${f.score.toLocaleString()}`, W - 32, H - 22, 15, '#eef1f5', 'right');
    // Timer for timed sorties.
    if (v.timeLeft > 0) {
      panel(W / 2 - 70, H - 64, 140, 44, 0.62);
      text(`⏱ ${Math.ceil(v.timeLeft)}s`, W / 2, H - 42, 22, v.timeLeft < 20 ? '#ff5d5d' : '#eef1f5', 'center');
    }
    // Lives.
    for (let i = 0; i < v.lives; i += 1) {
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath();
      ctx.arc(34 + i * 26, 108, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warnings.
    if (f.stalled) {
      text('STALL — NOSE DOWN, ADD THROTTLE', W / 2, 116, 22, '#ff5d5d', 'center', 800);
    } else if (f.overspeed) {
      text('OVERSPEED', W / 2, 116, 22, '#ffb020', 'center', 800);
    } else if (f.fuel < 25 && f.fuel > 0) {
      text('LOW FUEL — THREAD A RING', W / 2, 116, 22, '#ffd23f', 'center', 800);
    }
    // Wind indicator in the slalom.
    if (v.mission.wind > 0 && Math.abs(f.windPush) > 8) {
      text(f.windPush > 0 ? 'WIND →' : '← WIND', W / 2, 146, 18, '#cfe8f7', 'center', 700);
    }
    // Toast messages.
    if (v.toast) {
      ctx.globalAlpha = Math.min(1, v.toastT * 2);
      text(v.toast, W / 2, H * 0.30, 30, '#ffffff', 'center', 800);
      ctx.globalAlpha = 1;
    }
    // Speed lines at full throttle.
    if (f.speed > 300) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const y = 60 + i * 84 + ((v.time * 300) % 84);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(70, y - 14);
        ctx.moveTo(W, y);
        ctx.lineTo(W - 70, y - 14);
        ctx.stroke();
      }
    }
    void palette;
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6,10,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 330, H / 2 - 190, 660, 380, 0.78);
    text(title, W / 2, H / 2 - 138, 44, accent || '#ffe9a8', 'center', 800);
    lines.forEach((line, i) => {
      if (!line.text) return;
      text(line.text, W / 2, H / 2 - 84 + i * 34, line.size || 18, line.color || '#eef1f5', 'center', line.weight || 500);
    });
  }

  function draw(v) {
    resize();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (v.screen === SCREEN_TITLE) {
      drawWorld(v);
      overlay('CANYON COURIER', [
        { text: 'A chase-view flight game — thread the rings, mind the fuel, land it at night.', size: 17, color: '#cfe8f7' },
        { text: 'SORTIE 1  Dawn Patrol — 12 rings, fuel is the enemy', size: 17 },
        { text: 'SORTIE 2  Canyon Slalom — timed, wind gusts, rings add time', size: 17 },
        { text: 'SORTIE 3  Night Landing — slow down and put her on the runway', size: 17 },
        { text: 'W/S pitch  ·  A/D bank  ·  SHIFT / CTRL throttle  ·  mouse steers too', size: 16, color: '#9fb4c8' },
        { text: 'P pause  ·  R restart  ·  M mute', size: 16, color: '#9fb4c8' },
        { text: 'PRESS ENTER TO FLY', size: 22, color: '#ffd23f', weight: 800 },
        { text: v.best > 0 ? `BEST SCORE ${v.best.toLocaleString()}` : '', size: 16, color: '#9fb4c8' },
      ], '#ffd23f');
      return;
    }
    drawWorld(v);
    drawHUD(v);
    if (v.screen === SCREEN_PAUSED) {
      overlay('PAUSED', [
        { text: 'Take a breath. The canyon waits.', size: 18, color: '#cfe8f7' },
        { text: 'P or ENTER to keep flying  ·  R to restart', size: 17, color: '#9fb4c8' },
      ]);
    } else if (v.screen === SCREEN_OVER) {
      overlay('DOWN IN THE CANYON', [
        { text: v.overReason || 'The canyon wins this time.', size: 18, color: '#cfe8f7' },
        { text: `SCORE ${v.flight.score.toLocaleString()}   ·   RINGS ${v.flight.ringsPassed}/${v.flight.ringsTotal}`, size: 19 },
        { text: v.lives > 0 ? `Lives left: ${v.lives} — press ENTER to fly again` : 'Out of lives — press ENTER to start over', size: 17, color: '#ffd23f' },
        { text: v.best > 0 ? `BEST ${v.best.toLocaleString()}` : '', size: 16, color: '#9fb4c8' },
      ], '#ff5d5d');
    } else if (v.screen === SCREEN_COMPLETE) {
      overlay(v.completeTitle || 'SORTIE COMPLETE', [
        { text: v.completeLine || '', size: 18, color: '#cfe8f7' },
        { text: `SCORE ${v.flight.score.toLocaleString()}   ·   RINGS ${v.flight.ringsPassed}/${v.flight.ringsTotal}`, size: 19 },
        { text: `RANK: ${v.rank || 'WINGMAN'}`, size: 22, color: '#ffd23f', weight: 800 },
        { text: v.completeNext || 'Press ENTER for the next sortie', size: 17, color: '#ffd23f' },
        { text: v.best > 0 ? `BEST ${v.best.toLocaleString()}` : '', size: 16, color: '#9fb4c8' },
      ], '#4ade80');
    }
  }

  return { draw, resize };
}
