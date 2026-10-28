// Moving bits: wind streaks that show where the air flows, splashes and
// sparkles, floating labels, rain, storm clouds, lightning and the kraken.

import { clamp } from '../core/math.js';
import { sampleWind } from '../world/wind.js';
import { viewBounds } from './camera.js';
import { C, font } from './palette.js';

export function createEffects() {
  return {
    streaks: [],
    particles: [],
    floaters: [],
    rain: [],
    sample: {},
    bolt: null,
  };
}

function respawnStreak(s, v, rand = Math.random) {
  s.x = v.minX + rand() * (v.maxX - v.minX);
  s.y = v.minY + rand() * (v.maxY - v.minY);
  s.life = 0;
  s.max = 1.2 + rand() * 1.6;
  s.trail.length = 0;
  s.trail.push(s.x, s.y);
}

// Wind streaks live in world space inside the view.
export function updateStreaks(fx, game, cam, dt, count) {
  const v = viewBounds(cam, 30);
  while (fx.streaks.length < count) {
    const s = { x: 0, y: 0, life: 0, max: 1, trail: [] };
    respawnStreak(s, v);
    s.life = Math.random() * s.max;
    fx.streaks.push(s);
  }
  fx.streaks.length = Math.min(fx.streaks.length, count);
  const w = fx.sample;
  for (const s of fx.streaks) {
    s.life += dt;
    if (s.life > s.max || s.x < v.minX || s.x > v.maxX || s.y < v.minY || s.y > v.maxY) {
      respawnStreak(s, v);
      continue;
    }
    sampleWind(game.wind, s.x, s.y, w);
    s.vx = w.wx;
    s.vy = w.wy;
    s.speed = w.speed;
    s.gust = w.gust;
    s.x += w.wx * 1.3 * dt;
    s.y += w.wy * 1.3 * dt;
    // A short trail of past positions, so streaks bend around islands.
    const tl = s.trail;
    const lx = tl[tl.length - 2];
    const ly = tl[tl.length - 1];
    if ((s.x - lx) ** 2 + (s.y - ly) ** 2 > 6) {
      tl.push(s.x, s.y);
      if (tl.length > 10) tl.splice(0, 2);
    }
  }
}

export function drawStreaks(ctx, fx, game) {
  const base = Math.max(1, game.wind.speed);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of fx.streaks) {
    const tl = s.trail;
    if (!s.speed || tl.length < 4) continue;
    const t = s.life / s.max;
    const fade = Math.sin(t * Math.PI);
    const strength = clamp(s.speed / base, 0, 1.8);
    const alpha = fade * (0.12 + 0.26 * strength);
    if (alpha < 0.02) continue;
    ctx.lineWidth = 0.8 + strength * 0.5;
    // Older segments fade out toward the tail.
    const n = tl.length / 2;
    let px = tl[0];
    let py = tl[1];
    for (let i = 1; i <= n; i++) {
      const x = i < n ? tl[i * 2] : s.x;
      const y = i < n ? tl[i * 2 + 1] : s.y;
      ctx.strokeStyle = `rgba(232, 244, 242, ${((alpha * i) / n).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x;
      py = y;
    }
  }
}

export function burst(fx, x, y, opts = {}) {
  const n = opts.count ?? 14;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed ?? 20) * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: 0,
      max: (opts.life ?? 0.7) * (0.6 + Math.random() * 0.8),
      size: (opts.size ?? 2) * (0.6 + Math.random() * 0.8),
      color: opts.color || 'rgba(232, 244, 242, 1)',
      ring: !!opts.ring,
    });
  }
}

export function ring(fx, x, y, color, size = 30, life = 0.8) {
  fx.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: life, size, color, ring: true });
}

export function floatText(fx, x, y, text, color = C.foam) {
  fx.floaters.push({ x, y, text, color, life: 0, max: 1.4 });
}

export function updateParticles(fx, dt) {
  for (const p of fx.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.5;
    p.vy *= 1 - dt * 2.5;
  }
  fx.particles = fx.particles.filter((p) => p.life < p.max);
  for (const f of fx.floaters) {
    f.life += dt;
    f.y -= dt * 14;
  }
  fx.floaters = fx.floaters.filter((f) => f.life < f.max);
}

export function drawParticles(ctx, fx, cam) {
  for (const p of fx.particles) {
    const t = p.life / p.max;
    ctx.globalAlpha = 1 - t;
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.3 + t), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = 15 / cam.scale;
  ctx.font = font(Math.max(6, size * 1.0), 700);
  for (const f of fx.floaters) {
    const t = f.life / f.max;
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    ctx.fillStyle = 'rgba(6, 20, 29, 0.6)';
    ctx.fillText(f.text, f.x + 0.8 / cam.scale, f.y + 1 / cam.scale);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// Kraken: idle bubbles, boiling warning ring, then thrashing tentacles.
export function drawKrakens(ctx, game, time) {
  for (const k of game.level.krakens) {
    ctx.save();
    ctx.translate(k.x, k.y);
    if (k.phase === 'idle') {
      ctx.fillStyle = 'rgba(232, 244, 242, 0.25)';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + Math.floor(time * 0.8 + i) * 2.3;
        const r = ((i * 37) % 60) * 0.01 * k.r;
        const pop = (time * 0.8 + i * 0.2) % 1;
        ctx.globalAlpha = 1 - pop;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1 + pop * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (k.phase === 'warning') {
      const t = clamp(k.phaseTime / 1.8, 0, 1);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, k.r);
      grad.addColorStop(0, `rgba(10, 40, 50, ${0.5 * t})`);
      grad.addColorStop(1, 'rgba(10, 40, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, k.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 77, 77, ${0.35 + 0.45 * Math.abs(Math.sin(time * 10))})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, k.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(232, 244, 242, 0.55)';
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39996;
        const r = Math.sqrt((i + 0.5) / 26) * k.r * 0.9;
        const pop = (time * 2.5 + i * 0.13) % 1;
        ctx.globalAlpha = (1 - pop) * t;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5 + pop * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const t = clamp(k.phaseTime / 1.6, 0, 1);
      const rise = Math.sin(t * Math.PI);
      ctx.fillStyle = `rgba(4, 22, 30, ${0.45 * rise})`;
      ctx.beginPath();
      ctx.arc(0, 0, k.r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const reach = k.r * (0.35 + 0.75 * rise);
        ctx.strokeStyle = '#6c3b5c';
        ctx.lineCap = 'round';
        ctx.lineWidth = 9 * (0.5 + rise * 0.5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * k.r * 0.15, Math.sin(a) * k.r * 0.15);
        const curl = Math.sin(time * 7 + i) * 0.6;
        ctx.quadraticCurveTo(
          Math.cos(a + curl * 0.5) * reach * 0.6,
          Math.sin(a + curl * 0.5) * reach * 0.6,
          Math.cos(a + curl) * reach,
          Math.sin(a + curl) * reach,
        );
        ctx.stroke();
        ctx.strokeStyle = '#a5648c';
        ctx.lineWidth = 3 * (0.5 + rise * 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(232, 244, 242, ${0.6 * rise})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, k.r * (0.6 + t * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Storm clouds hang above the boat; drawn after it.
export function drawStormClouds(ctx, game, time) {
  for (const s of game.level.storms) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const grad = ctx.createRadialGradient(0, 0, s.r * 0.1, 0, 0, s.r);
    grad.addColorStop(0, 'rgba(10, 14, 22, 0.42)');
    grad.addColorStop(0.6, 'rgba(14, 20, 30, 0.25)');
    grad.addColorStop(1, 'rgba(14, 20, 30, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(time * 0.05);
    ctx.fillStyle = 'rgba(40, 48, 60, 0.18)';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s.r * 0.45, Math.sin(a) * s.r * 0.45, s.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Screen-space rain, slanted by the wind.
export function drawRain(ctx, fx, game, w, h, dt) {
  const amount = game.level.weather.rain || 0;
  let local = 0;
  for (const s of game.level.storms) {
    const d = Math.hypot(game.boat.x - s.x, game.boat.y - s.y);
    if (d < s.r) local = Math.max(local, 1 - d / s.r);
  }
  const intensity = clamp(amount + local * 0.6, 0, 1);
  const count = Math.floor(intensity * 220);
  while (fx.rain.length < count) fx.rain.push({ x: Math.random() * w, y: Math.random() * h, z: 0.5 + Math.random() * 0.5 });
  fx.rain.length = count;
  if (!count) return;
  const wx = game.windHere.wx;
  const wy = game.windHere.wy;
  ctx.strokeStyle = 'rgba(200, 220, 235, 0.32)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const r of fx.rain) {
    const vx = wx * 6 * r.z;
    const vy = 380 * r.z + wy * 6 * r.z;
    r.x += vx * dt;
    r.y += vy * dt;
    if (r.y > h) {
      r.y -= h + 20;
      r.x = Math.random() * w;
    }
    if (r.x < -20) r.x += w + 40;
    if (r.x > w + 20) r.x -= w + 40;
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - vx * 0.03, r.y - vy * 0.03);
  }
  ctx.stroke();
}

export function drawLightning(ctx, fx, game, w, h) {
  if (game.flash <= 0) {
    fx.bolt = null;
    return;
  }
  if (!fx.bolt) {
    const x = w * (0.2 + Math.random() * 0.6);
    const pts = [[x, -10]];
    let px = x;
    for (let y = 0; y < h * 0.7; y += 26) {
      px += (Math.random() - 0.5) * 50;
      pts.push([px, y]);
    }
    fx.bolt = pts;
  }
  ctx.fillStyle = `rgba(230, 240, 255, ${(game.flash * 0.45).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  if (game.flash > 0.6) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${game.flash})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    fx.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}
