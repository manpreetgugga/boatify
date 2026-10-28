// The wind field: a prevailing wind that shifts over time, gust and lull
// patches that drift downwind, and local effects (calm patches, storm cells
// and the wind shadow in the lee of islands).

import { DEG, clamp, smoothstep, fromBearing, lerpAngle, wrapAngle, pointInPolygon, polygonArea } from '../core/math.js';
import { createNoise2D } from '../core/rng.js';

const GUST_SCALE = 150;
const SHADOW_STRENGTH = 0.68;

// An island blocks the wind as a set of circles covering its footprint, so a
// long ridge casts a strip of shadow instead of one huge disc. Tall rocky
// islands throw a longer lee than low sandbars; `shadow` on the island
// definition overrides that.
export function shadowSources(isl) {
  const re = Math.sqrt(polygonArea(isl.pts) / Math.PI);
  const height = isl.shadow ?? (isl.kind === 'rock' ? 1 : 0.6);
  const reach = clamp(re * 3.4, 140, 380) * height;
  if (isl.radius < re * 1.45) return [{ x: isl.cx, y: isl.cy, r: re, reach }];
  const cell = clamp(re * 0.55, 28, 64);
  const b = isl.bounds;
  const out = [];
  for (let y = b.minY + cell / 2; y < b.maxY; y += cell) {
    for (let x = b.minX + cell / 2; x < b.maxX; x += cell) {
      if (pointInPolygon(x, y, isl.pts)) out.push({ x, y, r: cell * 0.8, reach });
    }
  }
  return out.length ? out : [{ x: isl.cx, y: isl.cy, r: re, reach }];
}

export function createWind(def, seed, islands = [], zones = {}) {
  const events = (def.events || []).slice().sort((a, b) => a.at - b.at);
  const wind = {
    baseFrom: def.from,
    speed: def.speed,
    gustiness: def.gust ?? 0.25,
    shiftAmp: (def.shift ?? 8) * DEG,
    shiftPeriod: def.period ?? 45,
    angle: fromBearing(def.from + 180), // direction the wind blows toward
    offX: 0,
    offY: 0,
    time: 0,
    eventIndex: 0,
    shadows: islands.flatMap(shadowSources),
    calms: zones.calms || [],
    storms: zones.storms || [],
    eventsQueue: events,
    noise: createNoise2D(seed ^ 0x51f15e),
    turbulence: createNoise2D(seed ^ 0x7a11),
  };
  return wind;
}

export function updateWind(wind, dt) {
  wind.time += dt;
  const t = wind.time;
  while (wind.eventIndex < wind.eventsQueue.length && wind.eventsQueue[wind.eventIndex].at <= t) {
    const ev = wind.eventsQueue[wind.eventIndex++];
    if (ev.from !== undefined) wind.baseFrom = ev.from;
    if (ev.speed !== undefined) wind.speed = ev.speed;
    if (ev.gust !== undefined) wind.gustiness = ev.gust;
  }
  const P = wind.shiftPeriod;
  const oscillation =
    0.7 * Math.sin((t / P) * Math.PI * 2) + 0.3 * Math.sin((t / (P * 0.37)) * Math.PI * 2 + 1.3);
  const target = fromBearing(wind.baseFrom + 180) + wind.shiftAmp * oscillation;
  // Big event shifts swing round over a few seconds instead of snapping.
  wind.angle = wrapAngle(lerpAngle(wind.angle, target, clamp(dt * 0.6, 0, 1)));
  const drift = wind.speed * 0.85;
  wind.offX += Math.cos(wind.angle) * drift * dt;
  wind.offY += Math.sin(wind.angle) * drift * dt;
}

// Gust intensity -1 (lull) .. 1 (gust) at a point.
export function gustAt(wind, x, y) {
  const n = wind.noise((x - wind.offX) / GUST_SCALE, (y - wind.offY) / GUST_SCALE);
  return clamp(n * 1.7, -1, 1);
}

// Sample the true wind. Writes into `out` to avoid allocations.
export function sampleWind(wind, x, y, out) {
  let speedMul = 1;
  let gustiness = wind.gustiness;
  let turb = 4 * DEG;

  for (const c of wind.calms) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < c.r) speedMul *= 1 - (c.depth ?? 0.92) * (1 - smoothstep(c.r * 0.55, c.r, d));
  }
  let storm = 0;
  for (const s of wind.storms) {
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < s.r) {
      const k = 1 - smoothstep(s.r * 0.45, s.r, d);
      storm = Math.max(storm, k);
      speedMul *= 1 + (s.power ?? 0.8) * k;
      gustiness += 0.35 * k;
      turb += 16 * DEG * k;
    }
  }

  const dirX = Math.cos(wind.angle);
  const dirY = Math.sin(wind.angle);
  let shade = 0;
  for (const sh of wind.shadows) {
    const rx = x - sh.x;
    const ry = y - sh.y;
    const along = rx * dirX + ry * dirY;
    if (along < -sh.r * 0.5 || along > sh.reach) continue;
    const across = Math.abs(rx * dirY - ry * dirX);
    const width = sh.r * (0.9 + (Math.max(0, along) / sh.reach) * 0.7);
    if (across > width) continue;
    const lateral = 1 - smoothstep(width * 0.55, width, across);
    const fade = 1 - smoothstep(sh.reach * 0.25, sh.reach, Math.max(0, along));
    shade = Math.max(shade, lateral * fade);
  }
  speedMul *= 1 - SHADOW_STRENGTH * shade;
  out.shade = shade;

  const g = gustAt(wind, x, y);
  speedMul *= 1 + gustiness * g;
  const tn = wind.turbulence(x / 220 + wind.time * 0.05, y / 220);
  const ang = wind.angle + tn * turb;
  const speed = Math.max(0, wind.speed * speedMul);
  out.wx = Math.cos(ang) * speed;
  out.wy = Math.sin(ang) * speed;
  out.speed = speed;
  out.angle = ang;
  out.gust = g;
  out.storm = storm;
  return out;
}

// Compass bearing the wind currently blows FROM (prevailing, no gusts).
export function windFromBearing(wind) {
  let b = (wind.angle / DEG + 90 + 180) % 360;
  if (b < 0) b += 360;
  return b;
}
