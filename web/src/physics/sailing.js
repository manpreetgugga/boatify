// Sail aerodynamics. Pure functions so they can be unit tested and reused by
// the HUD (trim gauge) and the autopilot.
//
// Conventions inside this file use a "canonical" boat frame: x points to the
// bow, y points to the leeward side (the side the wind blows toward). The
// apparent wind angle beta is where the wind comes FROM, measured from the bow:
// 0 = head to wind ("in irons"), PI/2 = beam reach, PI = dead run.

import { clamp, smoothstep, DEG } from '../core/math.js';

export const SAIL = {
  clMax: 1.4,
  alphaPeak: 26 * DEG,
  cd0: 0.07,
  cdInduced: 0.11,
  cdMax: 1.3,
  boomMin: 4 * DEG,
  boomMax: 88 * DEG,
  // Below this apparent wind angle the sail cannot drive the boat.
  noGoStart: 20 * DEG,
  noGoEnd: 34 * DEG,
};

export function liftCoef(alpha) {
  if (alpha <= 0) return 0;
  const { clMax, alphaPeak } = SAIL;
  if (alpha <= alphaPeak) return clMax * Math.sin((alpha / alphaPeak) * (Math.PI / 2));
  const t = clamp((alpha - alphaPeak) / (Math.PI / 2 - alphaPeak), 0, 1);
  return clMax * Math.cos(t * (Math.PI / 2));
}

export function dragCoef(alpha, cl) {
  const s = Math.sin(alpha);
  return SAIL.cd0 + SAIL.cdInduced * cl * cl + (SAIL.cdMax - SAIL.cd0) * s * s;
}

export function trimToBoom(trim) {
  return SAIL.boomMin + (SAIL.boomMax - SAIL.boomMin) * clamp(trim, 0, 1);
}

export function boomToTrim(boom) {
  return clamp((boom - SAIL.boomMin) / (SAIL.boomMax - SAIL.boomMin), 0, 1);
}

// Force coefficients (per unit dynamic pressure) in the canonical frame for a
// given apparent wind angle and sheet setting. Returns the actual boom angle,
// the angle of attack and whether the sail is luffing (flapping).
export function sailCoefficients(beta, trim) {
  const boomLimit = trimToBoom(trim);
  const boom = Math.min(boomLimit, beta);
  let alpha = beta - boom;
  const luffing = boomLimit >= beta - 2 * DEG;
  let liftSign = 1;
  if (alpha > Math.PI / 2) {
    // Wind hitting the sail from behind its chord: treat as a mirrored plate.
    alpha = Math.PI - alpha;
    liftSign = -1;
  }
  const cl = liftCoef(alpha) * liftSign;
  const cd = dragCoef(alpha, cl);
  const sinB = Math.sin(beta);
  const cosB = Math.cos(beta);
  // Flow direction f = (-cos b, sin b); lift is f rotated -90deg = (sin b, cos b).
  const pointing = smoothstep(SAIL.noGoStart, SAIL.noGoEnd, beta);
  let fx = cl * sinB - cd * cosB;
  const fy = cl * cosB + cd * sinB;
  if (fx > 0) fx *= pointing;
  return { fx, fy, boom, alpha, luffing };
}

// Apparent wind angle (0..PI) and leeward side (+1 = starboard, -1 = port)
// from an apparent wind vector expressed in the boat frame (x = bow,
// y = starboard), where the vector is the direction the air moves.
export function apparentAngle(ax, ay) {
  const side = ay >= 0 ? 1 : -1;
  const beta = Math.atan2(Math.abs(ay), -ax);
  return { beta, side };
}

// Best sheet setting for a given apparent wind angle: maximise forward drive.
export function optimalTrim(beta) {
  let best = 0;
  let bestDrive = -Infinity;
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const { fx } = sailCoefficients(beta, t);
    if (fx > bestDrive + 1e-9) {
      bestDrive = fx;
      best = t;
    }
  }
  return { trim: best, drive: bestDrive };
}

// 0..1 rating of how well the sail is trimmed (1 = perfect).
export function trimEfficiency(beta, trim) {
  const opt = optimalTrim(beta);
  if (opt.drive <= 1e-6) return 0;
  const { fx } = sailCoefficients(beta, trim);
  return clamp(fx / opt.drive, 0, 1);
}

// Beaufort scale from wind speed in knots.
const BEAUFORT = [
  [1, 0, 'Calm'],
  [4, 1, 'Light air'],
  [7, 2, 'Light breeze'],
  [11, 3, 'Gentle breeze'],
  [17, 4, 'Moderate breeze'],
  [22, 5, 'Fresh breeze'],
  [28, 6, 'Strong breeze'],
  [34, 7, 'Near gale'],
  [41, 8, 'Gale'],
  [48, 9, 'Strong gale'],
  [56, 10, 'Storm'],
  [64, 11, 'Violent storm'],
  [Infinity, 12, 'Hurricane'],
];

export function beaufort(knots) {
  for (const [limit, force, name] of BEAUFORT) {
    if (knots < limit) return { force, name };
  }
  return { force: 12, name: 'Hurricane' };
}

// Game speed units -> knots shown on the instruments. Sailing runs a little
// faster than real time (PACE in world/game.js), and the dial reads to match:
// the best angle shows 25 knots in a fresh breeze and 30 in a strong one.
export const KNOTS_PER_UNIT = 1.4;

export function toKnots(unitsPerSecond) {
  return unitsPerSecond * KNOTS_PER_UNIT;
}

// One game unit is about 0.31 m: the 11-unit sloop is a 3.4 m dinghy.
// Fixed, so distances, Open Sea records and medals keep their meaning.
export const METERS_PER_UNIT = 0.6 * 0.5144;

export function toMeters(units) {
  return units * METERS_PER_UNIT;
}

// "830 m", or "2.41 km" from a kilometer up.
export function formatDistance(units) {
  const m = toMeters(units);
  return m < 1000 ? `${Math.floor(m)} m` : `${(Math.floor(m / 10) / 100).toFixed(2)} km`;
}
