// The prologue: a short film for a first launch. Dawn, and a sloop rowing out
// of harbor; a squall that takes the oar; then the wind doing what it does
// (head to wind the sail flaps, across it she flies); and last the chart, A
// to B, with what lies between. Stuck head to wind, the boat is shown the way
// by dolphins, as a lost sailor is in the game. It runs the real boat, wind
// and weather, with a script at the helm.

import { DEG, angleDiff, clamp, fromBearing, smoothstep, wrapAngle } from '../core/math.js';
import { blob, rockField } from './shapes.js';
import { createGame, stepGame, drainEvents } from './game.js';
import { addGuidePod } from './wildlife.js';

const FROM = 315; // the wind blows from the north-west all film long

export const PROLOGUE = {
  id: 'prologue',
  name: 'Prologue',
  size: [1600, 1000],
  start: { x: 230, y: 600, heading: 90 },
  finish: { x: 1440, y: 280, r: 50, kind: 'harbor' },
  wind: { from: FROM, speed: 1, gust: 0.1, shift: 0, period: 60 },
  islands: [
    { pts: blob(110, 420, 80, 5, 0.3), kind: 'sand' },
    { pts: blob(600, 900, 80, 9, 0.3), kind: 'sand' },
    { pts: blob(980, 220, 90, 13, 0.32), kind: 'rock' },
  ],
  rocks: rockField(770, 470, 50, 6, 17),
  whirlpools: [{ x: 1030, y: 720, r: 110, strength: 7, spin: 1 }],
  // The squall. The script carries it across the boat, then parks it out on
  // the chart for the last shot.
  storms: [{ x: -2000, y: -2000, r: 300, power: 0.8 }],
};

// When each shot starts, and what it says.
export const SHOTS = [
  { id: 'dawn', at: 0, caption: 'Dawn. Not a breath of wind.' },
  { id: 'oar', at: 4.5, caption: 'You had a boat, a sail and one good oar.' },
  { id: 'squall', at: 9, caption: 'Then the squall hit…' },
  { id: 'lost', at: 13, caption: '…and the sea took the oar.' },
  { id: 'wind', at: 18, caption: 'No paddle now. Only the wind.' },
  { id: 'irons', at: 23.5, caption: 'Point her into the wind, and the sail just flaps.' },
  { id: 'reach', at: 30, caption: 'Follow the dolphins across it, and she flies.' },
  { id: 'chart', at: 36.5, caption: 'Somewhere out there is B, and home.' },
  { id: 'dangers', at: 41, caption: 'Past the reefs, the squalls… and whatever stirs in the fog.' },
  { id: 'title', at: 47.5, caption: '' },
];
export const FILM_END = 56;
export const OAR_LOST = 13.1;
export const GUIDE_AT = 25.5; // in irons, and the dolphins come to show the way
const FLASHES = [10.6, OAR_LOST, 15.4];
const STROKE = 1.6; // seconds per stroke of the oar

// What the chart shot points out, in the order it points.
export const CALLOUTS = [
  { x: 770, y: 470, text: 'Reefs', at: 41.4 },
  { x: 1030, y: 720, text: 'Whirlpools', at: 42.4 },
  { x: 1190, y: 390, text: 'Squalls', at: 43.4 },
  { x: 1290, y: 640, text: '?', at: 44.6, fog: true },
];
export const ROUTE = [
  [620, 560],
  [900, 590],
  [1120, 540],
  [1300, 430],
  [1440, 280],
];
const SQUALL_PARK = { x: 1190, y: 390, r: 200 };

// The heading each stretch of the film steers for, as a compass bearing, and
// which way to come round when it is dead astern (-1 to port).
function course(t) {
  if (t < 9.4) return { bearing: 90 };
  if (t < 21.5) return { bearing: FROM + 180 }; // run before the squall
  if (t < 30) return { bearing: FROM, turn: -1 }; // head to wind, in irons
  return { bearing: FROM + 90 }; // a beam reach, off toward B
}

export function shotAt(t) {
  let shot = SHOTS[0];
  for (const s of SHOTS) if (t >= s.at) shot = s;
  return shot;
}

export function createFilm() {
  const game = createGame(PROLOGUE, { seed: 11 });
  game.boat.trim = game.boat.trimTarget = 0.6;
  return {
    t: 0,
    game,
    shot: SHOTS[0],
    shotTime: 0,
    // The oar: in the oarlock, flying, then adrift and dwindling astern.
    oar: { state: 'held', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, angle: 0, spin: 0, sweep: 0, dip: 0 },
    squallFrom: null,
    route: null, // where the chart's dotted way to B sets out from, and when
    done: false,
    events: [],
  };
}

// Where the oarlock sits on the boat, in world units (see drawBoat).
export function oarlock(boat, visual) {
  const L = boat.type.length * visual;
  const B = boat.type.beam * visual;
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  const lx = -L * 0.12;
  const ly = -B * 0.42;
  return { x: boat.x + lx * c - ly * s, y: boat.y + lx * s + ly * c };
}

export function stepFilm(film, dt, visual = 1.7) {
  if (film.done) return;
  const { game, oar } = film;
  const { boat, wind, level } = game;
  const t0 = film.t;
  const t = (film.t += dt);
  const shot = shotAt(t);
  if (shot !== film.shot) {
    film.shot = shot;
    film.events.push({ type: 'shot', id: shot.id, caption: shot.caption });
    if (shot.id === 'chart') film.route = { x: boat.x, y: boat.y, at: t };
  }
  film.shotTime = t - shot.at;

  // Wind and weather: a flat calm, the squall, then a steady breeze.
  const squall = smoothstep(9, 10.6, t) * (1 - smoothstep(16, 20, t));
  wind.speed = t < 9 ? 1 : 1 + 12 * smoothstep(9, 11, t) - 2 * smoothstep(16, 20, t);
  wind.gustiness = 0.1 + 0.25 * squall;
  level.weather.rain = 0.85 * squall;
  level.weather.dark = 0.3 * squall;
  const storm = level.storms[0];
  const dx = Math.cos(wind.angle);
  const dy = Math.sin(wind.angle);
  if (t >= 9 && !film.squallFrom) film.squallFrom = { x: boat.x - dx * 300, y: boat.y - dy * 300 };
  if (film.squallFrom && t < 30) {
    // The cell sweeps down the wind and over the boat.
    const k = clamp((t - 9) / 11, 0, 1) * 760;
    storm.x = film.squallFrom.x + dx * k;
    storm.y = film.squallFrom.y + dy * k;
  } else if (t >= 30) {
    Object.assign(storm, SQUALL_PARK);
  }
  for (const at of FLASHES) {
    if (t0 < at && t >= at) {
      game.flash = 1;
      film.events.push({ type: 'thunder' });
    }
  }

  // Stuck head to wind, dolphins surface and swim off across it. They wait
  // for her to follow, then ride the bow wave.
  if (t0 < GUIDE_AT && t >= GUIDE_AT) {
    const pod = addGuidePod(game.life, boat, fromBearing(FROM + 90), 10);
    film.events.push({ type: 'guide', x: pod.x, y: pod.y });
  }

  // At the helm: come round to each stretch's heading at a steady rate.
  const { bearing, turn } = course(t);
  const target = fromBearing(bearing);
  let diff = angleDiff(boat.heading, target);
  if (turn && Math.abs(diff) > 170 * DEG) diff = turn * Math.abs(diff);
  const rate = 55 * DEG;
  const step = clamp(diff, -rate * dt, rate * dt);
  stepGame(game, { steer: 0, trimTarget: 0.6, autoTrim: true, boost: false }, dt);
  boat.heading = wrapAngle(boat.heading + step);
  boat.yawRate = 0;
  // A film never capsizes: the squall knocks her down to the rail, no further.
  boat.heel = clamp(boat.heel, -0.7, 0.7);

  // Rowing out: each stroke a surge, then a glide.
  if (oar.state === 'held') {
    const phase = (t % STROKE) / STROKE;
    oar.sweep = Math.sin(phase * Math.PI * 2);
    oar.dip = phase < 0.5 ? 1 : 0;
    if (t < 9) {
      const pull = 3 + 1.8 * Math.max(0, Math.sin(phase * Math.PI * 2));
      boat.vx = Math.cos(boat.heading) * pull;
      boat.vy = Math.sin(boat.heading) * pull;
    }
    if (Math.floor(t0 / STROKE) !== Math.floor(t / STROKE) && t < OAR_LOST) film.events.push({ type: 'stroke' });
    if (t >= OAR_LOST) {
      // A gust and a sea over the side, and the oar goes flying.
      const lock = oarlock(boat, visual);
      const out = boat.heading - Math.PI / 2;
      Object.assign(oar, {
        state: 'flying',
        x: lock.x,
        y: lock.y,
        z: 2,
        vx: boat.vx * 0.4 + Math.cos(out) * 22 - dx * 4,
        vy: boat.vy * 0.4 + Math.sin(out) * 22 - dy * 4,
        vz: 16,
        angle: out,
        spin: 9,
      });
      film.events.push({ type: 'oar', x: lock.x, y: lock.y });
    }
  } else if (oar.state === 'flying') {
    oar.vz -= 34 * dt;
    oar.z += oar.vz * dt;
    oar.x += oar.vx * dt;
    oar.y += oar.vy * dt;
    oar.angle += oar.spin * dt;
    if (oar.z <= 0) {
      oar.z = 0;
      oar.state = 'adrift';
      oar.spin = 0.35;
      film.events.push({ type: 'splash', x: oar.x, y: oar.y });
    }
  } else {
    // Adrift: the breeze and the chop carry it slowly off.
    oar.x += dx * 1.2 * dt;
    oar.y += dy * 1.2 * dt;
    oar.angle += oar.spin * dt;
    oar.spin *= 1 - dt * 0.2;
  }

  for (const e of drainEvents(game)) if (e.type === 'dolphins' && e.phase === 'join') film.events.push(e);
  if (t >= FILM_END) endFilm(film);
}

export function endFilm(film) {
  if (film.done) return;
  film.done = true;
  film.events.push({ type: 'end' });
}

export function drainFilmEvents(film) {
  const out = film.events;
  film.events = [];
  return out;
}
