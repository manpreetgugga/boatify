// Life on the islands. Decoration only. Grass, bushes, trees and wild flowers
// grow on the green islands, with shells, pebbles, starfish and driftwood on
// their beaches; moss, lichen, scrub and sea pinks cling to the rocks. Crabs
// scuttle along the shore, goats and their kids graze inland, and parrots
// flit from palm to palm. Sea turtles doze on the sand and seals bask on the
// rocks: sail close and they slip into the sea, swim about, and haul out
// again once you've gone.

import { clamp, dist, pointInPolygon, angleDiff, closestOnSegment, polygonArea } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { boatSpeed } from '../physics/boat.js';
import { viewBounds } from './camera.js';
import { edgeAt, perimeter } from './penguins.js';
import { drawStandingGull } from './wildlife.js';

const TAU = Math.PI * 2;
const BEACH = 11; // the sand runs this far in from the waterline
const SPOOK = 85; // a moving boat this close sends turtles and seals into the sea
const ENTER = { turtle: 2.6, seal: 1.4 }; // seconds down to the water
const HAUL = { turtle: 3.6, seal: 2.2 }; // seconds back up out of it
const HERD = 16; // how far goats stray from the middle of their pasture
// Drawn large, so they read on a phone.
const CRAB = 1.7;
const TURTLE = 2.1;
const SEAL = 2;
const GOAT = 1.9;
const PARROT = 1.7;

const CRABS = ['#d9573a', '#e57c35', '#8a4f9c'];
const GOATS = ['#f1ece0', '#f1ece0', '#8a5a35', '#3a3330', '#c9a27a'];
const PARROTS = [
  { body: '#d8352a', wing: '#2f6fc0', band: '#f2c230' },
  { body: '#3fae5a', wing: '#2b7f45', band: '#e04a3a' },
  { body: '#2f86d6', wing: '#245fa8', band: '#f2c230' },
];
const FLOWERS = ['#f6f1e2', '#f2cf4a', '#ec8fb4', '#a884d8', '#e0533a'];

// How far inside an island's outline a point is, the nearest point on the
// waterline, and which way is out to sea from there.
export function shore(x, y, pts) {
  let best = Infinity;
  let qx = x;
  let qy = y;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const [cx, cy] = closestOnSegment(x, y, ax, ay, bx, by);
    const d = Math.hypot(cx - x, cy - y);
    if (d < best) {
      best = d;
      qx = cx;
      qy = cy;
    }
  }
  const nx = best > 1e-6 ? (qx - x) / best : 1;
  const ny = best > 1e-6 ? (qy - y) / best : 0;
  return { d: best, x: qx, y: qy, nx, ny };
}

// Random points inside an island, between `lo` and `hi` in from the waterline
// and clear of anything in `avoid` ([x, y, r] each).
function scatter(rng, isl, count, lo, hi = Infinity, avoid = []) {
  const out = [];
  const b = isl.bounds;
  for (let i = 0; i < Math.max(40, count * 8) && out.length < count; i++) {
    const x = rng.range(b.minX, b.maxX);
    const y = rng.range(b.minY, b.maxY);
    if (!pointInPolygon(x, y, isl.pts)) continue;
    const s = shore(x, y, isl.pts);
    if (s.d < lo || s.d > hi) continue;
    if (avoid.some(([ax, ay, r]) => dist(ax, ay, x, y) < r)) continue;
    out.push({ x, y, s });
  }
  return out;
}

// A random point a little way in from the waterline, anywhere round the coast.
function coast(rng, isl, around, lo, hi) {
  const e = edgeAt(isl.pts, rng.range(0, around));
  if (!e) return null;
  const back = rng.range(lo, hi);
  const x = e.x - e.nx * back;
  const y = e.y - e.ny * back;
  if (!pointInPolygon(x, y, isl.pts)) return null;
  const s = shore(x, y, isl.pts);
  // Not in a tight corner where the beach runs out.
  if (s.d < lo * 0.7) return null;
  return { x, y, s };
}

// --- Plants -----------------------------------------------------------------

function layer() {
  const batches = [];
  const add = (style) => {
    const b = { ...style, shapes: [] };
    batches.push(b);
    return b.shapes;
  };
  return { batches, add };
}

// Clumps of overlapping round leaves: bushes, scrub and trees.
function clump(rng, x, y, size, lobes, shadow, dark, mid, light, lift) {
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * TAU + rng.range(-0.4, 0.4);
    const lx = x + Math.cos(a) * size * 0.55;
    const ly = y + Math.sin(a) * size * 0.55;
    const r = size * rng.range(0.55, 0.8);
    shadow.push(['c', lx + lift, ly + lift * 1.3, r]);
    dark.push(['c', lx, ly, r]);
    mid.push(['c', lx - r * 0.18, ly - r * 0.22, r * 0.72]);
    if (i % 2 === 0) light.push(['c', lx - r * 0.38, ly - r * 0.42, r * 0.3]);
  }
}

// What grows on an island, as plain shapes in world units grouped by layer
// and colour, placed the same way every time. `ground` goes under the beach,
// `beach` on the sand, `plants` over both.
export function placeGreenery(isl) {
  const out = { ground: [], beach: [], plants: [] };
  if (isl.kind !== 'sand' && isl.kind !== 'rock') return out;
  const rng = createRng((isl.seed || 1) * 4253 + 17);
  const area = polygonArea(isl.pts);
  const around = perimeter(isl.pts);
  const palms = (isl.decor || []).map((d) => [d.x, d.y, 12 * d.s]);

  if (isl.kind === 'sand') {
    const ground = layer();
    const light = ground.add({ fill: '#6aa65e', alpha: 0.5 });
    const dark = ground.add({ fill: '#4e8747', alpha: 0.45 });
    for (const p of scatter(rng, isl, Math.min(70, area / 3500), BEACH - 4)) {
      const r = rng.range(8, 24);
      (rng.chance(0.5) ? light : dark).push(['e', p.x, p.y, r, r * rng.range(0.5, 0.9), rng.range(0, Math.PI)]);
    }
    const tufts = ground.add({ stroke: '#447a3f', width: 0.7, alpha: 0.6 });
    for (const p of scatter(rng, isl, Math.min(320, area / 380), BEACH + 1)) {
      const a = rng.range(-0.4, 0.4) - Math.PI / 2;
      const h = rng.range(2.2, 3.4);
      for (const k of [-0.5, 0, 0.5]) tufts.push(['l', p.x, p.y, p.x + Math.cos(a + k) * h, p.y + Math.sin(a + k) * h]);
    }
    // Meadows of wild flowers.
    const petals = FLOWERS.map((fill) => ground.add({ fill, alpha: 1 }));
    for (const m of scatter(rng, isl, Math.min(36, area / 4500), BEACH + 6)) {
      const colours = [rng.int(0, FLOWERS.length - 1), rng.int(0, FLOWERS.length - 1)];
      const n = rng.int(7, 14);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU);
        const r = Math.sqrt(rng.next()) * 9;
        const x = m.x + Math.cos(a) * r;
        const y = m.y + Math.sin(a) * r;
        if (!pointInPolygon(x, y, isl.pts)) continue;
        petals[rng.pick(colours)].push(['c', x, y, rng.range(0.75, 1.1)]);
      }
    }
    out.ground = ground.batches;

    const beach = layer();
    const grass = beach.add({ stroke: '#8fae5c', width: 0.7, alpha: 0.85 });
    const wood = beach.add({ stroke: '#9c7a55', width: 1.3, alpha: 1 });
    const pebbles = beach.add({ fill: '#c9b58a', alpha: 1 });
    const shells = beach.add({ fill: '#f5ecdc', alpha: 1 });
    const pink = beach.add({ fill: '#efb8a8', alpha: 1 });
    const stars = beach.add({ stroke: '#e8743b', width: 0.9, alpha: 1 });
    // Marram grass where the sand meets the green.
    for (let i = 0; i < Math.min(160, around / 9); i++) {
      const p = coast(rng, isl, around, 8.5, 12);
      if (!p) continue;
      const a = Math.atan2(p.s.ny, p.s.nx) + rng.range(-0.6, 0.6);
      const h = rng.range(2, 3.2);
      for (const k of [-0.45, 0, 0.45]) grass.push(['l', p.x, p.y, p.x + Math.cos(a + k) * h, p.y + Math.sin(a + k) * h]);
    }
    for (let i = 0; i < Math.min(10, around / 220); i++) {
      const p = coast(rng, isl, around, 3, 8);
      if (!p) continue;
      const a = Math.atan2(-p.s.nx, p.s.ny) + rng.range(-0.5, 0.5);
      const l = rng.range(2.5, 4.5);
      wood.push(['l', p.x - Math.cos(a) * l, p.y - Math.sin(a) * l, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l]);
    }
    for (let i = 0; i < Math.min(60, around / 30); i++) {
      const p = coast(rng, isl, around, 1.5, 9);
      if (p) pebbles.push(['c', p.x, p.y, rng.range(0.6, 1.2)]);
    }
    for (let i = 0; i < Math.min(70, around / 22); i++) {
      const p = coast(rng, isl, around, 2, 8);
      if (p) (rng.chance(0.7) ? shells : pink).push(['c', p.x, p.y, rng.range(0.55, 0.85)]);
    }
    for (let i = 0; i < Math.min(6, around / 250); i++) {
      const p = coast(rng, isl, around, 2.5, 6);
      if (!p) continue;
      const a0 = rng.range(0, TAU);
      for (let k = 0; k < 5; k++) {
        const a = a0 + (k / 5) * TAU;
        stars.push(['l', p.x, p.y, p.x + Math.cos(a) * 1.6, p.y + Math.sin(a) * 1.6]);
      }
    }
    out.beach = beach.batches;

    const plants = layer();
    const treeShadow = plants.add({ fill: 'rgba(20, 50, 25, 0.32)', alpha: 1 });
    const bushShadow = plants.add({ fill: 'rgba(20, 50, 25, 0.3)', alpha: 1 });
    const bushDark = plants.add({ fill: '#3f7a3c', alpha: 1 });
    const bushMid = plants.add({ fill: '#4f8c45', alpha: 1 });
    const bushLight = plants.add({ fill: '#73ad5f', alpha: 1 });
    const blossom = ['#e0533a', '#f2cf4a', '#f6f1e2', '#ec8fb4'].map((fill) => plants.add({ fill, alpha: 1 }));
    const treeDark = plants.add({ fill: '#356a37', alpha: 1 });
    const treeMid = plants.add({ fill: '#468240', alpha: 1 });
    const treeLight = plants.add({ fill: '#62a052', alpha: 1 });
    for (const p of scatter(rng, isl, Math.min(140, area / 1600), BEACH + 4)) {
      const size = rng.range(2.2, 4);
      clump(rng, p.x, p.y, size, rng.int(3, 5), bushShadow, bushDark, bushMid, bushLight, 1.3);
      if (rng.chance(0.35)) {
        const fill = rng.pick(blossom);
        for (let i = rng.int(3, 6); i > 0; i--) fill.push(['c', p.x + rng.range(-size, size) * 0.8, p.y + rng.range(-size, size) * 0.8, 0.55]);
      }
    }
    if (area > 15000) {
      for (const p of scatter(rng, isl, Math.min(30, area / 9000), BEACH + 12, Infinity, palms)) {
        clump(rng, p.x, p.y, rng.range(6, 9), rng.int(5, 7), treeShadow, treeDark, treeMid, treeLight, 3);
      }
    }
    out.plants = plants.batches;
  } else {
    const plants = layer();
    const moss = plants.add({ fill: '#7a8c4e', alpha: 0.55 });
    const mossDark = plants.add({ fill: '#5b7041', alpha: 0.6 });
    const lichen = plants.add({ fill: '#d2b955', alpha: 0.8 });
    const rust = plants.add({ fill: '#d9824a', alpha: 0.75 });
    const scrubShadow = plants.add({ fill: 'rgba(20, 18, 16, 0.3)', alpha: 1 });
    const scrubDark = plants.add({ fill: '#4a6a3a', alpha: 1 });
    const scrubMid = plants.add({ fill: '#5f8247', alpha: 1 });
    const scrubLight = plants.add({ fill: '#7d9c5a', alpha: 1 });
    const thrift = plants.add({ fill: '#e79ab9', alpha: 1 });
    for (const p of scatter(rng, isl, Math.min(50, area / 2200), 3)) {
      const r = rng.range(3, 9);
      const rot = rng.range(0, Math.PI);
      moss.push(['e', p.x, p.y, r, r * rng.range(0.5, 0.85), rot]);
      mossDark.push(['e', p.x + rng.range(-1, 1) * r * 0.3, p.y + rng.range(-1, 1) * r * 0.3, r * 0.45, r * 0.3, rot]);
    }
    for (const p of scatter(rng, isl, Math.min(160, area / 300), 2)) {
      (rng.chance(0.7) ? lichen : rust).push(['c', p.x, p.y, rng.range(0.6, 1.4)]);
    }
    for (const p of scatter(rng, isl, Math.min(50, area / 2600), 6)) {
      clump(rng, p.x, p.y, rng.range(1.6, 2.6), rng.int(3, 4), scrubShadow, scrubDark, scrubMid, scrubLight, 1);
    }
    // Sea pinks in cushions near the water.
    for (let i = 0; i < Math.min(18, around / 120); i++) {
      const p = coast(rng, isl, around, 3, 10);
      if (!p) continue;
      for (let k = rng.int(4, 7); k > 0; k--) thrift.push(['c', p.x + rng.range(-2.2, 2.2), p.y + rng.range(-2.2, 2.2), 0.7]);
    }
    out.plants = plants.batches;
  }
  return out;
}

const greens = new WeakMap();

function toPaths(placed) {
  const out = {};
  for (const key of Object.keys(placed)) {
    out[key] = placed[key]
      .filter((b) => b.shapes.length)
      .map((b) => {
        const path = new Path2D();
        for (const s of b.shapes) {
          if (s[0] === 'c') {
            path.moveTo(s[1] + s[3], s[2]);
            path.arc(s[1], s[2], s[3], 0, TAU);
          } else if (s[0] === 'e') {
            path.moveTo(s[1] + Math.cos(s[5]) * s[3], s[2] + Math.sin(s[5]) * s[3]);
            path.ellipse(s[1], s[2], s[3], s[4], s[5], 0, TAU);
          } else {
            path.moveTo(s[1], s[2]);
            path.lineTo(s[3], s[4]);
          }
        }
        return { ...b, shapes: null, path };
      });
  }
  return out;
}

// One layer of an island's plants. Called by drawIslands with the island's
// outline as the clip, so nothing grows out over the water.
export function drawGreenery(ctx, isl, which) {
  let g = greens.get(isl);
  if (!g) {
    g = toPaths(placeGreenery(isl));
    greens.set(isl, g);
  }
  const batches = g[which];
  if (!batches || !batches.length) return;
  ctx.lineCap = 'round';
  for (const b of batches) {
    ctx.globalAlpha = b.alpha;
    if (b.fill) {
      ctx.fillStyle = b.fill;
      ctx.fill(b.path);
    } else {
      ctx.strokeStyle = b.stroke;
      ctx.lineWidth = b.width;
      ctx.stroke(b.path);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

// --- Animals ----------------------------------------------------------------

// A turtle or seal resting near the water, and the way it goes in.
function basker(rng, kind, x, y, s, face) {
  return {
    kind,
    x,
    y,
    face,
    edge: { x: s.x + s.nx * 3, y: s.y + s.ny * 3, nx: s.nx, ny: s.ny, tx: -s.ny, ty: s.nx },
    state: 'rest',
    t: 0,
    cool: rng.range(0, 3),
    reach: kind === 'seal' ? rng.range(28, 46) : rng.range(36, 56),
    wander: rng.range(14, 28) * (rng.chance(0.5) ? 1 : -1),
    swim: kind === 'seal' ? rng.range(7, 11) : rng.range(9, 14),
    loops: 0,
    phase: rng.range(0, TAU),
  };
}

// Everything that lives on an island, placed the same way every time.
export function placeIslandLife(isl) {
  const life = { crabs: [], turtles: [], seals: [], goats: [], herds: [], parrots: [], palms: [], gulls: [] };
  if (isl.kind !== 'sand' && isl.kind !== 'rock') return life;
  const sand = isl.kind === 'sand';
  const rng = createRng((isl.seed || 1) * 6151 + 389);
  const around = perimeter(isl.pts);
  const area = polygonArea(isl.pts);

  // Crabs along the shore: plenty on the beaches, a few on the rocks.
  const crabs = clamp(Math.round(around / (sand ? 110 : 220)), 1, sand ? 10 : 4);
  for (let i = 0; i < crabs * 6 && life.crabs.length < crabs; i++) {
    const p = sand ? coast(rng, isl, around, 4, 9) : coast(rng, isl, around, 3, 6);
    if (!p) continue;
    life.crabs.push({
      ax: p.x,
      ay: p.y,
      tx: -p.s.ny,
      ty: p.s.nx,
      off: 0,
      face: Math.atan2(p.s.ny, p.s.nx),
      state: 'still',
      t: 0,
      dur: rng.range(0.5, 4),
      dir: 1,
      colour: rng.pick(CRABS),
      phase: rng.range(0, TAU),
    });
  }

  // Turtles dozing on the beaches; seals in groups on the rocks.
  if (rng.chance(sand ? 0.8 : 0.9)) {
    const spots = clamp(Math.round(around / (sand ? 500 : 350)), 1, 3);
    const cap = sand ? 4 : 8;
    const list = sand ? life.turtles : life.seals;
    let groups = 0;
    for (let k = 0; k < 24 && groups < spots && list.length < cap; k++) {
      const p = sand ? coast(rng, isl, around, 5, 7.5) : coast(rng, isl, around, 5, 9);
      if (!p || list.some((a) => dist(a.x, a.y, p.x, p.y) < 50)) continue;
      groups += 1;
      const want = sand ? rng.int(1, 2) : rng.int(2, 4);
      const out = Math.atan2(p.s.ny, p.s.nx);
      let placed = 0;
      for (let i = 0; i < want * 4 && placed < want && list.length < cap; i++) {
        const lane = placed ? rng.range(-16, 16) : 0;
        const x = p.x - p.s.ny * lane + rng.range(-2, 2);
        const y = p.y + p.s.nx * lane + rng.range(-2, 2);
        if (!pointInPolygon(x, y, isl.pts) || list.some((a) => dist(a.x, a.y, x, y) < 12)) continue;
        const s = shore(x, y, isl.pts);
        if (s.d < 3.5 || s.d > 11) continue;
        // Turtles face up the beach or out to sea; seals lie along the shore.
        const face = sand
          ? out + (rng.chance(0.5) ? Math.PI : 0) + rng.range(-0.6, 0.6)
          : out + ((rng.chance(0.5) ? 1 : -1) * Math.PI) / 2 + rng.range(-0.5, 0.5);
        list.push(basker(rng, sand ? 'turtle' : 'seal', x, y, s, face));
        placed += 1;
      }
    }
  }

  // Gulls standing about on the rocks.
  if (!sand) {
    for (const p of scatter(rng, isl, rng.int(0, 3), 6, 16)) life.gulls.push({ x: p.x, y: p.y });
  }

  // Goats grazing inland, with a kid or two at heel.
  const palms = sand ? (isl.decor || []).filter((d) => pointInPolygon(d.x, d.y, isl.pts)) : [];
  if (area > 9000 && rng.chance(sand ? 0.8 : 0.45)) {
    const herds = area > 60000 ? 2 : 1;
    // Out from under the palms, where they'd be hidden.
    const shade = palms.map((d) => [d.x, d.y, 9 * d.s]);
    for (const home of scatter(rng, isl, herds, HERD + (sand ? BEACH + 5 : 12), Infinity, shade)) {
      const herd = { x: home.x, y: home.y, r: HERD, shade };
      life.herds.push(herd);
      const adults = rng.int(2, 4);
      const first = life.goats.length;
      for (let i = 0; i < adults * 4 && life.goats.length - first < adults; i++) {
        const a = rng.range(0, TAU);
        const r = rng.range(0, HERD * 0.8);
        const x = home.x + Math.cos(a) * r;
        const y = home.y + Math.sin(a) * r;
        if (shaded(herd, x, y)) continue;
        life.goats.push(goat(rng, herd, x, y, rng.pick(GOATS), null));
      }
      const adultsPlaced = life.goats.length - first;
      for (let i = adultsPlaced ? rng.int(0, 2) : 0; i > 0; i--) {
        const mum = first + rng.int(0, adultsPlaced - 1);
        const m = life.goats[mum];
        life.goats.push(goat(rng, herd, m.x + rng.range(-4, 4), m.y + rng.range(-4, 4), m.colour, mum));
      }
    }
  }

  // Parrots on islands with palms enough to fly between.
  if (palms.length >= 2 && rng.chance(0.85)) {
    life.palms = palms.map((d) => ({ x: d.x, y: d.y, s: 7 * d.s, near: [] }));
    life.palms.forEach((p, i) => {
      p.near = life.palms.map((q, j) => j).filter((j) => j !== i && dist(p.x, p.y, life.palms[j].x, life.palms[j].y) < 140);
    });
    const perches = life.palms.map((p, i) => i).filter((i) => life.palms[i].near.length);
    if (perches.length) {
      for (let i = rng.int(2, 4); i > 0; i--) {
        const palm = rng.pick(perches);
        life.parrots.push({ palm, to: palm, state: 'perch', t: 0, dur: rng.range(1, 8), a: rng.range(0, TAU), bend: 0, colour: rng.pick(PARROTS), phase: rng.range(0, TAU) });
      }
    }
  }
  return life;
}

function shaded(herd, x, y) {
  return herd.shade.some(([px, py, r]) => dist(px, py, x, y) < r);
}

function goat(rng, herd, x, y, colour, mum) {
  return {
    herd,
    x,
    y,
    tx: x,
    ty: y,
    face: rng.range(0, TAU),
    state: 'graze',
    t: 0,
    dur: rng.range(1, 6),
    step: 0,
    look: 0,
    colour,
    patch: mum === null && rng.chance(0.4) ? (colour === '#3a3330' ? '#f1ece0' : '#3a3330') : null,
    px: rng.range(-1, 0.6),
    py: rng.range(-0.4, 0.4),
    kid: mum !== null,
    mum,
    phase: rng.range(0, TAU),
  };
}

function lifeOf(st, isl) {
  let life = st.map.get(isl);
  if (!life) {
    life = placeIslandLife(isl);
    st.map.set(isl, life);
  }
  return life;
}

function updateCrab(c, busy, dt) {
  c.t += dt;
  if (c.state === 'still') {
    if (c.t >= c.dur) {
      c.state = 'run';
      c.t = 0;
      c.dur = 0.3 + Math.random() * 0.7;
      c.dir = Math.abs(c.off) > 4 ? -Math.sign(c.off) : Math.random() < 0.5 ? -1 : 1;
    }
  } else {
    c.off = clamp(c.off + c.dir * 10 * dt, -7, 7);
    if (c.t >= c.dur) {
      c.state = 'still';
      c.t = 0;
      // A boat close by makes them jumpy.
      c.dur = busy ? 0.3 + Math.random() * 1.2 : 1 + Math.random() * 4;
    }
  }
}

function updateBasker(a, boat, moving, dt, st) {
  a.t += dt;
  const d = dist(boat.x, boat.y, a.x, a.y);
  if (d < 150 && !st.near) st.near = a.kind;
  if (a.state === 'rest') {
    a.cool -= dt;
    if (moving && d < SPOOK && a.cool <= 0 && Math.random() < dt * (a.kind === 'seal' ? 1.5 : 0.9)) {
      a.state = 'enter';
      a.t = 0;
    }
  } else if (a.state === 'enter' && a.t >= ENTER[a.kind]) {
    a.state = 'swim';
    a.t = 0;
    a.loops = 0;
  } else if (a.state === 'swim' && a.t >= a.swim) {
    // Another lap while the boat's still about.
    if (d < SPOOK + 40 && a.loops < 3) {
      a.t = 0;
      a.loops += 1;
      a.wander = -a.wander;
    } else {
      a.state = 'haul';
      a.t = 0;
    }
  } else if (a.state === 'haul' && a.t >= HAUL[a.kind]) {
    a.state = 'rest';
    a.t = 0;
    a.cool = 10 + Math.random() * 12;
    a.face = Math.atan2(a.y - a.edge.y, a.x - a.edge.x) + (Math.random() - 0.5) * 0.8;
  }
}

function updateGoat(g, life, isl, boat, dt) {
  g.t += dt;
  const toBoat = Math.atan2(boat.y - g.y, boat.x - g.x);
  // Heads up to watch a boat go by.
  const want = dist(boat.x, boat.y, g.x, g.y) < 110 ? clamp(angleDiff(g.face, toBoat), -0.9, 0.9) : 0;
  g.look += clamp(want - g.look, -2 * dt, 2 * dt);
  if (g.state === 'graze') {
    if (g.t < g.dur) return;
    let tx;
    let ty;
    if (g.kid) {
      const m = life.goats[g.mum];
      const a = Math.random() * TAU;
      tx = m.x + Math.cos(a) * 5;
      ty = m.y + Math.sin(a) * 5;
    } else {
      const a = Math.random() * TAU;
      const r = Math.sqrt(Math.random()) * g.herd.r;
      tx = g.herd.x + Math.cos(a) * r;
      ty = g.herd.y + Math.sin(a) * r;
    }
    // Kids stay close to the pasture too.
    if (dist(tx, ty, g.herd.x, g.herd.y) > g.herd.r + 4 || !pointInPolygon(tx, ty, isl.pts) || shaded(g.herd, tx, ty)) {
      g.t = g.dur - 0.5;
      return;
    }
    g.tx = tx;
    g.ty = ty;
    g.state = 'walk';
    g.t = 0;
  } else {
    const dx = g.tx - g.x;
    const dy = g.ty - g.y;
    const d = Math.hypot(dx, dy);
    const sp = (g.kid ? 7 : 4.5) * dt;
    if (d > 0.5) g.face += clamp(angleDiff(g.face, Math.atan2(dy, dx)), -3 * dt, 3 * dt);
    g.step += dt * (g.kid ? 12 : 8);
    if (d <= sp) {
      g.x = g.tx;
      g.y = g.ty;
      g.state = 'graze';
      g.t = 0;
      g.dur = g.kid ? 1 + Math.random() * 3 : 3 + Math.random() * 7;
    } else {
      g.x += (dx / d) * sp;
      g.y += (dy / d) * sp;
    }
  }
}

function updateParrot(p, life, boat, moving, dt) {
  p.t += dt;
  if (p.state === 'perch') {
    const pal = life.palms[p.palm];
    const scared = moving && dist(boat.x, boat.y, pal.x, pal.y) < 70;
    if (p.t >= p.dur || (scared && Math.random() < dt * 3)) {
      const to = pal.near[Math.floor(Math.random() * pal.near.length)];
      if (to === undefined) return;
      const dest = life.palms[to];
      p.to = to;
      p.state = 'fly';
      p.t = 0;
      p.dur = 0.8 + dist(pal.x, pal.y, dest.x, dest.y) / 26;
      p.bend = (Math.random() - 0.5) * 0.7;
    }
  } else if (p.t >= p.dur) {
    p.palm = p.to;
    p.state = 'perch';
    p.t = 0;
    p.dur = 3 + Math.random() * 8;
    p.a = Math.random() * TAU;
  }
}

// Islands near the boat come alive; the rest wait, frozen, till you're back.
export function updateIslandLife(lf, game, dt) {
  if (!lf.isles || lf.isles.level !== game.level) lf.isles = { level: game.level, map: new WeakMap(), near: null };
  const st = lf.isles;
  const { boat } = game;
  const moving = boatSpeed(boat) > 2.5 && game.status === 'sailing';
  st.near = null;
  for (const isl of game.level.islands) {
    if (isl.kind !== 'sand' && isl.kind !== 'rock') continue;
    const b = isl.bounds;
    if (boat.x < b.minX - 700 || boat.x > b.maxX + 700 || boat.y < b.minY - 700 || boat.y > b.maxY + 700) continue;
    const life = lifeOf(st, isl);
    for (const c of life.crabs) updateCrab(c, dist(boat.x, boat.y, c.ax, c.ay) < 120, dt);
    for (const a of life.turtles) updateBasker(a, boat, moving, dt, st);
    for (const a of life.seals) updateBasker(a, boat, moving, dt, st);
    for (const g of life.goats) updateGoat(g, life, isl, boat, dt);
    for (const p of life.parrots) updateParrot(p, life, boat, moving, dt);
  }
}

// Every island's animals, for the test hook.
export function islandAnimals(lf, game) {
  const all = { crabs: [], turtles: [], seals: [], goats: [], parrots: [] };
  if (!lf.isles) return all;
  for (const isl of game.level.islands) {
    const life = lf.isles.map.get(isl);
    if (!life) continue;
    for (const k of Object.keys(all)) all[k].push(...life[k]);
  }
  return all;
}

// --- Drawing ----------------------------------------------------------------

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function swimAt(a, u) {
  const e = a.edge;
  const out = Math.sin(Math.PI * u) * a.reach;
  const side = Math.sin(TAU * u) * a.wander;
  return [e.x + e.nx * out + e.tx * side, e.y + e.ny * out + e.ty * side];
}

function ripple(ctx, x, y, age, size = 6) {
  if (age < 0 || age > 1) return;
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.7 * (1 - age)).toFixed(3)})`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, 1.5 + age * size, 0, TAU);
  ctx.stroke();
}

// Where a turtle or seal is, which way it's heading, and whether it's wet.
function pose(a) {
  const e = a.edge;
  if (a.state === 'rest') return { x: a.x, y: a.y, face: a.face, wet: 0, moving: false };
  if (a.state === 'enter' || a.state === 'haul') {
    const k = clamp(a.t / (a.state === 'enter' ? ENTER[a.kind] : HAUL[a.kind]), 0, 1);
    const [fx, fy, tx, ty] = a.state === 'enter' ? [a.x, a.y, e.x, e.y] : [e.x, e.y, a.x, a.y];
    const face = Math.atan2(ty - fy, tx - fx);
    // Turns to face the way it's going first.
    const turn = a.state === 'enter' ? clamp(k * 4, 0, 1) : 1;
    return { x: fx + (tx - fx) * k, y: fy + (ty - fy) * k, face: a.face + angleDiff(a.face, face) * turn, wet: a.state === 'enter' ? clamp((k - 0.75) * 4, 0, 1) : clamp(1 - k * 4, 0, 1), moving: true, k };
  }
  const u = a.t / a.swim;
  const [x, y] = swimAt(a, u);
  const [nx, ny] = swimAt(a, Math.min(1, u + 0.02));
  return { x, y, face: Math.atan2(ny - y, nx - x), wet: 1, moving: true, u };
}

function drawTurtle(ctx, a, time) {
  const p = pose(a);
  const swim = a.state === 'swim';
  // Under the surface most of the time, up for a breath now and then.
  const up = swim ? Math.max(0, Math.sin(p.u * TAU * 2.5 + a.phase)) : 1;
  if (swim && up > 0.6) ripple(ctx, p.x, p.y, (time * 1.3 + a.phase) % 1, 5);
  if (a.state !== 'rest' && a.state !== 'swim') ripple(ctx, a.edge.x, a.edge.y, (a.t - (a.state === 'enter' ? ENTER.turtle - 0.3 : 0)) / 0.9, 7);
  const paddle = p.moving ? Math.sin(time * (swim ? 3 : 4.5) + a.phase) : Math.max(0, Math.sin(time * 0.5 + a.phase)) * 0.2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.face);
  ctx.scale(TURTLE, TURTLE);
  if (!p.wet) {
    ctx.fillStyle = 'rgba(70, 50, 20, 0.25)';
    ellipse(ctx, 0.35, 0.45, 2.2, 1.7);
  }
  ctx.globalAlpha = swim ? 0.4 + up * 0.45 : 1 - p.wet * 0.2;
  ctx.fillStyle = '#8c9660';
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(0.7, s * 1.15);
    ctx.rotate(s * (0.55 + paddle * 0.55));
    ellipse(ctx, 0.85, 0, 1.3, 0.42);
    ctx.restore();
    ctx.save();
    ctx.translate(-1.3, s * 0.85);
    ctx.rotate(s * (2.3 - paddle * 0.3));
    ellipse(ctx, 0.45, 0, 0.7, 0.32);
    ctx.restore();
  }
  ellipse(ctx, 2.05, 0, 0.72, 0.55);
  ctx.fillStyle = '#1e2a1a';
  for (const s of [-1, 1]) ellipse(ctx, 2.35, s * 0.32, 0.12, 0.12);
  ctx.fillStyle = '#4f5c2c';
  ellipse(ctx, 0, 0, 1.95, 1.55);
  ctx.fillStyle = '#6b7a3a';
  ellipse(ctx, -0.05, 0, 1.7, 1.32);
  ctx.fillStyle = '#87964a';
  ellipse(ctx, 0.8, 0, 0.42, 0.36);
  ellipse(ctx, 0, 0, 0.46, 0.4);
  ellipse(ctx, -0.8, 0, 0.42, 0.36);
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.4, s * 0.78, 0.36, 0.28);
    ellipse(ctx, -0.45, s * 0.78, 0.36, 0.28);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSeal(ctx, a, time) {
  const p = pose(a);
  const swim = a.state === 'swim';
  if (a.state !== 'rest' && a.state !== 'swim') ripple(ctx, a.edge.x, a.edge.y, (a.t - (a.state === 'enter' ? ENTER.seal - 0.3 : 0)) / 0.8, 8);
  // Galumphing along on land; now and then a lazy stretch when basking.
  const hump = p.moving && !swim ? Math.abs(Math.sin(time * 7 + a.phase)) : 0;
  const beat = Math.sin(time * 0.7 + a.phase);
  const lift = a.state === 'rest' ? Math.max(0, beat - 0.6) * 2.5 : swim ? 1 : 0.5;
  const wave = a.state === 'rest' ? Math.max(0, Math.sin(time * 0.45 + a.phase * 2) - 0.7) * Math.sin(time * 9) * 2 : swim ? Math.sin(time * 5) * 0.4 : 0;
  ctx.save();
  ctx.translate(p.x, p.y - hump * 0.8);
  ctx.rotate(p.face);
  ctx.scale(SEAL * (1 + hump * 0.05), SEAL);
  if (swim) {
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.55)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(1.6, -0.7);
    ctx.lineTo(-1.4, -2);
    ctx.moveTo(1.6, 0.7);
    ctx.lineTo(-1.4, 2);
    ctx.stroke();
  } else if (!p.wet) {
    ctx.fillStyle = 'rgba(20, 18, 16, 0.3)';
    ellipse(ctx, 0.4, 0.6, 2.6, 1.2);
  }
  ctx.globalAlpha = swim ? 0.45 : 1;
  ctx.fillStyle = '#262c31';
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-2.3, s * 0.3);
    ctx.rotate(s * (0.35 + wave * 0.3));
    ellipse(ctx, -0.55, 0, 0.75, 0.3);
    ctx.restore();
    ctx.save();
    ctx.translate(0.5, s * 0.9);
    ctx.rotate(s * (1.1 - hump * 0.6));
    ellipse(ctx, 0.4, 0, 0.6, 0.24);
    ctx.restore();
  }
  ctx.fillStyle = '#3d454d';
  ellipse(ctx, -0.2, 0, 2.4, 1.05);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ellipse(ctx, -0.2, -0.38, 1.7, 0.32);
  ctx.fillStyle = '#2c3237';
  ellipse(ctx, -0.9, 0.3, 0.2, 0.2);
  ellipse(ctx, 0.2, -0.4, 0.15, 0.15);
  ellipse(ctx, -1.5, -0.2, 0.17, 0.17);
  ctx.globalAlpha = 1;
  const hx = 2 + lift * 0.35;
  ctx.fillStyle = '#48515a';
  ellipse(ctx, hx, 0, 0.82, 0.82);
  ctx.fillStyle = '#6e777e';
  ellipse(ctx, hx + 0.6, 0, 0.42, 0.36);
  ctx.fillStyle = '#1c2024';
  ellipse(ctx, hx + 0.95, 0, 0.12, 0.12);
  for (const s of [-1, 1]) ellipse(ctx, hx + 0.3, s * 0.38, 0.12, 0.12);
  ctx.restore();
}

function drawCrab(ctx, c, time) {
  const x = c.ax + c.tx * c.off;
  const y = c.ay + c.ty * c.off;
  const run = c.state === 'run';
  const legs = run ? Math.sin(time * 40 + c.phase) : 0;
  const claws = Math.max(0, Math.sin(time * 1.3 + c.phase) - 0.85) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(c.face);
  ctx.scale(CRAB, CRAB);
  ctx.fillStyle = 'rgba(70, 50, 20, 0.25)';
  ellipse(ctx, 0.25, 0.3, 0.95, 1.25);
  ctx.strokeStyle = c.colour;
  ctx.lineWidth = 0.26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = (i % 2 ? 1 : -1) * legs * 0.25;
      ctx.moveTo(-0.45 + i * 0.4, s * 0.85);
      ctx.lineTo(-0.7 + i * 0.5 + w, s * 1.75);
    }
    ctx.moveTo(0.5, s * 0.6);
    ctx.lineTo(1, s * (0.75 + claws * 0.1));
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = c.colour;
  for (const s of [-1, 1]) ellipse(ctx, 1.1, s * (0.75 + claws * 0.15), 0.42, 0.34);
  ellipse(ctx, 0, 0, 0.85, 1.15);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ellipse(ctx, -0.15, -0.3, 0.45, 0.5);
  ctx.fillStyle = '#1c1a18';
  for (const s of [-1, 1]) ellipse(ctx, 0.78, s * 0.32, 0.13, 0.13);
  ctx.restore();
}

function drawGoat(ctx, g, time) {
  const walking = g.state === 'walk';
  // Kids skip about; the grown-ups bob along.
  const hop = walking ? Math.abs(Math.sin(g.step * (g.kid ? 0.6 : 0.5))) * (g.kid ? 1.4 : 0.4) : 0;
  const grazing = !walking && Math.abs(g.look) < 0.2;
  const nod = grazing ? Math.sin(time * 3 + g.phase) * 0.12 : 0;
  const k = GOAT * (g.kid ? 0.62 : 1);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.face);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(20, 50, 25, 0.22)';
  ellipse(ctx, 0.4 + hop * 0.3, 0.5 + hop * 0.4, 1.7, 0.85);
  ctx.translate(-hop * 0.2, -hop * 0.3);
  const flick = Math.sin(time * 6 + g.phase) * 0.4;
  ctx.fillStyle = g.colour;
  ellipse(ctx, -1.75, 0, 0.35, 0.18, flick);
  ellipse(ctx, -0.2, 0, 1.6, 0.85);
  if (g.patch) {
    ctx.fillStyle = g.patch;
    ellipse(ctx, g.px, g.py, 0.6, 0.45);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ellipse(ctx, -0.25, 0.32, 1.45, 0.42);
  ctx.save();
  ctx.translate(1.25, 0);
  ctx.rotate(g.look + nod);
  ctx.fillStyle = g.colour;
  ellipse(ctx, 0.2, 0, 0.5, 0.42);
  const hx = grazing ? 0.85 : 0.7;
  ellipse(ctx, hx, 0, grazing ? 0.5 : 0.55, 0.4);
  const ear = g.colour === '#f1ece0' ? '#d9cfbd' : 'rgba(0, 0, 0, 0.25)';
  ctx.fillStyle = ear;
  for (const s of [-1, 1]) ellipse(ctx, hx - 0.2, s * 0.48, 0.32, 0.14, s * 0.4);
  if (!g.kid) {
    ctx.strokeStyle = '#7a6a55';
    ctx.lineWidth = 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(hx - 0.1, s * 0.15);
      ctx.quadraticCurveTo(hx - 0.45, s * 0.38, hx - 0.7, s * 0.26);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.fillStyle = '#c08a7a';
  ellipse(ctx, hx + 0.48, 0, 0.13, 0.13);
  ctx.restore();
  ctx.restore();
}

function drawParrot(ctx, x, y, heading, flap, height, col, folded) {
  const k = PARROT * (folded ? 0.9 : 1);
  const span = folded ? 0 : 2.6 * (0.6 + 0.4 * Math.cos(flap));
  for (const shadow of [true, false]) {
    ctx.save();
    ctx.translate(x + (shadow ? height * 0.5 + 0.6 : 0), y + (shadow ? height * 0.7 + 0.8 : 0));
    ctx.rotate(heading);
    ctx.scale(k, k);
    ctx.fillStyle = shadow ? 'rgba(4, 22, 30, 0.18)' : col.wing;
    ctx.beginPath();
    ctx.moveTo(-0.9, -0.3);
    ctx.lineTo(-3.4, -0.18);
    ctx.lineTo(-3.4, 0.18);
    ctx.lineTo(-0.9, 0.3);
    ctx.closePath();
    ctx.fill();
    if (folded) {
      for (const s of [-1, 1]) ellipse(ctx, -0.35, s * 0.35, 1.1, 0.3);
    } else {
      for (const s of [-1, 1]) ellipse(ctx, -0.1, s * span * 0.55, 0.7, span * 0.55, s * 0.15);
      if (!shadow) {
        ctx.fillStyle = col.band;
        for (const s of [-1, 1]) ellipse(ctx, 0.1, s * span * 0.38, 0.32, span * 0.22, s * 0.15);
      }
    }
    if (!shadow) ctx.fillStyle = col.body;
    ellipse(ctx, 0, 0, 1.3, 0.55);
    ellipse(ctx, 1.15, 0, 0.5, 0.5);
    if (!shadow) {
      ctx.fillStyle = '#f1e4c0';
      ctx.beginPath();
      ctx.moveTo(2.05, 0);
      ctx.lineTo(1.5, -0.28);
      ctx.lineTo(1.5, 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1c1a18';
      for (const s of [-1, 1]) ellipse(ctx, 1.25, s * 0.28, 0.1, 0.1);
    }
    ctx.restore();
  }
}

function drawParrots(ctx, life, time) {
  for (const p of life.parrots) {
    const from = life.palms[p.palm];
    if (p.state === 'perch') {
      const sway = Math.sin(time * 1.1 + from.x * 0.05) * 0.08;
      const r = from.s * 0.55;
      const x = from.x + Math.cos(p.a + sway) * r;
      const y = from.y + Math.sin(p.a + sway) * r;
      drawParrot(ctx, x, y, p.a + Math.PI + Math.sin(time * 0.8 + p.phase) * 0.4, 0, 2, p.colour, true);
      continue;
    }
    const to = life.palms[p.to];
    const k = clamp(p.t / p.dur, 0, 1);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const bulge = Math.sin(Math.PI * k) * p.bend;
    const x = from.x + dx * k - dy * bulge;
    const y = from.y + dy * k + dx * bulge;
    const head = Math.atan2(dy + dx * p.bend * Math.cos(Math.PI * k) * Math.PI, dx - dy * p.bend * Math.cos(Math.PI * k) * Math.PI);
    drawParrot(ctx, x, y, head, time * 16 + p.phase, 4 + Math.sin(Math.PI * k) * 12, p.colour, false);
  }
}

// On the islands and in the water just off them: under the boat.
export function drawIslandLife(ctx, lf, game, cam, time) {
  if (!lf.isles) return;
  const v = viewBounds(cam, 80);
  const windFace = game.wind.angle + Math.PI;
  for (const isl of game.level.islands) {
    if (isl.kind !== 'sand' && isl.kind !== 'rock') continue;
    const b = isl.bounds;
    if (b.maxX + 80 < v.minX || b.minX - 80 > v.maxX || b.maxY + 80 < v.minY || b.minY - 80 > v.maxY) continue;
    const life = lifeOf(lf.isles, isl);
    for (const c of life.crabs) drawCrab(ctx, c, time);
    for (const a of life.turtles) drawTurtle(ctx, a, time);
    for (const a of life.seals) drawSeal(ctx, a, time);
    for (const g of life.gulls) drawStandingGull(ctx, g.x, g.y, windFace + Math.sin(time * 0.6 + g.x) * 0.3, 1.9);
    for (const g of life.goats) drawGoat(ctx, g, time);
    drawParrots(ctx, life, time);
  }
}
