// Drifting ice floes: slabs of ice that slide back and forth on the tide.
// Each one is an island-like polygon plus a drift offset that follows a
// sine over `period` seconds, so it is predictable once you watch it. Other
// worlds' drifters (pumice rafts, ferries, jellies) follow the same rules
// with their own `kind` (what a bump hits) and `look`.

import { prepareIsland } from './shapes.js';
import { circlePolygon } from './collision.js';

const TAU = Math.PI * 2;

export function prepareFloes(list = []) {
  return list.map((f, i) => ({
    ...prepareIsland(f.pts, f.kind || 'ice', 101 + i),
    look: f.look || 'ice',
    drift: f.drift,
    period: f.period,
    phase: f.phase || 0,
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
  }));
}

// Offset of a floe from its rest position at time t.
export function floeOffset(f, t) {
  const s = Math.sin((t / f.period) * TAU + f.phase);
  return [f.drift[0] * s, f.drift[1] * s];
}

export function moveFloes(level, t) {
  for (const f of level.floes) {
    const k = (t / f.period) * TAU + f.phase;
    const s = Math.sin(k);
    const c = (Math.cos(k) * TAU) / f.period;
    f.ox = f.drift[0] * s;
    f.oy = f.drift[1] * s;
    f.vx = f.drift[0] * c;
    f.vy = f.drift[1] * c;
  }
}

// Deepest contact of circle (x, y, r) with any floe where it is now, or at
// time `t` when given. Carries the floe's velocity for the bump.
export function floeContact(level, x, y, r, t = null) {
  let hit = null;
  for (const f of level.floes) {
    const [ox, oy] = t === null ? [f.ox, f.oy] : floeOffset(f, t);
    const contact = circlePolygon(x - ox, y - oy, r, f);
    if (contact && (!hit || contact.depth > hit.depth)) {
      contact.vx = f.vx;
      contact.vy = f.vy;
      hit = contact;
    }
  }
  return hit;
}

// Is (x, y) inside the lane a floe sweeps through, with some clearance?
export function inFloeLane(level, x, y, clearance) {
  for (const f of level.floes) {
    for (let i = 0; i <= 6; i++) {
      const s = -1 + i / 3;
      if (circlePolygon(x - f.drift[0] * s, y - f.drift[1] * s, clearance, f)) return true;
    }
  }
  return false;
}
