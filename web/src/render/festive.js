// Festival dressing: jack-o'-lanterns and bats for Halloween, little clay
// lamps and fireworks for Diwali, lit trees on the islands and floating
// baubles for Christmas, paper lanterns and fireworks for New Year
// (data/festivals.js says which week is which). The floats are only
// decoration: boats sail straight through them.

import { createRng, hashString } from '../core/rng.js';
import { isClear, circlePolygon } from '../world/collision.js';
import { viewBounds } from './camera.js';

const FLOAT = { halloween: 'pumpkin', diwali: 'diya', christmas: 'bauble', newyear: 'lantern' };
const SKY = { diwali: 0.9, newyear: 1.4 }; // fireworks a second, roughly

// Where a level's floats bob, worked out once per level.
const floatsOf = new WeakMap();

export function festiveFloats(level) {
  if (!level.festival || !FLOAT[level.festival]) return [];
  let out = floatsOf.get(level);
  if (out) return out;
  out = [];
  const kind = FLOAT[level.festival];
  const rng = createRng(hashString(`festive:${level.festival}:${level.id}`));
  const want = Math.max(10, Math.min(40, Math.round((level.width * level.height) / 80000)));
  const ends = [level.start, level.finish];
  const away = (x, y, d) => out.every((f) => Math.hypot(f.x - x, f.y - y) > d) && ends.every((e) => Math.hypot(e.x - x, e.y - y) > 110);
  const inside = (x, y) => x > 40 && y > 40 && x < level.width - 40 && y < level.height - 40;
  const place = (x, y) => {
    if (!inside(x, y) || !isClear(level, x, y, 26) || !away(x, y, 90)) return false;
    // Diwali's lamps float in little groups.
    const n = kind === 'diya' ? rng.int(3, 5) : 1;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = i ? rng.range(12, 26) : 0;
      out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, kind, phase: rng.range(0, 6.3), hue: rng.int(0, 3) });
    }
    return true;
  };
  // A few close to the start, so the voyage opens among them.
  for (let tries = 0, near = 0; near < 3 && tries < 60; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(130, 280);
    if (place(level.start.x + Math.cos(a) * d, level.start.y + Math.sin(a) * d)) near++;
  }
  for (let tries = 0; out.length < want && tries < want * 12; tries++) place(rng.range(40, level.width - 40), rng.range(40, level.height - 40));
  floatsOf.set(level, out);
  return out;
}

// Christmas: a tree in the middle of each island big enough for one.
function trees(level) {
  if (level.festival !== 'christmas') return [];
  return level.islands.filter((isl) => isl.radius > 45 && isl.kind !== 'ice' && circlePolygon(isl.cx, isl.cy, 1, isl));
}

// Lights for the night overlay: [x, y, radius, strength].
export function festiveLights(level) {
  const out = festiveFloats(level).map((f) => [f.x, f.y, f.kind === 'diya' ? 26 : 40, 0.75]);
  for (const isl of trees(level)) out.push([isl.cx, isl.cy, 70, 0.8]);
  return out;
}

export function drawFestive(ctx, game, cam, time) {
  const level = game.level;
  if (!level.festival) return;
  const v = viewBounds(cam, 60);
  const seen = (x, y) => x > v.minX && x < v.maxX && y > v.minY && y < v.maxY;
  for (const isl of trees(level)) {
    if (!seen(isl.cx, isl.cy)) continue;
    ctx.save();
    ctx.translate(isl.cx, isl.cy);
    const s = Math.min(1.6, isl.radius / 60);
    ctx.scale(s, s);
    drawTree(ctx, time + isl.cx);
    ctx.restore();
  }
  for (const f of festiveFloats(level)) {
    if (!seen(f.x, f.y)) continue;
    const bob = Math.sin(time * 1.6 + f.phase);
    ctx.save();
    ctx.translate(f.x, f.y + bob * 1.2);
    ctx.rotate(Math.sin(time * 0.9 + f.phase) * 0.12);
    if (f.kind === 'pumpkin') drawPumpkin(ctx, time + f.phase);
    else if (f.kind === 'diya') drawDiya(ctx, time + f.phase);
    else if (f.kind === 'bauble') drawBauble(ctx, f.hue);
    else drawLantern(ctx, time + f.phase, f.hue);
    ctx.restore();
  }
}

function glow(ctx, r, color, a) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${color}, ${a})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPumpkin(ctx, t) {
  const flicker = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
  glow(ctx, 26, '255, 150, 40', 0.32 * flicker);
  ctx.fillStyle = '#e8741c';
  ctx.strokeStyle = '#a84a0c';
  ctx.lineWidth = 1;
  for (const [dx, rx] of [[-4.5, 5], [4.5, 5], [0, 5.5]]) {
    ctx.beginPath();
    ctx.ellipse(dx, 0, rx, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#3f6b22';
  ctx.fillRect(-1, -9.5, 2, 3.5);
  ctx.fillStyle = `rgba(255, 220, 90, ${0.7 + 0.3 * flicker})`;
  ctx.beginPath();
  ctx.moveTo(-5, -2.5);
  ctx.lineTo(-2, -2.5);
  ctx.lineTo(-3.5, -5);
  ctx.moveTo(5, -2.5);
  ctx.lineTo(2, -2.5);
  ctx.lineTo(3.5, -5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, 1.5);
  for (let i = 0; i <= 5; i++) ctx.lineTo(-5 + i * 2, i % 2 ? 4.5 : 2.5);
  ctx.lineTo(5, 3.5);
  ctx.quadraticCurveTo(0, 6.5, -5, 3.5);
  ctx.fill();
}

function drawDiya(ctx, t) {
  const flicker = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 6.1);
  glow(ctx, 16, '255, 190, 80', 0.38 * flicker);
  ctx.fillStyle = '#b5532a';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 5.5, 3, 0, 0, Math.PI);
  ctx.lineTo(-5.5, 1.5);
  ctx.fill();
  ctx.fillStyle = '#d9783f';
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 5.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 214, 110, ${flicker})`;
  ctx.beginPath();
  ctx.moveTo(3.2, 1);
  ctx.quadraticCurveTo(5.5, -1.5, 3.8, -5 - flicker);
  ctx.quadraticCurveTo(2, -1.5, 3.2, 1);
  ctx.fill();
}

const BAUBLES = ['#d6283b', '#e2b44d', '#2f8f5b', '#4a7fd6'];

function drawBauble(ctx, hue) {
  ctx.fillStyle = 'rgba(255, 240, 200, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BAUBLES[hue % BAUBLES.length];
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(-2, -8.5, 4, 2.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(-2.2, -2.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

const LANTERNS = ['#e83a3a', '#f2a33a', '#f7d046', '#e85a9a'];

function drawLantern(ctx, t, hue) {
  const flicker = 0.85 + 0.15 * Math.sin(t * 7);
  glow(ctx, 24, '255, 170, 90', 0.3 * flicker);
  ctx.fillStyle = LANTERNS[hue % LANTERNS.length];
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 236, 170, ${0.45 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-3.5, -8.5, 7, 1.8);
  ctx.fillRect(-3.5, 6.8, 7, 1.8);
}

const TREE_LIGHTS = ['#ff5a5a', '#ffd23f', '#7fd8f0', '#ff9ad5'];

function drawTree(ctx, t) {
  glow(ctx, 34, '255, 220, 140', 0.18);
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(-2, 8, 4, 6);
  ctx.fillStyle = '#1f6b3e';
  for (const [w, y0, y1] of [[13, 10, -2], [10.5, 3, -9], [7.5, -4, -15]]) {
    ctx.beginPath();
    ctx.moveTo(-w, y0);
    ctx.lineTo(w, y0);
    ctx.lineTo(0, y1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillRect(-9, 8.5, 18, 1.2);
  const spots = [[-6, 6], [5, 7], [-2, 2], [6, 0], [-5, -3], [2, -6], [-2, -10], [3, 4]];
  spots.forEach(([x, y], i) => {
    const on = Math.sin(t * 3 + i * 1.7) > -0.3;
    ctx.fillStyle = on ? TREE_LIGHTS[i % TREE_LIGHTS.length] : 'rgba(80, 60, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 1.6 : 4;
    ctx.lineTo(Math.cos(a) * r, -16 + Math.sin(a) * r);
  }
  ctx.fill();
}

// --- In the sky, drawn over the night ---------------------------------------

const SPARKS = ['255, 214, 90', '255, 120, 90', '140, 220, 255', '255, 150, 220', '170, 255, 160'];

export function createFestiveSky() {
  return { bursts: [], next: 0.5, bats: [] };
}

// Fireworks for Diwali and New Year, bats for Halloween. `calm` (reduced
// motion) keeps the fireworks few and soft.
export function drawFestiveSky(ctx, sky, game, w, h, dt, calm = false) {
  const fest = game.level.festival;
  if (!fest) return;
  if (fest === 'halloween') return drawBats(ctx, sky, w, h, dt);
  const rate = SKY[fest];
  if (!rate) return;
  sky.next -= dt;
  if (sky.next <= 0 && sky.bursts.length < 6) {
    sky.next = (calm ? 3 : 1) * (0.4 + Math.random() * 1.2) / rate;
    const n = calm ? 18 : 34;
    const color = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    const x = w * (0.12 + Math.random() * 0.76);
    const y = h * (0.1 + Math.random() * 0.35);
    const speed = Math.min(w, h) * (0.16 + Math.random() * 0.1);
    sky.bursts.push({ x, y, age: 0, life: 1.6, color, sparks: Array.from({ length: n }, (_, i) => ((i + Math.random() * 0.5) / n) * Math.PI * 2), speed });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of sky.bursts) {
    b.age += dt;
    const k = b.age / b.life;
    const r = b.speed * (1 - Math.pow(1 - Math.min(1, k * 1.4), 3));
    const fall = k * k * b.speed * 0.35;
    const a = Math.max(0, 1 - k) * (calm ? 0.5 : 0.95);
    if (k < 0.12 && !calm) {
      ctx.fillStyle = `rgba(${b.color}, ${0.18 * (1 - k / 0.12)})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.speed * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Each spark trails a streak back toward the burst, then a bright head.
    ctx.strokeStyle = `rgba(${b.color}, ${a * 0.55})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const ang of b.sparks) {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.moveTo(b.x + c * r * 0.7, b.y + s * r * 0.7 + fall * 0.7);
      ctx.lineTo(b.x + c * r, b.y + s * r + fall);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(${b.color}, ${a})`;
    for (const ang of b.sparks) {
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r + fall, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  sky.bursts = sky.bursts.filter((b) => b.age < b.life);
}

function drawBats(ctx, sky, w, h, dt) {
  while (sky.bats.length < 5) {
    sky.bats.push({ x: Math.random() * w, y: h * (0.08 + Math.random() * 0.3), vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 50), flap: Math.random() * 6, size: 5 + Math.random() * 4 });
  }
  ctx.save();
  // Pale enough to show against the night.
  ctx.fillStyle = 'rgba(86, 64, 108, 0.9)';
  for (const b of sky.bats) {
    b.x += b.vx * dt;
    b.flap += dt * 14;
    b.y += Math.sin(b.flap * 0.3) * 0.4;
    if (b.x < -30) b.x = w + 20;
    if (b.x > w + 30) b.x = -20;
    const up = Math.sin(b.flap) * b.size * 0.8;
    const s = b.size;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x - s * 0.8, b.y - up - s * 0.3, b.x - s * 1.8, b.y - up);
    ctx.quadraticCurveTo(b.x - s, b.y + s * 0.2, b.x, b.y + s * 0.35);
    ctx.quadraticCurveTo(b.x + s, b.y + s * 0.2, b.x + s * 1.8, b.y - up);
    ctx.quadraticCurveTo(b.x + s * 0.8, b.y - up - s * 0.3, b.x, b.y);
    ctx.fill();
  }
  ctx.restore();
}
