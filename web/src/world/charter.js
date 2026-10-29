// Charting a world's voyages. Each course grows from its spec (what is in it:
// islands, a wall with a gap, vents, ferries, whirlpools...) and from its
// place in the world (later voyages are longer and gustier), seeded by its id
// so it is the same course on every phone. scripts/chart-worlds.mjs
// test-sails each one with the autopilot and keeps the first attempt that
// works, with its star times, in data/charts.js.
//
// A spec's `f` says what goes in:
//   islands, big   how many islands, and how many large ones
//   reef           groups of rocks (or pilings, or crystals)
//   wall           walls right across the chart, each with a gap or two
//   narrows        one thick wall with a single wide channel
//   current        currents across the course
//   whirl          whirlpools near the course
//   lairs          the world's monster: vents, cranes, beasts (kraken rules)
//   drift          the world's drifters: rafts, ferries, jellies (floe rules)
//   calms          patches of dead calm
//   squall         a storm with rain and lightning
//   fog, night     weather
//   pirates        a brig
//   wind           'up' (a beat), 'down' (a run), 'beam', or left to chance
//   long           a longer chart

import { blob, ridge, rockField, rockLine, slab, hull } from './shapes.js';
import { createRng, hashString } from '../core/rng.js';
import { buildLevel } from './level.js';
import { isClear } from './collision.js';
import { angleDiff, toBearing } from '../core/math.js';

const DEG = Math.PI / 180;
const degOff = (a, b) => angleDiff(a * DEG, b * DEG) / DEG;
const norm = (deg) => Math.round(((deg % 360) + 360) % 360);

function tryPlace(rng, fn, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const v = fn(rng);
    if (v) return v;
  }
  return null;
}

function weighted(rng, list) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let roll = rng.range(0, total);
  for (const [v, w] of list) {
    roll -= w;
    if (roll <= 0) return v;
  }
  return list[list.length - 1][0];
}

// Hazards a spec brings that earlier voyages in its world didn't: these get
// a word of warning the first time.
function firstsOf(world, index) {
  const seen = new Set();
  for (const s of world.voyages.slice(0, index)) for (const k of Object.keys(s.f || {})) if ((s.f || {})[k]) seen.add(k);
  const f = world.voyages[index].f || {};
  return new Set(Object.keys(f).filter((k) => f[k] && !seen.has(k)));
}

// An island of the given kind. Quays are square slabs, the rest organic.
function islandOf(world, kind, x, y, r, seed, rng) {
  const shadow = (world.shadow || {})[kind];
  if (kind === 'quay') {
    const long = rng.chance(0.5);
    const w = r * (long ? 2.4 : 1.6);
    const h = r * (long ? 0.9 : 1.3);
    return { pts: slab(x, y, w, h, rng.chance(0.7) ? rng.int(0, 1) * (Math.PI / 2) : rng.range(-0.3, 0.3)), kind, shadow };
  }
  const stretch = [rng.range(0.85, 1.35), rng.range(0.75, 1.1)];
  const jag = kind === 'crystal' ? 0.42 : kind === 'cone' ? 0.18 : 0.3;
  return { pts: blob(x, y, r, seed, jag, 28, stretch, rng.range(0, Math.PI)), kind, shadow };
}

// One candidate course for voyage `index` of `world`. Later attempts get
// kinder winds, so every voyage charts in the end.
export function charterVoyage(world, index, attempt = 0) {
  const spec = world.voyages[index];
  const f = spec.f || {};
  const seed = hashString(`${spec.id}:${attempt}`);
  const rng = createRng(seed);
  const d = world.voyages.length > 1 ? index / (world.voyages.length - 1) : 0;
  // A beat covers the ground three times over, so upwind charts are shorter.
  const W = Math.round(((1700 + Math.round(d * 7) * 100 + (f.long ? 500 : 0) + rng.int(0, 3) * 100) * (f.wind === 'up' ? 0.55 : 1)) / 100) * 100;
  const H = 980 + Math.round(d * 5) * 60 + rng.int(0, 3) * 60;
  const start = { x: 150, y: Math.round(H * rng.range(0.3, 0.7)) };
  const finish = { x: W - 150, y: Math.round(H * rng.range(0.25, 0.75)), r: 48, kind: rng.chance(world.lighthouse ?? 0.4) ? 'lighthouse' : 'harbor' };
  const toB = toBearing(Math.atan2(finish.y - start.y, finish.x - start.x));

  let from;
  const kind = attempt >= 6 && f.wind !== 'up' ? 'beam' : f.wind;
  if (kind === 'up') from = toB + (rng.chance(0.5) ? 1 : -1) * rng.range(8, 28);
  else if (kind === 'down') from = toB + 180 + rng.range(-35, 35);
  else if (kind === 'beam') from = toB + (rng.chance(0.5) ? 90 : -90) + rng.range(-25, 25);
  // Left to chance, the wind is free: a reach or a run, never a beat.
  else from = toB + (rng.chance(0.5) ? 1 : -1) * rng.range(75, 180);
  from = norm(Math.round(from / 5) * 5);
  const off = degOff(from, toB);
  const heading = Math.abs(off) < 55 ? norm(from + Math.sign(off || 1) * 55) : norm(toB);

  const [wLo, wHi] = world.wind || [14, 18];
  const def = {
    id: spec.id,
    world: world.id,
    theme: world.theme,
    name: spec.name,
    blurb: spec.blurb,
    teaser: spec.teaser,
    size: [W, H],
    start: { ...start, heading },
    finish,
    wind: {
      from,
      speed: Math.round(rng.range(wLo, wHi) + d * 1.5),
      gust: +(0.15 + d * 0.13 + rng.range(0, 0.05)).toFixed(2),
      shift: 5 + Math.round(d * 6),
      period: rng.int(34, 50),
    },
    par: { gold: 0, silver: 0 },
    islands: [],
    rocks: [],
    pickups: [],
    checkpoints: [],
    calms: [],
    currents: [],
    whirlpools: [],
    krakens: [],
    floes: [],
    storms: [],
    tips: [],
  };

  // The course line, and points near it.
  const lineY = (x) => start.y + ((finish.y - start.y) * (x - start.x)) / (finish.x - start.x);
  const along = (t, spread) => {
    const x = start.x + (finish.x - start.x) * t;
    return { x, y: lineY(x) + rng.range(-spread, spread) };
  };
  const nearEnds = (x, y, r) => Math.hypot(x - start.x, y - start.y) < r + 240 || Math.hypot(x - finish.x, y - finish.y) < r + 240;
  const circles = []; // everything placed so far, to keep channels open
  const free = (x, y, r, gap) => !circles.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + gap);
  const inside = (x, y, m) => x > m && y > m && x < W - m && y < H - m;
  const near = []; // tips for hazards met here first
  const firsts = firstsOf(world, index);
  const tips = world.tips || {};
  const tipNear = (key, x, y, r) => {
    if (firsts.has(key) && tips[key] && !near.some((t) => t.key === key)) near.push({ key, tip: { near: [Math.round(x), Math.round(y), r], text: tips[key] } });
  };

  // Walls run right across the chart, with a gap or two to find. The narrows
  // are one thick wall with a single wide channel.
  const walls = [];
  if (f.narrows) walls.push({ narrows: true });
  for (let i = 0; i < (f.wall || 0); i++) walls.push({ narrows: false });
  walls.forEach((wall, i) => {
    const x = Math.round(start.x + (finish.x - start.x) * ((i + 1) / (walls.length + 1)) + rng.range(-60, 60));
    const thick = wall.narrows ? rng.range(170, 230) : rng.range(60, 90);
    const half = wall.narrows ? rng.range(105, 125) : rng.range(62, 78);
    const gaps = [Math.max(150, Math.min(H - 150, lineY(x) + rng.range(-220, 220)))];
    if (!wall.narrows && H > 1100 && rng.chance(0.5)) {
      const g = tryPlace(rng, () => {
        const y = rng.range(150, H - 150);
        return Math.abs(y - gaps[0]) > 360 ? y : null;
      });
      if (g) gaps.push(g);
    }
    gaps.sort((a, b) => a - b);
    const spans = [];
    let y0 = -70;
    for (const g of gaps) {
      spans.push([y0, g - half]);
      y0 = g + half;
    }
    spans.push([y0, H + 70]);
    const ridgeKind = wall.narrows ? world.big || world.wallKind : world.wallKind;
    for (const [a, b] of spans) {
      if (b - a < 40) continue;
      if (ridgeKind && b - a > 200) {
        const mid = (a + b) / 2;
        const path = [[x + rng.range(-25, 25), a], [x + rng.range(-40, 40), mid], [x + rng.range(-25, 25), b]];
        if (ridgeKind === 'quay') {
          // A breakwater: a straight slab with square ends.
          def.islands.push({ pts: slab(x, (a + b) / 2, thick * 0.8, b - a, 0), kind: 'quay', shadow: (world.shadow || {}).quay });
        } else def.islands.push({ pts: ridge(path, thick, (seed % 997) + i * 31 + a, 0.22), kind: ridgeKind, shadow: (world.shadow || {})[ridgeKind] });
      } else {
        const material = world.wallRock || weighted(rng, world.rocks);
        def.rocks.push(...rockLine(x, a, x, b, 19, (seed % 991) + i * 17, 10).map((r) => ({ ...r, material })));
      }
      for (let y = Math.max(0, a); y <= Math.min(H, b); y += 60) circles.push({ x, y, r: thick / 2 });
    }
    // Keep the way to each gap open.
    for (const g of gaps) {
      circles.push({ x: x - 150, y: g, r: 70, open: true });
      circles.push({ x: x + 150, y: g, r: 70, open: true });
      tipNear(wall.narrows ? 'narrows' : 'wall', x, g, 320);
    }
    wall.x = x;
    wall.gaps = gaps;
  });

  // Drifters swing across the course on the tide: rafts, ferries, jellies.
  const dr = world.drifter;
  for (let i = 0; i < (f.drift || 0) && dr; i++) {
    const spot = tryPlace(rng, () => {
      const p = along(rng.range(0.28, 0.76), 60);
      const size = rng.range(dr.size[0], dr.size[1]);
      const reach = dr.shape === 'hull' ? size / 2 : size;
      const amp = Math.min(rng.range(150, 230), p.y - reach - 50, H - p.y - reach - 50);
      if (amp < 110) return null;
      if (circles.some((c) => Math.abs(c.x - p.x) < c.r + reach + 90 && Math.abs(c.y - p.y) < amp + reach + c.r)) return null;
      if (nearEnds(p.x, p.y, reach + 60)) return null;
      return { ...p, size, amp, reach };
    });
    if (!spot) continue;
    const x = Math.round(spot.x);
    const y = Math.round(spot.y);
    const pts = dr.shape === 'hull' ? hull(x, y, spot.size, dr.beam || 46, Math.PI / 2) : blob(x, y, spot.size, (seed % 983) + i * 11, 0.22, 20, [1.1, 0.9], rng.range(0, Math.PI));
    def.floes.push({ pts, kind: dr.kind, look: dr.look, drift: [0, Math.round(spot.amp)], period: rng.int(14, 21), phase: +rng.range(0, Math.PI * 2).toFixed(2) });
    for (let k = -1; k <= 1.001; k += 0.25) circles.push({ x, y: y + spot.amp * k, r: spot.reach + 40 });
    tipNear('drift', x, y, 340);
  }

  // The world's monster keeps a lair near the course: kraken rules, its own look.
  for (let i = 0; i < (f.lairs || 0) && world.lair; i++) {
    const k = tryPlace(rng, () => {
      const p = along(rng.range(0.25, 0.8), 170);
      const r = Math.round(rng.range(88, 112));
      if (!inside(p.x, p.y, r + 30) || nearEnds(p.x, p.y, r + 100) || !free(p.x, p.y, r, 40)) return null;
      return { x: Math.round(p.x), y: Math.round(p.y), r };
    });
    if (!k) continue;
    circles.push(k);
    def.krakens.push({ ...k, period: rng.int(7, 9), offset: rng.int(0, 6), look: world.lair });
    tipNear('lairs', k.x, k.y, k.r + 150);
  }

  for (let i = 0; i < (f.whirl || 0); i++) {
    const w = tryPlace(rng, () => {
      const p = along(rng.range(0.3, 0.72), 150);
      const r = Math.round(rng.range(100, 125));
      if (!inside(p.x, p.y, r) || nearEnds(p.x, p.y, r + 60) || !free(p.x, p.y, r, 60)) return null;
      return { x: Math.round(p.x), y: Math.round(p.y), r };
    });
    if (!w) continue;
    circles.push(w);
    def.whirlpools.push({ ...w, strength: +rng.range(6, 7.2).toFixed(1), spin: rng.chance(0.5) ? 1 : -1 });
    tipNear('whirl', w.x, w.y, w.r + 160);
  }

  for (let i = 0; i < (f.current || 0); i++) {
    const c = along(f.current > 1 ? 0.3 + (i * 0.4) / (f.current - 1) : 0.5, 80);
    def.currents.push({ x: Math.round(c.x), y: Math.round(c.y), length: Math.round(H * 1.6), width: Math.round(rng.range(170, 230)), toward: rng.chance(0.5) ? 0 : 180, speed: +rng.range(2.5, 3.4).toFixed(1) });
    tipNear('current', c.x, c.y, 260);
  }

  // Islands, big ones first.
  const total = (f.islands ?? Math.round(3 + d * 2)) + (f.big || 0);
  for (let i = 0; i < total; i++) {
    const big = i < (f.big || 0);
    const isl = tryPlace(rng, (g) => {
      const r = big ? g.range(125, 165) : g.range(55, 105);
      const x = g.range(320, W - 320);
      const y = g.range(90 + r * 0.6, H - 90 - r * 0.6);
      if (nearEnds(x, y, r) || !free(x, y, r, 125)) return null;
      return { x, y, r };
    });
    if (!isl) continue;
    circles.push(isl);
    const k = big && world.big ? world.big : weighted(rng, world.kinds);
    def.islands.push(islandOf(world, k, Math.round(isl.x), Math.round(isl.y), Math.round(isl.r), (seed % 997) + i * 13, rng));
  }

  const groups = f.reef ?? Math.round(1 + d * 2);
  for (let i = 0; i < groups; i++) {
    const spot = tryPlace(rng, (g) => {
      const x = g.range(320, W - 320);
      const y = g.range(110, H - 110);
      if (nearEnds(x, y, 40) || !free(x, y, 45, 70)) return null;
      return { x, y, r: 45 };
    });
    if (!spot) continue;
    circles.push(spot);
    const material = weighted(rng, world.rocks);
    const [rMin, rMax] = (world.rockSize || {})[material] || [5, 11];
    def.rocks.push(...rockField(spot.x, spot.y, rng.range(30, 45), rng.int(3, 6), (seed % 991) + i * 7, rMin, rMax).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), r: +r.r.toFixed(1), material })));
  }

  for (let i = 0; i < (f.calms || 0); i++) {
    const p = along(rng.range(0.25, 0.75), 260);
    def.calms.push({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(rng.range(120, 170)) });
  }
  const weather = { ...(world.weather || {}) };
  if (f.squall) {
    const p = along(rng.range(0.4, 0.6), 200);
    def.storms.push({ x: Math.round(p.x), y: Math.round(p.y), r: 320, power: 0.7 });
    Object.assign(weather, { rain: 0.5, lightning: true, dark: Math.max(weather.dark || 0, 0.3) });
  }
  if (f.fog) weather.fog = f.fog;
  if (f.night) weather.night = true;
  if (Object.keys(weather).length) def.weather = weather;

  // Marks and pickups go wherever there is open water near the line.
  let level = buildLevel(def);
  const openSpot = (t0, t1, spread, clearance) =>
    tryPlace(rng, () => {
      const p = along(rng.range(t0, t1), spread);
      p.x = Math.round(p.x);
      p.y = Math.round(p.y);
      return inside(p.x, p.y, 60) && isClear(level, p.x, p.y, clearance) && !inLane(def, p.x, p.y, clearance) ? p : null;
    });

  for (let i = 0; i < (f.pirates || 0); i++) {
    const p = tryPlace(rng, () => {
      const q = along(rng.range(0.4, 0.62), 0);
      q.y += (rng.chance(0.5) ? 1 : -1) * rng.range(240, 340);
      q.x = Math.round(q.x);
      q.y = Math.round(q.y);
      return inside(q.x, q.y, 120) && isClear(level, q.x, q.y, 70) && free(q.x, q.y, 40, 40) ? q : null;
    });
    if (p) def.pirates = [{ ...p, heading: rng.int(0, 35) * 10, spot: 420 }];
    if (p) tipNear('pirates', p.x, p.y, 520);
  }

  // Checkpoints: in each wall's nearest gap, then along the line.
  for (const wall of walls) {
    const g = wall.gaps.reduce((a, b) => (Math.abs(b - lineY(wall.x)) < Math.abs(a - lineY(wall.x)) ? b : a));
    const y = Math.round(g);
    if (isClear(level, wall.x, y, 24)) def.checkpoints.push({ x: wall.x, y });
  }
  const marks = W > 2200 ? [0.25, 0.5, 0.75] : [0.33, 0.66];
  for (const t of marks) {
    const x = start.x + (finish.x - start.x) * t;
    if (def.checkpoints.some((c) => Math.abs(c.x - x) < 260)) continue;
    const c = openSpot(t - 0.05, t + 0.05, 120, 30);
    if (c) def.checkpoints.push(c);
  }
  def.checkpoints.sort((a, b) => a.x - b.x);

  for (let i = 0; i < 8; i++) {
    const p = openSpot(0.1 + i * 0.1, 0.18 + i * 0.1, 200, 16);
    if (p) def.pickups.push({ ...p, kind: 'pearl' });
  }
  for (let i = 0; i < 1 + (d > 0.3 ? 1 : 0); i++) {
    const p = openSpot(0.2, 0.8, 260, 16);
    if (p) def.pickups.push({ ...p, kind: 'gust' });
  }
  for (let i = 0; i < 1 + (d > 0.6 ? 1 : 0); i++) {
    const p = openSpot(0.35, 0.75, 220, 16);
    if (p) def.pickups.push({ ...p, kind: 'repair' });
  }
  if (spec.note) {
    const p = openSpot(0.2, 0.8, 300, 16);
    if (p) def.pickups.push({ ...p, kind: 'bottle', note: spec.note });
  }
  if (spec.castaway) {
    const p = openSpot(0.3, 0.75, 280, 45);
    if (p) def.castaways = [{ ...p, ...spec.castaway }];
  }

  def.tips = [{ at: 0, text: spec.tip || (index === 0 && world.tips && world.tips.start) || spec.blurb }, ...near.map((n) => n.tip)];

  level = buildLevel(def);
  const ok = isClear(level, start.x, start.y, 40) && isClear(level, finish.x, finish.y, 30) && !inLane(def, finish.x, finish.y, 60) && !inLane(def, start.x, start.y, 60);
  return ok ? def : null;
}

// Is (x, y) where a drifter swings through? Pickups there would be unfair.
function inLane(def, x, y, clearance) {
  return def.floes.some((fl) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [px, py] of fl.pts) {
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    const a = Math.abs(fl.drift[1]);
    const b = Math.abs(fl.drift[0]);
    return x > minX - b - clearance && x < maxX + b + clearance && y > minY - a - clearance && y < maxY + a + clearance;
  });
}
