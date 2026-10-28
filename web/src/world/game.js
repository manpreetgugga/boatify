// The voyage simulation: boat, wind, water, hazards, pickups and scoring.
// No DOM access here, so it runs headless in tests and in the autopilot.

import { clamp, dist, wrapAngle, angleDiff } from '../core/math.js';
import { hashString } from '../core/rng.js';
import { createBoat, stepBoat, hullCircles, boatSpeed, CAPSIZE_ANGLE, HEEL_WARNING, BOOST_DURATION } from '../physics/boat.js';
import { buildLevel, pearlCount } from './level.js';
import { createWind, updateWind, sampleWind } from './wind.js';
import { sampleWater } from './water.js';
import { circlePolygon, circleCircle } from './collision.js';

export const STEP = 1 / 120;
const MAX_STEPS = 12;
const DAMAGE = { sand: 0.9, rock: 2.6, coral: 1.8, ice: 2.2 };

export function createGame(def, options = {}) {
  const level = buildLevel(def);
  const seed = hashString(def.id) ^ (options.seed || 0);
  const wind = createWind(def.wind, seed, level.islands, { calms: level.calms, storms: level.storms });
  const boat = createBoat(level.start.x, level.start.y, level.start.heading);
  boat.trim = boat.trimTarget = 0.45;
  const game = {
    def,
    level,
    wind,
    boat,
    seed,
    time: 0,
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
  };
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
  if (game.status === 'finished') {
    // Coast to a stop inside the harbor.
    boat.vx *= 1 - dt * 1.5;
    boat.vy *= 1 - dt * 1.5;
    boat.x += boat.vx * dt;
    boat.y += boat.vy * dt;
    updateWind(wind, dt);
    return;
  }

  game.time += dt;
  updateWind(wind, dt);
  updateKrakens(game);
  updateWeather(game, dt);

  const w = sampleWind(wind, boat.x, boat.y, game.windHere);
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
      } else {
        respawn(game);
      }
    }
    resolveCollisions(game, true);
    return;
  }

  if (input.boost && game.gustJars > 0 && boat.boostTime <= 0) {
    game.gustJars -= 1;
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
  keepInBounds(game, dt);
  checkPickups(game);
  checkCheckpoints(game);
  checkTips(game);

  if (game.hull <= 0) {
    game.status = 'sinking';
    game.statusTimer = 2.4;
    emit(game, 'sink');
  }

  const f = level.finish;
  if (dist(boat.x, boat.y, f.x, f.y) < f.r) finish(game);
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
  if (amount <= 0) return;
  game.hull = Math.max(0, game.hull - amount);
  if (amount >= 2) emit(game, 'damage', { amount, cause });
}

function resolveCollisions(game, passive) {
  const { boat, level } = game;
  const circles = hullCircles(boat);
  let hit = null;
  for (const c of circles) {
    for (const isl of level.islands) {
      const contact = circlePolygon(c.x, c.y, c.r, isl);
      if (contact && (!hit || contact.depth > hit.depth)) hit = contact;
    }
    for (const rock of level.rocks) {
      const dx = c.x - rock.x;
      const dy = c.y - rock.y;
      const rr = c.r + rock.r;
      if (dx * dx + dy * dy >= rr * rr) continue;
      const contact = circleCircle(c.x, c.y, c.r, rock);
      if (contact && (!hit || contact.depth > hit.depth)) hit = contact;
    }
  }
  if (!hit) return;
  boat.x += hit.nx * hit.depth;
  boat.y += hit.ny * hit.depth;
  const vn = boat.vx * hit.nx + boat.vy * hit.ny;
  if (vn < 0) {
    const restitution = 0.25;
    boat.vx -= (1 + restitution) * vn * hit.nx;
    boat.vy -= (1 + restitution) * vn * hit.ny;
    boat.vx *= 0.82;
    boat.vy *= 0.82;
    const impact = -vn;
    if (!passive && impact > 2.5) {
      const amount = (impact - 2.5) * (DAMAGE[hit.material] || 2);
      damage(game, amount, hit.material);
      game.collisions += 1;
      emit(game, 'collide', { impact, material: hit.material, x: boat.x - hit.nx * 6, y: boat.y - hit.ny * 6 });
      // Glancing blows twist the bow away from the obstacle.
      const fwdX = Math.cos(boat.heading);
      const fwdY = Math.sin(boat.heading);
      const cross = fwdX * hit.ny - fwdY * hit.nx;
      boat.yawRate += clamp(cross * impact * 0.08, -1.2, 1.2);
    }
  }
}

function keepInBounds(game, dt) {
  const { boat, level } = game;
  const m = 24;
  const k = 6;
  if (boat.x < m) boat.vx += (m - boat.x) * k * dt;
  if (boat.y < m) boat.vy += (m - boat.y) * k * dt;
  if (boat.x > level.width - m) boat.vx -= (boat.x - (level.width - m)) * k * dt;
  if (boat.y > level.height - m) boat.vy -= (boat.y - (level.height - m)) * k * dt;
  boat.x = clamp(boat.x, 0, level.width);
  boat.y = clamp(boat.y, 0, level.height);
}

function checkPickups(game) {
  const { boat, level } = game;
  for (const p of level.pickups) {
    if (p.taken) continue;
    if (dist(boat.x, boat.y, p.x, p.y) > 16) continue;
    p.taken = true;
    if (p.kind === 'pearl') game.pearls += 1;
    else if (p.kind === 'gust') game.gustJars = Math.min(3, game.gustJars + 1);
    else if (p.kind === 'repair') game.hull = Math.min(100, game.hull + 35);
    else if (p.kind === 'bottle') game.notes.push(p.note);
    emit(game, 'pickup', { kind: p.kind, x: p.x, y: p.y, note: p.note });
  }
}

function checkCheckpoints(game) {
  const { boat, level } = game;
  for (const c of level.checkpoints) {
    if (c.reached) continue;
    if (dist(boat.x, boat.y, c.x, c.y) > c.r) continue;
    c.reached = true;
    game.nextCheckpoint = Math.max(game.nextCheckpoint, c.index + 1);
    game.respawn = { x: c.x, y: c.y, heading: boat.heading };
    emit(game, 'checkpoint', { index: c.index });
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
    distance: game.distanceSailed,
  };
  emit(game, 'finish', { ...game.result });
}

// Helpers the HUD, autopilot and audio share.
export function distanceToFinish(game) {
  const { boat, level } = game;
  return dist(boat.x, boat.y, level.finish.x, level.finish.y);
}

export function bearingToFinish(game) {
  const { boat, level } = game;
  return Math.atan2(level.finish.y - boat.y, level.finish.x - boat.x);
}

// Velocity made good toward the finish (units/s).
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
