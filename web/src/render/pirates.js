// The pirate brig and its cannonballs. The brig is drawn from above: a dark
// hull with gun ports, two masts of black square sails (furled while it lurks
// at anchor, set and drawing once it gives chase) and a skull flag streaming
// downwind. Each cannonball arcs through the air with its shadow below, and a
// red ring on the water marks where it will land.

import { clamp } from '../core/math.js';
import { PIRATE } from '../world/pirates.js';
import { viewBounds } from './camera.js';

const TAU = Math.PI * 2;
const LEN = PIRATE.length * 1.05;
const BEAM = PIRATE.beam * 1.05;
const ARC = 46; // how high a cannonball flies, in world units at the top of its arc

let hullPath = null;
let deckPath = null;

function paths() {
  if (hullPath) return;
  const L = LEN / 2;
  const B = BEAM / 2;
  hullPath = new Path2D();
  hullPath.moveTo(L, 0);
  hullPath.quadraticCurveTo(L * 0.55, -B * 1.02, 0, -B);
  hullPath.lineTo(-L * 0.82, -B * 0.9);
  hullPath.quadraticCurveTo(-L, -B * 0.86, -L * 0.98, 0);
  hullPath.quadraticCurveTo(-L, B * 0.86, -L * 0.82, B * 0.9);
  hullPath.lineTo(0, B);
  hullPath.quadraticCurveTo(L * 0.55, B * 1.02, L, 0);
  hullPath.closePath();
  deckPath = new Path2D();
  const l = L * 0.84;
  const b = B * 0.74;
  deckPath.moveTo(l, 0);
  deckPath.quadraticCurveTo(l * 0.5, -b * 1.02, 0, -b);
  deckPath.lineTo(-l * 0.92, -b * 0.92);
  deckPath.lineTo(-l * 0.92, b * 0.92);
  deckPath.lineTo(0, b);
  deckPath.quadraticCurveTo(l * 0.5, b * 1.02, l, 0);
  deckPath.closePath();
}

function visible(v, x, y, pad) {
  return x > v.minX - pad && x < v.maxX + pad && y > v.minY - pad && y < v.maxY + pad;
}

// On the water, under the boat: landing marks, the range ring and the brig itself.
export function drawPirates(ctx, game, cam, time) {
  const pir = game.pirates;
  if (!pir || !pir.ships.length) return;
  paths();
  const v = viewBounds(cam, 0);
  for (const b of pir.balls) drawTarget(ctx, b, time);
  for (const ship of pir.ships) {
    if (!visible(v, ship.x, ship.y, PIRATE.range + 40)) continue;
    if (ship.state === 'chase') drawRange(ctx, ship, game, time);
    if (visible(v, ship.x, ship.y, LEN)) drawShip(ctx, ship, game, time);
  }
}

// Above everything on the water: cannonballs in flight.
export function drawCannonballs(ctx, game) {
  const pir = game.pirates;
  if (!pir || !pir.balls.length) return;
  for (const b of pir.balls) {
    const p = clamp(b.t / b.flight, 0, 1);
    const x = b.x0 + (b.x1 - b.x0) * p;
    const y = b.y0 + (b.y1 - b.y0) * p;
    const h = 4 * ARC * p * (1 - p);
    ctx.fillStyle = `rgba(0, 10, 18, ${(0.4 - h / ARC / 4).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1, 2.4, 1.8, 0, 0, TAU);
    ctx.fill();
    const r = 2.6 + h * 0.035;
    ctx.fillStyle = '#16181c';
    ctx.beginPath();
    ctx.arc(x, y - h, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 244, 242, 0.55)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - h - r * 0.35, r * 0.35, 0, TAU);
    ctx.fill();
  }
}

function drawTarget(ctx, b, time) {
  const p = clamp(b.t / b.flight, 0, 1);
  const r = PIRATE.hit + 2 + (1 - p) * 16;
  const a = 0.35 + 0.5 * p;
  ctx.save();
  ctx.translate(b.x1, b.y1);
  ctx.rotate(time * 1.5);
  ctx.strokeStyle = `rgba(255, 92, 72, ${a.toFixed(3)})`;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const q = (i / 4) * TAU;
    ctx.moveTo(Math.cos(q) * (r - 4), Math.sin(q) * (r - 4));
    ctx.lineTo(Math.cos(q) * (r + 3), Math.sin(q) * (r + 3));
  }
  ctx.stroke();
  ctx.restore();
}

// While it chases, a faint ring shows how far its guns reach.
function drawRange(ctx, ship, game, time) {
  const d = Math.hypot(game.boat.x - ship.x, game.boat.y - ship.y);
  const k = clamp(1 - (d - PIRATE.range) / 120, 0, 1);
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 92, 72, ${(0.28 * k).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 9]);
  ctx.lineDashOffset = -time * 12;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, PIRATE.range, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawShip(ctx, ship, game, time) {
  const L = LEN / 2;
  const B = BEAM / 2;
  const w = game.pirates.wind;
  const set = ship.state !== 'lurk' || ship.speed > 1.5;
  const windLocal = Math.atan2(w.wy || 0, w.wx || 1) - ship.heading;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.heading + Math.sin(time * 0.9 + ship.home.x) * 0.015);

  // Shadow and wake.
  ctx.save();
  ctx.translate(2, 3);
  ctx.fillStyle = 'rgba(0, 10, 18, 0.38)';
  ctx.fill(hullPath);
  ctx.restore();
  if (ship.speed > 2) {
    const k = Math.min(1, ship.speed / 15);
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.25 + 0.45 * k).toFixed(3)})`;
    ctx.lineWidth = 1.6 + k;
    ctx.beginPath();
    ctx.moveTo(L * 0.25, -B * (1.25 + k * 0.4));
    ctx.quadraticCurveTo(L * 0.85, -B * 0.4, L * 1.03, 0);
    ctx.quadraticCurveTo(L * 0.85, B * 0.4, L * 0.25, B * (1.25 + k * 0.4));
    ctx.stroke();
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.15 + 0.25 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(-L * 1.0, -B * 0.5);
    ctx.lineTo(-L * (1.25 + k * 0.6), -B * (0.6 + k * 0.5));
    ctx.moveTo(-L * 1.0, B * 0.5);
    ctx.lineTo(-L * (1.25 + k * 0.6), B * (0.6 + k * 0.5));
    ctx.stroke();
  }

  // Hull, deck and gun ports.
  ctx.fillStyle = '#2e1d13';
  ctx.fill(hullPath);
  ctx.strokeStyle = '#120a06';
  ctx.lineWidth = 1;
  ctx.stroke(hullPath);
  ctx.fillStyle = '#8a5f3c';
  ctx.fill(deckPath);
  ctx.strokeStyle = 'rgba(46, 29, 19, 0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(-L * 0.76, i * B * 0.28);
    ctx.lineTo(L * 0.6 - Math.abs(i) * L * 0.12, i * B * 0.28);
  }
  ctx.stroke();
  ctx.fillStyle = '#0c0705';
  for (let i = 0; i < 4; i++) {
    const gx = -L * 0.55 + i * L * 0.3;
    ctx.fillRect(gx - 1.4, -B * 0.98, 2.8, 1.6);
    ctx.fillRect(gx - 1.4, B * 0.98 - 1.6, 2.8, 1.6);
  }
  // Bowsprit and stern cabin.
  ctx.strokeStyle = '#2e1d13';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(L * 0.9, 0);
  ctx.lineTo(L * 1.35, 0);
  ctx.stroke();
  ctx.fillStyle = '#5b3b25';
  ctx.fillRect(-L * 0.8, -B * 0.55, L * 0.3, B * 1.1);

  // Muzzle flash on the side that just fired.
  if (ship.flash > 0) {
    const k = ship.flash / 0.35;
    ctx.fillStyle = `rgba(255, 196, 92, ${(0.9 * k).toFixed(3)})`;
    if (ship.flashSide === 0) {
      ctx.beginPath();
      ctx.arc(L * 1.1, 0, 3 + 5 * k, 0, TAU);
      ctx.fill();
    } else {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-L * 0.55 + i * L * 0.3, ship.flashSide * (B + 2 + 3 * k), 2 + 3 * k, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Masts and square sails. Yards are braced across the wind and the sails
  // belly forward; at anchor the canvas is furled along the yards.
  const brace = clamp(-Math.sin(windLocal) * 0.6, -0.55, 0.55);
  const fill = set ? clamp(0.4 + ship.speed / 14, 0.4, 1) : 0;
  for (const [mx, span] of [[L * 0.3, BEAM * 1.5], [-L * 0.22, BEAM * 1.75]]) {
    ctx.save();
    ctx.translate(mx, 0);
    ctx.rotate(brace);
    const half = span / 2;
    if (fill > 0) {
      const depth = 4 + 7 * fill;
      ctx.fillStyle = 'rgba(0, 10, 18, 0.25)';
      ctx.beginPath();
      ctx.moveTo(-2, -half);
      ctx.quadraticCurveTo(depth * 2 - 2, 0, -2, half);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#26282d';
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.quadraticCurveTo(depth * 2, 0, 0, half);
      ctx.quadraticCurveTo(depth * 0.5, 0, 0, -half);
      ctx.fill();
      ctx.strokeStyle = '#3c3f46';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(depth * 0.5, -half * 0.6);
      ctx.quadraticCurveTo(depth * 1.3, 0, depth * 0.5, half * 0.6);
      ctx.stroke();
      if (mx < 0) drawSkull(ctx, depth * 0.85, 0, 3.2);
    }
    ctx.strokeStyle = '#1a0f09';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(0, half);
    ctx.stroke();
    if (!fill) {
      ctx.strokeStyle = '#4a4c52';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(1.2, -half * 0.9);
      ctx.lineTo(1.2, half * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a0f09';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // The black flag at the main masthead streams downwind.
  ctx.save();
  ctx.translate(-L * 0.22, 0);
  ctx.rotate(windLocal);
  const flap = Math.sin(time * 9 + ship.home.y) * 1.2;
  ctx.fillStyle = '#0d0e10';
  ctx.beginPath();
  ctx.moveTo(0, -2.6);
  ctx.quadraticCurveTo(5, -2.6 + flap, 10, -2.2 - flap * 0.5);
  ctx.lineTo(10, 2.2 - flap * 0.5);
  ctx.quadraticCurveTo(5, 2.6 + flap, 0, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath();
  ctx.arc(5, flap * 0.3, 1.1, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// A little skull and crossbones, painted on the mainsail.
function drawSkull(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2);
  ctx.strokeStyle = '#efe9dc';
  ctx.lineWidth = s * 0.32;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 1.1, s * 0.4);
  ctx.lineTo(s * 1.1, s * 1.7);
  ctx.moveTo(s * 1.1, s * 0.4);
  ctx.lineTo(-s * 1.1, s * 1.7);
  ctx.stroke();
  ctx.fillStyle = '#efe9dc';
  ctx.beginPath();
  ctx.arc(0, -s * 0.2, s * 0.8, 0, TAU);
  ctx.fill();
  ctx.fillRect(-s * 0.45, s * 0.3, s * 0.9, s * 0.5);
  ctx.fillStyle = '#26282d';
  ctx.beginPath();
  ctx.arc(-s * 0.32, -s * 0.2, s * 0.22, 0, TAU);
  ctx.arc(s * 0.32, -s * 0.2, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}
