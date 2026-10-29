// Moving bits: wind streaks that show where the air flows, splashes and
// sparkles, floating labels, rain, storm clouds, lightning and the kraken.

import { clamp } from '../core/math.js';
import { sampleWind } from '../world/wind.js';
import { viewBounds } from './camera.js';
import { C, font, rgba } from './palette.js';
import { drawLair } from './worldart.js';

export function createEffects() {
  return {
    calm: false, // reduced motion: lighter weather, no lightning bolts
    streaks: [],
    particles: [],
    floaters: [],
    rain: [],
    snow: [],
    sample: {},
    bolt: null,
  };
}

function respawnStreak(s, v, rand = Math.random) {
  s.x = v.minX + rand() * (v.maxX - v.minX);
  s.y = v.minY + rand() * (v.maxY - v.minY);
  s.life = 0;
  s.max = 2 + rand() * 2;
  s.phase = rand() * Math.PI * 2;
  s.trail.length = 0;
  s.trail.push(s.x, s.y);
}

// Wind streaks live in world space inside the view.
export function updateStreaks(fx, game, cam, dt, count) {
  const v = viewBounds(cam, 30);
  while (fx.streaks.length < count) {
    const s = { x: 0, y: 0, life: 0, max: 1, phase: 0, trail: [] };
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
    // Drift with the wind plus a slow sideways sway, so the lines curl
    // like wisps of air instead of falling like rain.
    const sway = Math.sin(s.life * 2.2 + s.phase) * 0.28;
    s.x += (w.wx - w.wy * sway) * 1.3 * dt;
    s.y += (w.wy + w.wx * sway) * 1.3 * dt;
    // A trail of past positions, so streaks bend around islands.
    const tl = s.trail;
    const lx = tl[tl.length - 2];
    const ly = tl[tl.length - 1];
    if ((s.x - lx) ** 2 + (s.y - ly) ** 2 > 9) {
      tl.push(s.x, s.y);
      if (tl.length > 28) tl.splice(0, 2);
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
    const alpha = fade * (0.1 + 0.22 * strength);
    if (alpha < 0.02) continue;
    ctx.lineWidth = 0.7 + strength * 0.45;
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
    if (drawLair(ctx, k, time)) {
      // Drawn by its own world.
    } else if (k.phase === 'idle') {
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
      ctx.strokeStyle = rgba(C.danger, 0.35 + 0.45 * Math.abs(Math.sin(time * 10)));
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
  const count = Math.floor(intensity * (fx.calm ? 80 : 220));
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

// Screen-space snow: slow flakes that tumble and drift with the wind.
export function drawSnow(ctx, fx, game, w, h, dt, time) {
  const amount = game.level.weather.snow || 0;
  const count = Math.floor(amount * (fx.calm ? 60 : 160));
  while (fx.snow.length < count) fx.snow.push({ x: Math.random() * w, y: Math.random() * h, z: 0.4 + Math.random() * 0.6, p: Math.random() * 6 });
  fx.snow.length = count;
  if (!count) return;
  const wx = game.windHere.wx;
  const wy = game.windHere.wy;
  ctx.fillStyle = 'rgba(240, 250, 252, 0.75)';
  ctx.beginPath();
  for (const f of fx.snow) {
    f.x += (wx * 2.2 + Math.sin(time * 1.3 + f.p) * 9) * f.z * dt;
    f.y += (34 + wy * 2.2) * f.z * dt;
    if (f.y > h + 4) {
      f.y = -4;
      f.x = Math.random() * w;
    } else if (f.y < -6) f.y = h + 2;
    if (f.x < -6) f.x += w + 12;
    if (f.x > w + 6) f.x -= w + 12;
    const r = 0.8 + f.z * 1.4;
    ctx.moveTo(f.x + r, f.y);
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

// Volcanic ash: grey flakes drifting down with the wind, and now and then a
// glowing ember.
export function drawAsh(ctx, fx, game, w, h, dt, time) {
  const amount = game.level.weather.ash || 0;
  const count = Math.floor(amount * (fx.calm ? 50 : 130));
  fx.ash = fx.ash || [];
  while (fx.ash.length < count) fx.ash.push({ x: Math.random() * w, y: Math.random() * h, z: 0.4 + Math.random() * 0.6, p: Math.random() * 6, ember: Math.random() < 0.12 });
  fx.ash.length = count;
  if (!count) return;
  const wx = game.windHere.wx;
  const wy = game.windHere.wy;
  for (const f of fx.ash) {
    f.x += (wx * 2.6 + Math.sin(time * 0.9 + f.p) * 12) * f.z * dt;
    f.y += (18 + wy * 2.6 + (f.ember ? -10 : 0)) * f.z * dt;
    if (f.y > h + 4) {
      f.y = -4;
      f.x = Math.random() * w;
    } else if (f.y < -6) f.y = h + 2;
    if (f.x < -6) f.x += w + 12;
    if (f.x > w + 6) f.x -= w + 12;
  }
  ctx.fillStyle = 'rgba(150, 146, 140, 0.6)';
  ctx.beginPath();
  for (const f of fx.ash) {
    if (f.ember) continue;
    const r = 0.7 + f.z * 1.3;
    ctx.moveTo(f.x + r, f.y);
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  for (const f of fx.ash) {
    if (!f.ember) continue;
    const glow = 0.5 + 0.5 * Math.sin(time * 6 + f.p * 3);
    ctx.fillStyle = `rgba(255, ${140 + Math.round(80 * glow)}, 60, ${(0.5 + 0.4 * glow).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 0.8 + f.z, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Fireflies and will-o'-wisps: soft glows that wander about the screen,
// brighter after dark.
export function drawMotes(ctx, fx, game, w, h, dt, time) {
  const weather = game.level.weather;
  const amount = weather.motes || 0;
  const count = Math.floor(amount * (fx.calm ? 30 : 70));
  fx.motes = fx.motes || [];
  while (fx.motes.length < count) fx.motes.push({ x: Math.random() * w, y: Math.random() * h, p: Math.random() * 40, s: 0.6 + Math.random() * 0.8 });
  fx.motes.length = count;
  if (!count) return;
  const rgb = weather.moteColor || '230, 255, 120';
  const bright = weather.night ? 1 : 0.6;
  const wx = game.windHere.wx;
  const wy = game.windHere.wy;
  if (weather.moteStyle === 'bubble') {
    drawBubbles(ctx, fx.motes, rgb, wx, wy, w, h, dt, time);
    return;
  }
  for (const m of fx.motes) {
    m.x += (Math.sin(time * 0.7 + m.p) * 16 + wx * 0.6) * m.s * dt;
    m.y += (Math.cos(time * 0.55 + m.p * 1.3) * 12 + wy * 0.6) * m.s * dt;
    if (m.x < -10) m.x += w + 20;
    if (m.x > w + 10) m.x -= w + 20;
    if (m.y < -10) m.y += h + 20;
    if (m.y > h + 10) m.y -= h + 20;
    const blink = Math.max(0, Math.sin(time * 1.6 * m.s + m.p));
    if (blink < 0.05) continue;
    const a = blink * bright;
    const r = 5 + m.s * 4;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    g.addColorStop(0, `rgba(${rgb}, ${(0.85 * a).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(${rgb}, ${(0.3 * a).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Soap bubbles: they wobble along on the breeze, shine, and now and then pop
// and start again somewhere else.
function drawBubbles(ctx, motes, rgb, wx, wy, w, h, dt, time) {
  ctx.lineWidth = 1;
  for (const m of motes) {
    m.x += (Math.sin(time * 0.9 + m.p) * 10 + wx * 1.4) * m.s * dt;
    m.y += (Math.cos(time * 0.7 + m.p * 1.3) * 8 + wy * 1.4) * m.s * dt;
    if (m.x < -14) m.x += w + 28;
    if (m.x > w + 14) m.x -= w + 28;
    if (m.y < -14) m.y += h + 28;
    if (m.y > h + 14) m.y -= h + 28;
    const life = Math.sin(time * 0.4 * m.s + m.p);
    if (life < 0.1) continue;
    const a = Math.min(1, (life - 0.1) * 4);
    const r = 3 + m.s * 5;
    const wob = 1 + Math.sin(time * 5 + m.p) * 0.06;
    ctx.fillStyle = `rgba(${rgb}, ${(0.1 * a).toFixed(3)})`;
    ctx.strokeStyle = `rgba(${rgb}, ${(0.55 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, r * wob, r / wob, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 190, 240, ${(0.35 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 0.8, 0.3, 1.4);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.8 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(m.x - r * 0.4, m.y - r * 0.42, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The northern lights: green and violet curtains rippling across the sky,
// brightest at night. Drawn over the darkness so they glow.
export function drawAurora(ctx, fx, game, w, h, time) {
  const weather = game.level.weather;
  const amount = weather.aurora || 0;
  if (!amount) return;
  const bright = amount * (weather.night ? 1 : 0.55);
  const t = time * (fx.calm ? 0.08 : 0.22);
  const bands = [
    ['95, 240, 176', 0.18, 0],
    ['154, 107, 255', 0.3, 2.1],
    ['95, 240, 200', 0.42, 4.3],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const [rgb, at, phase] of bands) {
    const curve = (x) => h * at + Math.sin(x * 0.006 + t + phase) * h * 0.07 + Math.sin(x * 0.017 - t * 1.7 + phase) * h * 0.025;
    const line = () => {
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 16) {
        const y = curve(x);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    line();
    ctx.strokeStyle = `rgba(${rgb}, ${(0.05 * bright).toFixed(3)})`;
    ctx.lineWidth = h * 0.11;
    ctx.stroke();
    // The bright core, waxing and waning along its length as it ripples.
    ctx.lineCap = 'butt';
    ctx.lineWidth = h * 0.04;
    for (let x = -20; x <= w + 20; x += 16) {
      const shimmer = 0.5 + 0.5 * Math.sin(x * 0.015 - t * 3 + phase);
      ctx.strokeStyle = `rgba(${rgb}, ${((0.04 + 0.08 * shimmer) * bright).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x, curve(x));
      ctx.lineTo(x + 16, curve(x + 16));
      ctx.stroke();
    }
    ctx.lineCap = 'round';
  }
  ctx.restore();
}

// Fair-weather clouds drifting high over the sea with their shadows below.
// They sit in a grid that rides the wind, so each comes back where it was.
export function drawClouds(ctx, fx, game, cam, time, dt) {
  const amount = game.level.weather.clouds || 0;
  if (!amount) return;
  const speed = game.wind.speed * (fx.calm ? 0.3 : 0.9);
  fx.cloudX = (fx.cloudX || 0) + Math.cos(game.wind.angle) * speed * dt;
  fx.cloudY = (fx.cloudY || 0) + Math.sin(game.wind.angle) * speed * dt;
  const v = viewBounds(cam, 260);
  const size = 420;
  const ox = fx.cloudX;
  const oy = fx.cloudY;
  const puffs = [];
  for (let gy = Math.floor((v.minY - oy) / size); gy <= Math.floor((v.maxY - oy) / size); gy++) {
    for (let gx = Math.floor((v.minX - ox) / size); gx <= Math.floor((v.maxX - ox) / size); gx++) {
      const seed = gx * 73.1 + gy * 191.7;
      const e = hashFx(seed);
      if (e > 0.35 + amount * 0.4) continue;
      const cx = (gx + 0.2 + hashFx(seed + 1) * 0.6) * size + ox;
      const cy = (gy + 0.2 + hashFx(seed + 2) * 0.6) * size + oy;
      const n = 4 + Math.floor(hashFx(seed + 3) * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + e * 6;
        const d = 30 + hashFx(seed + i * 7.3) * 34;
        puffs.push([cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.8, 34 + hashFx(seed + i * 3.1) * 30]);
      }
      puffs.push([cx, cy, 56 + e * 30]);
    }
  }
  if (!puffs.length) return;
  ctx.fillStyle = 'rgba(20, 50, 90, 0.07)';
  ctx.beginPath();
  for (const [x, y, r] of puffs) {
    ctx.moveTo(x + 60 + r, y + 90);
    ctx.arc(x + 60, y + 90, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.beginPath();
  for (const [x, y, r] of puffs) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  for (const [x, y, r] of puffs) {
    ctx.moveTo(x - r * 0.15 + r * 0.6, y - r * 0.2);
    ctx.arc(x - r * 0.15, y - r * 0.2, r * 0.6, 0, Math.PI * 2);
  }
  ctx.fill();
}

function hashFx(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
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
  // With reduced motion the strike is only a soft glow: no white-out, no bolt.
  ctx.fillStyle = `rgba(230, 240, 255, ${(game.flash * (fx.calm ? 0.06 : 0.45)).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  if (game.flash > 0.6 && !fx.calm) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${game.flash})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    fx.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}
