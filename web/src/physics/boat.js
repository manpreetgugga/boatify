// Boat state and the per-step dynamics: sail force from the apparent wind,
// keel and hull drag in the water (which may itself be moving), rudder yaw and
// heel. Units are game units (see KNOTS_PER_UNIT) and seconds.

import { approach, clamp, wrapAngle } from '../core/math.js';
import { sailCoefficients, apparentAngle, optimalTrim } from './sailing.js';

// Boats in the shipyard. Each trades one strength for a weakness; `unlock`
// is the campaign stars needed, `toughness` divides hull damage and `look`
// is how the renderer paints it.
export const BOAT_TYPES = {
  sloop: {
    id: 'sloop',
    name: 'Driftwood Sloop',
    tag: 'Steady all-rounder',
    blurb: 'The boat you started with. Steady, forgiving, good at everything.',
    unlock: 0,
    length: 11,
    beam: 4.2,
    sailPower: 0.052,
    surgeDrag: 0.034,
    surgeDragLinear: 0.06,
    swayDrag: 5,
    swayDragLinear: 9,
    turnRate: 1.5,
    rightingMoment: 60,
    trimSpeed: 1.6,
    toughness: 1,
    stats: { speed: 3, pointing: 3, stability: 3, agility: 3, toughness: 3 },
    look: { hull: '#8b5a3a', hullDark: '#5e3b25', deck: '#d1a574', sail: '#f5f0e4', sailShade: '#d9d2c2' },
  },
  skiff: {
    id: 'skiff',
    name: 'Reed Skiff',
    tag: 'Nimble but fragile',
    blurb: 'Light and twitchy. Quick off the mark and through a tack, but it tips over easily and bruises on every rock.',
    unlock: 6,
    length: 9.5,
    beam: 3.3,
    sailPower: 0.053,
    surgeDrag: 0.032,
    surgeDragLinear: 0.05,
    swayDrag: 4.6,
    swayDragLinear: 8.5,
    turnRate: 2.05,
    rightingMoment: 40,
    trimSpeed: 2.2,
    toughness: 0.7,
    stats: { speed: 3, pointing: 3, stability: 1, agility: 5, toughness: 2 },
    look: { hull: '#c9a25e', hullDark: '#8a6a32', deck: '#ead6a0', sail: '#fbf6ea', sailShade: '#e3dccb' },
  },
  proa: {
    id: 'proa',
    name: 'Twin Proa',
    tag: 'Flies on a reach, hard to tip',
    blurb: 'Two hulls, a wide stance and almost impossible to capsize. Flies on a reach, but slides sideways upwind and turns like a raft.',
    unlock: 12,
    length: 12.5,
    beam: 7,
    sailPower: 0.0525,
    surgeDrag: 0.0315,
    surgeDragLinear: 0.05,
    swayDrag: 3.4,
    swayDragLinear: 6.5,
    turnRate: 1.08,
    rightingMoment: 135,
    trimSpeed: 1.5,
    toughness: 1,
    twin: true,
    stats: { speed: 4, pointing: 1, stability: 5, agility: 1, toughness: 3 },
    look: { hull: '#3f6f73', hullDark: '#264a4d', deck: '#c7b48a', sail: '#f2ede0', sailShade: '#d6cfbd' },
  },
  junk: {
    id: 'junk',
    name: 'Lantern Junk',
    tag: 'Tough, points high',
    blurb: 'A stout teak hull under a battened red sail. Points higher into the wind and shrugs off rocks, but it is no sprinter.',
    unlock: 18,
    length: 12,
    beam: 4.8,
    sailPower: 0.05,
    surgeDrag: 0.034,
    surgeDragLinear: 0.07,
    swayDrag: 6.6,
    swayDragLinear: 12,
    turnRate: 1.4,
    rightingMoment: 78,
    trimSpeed: 1.2,
    toughness: 1.8,
    battens: true,
    stats: { speed: 2, pointing: 4, stability: 4, agility: 2, toughness: 5 },
    look: { hull: '#6e3a24', hullDark: '#43200f', deck: '#b57a4c', sail: '#c4492f', sailShade: '#9e3a26' },
  },
};

// Shipyard order, which is also the order they unlock in.
export const BOAT_ORDER = ['sloop', 'skiff', 'proa', 'junk'];

export const CAPSIZE_ANGLE = 1.0; // radians (~57 degrees)
export const HEEL_WARNING = 0.72; // radians (~41 degrees)
export const BOOST_DURATION = 2.6;
export const BOOST_THRUST = 7.5;
// A dolphin pod riding the bow wave gives a gentle, steady push.
export const ESCORT_THRUST = 2.2;
const SIDE_DEADBAND = 0.05; // ~3 degrees either side of the centerline

export function createBoat(x, y, heading, type = BOAT_TYPES.sloop) {
  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    heading,
    yawRate: 0,
    rudder: 0,
    trim: 0.5,
    trimTarget: 0.5,
    heel: 0,
    boostTime: 0,
    escort: 0, // 0..1, how well a dolphin pod is riding the bow wave
    // Derived values the renderer, HUD and audio read every frame.
    beta: 0,
    side: 1,
    boom: 0.3,
    luffing: false,
    surge: 0,
    sway: 0,
    drive: 0,
    sideForce: 0,
    apparentSpeed: 0,
    optimalTrim: 0.5,
    trimQuality: 0,
  };
}

// One fixed physics step.
// input: { steer: -1..1 (right positive), trimTarget: 0..1, autoTrim: bool }
// env:   { wx, wy } true wind, { cx, cy } water current.
export function stepBoat(boat, input, env, dt) {
  const t = boat.type;
  const cos = Math.cos(boat.heading);
  const sin = Math.sin(boat.heading);
  // Bow and starboard unit vectors (y-down world).
  const fx = cos;
  const fy = sin;
  const sx = -sin;
  const sy = cos;

  // Apparent wind = true wind minus boat velocity over ground.
  const ax = env.wx - boat.vx;
  const ay = env.wy - boat.vy;
  const aLocalX = ax * fx + ay * fy;
  const aLocalY = ax * sx + ay * sy;
  const aSpeed2 = ax * ax + ay * ay;
  const { beta } = apparentAngle(aLocalX, aLocalY);
  // With the wind dead astern (or dead ahead) the boom stays on its side until
  // the wind is clearly on the other one, so it doesn't slam across every frame.
  let side = boat.side;
  if (Math.abs(aLocalY) > Math.sqrt(aSpeed2) * SIDE_DEADBAND) side = aLocalY >= 0 ? 1 : -1;

  const opt = optimalTrim(beta);
  if (input.autoTrim) {
    // The assistant trims well but not perfectly, and eases when over-heeled.
    const ease = clamp((Math.abs(boat.heel) - 0.55) * 1.6, 0, 0.45);
    boat.trimTarget = clamp(opt.trim + 0.03 + ease, 0, 1);
  } else {
    boat.trimTarget = clamp(input.trimTarget, 0, 1);
  }
  const trimStep = t.trimSpeed * dt;
  boat.trim += clamp(boat.trimTarget - boat.trim, -trimStep, trimStep);

  const coef = sailCoefficients(beta, boat.trim);
  const heelLoss = Math.cos(clamp(boat.heel, -1.4, 1.4));
  const q = t.sailPower * aSpeed2 * heelLoss * heelLoss;
  const driveF = coef.fx * q;
  const leeF = coef.fy * q; // toward leeward in the canonical frame
  const sideLocal = leeF * side; // starboard-positive

  // Hull drag uses velocity through the water, so currents carry the boat.
  const rvx = boat.vx - env.cx;
  const rvy = boat.vy - env.cy;
  const u = rvx * fx + rvy * fy;
  const w = rvx * sx + rvy * sy;
  const rudderDrag = 1 + 0.35 * Math.abs(boat.rudder);
  const dragU = (t.surgeDrag * u * Math.abs(u) + t.surgeDragLinear * u) * rudderDrag;
  const dragW = t.swayDrag * w * Math.abs(w) + t.swayDragLinear * w;

  let accU = driveF - dragU;
  const accW = sideLocal - dragW;
  if (boat.escort > 0) accU += ESCORT_THRUST * boat.escort;
  if (boat.boostTime > 0) {
    accU += BOOST_THRUST;
    boat.boostTime = Math.max(0, boat.boostTime - dt);
  }

  boat.vx += (accU * fx + accW * sx) * dt;
  boat.vy += (accU * fy + accW * sy) * dt;

  // Rudder authority grows with water flow past the blade; at a standstill
  // you can still scull a little with the tiller.
  boat.rudder = approach(boat.rudder, clamp(input.steer, -1, 1), 9, dt);
  const flow = clamp(Math.abs(u) / 6, 0, 1);
  const authority = 0.3 + 0.7 * flow;
  const targetYaw = boat.rudder * t.turnRate * authority;
  boat.yawRate = approach(boat.yawRate, targetYaw, 5, dt);
  boat.heading = wrapAngle(boat.heading + boat.yawRate * dt);

  // Heel follows the heeling force with some lag.
  const heelTarget = Math.atan(leeF / t.rightingMoment) * side;
  boat.heel = approach(boat.heel, heelTarget, 2.6, dt);

  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;

  boat.beta = beta;
  boat.side = side;
  boat.boom = coef.boom * -side; // boom swings to leeward (negative = port)
  boat.luffing = coef.luffing && aSpeed2 > 4;
  boat.surge = u;
  boat.sway = w;
  boat.drive = driveF;
  boat.sideForce = leeF;
  boat.apparentSpeed = Math.sqrt(aSpeed2);
  boat.optimalTrim = opt.trim;
  boat.trimQuality = opt.drive > 1e-6 ? clamp(coef.fx / opt.drive, 0, 1) : 0;
}

export function boatSpeed(boat) {
  return Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
}

// Points along the hull used for collisions: bow, middle and stern circles.
export function hullCircles(boat) {
  const L = boat.type.length;
  const r = boat.type.beam * 0.5;
  const c = Math.cos(boat.heading);
  const s = Math.sin(boat.heading);
  return [
    { x: boat.x + c * L * 0.32, y: boat.y + s * L * 0.32, r: r * 0.8 },
    { x: boat.x, y: boat.y, r },
    { x: boat.x - c * L * 0.32, y: boat.y - s * L * 0.32, r: r * 0.9 },
  ];
}
