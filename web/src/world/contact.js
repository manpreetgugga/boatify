// Where a hull meets the world: the deepest contact of its bow, middle and
// stern circles with islands, rocks and drifting ice, the bounce off it, and
// the soft fence at the edge of the chart. Shared by the player's boat and
// the regatta fleet.

import { hullCircles } from '../physics/boat.js';
import { clamp } from '../core/math.js';
import { circlePolygon, circleCircle } from './collision.js';
import { floeContact } from './floes.js';

export function hullContact(level, boat) {
  let hit = null;
  for (const c of hullCircles(boat)) {
    for (const isl of level.islands) {
      const contact = circlePolygon(c.x, c.y, c.r, isl);
      if (contact && (!hit || contact.depth > hit.depth)) hit = contact;
    }
    for (const rock of level.rocks) {
      const dx = c.x - rock.x;
      const dy = c.y - rock.y;
      const rr = c.r + rock.r;
      if (dx * dx + dy * dy >= rr * rr) continue;
      const contact = circleCircle(c.x, c.y, c.r, rock);
      if (contact && (!hit || contact.depth > hit.depth)) hit = contact;
    }
    if (level.floes.length) {
      const contact = floeContact(level, c.x, c.y, c.r);
      if (contact && (!hit || contact.depth > hit.depth)) hit = contact;
    }
  }
  return hit;
}

// Push the hull out of the contact and bounce it off. Returns the impact
// speed, or 0 if the boat was already moving away.
export function bounce(boat, hit) {
  boat.x += hit.nx * hit.depth;
  boat.y += hit.ny * hit.depth;
  // Velocity relative to the obstacle: a drifting floe can ram a boat too.
  const ovx = hit.vx || 0;
  const ovy = hit.vy || 0;
  const vn = (boat.vx - ovx) * hit.nx + (boat.vy - ovy) * hit.ny;
  if (vn >= 0) return 0;
  const restitution = 0.25;
  boat.vx -= (1 + restitution) * vn * hit.nx;
  boat.vy -= (1 + restitution) * vn * hit.ny;
  boat.vx = ovx + (boat.vx - ovx) * 0.82;
  boat.vy = ovy + (boat.vy - ovy) * 0.82;
  return -vn;
}

// Ease the boat back from the edge of the chart.
export function fence(boat, level, dt) {
  const m = 24;
  const k = 6;
  if (boat.x < m) boat.vx += (m - boat.x) * k * dt;
  if (boat.y < m) boat.vy += (m - boat.y) * k * dt;
  if (boat.x > level.width - m) boat.vx -= (boat.x - (level.width - m)) * k * dt;
  if (boat.y > level.height - m) boat.vy -= (boat.y - (level.height - m)) * k * dt;
  boat.x = clamp(boat.x, 0, level.width);
  boat.y = clamp(boat.y, 0, level.height);
}
