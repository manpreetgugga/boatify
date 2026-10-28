// The daily voyage: a course generated from the date, the same for everyone
// that day. Each candidate is test-sailed by the autopilot; its time sets the
// star targets, and courses it can't finish are thrown away.

import { blob, rockField } from '../world/shapes.js';
import { createRng, hashString } from '../core/rng.js';
import { buildLevel } from '../world/level.js';
import { isClear } from '../world/collision.js';
import { createGame, stepGame, drainEvents } from '../world/game.js';
import { createAutopilot, autopilotInput } from '../world/autopilot.js';
import { angleDiff, toBearing } from '../core/math.js';

// Bump when the generator changes so cached courses are regenerated.
export const DAILY_VERSION = 1;

const FIRST = ['Saltwind', 'Gull', 'Driftwood', 'Cormorant', 'Brine', 'Kelp', 'Sundown', 'Mackerel', 'Lantern', 'Pelican', 'Squall', 'Coral'];
const SECOND = ['Passage', 'Run', 'Crossing', 'Sound', 'Reach', 'Narrows', 'Shoals', 'Channel', 'Skerries', 'Roads'];

const THEMES = {
  archipelago: 'Islands are scattered all the way to B.',
  reef: 'Rock fields lurk between the islands.',
  current: 'A strong current runs across the middle.',
  whirlpool: 'A whirlpool spins near the straight line to B.',
  doldrums: 'Patches of dead calm wait for the careless.',
  squall: 'A squall is passing through: rain and gusts.',
};

// Local calendar date as YYYY-MM-DD.
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dailyId(key) {
  return `daily-${key}`;
}

function tryPlace(rng, fn, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const v = fn(rng);
    if (v) return v;
  }
  return null;
}

const degOff = (a, b) => angleDiff((a * Math.PI) / 180, (b * Math.PI) / 180) / (Math.PI / 180);

// One candidate course. Later attempts get kinder winds so a day always has one.
export function dailyCandidate(key, attempt) {
  const seed = hashString(`daily:${key}:${attempt}`);
  const rng = createRng(seed);
  const W = 1800 + rng.int(0, 4) * 100;
  const H = 1000 + rng.int(0, 3) * 60;
  const start = { x: 150, y: Math.round(H * rng.range(0.3, 0.7)) };
  const finish = { x: W - 150, y: Math.round(H * rng.range(0.25, 0.75)), r: 48, kind: rng.chance(0.5) ? 'harbor' : 'lighthouse' };
  const toB = toBearing(Math.atan2(finish.y - start.y, finish.x - start.x));

  // Dead-upwind days are rarer: one re-roll, and none at all on late attempts.
  let windFrom = rng.int(0, 35) * 10;
  if (Math.abs(degOff(windFrom, toB)) < 45) windFrom = rng.int(0, 35) * 10;
  if (attempt >= 6) windFrom = Math.round((toB + 180 + rng.range(-70, 70)) / 10) * 10;
  windFrom = ((windFrom % 360) + 360) % 360;

  // Head toward B, or 55° off the wind if B is upwind.
  const off = degOff(windFrom, toB);
  const heading = Math.abs(off) < 55 ? Math.round((windFrom + Math.sign(off || 1) * 55 + 360) % 360) : Math.round(toB);

  const pool = Object.keys(THEMES);
  const themes = [];
  while (themes.length < 2) {
    const t = rng.pick(pool);
    if (!themes.includes(t)) themes.push(t);
  }
  const has = (t) => themes.includes(t);

  const def = {
    id: dailyId(key),
    daily: key,
    name: `${rng.pick(FIRST)} ${rng.pick(SECOND)}`,
    blurb: themes.map((t) => THEMES[t]).join(' '),
    size: [W, H],
    start: { ...start, heading },
    finish,
    wind: { from: windFrom, speed: Math.round(rng.range(14, 19)), gust: +rng.range(0.15, 0.32).toFixed(2), shift: rng.int(5, 11), period: rng.int(34, 50) },
    par: { gold: 0, silver: 0 },
    islands: [],
    rocks: [],
    pickups: [],
    checkpoints: [],
    calms: [],
    currents: [],
    whirlpools: [],
    storms: [],
    tips: [{ at: 0, text: 'A new course every day. Same wind, same islands for every sailor today.' }],
  };

  const farFromEnds = (x, y, r) => Math.hypot(x - start.x, y - start.y) > r + 230 && Math.hypot(x - finish.x, y - finish.y) > r + 230;
  const circles = []; // islands and hazards, to keep channels open between them

  const islandCount = has('archipelago') ? rng.int(6, 8) : rng.int(3, 5);
  for (let i = 0; i < islandCount; i++) {
    const isl = tryPlace(rng, (g) => {
      const r = g.range(60, 110);
      const x = g.range(330, W - 330);
      const y = g.range(110 + r, H - 110 - r);
      if (!farFromEnds(x, y, r)) return null;
      if (circles.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + 130)) return null;
      return { x, y, r };
    });
    if (!isl) continue;
    circles.push(isl);
    const stretch = [rng.range(0.8, 1.4), rng.range(0.7, 1.1)];
    def.islands.push({ pts: blob(isl.x, isl.y, isl.r, seed % 997 + i * 13, 0.3, 28, stretch, rng.range(0, Math.PI)), kind: rng.chance(0.65) ? 'sand' : 'rock' });
  }

  const rockGroups = has('reef') ? rng.int(4, 6) : rng.int(1, 3);
  for (let i = 0; i < rockGroups; i++) {
    const spot = tryPlace(rng, (g) => {
      const x = g.range(320, W - 320);
      const y = g.range(120, H - 120);
      if (!farFromEnds(x, y, 40)) return null;
      if (circles.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + 120)) return null;
      return { x, y, r: 45 };
    });
    if (!spot) continue;
    circles.push(spot);
    def.rocks.push(...rockField(spot.x, spot.y, rng.range(30, 45), rng.int(3, 5), seed % 991 + i * 7));
  }

  // Hazards sit near the straight line from A to B so they matter.
  const along = (t, spread) => {
    const x = start.x + (finish.x - start.x) * t;
    const y = start.y + (finish.y - start.y) * t + rng.range(-spread, spread);
    return { x, y };
  };
  if (has('current')) {
    const c = along(0.5, 80);
    def.currents.push({ x: Math.round(c.x), y: Math.round(c.y), length: H * 1.6, width: rng.range(180, 240), toward: rng.chance(0.5) ? 0 : 180, speed: +rng.range(2.5, 3.6).toFixed(1) });
  }
  if (has('whirlpool')) {
    const w = tryPlace(rng, () => {
      const p = along(rng.range(0.35, 0.65), 140);
      const r = 110;
      if (circles.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + r + 60)) return null;
      return { ...p, r };
    });
    if (w) {
      circles.push(w);
      def.whirlpools.push({ x: Math.round(w.x), y: Math.round(w.y), r: w.r, strength: 6.5, spin: rng.chance(0.5) ? 1 : -1 });
    }
  }
  if (has('doldrums')) {
    for (let i = 0; i < 2; i++) {
      const p = along(rng.range(0.25, 0.75), 260);
      def.calms.push({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(rng.range(120, 170)) });
    }
  }
  if (has('squall')) {
    const p = along(rng.range(0.4, 0.6), 200);
    def.storms.push({ x: Math.round(p.x), y: Math.round(p.y), r: 320, power: 0.7 });
    def.weather = { rain: 0.5, lightning: true, dark: 0.3 };
  }

  // Marks and pickups go wherever there is open water near the line.
  const level = buildLevel(def);
  const openSpot = (t0, t1, spread, clearance) =>
    tryPlace(rng, () => {
      const p = along(rng.range(t0, t1), spread);
      p.x = Math.round(p.x);
      p.y = Math.round(p.y);
      const inChart = p.x > 60 && p.y > 60 && p.x < W - 60 && p.y < H - 60;
      return inChart && isClear(level, p.x, p.y, clearance) ? p : null;
    });
  for (const t of [0.33, 0.66]) {
    const c = openSpot(t - 0.05, t + 0.05, 120, 30);
    if (c) def.checkpoints.push(c);
  }
  for (let i = 0; i < 8; i++) {
    const p = openSpot(0.1 + i * 0.1, 0.18 + i * 0.1, 200, 16);
    if (p) def.pickups.push({ ...p, kind: 'pearl' });
  }
  for (let i = 0; i < 2; i++) {
    const p = openSpot(0.2, 0.8, 260, 16);
    if (p) def.pickups.push({ ...p, kind: 'gust' });
  }
  const crate = openSpot(0.4, 0.7, 220, 16);
  if (crate) def.pickups.push({ ...crate, kind: 'repair' });

  const startClear = isClear(level, start.x, start.y, 40) && isClear(level, finish.x, finish.y, 30);
  return startClear ? def : null;
}

// Sail the course with the autopilot; the result is its time, or null when it
// can't finish within the limit. Slow beats are abandoned early by projecting
// the progress made toward B so far. Yields now and then so the work can be
// spread over several frames.
function* trialSteps(def, limit = 240) {
  const game = createGame(def);
  const ap = createAutopilot(game);
  const dt = 1 / 30;
  const fx = def.finish.x;
  const fy = def.finish.y;
  const d0 = Math.hypot(def.start.x - fx, def.start.y - fy);
  let n = 0;
  while (game.status !== 'finished' && game.time < limit) {
    stepGame(game, autopilotInput(ap, game, dt), dt);
    drainEvents(game);
    if (++n % 60 === 0) {
      yield;
      if (game.time > 60) {
        const d = Math.hypot(game.boat.x - fx, game.boat.y - fy);
        const rate = (d0 - d) / game.time;
        if (rate <= 0 || game.time + d / rate > limit * 1.15) return null;
      }
    }
  }
  return game.status === 'finished' && game.hull > 40 ? game.result.time : null;
}

function* chartSteps(key) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const def = dailyCandidate(key, attempt);
    yield;
    if (!def) continue;
    const t = yield* trialSteps(def);
    if (t === null) continue;
    def.par = { gold: Math.ceil((t * 1.05) / 5) * 5, silver: Math.ceil((t * 1.4) / 5) * 5 };
    return def;
  }
  return null;
}

const cache = new Map();
const waiting = new Map(); // key -> callbacks while a course is being charted

// A course cached by an earlier session, if it is today's and current.
function fromStore(key, stored) {
  return stored && stored.v === DAILY_VERSION && stored.def && stored.def.daily === key ? stored.def : null;
}

// The course for a day if it is already charted, without charting it.
export function chartedDaily(key, stored = null) {
  return cache.get(key) || fromStore(key, stored);
}

// Today's course, or null if none could be charted (in practice never).
// Charts it right away if needed; see chartDaily for the gentle version.
export function dailyVoyage(key = dateKey(), stored = null) {
  if (!cache.has(key)) {
    let def = fromStore(key, stored);
    if (!def) {
      const it = chartSteps(key);
      let r;
      do r = it.next();
      while (!r.done);
      def = r.value;
    }
    cache.set(key, def);
  }
  return cache.get(key);
}

// Chart the course a few milliseconds at a time between frames, then call
// done(def). Calls made while charting share the same work.
export function chartDaily(key, stored, done, budgetMs = 6) {
  if (cache.has(key)) return done(cache.get(key));
  const ready = fromStore(key, stored);
  if (ready) {
    cache.set(key, ready);
    return done(ready);
  }
  if (waiting.has(key)) return waiting.get(key).push(done);
  waiting.set(key, [done]);
  const it = chartSteps(key);
  const pump = () => {
    const end = performance.now() + budgetMs;
    let r;
    do r = it.next();
    while (!r.done && performance.now() < end);
    if (!r.done) {
      setTimeout(pump, 0);
      return;
    }
    // A synchronous chart may have finished first; keep the course it made.
    if (!cache.has(key)) cache.set(key, r.value);
    const def = cache.get(key);
    const callbacks = waiting.get(key);
    waiting.delete(key);
    for (const cb of callbacks) cb(def);
  };
  setTimeout(pump, 0);
}
