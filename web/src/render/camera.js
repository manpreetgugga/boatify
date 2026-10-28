// Follow camera: looks ahead along the boat's track, zooms out a little at
// speed, and shakes on impacts.

import { approach, clamp } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';
import { chasingShip } from '../world/pirates.js';

export function createCamera() {
  return { x: 0, y: 0, scale: 1.5, zoom: 1, shake: 0, still: false, ox: 0, oy: 0, w: 1, h: 1 };
}

// Pixels per world unit for a viewport, before speed zoom.
export function baseScale(w, h) {
  return clamp(Math.min(w / 460, h / 215), 1.1, 3.2);
}

export function snapCamera(cam, game, w, h) {
  cam.w = w;
  cam.h = h;
  cam.x = game.boat.x;
  cam.y = game.boat.y;
  cam.scale = baseScale(w, h) * cam.zoom;
}

export function updateCamera(cam, game, dt, w, h) {
  cam.w = w;
  cam.h = h;
  const { boat, level } = game;
  const speed = boatSpeed(boat);
  const lead = game.status === 'finished' ? 0 : 1.5;
  let tx = boat.x + boat.vx * lead;
  let ty = boat.y + boat.vy * lead;
  // A pirate on your tail: pull back and swing the view toward it, so you can
  // see it coming while the boat stays near the middle.
  const ship = game.status === 'sailing' ? chasingShip(game) : null;
  const near = ship ? clamp(1 - (Math.hypot(ship.x - boat.x, ship.y - boat.y) - 180) / 300, 0, 1) : 0;
  const targetScale = baseScale(w, h) * cam.zoom * (1 - 0.12 * clamp(speed / 18, 0, 1)) * (1 - 0.14 * near);
  cam.scale = approach(cam.scale, targetScale, 1.2, dt);
  // Keep the chart edge from filling more than a sliver of the screen.
  const halfW = w / 2 / cam.scale;
  const halfH = h / 2 / cam.scale;
  if (near > 0) {
    tx += clamp((ship.x - tx) * 0.4, -halfW * 0.4, halfW * 0.4) * near;
    ty += clamp((ship.y - ty) * 0.4, -halfH * 0.3, halfH * 0.3) * near;
  }
  const m = 60;
  tx = level.width + 2 * m > halfW * 2 ? clamp(tx, halfW - m, level.width - halfW + m) : level.width / 2;
  ty = level.height + 2 * m > halfH * 2 ? clamp(ty, halfH - m, level.height - halfH + m) : level.height / 2;
  cam.x = approach(cam.x, tx, 3, dt);
  cam.y = approach(cam.y, ty, 3, dt);
  cam.shake = Math.max(0, cam.shake - dt * 2.2);
  const s = cam.still ? 0 : cam.shake * cam.shake * 7;
  cam.ox = (Math.random() * 2 - 1) * s;
  cam.oy = (Math.random() * 2 - 1) * s;
}

export function worldToScreen(cam, x, y) {
  return [(x - cam.x) * cam.scale + cam.w / 2 + cam.ox, (y - cam.y) * cam.scale + cam.h / 2 + cam.oy];
}

export function screenToWorld(cam, sx, sy) {
  return [(sx - cam.w / 2 - cam.ox) / cam.scale + cam.x, (sy - cam.h / 2 - cam.oy) / cam.scale + cam.y];
}

// World-space rectangle currently on screen, with a margin in world units.
export function viewBounds(cam, margin = 0) {
  const hw = cam.w / 2 / cam.scale + margin;
  const hh = cam.h / 2 / cam.scale + margin;
  return { minX: cam.x - hw, minY: cam.y - hh, maxX: cam.x + hw, maxY: cam.y + hh };
}

// Apply the camera to a context so drawing can use world units.
export function applyCamera(ctx, cam) {
  ctx.translate(cam.w / 2 + cam.ox, cam.h / 2 + cam.oy);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);
}
