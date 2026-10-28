// Sea life. Dolphin pods roam open water; sail past one fast enough and it
// swims along your bow wave, giving the boat a gentle push until you slow
// down or the dolphins tire. Whales cruise and spout, dive, then breach and
// send out a swell that shoves and rocks any boat it rolls under. A guide
// pod (see guide.js) shows a lost sailor the way to go.

import { DEG, angleDiff, clamp, dist } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { boatSpeed } from '../physics/boat.js';

export const JOIN_SPEED = 8; // about 5 knots
export const JOIN_RANGE = 150;
export const ESCORT_TIME = 14;
export const ESCORT_COOLDOWN = 20;
const SLOW_SPEED = 5;
const POD_CRUISE = 9;
const DOLPHIN_SPRINT = 34;
export const GUIDE_TIME = 8; // seconds a guide pod waits to be followed
export const GUIDE_LEAD = 70; // how far ahead of the boat it swims
const GUIDE_FOLLOW = 35 * DEG; // a boat this close to the way is following

// Whale cycle, in seconds from the start of a period.
export const WHALE = { dive: 11, rise: 22, breach: 23.6, splash: 24.8, period: 27, close: 200, swell: 280, swellSpeed: 85, body: 40 };

export function prepareWildlife(def, seed) {
  const life = { pods: [], whales: [], swells: [], rng: createRng(seed ^ 0x51ea11fe) };
  addSeaLife(life, def);
  return life;
}

// Put dolphin pods and whales in the sea. The open sea adds more as it is
// charted.
export function addSeaLife(life, { dolphins = [], whales = [] }) {
  const rng = life.rng;
  for (const d of dolphins) {
    const count = d.count || 4;
    const orbit = rng.range(0, Math.PI * 2);
    const roam = d.r || 140;
    const x = d.x + Math.cos(orbit) * roam;
    const y = d.y + Math.sin(orbit) * roam;
    const members = [];
    for (let k = 0; k < count; k++) {
      members.push({
        // Loose formation behind the pod's leader, alternating sides.
        u: -k * 7 + rng.range(-2, 2),
        v: (k % 2 ? 1 : -1) * (k ? 4 + k * 2.5 : 0) + rng.range(-1.5, 1.5),
        x: x + rng.range(-10, 10),
        y: y + rng.range(-10, 10),
        heading: orbit + Math.PI / 2,
        phase: rng.range(0, Math.PI * 2),
        leap: 0,
      });
    }
    life.pods.push({ home: { x: d.x, y: d.y }, roam, orbit, x, y, heading: orbit + Math.PI / 2, state: 'roam', timer: 0, cooldown: 0, slow: 0, ride: 0, members });
  }
  for (const w of whales) {
    life.whales.push({
      cx: w.x,
      cy: w.y,
      rx: w.rx || 160,
      ry: w.ry || 90,
      t: rng.range(0, Math.PI * 2),
      offset: w.offset !== undefined ? w.offset : rng.range(0, 8),
      x: w.x,
      y: w.y,
      heading: 0,
      phase: 'surface',
      phaseTime: 0,
      spout: 0,
    });
  }
}

// A guide pod: three dolphins that surface off the bow, on the side to turn
// to, and swim the way to go.
export function addGuidePod(life, boat, way, time = GUIDE_TIME) {
  const side = Math.sign(angleDiff(boat.heading, way)) || 1;
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  const x = boat.x + c * 28 - s * side * 22;
  const y = boat.y + s * 28 + c * side * 22;
  const members = [0, 1, 2].map((k) => ({
    u: -k * 9,
    v: (k % 2 ? 1 : -1) * (k ? 7 : 0),
    x: x - Math.cos(way) * k * 6,
    y: y - Math.sin(way) * k * 6,
    heading: way,
    phase: k * 2.1,
    leap: k === 0 ? 1 : 0, // the first one jumps to catch your eye
  }));
  const pod = { guide: true, way, home: { x, y }, roam: 60, orbit: 0, x, y, heading: way, state: 'guide', timer: time, span: time, cooldown: 0, slow: 0, ride: 0, members };
  life.pods.push(pod);
  return pod;
}

export function updateWildlife(game, dt) {
  const life = game.life;
  if (!life) return;
  let ride = 0;
  for (const pod of life.pods) {
    updatePod(game, pod, dt);
    ride = Math.max(ride, pod.ride);
  }
  // A guide pod that has led someone home swims off for good.
  if (life.pods.some((p) => p.gone)) life.pods = life.pods.filter((p) => !p.gone);
  game.boat.escort = ride;
  if (ride > 0.5) game.escortTime += dt;
  for (const w of life.whales) updateWhale(game, w, dt);
  updateSwells(game, dt);
}

function updatePod(game, pod, dt) {
  const { boat } = game;
  const speed = boatSpeed(boat);
  const sailing = game.status === 'sailing';
  pod.cooldown = Math.max(0, pod.cooldown - dt);

  if (pod.state === 'roam') {
    // Circle the pod's patch of sea, easing back onto the circle after an escort.
    pod.orbit += (POD_CRUISE / pod.roam) * dt;
    const tx = pod.home.x + Math.cos(pod.orbit) * pod.roam;
    const ty = pod.home.y + Math.sin(pod.orbit) * pod.roam;
    const d = dist(pod.x, pod.y, tx, ty);
    const step = Math.min(d, POD_CRUISE * 2 * dt);
    if (d > 1) {
      pod.x += ((tx - pod.x) / d) * step;
      pod.y += ((ty - pod.y) / d) * step;
      pod.heading = d > 20 ? Math.atan2(ty - pod.y, tx - pod.x) : pod.orbit + Math.PI / 2;
    } else {
      pod.heading = pod.orbit + Math.PI / 2;
    }
    if (sailing && pod.cooldown <= 0 && speed > JOIN_SPEED && dist(boat.x, boat.y, pod.x, pod.y) < JOIN_RANGE) {
      pod.state = 'escort';
      pod.timer = ESCORT_TIME;
      pod.slow = 0;
      game.events.push({ type: 'dolphins', phase: 'join', x: pod.x, y: pod.y });
    }
  } else if (pod.state === 'guide') {
    // Swim the way to go, keeping a little ahead of the boat.
    pod.timer -= dt;
    pod.heading = pod.way;
    const tx = boat.x + Math.cos(pod.way) * GUIDE_LEAD;
    const ty = boat.y + Math.sin(pod.way) * GUIDE_LEAD;
    const d = dist(pod.x, pod.y, tx, ty);
    const step = Math.min(d, (speed + 22) * dt);
    if (d > 0.01) {
      pod.x += ((tx - pod.x) / d) * step;
      pod.y += ((ty - pod.y) / d) * step;
    }
    // Follow them up to speed and they ride your bow wave.
    if (sailing && speed > JOIN_SPEED && Math.abs(angleDiff(boat.heading, pod.way)) < GUIDE_FOLLOW) {
      pod.state = 'escort';
      pod.timer = ESCORT_TIME;
      pod.slow = 0;
      game.events.push({ type: 'dolphins', phase: 'join', guide: true, x: pod.x, y: pod.y });
    } else if (pod.timer <= 0 || !sailing) {
      pod.state = 'leave';
      pod.timer = 4;
      pod.side = Math.sign(angleDiff(boat.heading, pod.way)) || 1;
    }
  } else if (pod.state === 'escort') {
    pod.timer -= dt;
    pod.slow = speed < SLOW_SPEED ? pod.slow + dt : 0;
    pod.x = boat.x;
    pod.y = boat.y;
    pod.heading = boat.heading;
    if (pod.timer <= 0 || pod.slow > 1.5 || !sailing) {
      const reason = !sailing ? 'trouble' : pod.slow > 1.5 ? 'slow' : 'tired';
      pod.state = 'leave';
      pod.timer = 5;
      pod.cooldown = ESCORT_COOLDOWN;
      pod.side = game.life.rng.chance(0.5) ? 1 : -1;
      game.events.push({ type: 'dolphins', phase: 'leave', reason, x: pod.x, y: pod.y });
    }
  } else {
    // Peel away from the boat, then head home.
    pod.timer -= dt;
    const away = boat.heading + pod.side * 0.9;
    pod.heading = away;
    pod.x += Math.cos(away) * POD_CRUISE * 2.5 * dt;
    pod.y += Math.sin(away) * POD_CRUISE * 2.5 * dt;
    if (pod.timer <= 0) {
      pod.state = 'roam';
      if (pod.guide) pod.gone = true;
    }
  }

  // Members chase their slot: behind the leader while roaming, at the bow
  // wave while escorting.
  const escort = pod.state === 'escort';
  const L = boat.type.length;
  const B = boat.type.beam;
  let off = 0;
  pod.members.forEach((m, k) => {
    let su;
    let sv;
    if (escort) {
      const row = k >> 1;
      su = L * 0.55 + 5 - row * 9 + Math.sin(game.clock * 1.3 + m.phase) * 2;
      sv = (k % 2 ? 1 : -1) * (B * 0.5 + 6 + row * 2.5);
    } else if (pod.state === 'guide') {
      su = m.u + Math.sin(game.clock * 2.4 + m.phase) * 6;
      sv = m.v;
    } else {
      su = m.u;
      sv = m.v + Math.sin(game.clock * 0.9 + m.phase) * 3;
    }
    const c = Math.cos(pod.heading);
    const s = Math.sin(pod.heading);
    const tx = pod.x + c * su - s * sv;
    const ty = pod.y + s * su + c * sv;
    const d = dist(m.x, m.y, tx, ty);
    const cruise = escort || pod.guide ? speed + DOLPHIN_SPRINT * clamp(d / 30, 0.2, 1) : POD_CRUISE * 2.5;
    const step = Math.min(d, cruise * dt);
    if (d > 0.01) {
      m.x += ((tx - m.x) / d) * step;
      m.y += ((ty - m.y) / d) * step;
    }
    // Face the way they swim, or the way the pod is going once in place.
    const target = d > 4 ? Math.atan2(ty - m.y, tx - m.x) : pod.heading;
    m.heading += Math.atan2(Math.sin(target - m.heading), Math.cos(target - m.heading)) * clamp(dt * 6, 0, 1);
    m.leap = Math.max(0, m.leap - dt / 1.1);
    if (m.leap <= 0 && game.life.rng.chance(dt * (pod.state === 'guide' ? 0.6 : escort ? 0.35 : 0.06))) m.leap = 1;
    off += d;
  });
  const formed = escort && off / pod.members.length < 16;
  pod.ride = clamp(pod.ride + (formed ? dt / 1.2 : -dt / 0.8), 0, 1);
}

function updateWhale(game, w, dt) {
  const { boat } = game;
  // Cruise around an ellipse at about 3 knots.
  const perim = Math.PI * (w.rx + w.ry);
  w.t += ((6 * 2 * Math.PI) / perim) * dt;
  const nx = w.cx + Math.cos(w.t) * w.rx;
  const ny = w.cy + Math.sin(w.t) * w.ry;
  w.heading = Math.atan2(ny - w.y, nx - w.x) || w.heading;
  w.x = nx;
  w.y = ny;

  const cycle = (game.time + w.offset) % WHALE.period;
  const prev = w.phase;
  w.phase = cycle < WHALE.dive ? 'surface' : cycle < WHALE.rise ? 'deep' : cycle < WHALE.breach ? 'rising' : cycle < WHALE.splash ? 'breach' : 'surface';
  const starts = { surface: cycle >= WHALE.splash ? WHALE.splash : 0, deep: WHALE.dive, rising: WHALE.rise, breach: WHALE.breach };
  w.phaseTime = cycle - starts[w.phase];
  w.spout = Math.max(0, w.spout - dt);
  const near = dist(boat.x, boat.y, w.x, w.y) < 520;
  if (w.phase === 'surface' && w.phaseTime > 1 && Math.floor(w.phaseTime / 4) !== Math.floor((w.phaseTime - dt) / 4)) {
    w.spout = 1.4;
    if (near) game.events.push({ type: 'whale', phase: 'spout', x: w.x, y: w.y });
  }
  if (w.phase === prev) return;
  if (w.phase === 'rising' && near) game.events.push({ type: 'whale', phase: 'rising', x: w.x, y: w.y });
  if (prev === 'breach') {
    game.life.swells.push({ x: w.x, y: w.y, r: 0, hit: false });
    game.events.push({ type: 'whale', phase: 'breach', x: w.x, y: w.y, near });
    const d = dist(boat.x, boat.y, w.x, w.y);
    if (d < WHALE.close && game.status === 'sailing') game.closeBreaches += 1;
    if (d < WHALE.body && game.status === 'sailing') {
      // Landed right on top of you.
      const nx2 = (boat.x - w.x) / (d || 1);
      const ny2 = (boat.y - w.y) / (d || 1);
      boat.vx += nx2 * 12;
      boat.vy += ny2 * 12;
      boat.yawRate += 2;
      game.hull = Math.max(0, game.hull - 14 / boat.type.toughness);
      game.hits.whale = (game.hits.whale || 0) + 1;
      game.events.push({ type: 'collide', impact: 10, material: 'whale', x: boat.x, y: boat.y });
    }
  }
}

function updateSwells(game, dt) {
  const { boat } = game;
  const swells = game.life.swells;
  for (let i = swells.length - 1; i >= 0; i--) {
    const s = swells[i];
    s.r += WHALE.swellSpeed * dt;
    if (s.r > WHALE.swell) {
      swells.splice(i, 1);
      continue;
    }
    if (s.hit || game.status !== 'sailing') continue;
    const d = dist(boat.x, boat.y, s.x, s.y);
    if (Math.abs(d - s.r) > 12 || d < WHALE.body) continue;
    s.hit = true;
    const k = 1 - s.r / WHALE.swell;
    const nx = (boat.x - s.x) / (d || 1);
    const ny = (boat.y - s.y) / (d || 1);
    boat.vx += nx * 9 * k;
    boat.vy += ny * 9 * k;
    // Rolls the boat the way the wave lifts it: beam-on swells rock hardest.
    const cross = Math.cos(boat.heading) * ny - Math.sin(boat.heading) * nx;
    boat.heel += 0.45 * k * cross;
    game.events.push({ type: 'swell', strength: k, x: boat.x, y: boat.y });
  }
}
