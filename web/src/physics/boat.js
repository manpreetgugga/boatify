// Boat state and the per-step dynamics: sail force from the apparent wind,
// keel and hull drag in the water (which may itself be moving), rudder yaw and
// heel. Units are game units (see KNOTS_PER_UNIT) and seconds.

import { approach, clamp, wrapAngle } from '../core/math.js';
import { sailCoefficients, apparentAngle, optimalTrim } from './sailing.js';

export const BOAT_TYPES = {
  sloop: {
    id: 'sloop',
    name: 'Driftwood Sloop',
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
  },
};

export const CAPSIZE_ANGLE = 1.0; // radians (~57 degrees)
export const HEEL_WARNING = 0.72; // radians (~41 degrees)
export const BOOST_DURATION = 2.6;
export const BOOST_THRUST = 7.5;

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
  const { beta, side } = apparentAngle(aLocalX, aLocalY);

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
