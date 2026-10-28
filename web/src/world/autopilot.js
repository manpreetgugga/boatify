// A sailing autopilot: plans a wind-aware route on a coarse grid, then
// steers it, tacking upwind and gybing downwind like a sailor would. Used by
// the title-screen demo, by the level tests, and for playtesting.

import { angleDiff, clamp, wrapAngle, DEG } from '../core/math.js';
import { isClear } from './collision.js';
import { inFloeLane, floeContact } from './floes.js';
import { boatSpeed } from '../physics/boat.js';
import { sampleWind } from './wind.js';

const CELL = 16;
const CLEARANCE = 13;
const TACK_ANGLE = 50 * DEG;
const GYBE_ANGLE = 145 * DEG;
const UPWIND_LIMIT = 47 * DEG;
const DOWNWIND_LIMIT = 157 * DEG;

// Boat speed as a fraction of wind speed by true wind angle (10 degree steps),
// taken from the simulated polar of the default boat.
export const POLAR = [0.05, 0.05, 0.05, 0.16, 0.4, 0.62, 0.81, 0.97, 1.05, 1.08, 1.11, 1.1, 1.02, 0.94, 0.84, 0.73, 0.64, 0.58, 0.56];
const VMG_UP = 0.405;
const VMG_DOWN = 0.645;

export function effectiveSpeed(twa) {
  const deg = clamp(twa / DEG, 0, 180);
  const i = Math.min(17, Math.floor(deg / 10));
  const f = deg / 10 - i;
  let v = POLAR[i] + (POLAR[i + 1] - POLAR[i]) * f;
  const c = Math.cos(twa);
  if (c > 0.05) v = Math.max(v, VMG_UP / c);
  if (c < -0.05) v = Math.max(v, VMG_DOWN / -c);
  return v;
}

export function createNavGrid(level, wind = null) {
  const sample = {};
  const cols = Math.ceil(level.width / CELL);
  const rows = Math.ceil(level.height / CELL);
  const blocked = new Uint8Array(cols * rows);
  const hazard = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      const i = r * cols + c;
      if (!isClear(level, x, y, CLEARANCE)) blocked[i] = 1;
      let h = 0;
      for (const w of level.whirlpools) {
        const d = Math.hypot(x - w.x, y - w.y);
        if (d < w.r) h += 6 * (1 - d / w.r);
        if (d < w.core + 20) blocked[i] = 1;
      }
      for (const k of level.krakens) {
        const d = Math.hypot(x - k.x, y - k.y);
        if (d < k.r * 1.25) h += 5;
      }
      for (const cz of level.calms) {
        const d = Math.hypot(x - cz.x, y - cz.y);
        if (d < cz.r) h += 3 * (1 - d / cz.r);
      }
      // Prefer to cross the lanes drifting ice floes sweep where they're short.
      if (!blocked[i] && level.floes.length && inFloeLane(level, x, y, CLEARANCE)) h += 4;
      // Wind shadows cost time too: steer clear of the lee of islands.
      if (wind && !blocked[i]) h += 2.5 * sampleWind(wind, x, y, sample).shade;
      hazard[i] = h;
    }
  }
  return { cols, rows, blocked, hazard, level };
}

function cellOf(grid, x, y) {
  const c = clamp(Math.floor(x / CELL), 0, grid.cols - 1);
  const r = clamp(Math.floor(y / CELL), 0, grid.rows - 1);
  return r * grid.cols + c;
}

function nearestOpen(grid, idx) {
  if (!grid.blocked[idx]) return idx;
  const c0 = idx % grid.cols;
  const r0 = Math.floor(idx / grid.cols);
  for (let rad = 1; rad < 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) continue;
        const i = r * grid.cols + c;
        if (!grid.blocked[i]) return i;
      }
    }
  }
  return idx;
}

// A* over the grid; edge cost is travel time at the polar speed for that
// direction relative to the wind (windFrom is the world angle wind comes from).
export function findPath(grid, sx, sy, tx, ty, windFrom) {
  const start = nearestOpen(grid, cellOf(grid, sx, sy));
  const goal = nearestOpen(grid, cellOf(grid, tx, ty));
  const n = grid.cols * grid.rows;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = [];
  const push = (i, f) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  const gc = goal % grid.cols;
  const gr = Math.floor(goal / grid.cols);
  const h = (i) => Math.hypot((i % grid.cols) - gc, Math.floor(i / grid.cols) - gr) / 1.11;
  const dirs = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const a = Math.atan2(dr, dc);
      const twa = Math.abs(angleDiff(a, windFrom));
      dirs.push([dc, dr, Math.hypot(dc, dr) / effectiveSpeed(twa)]);
    }
  }
  g[start] = 0;
  push(start, h(start));
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const c = cur % grid.cols;
    const r = Math.floor(cur / grid.cols);
    for (const [dc, dr, cost] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
      const ni = nr * grid.cols + nc;
      if (grid.blocked[ni] || closed[ni]) continue;
      if (dc && dr && (grid.blocked[r * grid.cols + nc] || grid.blocked[nr * grid.cols + c])) continue;
      const ng = g[cur] + cost * (1 + grid.hazard[ni]);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        push(ni, ng + h(ni));
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path = [];
  for (let i = goal; i !== -1; i = came[i]) {
    path.push([((i % grid.cols) + 0.5) * CELL, (Math.floor(i / grid.cols) + 0.5) * CELL]);
    if (i === start) break;
  }
  path.reverse();
  path.push([tx, ty]);
  return path;
}

export function lineClear(grid, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / (CELL * 0.5));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (grid.blocked[cellOf(grid, ax + (bx - ax) * t, ay + (by - ay) * t)]) return false;
  }
  return true;
}

export function createAutopilot(game) {
  return {
    grid: createNavGrid(game.level, game.wind),
    path: null,
    replan: 0,
    tack: 1,
    tackHold: 0,
    stuck: 0,
    target: null,
    clock: game.clock,
    speed: 0,
  };
}

export function autopilotInput(ap, game, dt) {
  const { boat, level } = game;
  const windFrom = wrapAngle(game.wind.angle + Math.PI);
  ap.clock = game.clock;
  ap.speed = boatSpeed(boat);
  ap.replan -= dt;
  ap.tackHold -= dt;
  if (!ap.path || ap.replan <= 0) {
    ap.path = findPath(ap.grid, boat.x, boat.y, level.finish.x, level.finish.y, windFrom);
    ap.replan = 1.5;
  }
  // Furthest visible path point within reach.
  let tx = level.finish.x;
  let ty = level.finish.y;
  if (ap.path) {
    let best = null;
    for (let i = 0; i < ap.path.length; i++) {
      const [px, py] = ap.path[i];
      const d = Math.hypot(px - boat.x, py - boat.y);
      if (d > 220) break;
      if (lineClear(ap.grid, boat.x, boat.y, px, py)) best = ap.path[i];
    }
    if (best) {
      tx = best[0];
      ty = best[1];
    } else if (ap.path[1]) {
      tx = ap.path[1][0];
      ty = ap.path[1][1];
    }
  }
  ap.target = [tx, ty];
  const toTarget = Math.atan2(ty - boat.y, tx - boat.x);
  const twa = Math.abs(angleDiff(toTarget, windFrom));
  let desired = toTarget;
  if (twa < UPWIND_LIMIT || twa > DOWNWIND_LIMIT) {
    const off = twa < UPWIND_LIMIT ? TACK_ANGLE : GYBE_ANGLE;
    const cur = wrapAngle(windFrom + ap.tack * off);
    const other = wrapAngle(windFrom - ap.tack * off);
    const curErr = Math.abs(angleDiff(cur, toTarget));
    const otherErr = Math.abs(angleDiff(other, toTarget));
    const blockedAhead = !ahead(ap, boat, cur, 70) && ahead(ap, boat, other, 50);
    // Hold a tack for a while so it isn't thrown away, unless the shore is close.
    if ((ap.tackHold <= 0 && otherErr + 18 * DEG < curErr) || (ap.tackHold <= 3.5 && blockedAhead)) {
      ap.tack = -ap.tack;
      ap.tackHold = 5;
    }
    desired = wrapAngle(windFrom + ap.tack * off);
  }
  // Swerve around anything right ahead. Drifting ice needs a longer look.
  const look = level.floes.length ? 85 : 55;
  let wait = false;
  if (!ahead(ap, boat, desired, look)) {
    const bowX = boat.x + Math.cos(boat.heading) * 24;
    const bowY = boat.y + Math.sin(boat.heading) * 24;
    if (level.floes.length && ahead(ap, boat, desired, look, false) && !inFloeLane(level, bowX, bowY, 14)) {
      // Only drifting ice is in the way and it can't reach us here: head up,
      // let the sail flap and wait for the gap.
      wait = true;
      desired = wrapAngle(windFrom + Math.sign(angleDiff(windFrom, boat.heading) || 1) * 45 * DEG);
    } else {
      for (const o of [20, -20, 40, -40, 65, -65, 90, -90]) {
        const h = wrapAngle(desired + o * DEG);
        if (Math.abs(angleDiff(h, windFrom)) < 38 * DEG) continue;
        if (ahead(ap, boat, h, look)) {
          desired = h;
          break;
        }
      }
    }
  }
  const err = angleDiff(boat.heading, desired);
  const steer = clamp(err * 2.4 - boat.yawRate * 0.45, -1, 1);
  const speed = boatSpeed(boat);
  ap.stuck = speed < 2.5 ? ap.stuck + dt : 0;
  const boost = game.gustJars > 0 && (ap.stuck > 2.5 || game.waterHere.vortex > 0.55) && boat.boostTime <= 0;
  if (boost) ap.stuck = 0;
  if (wait) return { steer, trimTarget: 1, autoTrim: false, boost: false };
  return { steer, trimTarget: boat.optimalTrim, autoTrim: true, boost };
}

function ahead(ap, boat, heading, distance, ice = true) {
  const { level } = ap.grid;
  const cx = Math.cos(heading);
  const cy = Math.sin(heading);
  const floes = ice && level.floes.length > 0;
  // The boat gets to a point somewhere between flat out and a slow pace.
  const fast = Math.max(ap.speed, 16);
  const slow = Math.max(ap.speed, 8);
  for (let d = 12; d <= distance; d += 10) {
    const x = boat.x + cx * d;
    const y = boat.y + cy * d;
    if (x < 0 || y < 0 || x > level.width || y > level.height) return false;
    if (ap.grid.blocked[cellOf(ap.grid, x, y)]) return false;
    // Ice floes: where they will be by the time the boat gets there.
    if (floes) {
      const t = ap.clock + d / slow;
      if (floeContact(level, x, y, 12, ap.clock + d / fast) || floeContact(level, x, y, 12, t) || floeContact(level, x, y, 12, t + 1.5)) return false;
    }
  }
  return true;
}
