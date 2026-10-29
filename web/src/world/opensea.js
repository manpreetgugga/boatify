// Open Sea: an endless run east across open water. The sea is charted a
// stretch at a time just ahead of the boat and forgotten once it is well
// behind. Buoy gates put time back on the clock, pearls add a little more;
// the run ends when the clock runs out or the hull gives out, and the score
// is how far east you got.

import { angleDiff, clamp, dist, fromBearing } from '../core/math.js';
import { createRng, hashString } from '../core/rng.js';
import { blob, rockField, prepareIsland } from './shapes.js';
import { prepareCurrents, prepareWhirlpools } from './water.js';
import { shadowSources } from './wind.js';
import { isClear } from './collision.js';
import { addSeaLife } from './wildlife.js';
import { effectiveSpeed } from './autopilot.js';
import { whirlpoolBlackPearl } from './blackpearls.js';

export const OPEN_SEA = 'open-sea';
export const SEA_HEIGHT = 1300;
export const STRETCH = 1000; // how much sea is charted at a time
const SEA_LENGTH = 1e6;
const START_X = 220;
const AHEAD = 2600; // keep the sea charted this far ahead of the boat
const BEHIND = 1400; // and forget it this far behind
const GATE_R = 44;
const MISSED_BY = 150; // a gate this far behind the boat is missed
export const PEARL_TIME = 2;
export const SEA_BLURB = 'No harbor, no end. Sail east for as long as the clock lasts: every buoy gate puts time back on it, and every pearl a little more. The wind wanders as you go.';
const WARN_AT = 10; // seconds left when the clock starts to tick

// Gates hand back the time the next leg should take at polar speed, with a
// margin that shrinks as the run goes on until it is less than the leg
// takes even sailed well: every run ends sooner or later.
export function generosity(gates) {
  return Math.max(0.5, 1.4 * 0.92 ** gates);
}

// Ramps from a gentle start to the full mix of hazards a few km out.
function difficulty(k) {
  return clamp((k - 1) / 5, 0, 1);
}

// The wind shifts every minute or so, sometimes onto the nose. A dead beat
// to the east is cut short: a shift that would land on one swings on past.
function shiftWind(rng, from) {
  const turn = rng.chance(0.5) ? 1 : -1;
  let next = Math.round(from + turn * rng.range(30, 75));
  const off = angleDiff(Math.PI / 2, (next * Math.PI) / 180) / (Math.PI / 180);
  if (Math.abs(off) < 28) next = Math.round(90 + turn * rng.range(30, 50));
  return ((next % 360) + 360) % 360;
}

export function openSeaDef(seed = 1) {
  const rng = createRng(hashString(`open-sea:${seed}`));
  // Start on a reach, with the wind from somewhere north or south.
  const from = (((rng.chance(0.5) ? 0 : 180) + rng.int(-4, 4) * 10) % 360 + 360) % 360;
  const events = [];
  let t = 0;
  let f = from;
  let speed = 16;
  while (t < 3600) {
    t += rng.range(45, 75);
    f = shiftWind(rng, f);
    speed = clamp(speed + rng.range(-3, 3), 12, 20);
    events.push({ at: Math.round(t), from: f, speed: Math.round(speed) });
  }
  return {
    id: OPEN_SEA,
    endless: true,
    seed,
    name: 'Open Sea',
    blurb: SEA_BLURB,
    size: [SEA_LENGTH, SEA_HEIGHT],
    start: { x: START_X, y: SEA_HEIGHT / 2, heading: 90 },
    // Never reached: the open sea has no B.
    finish: { x: SEA_LENGTH + 1e4, y: SEA_HEIGHT / 2, r: 1, kind: 'harbor' },
    wind: { from, speed: 16, gust: 0.24, shift: 6, period: 40, events },
    par: { gold: 0, silver: 0 },
    tips: [
      { at: 0.5, text: 'Sail through each buoy gate to put time back on the clock. Miss one and you lose its time.' },
      { at: 16, text: 'Pearls add a couple of seconds too. How far east can you get?' },
    ],
  };
}

// Time the leg from a to b should take at the boat's polar speed in the
// wind that is blowing now.
export function legTime(game, a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const course = Math.atan2(b.y - a.y, b.x - a.x);
  const twa = Math.abs(angleDiff(course, fromBearing(game.wind.baseFrom)));
  return d / Math.max(1, game.wind.speed * effectiveSpeed(twa));
}

export function prepareOpenSea(game) {
  const { def, level } = game;
  const sea = {
    rng: createRng(hashString(`open-sea:gates:${def.seed}`)),
    clock: 0,
    gates: 0,
    missed: 0,
    best: 0, // furthest east, from the start
    charted: 0, // stretches charted so far
    gateX: START_X + 520,
    gateY: SEA_HEIGHT / 2,
    pruned: 0,
    serial: 0, // ids for islands and pickups charted on the way
    gems: createRng(hashString(`open-sea:gems:${def.seed}`)), // its own draws, so the sea charts the same either way
    blackPearlsLeft: game.blackPearlsOut ? 1 : 0, // a run turns up one at most
    revived: 0, // second winds taken
    wind: game.wind.eventIndex,
    warned: Infinity,
  };
  game.sea = sea;
  chartAhead(game);
  sea.clock = Math.round(legTime(game, level.start, level.checkpoints[0]) * 1.7 + 12);
  return sea;
}

function chartAhead(game) {
  const sea = game.sea;
  while (sea.charted * STRETCH < game.boat.x + AHEAD) {
    chartGates(game, (sea.charted + 2) * STRETCH);
    chartStretch(game, sea.charted);
    sea.charted += 1;
  }
}

// Gates run a stretch ahead of the hazards, so nothing is dropped on one.
function chartGates(game, upTo) {
  const { level } = game;
  const sea = game.sea;
  while (sea.gateX < upTo) {
    level.checkpoints.push({ x: Math.round(sea.gateX), y: Math.round(sea.gateY), r: GATE_R, index: level.checkpoints.length, reached: false, missed: false, gate: true });
    sea.gateX += sea.rng.range(560, 720);
    sea.gateY = clamp(sea.gateY + sea.rng.range(-280, 280), 220, SEA_HEIGHT - 220);
  }
}

function chartStretch(game, k) {
  const { level, wind } = game;
  const sea = game.sea;
  const rng = createRng(hashString(`open-sea:${game.def.seed}:${k}`));
  const d = difficulty(k);
  const x0 = k * STRETCH;
  const x1 = x0 + STRETCH;
  const lo = Math.max(x0 + 60, START_X + 420);
  if (lo >= x1 - 60) return;
  const gatesNear = (x, pad) => level.checkpoints.filter((c) => Math.abs(c.x - x) < pad);
  const clearOfGates = (x, y, r) => gatesNear(x, r + 200).every((c) => dist(c.x, c.y, x, y) > r + c.r + 70);
  const circles = []; // islands and hazards placed in this stretch
  const roomy = (x, y, r, gap) => circles.every((c) => dist(c.x, c.y, x, y) > c.r + r + gap);
  const spot = (r, gap, margin, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(lo, x1 - 60);
      const y = rng.range(margin + r, SEA_HEIGHT - margin - r);
      if (clearOfGates(x, y, r) && roomy(x, y, r, gap)) return { x, y, r };
    }
    return null;
  };

  // Islands, leaving a channel along both edges of the chart.
  const islands = rng.int(0, 1) + (rng.chance(0.3 + 0.5 * d) ? 1 : 0);
  for (let i = 0; i < islands; i++) {
    const s = spot(rng.range(50, 90 + 30 * d), 140, 130);
    if (!s) continue;
    circles.push(s);
    const pts = blob(s.x, s.y, s.r, (k * 31 + i * 7) % 997, 0.3, 28, [rng.range(0.8, 1.35), rng.range(0.7, 1.05)], rng.range(0, Math.PI));
    const isl = prepareIsland(pts, rng.chance(0.6) ? 'sand' : 'rock', ++sea.serial);
    level.islands.push(isl);
    wind.shadows.push(...shadowSources(isl));
  }
  const reefs = rng.int(0, 1 + Math.round(2 * d));
  for (let i = 0; i < reefs; i++) {
    const s = spot(42, 60, 80);
    if (!s) continue;
    circles.push(s);
    level.rocks.push(...rockField(s.x, s.y, rng.range(26, 44), rng.int(3, 4 + Math.round(2 * d)), (k * 17 + i * 5) % 991).map((r) => ({ material: 'rock', ...r })));
  }
  if (rng.chance(0.15 + 0.2 * d)) {
    const s = spot(rng.range(110, 160), 40, 60);
    if (s) {
      circles.push(s);
      level.calms.push({ x: Math.round(s.x), y: Math.round(s.y), r: Math.round(s.r) });
    }
  }
  if (k >= 2 && rng.chance(0.12 + 0.2 * d)) {
    // A stream running north or south across the course.
    const x = rng.range(lo + 100, x1 - 100);
    level.currents.push(...prepareCurrents([{ x: Math.round(x), y: SEA_HEIGHT / 2, length: SEA_HEIGHT * 1.3, width: Math.round(rng.range(150, 220)), toward: rng.chance(0.5) ? 0 : 180, speed: +rng.range(2, 3.2).toFixed(1) }]));
  }
  if (k >= 3 && rng.chance(0.08 + 0.2 * d)) {
    const s = spot(105, 60, 160);
    if (s) {
      circles.push(s);
      level.whirlpools.push(...prepareWhirlpools([{ x: Math.round(s.x), y: Math.round(s.y), r: 105, strength: 6, spin: rng.chance(0.5) ? 1 : -1 }]));
      if (sea.blackPearlsLeft && sea.gems.chance(0.4) && whirlpoolBlackPearl(level, level.whirlpools[level.whirlpools.length - 1], sea.gems, 'sea-black-pearl')) sea.blackPearlsLeft -= 1;
    }
  }

  // Pearls along the line between gates, jars and crates further off it.
  const gates = level.checkpoints.filter((c) => c.x > x0 - 720 && c.x < x1 + 720);
  const along = (spread) => {
    for (let i = 0; i < 20; i++) {
      const g = rng.int(0, gates.length - 2);
      const a = gates[g];
      const b = gates[g + 1];
      if (!a || !b) return null;
      const t = rng.range(0.2, 0.8);
      const x = Math.round(a.x + (b.x - a.x) * t + rng.range(-40, 40));
      const y = Math.round(a.y + (b.y - a.y) * t + rng.range(-spread, spread));
      if (x < lo || x >= x1 || y < 60 || y > SEA_HEIGHT - 60) continue;
      if (isClear(level, x, y, 18) && circles.every((c) => dist(c.x, c.y, x, y) > c.r + 20)) return { x, y };
    }
    return null;
  };
  const drop = (p, kind) => p && level.pickups.push({ ...p, kind, id: `sea-${++sea.serial}`, taken: false, bob: rng.range(0, 6) });
  for (let i = rng.int(2, 3); i > 0; i--) drop(along(110), 'pearl');
  if (rng.chance(0.35)) drop(along(260), 'gust');
  if (rng.chance(0.2 + 0.15 * d)) drop(along(240), 'repair');

  // Sea life.
  const life = { dolphins: [], whales: [] };
  if (rng.chance(0.3)) {
    const s = spot(140, 0, 160, 10);
    if (s) life.dolphins.push({ x: s.x, y: s.y, r: 140, count: rng.int(3, 5) });
  }
  if (k >= 2 && rng.chance(0.12 + 0.1 * d)) {
    const s = spot(150, 40, 220, 10);
    if (s) life.whales.push({ x: s.x, y: s.y, rx: 150, ry: 80 });
  }
  if (life.dolphins.length || life.whales.length) addSeaLife(game.life, life);
}

// Drop what is far behind the boat so the sea stays small.
function prune(game) {
  const { level, wind, life } = game;
  const cut = game.boat.x - BEHIND;
  const keep = (list, fn) => {
    let j = 0;
    for (const v of list) if (fn(v)) list[j++] = v;
    list.length = j;
  };
  keep(level.islands, (isl) => isl.bounds.maxX > cut);
  keep(wind.shadows, (s) => s.x + s.reach > cut);
  keep(level.rocks, (r) => r.x > cut);
  keep(level.pickups, (p) => !p.taken && p.x > cut);
  keep(level.calms, (c) => c.x + c.r > cut);
  keep(level.currents, (c) => c.x + c.halfW > cut);
  keep(level.whirlpools, (w) => w.x + w.r > cut);
  if (life) {
    keep(life.pods, (p) => p.state !== 'roam' || p.home.x + p.roam > cut);
    keep(life.whales, (w) => w.cx + w.rx > cut);
  }
}

export function updateOpenSea(game, dt) {
  const sea = game.sea;
  const { boat, level } = game;
  sea.best = Math.max(sea.best, boat.x - level.start.x);
  if (sea.charted * STRETCH < boat.x + AHEAD) chartAhead(game);
  if (boat.x - BEHIND > sea.pruned + 400) {
    sea.pruned = boat.x - BEHIND;
    prune(game);
  }

  // A gate left well behind is missed, and its time with it.
  const next = level.checkpoints[game.nextCheckpoint];
  if (next && boat.x > next.x + next.r + MISSED_BY) {
    next.missed = true;
    sea.missed += 1;
    game.nextCheckpoint += 1;
    game.events.push({ type: 'gate', phase: 'missed', x: next.x, y: next.y });
  }

  if (game.wind.eventIndex !== sea.wind) {
    sea.wind = game.wind.eventIndex;
    game.events.push({ type: 'windshift', from: game.wind.baseFrom });
  }

  sea.clock -= dt;
  const left = Math.ceil(sea.clock);
  if (left <= WARN_AT && left < sea.warned && sea.clock > 0) {
    sea.warned = left;
    game.events.push({ type: 'clock', left });
  } else if (left > WARN_AT) {
    sea.warned = Infinity;
  }
  if (sea.clock <= 0) {
    sea.clock = 0;
    endRun(game, 'time');
  }
}

// Through a gate: time for the leg to the next one. Gates skipped on the
// way here count as missed.
export function reachGate(game, gate) {
  const sea = game.sea;
  const { level } = game;
  for (const c of level.checkpoints) {
    if (c.index >= gate.index) break;
    if (!c.reached && !c.missed) {
      c.missed = true;
      sea.missed += 1;
    }
  }
  const after = level.checkpoints[gate.index + 1] || { x: gate.x + 640, y: gate.y };
  const bonus = Math.round(legTime(game, gate, after) * generosity(sea.gates));
  sea.gates += 1;
  sea.clock += bonus;
  return bonus;
}

// A second wind: the run picks up where it ended, with time back on the
// clock and, if she went down, the hull patched and the boat righted.
export function reviveRun(game, seconds) {
  const sea = game.sea;
  const { boat } = game;
  game.status = 'sailing';
  game.result = null;
  game.statusTimer = 0;
  sea.clock = Math.max(0, sea.clock) + seconds;
  sea.warned = Infinity;
  sea.revived += 1;
  game.hull = Math.max(game.hull, 60);
  boat.heel = 0;
  boat.yawRate = 0;
  boat.boostTime = 0;
  game.events.push({ type: 'revive', x: boat.x, y: boat.y });
}

export function endRun(game, reason) {
  const sea = game.sea;
  game.status = 'finished';
  game.result = {
    endless: true,
    reason,
    distance: sea.best,
    gates: sea.gates,
    missed: sea.missed,
    time: game.time,
    stars: 0,
    pearls: game.pearls,
    pearlsTotal: 0,
    hull: game.hull,
    capsizes: game.capsizes,
    collisions: game.collisions,
    hits: { ...game.hits },
    jars: game.jarsUsed,
    jarsLeft: game.gustJars,
    blackPearls: game.blackPearls,
    boat: game.boat.type.id,
    sailed: game.distanceSailed,
    escort: game.escortTime,
    whales: game.closeBreaches,
    chases: 0,
  };
  game.events.push({ type: 'finish', ...game.result });
}
