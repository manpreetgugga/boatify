// Small drawing helpers shared by the far worlds' art (worldart.js,
// wildart.js and dreamart.js): steady hashes, an island's long axis, points
// inside and around a shape, raised land, the red ring round a lair, and
// the head end of a drifter, a lair's glow and burst, and people and birds
// seen from above.

import { C, rgba } from './palette.js';
import { pointInPolygon } from '../core/math.js';

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

// Points on a jittered grid well inside a shape (within `keep` of the way
// from the centre to the edge), cached on the shape.
export function fill(isl, key, step, keep) {
  const c = store(isl);
  if (c[key]) return c[key];
  const out = [];
  const b = isl.bounds;
  let i = 0;
  for (let y = b.minY + step / 2; y < b.maxY; y += step) {
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      i += 1;
      const px = x + (hash(isl.seed * 3.1 + i) - 0.5) * step * 0.8;
      const py = y + (hash(isl.seed * 5.7 + i) - 0.5) * step * 0.8;
      const ox = isl.cx + (px - isl.cx) / keep;
      const oy = isl.cy + (py - isl.cy) / keep;
      if (pointInPolygon(ox, oy, isl.pts)) out.push({ x: px, y: py, h: hash(isl.seed + i * 1.37), i });
    }
  }
  c[key] = out;
  return out;
}

// Points along the shore with the outward direction there.
export function shore(isl, every) {
  const out = [];
  for (let i = 0; i < isl.pts.length; i += every) {
    const [x, y] = isl.pts[i];
    const d = Math.hypot(x - isl.cx, y - isl.cy) || 1;
    out.push({ x, y, nx: (x - isl.cx) / d, ny: (y - isl.cy) / d, h: hash(isl.seed * 1.7 + i), i });
  }
  return out;
}

// A circle as its own subpath, so several fill in one go.
export function dot(ctx, x, y, r) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

export function oval(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
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

// The head end of a drifter: the end of its long axis it is heading for.
export function headOf(f) {
  const { a } = axisOf(f);
  const c = store(f);
  if (Math.hypot(f.vx, f.vy) > 0.3) c.face = Math.cos(a) * f.vx + Math.sin(a) * f.vy >= 0 ? 0 : Math.PI;
  return a + (c.face || 0);
}

// A lair's glow as it gets ready to strike.
export function warnGlow(ctx, R, t, inner, outer) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(${inner}, ${(0.55 * t).toFixed(3)})`);
  g.addColorStop(0.8, `rgba(${outer}, ${(0.18 * t).toFixed(3)})`);
  g.addColorStop(1, `rgba(${outer}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
}

// The ring of spray as something bursts out of the water.
export function splash(ctx, R, t) {
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.7 * (1 - t)).toFixed(3)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.3 + t * 0.75), 0, TAU);
  ctx.stroke();
  const s = Math.sin(t * Math.PI);
  ctx.fillStyle = `rgba(232, 244, 242, ${(0.5 * s).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i;
    dot(ctx, Math.cos(a) * R * (0.25 + 0.55 * t), Math.sin(a) * R * (0.25 + 0.55 * t), 2.5 + 3 * s);
  }
  ctx.fill();
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
