// Ghost of the best run: the boat's track sampled a few times a second while
// sailing, stored compactly, and replayed as a translucent rival.

import { lerp, lerpAngle } from '../core/math.js';
import { hashString } from '../core/rng.js';

export const GHOST_DT = 0.2; // seconds between samples
const FIELDS = 4; // x, y, heading, heel

// Changes to a voyage's layout invalidate its old ghosts.
export function levelSignature(def) {
  return hashString(JSON.stringify(def)).toString(36);
}

export function createRecorder(game) {
  return { sig: levelSignature(game.def), boat: game.boat.type.id, data: [], next: 0 };
}

// Call after each simulation step; samples whenever a slot has passed.
export function recordGhost(rec, game) {
  const b = game.boat;
  while (game.time >= rec.next) {
    rec.data.push(Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.heading * 100), Math.round(b.heel * 100));
    rec.next += GHOST_DT;
  }
}

export function finishGhost(rec, time) {
  return { v: 1, sig: rec.sig, boat: rec.boat, dt: GHOST_DT, time, data: rec.data.slice() };
}

export function isValidGhost(ghost, def) {
  return !!(
    ghost &&
    ghost.v === 1 &&
    ghost.sig === levelSignature(def) &&
    Array.isArray(ghost.data) &&
    ghost.data.length >= FIELDS * 2 &&
    ghost.data.length % FIELDS === 0 &&
    ghost.dt > 0
  );
}

// Interpolated pose at time t. `done` is true once the ghost has finished.
export function ghostAt(ghost, t) {
  const n = ghost.data.length / FIELDS;
  const f = Math.max(0, t / ghost.dt);
  const i = Math.min(n - 1, Math.floor(f));
  const j = Math.min(n - 1, i + 1);
  const k = Math.min(1, f - i);
  const d = ghost.data;
  const a = i * FIELDS;
  const b = j * FIELDS;
  return {
    x: lerp(d[a], d[b], k) / 10,
    y: lerp(d[a + 1], d[b + 1], k) / 10,
    heading: lerpAngle(d[a + 2] / 100, d[b + 2] / 100, k),
    heel: lerp(d[a + 3], d[b + 3], k) / 100,
    done: t >= ghost.time,
  };
}

// Seconds the player is behind (+) or ahead (-) of the ghost: compares now
// with when the ghost passed closest to where the player is. Null when the
// player is off the ghost's line.
export function ghostGap(ghost, x, y, t, span = 40, maxDist = 70) {
  const n = ghost.data.length / FIELDS;
  const lo = Math.max(0, Math.floor((t - span) / ghost.dt));
  const hi = Math.min(n - 1, Math.ceil((t + span) / ghost.dt));
  const d = ghost.data;
  let best = Infinity;
  let bi = -1;
  for (let i = lo; i <= hi; i++) {
    const dx = d[i * FIELDS] / 10 - x;
    const dy = d[i * FIELDS + 1] / 10 - y;
    const q = dx * dx + dy * dy;
    if (q < best) {
      best = q;
      bi = i;
    }
  }
  if (bi < 0 || best > maxDist * maxDist) return null;
  return t - bi * ghost.dt;
}
