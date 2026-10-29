// The skipper: a sailor in a yellow oilskin and a red knitted hat. He sits at
// the tiller while you steer; leave the helm alone and he strolls about the
// deck: out to the bow to look ahead, to the mast to haul on a line, to the
// rail to watch the water, and when she's stopped he drops a fishing line
// over the stern. He hikes out when she heels, ducks across in a tack,
// cheers a pearl or a rescue, and swims beside her after a capsize.
//
// Decoration only. Positions are in the boat's own frame as fractions of the
// drawn hull: u along it (bow +), v across it (starboard +).

import { clamp, angleDiff } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';

const TAU = Math.PI * 2;
const WALK = 0.2; // boat lengths a second
const RUN = 0.42;
const HIKE_HEEL = 0.4; // radians of heel before he sits out on the rail
const STEERING = 0.18; // rudder past this means you have the helm
const SIZE = 1.2; // a touch bigger than life, so he reads on a phone

const JACKET = '#f2c230';
const JACKET_DARK = '#b98d12';
const TROUSERS = '#2b3a55';
const SKIN = '#e0a87c';
const HAT = '#c8402f';

// Where he goes on each kind of hull, for windward side `s`.
const SINGLE = {
  helm: (s) => [-0.39, s * 0.2, -s * 0.35],
  hike: (s) => [-0.3, s * 0.34, -s * 0.5],
  bow: () => [0.3, 0, 0],
  mast: (s) => [-0.02, s * 0.12, 0],
  rail: (s) => [0.02, s * 0.27, s * Math.PI * 0.5],
  fish: (s) => [-0.37, s * 0.16, Math.PI],
  mastU: 0.12,
};
const TWIN = {
  helm: (s) => [-0.22, s * 0.2, -s * 0.3],
  hike: (s) => [-0.15, s * 0.36, -s * 0.5],
  bow: (s) => [0.32, s * 0.36, 0],
  mast: (s) => [-0.02, s * 0.1, 0],
  rail: (s) => [0, s * 0.36, s * Math.PI * 0.5],
  fish: (s) => [-0.36, s * 0.36, Math.PI],
  mastU: 0.12,
};

export function createSkipper() {
  return {
    u: -0.39,
    v: 0.2,
    face: 0,
    doing: 'helm', // helm, hike, bow, mast, rail, fish, cheer, swim
    goal: null, // what he'll do on arrival
    path: [],
    run: false,
    duck: false,
    step: 0,
    t: 0,
    timer: 6, // until the next stroll, or until a stroll ends
    idle: 0,
    side: 1,
    cheer: 0,
    pearls: 0,
    crew: 0,
    bite: -1, // seconds into fishing when a fish bites
    fish: 0, // seconds left holding up a catch
    jacket: JACKET,
  };
}

// A helmsman who never leaves the tiller, for the regatta fleet and the
// Shipyard: no state to keep.
export function helmsman(type, side = 1, jacket = JACKET) {
  const sk = createSkipper();
  const [u, v, face] = (type.twin ? TWIN : SINGLE).helm(side);
  Object.assign(sk, { u, v, face, side, jacket });
  return sk;
}

function spot(type, kind, side) {
  return (type.twin ? TWIN : SINGLE)[kind](side);
}

// Walk to a spot, round the mast if it's in the way.
function go(sk, type, kind, opts = {}) {
  const side = opts.rail || sk.side;
  const [u, v] = spot(type, kind, side);
  const path = [];
  const m = (type.twin ? TWIN : SINGLE).mastU;
  if ((sk.u < m - 0.04 && u > m + 0.04) || (sk.u > m + 0.04 && u < m - 0.04)) {
    const by = Math.sign(sk.v || v || side) || 1;
    path.push([m, by * (type.twin ? 0.2 : 0.17)]);
  }
  path.push([u, v]);
  sk.path = path;
  sk.goal = kind;
  sk.railSide = side;
  sk.run = !!opts.run;
  sk.duck = !!opts.duck;
}

function arrive(sk, type) {
  const kind = sk.goal;
  const [, , face] = spot(type, kind, sk.railSide || sk.side);
  sk.doing = kind;
  sk.goal = null;
  sk.run = false;
  sk.duck = false;
  sk.t = 0;
  sk.faceTo = face;
  if (kind === 'helm' || kind === 'hike') sk.timer = 6 + Math.random() * 6;
  else if (kind === 'bow') sk.timer = 4 + Math.random() * 3;
  else if (kind === 'mast') sk.timer = 3 + Math.random() * 1.5;
  else if (kind === 'rail') sk.timer = 4 + Math.random() * 2.5;
  else if (kind === 'fish') {
    sk.timer = 10 + Math.random() * 6;
    sk.bite = Math.random() < 0.55 ? 3.5 + Math.random() * 4 : -1;
  }
}

export function updateSkipper(sk, game, dt) {
  const boat = game.boat;
  const type = boat.type;
  if (sk.type !== type.id) {
    Object.assign(sk, helmsman(type, sk.side, sk.jacket));
    sk.type = type.id;
  }
  sk.t += dt;
  sk.cheer = Math.max(0, sk.cheer - dt);
  sk.fish = Math.max(0, sk.fish - dt);

  // A pearl in the bag or a castaway hauled aboard gets a cheer.
  const pearls = game.pearls || 0;
  const crew = (game.castaways || []).filter((c) => c.state === 'aboard').length;
  if (pearls > sk.pearls || crew > sk.crew) sk.cheer = crew > sk.crew ? 2.4 : 1.4;
  sk.pearls = pearls;
  sk.crew = crew;

  if (game.status === 'capsized' || game.status === 'sinking') {
    sk.doing = 'swim';
    sk.path = [];
    return;
  }
  if (sk.doing === 'swim') {
    // Hauls himself back over the windward rail.
    const [u, v] = spot(type, 'hike', sk.side);
    Object.assign(sk, { u, v, doing: 'helm', t: 0, timer: 6 });
  }

  // The windward side is away from the boom.
  const side = boat.boom > 0.03 ? -1 : boat.boom < -0.03 ? 1 : sk.side;
  const tacked = side !== sk.side;
  sk.side = side;
  const sailing = game.status === 'sailing';
  const steering = sailing && Math.abs(boat.rudder) > STEERING;
  const heeled = Math.abs(boat.heel) > HIKE_HEEL;
  const speed = boatSpeed(boat);
  sk.idle = steering ? 0 : sk.idle + dt;

  const atHelm = (sk.doing === 'helm' || sk.doing === 'hike') && !sk.path.length;
  const heading = sk.path.length ? sk.goal : sk.doing;
  if (game.status === 'finished') {
    if (heading !== 'bow' && sk.doing !== 'cheer') go(sk, type, 'bow');
    else if (!sk.path.length) sk.doing = 'cheer';
  } else if (steering || heeled) {
    // Back to the tiller, at a run if he's off up the deck.
    const want = heeled ? 'hike' : 'helm';
    if (heading !== want || tacked) go(sk, type, want, { run: !atHelm || tacked, duck: tacked });
  } else if (tacked && atHelm) {
    go(sk, type, sk.doing, { run: true, duck: true });
  } else if (!sk.path.length) {
    sk.timer -= dt;
    if (sk.timer <= 0 && sailing) {
      if (atHelm) {
        // Off for a stroll.
        const choices = speed < 1.5 ? ['fish', 'fish', 'rail', 'bow'] : ['bow', 'bow', 'mast', 'rail'];
        const kind = choices[Math.floor(Math.random() * choices.length)];
        if (kind === 'rail') go(sk, type, 'rail', { rail: Math.random() < 0.6 ? side : -side });
        else go(sk, type, kind);
      } else {
        go(sk, type, 'helm');
      }
    }
    // Something to reel in when she gets going again.
    if (sk.doing === 'fish' && speed > 3) go(sk, type, 'helm');
  }

  // Fish on.
  if (sk.doing === 'fish' && sk.bite > 0 && sk.t >= sk.bite + 0.7) {
    sk.bite = -1;
    sk.fish = 1.8;
    sk.cheer = 1.8;
  }

  // Walking.
  if (sk.path.length) {
    const ratio = type.beam / type.length;
    let left = (sk.run ? RUN : WALK) * dt;
    while (left > 0 && sk.path.length) {
      const [tu, tv] = sk.path[0];
      const du = tu - sk.u;
      const dv = tv - sk.v;
      const d = Math.hypot(du, dv * ratio);
      if (d > 1e-4) sk.face = Math.atan2(dv * ratio, du);
      if (d <= left) {
        sk.u = tu;
        sk.v = tv;
        left -= d;
        sk.path.shift();
      } else {
        sk.u += (du / d) * left;
        sk.v += (dv / d) * left;
        left = 0;
      }
    }
    sk.step += dt * (sk.run ? 15 : 9);
    if (!sk.path.length) arrive(sk, type);
  } else if (sk.faceTo !== undefined) {
    let want = sk.faceTo;
    // At the bow he looks about.
    if (sk.doing === 'bow') want += Math.sin(sk.t * 0.9) * 0.6;
    sk.face += clamp(angleDiff(sk.face, want), -5 * dt, 5 * dt);
  }
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function arm(ctx, sx, sy, hx, hy, jacket) {
  ctx.strokeStyle = jacket;
  ctx.lineWidth = 0.95;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = SKIN;
  ellipse(ctx, hx, hy, 0.48, 0.48);
}

// Head and hat from above: the hat sits back on his head, so his face shows
// on the side he's looking.
function head(ctx, x, y) {
  ctx.fillStyle = SKIN;
  ellipse(ctx, x + 0.25, y, 1.2, 1.15);
  ctx.fillStyle = HAT;
  ellipse(ctx, x - 0.12, y, 1.08, 1.12);
  ctx.fillStyle = '#f4ecdc';
  ellipse(ctx, x - 0.2, y, 0.38, 0.38);
}

function drawSwimmer(ctx, sk, g, time) {
  const x = 0;
  const y = sk.side * (g.B * (g.twin ? 0.62 : 0.5) + 3);
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.55)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 2; i++) {
    const k = (time * 0.8 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.arc(x, y, 2 + k * 4, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const stroke = Math.sin(time * 5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-sk.side * Math.PI * 0.5);
  ctx.scale(SIZE, SIZE);
  ctx.fillStyle = 'rgba(242, 194, 48, 0.75)';
  ellipse(ctx, -0.4, 0, 1.1, 1.7);
  arm(ctx, 0, -1.3, 1.6 + stroke * 0.8, -2.2, sk.jacket);
  arm(ctx, 0, 1.3, 1.6 - stroke * 0.8, 2.2, sk.jacket);
  head(ctx, 0.9, 0);
  ctx.restore();
}

// Drawn in the boat's frame, on deck, under the sail. `g` is the drawn hull:
// length L, beam B, and whether it's twin-hulled.
export function drawSkipper(ctx, sk, g, boat, time, capsized = false) {
  if (sk.doing === 'swim' || capsized) {
    if (capsized) drawSwimmer(ctx, sk, g, time);
    return;
  }
  let x = sk.u * g.L;
  let y = sk.v * g.B;
  const doing = sk.path.length ? 'walk' : sk.doing;
  const sitting = doing === 'helm' || doing === 'hike' || doing === 'fish';
  if (doing === 'hike') y += sk.side * (0.6 + Math.abs(boat.heel) * 2.2);
  const hop = sk.cheer > 0 || doing === 'cheer' ? Math.abs(Math.sin(time * 9)) : 0;

  // The tiller's tip, for the hand that holds it.
  const a = boat.rudder * 0.6;
  const tipX = -g.L * 0.5 + Math.cos(a) * g.L * 0.22;
  const tipY = Math.sin(a) * g.L * 0.22;

  // Shadow on the deck.
  ctx.fillStyle = 'rgba(30, 18, 8, 0.28)';
  ellipse(ctx, x + 0.8 + hop * 0.6, y + 1.1 + hop * 0.8, 1.6 * SIZE, 2.1 * SIZE, sk.face);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sk.face);
  const k = SIZE * (sk.duck ? 0.85 : 1) * (1 + hop * 0.12);
  ctx.scale(k, k);

  // Legs: stretched out in front when he sits, striding when he walks.
  ctx.fillStyle = TROUSERS;
  if (sitting) {
    ellipse(ctx, 1.25, -0.6, 1.15, 0.5);
    ellipse(ctx, 1.25, 0.6, 1.15, 0.5);
  } else if (doing === 'walk') {
    const s = Math.sin(sk.step);
    ctx.fillStyle = '#1d2433';
    ellipse(ctx, s * 1.1, -0.6, 0.75, 0.42);
    ellipse(ctx, -s * 1.1, 0.6, 0.75, 0.42);
  }

  // Jacket.
  ctx.fillStyle = JACKET_DARK;
  ellipse(ctx, -0.1, 0, 1.25, 1.95);
  ctx.fillStyle = sk.jacket;
  ellipse(ctx, 0, 0, 1.1, 1.8);

  // Arms, in the boat's frame for the tiller and in his own otherwise.
  const L = [0.1, -1.55];
  const R = [0.1, 1.55];
  const swing = Math.sin(sk.step) * 0.9;
  if (sk.cheer > 0 || doing === 'cheer') {
    const w = Math.sin(time * 14) * 0.5;
    arm(ctx, ...L, 0.6 + w, -3.4, sk.jacket);
    arm(ctx, ...R, 0.6 - w, 3.4, sk.jacket);
    if (sk.fish > 0) {
      // Holding up his catch.
      ctx.fillStyle = '#c9d6dc';
      ellipse(ctx, 1.4, -3.6, 1.3, 0.45, 0.4 + Math.sin(time * 20) * 0.3);
    }
  } else if (doing === 'walk') {
    arm(ctx, ...L, 0.1 - swing, -2, sk.jacket);
    arm(ctx, ...R, 0.1 + swing, 2, sk.jacket);
  } else if (doing === 'helm' || doing === 'hike') {
    // One hand on the tiller (its tip, back in his own frame), one on his knee.
    const dx = tipX - x;
    const dy = tipY - y;
    const c = Math.cos(-sk.face) / k;
    const s = Math.sin(-sk.face) / k;
    const hx = dx * c - dy * s;
    const hy = dx * s + dy * c;
    const near = hy < 0 ? L : R;
    const far = hy < 0 ? R : L;
    if (!g.twin && Math.hypot(hx, hy) < 6) arm(ctx, ...near, hx, hy, sk.jacket);
    else arm(ctx, ...near, 1.9, near[1] * 0.8, sk.jacket);
    arm(ctx, ...far, 1.7, far[1] * 0.6, sk.jacket);
  } else if (doing === 'bow') {
    // Shading his eyes.
    arm(ctx, ...L, 1.3, -0.5, sk.jacket);
    arm(ctx, ...R, 0.4, 2.0, sk.jacket);
  } else if (doing === 'mast') {
    // Hand over hand on a halyard.
    const pull = Math.sin(sk.t * 5);
    arm(ctx, ...L, 2.4 + pull * 0.6, -0.4, sk.jacket);
    arm(ctx, ...R, 2.4 - pull * 0.6, 0.4, sk.jacket);
  } else if (doing === 'rail') {
    arm(ctx, ...L, 1.6, -1.6, sk.jacket);
    arm(ctx, ...R, 1.6, 1.6, sk.jacket);
  } else if (doing === 'fish') {
    arm(ctx, ...L, 1.8, -0.4, sk.jacket);
    arm(ctx, ...R, 1.8, 0.4, sk.jacket);
  }
  head(ctx, 0.15, 0);
  ctx.restore();

  if (doing === 'fish' && sk.fish <= 0) {
    // Rod out over the stern and a float bobbing behind.
    const c = Math.cos(sk.face);
    const s = Math.sin(sk.face);
    const bite = sk.bite > 0 && sk.t > sk.bite;
    const rx = x + c * 1.8;
    const ry = y + s * 1.8;
    const tx = x + c * 7;
    const ty = y + s * 7 + (bite ? Math.sin(time * 30) * 0.4 : 0);
    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const fx = x + c * 11 - s * 1.5;
    const fy = y + s * 11 + c * 1.5 + Math.sin(time * 2) * 0.3;
    ctx.strokeStyle = 'rgba(240, 240, 230, 0.6)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    const dip = bite ? 0.5 : 1;
    ctx.fillStyle = '#e8492e';
    ellipse(ctx, fx, fy, 0.65 * dip, 0.65 * dip);
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.5)';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(fx, fy, 1.4 + ((time * 1.5) % 1) * (bite ? 2.5 : 1.2), 0, TAU);
    ctx.stroke();
  }
}
