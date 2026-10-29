// The boat seen from above: hull, deck, mast, boom and a sail that bellies
// with the wind, flutters when luffing and leans out as the boat heels.
// Also the wake it leaves behind and the masthead pennant. Sail designs and
// hull paints from the Sail Locker come in as a `look`; the skipper on deck
// comes in as `skipper` (see skipper.js).

import { C } from './palette.js';
import { clamp } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';
import { drawSkipper } from './skipper.js';

export const VISUAL = 1.7; // draw larger than the collision hull, so the boat reads clearly on a phone

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

function addHull(p, L, B, dy = 0) {
  p.moveTo(L * 0.5, dy);
  p.bezierCurveTo(L * 0.3, dy - B * 0.5, -L * 0.2, dy - B * 0.55, -L * 0.48, dy - B * 0.4);
  p.lineTo(-L * 0.5, dy + B * 0.4);
  p.bezierCurveTo(-L * 0.2, dy + B * 0.55, L * 0.3, dy + B * 0.5, L * 0.5, dy);
  p.closePath();
  return p;
}

// Hull outline and deck for a boat type; a twin-hulled boat gets two slim
// hulls a beam apart.
const hulls = new Map();
function hullShapes(type) {
  let h = hulls.get(type.id);
  if (!h) {
    const L = type.length * VISUAL;
    const B = type.beam * VISUAL;
    if (type.twin) {
      const off = B * 0.36;
      const path = addHull(addHull(new Path2D(), L, B * 0.28, -off), L, B * 0.28, off);
      const deck = addHull(addHull(new Path2D(), L * 0.8, B * 0.16, -off), L * 0.8, B * 0.16, off);
      h = { path, deck, off };
    } else {
      h = { path: addHull(new Path2D(), L, B), deck: addHull(new Path2D(), L * 0.86, B * 0.72), off: 0 };
    }
    hulls.set(type.id, h);
  }
  return h;
}

// Sail designs: marks painted over the cloth in sail coordinates (see
// data/locker.js). `map(u, h)` turns them into boat coordinates.
const K = 0.54; // foot length over luff length, so discs come out round on the cloth

function trace(ctx, map, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = map(pts[i][0], pts[i][1]);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function ring(u, h, r, n = 20) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([u + Math.cos(a) * r, h + Math.sin(a) * r * K]);
  }
  return pts;
}

// A strip of cloth between two lines across the sail, h = f(u) +/- half.
function ribbon(f, half, u0 = -0.15, u1 = 1.2, n = 18) {
  const top = [];
  const bottom = [];
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    top.push([u, f(u) + half]);
    bottom.push([u, f(u) - half]);
  }
  return top.concat(bottom.reverse());
}

// The same, running up the sail: u = u0..u1 from the foot to the head.
function strip(u0, u1, n = 12) {
  const a = [];
  const b = [];
  for (let i = 0; i <= n; i++) {
    const h = -0.15 + (1.3 * i) / n;
    a.push([u0, h]);
    b.push([u1, h]);
  }
  return a.concat(b.reverse());
}

function drawMarks(ctx, marks, map, cloth) {
  for (const m of marks) {
    ctx.fillStyle = m.color || '#ffffff';
    if (m.band) {
      const [h0, h1] = m.band;
      trace(ctx, map, ribbon(() => (h0 + h1) / 2, (h1 - h0) / 2));
      ctx.fill();
    } else if (m.panel) {
      trace(ctx, map, strip(m.panel[0], m.panel[1]));
      ctx.fill();
    } else if (m.line) {
      const [h, amp, waves] = m.line;
      const wave = m.sharp ? (x) => (2 / Math.PI) * Math.asin(Math.sin(x)) : Math.sin;
      trace(ctx, map, ribbon((u) => h + amp * wave(u * waves * Math.PI * 2), (m.width * K) / 2, -0.15, 1.2, 40));
      ctx.fill();
    } else if (m.disc) {
      trace(ctx, map, ring(...m.disc));
      ctx.fill();
    } else if (m.dots) {
      for (const [u, h] of m.dots) {
        trace(ctx, map, ring(u, h, m.r, 12));
        ctx.fill();
      }
    } else if (m.star) {
      const [u, h, r] = m.star;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const R = i % 2 ? r * 0.42 : r;
        pts.push([u + Math.cos(a) * R, h - Math.sin(a) * R * K]);
      }
      trace(ctx, map, pts);
      ctx.fill();
    } else if (m.grid) {
      ctx.fillStyle = m.color;
      for (let i = 1; i < m.grid; i++) {
        const t = i / m.grid;
        trace(ctx, map, ribbon(() => t, 0.008));
        ctx.fill();
        trace(ctx, map, strip(t - 0.008, t + 0.008));
        ctx.fill();
      }
    } else if (m.skull) {
      const [u, h, r] = m.skull;
      const bone = r * 0.16 * K;
      // Crossbones behind, then the skull and its jaw, then the eyes.
      for (const s of [-1, 1]) {
        trace(ctx, map, [
          [u - r * 1.3, h - s * r * K * 1.6 - bone],
          [u + r * 1.3, h + s * r * K * 1.6 - bone],
          [u + r * 1.3, h + s * r * K * 1.6 + bone],
          [u - r * 1.3, h - s * r * K * 1.6 + bone],
        ]);
        ctx.fill();
      }
      trace(ctx, map, ring(u, h + r * K * 0.15, r));
      ctx.fill();
      trace(ctx, map, [
        [u - r * 0.55, h - r * K * 0.6],
        [u + r * 0.55, h - r * K * 0.6],
        [u + r * 0.55, h - r * K * 1.15],
        [u - r * 0.55, h - r * K * 1.15],
      ]);
      ctx.fill();
      ctx.fillStyle = cloth;
      for (const s of [-1, 1]) {
        trace(ctx, map, ring(u + s * r * 0.4, h + r * K * 0.2, r * 0.27, 12));
        ctx.fill();
      }
    }
  }
}

// A sail hanging flat in the Sail Locker, `h` tall with its head at (x, y).
export function drawSailFlat(ctx, look, x, y, h) {
  const w = h * K;
  const cloth = new Path2D();
  cloth.moveTo(x, y + h);
  cloth.quadraticCurveTo(x + w * 0.5, y + h * 1.03, x + w, y + h);
  cloth.quadraticCurveTo(x + w * 0.64, y + h * 0.44, x, y);
  cloth.closePath();
  ctx.fillStyle = look.sail;
  ctx.fill(cloth);
  if (look.marks) {
    ctx.save();
    ctx.clip(cloth);
    drawMarks(ctx, look.marks, (u, v) => [x + u * w, y + h - v * h], look.sail);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(80, 70, 55, 0.55)';
  ctx.lineWidth = Math.max(0.6, h * 0.012);
  ctx.stroke(cloth);
  // Mast and boom.
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, h * 0.035);
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.05);
  ctx.lineTo(x, y + h * 1.06);
  ctx.moveTo(x - h * 0.02, y + h * 1.02);
  ctx.lineTo(x + w * 1.06, y + h * 1.02);
  ctx.stroke();
}

// `state` carries game status flags used for capsize/sink looks, and the
// Sail Locker `look` to paint the boat in.
export function drawBoat(ctx, boat, time, state = {}) {
  const type = boat.type;
  const look = state.look || type.look;
  const L = type.length * VISUAL;
  const B = type.beam * VISUAL;
  const hull = hullShapes(type);
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
  ctx.fill(hull.path);
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
  if (type.twin) {
    // Trampoline net and cross beams between the hulls.
    ctx.fillStyle = 'rgba(30, 40, 38, 0.55)';
    ctx.fillRect(-L * 0.28, -hull.off, L * 0.46, hull.off * 2);
    ctx.strokeStyle = look.deck;
    ctx.lineWidth = 1.1;
    for (const x of [-L * 0.28, L * 0.18]) {
      ctx.beginPath();
      ctx.moveTo(x, -hull.off);
      ctx.lineTo(x, hull.off);
      ctx.stroke();
    }
  }
  ctx.fillStyle = look.hull;
  ctx.fill(hull.path);
  if (look.trim) {
    // A painted stripe just inside the gunwale.
    ctx.save();
    ctx.clip(hull.path);
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 1.3;
    ctx.stroke(hull.path);
    ctx.restore();
  }
  ctx.strokeStyle = look.hullDark;
  ctx.lineWidth = 0.9;
  ctx.stroke(hull.path);
  ctx.fillStyle = look.deck;
  ctx.fill(hull.deck);
  if (!type.twin) {
    ctx.strokeStyle = 'rgba(94, 59, 37, 0.5)';
    ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.38, i * B * 0.12);
      ctx.lineTo(L * 0.3, i * B * 0.08);
      ctx.stroke();
    }
    // Cockpit and the empty oarlock where the oar used to be.
    ctx.fillStyle = look.hullDark;
    ctx.fillRect(-L * 0.36, -B * 0.18, L * 0.2, B * 0.36);
    ctx.fillStyle = '#3a2416';
    ctx.beginPath();
    ctx.arc(-L * 0.12, -B * 0.42, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!type.twin && state.skipper) {
    // The tiller, swinging opposite the rudder blade.
    const a = boat.rudder * 0.6;
    ctx.strokeStyle = '#4a3220';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, 0);
    ctx.lineTo(-L * 0.5 + Math.cos(a) * L * 0.22, Math.sin(a) * L * 0.22);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // Castaways hauled aboard sit in the cockpit, or out on a proa's net.
  (state.crew || []).forEach((sailor, i) => {
    const cx = type.twin ? -L * 0.18 + i * L * 0.12 : -L * 0.31 + i * L * 0.08;
    const cy = (i % 2 ? 1 : -1) * (type.twin ? hull.off * 0.45 : B * 0.08);
    ctx.fillStyle = sailor.shirt;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 1.7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sailor.skin;
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  const g = { L, B, twin: !!type.twin };
  if (state.skipper && !state.capsized) {
    ctx.save();
    drawSkipper(ctx, state.skipper, g, boat, time);
    ctx.restore();
  }
  ctx.restore();

  // Rudder (one per hull).
  ctx.strokeStyle = look.hullDark;
  ctx.lineWidth = 1.2;
  for (const dy of type.twin ? [-hull.off, hull.off] : [0]) {
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, dy);
    ctx.lineTo(-L * 0.5 - Math.cos(boat.rudder * 0.6) * 3, dy + Math.sin(-boat.rudder * 0.6) * 3);
    ctx.stroke();
  }

  if (state.capsized) {
    // Sail lies flat in the water.
    ctx.fillStyle = look.sail;
    ctx.globalAlpha *= 0.75;
    const side = Math.sign(heel || 1);
    ctx.beginPath();
    ctx.moveTo(L * 0.1, 0);
    ctx.lineTo(-L * 0.3, side * L * 0.9);
    ctx.lineTo(L * 0.3, side * L * 0.8);
    ctx.closePath();
    ctx.fill();
    if (state.skipper) {
      ctx.globalAlpha /= 0.75;
      drawSkipper(ctx, state.skipper, g, boat, time, true);
    }
    ctx.restore();
    return;
  }

  // Mast at a third of the length.
  const mx = L * 0.12;
  const mastH = L * 1.15;
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
  // Seen straight down a sail is a sliver, so the masthead is drawn leaning
  // well out to leeward of the boom, further as she heels and fills: the cloth
  // always shows as a full triangle that swings with the trim.
  const lean = mastH * (0.3 + 0.55 * Math.abs(sinHeel)) * (boat.luffing ? 0.55 : 0.75 + 0.25 * drive);
  const topX = mx + nX * lean;
  const topY = nY * lean;
  const belly = 1.2 + drive * 2.8;
  const midFootX = (mx + bx) / 2 + nX * (belly + flutter);
  const midFootY = by / 2 + nY * (belly + flutter);
  const midLeechX = (topX + bx) / 2 + nX * (belly * 0.6 - flutter);
  const midLeechY = (topY + by) / 2 + nY * (belly * 0.6 - flutter);

  const cloth = new Path2D();
  cloth.moveTo(mx, 0);
  cloth.quadraticCurveTo(midFootX, midFootY, bx, by);
  cloth.quadraticCurveTo(midLeechX, midLeechY, topX, topY);
  cloth.closePath();
  // Its shadow falls on the water down and to the right, away from the hull,
  // which is what makes it read as standing up.
  ctx.save();
  const sx = 4 + Math.abs(sinHeel) * 4;
  const sy = 7 + Math.abs(sinHeel) * 4;
  ctx.translate(sx * Math.cos(boat.heading) + sy * Math.sin(boat.heading), sy * Math.cos(boat.heading) - sx * Math.sin(boat.heading));
  ctx.fillStyle = 'rgba(0, 10, 18, 0.22)';
  ctx.fill(cloth);
  ctx.restore();
  ctx.fillStyle = boat.luffing ? look.sailShade : look.sail;
  ctx.fill(cloth);
  if (!look.marks) {
    // A soft shade in the belly along the foot gives the cloth some depth.
    ctx.save();
    ctx.clip(cloth);
    ctx.strokeStyle = look.sailShade;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 2 + drive * 2;
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.quadraticCurveTo(midFootX, midFootY, bx, by);
    ctx.stroke();
    ctx.restore();
  }
  if (look.marks) {
    // Sail coordinates to boat coordinates, following the belly of the cloth:
    // the foot and leech curves above, blended across the sail.
    const footBelly = belly + flutter;
    const leechBelly = belly * 0.6 - flutter;
    const map = (u, h) => {
      const w = h < 1 ? clamp(u / (1 - h), -0.5, 1.5) : 0;
      const bulge = (1 - h) * (2 * w * (1 - w) * footBelly + 2 * w * h * leechBelly);
      return [mx + u * (bx - mx) + h * (topX - mx) + nX * bulge, u * by + h * topY + nY * bulge];
    };
    ctx.save();
    ctx.clip(cloth);
    if (boat.luffing) ctx.globalAlpha *= 0.82;
    drawMarks(ctx, look.marks, map, boat.luffing ? look.sailShade : look.sail);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(60, 50, 38, 0.7)';
  ctx.lineWidth = 0.9;
  ctx.stroke(cloth);
  // Sail seams, or the stiff bamboo battens of a junk rig.
  const seams = type.battens ? 5 : 3;
  ctx.strokeStyle = type.battens ? 'rgba(60, 25, 12, 0.7)' : 'rgba(120, 110, 95, 0.3)';
  ctx.lineWidth = type.battens ? 0.8 : 0.6;
  for (let i = 1; i < seams; i++) {
    const t = i / seams;
    ctx.beginPath();
    ctx.moveTo(mx + (topX - mx) * t, topY * t);
    ctx.lineTo(mx + (bx - mx) * (1 - t) + (topX - mx) * t, by * (1 - t) + topY * t);
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
  const hull = hullShapes(type);
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);
  ctx.globalAlpha = pose.done ? 0.3 : 0.55 + Math.sin(time * 3) * 0.08;
  ctx.save();
  ctx.scale(1, Math.max(0.35, Math.abs(Math.cos(pose.heel))));
  ctx.fillStyle = 'rgba(160, 235, 255, 0.4)';
  ctx.fill(hull.path);
  ctx.strokeStyle = 'rgba(200, 245, 255, 0.95)';
  ctx.lineWidth = 1.1;
  ctx.setLineDash([2.5, 2]);
  ctx.stroke(hull.path);
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
