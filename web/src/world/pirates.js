// Pirates. A square-rigged brig lurks off the route. Once it spots you it
// gives chase: square sails make it fast downwind, but it can't sail within
// about seventy degrees of the wind and is slow on a beam reach. So the way to
// lose it is to keep the wind on your beam, get upwind of it, or slip through
// a reef gap too tight for its hull. In range it fires broadsides; each
// shot's landing spot is marked on the water so you can dodge.

import { angleDiff, clamp, closestOnSegment, dist, fromBearing, wrapAngle, DEG } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { isClear } from './collision.js';
import { sampleWind } from './wind.js';
import { createNavGrid, findPath, lineClear } from './autopilot.js';

export const PIRATE = {
  length: 34,
  beam: 12,
  draught: 21, // keeps this far off rocks and shore: it can't follow you through a narrow gap
  noGo: 72 * DEG, // can't point closer to the wind than this
  speed: 0.9, // fraction of the polar it manages (a heavy, foul-bottomed ship)
  turn: 0.42, // radians per second
  spot: 400, // sights you inside this range
  giveUp: 520, // loses interest beyond this range...
  giveUpTime: 4, // ...after this long
  harbor: 260, // won't follow you this close to the harbour's guns
  range: 175, // broadside range
  chaser: 150, // bow gun range
  flight: 1.5, // seconds a cannonball is in the air
  scatter: 18,
  hit: 9, // a ball landing this close hits the boat
  damage: 14,
  ram: 8,
  reload: [2.8, 4],
  chaserReload: [4.5, 5.5],
};

// Speed as a fraction of the wind by true wind angle (10 degree steps).
const POLAR = [0, 0, 0, 0, 0, 0, 0, 0.15, 0.42, 0.62, 0.8, 0.94, 1.04, 1.1, 1.14, 1.15, 1.15, 1.15, 1.15];
const NAV_CLEARANCE = 24;
const LOOK = 170;
const BEAT_VMG = 0.07;
const BROADSIDE = 42 * DEG;
const BOW = 28 * DEG;

export function pirateSpeed(twa) {
  const deg = clamp(Math.abs(twa) / DEG, 0, 180);
  const i = Math.min(17, Math.floor(deg / 10));
  const f = deg / 10 - i;
  return POLAR[i] + (POLAR[i + 1] - POLAR[i]) * f;
}

// For route planning: beating to windward is all but hopeless for a square-rigger.
function plannedSpeed(twa) {
  let v = pirateSpeed(twa);
  const c = Math.cos(twa);
  if (c > 0.05) v = Math.max(v, BEAT_VMG / c);
  return Math.max(v, 0.02);
}

export function preparePirates(def, seed, level) {
  const rng = createRng(seed ^ 0x9172e5);
  const ships = (def.pirates || []).map((p) => ({
    home: { x: p.x, y: p.y },
    x: p.x,
    y: p.y,
    heading: fromBearing(p.heading || 0),
    speed: 0,
    spot: p.spot || PIRATE.spot,
    state: 'lurk', // lurk -> chase -> home -> lurk
    far: 0,
    cooldown: 0,
    reload: 2,
    ramWait: 0,
    tack: 1,
    tackTime: 0,
    path: null,
    replan: 0,
    shots: 0,
    flash: 0,
    flashSide: 1,
  }));
  // Charted up front: building it mid-chase would stall a frame on a phone.
  const grid = ships.length ? createNavGrid(level, null, NAV_CLEARANCE) : null;
  return { ships, balls: [], grid, rng, wind: {} };
}

export function updatePirates(game, dt) {
  const pir = game.pirates;
  if (!pir || !pir.ships.length) return;
  for (const ship of pir.ships) updateShip(game, pir, ship, dt);
  updateBalls(game, pir, dt);
}

function updateShip(game, pir, ship, dt) {
  const { boat, level } = game;
  const d = dist(ship.x, ship.y, boat.x, boat.y);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  ship.reload = Math.max(0, ship.reload - dt);
  ship.ramWait = Math.max(0, ship.ramWait - dt);
  ship.flash = Math.max(0, ship.flash - dt);

  let goal = null;
  if (ship.state !== 'chase') {
    // Back in its cove it keeps watch; on the way home it only turns for a close target.
    const range = ship.state === 'lurk' ? ship.spot : ship.spot * 0.6;
    if (game.status === 'sailing' && ship.cooldown <= 0 && d < range) {
      ship.state = 'chase';
      ship.far = 0;
      ship.replan = 0;
      ship.reload = 1.5;
      game.chases += 1;
      game.events.push({ type: 'pirate', phase: 'spotted', x: ship.x, y: ship.y });
    }
  }
  if (ship.state === 'chase') {
    ship.far = d > PIRATE.giveUp ? ship.far + dt : 0;
    const safe = dist(boat.x, boat.y, level.finish.x, level.finish.y) < PIRATE.harbor;
    const reason = game.status === 'finished' ? 'finish' : game.status === 'sinking' ? 'trouble' : safe ? 'harbor' : ship.far > PIRATE.giveUpTime ? 'outran' : null;
    if (reason) {
      giveUp(game, ship, reason);
    } else {
      // Head for where the boat will be, not where it is.
      const lead = clamp(d / 25, 0, 5);
      goal = {
        x: clamp(boat.x + boat.vx * lead, 30, level.width - 30),
        y: clamp(boat.y + boat.vy * lead, 30, level.height - 30),
      };
    }
  }
  if (ship.state === 'home') {
    goal = ship.home;
    if (dist(ship.x, ship.y, ship.home.x, ship.home.y) < 50) {
      ship.state = 'lurk';
      ship.path = null;
    }
  }

  const w = sampleWind(game.wind, ship.x, ship.y, pir.wind);
  const windFrom = Math.atan2(-w.wy, -w.wx);
  let want = ship.heading;
  let throttle = 0;
  if (goal) {
    throttle = ship.state === 'chase' ? 1 : 0.7;
    ship.replan -= dt;
    if (ship.replan <= 0) {
      ship.path = findPath(pir.grid, ship.x, ship.y, goal.x, goal.y, windFrom, plannedSpeed);
      ship.replan = 1.2;
      // No way through for a ship this size: you slipped through a gap it can't follow.
      if (!ship.path && ship.state === 'chase') giveUp(game, ship, 'reef');
    }
    const aim = aimPoint(pir.grid, ship, goal);
    want = Math.atan2(aim.y - ship.y, aim.x - ship.x);
  }
  // Square sails can't point high: beat on one tack, then the other.
  const off = angleDiff(windFrom, want);
  if (Math.abs(off) < PIRATE.noGo) {
    ship.tackTime += dt;
    if (ship.tackTime > 14) {
      ship.tack = -ship.tack;
      ship.tackTime = 0;
    }
    want = wrapAngle(windFrom + ship.tack * PIRATE.noGo);
  } else {
    ship.tack = off >= 0 ? 1 : -1;
    ship.tackTime = 0;
  }
  const turn = angleDiff(ship.heading, want);
  ship.heading = wrapAngle(ship.heading + clamp(turn, -PIRATE.turn * dt, PIRATE.turn * dt));
  const twa = angleDiff(windFrom, ship.heading);
  const target = pirateSpeed(twa) * w.speed * PIRATE.speed * throttle;
  ship.speed += (target - ship.speed) * clamp(dt / 3, 0, 1);

  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  const nx = ship.x + c * ship.speed * dt;
  const ny = ship.y + s * ship.speed * dt;
  const bow = PIRATE.length * 0.45;
  if (isClear(level, nx, ny, PIRATE.draught) && isClear(level, nx + c * bow, ny + s * bow, 5)) {
    ship.x = nx;
    ship.y = ny;
  } else {
    // Aground ahead: back the sails and let the path planner find another way.
    ship.speed *= 0.3;
    ship.replan = Math.min(ship.replan, 0.2);
  }

  fireCannons(game, pir, ship, d);
  ramBoat(game, ship);
}

function giveUp(game, ship, reason) {
  ship.state = 'home';
  ship.replan = 0;
  ship.far = 0;
  // Once you're past the reef or under the harbour's guns, it stops trying.
  ship.cooldown = reason === 'reef' || reason === 'harbor' ? 40 : 12;
  game.events.push({ type: 'pirate', phase: 'giveup', reason, x: ship.x, y: ship.y });
}

// The farthest point along the planned path the ship can sail to in a straight line.
function aimPoint(grid, ship, goal) {
  const path = ship.path;
  if (!path || !grid) return goal;
  let best = path[Math.min(1, path.length - 1)];
  for (let i = 1; i < path.length; i++) {
    const [px, py] = path[i];
    if (dist(ship.x, ship.y, px, py) > LOOK) break;
    if (lineClear(grid, ship.x, ship.y, px, py)) best = path[i];
  }
  return { x: best[0], y: best[1] };
}

function fireCannons(game, pir, ship, d) {
  const { boat } = game;
  if (ship.state !== 'chase' || game.status !== 'sailing' || ship.reload > 0) return;
  if (d > PIRATE.range || d < 25) return;
  const bearing = Math.atan2(boat.y - ship.y, boat.x - ship.x);
  const rel = angleDiff(ship.heading, bearing);
  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  let side;
  let mx;
  let my;
  let reload;
  if (Math.abs(Math.abs(rel) - Math.PI / 2) < BROADSIDE) {
    // A broadside from the guns along the side facing you.
    side = rel >= 0 ? 1 : -1;
    mx = ship.x - s * side * PIRATE.beam * 0.5;
    my = ship.y + c * side * PIRATE.beam * 0.5;
    reload = PIRATE.reload;
  } else if (Math.abs(rel) < BOW && d < PIRATE.chaser) {
    // The bow chaser: one gun firing forward at a boat it is running down.
    side = 0;
    mx = ship.x + c * PIRATE.length * 0.5;
    my = ship.y + s * PIRATE.length * 0.5;
    reload = PIRATE.chaserReload;
  } else {
    return;
  }
  const rng = pir.rng;
  // Lead the target, but not perfectly.
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(rng.next()) * PIRATE.scatter;
  const tx = boat.x + boat.vx * PIRATE.flight + Math.cos(a) * r;
  const ty = boat.y + boat.vy * PIRATE.flight + Math.sin(a) * r;
  pir.balls.push({ x0: mx, y0: my, x1: tx, y1: ty, t: 0, flight: PIRATE.flight });
  ship.reload = rng.range(reload[0], reload[1]);
  ship.shots += 1;
  ship.flash = 0.35;
  ship.flashSide = side;
  game.events.push({ type: 'cannon', phase: 'fire', x: mx, y: my, side });
}

function updateBalls(game, pir, dt) {
  const { boat } = game;
  for (let i = pir.balls.length - 1; i >= 0; i--) {
    const b = pir.balls[i];
    b.t += dt;
    if (b.t < b.flight) continue;
    pir.balls.splice(i, 1);
    const d = dist(boat.x, boat.y, b.x1, b.y1);
    const hit = d < PIRATE.hit && (game.status === 'sailing' || game.status === 'capsized');
    game.events.push({ type: 'cannon', phase: hit ? 'hit' : 'splash', x: b.x1, y: b.y1, near: d < 40 });
    if (!hit) continue;
    const ux = (b.x1 - b.x0) / (dist(b.x0, b.y0, b.x1, b.y1) || 1);
    const uy = (b.y1 - b.y0) / (dist(b.x0, b.y0, b.x1, b.y1) || 1);
    boat.vx += ux * 4;
    boat.vy += uy * 4;
    boat.yawRate += (pir.rng.chance(0.5) ? 1 : -1) * 0.8;
    game.hull = Math.max(0, game.hull - PIRATE.damage / boat.type.toughness);
    game.hits.cannon = (game.hits.cannon || 0) + 1;
  }
}

// Getting rammed by the brig hurts, and shoves you clear of its hull.
function ramBoat(game, ship) {
  const { boat } = game;
  if (game.status !== 'sailing') return;
  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  const half = PIRATE.length * 0.42;
  const [qx, qy] = closestOnSegment(boat.x, boat.y, ship.x - c * half, ship.y - s * half, ship.x + c * half, ship.y + s * half);
  const d = dist(boat.x, boat.y, qx, qy);
  const reach = PIRATE.beam * 0.5 + boat.type.beam * 0.6;
  if (d >= reach) return;
  const nx = (boat.x - qx) / (d || 1);
  const ny = (boat.y - qy) / (d || 1);
  boat.x += nx * (reach - d);
  boat.y += ny * (reach - d);
  if (ship.ramWait > 0) return;
  ship.ramWait = 1.5;
  const push = Math.max(4, ship.speed * 0.8);
  boat.vx += nx * push;
  boat.vy += ny * push;
  game.hull = Math.max(0, game.hull - PIRATE.ram / boat.type.toughness);
  game.hits.pirate = (game.hits.pirate || 0) + 1;
  game.events.push({ type: 'collide', impact: 9, material: 'wood', x: boat.x, y: boat.y });
}

// The ship to point at on screen: the nearest one that is chasing you.
export function chasingShip(game) {
  const ships = game.pirates ? game.pirates.ships.filter((s) => s.state === 'chase') : [];
  let best = null;
  for (const s of ships) if (!best || dist(s.x, s.y, game.boat.x, game.boat.y) < dist(best.x, best.y, game.boat.x, game.boat.y)) best = s;
  return best;
}
