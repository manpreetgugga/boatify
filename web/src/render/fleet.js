// The regatta fleet on the water: each rival's wake, the dirty air it trails
// downwind, and the boat itself in its racing colors.

import { createWake, updateWake, drawWake, drawBoat } from './boat.js';
import { helmsman } from './skipper.js';
import { DIRTY_REACH, shadowWidth } from '../world/regatta.js';
import { C, font, rgba } from './palette.js';
import { t } from '../i18n/index.js';

const RIVAL_JACKETS = ['#d9473a', '#3f8f5a', '#4a6fb5'];

export function createFleetFx() {
  return { wakes: [] };
}

export function updateFleetFx(fx, game) {
  const race = game.race;
  if (!race) return;
  race.rivals.forEach((r, i) => {
    const wake = fx.wakes[i] || (fx.wakes[i] = createWake());
    updateWake(wake, r.boat, game.clock, r.capsized <= 0);
  });
}

export function drawFleetWakes(ctx, fx, game) {
  if (!game.race) return;
  for (const wake of fx.wakes) drawWake(ctx, wake, game.clock);
}

// A faint dark fan downwind of each sail: where its wind shadow falls.
export function drawDirtyAir(ctx, game, time) {
  const race = game.race;
  if (!race || game.status === 'finished') return;
  const dx = Math.cos(game.wind.angle);
  const dy = Math.sin(game.wind.angle);
  const w0 = shadowWidth(6);
  const w1 = shadowWidth(DIRTY_REACH);
  for (const r of race.rivals) {
    if (r.finished !== null || r.capsized > 0) continue;
    const { x, y } = r.boat;
    const g = ctx.createLinearGradient(x, y, x + dx * DIRTY_REACH, y + dy * DIRTY_REACH);
    // It breathes a little, so it reads as moving air rather than a stain.
    const a = 0.16 + 0.04 * Math.sin(time * 2 + x * 0.01);
    g.addColorStop(0, `rgba(6, 22, 34, ${a.toFixed(3)})`);
    g.addColorStop(1, 'rgba(6, 22, 34, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + dx * 6 - dy * w0, y + dy * 6 + dx * w0);
    ctx.lineTo(x + dx * DIRTY_REACH - dy * w1, y + dy * DIRTY_REACH + dx * w1);
    ctx.lineTo(x + dx * DIRTY_REACH + dy * w1, y + dy * DIRTY_REACH - dx * w1);
    ctx.lineTo(x + dx * 6 + dy * w0, y + dy * 6 - dx * w0);
    ctx.closePath();
    ctx.fill();
  }
}

// The racing line: the leg being sailed in bright dashes running on toward
// the mark, from the point on it nearest the boat, with the next tack (or
// gybe) ringed; the legs after it faint, to show where the course goes.
export function drawRacingLine(ctx, game, cam, time) {
  const race = game.race;
  if (!race || !race.line || game.status === 'finished') return;
  const s = 1 / cam.scale;
  const legs = race.line;
  const at = Math.min(game.nextCheckpoint, legs.length - 1);
  const trace = (pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([5 * s, 9 * s]);
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.22)';
  ctx.lineWidth = 2 * s;
  for (let i = at + 1; i < legs.length; i++) trace(legs[i].pts);
  const { pts, turn } = legs[at];
  const near = nearestOn(pts, game.boat.x, game.boat.y);
  const ahead = [[near.x, near.y], ...pts.slice(near.i + 1)];
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(C.warn, 0.14);
  ctx.lineWidth = 10 * s;
  trace(ahead);
  ctx.setLineDash([12 * s, 8 * s]);
  ctx.lineDashOffset = -time * 40 * s;
  ctx.strokeStyle = rgba(C.warn, 0.9);
  ctx.lineWidth = 2.6 * s;
  trace(ahead);
  // Strayed off it: a fainter thread back to the line.
  if (near.d > 40) {
    ctx.setLineDash([2 * s, 6 * s]);
    ctx.strokeStyle = rgba(C.warn, 0.45);
    ctx.lineWidth = 1.6 * s;
    trace([[game.boat.x, game.boat.y], [near.x, near.y]]);
  }
  // Where to turn next.
  if (turn && near.i + 1 < pts.length - 1) {
    const [tx, ty] = pts[near.i + 1];
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(C.warn, 0.55 + 0.35 * pulse);
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(tx, ty, (8 + 3 * pulse) * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = font(14 * s, 800, undefined, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = 'rgba(6, 20, 29, 0.6)';
    ctx.strokeText(t(turn === 'tack' ? 'TACK' : 'GYBE'), tx, ty - 14 * s);
    ctx.fillStyle = C.warn;
    ctx.fillText(t(turn === 'tack' ? 'TACK' : 'GYBE'), tx, ty - 14 * s);
  }
  ctx.restore();
}

// The point on a line of points nearest (x, y), and the segment it's on.
export function nearestOn(pts, x, y) {
  let best = { i: 0, x: pts[0][0], y: pts[0][1], d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { i, x: px, y: py, d };
  }
  return best;
}

export function drawFleet(ctx, game, time) {
  if (!game.race) return;
  game.race.rivals.forEach((r, i) => {
    drawBoat(ctx, r.boat, time + r.name.length, {
      capsized: r.capsized > 0,
      pennant: [r.wind.wx - r.boat.vx, r.wind.wy - r.boat.vy],
      look: r.look,
      // Each rival's helmsman in his club's colours, up to windward.
      skipper: helmsman(r.boat.type, r.boat.boom > 0 ? -1 : 1, RIVAL_JACKETS[i % RIVAL_JACKETS.length]),
    });
  });
}
