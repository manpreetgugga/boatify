// Draws a frame: sea, flows, shallows, wake, islands, marks, pickups, sea
// life, pirates, boat, birds, cannonballs and spray, weather and lighting,
// then the HUD on top.

import { createCamera, updateCamera, snapCamera, applyCamera } from './camera.js';
import { createOcean, drawWater, drawWindMap, drawFlows } from './ocean.js';
import { drawShallows, drawIslands, drawFloes, drawPickups, drawMarks } from './terrain.js';
import { createWake, updateWake, drawWake, drawBoat, drawGhost } from './boat.js';
import {
  createEffects,
  updateStreaks,
  drawStreaks,
  updateParticles,
  drawParticles,
  drawKrakens,
  drawStormClouds,
  drawRain,
  drawSnow,
  drawLightning,
} from './effects.js';
import { createLifeFx, updateLifeFx, drawSeaBelow, drawSeaLife, drawSkyLife } from './wildlife.js';
import { drawPirates, drawCannonballs } from './pirates.js';
import { createLighting, drawLighting } from './lighting.js';
import { createHud, drawHud } from './hud.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const r = {
    canvas,
    ctx,
    dpr: 1,
    w: 1,
    h: 1,
    cam: createCamera(),
    ocean: createOcean(ctx),
    wake: createWake(),
    fx: createEffects(),
    life: createLifeFx(),
    light: createLighting(),
    hud: createHud(),
    quality: 1,
  };
  resize(r);
  return r;
}

export function resize(r) {
  const dpr = Math.min(2, window.devicePixelRatio || 1) * (r.quality < 1 ? 0.75 : 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  r.dpr = dpr;
  r.w = w;
  r.h = h;
  r.canvas.width = Math.round(w * dpr);
  r.canvas.height = Math.round(h * dpr);
  r.canvas.style.width = `${w}px`;
  r.canvas.style.height = `${h}px`;
}

// Fresh voyage: reset per-run visual state and jump the camera to the boat.
export function resetView(r, game) {
  r.wake = createWake();
  r.fx = createEffects();
  r.life = createLifeFx();
  r.hud.minimap = null;
  snapCamera(r.cam, game, r.w, r.h);
}

export function renderFrame(r, game, dt, time, ui) {
  const { ctx, cam } = r;
  updateCamera(cam, game, dt, r.w, r.h);
  updateWake(r.wake, game.boat, game.clock, game.status === 'sailing' || game.status === 'finished');
  updateStreaks(r.fx, game, cam, dt, Math.round((r.w * r.h) / 9000));
  updateParticles(r.fx, dt);
  updateLifeFx(r.life, game, dt);

  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  ctx.save();
  applyCamera(ctx, cam);
  drawWater(ctx, r.ocean, game, cam, time);
  ctx.restore();

  ctx.save();
  drawWindMap(ctx, r.ocean, game, cam);
  ctx.restore();

  ctx.save();
  applyCamera(ctx, cam);
  drawFlows(ctx, game, cam, time);
  drawShallows(ctx, game, cam, time);
  drawKrakens(ctx, game, time);
  drawSeaBelow(ctx, game, cam, time);
  drawWake(ctx, r.wake, game.clock);
  drawStreaks(ctx, r.fx, game);
  drawIslands(ctx, game, cam, time);
  drawFloes(ctx, game, cam, time);
  drawMarks(ctx, game, cam, time);
  drawPickups(ctx, game, cam, time);
  drawSeaLife(ctx, game, cam, time);
  drawPirates(ctx, game, cam, time);
  if (ui && ui.ghost) drawGhost(ctx, ui.ghost.pose, ui.ghost.type || game.boat.type, time);
  const boatState = {
    capsized: game.status === 'capsized',
    sinking: game.status === 'sinking' ? 1 - Math.max(0, game.statusTimer) / 2.4 : 0,
    pennant: [game.windHere.wx - game.boat.vx, game.windHere.wy - game.boat.vy],
    look: ui && ui.look,
  };
  drawBoat(ctx, game.boat, time, boatState);
  drawSkyLife(ctx, r.life, game, cam, time);
  drawCannonballs(ctx, game);
  drawParticles(ctx, r.fx, cam);
  drawStormClouds(ctx, game, time);
  ctx.restore();

  ctx.save();
  drawRain(ctx, r.fx, game, r.w, r.h, dt);
  drawSnow(ctx, r.fx, game, r.w, r.h, dt, time);
  drawLighting(ctx, r.light, game, cam, time, r.w, r.h);
  drawLightning(ctx, r.fx, game, r.w, r.h);
  ctx.restore();

  if (ui && ui.hud) {
    ctx.save();
    drawHud(ctx, r.hud, game, cam, ui.layout, ui.controls, time, ui.ghost);
    ctx.restore();
  }
}
