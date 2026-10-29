// Penguins on the ice, and gulls over it. Decoration only: huddles stand near
// the water's edge on every ice shelf and berg, a pair rides each drifting
// floe, and when a boat sails close the nearest toboggan into the sea,
// porpoise about and hop back out. Gulls wheel over some huddles and stand
// among others, facing into the wind.

import { clamp, dist, pointInPolygon, angleDiff } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { boatSpeed } from '../physics/boat.js';
import { viewBounds } from './camera.js';
import { drawGull, drawStandingGull } from './wildlife.js';

const TAU = Math.PI * 2;
const SPOOK = 75; // a moving boat this close sends penguins into the water
const SLIDE = 0.8; // seconds tobogganing down to the water
const CLIMB = 1.1; // seconds hopping back out
const SIZE = 2; // drawn large, so they read on a phone

// Where an ice shelf's or berg's edge meets the water, `along` units round
// from its first point: the point, and the way out to sea.
function edgeAt(pts, along) {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (along <= len || i === pts.length - 1) {
      const k = len ? clamp(along / len, 0, 1) : 0;
      const tx = len ? (bx - ax) / len : 1;
      const ty = len ? (by - ay) / len : 0;
      const x = ax + (bx - ax) * k;
      const y = ay + (by - ay) * k;
      // Out is whichever side of the edge isn't ice.
      const out = pointInPolygon(x + ty * 6, y - tx * 6, pts) ? [-ty, tx] : [ty, -tx];
      return { x, y, nx: out[0], ny: out[1], tx, ty };
    }
    along -= len;
  }
  return null;
}

function perimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    p += Math.hypot(bx - ax, by - ay);
  }
  return p;
}

function penguin(rng, x, y, face) {
  return {
    x,
    y,
    face,
    phase: rng.range(0, TAU),
    s: 'stand',
    t: 0,
    cool: rng.range(0, 4),
    lane: rng.range(-8, 8),
    reach: rng.range(28, 46),
    wander: rng.range(-24, 24),
    swim: rng.range(5, 8),
  };
}

// Every huddle on a level's ice, placed the same way every time.
export function placeColonies(level) {
  const huddles = [];
  const ice = level.islands.filter((isl) => isl.kind === 'ice');
  ice.forEach((isl, n) => {
    const rng = createRng((isl.seed || n + 1) * 7477 + 211);
    const around = perimeter(isl.pts);
    const tries = clamp(Math.round(around / 140), 3, 14);
    for (let k = 0; k < tries; k++) {
      const e = edgeAt(isl.pts, rng.range(0, around));
      if (!e) continue;
      const back = rng.range(15, 22);
      const cx = e.x - e.nx * back;
      const cy = e.y - e.ny * back;
      if (!pointInPolygon(cx, cy, isl.pts)) continue;
      if (huddles.some((h) => dist(h.x, h.y, cx, cy) < 48)) continue;
      const penguins = [];
      const count = rng.int(3, 7);
      for (let i = 0; i < count * 4 && penguins.length < count; i++) {
        const a = rng.range(0, TAU);
        const r = rng.range(0, 13);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        // On the ice, clear of the very edge, and not on top of each other.
        if (!pointInPolygon(x, y, isl.pts) || !pointInPolygon(x + e.nx * 5, y + e.ny * 5, isl.pts)) continue;
        if (penguins.some((p) => dist(p.x, p.y, x, y) < 6)) continue;
        // Most look out to sea.
        const face = Math.atan2(e.ny, e.nx) + rng.range(-1, 1) * (rng.chance(0.75) ? 0.9 : 3);
        penguins.push(penguin(rng, x, y, face));
      }
      if (!penguins.length) continue;
      huddles.push({
        x: cx,
        y: cy,
        edge: e,
        floe: null,
        lift: 1,
        penguins,
        gull: rng.chance(0.4) ? { x: cx + rng.range(-12, 12), y: cy + rng.range(-12, 12) } : null,
        circling: rng.chance(0.5) ? { r: rng.range(28, 46), speed: rng.range(0.35, 0.6) * (rng.chance(0.5) ? 1 : -1), a: rng.range(0, TAU) } : null,
      });
    }
  });
  // A few riding each floe big enough to stand on.
  (level.floes || []).forEach((f, n) => {
    if (f.radius < 40) return;
    const rng = createRng((f.seed || n + 1) * 3571 + 97);
    const penguins = [];
    const count = rng.int(2, 4);
    for (let i = 0; i < count * 4 && penguins.length < count; i++) {
      const x = f.cx + rng.range(-12, 12);
      const y = f.cy + rng.range(-18, 18);
      if (!pointInPolygon(x, y, f.pts) || penguins.some((p) => dist(p.x, p.y, x, y) < 6)) continue;
      penguins.push(penguin(rng, x, y, rng.range(0, TAU)));
    }
    huddles.push({ x: f.cx, y: f.cy, edge: null, floe: f, lift: 0.45, penguins, gull: null, circling: null });
  });
  return huddles;
}

export function updateColonies(lf, game, dt) {
  if (!lf.colonies || lf.colonies.level !== game.level) lf.colonies = { level: game.level, huddles: placeColonies(game.level), near: false };
  const { boat } = game;
  const moving = boatSpeed(boat) > 2.5 && game.status === 'sailing';
  let near = false;
  for (const h of lf.colonies.huddles) {
    const ox = h.floe ? h.floe.ox : 0;
    const oy = h.floe ? h.floe.oy : 0;
    const d = dist(boat.x, boat.y, h.x + ox, h.y + oy);
    if (d < 150) near = true;
    const spooked = h.edge && moving && d < SPOOK + 20;
    for (const p of h.penguins) {
      p.t += dt;
      if (p.s === 'stand') {
        p.cool -= dt;
        // A boat close by gets watched.
        if (d < 160) {
          const want = Math.atan2(boat.y - (p.y + oy), boat.x - (p.x + ox));
          p.face += clamp(angleDiff(p.face, want), -2.5 * dt, 2.5 * dt);
        }
        if (spooked && p.cool <= 0 && Math.random() < dt * 1.2) {
          p.s = 'slide';
          p.t = 0;
        }
      } else if (p.s === 'slide' && p.t >= SLIDE) {
        p.s = 'swim';
        p.t = 0;
      } else if (p.s === 'swim' && p.t >= p.swim) {
        p.s = 'climb';
        p.t = 0;
      } else if (p.s === 'climb' && p.t >= CLIMB) {
        p.s = 'stand';
        p.t = 0;
        p.cool = 8 + Math.random() * 10;
        p.face = Math.atan2(h.edge.ny, h.edge.nx) + (Math.random() - 0.5) * 1.6;
      }
    }
  }
  lf.colonies.near = near;
}

// Where a penguin slips into the sea.
function entry(h, p) {
  const e = h.edge;
  return [e.x + e.tx * p.lane, e.y + e.ty * p.lane];
}

// Out and back in a loop from where it dived.
function swimAt(h, p, u) {
  const e = h.edge;
  const [x0, y0] = entry(h, p);
  const out = Math.sin(Math.PI * u) * p.reach;
  const side = Math.sin(TAU * u) * p.wander;
  return [x0 + e.nx * out + e.tx * side, y0 + e.ny * out + e.ty * side];
}

// Standing on the ice, seen from above: a black back, the white front
// showing on the side it faces, a gold patch by the head and an orange beak.
function drawStanding(ctx, x, y, face, flap) {
  ctx.fillStyle = 'rgba(30, 70, 95, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1.4, y + 1.8, 2.2 * SIZE, 1.7 * SIZE, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(face);
  ctx.scale(SIZE, SIZE);
  ctx.fillStyle = '#1b2227';
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-0.2, s * 1.35);
    ctx.rotate(s * (0.35 + flap * 0.9));
    ctx.beginPath();
    ctx.ellipse(-0.5, s * 0.25, 1.1, 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(-0.2, 0, 2, 1.55, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4f7f8';
  ctx.beginPath();
  ctx.ellipse(0.7, 0, 1.15, 1.25, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1b2227';
  ctx.beginPath();
  ctx.arc(0.25, 0, 0.95, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2b632';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(0.55, s * 0.72, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(1.95, 0);
  ctx.lineTo(1.05, -0.32);
  ctx.lineTo(1.05, 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Tobogganing on its belly, flippers out, or swimming low in the water.
function drawFlat(ctx, x, y, heading, swimming, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(SIZE, SIZE);
  if (swimming) {
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.6)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-1.6, -1.1);
    ctx.lineTo(-5, -2.6);
    ctx.moveTo(-1.6, 1.1);
    ctx.lineTo(-5, 2.6);
    ctx.stroke();
  }
  ctx.globalAlpha = swimming ? 0.85 : 1;
  ctx.fillStyle = '#1b2227';
  const paddle = swimming ? Math.sin(time * 14) * 0.4 : 0.2;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(0.2, s * 1);
    ctx.rotate(s * (1.1 + paddle));
    ctx.beginPath();
    ctx.ellipse(0.9, 0, 1.2, 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(-0.2, 0, 2.5, 1.05, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1.9, 0, 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(3.3, 0);
  ctx.lineTo(2.55, -0.25);
  ctx.lineTo(2.55, 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function splash(ctx, x, y, age) {
  if (age < 0 || age > 1) return;
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.8 * (1 - age)).toFixed(3)})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, 1.5 + age * 6, 0, TAU);
  ctx.stroke();
}

// On the ice and in the water around it: under the boat.
export function drawColonies(ctx, lf, game, cam, time) {
  if (!lf.colonies) return;
  const v = viewBounds(cam, 70);
  const windFace = game.wind.angle + Math.PI;
  for (const h of lf.colonies.huddles) {
    const ox = (h.floe ? h.floe.ox : 0) - 2.5 * h.lift;
    const oy = (h.floe ? h.floe.oy : 0) - 3.5 * h.lift;
    if (h.x + ox < v.minX || h.x + ox > v.maxX || h.y + oy < v.minY || h.y + oy > v.maxY) continue;
    if (h.gull) drawStandingGull(ctx, h.gull.x + ox, h.gull.y + oy, windFace + Math.sin(time * 0.6 + h.x) * 0.3, 1.9);
    for (const p of h.penguins) {
      if (p.s === 'stand') {
        // Now and then a flap of the flippers, and a little waddle.
        const beat = Math.sin(time * 0.9 + p.phase);
        const flap = beat > 0.93 ? Math.abs(Math.sin(time * 18)) : 0;
        const waddle = Math.sin(time * 1.3 + p.phase * 2) > 0.8 ? Math.sin(time * 9 + p.phase) * 0.25 : 0;
        drawStanding(ctx, p.x + ox, p.y + oy, p.face + waddle, flap);
      } else if (p.s === 'slide') {
        const [ex, ey] = entry(h, p);
        const k = p.t / SLIDE;
        const x = p.x + (ex - p.x) * k + ox * (1 - k);
        const y = p.y + (ey - p.y) * k + oy * (1 - k);
        drawFlat(ctx, x, y, Math.atan2(ey - p.y, ex - p.x), false, time);
      } else if (p.s === 'swim') {
        const u = p.t / p.swim;
        const [x, y] = swimAt(h, p, u);
        const [nx, ny] = swimAt(h, p, Math.min(1, u + 0.02));
        const [ex, ey] = entry(h, p);
        splash(ctx, ex, ey, p.t / 0.6);
        // Porpoising: a short leap clear of the water now and then.
        const leap = Math.max(0, Math.sin(u * TAU * 2.5 - 1));
        if (leap > 0.6) {
          ctx.fillStyle = 'rgba(4, 22, 30, 0.2)';
          ctx.beginPath();
          ctx.ellipse(x + 2, y + 2.5, 2.4 * SIZE, 1 * SIZE, Math.atan2(ny - y, nx - x), 0, TAU);
          ctx.fill();
        }
        drawFlat(ctx, x - leap * 1.2, y - leap * 1.8, Math.atan2(ny - y, nx - x), leap <= 0.6, time);
      } else if (p.s === 'climb') {
        const [ex, ey] = entry(h, p);
        const k = clamp(p.t / CLIMB, 0, 1);
        const hop = Math.abs(Math.sin(k * Math.PI * 3)) * 1.6;
        splash(ctx, ex, ey, p.t / 0.6);
        const x = ex + (p.x - ex) * k + ox * k;
        const y = ey + (p.y - ey) * k + oy * k - hop;
        drawStanding(ctx, x, y, Math.atan2(p.y - ey, p.x - ex), 0.6);
      }
    }
  }
}

// Gulls wheeling over the ice: above the boat.
export function drawColonyGulls(ctx, lf, cam, time) {
  if (!lf.colonies) return;
  const v = viewBounds(cam, 90);
  for (const h of lf.colonies.huddles) {
    const c = h.circling;
    if (!c || h.x < v.minX || h.x > v.maxX || h.y < v.minY || h.y > v.maxY) continue;
    const a = c.a + time * c.speed;
    const x = h.x + Math.cos(a) * c.r;
    const y = h.y + Math.sin(a) * c.r * 0.8;
    drawGull(ctx, x, y, a + Math.sign(c.speed) * Math.PI / 2, time * 4 + c.a, 16, 1.6);
  }
}
