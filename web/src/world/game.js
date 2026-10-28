// The voyage simulation: boat, wind, water, hazards, pickups and scoring.
// No DOM access here, so it runs headless in tests and in the autopilot.

import { clamp, dist, wrapAngle, angleDiff } from '../core/math.js';
import { hashString } from '../core/rng.js';
import { createBoat, stepBoat, boatSpeed, CAPSIZE_ANGLE, HEEL_WARNING, BOOST_DURATION, BOAT_TYPES } from '../physics/boat.js';
import { buildLevel, pearlCount, courseGoal } from './level.js';
import { createWind, updateWind, sampleWind } from './wind.js';
import { sampleWater } from './water.js';
import { hullContact, bounce, fence } from './contact.js';
import { moveFloes } from './floes.js';
import { prepareWildlife, updateWildlife } from './wildlife.js';
import { preparePirates, updatePirates } from './pirates.js';
import { prepareOpenSea, updateOpenSea, reachGate, endRun, PEARL_TIME } from './opensea.js';
import { prepareRace, updateRace, shadeWind, finishRace } from './regatta.js';

export const STEP = 1 / 120;
const MAX_STEPS = 12;
const DAMAGE = { sand: 0.9, rock: 2.6, coral: 1.8, ice: 2.2 };

export function createGame(def, options = {}) {
  const level = buildLevel(def);
  // A course charted from a seed (a regatta) gets its own gusts and shifts too.
  const seed = hashString(def.windSeed || def.id) ^ (options.seed || 0);
  const wind = createWind(def.wind, seed, level.islands, { calms: level.calms, storms: level.storms });
  const boat = createBoat(level.start.x, level.start.y, level.start.heading, BOAT_TYPES[options.boat] || BOAT_TYPES.sloop);
  boat.trim = boat.trimTarget = 0.45;
  const game = {
    def,
    level,
    wind,
    boat,
    seed,
    time: 0,
    clock: 0, // like time, but keeps running after the finish
    status: 'sailing',
    statusTimer: 0,
    hull: 100,
    pearls: 0,
    pearlsTotal: pearlCount(level),
    notes: [],
    gustJars: options.startJars || 0,
    penalties: 0,
    capsizes: 0,
    collisions: 0,
    hits: {}, // knocks taken, by what did the knocking
    jarsUsed: 0,
    respawn: { ...level.start },
    nextCheckpoint: 0,
    capsizeTimer: 0,
    heelWarned: false,
    tipsShown: new Set(),
    events: [],
    windHere: { wx: 0, wy: 0, speed: 0, angle: 0, gust: 0, storm: 0 },
    waterHere: { cx: 0, cy: 0, vortex: 0 },
    lastSide: 0,
    result: null,
    acc: 0,
    distanceSailed: 0,
    lightningTimer: 3 + (seed % 5),
    flash: 0,
    life: prepareWildlife(def, seed),
    pirates: preparePirates(def, seed, level),
    escortTime: 0, // seconds spent riding a dolphin pod's bow wave
    closeBreaches: 0, // whale breaches seen up close
    chases: 0, // times a pirate ship came after you
    sea: null, // the endless open sea's clock and gates
    race: null, // the regatta fleet and standings
  };
  if (def.endless) prepareOpenSea(game);
  if (def.race) prepareRace(game);
  return game;
}

function emit(game, type, data = {}) {
  game.events.push({ type, ...data });
}

// Advance the simulation by a frame's worth of time with fixed sub-steps.
export function stepGame(game, input, frameDt) {
  game.acc = Math.min(game.acc + frameDt, STEP * MAX_STEPS);
  while (game.acc >= STEP) {
    game.acc -= STEP;
    tick(game, input, STEP);
    input.boost = false;
  }
}

function tick(game, input, dt) {
  const { boat, level, wind } = game;
  game.clock += dt;
  if (level.floes.length) moveFloes(level, game.clock);
  if (game.status === 'finished') {
    // Coast to a stop inside the harbor.
    boat.vx *= 1 - dt * 1.5;
    boat.vy *= 1 - dt * 1.5;
    boat.x += boat.vx * dt;
    boat.y += boat.vy * dt;
    updateWind(wind, dt);
    updateWildlife(game, dt);
    updatePirates(game, dt);
    if (game.race) updateRace(game, dt);
    return;
  }

  game.time += dt;
  if (game.sea) {
    updateOpenSea(game, dt);
    if (game.status === 'finished') return;
  }
  updateWind(wind, dt);
  updateKrakens(game);
  updateWildlife(game, dt);
  updatePirates(game, dt);
  updateWeather(game, dt);
  if (game.race) updateRace(game, dt);

  const w = sampleWind(wind, boat.x, boat.y, game.windHere);
  if (game.race) game.race.dirty = shadeWind(game, boat, w);
  const water = sampleWater(level, boat.x, boat.y, game.waterHere);
  const env = { wx: w.wx, wy: w.wy, cx: water.cx, cy: water.cy };

  if (game.status === 'capsized' || game.status === 'sinking') {
    game.statusTimer -= dt;
    boat.vx = boat.vx * (1 - dt * 2.5) + water.cx * dt * 2.5;
    boat.vy = boat.vy * (1 - dt * 2.5) + water.cy * dt * 2.5;
    boat.x += boat.vx * dt;
    boat.y += boat.vy * dt;
    boat.heel = game.status === 'capsized' ? Math.sign(boat.heel || 1) * Math.min(Math.PI / 2, Math.abs(boat.heel) + dt * 3) : boat.heel;
    if (game.statusTimer <= 0) {
      if (game.status === 'capsized') {
        game.status = 'sailing';
        boat.heel = 0;
        boat.trim = boat.trimTarget = 1;
        boat.yawRate = 0;
        emit(game, 'righted');
      } else if (game.sea) {
        endRun(game, 'sunk'); // no last buoy to go back to out here
      } else {
        respawn(game);
      }
    }
    resolveCollisions(game, true);
    return;
  }

  if (input.boost && game.gustJars > 0 && boat.boostTime <= 0) {
    game.gustJars -= 1;
    game.jarsUsed += 1;
    boat.boostTime = BOOST_DURATION;
    emit(game, 'boost');
  }

  const px = boat.x;
  const py = boat.y;
  stepBoat(boat, input, env, dt);
  game.distanceSailed += dist(px, py, boat.x, boat.y);

  // Tacks and gybes: the wind crosses the bow or the stern.
  if (game.lastSide && boat.side !== game.lastSide && boat.apparentSpeed > 3) {
    emit(game, boat.beta > Math.PI / 2 ? 'gybe' : 'tack', { strength: boat.apparentSpeed });
    if (boat.beta > Math.PI / 2 && boat.apparentSpeed > 20) boat.heel += 0.35 * boat.side;
  }
  game.lastSide = boat.side;

  // Heel and capsize.
  const heel = Math.abs(boat.heel);
  if (heel > HEEL_WARNING && !game.heelWarned) {
    game.heelWarned = true;
    emit(game, 'heelWarning');
  } else if (heel < HEEL_WARNING * 0.8) {
    game.heelWarned = false;
  }
  if (heel > CAPSIZE_ANGLE) {
    game.capsizeTimer += dt;
    if (game.capsizeTimer > 0.35) capsize(game);
  } else {
    game.capsizeTimer = Math.max(0, game.capsizeTimer - dt);
  }

  // Whirlpool eye.
  for (const wp of level.whirlpools) {
    const d = dist(boat.x, boat.y, wp.x, wp.y);
    if (d < wp.core + 6) {
      damage(game, 14 * dt, 'whirlpool');
      boat.yawRate += wp.spin * 3 * dt;
    }
  }

  resolveCollisions(game, false);
  fence(boat, level, dt);
  checkPickups(game);
  checkCheckpoints(game);
  checkTips(game);

  if (game.hull <= 0) {
    game.status = 'sinking';
    game.statusTimer = 2.4;
    emit(game, 'sink');
  }

  const f = level.finish;
  const toFinish = dist(boat.x, boat.y, f.x, f.y);
  if (toFinish < f.r) {
    // A race only finishes once every mark is rounded.
    if (!game.race || game.nextCheckpoint >= level.checkpoints.length) finish(game);
    else if (!game.race.early) {
      game.race.early = true;
      emit(game, 'early', { mark: game.nextCheckpoint });
    }
  } else if (game.race && toFinish > f.r + 60) {
    game.race.early = false;
  }
}

function capsize(game) {
  const { boat } = game;
  game.status = 'capsized';
  game.statusTimer = 2.6;
  game.capsizeTimer = 0;
  game.capsizes += 1;
  boat.boostTime = 0;
  damage(game, 8, 'capsize');
  emit(game, 'capsize');
}

function respawn(game) {
  const { boat, level } = game;
  const r = game.respawn;
  boat.x = r.x;
  boat.y = r.y;
  boat.vx = 0;
  boat.vy = 0;
  boat.yawRate = 0;
  boat.heel = 0;
  boat.boostTime = 0;
  // Point toward the next checkpoint or the finish.
  const next = level.checkpoints[game.nextCheckpoint] || level.finish;
  boat.heading = Math.atan2(next.y - r.y, next.x - r.x);
  game.hull = 60;
  game.status = 'sailing';
  emit(game, 'respawn');
}

function damage(game, amount, cause) {
  amount /= game.boat.type.toughness;
  if (amount <= 0) return;
  game.hull = Math.max(0, game.hull - amount);
  if (amount >= 2) emit(game, 'damage', { amount, cause });
}

function resolveCollisions(game, passive) {
  const { boat } = game;
  const hit = hullContact(game.level, boat);
  if (!hit) return;
  const impact = bounce(boat, hit);
  if (!passive && impact > 2.5) {
    const amount = (impact - 2.5) * (DAMAGE[hit.material] || 2);
    damage(game, amount, hit.material);
    game.collisions += 1;
    game.hits[hit.material] = (game.hits[hit.material] || 0) + 1;
    emit(game, 'collide', { impact, material: hit.material, x: boat.x - hit.nx * 6, y: boat.y - hit.ny * 6 });
    // Glancing blows twist the bow away from the obstacle.
    const fwdX = Math.cos(boat.heading);
    const fwdY = Math.sin(boat.heading);
    const cross = fwdX * hit.ny - fwdY * hit.nx;
    boat.yawRate += clamp(cross * impact * 0.08, -1.2, 1.2);
  }
}

function checkPickups(game) {
  const { boat, level } = game;
  for (const p of level.pickups) {
    if (p.taken) continue;
    if (dist(boat.x, boat.y, p.x, p.y) > 16) continue;
    p.taken = true;
    let bonus = 0;
    if (p.kind === 'pearl') {
      game.pearls += 1;
      if (game.sea) {
        bonus = PEARL_TIME;
        game.sea.clock += bonus;
      }
    } else if (p.kind === 'gust') game.gustJars = Math.min(3, game.gustJars + 1);
    else if (p.kind === 'repair') game.hull = Math.min(100, game.hull + 35);
    else if (p.kind === 'bottle') game.notes.push(p.note);
    emit(game, 'pickup', { kind: p.kind, x: p.x, y: p.y, note: p.note, bonus });
  }
}

function checkCheckpoints(game) {
  const { boat, level } = game;
  for (const c of level.checkpoints) {
    if (c.reached || c.missed) continue;
    if (game.sea && c.x > boat.x + c.r) break; // gates ahead are in order
    if (level.race && c.index !== game.nextCheckpoint) break; // marks are rounded in order
    if (dist(boat.x, boat.y, c.x, c.y) > c.r) continue;
    c.reached = true;
    game.nextCheckpoint = Math.max(game.nextCheckpoint, c.index + 1);
    game.respawn = { x: c.x, y: c.y, heading: boat.heading };
    emit(game, 'checkpoint', { index: c.index, bonus: game.sea ? reachGate(game, c) : 0 });
  }
}

function checkTips(game) {
  const { boat, level } = game;
  level.tips.forEach((tip, i) => {
    if (game.tipsShown.has(i)) return;
    let show = false;
    if (tip.at !== undefined && game.time >= tip.at) show = true;
    if (tip.near && dist(boat.x, boat.y, tip.near[0], tip.near[1]) < tip.near[2]) show = true;
    if (show) {
      game.tipsShown.add(i);
      emit(game, 'tip', { text: tip.text });
    }
  });
}

function updateKrakens(game) {
  const { boat, level } = game;
  for (const k of level.krakens) {
    const cycle = (game.time + k.offset) % k.period;
    const strikeAt = k.period - 1.6;
    const warnAt = strikeAt - 1.8;
    const prev = k.phase;
    k.phase = cycle >= strikeAt ? 'strike' : cycle >= warnAt ? 'warning' : 'idle';
    k.phaseTime = k.phase === 'strike' ? cycle - strikeAt : k.phase === 'warning' ? cycle - warnAt : cycle;
    if (k.phase !== prev) {
      k.hit = false;
      if (k.phase !== 'idle' && dist(boat.x, boat.y, k.x, k.y) < 450) emit(game, 'kraken', { phase: k.phase, x: k.x, y: k.y });
    }
    if (k.phase === 'strike' && !k.hit && game.status === 'sailing') {
      const d = dist(boat.x, boat.y, k.x, k.y);
      if (d < k.r) {
        k.hit = true;
        damage(game, 24, 'kraken');
        game.hits.kraken = (game.hits.kraken || 0) + 1;
        const nx = (boat.x - k.x) / (d || 1);
        const ny = (boat.y - k.y) / (d || 1);
        boat.vx += nx * 14;
        boat.vy += ny * 14;
        boat.yawRate += 2.5;
        emit(game, 'collide', { impact: 12, material: 'kraken', x: boat.x, y: boat.y });
      }
    }
  }
}

function updateWeather(game, dt) {
  const weather = game.level.weather;
  game.flash = Math.max(0, game.flash - dt * 2.5);
  if (!weather.lightning) return;
  game.lightningTimer -= dt;
  if (game.lightningTimer <= 0) {
    game.lightningTimer = 4 + ((game.time * 7919) % 7);
    game.flash = 1;
    emit(game, 'lightning');
  }
}

function finish(game) {
  const { level } = game;
  game.status = 'finished';
  const time = game.time + game.penalties;
  let stars = 1;
  if (time <= level.par.silver) stars = 2;
  if (time <= level.par.gold) stars = 3;
  game.result = {
    time,
    stars,
    pearls: game.pearls,
    pearlsTotal: game.pearlsTotal,
    hull: game.hull,
    capsizes: game.capsizes,
    collisions: game.collisions,
    hits: { ...game.hits },
    jars: game.jarsUsed,
    boat: game.boat.type.id,
    distance: game.distanceSailed,
    escort: game.escortTime,
    whales: game.closeBreaches,
    chases: game.chases,
  };
  if (game.race) Object.assign(game.result, finishRace(game));
  emit(game, 'finish', { ...game.result });
}

// Helpers the HUD, autopilot and audio share. On the open sea "the finish"
// is the next gate, and in a regatta the next mark.
export function distanceToFinish(game) {
  const { boat } = game;
  const f = courseGoal(game);
  return dist(boat.x, boat.y, f.x, f.y);
}

export function bearingToFinish(game) {
  const { boat } = game;
  const f = courseGoal(game);
  return Math.atan2(f.y - boat.y, f.x - boat.x);
}

// Velocity made good toward the finish or the next gate (units/s).
export function vmgToFinish(game) {
  const { boat } = game;
  const a = bearingToFinish(game);
  return boat.vx * Math.cos(a) + boat.vy * Math.sin(a);
}

export function relativeWindAngle(game) {
  // Signed angle between the bow and where the true wind comes from.
  const from = wrapAngle(game.windHere.angle + Math.PI);
  return angleDiff(game.boat.heading, from);
}

export function speedOf(game) {
  return boatSpeed(game.boat);
}

export function drainEvents(game) {
  const ev = game.events;
  game.events = [];
  return ev;
}
