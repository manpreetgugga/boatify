// Islands, reefs and rocks, pickups, checkpoint buoys and the A / B marks.
// Everything here draws in world units with the camera applied.

import { pointInPolygon } from '../core/math.js';
import { viewBounds } from './camera.js';
import { C, font } from './palette.js';
import { drawGreenery } from './islandlife.js';
import { themeOf } from './themes.js';
import { drawWorldShallows, drawWorldIsland, drawWorldRock, drawWorldFloe } from './worldart.js';

const cache = new WeakMap();

function smoothPath(pts) {
  const p = new Path2D();
  const n = pts.length;
  const mid = (i) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const m0 = mid(0);
  p.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const c = pts[i % n];
    const m = mid(i);
    p.quadraticCurveTo(c[0], c[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

function islandCache(isl) {
  let c = cache.get(isl);
  if (!c) {
    c = {
      path: smoothPath(isl.pts),
      decor: isl.decor.filter((d) => pointInPolygon(d.x, d.y, isl.pts)),
    };
    cache.set(isl, c);
  }
  return c;
}

function inView(v, b, pad) {
  return !(b.maxX + pad < v.minX || b.minX - pad > v.maxX || b.maxY + pad < v.minY || b.minY - pad > v.maxY);
}

// Pale shallows around every island, drawn first so neighbours blend.
export function drawShallows(ctx, game, cam, time) {
  const v = viewBounds(cam, 60);
  const theme = themeOf(game.level);
  ctx.lineJoin = 'round';
  for (const isl of game.level.islands) {
    if (!inView(v, isl.bounds, 40)) continue;
    const { path } = islandCache(isl);
    if (drawWorldShallows(ctx, isl, path, time)) continue;
    if (isl.kind === 'ice') {
      // Ice rises from deep water: just a pale glow of the ice below.
      ctx.strokeStyle = 'rgba(150, 220, 235, 0.2)';
      ctx.lineWidth = 18;
      ctx.stroke(path);
      continue;
    }
    ctx.strokeStyle = `rgba(${theme.shallow}, 0.16)`;
    ctx.lineWidth = 46;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(${theme.shallowHi}, 0.22)`;
    ctx.lineWidth = 24;
    ctx.stroke(path);
    const lap = 0.5 + 0.5 * Math.sin(time * 1.4 + isl.seed);
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.12 + 0.12 * lap).toFixed(3)})`;
    ctx.lineWidth = 9 + lap * 4;
    ctx.stroke(path);
  }
  for (const r of game.level.rocks) {
    if (r.x + r.r + 20 < v.minX || r.x - r.r - 20 > v.maxX || r.y + r.r + 20 < v.minY || r.y - r.r - 20 > v.maxY) continue;
    const halo = ROCK_HALO[r.material] || `rgba(${theme.shallow}, 0.2)`;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + (r.material === 'piling' || r.material === 'container' ? 4 : 9), 0, Math.PI * 2);
    ctx.fill();
  }
}

// The water around a rock, by what it is.
const ROCK_HALO = {
  coral: 'rgba(240, 150, 130, 0.12)',
  basalt: 'rgba(220, 220, 214, 0.12)',
  piling: 'rgba(4, 16, 22, 0.25)',
  container: 'rgba(4, 16, 22, 0.25)',
  shard: 'rgba(190, 150, 255, 0.2)',
  pod: 'rgba(120, 240, 200, 0.2)',
  snag: 'rgba(30, 40, 20, 0.22)',
  bones: 'rgba(200, 240, 220, 0.16)',
  column: 'rgba(220, 245, 240, 0.18)',
  statue: 'rgba(220, 245, 240, 0.18)',
  mast: 'rgba(4, 12, 12, 0.3)',
  berg: 'rgba(160, 225, 245, 0.24)',
  ball: 'rgba(255, 255, 255, 0.16)',
  brick: 'rgba(255, 255, 255, 0.14)',
  balloon: 'rgba(255, 255, 255, 0.06)',
  puff: 'rgba(255, 255, 255, 0.12)',
};

// Rocks that aren't round draw their own wash.
const OWN_FOAM = new Set(['snag', 'bones', 'mast', 'balloon', 'puff']);

// The water a drifter stirs up, by its look.
const FLOE_RING = {
  jelly: 'rgba(255, 160, 220, 0.18)',
  ice: 'rgba(150, 220, 235, 0.18)',
  hippo: 'rgba(120, 100, 70, 0.22)',
  ghostship: 'rgba(150, 255, 200, 0.16)',
  berg: 'rgba(150, 220, 240, 0.22)',
  duck: 'rgba(255, 240, 180, 0.16)',
  airship: 'rgba(20, 50, 80, 0.12)',
};

// Ice: `lift` is how far the top stands out of the water, so tall bergs
// show a deep blue side and flat floes barely any.
function drawIce(ctx, path, decor, lift = 1) {
  ctx.fillStyle = C.iceDeep;
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(-2.5 * lift, -3.5 * lift);
  ctx.fillStyle = C.ice;
  ctx.fill(path);
  ctx.translate(2.5 * lift, 3.5 * lift);
  ctx.strokeStyle = C.iceShade;
  ctx.lineWidth = 6;
  ctx.stroke(path);
  // Cracks and pressure ridges.
  ctx.strokeStyle = 'rgba(95, 160, 185, 0.55)';
  ctx.lineWidth = 1.1;
  for (const d of decor) {
    const r = 11 * d.s;
    const c = Math.cos(d.r);
    const s = Math.sin(d.r);
    ctx.beginPath();
    ctx.moveTo(d.x - c * r, d.y - s * r);
    ctx.lineTo(d.x - s * r * 0.25, d.y + c * r * 0.25);
    ctx.lineTo(d.x + c * r, d.y + s * r);
    ctx.stroke();
  }
}

// Drifting floes. A dotted track shows the line each one swings along, and a
// wake, foam on the leading edge and chevrons show which way it's heading.
export function drawFloes(ctx, game, cam, time) {
  const v = viewBounds(cam, 60);
  for (const f of game.level.floes) {
    const b = f.bounds;
    const [dx, dy] = f.drift;
    if (b.maxX + Math.abs(dx) + 30 < v.minX || b.minX - Math.abs(dx) - 30 > v.maxX || b.maxY + Math.abs(dy) + 30 < v.minY || b.minY - Math.abs(dy) - 30 > v.maxY) continue;
    const { path, decor } = islandCache(f);
    ctx.fillStyle = 'rgba(232, 244, 242, 0.22)';
    ctx.beginPath();
    for (let k = -1; k <= 1.001; k += 0.08) {
      ctx.moveTo(f.cx + dx * k + 2.2, f.cy + dy * k);
      ctx.arc(f.cx + dx * k, f.cy + dy * k, 2.2, 0, Math.PI * 2);
    }
    ctx.fill();
    const speed = Math.hypot(f.vx, f.vy);
    const vmax = (Math.hypot(dx, dy) * Math.PI * 2) / f.period;
    const pace = Math.min(1, speed / Math.max(vmax, 1e-6));
    ctx.save();
    ctx.translate(f.ox, f.oy);
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.save();
      ctx.translate(-f.vx * 0.9 * i, -f.vy * 0.9 * i);
      ctx.strokeStyle = `rgba(232, 244, 242, ${(0.2 * pace * (1 - i / 4)).toFixed(3)})`;
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.strokeStyle = FLOE_RING[f.look] || 'rgba(232, 244, 242, 0.1)';
    ctx.lineWidth = 16;
    ctx.stroke(path);
    if (speed > 0.5) {
      ctx.save();
      ctx.translate(f.vx * 0.5, f.vy * 0.5);
      ctx.strokeStyle = `rgba(232, 244, 242, ${Math.min(0.5, 0.1 + speed * 0.05).toFixed(3)})`;
      ctx.lineWidth = 4 + Math.sin(time * 3 + f.seed) * 1.2;
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke(path);
    ctx.save();
    if (!drawWorldFloe(ctx, f, path, decor, time)) drawIce(ctx, path, decor, 0.45);
    ctx.restore();
    if (pace > 0.15) {
      const a = Math.atan2(f.vy, f.vx);
      ctx.save();
      ctx.translate(f.cx, f.cy);
      ctx.rotate(a);
      ctx.strokeStyle = `rgba(80, 150, 178, ${(0.75 * pace).toFixed(3)})`;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const o of [-9, 7]) {
        ctx.moveTo(o - 7, -11);
        ctx.lineTo(o + 4, 0);
        ctx.lineTo(o - 7, 11);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

export function drawIslands(ctx, game, cam, time) {
  const v = viewBounds(cam, 60);
  for (const isl of game.level.islands) {
    if (!inView(v, isl.bounds, 20)) continue;
    const { path, decor } = islandCache(isl);
    // Surf line.
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.7)';
    ctx.lineWidth = 2.4;
    ctx.stroke(path);
    ctx.save();
    if (drawWorldIsland(ctx, isl, path, decor, time, game)) {
      // Drawn by its own world.
    } else if (isl.kind === 'ice') {
      drawIce(ctx, path, decor);
    } else if (isl.kind === 'rock') {
      ctx.fillStyle = C.rockDark;
      ctx.fill(path);
      ctx.clip(path);
      ctx.translate(-3, -4);
      ctx.fillStyle = C.rock;
      ctx.fill(path);
      ctx.translate(3, 4);
      ctx.strokeStyle = 'rgba(157, 150, 140, 0.55)';
      ctx.lineWidth = 7;
      ctx.stroke(path);
      for (const d of decor) {
        const r = 7 * d.s;
        ctx.fillStyle = C.rockDark;
        ctx.beginPath();
        ctx.ellipse(d.x + 1.5, d.y + 2, r, r * 0.8, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.rockLight;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, r, r * 0.8, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawGreenery(ctx, isl, 'plants');
    } else {
      ctx.fillStyle = C.grass;
      ctx.fill(path);
      ctx.clip(path);
      drawGreenery(ctx, isl, 'ground');
      ctx.strokeStyle = C.sand;
      ctx.lineWidth = 22;
      ctx.stroke(path);
      ctx.strokeStyle = C.sandDark;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
      drawGreenery(ctx, isl, 'beach');
      drawGreenery(ctx, isl, 'plants');
      for (const d of decor) drawPalm(ctx, d, time);
    }
    ctx.restore();
  }

  for (const r of game.level.rocks) {
    if (r.x + r.r < v.minX || r.x - r.r > v.maxX || r.y + r.r < v.minY || r.y - r.r > v.maxY) continue;
    const coral = r.material === 'coral';
    if (!OWN_FOAM.has(r.material)) {
      ctx.fillStyle = 'rgba(232, 244, 242, 0.45)';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + 1.6 + Math.sin(time * 2 + r.x) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (drawWorldRock(ctx, r, time)) continue;
    ctx.fillStyle = coral ? C.coralDark : C.rockDark;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coral ? C.coral : C.rock;
    ctx.beginPath();
    ctx.arc(r.x - r.r * 0.18, r.y - r.r * 0.22, r.r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    if (coral) {
      ctx.fillStyle = 'rgba(255, 220, 200, 0.55)';
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + r.x;
        ctx.beginPath();
        ctx.arc(r.x + Math.cos(a) * r.r * 0.45, r.y + Math.sin(a) * r.r * 0.45, r.r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(200, 192, 180, 0.5)';
      ctx.beginPath();
      ctx.arc(r.x - r.r * 0.35, r.y - r.r * 0.4, r.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPalm(ctx, d, time) {
  const sway = Math.sin(time * 1.1 + d.x * 0.05) * 0.08;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.r + sway);
  const s = 7 * d.s;
  ctx.fillStyle = 'rgba(20, 50, 25, 0.35)';
  ctx.beginPath();
  ctx.arc(2.5, 3, s * 1.1, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? C.grassDark : '#4f8a45';
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6, s * 0.75, s * 0.26, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8a6a3c';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPickups(ctx, game, cam, time) {
  const v = viewBounds(cam, 30);
  for (const p of game.level.pickups) {
    if (p.taken) continue;
    if (p.x < v.minX || p.x > v.maxX || p.y < v.minY || p.y > v.maxY) continue;
    const bob = Math.sin(time * 2.2 + p.bob);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.kind === 'blackPearl' ? `rgba(205, 184, 255, ${0.22 + 0.08 * bob})` : 'rgba(232, 244, 242, 0.13)';
    ctx.beginPath();
    ctx.arc(0, 0, (p.kind === 'blackPearl' ? 17 : 13) + bob * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(1 + bob * 0.06, 1 + bob * 0.06);
    if (p.kind === 'pearl') drawPearl(ctx, time + p.bob);
    else if (p.kind === 'blackPearl') drawBlackPearl(ctx, time + p.bob);
    else if (p.kind === 'gust') drawJar(ctx, time + p.bob);
    else if (p.kind === 'repair') drawCrate(ctx, bob);
    else drawBottle(ctx, bob);
    ctx.restore();
  }
}

// A black pearl in an open oyster: dark nacre round a big pearl with a
// peacock sheen, and a glint that comes and goes.
function drawBlackPearl(ctx, t) {
  ctx.fillStyle = 'rgba(6, 20, 28, 0.35)';
  ctx.beginPath();
  ctx.ellipse(1.5, 3, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // The open shell: the upper valve behind, the lower one with its nacre.
  ctx.fillStyle = '#4a4258';
  ctx.beginPath();
  ctx.ellipse(0, -4.5, 10, 6.5, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 24, 40, 0.7)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 5; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(Math.cos(a) * 9.5, -4.5 + Math.sin(a) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#5b5370';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 10.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const nacre = ctx.createLinearGradient(-8, -3, 8, 6);
  nacre.addColorStop(0, '#c9d8f0');
  nacre.addColorStop(0.5, '#e8d4f2');
  nacre.addColorStop(1, '#b8e6de');
  ctx.fillStyle = nacre;
  ctx.beginPath();
  ctx.ellipse(0, 1, 8.5, 5.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // The pearl.
  const g = ctx.createRadialGradient(-1.6, -1.2, 0.4, 0, 0.5, 5.2);
  g.addColorStop(0, '#9aa6c8');
  g.addColorStop(0.35, '#3a3552');
  g.addColorStop(1, '#0e0c16');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0.5, 5, 0, Math.PI * 2);
  ctx.fill();
  const sheen = 0.5 + 0.5 * Math.sin(t * 1.7);
  ctx.strokeStyle = `rgba(${Math.round(90 + 90 * sheen)}, ${Math.round(220 - 60 * sheen)}, 200, 0.55)`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0.5, 3.8, 0.3, 1.9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(-1.8, -1.4, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // A glint now and then.
  const g2 = Math.max(0, Math.sin(t * 2.6));
  if (g2 > 0.2) {
    ctx.save();
    ctx.translate(3.2, -2.4);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = `rgba(255, 255, 255, ${(g2 * 0.9).toFixed(3)})`;
    const r = 1.5 + 4 * g2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0.8, -0.8);
    ctx.lineTo(r, 0);
    ctx.lineTo(0.8, 0.8);
    ctx.lineTo(0, r);
    ctx.lineTo(-0.8, 0.8);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-0.8, -0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPearl(ctx, t) {
  ctx.fillStyle = '#e9a8b5';
  ctx.beginPath();
  ctx.moveTo(0, 5);
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.lineTo(Math.cos(a) * 8, 4 + Math.sin(a) * 9);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c47a8d';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(Math.cos(a) * 7.5, 4 + Math.sin(a) * 8.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.arc(0, 1, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + 0.4 * Math.sin(t * 4)})`;
  ctx.beginPath();
  ctx.arc(-1.2, -0.2, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawJar(ctx, t) {
  ctx.fillStyle = 'rgba(120, 220, 240, 0.35)';
  ctx.strokeStyle = '#bff3ff';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-5.5, -6, 11, 13, 3) : ctx.rect(-5.5, -6, 11, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6a3c';
  ctx.fillRect(-3.5, -8.5, 7, 3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = t * 5 + i * 0.6;
    const r = 0.5 + i * 0.2;
    const x = Math.cos(a) * r;
    const y = 0.5 + Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCrate(ctx, bob) {
  ctx.rotate(0.2 + bob * 0.08);
  ctx.fillStyle = '#9b6a3f';
  ctx.fillRect(-6, -6, 12, 12);
  ctx.strokeStyle = '#5e3b25';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-6, -6, 12, 12);
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(6, 6);
  ctx.moveTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();
  ctx.fillStyle = C.ok;
  ctx.fillRect(-1.2, -4, 2.4, 8);
  ctx.fillRect(-4, -1.2, 8, 2.4);
}

function drawBottle(ctx, bob) {
  ctx.rotate(-0.6 + bob * 0.2);
  ctx.fillStyle = 'rgba(90, 170, 110, 0.85)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-8, -3.5, 12, 7, 3) : ctx.rect(-8, -3.5, 12, 7);
  ctx.fill();
  ctx.fillRect(4, -1.8, 4, 3.6);
  ctx.fillStyle = '#c9a36a';
  ctx.fillRect(7.5, -1.6, 2.4, 3.2);
  ctx.fillStyle = '#f2e6c8';
  ctx.fillRect(-5.5, -1.6, 7, 3.2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(-7, -2.8, 9, 1);
}

export function drawMarks(ctx, game, cam, time) {
  const { level } = game;
  const s = level.start;
  if (level.race) drawStartLine(ctx, game, time);
  else drawLetterBuoy(ctx, s.x, s.y + 22, 'A', C.brass, time);

  const reach = cam.w / cam.scale / 2 + 120;
  level.checkpoints.forEach((c, i) => {
    if (Math.abs(c.x - cam.x) > reach) return;
    const next = i === game.nextCheckpoint;
    if (c.gate) {
      drawGate(ctx, c, next, time + i);
      return;
    }
    if (!c.reached) {
      ctx.strokeStyle = next ? `rgba(255, 200, 87, ${0.45 + 0.25 * Math.sin(time * 4)})` : 'rgba(255, 200, 87, 0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (c.label) drawLetterBuoy(ctx, c.x, c.y, c.label, c.reached ? C.ok : C.warn, time + i);
    else drawBuoy(ctx, c.x, c.y, c.reached ? C.ok : C.warn, time + i);
  });

  if (level.endless) return;
  const f = level.finish;
  // The prologue's home is a place, not yet a mark on a chart.
  if (f.marked === false) return drawHome(ctx, f, time);
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
  ctx.fillStyle = `rgba(255, 107, 53, ${0.08 + 0.06 * pulse})`;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.signal;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = -time * 12;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  if (f.kind === 'lighthouse') drawLighthouse(ctx, ...lighthouseLamp(f), time);
  else if (f.kind === 'home') drawHome(ctx, f, time);
  else drawHarbor(ctx, f, time);
  ctx.fillStyle = C.signal;
  ctx.font = font(26, 800, undefined, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', f.x, f.y - f.r - 14);
}

// A regatta starts between two buoys, the fleet abreast on the line.
function drawStartLine(ctx, game, time) {
  const boats = [game.level.start, ...(game.def.fleetStart || [])];
  const x = boats[0].x;
  const top = Math.min(...boats.map((b) => b.y)) - 34;
  const bottom = Math.max(...boats.map((b) => b.y)) + 34;
  // The line fades once the fleet is away, leaving its two buoys.
  const fade = Math.min(1, Math.max(0.3, 1 - (game.time - 20) / 15));
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.4 * fade).toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.setLineDash([]);
  drawBuoy(ctx, x, top, C.brass, time);
  drawBuoy(ctx, x, bottom, C.brass, time + 1);
}

// An open-sea gate: a buoy either side, to sail between. Missed ones fade.
function drawGate(ctx, c, next, t) {
  const color = c.reached ? C.ok : c.missed ? 'rgba(232, 244, 242, 0.35)' : C.warn;
  if (!c.reached && !c.missed) {
    ctx.strokeStyle = next ? `rgba(255, 200, 87, ${0.5 + 0.3 * Math.sin(t * 4)})` : 'rgba(255, 200, 87, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - c.r + 8);
    ctx.lineTo(c.x, c.y + c.r - 8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = c.missed ? 0.5 : 1;
  drawBuoy(ctx, c.x, c.y - c.r, color, t);
  drawBuoy(ctx, c.x, c.y + c.r, color, t + 1.3);
  ctx.globalAlpha = 1;
}

function drawBuoy(ctx, x, y, color, t) {
  const bob = Math.sin(t * 2.4) * 0.8;
  ctx.fillStyle = 'rgba(232, 244, 242, 0.35)';
  ctx.beginPath();
  ctx.arc(x, y, 8 + bob, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(x - 5.5, y - 1, 11, 2);
  if (Math.sin(t * 3) > 0.6) {
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLetterBuoy(ctx, x, y, letter, color, t) {
  drawBuoy(ctx, x, y, color, t);
  ctx.fillStyle = color;
  ctx.font = font(18, 800, undefined, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + 17);
}

function drawHarbor(ctx, f, time) {
  ctx.save();
  ctx.translate(f.x, f.y);
  // Two piers with planks and a flag on the end.
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(-f.r * 0.9, -f.r * 0.62, f.r * 1.2, 7);
  ctx.fillRect(-f.r * 0.9, f.r * 0.55, f.r * 1.2, 7);
  ctx.fillStyle = '#a77a4c';
  for (let x = -f.r * 0.9; x < f.r * 0.3; x += 5) {
    ctx.fillRect(x, -f.r * 0.62, 3.5, 7);
    ctx.fillRect(x, f.r * 0.55, 3.5, 7);
  }
  ctx.fillStyle = '#5e3b25';
  for (const y of [-f.r * 0.62 + 3.5, f.r * 0.55 + 3.5]) {
    ctx.beginPath();
    ctx.arc(f.r * 0.3, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const wave = Math.sin(time * 6) * 2;
  ctx.fillStyle = C.signal;
  ctx.beginPath();
  ctx.moveTo(f.r * 0.3, -f.r * 0.62);
  ctx.lineTo(f.r * 0.3 + 14, -f.r * 0.62 - 4 + wave);
  ctx.lineTo(f.r * 0.3, -f.r * 0.62 - 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLighthouse(ctx, x, y, time, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = C.rock;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ece0';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d64545';
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Daytime beam: a faint sweeping wedge.
  const a = time * 1.2;
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 160);
  grad.addColorStop(0, 'rgba(255, 243, 176, 0.35)');
  grad.addColorStop(1, 'rgba(255, 243, 176, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 160, a - 0.12, a + 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function lighthouseLamp(f) {
  if (f.kind === 'home') {
    const isle = homeIsle(f);
    return [isle.x + isle.r * 0.42, isle.y - isle.r * 0.45];
  }
  return [f.x + f.r * 0.55, f.y - f.r * 0.55];
}

// Home: a green isle on the far side of the harbor ring, the one the prologue
// opens on. Where it sits, and how big.
export function homeIsle(f) {
  return { x: f.x + f.r * 0.32, y: f.y - f.r * 0.22, r: f.r * 0.56 };
}

// The isle with its beach, the lighthouse on the point, the cottage with a
// light in the window, and a jetty out into the harbor where someone waits
// with a lantern, waving.
function drawHome(ctx, f, time) {
  const { x, y, r } = homeIsle(f);
  const shape = (k) => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const wob = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 5);
      ctx.lineTo(x + Math.cos(a) * r * k * wob, y + Math.sin(a) * r * k * wob * 0.9);
    }
    ctx.closePath();
  };
  // The jetty, from the beach out toward the middle of the ring.
  const jx = x - r * 1.75;
  const jy = y + r * 0.2;
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(jx, jy - 3, x - r * 0.6 - jx, 6);
  ctx.fillStyle = '#a77a4c';
  for (let px = jx; px < x - r * 0.6; px += 4.5) ctx.fillRect(px, jy - 3, 3, 6);
  // Surf, beach, grass.
  shape(1.08);
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.7)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = C.sand;
  ctx.fill();
  shape(0.78);
  ctx.fillStyle = C.grass;
  ctx.fill();
  ctx.fillStyle = C.grassDark;
  for (const [u, v, s] of [[-0.35, -0.42, 5], [0.05, 0.45, 4], [0.5, 0.2, 4.5], [-0.55, 0.25, 3.5]]) {
    ctx.beginPath();
    ctx.arc(x + u * r, y + v * r, s, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cottage: light spilling from the door, a red roof, smoke curling up.
  const hx = x - r * 0.22;
  const hy = y + r * 0.28;
  const flicker = 0.85 + 0.15 * Math.sin(time * 7) * Math.sin(time * 3.1);
  const glow = ctx.createRadialGradient(hx - 9, hy + 7, 0, hx - 9, hy + 7, 16);
  glow.addColorStop(0, `rgba(255, 214, 120, ${(0.75 * flicker).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(hx - 9, hy + 7, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.15);
  ctx.fillStyle = 'rgba(20, 40, 10, 0.35)';
  ctx.fillRect(-9, -4, 20, 14);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-11, -8, 20, 8);
  ctx.fillStyle = '#962a1e';
  ctx.fillRect(-11, 0, 20, 8);
  ctx.strokeStyle = '#6e1e14';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(9, 0);
  ctx.stroke();
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(3, -6.5, 3.4, 3.4);
  ctx.fillStyle = '#ffd678';
  ctx.fillRect(-12, 2, 1.6, 4);
  ctx.restore();
  ctx.fillStyle = 'rgba(240, 240, 240, 0.5)';
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.6 + i / 4) % 1;
    ctx.beginPath();
    ctx.arc(hx + 5 + t * 12, hy - 6 - t * 11, 1.5 + t * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawLighthouse(ctx, ...lighthouseLamp(f), time, 0.7);
  drawWaiting(ctx, jx + 2, jy, time);
}

// Someone at the end of the jetty, seen from above: a lantern held out, the
// other arm waving.
function drawWaiting(ctx, x, y, time) {
  const glow = ctx.createRadialGradient(x - 4, y + 3, 0, x - 4, y + 3, 14);
  const k = 0.8 + 0.2 * Math.sin(time * 9) * Math.sin(time * 4.3);
  glow.addColorStop(0, `rgba(255, 220, 130, ${(0.85 * k).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x - 4, y + 3, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0, 10, 18, 0.3)';
  ctx.beginPath();
  ctx.ellipse(1.2, 1.2, 3, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // The waving arm sweeps to and fro.
  const wave = Math.sin(time * 6) * 0.6;
  ctx.strokeStyle = '#3a7d6e';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -1.6);
  ctx.lineTo(-2.2 + Math.cos(-1.9 + wave) * 4, -1.6 + Math.sin(-1.9 + wave) * 4);
  ctx.moveTo(0, 1.6);
  ctx.lineTo(-4, 3);
  ctx.stroke();
  ctx.fillStyle = '#3a7d6e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2e';
  ctx.beginPath();
  ctx.arc(0, 0, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff1b8';
  ctx.beginPath();
  ctx.arc(-4.4, 3.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
