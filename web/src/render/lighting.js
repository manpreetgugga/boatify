// Night and fog: a screen-space overlay with holes cut out where there is
// light (the boat's lantern, the lighthouse, buoys, glowing pearls).

import { worldToScreen } from './camera.js';
import { lighthouseLamp } from './terrain.js';
import { worldLights } from './worldart.js';

const RES = 0.5;

export function createLighting() {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d') };
}

function hole(ctx, x, y, r, strength = 1, inner = 0.35) {
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r);
  g.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawLighting(ctx, light, game, cam, time, w, h) {
  const wx = game.level.weather;
  const fog = wx.fog || 0;
  const night = !!wx.night;
  const dark = wx.dark || 0;
  if (!fog && !night && !dark) return;

  if (dark && !night && !fog) {
    ctx.fillStyle = `rgba(8, 14, 24, ${dark})`;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const cw = Math.ceil(w * RES);
  const ch = Math.ceil(h * RES);
  const c = light.canvas;
  if (c.width !== cw || c.height !== ch) {
    c.width = cw;
    c.height = ch;
  }
  const l = light.ctx;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, cw, ch);
  let color;
  let alpha;
  if (night && fog) {
    color = '22, 32, 44';
    alpha = Math.max(0.86, fog);
  } else if (night) {
    color = '4, 10, 22';
    alpha = 0.86;
  } else {
    color = '172, 190, 197';
    alpha = fog * 0.92;
  }
  l.fillStyle = `rgba(${color}, ${alpha})`;
  l.fillRect(0, 0, cw, ch);

  l.globalCompositeOperation = 'destination-out';
  const k = cam.scale * RES;
  const toS = (x, y) => {
    const [sx, sy] = worldToScreen(cam, x, y);
    return [sx * RES, sy * RES];
  };
  const { boat, level } = game;
  const [bx, by] = toS(boat.x, boat.y);
  const vis = night ? 125 : 150;
  hole(l, bx, by, vis * k, 1, 0.25);
  hole(l, bx, by, vis * 1.7 * k, 0.35, 0.3);

  for (const cp of level.checkpoints) {
    const [x, y] = toS(cp.x, cp.y);
    hole(l, x, y, 34 * k, Math.sin(time * 3 + cp.index) > 0.6 ? 0.9 : 0.5);
  }
  for (const p of level.pickups) {
    if (p.taken) continue;
    const [x, y] = toS(p.x, p.y);
    hole(l, x, y, 18 * k, 0.6);
  }
  // Lava, harbor lamps, glowing crystal and the like.
  for (const [x0, y0, r, strength] of worldLights(level, time)) {
    const [x, y] = toS(x0, y0);
    const rr = r * k;
    if (x + rr < 0 || y + rr < 0 || x - rr > cw || y - rr > ch) continue;
    hole(l, x, y, rr, strength);
  }
  const f = level.finish;
  const [fx, fy] = toS(f.x, f.y);
  hole(l, fx, fy, (f.r + 40) * k, 0.8);

  let beam = null;
  if (f.kind === 'lighthouse' || f.kind === 'home') {
    const [lx, ly] = toS(...lighthouseLamp(f));
    const a = time * 1.2;
    const len = 900 * k;
    beam = { lx, ly, a, len };
    const g = l.createRadialGradient(lx, ly, 0, lx, ly, len);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    l.fillStyle = g;
    l.beginPath();
    l.moveTo(lx, ly);
    l.arc(lx, ly, len, a - 0.11, a + 0.11);
    l.closePath();
    l.fill();
    hole(l, lx, ly, 70 * k, 1);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, cw, ch, 0, 0, w, h);
  if (beam) {
    // A warm glow along the beam on top of the darkness.
    const s = 1 / RES;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(beam.lx * s, beam.ly * s, 0, beam.lx * s, beam.ly * s, beam.len * s);
    g.addColorStop(0, 'rgba(255, 236, 160, 0.22)');
    g.addColorStop(1, 'rgba(255, 236, 160, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(beam.lx * s, beam.ly * s);
    ctx.arc(beam.lx * s, beam.ly * s, beam.len * s, beam.a - 0.08, beam.a + 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
