// Procedural shapes for level authoring: organic islands, long ridges and
// scattered rock fields, all seeded so a level looks the same every time.

import { createRng, createNoise2D } from '../core/rng.js';
import { polygonBounds, polygonCentroid } from '../core/math.js';

// Organic blob island around (x, y) with mean radius r.
export function blob(x, y, r, seed = 1, jag = 0.28, points = 28, stretch = [1, 1], rotate = 0) {
  const noise = createNoise2D(seed);
  const pts = [];
  const cosR = Math.cos(rotate);
  const sinR = Math.sin(rotate);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const n = noise(Math.cos(a) * 1.3 + seed * 0.1, Math.sin(a) * 1.3) * jag;
    const n2 = noise(Math.cos(a) * 3.1 + 7, Math.sin(a) * 3.1 - seed * 0.05) * jag * 0.35;
    const rr = r * (1 + n + n2);
    const lx = Math.cos(a) * rr * stretch[0];
    const ly = Math.sin(a) * rr * stretch[1];
    pts.push([x + lx * cosR - ly * sinR, y + lx * sinR + ly * cosR]);
  }
  return pts;
}

// A long island following a path, roughly `width` wide.
export function ridge(path, width, seed = 1, jag = 0.25) {
  const noise = createNoise2D(seed);
  const left = [];
  const right = [];
  const samples = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const segLen = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.round(segLen / 30));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      samples.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  samples.push(path[path.length - 1]);
  for (let i = 0; i < samples.length; i++) {
    const [x, y] = samples[i];
    const [px, py] = samples[Math.max(0, i - 1)];
    const [nx, ny] = samples[Math.min(samples.length - 1, i + 1)];
    let tx = nx - px;
    let ty = ny - py;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const endTaper = Math.sin((i / (samples.length - 1)) * Math.PI) * 0.75 + 0.25;
    const w = (width / 2) * endTaper;
    const nl = 1 + noise(i * 0.35, 0.5) * jag;
    const nr = 1 + noise(i * 0.35, 9.5) * jag;
    left.push([x - ty * w * nl, y + tx * w * nl]);
    right.push([x + ty * w * nr, y - tx * w * nr]);
  }
  return left.concat(right.reverse());
}

export function rockField(x, y, spread, count, seed = 1, rMin = 5, rMax = 11) {
  const rng = createRng(seed);
  const rocks = [];
  let guard = 0;
  while (rocks.length < count && guard++ < count * 40) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * spread;
    const rx = x + Math.cos(a) * d;
    const ry = y + Math.sin(a) * d;
    const r = rng.range(rMin, rMax);
    if (rocks.some((o) => Math.hypot(o.x - rx, o.y - ry) < o.r + r + 4)) continue;
    rocks.push({ x: rx, y: ry, r });
  }
  return rocks;
}

// A line of rocks from a to b (a reef wall) with an optional gap.
export function rockLine(ax, ay, bx, by, spacing, seed = 1, r = 8, gaps = []) {
  const rng = createRng(seed);
  const rocks = [];
  const L = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.floor(L / spacing));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (gaps.some(([g0, g1]) => t >= g0 && t <= g1)) continue;
    rocks.push({
      x: ax + (bx - ax) * t + rng.range(-3, 3),
      y: ay + (by - ay) * t + rng.range(-3, 3),
      r: r * rng.range(0.75, 1.2),
    });
  }
  return rocks;
}

// Pearls placed along a line.
export function pearlLine(ax, ay, bx, by, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, kind: 'pearl' });
  }
  return out;
}

export function prepareIsland(pts, kind = 'sand', seed = 1) {
  const b = polygonBounds(pts);
  const [cx, cy] = polygonCentroid(pts);
  let radius = 0;
  for (const [x, y] of pts) radius = Math.max(radius, Math.hypot(x - cx, y - cy));
  const rng = createRng(seed * 7919 + 13);
  // Decorative palms / boulders placed inside the island.
  const decor = [];
  const count = Math.floor(radius / 18);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, radius * 0.5);
    decor.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, s: rng.range(0.7, 1.3), r: rng.range(0, Math.PI * 2) });
  }
  return { pts, kind, cx, cy, radius, bounds: b, decor, seed };
}
