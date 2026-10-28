// The boat seen from above: hull, deck, mast, boom and a sail that bellies
// with the wind, flutters when luffing and leans out as the boat heels.
// Also the wake it leaves behind and the masthead pennant.

import { C } from './palette.js';
import { boatSpeed } from '../physics/boat.js';

const VISUAL = 1.45; // draw a touch larger than the collision hull

export function createWake() {
  return { points: [], last: -Infinity };
}

// `time` is simulation time, so the wake freezes on pause and keeps its
// shape when playtests run the game faster than real time.
export function updateWake(wake, boat, time, active) {
  const speed = boatSpeed(boat);
  if (time < wake.last) wake.points.length = 0; // a new voyage restarted the clock
  if (active && speed > 1.2 && time - wake.last >= 0.07) {
    wake.last = time;
    const c = Math.cos(boat.heading);
    const s = Math.sin(boat.heading);
    const L = boat.type.length * VISUAL;
    wake.points.push({ x: boat.x - c * L * 0.45, y: boat.y - s * L * 0.45, nx: -s, ny: c, t: time, spd: speed });
  }
  while (wake.points.length && time - wake.points[0].t > 3.2) wake.points.shift();
}

export function drawWake(ctx, wake, time) {
  const pts = wake.points;
  if (pts.length < 2) return;
  ctx.lineCap = 'round';
  for (const sideSign of [-1, 1]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const ageA = time - a.t;
      const ageB = time - b.t;
      if (b.t - a.t > 0.3) continue;
      const alpha = Math.max(0, 1 - ageB / 3.2) * Math.min(1, b.spd / 10) * 0.55;
      if (alpha <= 0.01) continue;
      const spreadA = 2 + ageA * (2 + a.spd * 0.28);
      const spreadB = 2 + ageB * (2 + b.spd * 0.28);
      ctx.strokeStyle = `rgba(232, 244, 242, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.6 + ageB * 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x + a.nx * spreadA * sideSign, a.y + a.ny * spreadA * sideSign);
      ctx.lineTo(b.x + b.nx * spreadB * sideSign, b.y + b.ny * spreadB * sideSign);
      ctx.stroke();
    }
  }
  // Turbulent centre line.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b.t - a.t > 0.3) continue;
    const age = time - b.t;
    const alpha = Math.max(0, 1 - age / 1.4) * Math.min(1, b.spd / 8) * 0.2;
    if (alpha <= 0.01) continue;
    ctx.strokeStyle = `rgba(232, 244, 242, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2.5 + age * 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function hullPath(L, B) {
  const p = new Path2D();
  p.moveTo(L * 0.5, 0);
  p.bezierCurveTo(L * 0.3, -B * 0.5, -L * 0.2, -B * 0.55, -L * 0.48, -B * 0.4);
  p.lineTo(-L * 0.5, B * 0.4);
  p.bezierCurveTo(-L * 0.2, B * 0.55, L * 0.3, B * 0.5, L * 0.5, 0);
  p.closePath();
  return p;
}

let hullCache = null;

// `state` carries game status flags used for capsize/sink looks.
export function drawBoat(ctx, boat, time, state = {}) {
  const L = boat.type.length * VISUAL;
  const B = boat.type.beam * VISUAL;
  if (!hullCache || hullCache.L !== L) hullCache = { L, path: hullPath(L, B), deck: hullPath(L * 0.86, B * 0.72) };
  const heel = boat.heel;
  const cosHeel = Math.cos(heel);
  const sinHeel = Math.sin(heel);
  const sinking = state.sinking || 0;

  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(boat.heading);
  if (sinking > 0) {
    ctx.globalAlpha = Math.max(0, 1 - sinking);
    ctx.scale(1 - sinking * 0.4, 1 - sinking * 0.4);
  }

  // Shadow on the water, pushed to leeward when heeling.
  ctx.save();
  ctx.translate(1.5, 2.5 + sinHeel * 3);
  ctx.fillStyle = 'rgba(0, 10, 18, 0.35)';
  ctx.fill(hullCache.path);
  ctx.restore();

  // Bow wave.
  const speed = boatSpeed(boat);
  if (speed > 3) {
    const k = Math.min(1, speed / 16);
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.25 + 0.45 * k).toFixed(3)})`;
    ctx.lineWidth = 1.4 + k;
    ctx.beginPath();
    ctx.moveTo(L * 0.2, -B * (0.62 + k * 0.25));
    ctx.quadraticCurveTo(L * 0.5, -B * 0.2, L * 0.55, 0);
    ctx.quadraticCurveTo(L * 0.5, B * 0.2, L * 0.2, B * (0.62 + k * 0.25));
    ctx.stroke();
  }

  // Hull squashes across the beam as it heels.
  ctx.save();
  ctx.scale(1, Math.max(0.35, Math.abs(cosHeel)));
  ctx.translate(0, sinHeel * 1.2);
  ctx.fillStyle = C.hull;
  ctx.fill(hullCache.path);
  ctx.strokeStyle = C.hullDark;
  ctx.lineWidth = 0.9;
  ctx.stroke(hullCache.path);
  ctx.fillStyle = C.deck;
  ctx.fill(hullCache.deck);
  ctx.strokeStyle = 'rgba(94, 59, 37, 0.5)';
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-L * 0.38, i * B * 0.12);
    ctx.lineTo(L * 0.3, i * B * 0.08);
    ctx.stroke();
  }
  // Cockpit and the empty oarlock where the oar used to be.
  ctx.fillStyle = C.hullDark;
  ctx.fillRect(-L * 0.36, -B * 0.18, L * 0.2, B * 0.36);
  ctx.fillStyle = '#3a2416';
  ctx.beginPath();
  ctx.arc(-L * 0.12, -B * 0.42, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rudder.
  ctx.strokeStyle = C.hullDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-L * 0.5, 0);
  ctx.lineTo(-L * 0.5 - Math.cos(boat.rudder * 0.6) * 3, Math.sin(-boat.rudder * 0.6) * 3);
  ctx.stroke();

  if (state.capsized) {
    // Sail lies flat in the water.
    ctx.fillStyle = 'rgba(245, 240, 228, 0.75)';
    const side = Math.sign(heel || 1);
    ctx.beginPath();
    ctx.moveTo(L * 0.1, 0);
    ctx.lineTo(-L * 0.3, side * L * 0.9);
    ctx.lineTo(L * 0.3, side * L * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // Mast at a third of the length; its top leans to leeward with the heel.
  const mx = L * 0.12;
  const mastH = L * 1.15;
  const topX = mx;
  const topY = sinHeel * mastH;
  const boomLen = L * 0.62;
  const boom = boat.boom;
  const bx = mx - Math.cos(boom) * boomLen;
  const by = Math.sin(boom) * boomLen;

  // Sail: luff from mast base to the projected masthead, foot along the boom.
  const drive = Math.min(1, Math.max(0, boat.drive) / 6);
  const flutter = boat.luffing ? Math.sin(time * 38) * 2.2 : 0;
  // The cloth bellies out to leeward, more when it is pulling hard.
  const leeSide = Math.sign(boom) || 1;
  let nX = Math.sin(boom);
  let nY = Math.cos(boom);
  if (nY * leeSide < 0) {
    nX = -nX;
    nY = -nY;
  }
  const belly = 1.2 + drive * 2.8;
  const midFootX = (mx + bx) / 2 + nX * (belly + flutter);
  const midFootY = by / 2 + nY * (belly + flutter);
  const midLeechX = (topX + bx) / 2 + nX * (belly * 0.6 - flutter);
  const midLeechY = (topY + by) / 2 + nY * (belly * 0.6 - flutter);

  ctx.fillStyle = boat.luffing ? C.sailShade : C.sail;
  ctx.strokeStyle = 'rgba(80, 70, 55, 0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(mx, 0);
  ctx.quadraticCurveTo(midFootX, midFootY, bx, by);
  ctx.quadraticCurveTo(midLeechX, midLeechY, topX, topY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Sail seams.
  ctx.strokeStyle = 'rgba(120, 110, 95, 0.25)';
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    ctx.beginPath();
    ctx.moveTo(mx, topY * t);
    ctx.lineTo(mx + (bx - mx) * (1 - t), by * (1 - t) + topY * t);
    ctx.stroke();
  }

  // Boom.
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(mx, 0);
  ctx.lineTo(bx, by);
  ctx.stroke();
  // Mast, seen from above as a short line toward the masthead.
  ctx.strokeStyle = '#4a3220';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(mx, 0);
  ctx.lineTo(topX, topY);
  ctx.stroke();
  ctx.fillStyle = '#4a3220';
  ctx.beginPath();
  ctx.arc(mx, 0, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Masthead pennant streams with the apparent wind.
  if (state.pennant) {
    const [awx, awy] = state.pennant;
    const c = Math.cos(-boat.heading);
    const s = Math.sin(-boat.heading);
    const lx = awx * c - awy * s;
    const ly = awx * s + awy * c;
    const l = Math.hypot(lx, ly) || 1;
    const px = (lx / l) * 6;
    const py = (ly / l) * 6;
    const wv = Math.sin(time * 18) * 0.8;
    ctx.fillStyle = C.signal;
    ctx.beginPath();
    ctx.moveTo(topX, topY - 0.8);
    ctx.lineTo(topX + px - py * 0.12 + wv * (ly / l), topY + py + px * 0.12 - wv * (lx / l));
    ctx.lineTo(topX, topY + 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // Boost: a bright ring of escaping bottled wind behind the sail.
  if (boat.boostTime > 0) {
    ctx.strokeStyle = `rgba(160, 235, 255, ${(0.4 + 0.4 * Math.sin(time * 20)).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const off = ((time * 30 + i * 6) % 18) + 4;
      ctx.beginPath();
      ctx.arc(bx - off, by * 0.7, 3 + off * 0.3, -1, 1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The best run's boat: a pale outline with a sail, no physics.
export function drawGhost(ctx, pose, type, time) {
  const L = type.length * VISUAL;
  const B = type.beam * VISUAL;
  if (!hullCache || hullCache.L !== L) hullCache = { L, path: hullPath(L, B), deck: hullPath(L * 0.86, B * 0.72) };
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);
  ctx.globalAlpha = pose.done ? 0.3 : 0.55 + Math.sin(time * 3) * 0.08;
  ctx.save();
  ctx.scale(1, Math.max(0.35, Math.abs(Math.cos(pose.heel))));
  ctx.fillStyle = 'rgba(160, 235, 255, 0.4)';
  ctx.fill(hullCache.path);
  ctx.strokeStyle = 'rgba(200, 245, 255, 0.95)';
  ctx.lineWidth = 1.1;
  ctx.setLineDash([2.5, 2]);
  ctx.stroke(hullCache.path);
  ctx.setLineDash([]);
  ctx.restore();
  // A simple sail wedge along the centreline, leaning with the heel.
  const mx = L * 0.12;
  const lean = Math.sin(pose.heel) * L * 1.15;
  ctx.fillStyle = 'rgba(220, 248, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(mx, 0);
  ctx.lineTo(mx - L * 0.6, lean * 0.15);
  ctx.lineTo(mx, lean);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
