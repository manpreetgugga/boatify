// Small drawing helpers shared by the far worlds' art (worldart.js and
// wildart.js): steady hashes, an island's long axis, raised land, the red
// ring round a lair, and people seen from above.

import { C, rgba } from './palette.js';

export const TAU = Math.PI * 2;
const cache = new WeakMap();

// A steady number in [0, 1) for a seed, so decoration never flickers.
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Per-shape scratch space that lives as long as the shape.
export function store(isl) {
  let c = cache.get(isl);
  if (!c) {
    c = {};
    cache.set(isl, c);
  }
  return c;
}

// The long axis of a shape (radians) and its half length and half width.
export function axisOf(isl) {
  const c = store(isl);
  if (c.axis) return c.axis;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of isl.pts) {
    const dx = x - isl.cx;
    const dy = y - isl.cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let hl = 0;
  let hw = 0;
  for (const [x, y] of isl.pts) {
    const dx = x - isl.cx;
    const dy = y - isl.cy;
    hl = Math.max(hl, Math.abs(dx * ca + dy * sa));
    hw = Math.max(hw, Math.abs(-dx * sa + dy * ca));
  }
  c.axis = { a, hl, hw };
  return c.axis;
}

// Land that stands out of the water: a dark side, then the top shifted up
// and left by `lift`. Leaves the context clipped to the shape.
export function raised(ctx, path, under, top, lift = 1) {
  ctx.fillStyle = under;
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(-2.5 * lift, -3.5 * lift);
  ctx.fillStyle = top;
  ctx.fill(path);
  ctx.translate(2.5 * lift, 3.5 * lift);
}

// The flashing ring round a lair that is about to strike (already
// translated to its centre).
export function dangerRing(ctx, k, time, t) {
  ctx.strokeStyle = rgba(C.danger, 0.35 + 0.45 * Math.abs(Math.sin(time * 10)));
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, k.r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  return t;
}

export const SHIRTS = ['#e5484d', '#3b8fe0', '#f5c518', '#3ddc97', '#f28c28', '#ffffff', '#8b5cf6'];

// Someone standing, seen from above: shoulders, head, and an arm that waves.
export function drawPerson(ctx, x, y, facing, shirt, wave, skin = '#e0b48a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10, 14, 18, 0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 1.5, 3.6, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4, 2.2, 0, 0, TAU);
  ctx.fill();
  if (wave !== null) {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2.6, 0);
    ctx.lineTo(4 + wave * 1.6, facing * 4);
    ctx.stroke();
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// A bird seen from above, wings spread along y and flapping, flying +x.
export function drawFlyer(ctx, x, y, heading, span, flap, body, wing) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  const lift = 0.35 + 0.65 * Math.abs(Math.sin(flap));
  ctx.strokeStyle = wing;
  ctx.lineWidth = Math.max(1.2, span * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-span * 0.25, -span * lift);
  ctx.quadraticCurveTo(span * 0.15, -span * 0.35 * lift, 0, 0);
  ctx.quadraticCurveTo(span * 0.15, span * 0.35 * lift, -span * 0.25, span * lift);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, span * 0.32, span * 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
