// Regatta: a race round the marks against three rival boats. A windward
// start, a beat up to mark 1, a reach across to mark 2 and a run back down to
// the harbor. Marks are rounded in order. The rivals sail with the autopilot
// on boats tuned by the fleet's tier, and every boat leaves dirty air
// downwind: sail in another boat's wind shadow and you slow down.

import { angleDiff, clamp, dist, fromBearing, DEG } from '../core/math.js';
import { createRng, hashString } from '../core/rng.js';
import { createBoat, stepBoat, BOAT_TYPES, CAPSIZE_ANGLE } from '../physics/boat.js';
import { blob, rockField } from './shapes.js';
import { sampleWind } from './wind.js';
import { sampleWater } from './water.js';
import { hullContact, bounce, fence } from './contact.js';
import { createAutopilot, autopilotInput, findPath, lineClear } from './autopilot.js';

export const REGATTA = 'regatta';
export const REGATTA_BLURB = 'Three rival boats, three legs: beat up to mark 1, reach across to mark 2, then run for the harbor. Round the marks in order and keep out of the dirty air behind the others.';
const SIZE = [1700, 1100];
const START_X = 1180;
const SLOT = 66; // room between boats on the start line
const MARK_R = 44;
const THINK = 1 / 30; // rivals rethink their helm this often
export const DIRTY_REACH = 150; // a sail's wind shadow runs this far downwind
const DIRTY_LOSS = 0.25; // and takes up to this much of the wind
const GIVE_WAY = 48; // rivals steer clear of a boat this close ahead
const PLACE_HOLD = 1.2; // seconds a new place has to hold before it is called out
const QUIET_START = 12; // the fleet sorts itself out off the line before places are called
// Boats are drawn larger than their hulls (see render/boat.js), so they
// bump at about the size they look.
const BUMP_SCALE = 1.6;
// The racing line: a leg closer to the wind than SAIL_UP (or further off it
// than SAIL_DOWN) is drawn as tacks (or gybes) this far off the wind.
const SAIL_UP = 47 * DEG;
const SAIL_DOWN = 157 * DEG;
const LINE_UP = 50 * DEG;
const LINE_DOWN = 145 * DEG;
const LINE_EDGE = 40; // it keeps this far inside the race area

// The fleet steps up as you win. `power` scales each rival's sail: they
// never misread a shift, so the club boats need a big handicap to be beaten.
export const FLEETS = [
  { id: 'club', name: 'Club', power: [0.5, 0.55, 0.6] },
  { id: 'open', name: 'Open', power: [0.62, 0.67, 0.72] },
  { id: 'championship', name: 'Championship', power: [0.78, 0.83, 0.88] },
];

export function fleetFor(wins) {
  return wins >= 3 ? 2 : wins >= 1 ? 1 : 0;
}

export const RIVALS = [
  { name: 'Petrel', boat: 'sloop', look: { hull: '#eceee8', hullDark: '#8d989c', sail: '#e5484d', sailShade: '#b8363a' } },
  { name: 'Marlin', boat: 'skiff', look: { hull: '#22406f', hullDark: '#1a3256', deck: '#c99a62', sail: '#f5c518', sailShade: '#c99f12' } },
  { name: 'Squall', boat: 'junk', look: { hull: '#2b3a36', hullDark: '#17201d', deck: '#9c8a68', sail: '#3b8fe0', sailShade: '#2c6db0' } },
];

export function ordinal(n) {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
}

export function regattaDef(seed = 1, fleet = 0) {
  const rng = createRng(hashString(`regatta:${seed}`));
  const [W, H] = SIZE;
  const from = 270 + rng.int(-2, 2) * 4;
  const mid = Math.round(H / 2 + rng.range(-40, 40));
  const wing = rng.chance(0.5) ? 1 : -1; // mark 2 lies south (1) or north (-1)
  const marks = [
    { x: Math.round(rng.range(700, 760)), y: Math.round(mid + rng.range(-50, 50)), r: MARK_R, label: '1' },
    { x: Math.round(rng.range(720, 800)), y: Math.round(mid + wing * rng.range(320, 360)), r: MARK_R, label: '2' },
  ];
  // Four boats abreast on the line, close-hauled; you get one of the middle berths.
  const slots = [0, 1, 2, 3].map((i) => ({ x: START_X, y: Math.round(mid + (i - 1.5) * SLOT) }));
  const you = rng.int(1, 2);
  const [player] = slots.splice(you, 1);
  const heading = (from + (rng.chance(0.5) ? 50 : -50) + 360) % 360;
  // An island off the beat on the far side from mark 2, and one upwind of
  // mark 2 whose lee falls across the approach to it.
  const isl1 = { x: rng.range(940, 1060), y: mid - wing * rng.range(330, 380), r: rng.range(55, 72) };
  const isl2 = { x: rng.range(330, 420), y: mid + wing * rng.range(230, 290), r: rng.range(50, 64) };
  const islands = [isl1, isl2].map((s, i) => ({
    pts: blob(Math.round(s.x), Math.round(s.y), Math.round(s.r), (seed * 13 + i * 29) % 997, 0.3, 28, [rng.range(0.85, 1.3), rng.range(0.75, 1)], rng.range(0, Math.PI)),
    kind: rng.chance(0.5) ? 'sand' : 'rock',
  }));
  const rocks = rockField(Math.round(rng.range(1100, 1200)), Math.round(mid + wing * rng.range(240, 290)), 30, 4, (seed * 7) % 991, 5, 9).map((r) => ({ material: 'rock', ...r }));
  return {
    id: REGATTA,
    race: true,
    seed,
    windSeed: `regatta:${seed}`,
    fleet,
    name: 'Regatta',
    blurb: REGATTA_BLURB,
    size: SIZE,
    start: { ...player, heading },
    fleetStart: slots,
    finish: { x: W - 210, y: Math.round(mid - wing * rng.range(40, 110)), r: 52, kind: 'harbor' },
    wind: { from, speed: 16, gust: 0.26, shift: 9, period: 38 },
    islands,
    rocks,
    pickups: [
      { x: Math.round(rng.range(950, 1050)), y: Math.round(mid + wing * rng.range(150, 210)), kind: 'gust' },
      { x: Math.round(rng.range(1150, 1250)), y: Math.round(mid - wing * rng.range(20, 80)), kind: 'gust' },
    ],
    checkpoints: marks,
    par: { gold: 0, silver: 0 },
    tips: [
      { at: 0.5, text: 'Race the fleet round mark 1, then mark 2, then into the harbor. Follow the gold line: upwind it zig-zags, so tack where it turns.' },
      { at: 14, text: 'Every sail leaves dirty air downwind. Keep out of the shadow behind a rival, or it slows you down.' },
    ],
  };
}

export function prepareRace(game) {
  const { def, level } = game;
  const fleet = FLEETS[clamp(def.fleet || 0, 0, FLEETS.length - 1)];
  const rivals = RIVALS.map((r, i) => {
    const base = BOAT_TYPES[r.boat];
    const boat = createBoat(def.fleetStart[i].x, def.fleetStart[i].y, level.start.heading, { ...base, sailPower: base.sailPower * fleet.power[i] });
    boat.trim = boat.trimTarget = 0.45;
    // The autopilot reads the game through this view, with the rival's own
    // boat and next mark in place of the player's.
    const view = Object.create(game);
    Object.assign(view, { boat, nextCheckpoint: 0, gustJars: 0, waterHere: { cx: 0, cy: 0, vortex: 0 } });
    return {
      name: r.name,
      look: { ...base.look, ...r.look },
      boat,
      view,
      ap: null,
      input: { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false },
      think: i * THINK * 0.3,
      next: 0,
      finished: null,
      capsized: 0,
      capsizeTimer: 0,
      capsizes: 0,
      wind: { wx: 0, wy: 0, speed: 0, angle: 0, gust: 0, storm: 0 },
      env: { wx: 0, wy: 0, cx: 0, cy: 0 },
    };
  });
  // One nav grid for the whole fleet; half of them start out on the other tack.
  const first = createAutopilot(rivals[0].view);
  rivals.forEach((r, i) => {
    r.ap = i ? { ...first, grid: first.grid } : first;
    r.ap.tack = i % 2 ? 1 : -1;
  });
  game.race = {
    fleet: fleet.id,
    rivals,
    line: racingLine(game, first.grid),
    order: [],
    place: 0,
    placeTimer: 0,
    time: null, // your finish time
    finishers: 0,
    dirty: 0, // how much of your wind the fleet is taking right now
    early: false,
    bumps: 0,
    bumpWait: 0,
  };
  rank(game, 0);
  return game.race;
}

// The racing line: a course a boat can really sail, from the start round
// mark 1 and mark 2 and into the harbor. One leg per mark, each a list of
// points and the turn it is sailed with ('tack', 'gybe' or none). It is
// worked out from the prevailing wind, so it's a guide, not gospel, once the
// wind shifts.
export function racingLine(game, grid) {
  const { level, boat } = game;
  const windFrom = fromBearing(game.wind.baseFrom);
  const stops = [...level.checkpoints, level.finish];
  let from = { x: boat.x, y: boat.y };
  let heading = boat.heading;
  return stops.map((to) => {
    const leg = legLine(grid, level, from, to, windFrom, heading);
    const [a, b] = leg.pts.slice(-2);
    heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    from = to;
    return leg;
  });
}

function legLine(grid, level, from, to, windFrom, heading) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const twa = Math.abs(angleDiff(Math.atan2(dy, dx), windFrom));
  const clear = (pts) =>
    pts.every(([x, y], i) => {
      if (x < LINE_EDGE || y < LINE_EDGE || x > level.width - LINE_EDGE || y > level.height - LINE_EDGE) return i === pts.length - 1;
      return !i || lineClear(grid, pts[i - 1][0], pts[i - 1][1], x, y);
    });
  const straight = [
    [from.x, from.y],
    [to.x, to.y],
  ];
  if (twa >= SAIL_UP && twa <= SAIL_DOWN && clear(straight)) return { pts: straight, turn: null };
  if (twa < SAIL_UP || twa > SAIL_DOWN) {
    // Split the leg into boards on the two tacks (or gybes): a·u + b·v.
    const off = twa < SAIL_UP ? LINE_UP : LINE_DOWN;
    const dirs = [windFrom + off, windFrom - off].map((h) => [Math.cos(h), Math.sin(h), h]);
    const [u, v] = dirs;
    const det = u[0] * v[1] - u[1] * v[0];
    const len = [(dx * v[1] - dy * v[0]) / det, (u[0] * dy - u[1] * dx) / det];
    if (len[0] >= 0 && len[1] >= 0) {
      // Set out on whichever board needs the smaller turn from the way she's heading.
      const near = Math.abs(angleDiff(u[2], heading)) <= Math.abs(angleDiff(v[2], heading)) ? 0 : 1;
      for (const n of [2, 1, 3, 4]) {
        for (const first of [near, 1 - near]) {
          const pts = [[from.x, from.y]];
          for (let i = 0; i < n * 2; i++) {
            const k = i % 2 ? 1 - first : first;
            const [px, py] = pts[pts.length - 1];
            pts.push([px + dirs[k][0] * (len[k] / n), py + dirs[k][1] * (len[k] / n)]);
          }
          pts[pts.length - 1] = [to.x, to.y];
          if (clear(pts)) return { pts, turn: twa < SAIL_UP ? 'tack' : 'gybe' };
        }
      }
    }
  }
  // Something is in the way: round it on the planner's path, pulled taut.
  const path = findPath(grid, from.x, from.y, to.x, to.y, windFrom);
  if (!path) return { pts: straight, turn: null };
  const pts = [path[0]];
  for (let i = 0; i < path.length - 1; ) {
    let j = path.length - 1;
    while (j > i + 1 && !lineClear(grid, path[i][0], path[i][1], path[j][0], path[j][1])) j--;
    pts.push(path[j]);
    i = j;
  }
  pts[0] = [from.x, from.y];
  return { pts, turn: null };
}

export function updateRace(game, dt) {
  const race = game.race;
  for (const r of race.rivals) sailRival(game, r, dt);
  bumpBoats(game, dt);
  if (game.status !== 'finished') rank(game, dt);
}

function sailRival(game, r, dt) {
  const { level } = game;
  const { boat, env } = r;
  const w = sampleWind(game.wind, boat.x, boat.y, r.wind);
  shadeWind(game, boat, w);
  const water = sampleWater(level, boat.x, boat.y, r.view.waterHere);
  env.wx = w.wx;
  env.wy = w.wy;
  env.cx = water.cx;
  env.cy = water.cy;
  if (r.finished !== null || r.capsized > 0) {
    // Coast to a stop in the harbor, or lie flat on the water for a moment.
    const drag = r.finished !== null ? 1.5 : 2.5;
    boat.vx = boat.vx * (1 - dt * drag) + water.cx * dt * drag;
    boat.vy = boat.vy * (1 - dt * drag) + water.cy * dt * drag;
    boat.x += boat.vx * dt;
    boat.y += boat.vy * dt;
    if (r.capsized > 0) {
      r.capsized -= dt;
      boat.heel = Math.sign(boat.heel || 1) * Math.min(Math.PI / 2, Math.abs(boat.heel) + dt * 3);
      if (r.capsized <= 0) {
        boat.heel = 0;
        boat.trim = boat.trimTarget = 1;
        boat.yawRate = 0;
      }
    }
  } else {
    r.think -= dt;
    if (r.think <= 0) {
      r.input = autopilotInput(r.ap, r.view, THINK);
      r.input.boost = false;
      r.input.steer = clamp(r.input.steer + giveWay(game, boat), -1, 1);
      r.think += THINK;
    }
    stepBoat(boat, r.input, env, dt);
    if (Math.abs(boat.heel) > CAPSIZE_ANGLE) {
      r.capsizeTimer += dt;
      if (r.capsizeTimer > 0.35) {
        r.capsized = 2.6;
        r.capsizeTimer = 0;
        r.capsizes += 1;
      }
    } else {
      r.capsizeTimer = Math.max(0, r.capsizeTimer - dt);
    }
    const goal = level.checkpoints[r.next];
    if (goal && dist(boat.x, boat.y, goal.x, goal.y) < goal.r) {
      r.next += 1;
      r.view.nextCheckpoint = r.next;
    } else if (!goal && dist(boat.x, boat.y, level.finish.x, level.finish.y) < level.finish.r) {
      r.finished = game.clock; // the same as game.time until you finish
      game.race.finishers += 1;
      game.events.push({ type: 'rival', phase: 'finish', name: r.name, place: game.race.finishers });
    }
  }
  const hit = hullContact(level, boat);
  if (hit) bounce(boat, hit);
  fence(boat, level, dt);
}

// A rival steers clear of any boat close under its bow. Returns a nudge to
// add to the helm.
export function giveWay(game, boat) {
  const fx = Math.cos(boat.heading);
  const fy = Math.sin(boat.heading);
  let nudge = 0;
  const avoid = (b) => {
    if (b === boat) return;
    const rx = b.x - boat.x;
    const ry = b.y - boat.y;
    const ahead = rx * fx + ry * fy;
    if (ahead < -8 || ahead > GIVE_WAY) return;
    const side = rx * -fy + ry * fx; // starboard positive
    if (Math.abs(side) > 22) return;
    const k = (1 - Math.max(0, ahead) / GIVE_WAY) * (1 - Math.abs(side) / 22);
    nudge += (side >= 0 ? -1 : 1) * 1.4 * k;
  };
  if (game.status !== 'finished') avoid(game.boat);
  for (const r of game.race.rivals) if (r.finished === null) avoid(r.boat);
  return nudge;
}

// Every other sail's wind shadow at (x, y): 0 in clean air, toward 1 right
// in the lee of one. A shadow runs downwind and spreads as it goes.
export function dirtyAirAt(game, x, y, self = null) {
  const dx = Math.cos(game.wind.angle);
  const dy = Math.sin(game.wind.angle);
  let shade = 0;
  const cast = (b) => {
    if (b === self) return;
    const rx = x - b.x;
    const ry = y - b.y;
    const along = rx * dx + ry * dy;
    if (along < 6 || along > DIRTY_REACH) return;
    const across = Math.abs(rx * dy - ry * dx);
    const width = shadowWidth(along);
    if (across > width) return;
    shade = Math.max(shade, (1 - along / DIRTY_REACH) * (1 - (across / width) ** 2));
  };
  if (game.status === 'sailing') cast(game.boat);
  for (const r of game.race.rivals) if (r.finished === null && r.capsized <= 0) cast(r.boat);
  return shade;
}

// Half the width of a wind shadow this far downwind of the sail.
export function shadowWidth(along) {
  return 12 + along * 0.2;
}

// Take the fleet's dirty air out of a wind sample. Returns the shade.
export function shadeWind(game, boat, w) {
  const shade = dirtyAirAt(game, boat.x, boat.y, boat);
  if (shade > 0) {
    const k = 1 - DIRTY_LOSS * shade;
    w.wx *= k;
    w.wy *= k;
    w.speed *= k;
  }
  return shade;
}

// The bow, middle and stern circles at about the size the boat is drawn.
function bumpCircles(boat) {
  const L = boat.type.length * BUMP_SCALE;
  const r = boat.type.beam * 0.5 * BUMP_SCALE;
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  return [
    [boat.x + c * L * 0.32, boat.y + s * L * 0.32, r * 0.8],
    [boat.x, boat.y, r],
    [boat.x - c * L * 0.32, boat.y - s * L * 0.32, r * 0.9],
  ];
}

// Boats that touch push apart and trade a little speed. No harm done, but
// it costs you the way you had on.
function bumpBoats(game, dt) {
  const race = game.race;
  race.bumpWait = Math.max(0, race.bumpWait - dt);
  const boats = [game.boat, ...race.rivals.map((r) => r.boat)];
  for (let i = 0; i < boats.length; i++) {
    for (let j = i + 1; j < boats.length; j++) {
      const a = boats[i];
      const b = boats[j];
      if (Math.abs(a.x - b.x) > 40 || Math.abs(a.y - b.y) > 40) continue;
      let hit = null;
      for (const [ax, ay, ar] of bumpCircles(a)) {
        for (const [bx, by, br] of bumpCircles(b)) {
          const d = Math.hypot(ax - bx, ay - by);
          const depth = ar + br - d;
          if (depth > 0 && (!hit || depth > hit.depth)) hit = { nx: (ax - bx) / (d || 1), ny: (ay - by) / (d || 1), depth };
        }
      }
      if (!hit) continue;
      a.x += (hit.nx * hit.depth) / 2;
      a.y += (hit.ny * hit.depth) / 2;
      b.x -= (hit.nx * hit.depth) / 2;
      b.y -= (hit.ny * hit.depth) / 2;
      const vn = (a.vx - b.vx) * hit.nx + (a.vy - b.vy) * hit.ny;
      if (vn >= 0) continue;
      const push = (-1.3 * vn) / 2;
      a.vx += push * hit.nx;
      a.vy += push * hit.ny;
      b.vx -= push * hit.nx;
      b.vy -= push * hit.ny;
      if (i === 0 && -vn > 1.5 && race.bumpWait <= 0) {
        race.bumpWait = 0.6;
        race.bumps += 1;
        game.events.push({ type: 'bump', impact: -vn, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
}

// Order of the fleet: boats home by finish time, then by marks rounded, then
// by how close they are to the next one.
export function standings(game) {
  const { race, level } = game;
  const entries = [
    { name: 'You', player: true, boat: game.boat, next: game.nextCheckpoint, time: race.time },
    ...race.rivals.map((r) => ({ name: r.name, rival: r, boat: r.boat, next: r.next, time: r.finished })),
  ];
  for (const e of entries) {
    const goal = level.checkpoints[e.next] || level.finish;
    e.score = e.time !== null ? 1e9 - e.time : e.next * 1e5 - dist(e.boat.x, e.boat.y, goal.x, goal.y);
  }
  return entries.sort((a, b) => b.score - a.score);
}

// Keep the standings and call out a change of place once it has held.
function rank(game, dt) {
  const race = game.race;
  race.order = standings(game);
  const place = race.order.findIndex((e) => e.player) + 1;
  if (!race.place || game.time < QUIET_START) {
    race.place = place;
    return;
  }
  if (place === race.place) {
    race.placeTimer = 0;
    return;
  }
  race.placeTimer += dt;
  if (race.placeTimer < PLACE_HOLD) return;
  const gained = place < race.place;
  // The boat you just passed, or the one that just passed you.
  const other = race.order[gained ? place : place - 2];
  game.events.push({ type: 'place', place, gained, name: other ? other.name : '' });
  race.place = place;
  race.placeTimer = 0;
}

// Your result when you cross the line: your place and the fleet behind you.
export function finishRace(game) {
  const race = game.race;
  race.time = game.time;
  race.finishers += 1;
  race.order = standings(game);
  const place = race.order.findIndex((e) => e.player) + 1;
  race.place = place;
  const marks = game.level.checkpoints.length;
  return {
    race: true,
    place,
    field: race.order.length,
    fleet: race.fleet,
    bumps: race.bumps,
    stars: place === 1 ? 3 : place === 2 ? 2 : 1,
    standings: race.order.map((e) => ({ name: e.name, player: !!e.player, time: e.time, marks: Math.min(e.next, marks) })),
  };
}
