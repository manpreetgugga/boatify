// Moving water: current streams and whirlpools. The boat's hull drag is
// computed against the water, so these carry the boat along.

import { fromBearing, smoothstep } from '../core/math.js';

export function prepareCurrents(list = []) {
  return list.map((c) => {
    const a = fromBearing(c.toward);
    return {
      ...c,
      dirX: Math.cos(a),
      dirY: Math.sin(a),
      halfL: c.length / 2,
      halfW: c.width / 2,
    };
  });
}

export function prepareWhirlpools(list = []) {
  return list.map((w) => ({ spin: 1, strength: 9, ...w, core: w.r * 0.16 }));
}

// Writes the water velocity at (x, y) into out.cx/out.cy. Returns out.
export function sampleWater(level, x, y, out) {
  let cx = 0;
  let cy = 0;
  for (const c of level.currents) {
    const rx = x - c.x;
    const ry = y - c.y;
    const along = rx * c.dirX + ry * c.dirY;
    const across = rx * -c.dirY + ry * c.dirX;
    if (Math.abs(along) > c.halfL || Math.abs(across) > c.halfW) continue;
    const k =
      (1 - smoothstep(c.halfW * 0.6, c.halfW, Math.abs(across))) *
      (1 - smoothstep(c.halfL * 0.8, c.halfL, Math.abs(along)));
    cx += c.dirX * c.speed * k;
    cy += c.dirY * c.speed * k;
  }
  let vortex = 0;
  for (const w of level.whirlpools) {
    const rx = x - w.x;
    const ry = y - w.y;
    const d = Math.hypot(rx, ry);
    if (d >= w.r || d < 1e-3) continue;
    const f = 1 - d / w.r;
    const k = f * f * w.strength * 2.2;
    const nx = rx / d;
    const ny = ry / d;
    // Tangential swirl plus a pull toward the eye.
    cx += -ny * w.spin * k - nx * k * 0.55;
    cy += nx * w.spin * k - ny * k * 0.55;
    vortex = Math.max(vortex, f);
  }
  out.cx = cx;
  out.cy = cy;
  out.vortex = vortex;
  return out;
}
