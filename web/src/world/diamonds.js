// Diamonds lie where the danger is: in a whirlpool's pull just outside the
// eye, over a kraken's lair, or off the cove a pirate brig keeps watch from.
// A voyage has one at most, always in the same place, and none once it has
// been brought home.

import { dist } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { isClear } from './collision.js';

const CLEARANCE = 16;

// Where to look: rings round each lair, nearest and farthest.
function lairs(def, level) {
  return [
    ...level.whirlpools.map((w) => ({ x: w.x, y: w.y, near: w.r * 0.38, far: w.r * 0.5 })),
    ...level.krakens.map((k) => ({ x: k.x, y: k.y, near: k.r * 0.15, far: k.r * 0.45 })),
    ...(def.pirates || []).map((p) => ({ x: p.x, y: p.y, near: 90, far: 150 })),
  ];
}

// Does this voyage have somewhere dangerous enough to hide one?
export function holdsDiamond(def) {
  return !def.endless && !def.race && !!((def.whirlpools || []).length || (def.krakens || []).length || (def.pirates || []).length);
}

// A spot in open water within one of the rings, clear of other pickups.
export function diamondSpot(level, rings, rng) {
  if (!rings.length) return null;
  const first = rng.int(0, rings.length - 1);
  for (let k = 0; k < rings.length; k++) {
    const ring = rings[(first + k) % rings.length];
    for (let i = 0; i < 24; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(ring.near, ring.far);
      const x = Math.round(ring.x + Math.cos(a) * d);
      const y = Math.round(ring.y + Math.sin(a) * d);
      if (!isClear(level, x, y, CLEARANCE)) continue;
      if (level.pickups.some((p) => dist(p.x, p.y, x, y) < 40)) continue;
      return { x, y };
    }
  }
  return null;
}

export function placeDiamond(def, level, seed) {
  const spot = diamondSpot(level, lairs(def, level), createRng(seed ^ 0xd1a305));
  if (!spot) return null;
  const pickup = { ...spot, kind: 'diamond', id: `diamond-${def.id}`, taken: false, bob: 1.3 };
  level.pickups.push(pickup);
  return pickup;
}

// On the open sea a whirlpool sometimes guards one.
export function whirlpoolDiamond(level, whirlpool, rng, id) {
  const spot = diamondSpot(level, [{ x: whirlpool.x, y: whirlpool.y, near: whirlpool.r * 0.38, far: whirlpool.r * 0.5 }], rng);
  if (!spot) return null;
  const pickup = { ...spot, kind: 'diamond', id, taken: false, bob: 1.3 };
  level.pickups.push(pickup);
  return pickup;
}
