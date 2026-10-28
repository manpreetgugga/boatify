// Circle-vs-world collision queries. Islands are polygons (concave allowed),
// rocks are circles. Each query returns the deepest contact or null.

import { closestOnSegment, pointInPolygon } from '../core/math.js';

// Contact of circle (x, y, r) with a polygon. Normal points out of the polygon.
export function circlePolygon(x, y, r, island) {
  const b = island.bounds;
  if (x + r < b.minX || x - r > b.maxX || y + r < b.minY || y - r > b.maxY) return null;
  const pts = island.pts;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [qx, qy] = closestOnSegment(x, y, pts[j][0], pts[j][1], pts[i][0], pts[i][1]);
    const d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
    if (d2 < best) {
      best = d2;
      bx = qx;
      by = qy;
    }
  }
  const inside = pointInPolygon(x, y, pts);
  const d = Math.sqrt(best);
  if (!inside && d >= r) return null;
  let nx = x - bx;
  let ny = y - by;
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;
  if (inside) {
    nx = -nx;
    ny = -ny;
  }
  const depth = inside ? r + d : r - d;
  return { nx, ny, depth, material: island.kind };
}

export function circleCircle(x, y, r, o) {
  const dx = x - o.x;
  const dy = y - o.y;
  const rr = r + o.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 1e-6;
  return { nx: dx / d, ny: dy / d, depth: rr - d, material: o.material || 'rock' };
}

// Is the point at least `clearance` away from all solid things?
export function isClear(level, x, y, clearance) {
  if (x < clearance || y < clearance || x > level.width - clearance || y > level.height - clearance) return false;
  for (const isl of level.islands) {
    if (circlePolygon(x, y, clearance, isl)) return false;
  }
  for (const rock of level.rocks) {
    if (circleCircle(x, y, clearance, rock)) return false;
  }
  return true;
}

// Ray march for line-of-sight / obstacle look-ahead. Returns distance to the
// first blocked sample or Infinity.
export function rayBlocked(level, x, y, dirX, dirY, maxDist, clearance, step = 10) {
  for (let d = step; d <= maxDist; d += step) {
    if (!isClear(level, x + dirX * d, y + dirY * d, clearance)) return d;
  }
  return Infinity;
}
