// Sea life on screen: dolphins that porpoise along beside the bow, whales that
// spout, dive and breach, the swell a breach sends out, gulls that perch on a
// slow boat or circle the harbor, and schools of flying fish that skim away
// from a fast one. Gulls and flying fish are decoration only.

import { clamp, dist } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';
import { WHALE } from '../world/wildlife.js';
import { viewBounds } from './camera.js';
import { VISUAL } from './boat.js';

const TAU = Math.PI * 2;

export function createLifeFx() {
  return {
    gull: { state: 'away', x: 0, y: 0, heading: 0, t: 0, cooldown: 4 },
    slow: 0,
    fish: [],
    fishTimer: 5,
  };
}

// --- Decoration state --------------------------------------------------------

export function updateLifeFx(lf, game, dt) {
  const { boat } = game;
  const speed = boatSpeed(boat);
  const g = lf.gull;
  lf.slow = speed < 2 && game.status === 'sailing' ? lf.slow + dt : 0;
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.t += dt;
  const perch = perchPoint(boat);
  if (g.state === 'away' && lf.slow > 3 && g.cooldown <= 0) {
    // A gull spots a boat sitting still and drops in for a rest.
    const a = boat.heading + Math.PI * (0.6 + Math.random() * 0.8);
    g.x = boat.x + Math.cos(a) * 170;
    g.y = boat.y + Math.sin(a) * 170;
    g.state = 'arriving';
    g.t = 0;
  } else if (g.state === 'arriving') {
    const d = dist(g.x, g.y, perch.x, perch.y);
    const step = Math.min(d, 42 * dt);
    g.heading = Math.atan2(perch.y - g.y, perch.x - g.x);
    g.x += Math.cos(g.heading) * step;
    g.y += Math.sin(g.heading) * step;
    if (d < 1.5) {
      g.state = 'perched';
      g.t = 0;
    }
    if (speed > 6 || game.status !== 'sailing') leave(g, boat);
  } else if (g.state === 'perched') {
    g.x = perch.x;
    g.y = perch.y;
    if (speed > 5 || game.status !== 'sailing') leave(g, boat);
  } else if (g.state === 'leaving') {
    g.x += Math.cos(g.heading) * 46 * dt;
    g.y += Math.sin(g.heading) * 46 * dt;
    g.heading += Math.sin(g.t * 1.3) * 0.4 * dt;
    if (g.t > 5) {
      g.state = 'away';
      g.cooldown = 18;
    }
  }

  // Flying fish burst out ahead of a boat going fast.
  lf.fishTimer -= dt;
  if (lf.fishTimer <= 0) {
    lf.fishTimer = 9 + Math.random() * 10;
    if (speed > 11 && game.status === 'sailing' && !game.level.weather.night) spawnFish(lf, boat);
  }
  for (let i = lf.fish.length - 1; i >= 0; i--) {
    const f = lf.fish[i];
    f.t += dt;
    if (f.t > f.delay + f.dur + 0.6) lf.fish.splice(i, 1);
  }
}

function leave(g, boat) {
  g.state = 'leaving';
  g.t = 0;
  g.heading = boat.heading + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.6);
}

// On the stern of the boat as drawn.
function perchPoint(boat) {
  const L = boat.type.length * VISUAL;
  return { x: boat.x - Math.cos(boat.heading) * L * 0.4, y: boat.y - Math.sin(boat.heading) * L * 0.4 };
}

function spawnFish(lf, boat) {
  const side = Math.random() < 0.5 ? 1 : -1;
  const n = 4 + Math.floor(Math.random() * 4);
  const ahead = 26 + Math.random() * 18;
  const ox = boat.x + Math.cos(boat.heading) * ahead;
  const oy = boat.y + Math.sin(boat.heading) * ahead;
  for (let k = 0; k < n; k++) {
    const a = boat.heading + side * (0.5 + Math.random() * 0.6);
    lf.fish.push({
      x: ox + (Math.random() - 0.5) * 14,
      y: oy + (Math.random() - 0.5) * 14,
      a,
      speed: 38 + Math.random() * 16,
      delay: k * 0.12 + Math.random() * 0.25,
      dur: 1.1 + Math.random() * 0.7,
      t: 0,
    });
  }
}

// --- Drawing -------------------------------------------------------------------

function visible(v, x, y, pad) {
  return x > v.minX - pad && x < v.maxX + pad && y > v.minY - pad && y < v.maxY + pad;
}

// Below the boat's wake: whale shadows, the bubble ring before a breach, and swells.
export function drawSeaBelow(ctx, game, cam, time) {
  const life = game.life;
  if (!life) return;
  const v = viewBounds(cam, 0);
  for (const s of life.swells) {
    const k = 1 - s.r / WHALE.swell;
    ctx.lineWidth = 3 + 7 * k;
    ctx.strokeStyle = `rgba(4, 22, 30, ${0.18 * k})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1, s.r - 5), 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2 + 3 * k;
    ctx.strokeStyle = `rgba(232, 244, 242, ${0.45 * k})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.stroke();
  }
  for (const w of life.whales) {
    if (!visible(v, w.x, w.y, 80)) continue;
    if (w.phase === 'deep' || w.phase === 'rising') {
      const t = w.phase === 'rising' ? clamp(w.phaseTime / (WHALE.breach - WHALE.rise), 0, 1) : 0;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.heading);
      ctx.globalAlpha = 0.2 + 0.25 * t;
      whaleShape(ctx, 1.08);
      ctx.fillStyle = '#04161e';
      ctx.fill();
      ctx.restore();
    }
    if (w.phase === 'rising') {
      // A ring of bubbles marks where it will come up.
      const t = clamp(w.phaseTime / (WHALE.breach - WHALE.rise), 0, 1);
      ctx.fillStyle = 'rgba(232, 244, 242, 0.7)';
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * TAU + time * 0.6;
        const pop = (time * 2.2 + i * 0.37) % 1;
        const r = WHALE.body * (1.05 - 0.2 * t) + Math.sin(i * 7.1) * 3;
        ctx.globalAlpha = (1 - pop) * (0.35 + 0.65 * t);
        ctx.beginPath();
        ctx.arc(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, 1 + pop * 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// On the surface, under the boat: dolphins and a whale's back.
export function drawSeaLife(ctx, game, cam, time) {
  const life = game.life;
  if (!life) return;
  const v = viewBounds(cam, 0);
  for (const w of life.whales) {
    if (w.phase !== 'surface' || !visible(v, w.x, w.y, 60)) continue;
    // Surfacing after a breach, the whale fades in from below.
    const fade = w.phaseTime < 2 ? w.phaseTime / 2 : 1;
    const sink = WHALE.dive - w.phaseTime;
    const a = clamp(Math.min(fade, sink / 1.5), 0, 1);
    drawWhaleBack(ctx, w, time, a);
  }
  for (const pod of life.pods) {
    if (!visible(v, pod.x, pod.y, 120)) continue;
    const fast = pod.state === 'escort' ? 3.2 : 1.6;
    for (const m of pod.members) {
      if (m.leap > 0) continue;
      const surf = clamp(0.45 + 0.9 * Math.sin(time * fast + m.phase), 0, 1);
      drawDolphin(ctx, m, surf, 0, time);
    }
  }
}

// Above the boat: leaping dolphins, a breaching whale, spouts, gulls and flying fish.
export function drawSkyLife(ctx, lf, game, cam, time) {
  const life = game.life;
  const v = viewBounds(cam, 0);
  if (life) {
    for (const pod of life.pods) {
      if (!visible(v, pod.x, pod.y, 120)) continue;
      for (const m of pod.members) if (m.leap > 0) drawDolphin(ctx, m, 1, 1 - m.leap, time);
    }
    for (const w of life.whales) {
      if (!visible(v, w.x, w.y, 90)) continue;
      if (w.phase === 'breach') drawBreach(ctx, w, clamp(w.phaseTime / (WHALE.splash - WHALE.breach), 0, 1));
      if (w.spout > 0) drawSpout(ctx, w, game, w.spout);
    }
  }
  for (const f of lf.fish) drawFlyingFish(ctx, f);
  const g = lf.gull;
  if (g.state === 'perched') drawPerchedGull(ctx, g, game.boat, time);
  else if (g.state !== 'away') drawGull(ctx, g.x, g.y, g.heading, time * 9, 9);
  // Gulls circle over the harbor or the lighthouse.
  const f = game.level.finish;
  if (visible(v, f.x, f.y, 90)) {
    for (let i = 0; i < 2; i++) {
      const r = 46 + i * 22;
      const a = time * (0.45 - i * 0.12) * (i ? -1 : 1) + i * 2;
      const x = f.x + Math.cos(a) * r;
      const y = f.y + Math.sin(a) * r * 0.8;
      const heading = a + (i ? -1 : 1) * Math.PI / 2;
      drawGull(ctx, x, y, heading, time * (i ? 5 : 3.5) + i, 14);
    }
  }
}

// --- Dolphins -------------------------------------------------------------------

// Seen from above: a beak, a rounded melon, and wide flat tail flukes, so
// it never reads as a shark.
function dolphinShape(ctx) {
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.quadraticCurveTo(6.6, -0.35, 5.6, -0.45);
  ctx.quadraticCurveTo(5, -1.3, 3.6, -1.45);
  ctx.bezierCurveTo(1.5, -1.65, -1.5, -1.2, -3.6, -0.45);
  ctx.lineTo(-4.6, -0.3);
  ctx.quadraticCurveTo(-5.2, -2.6, -6.4, -2.9);
  ctx.quadraticCurveTo(-5.6, -1, -6, 0);
  ctx.quadraticCurveTo(-5.6, 1, -6.4, 2.9);
  ctx.quadraticCurveTo(-5.2, 2.6, -4.6, 0.3);
  ctx.lineTo(-3.6, 0.45);
  ctx.bezierCurveTo(-1.5, 1.2, 1.5, 1.65, 3.6, 1.45);
  ctx.quadraticCurveTo(5, 1.3, 5.6, 0.45);
  ctx.quadraticCurveTo(6.6, 0.35, 7, 0);
  ctx.closePath();
}

function drawDolphin(ctx, m, surf, leapT, time) {
  const height = leapT > 0 ? Math.sin(leapT * Math.PI) : 0;
  if (height > 0) {
    // Shadow on the water, then the dolphin up in the air.
    ctx.save();
    ctx.translate(m.x + height * 3, m.y + height * 4);
    ctx.rotate(m.heading);
    ctx.fillStyle = 'rgba(4, 22, 30, 0.25)';
    dolphinShape(ctx);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.heading);
  if (height > 0) {
    if (leapT < 0.15 || leapT > 0.85) {
      ctx.strokeStyle = 'rgba(232, 244, 242, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(leapT < 0.5 ? -3 : 4, 0, 3 + 4 * (leapT < 0.5 ? leapT : 1 - leapT) * 6, 0, TAU);
      ctx.stroke();
    }
    ctx.scale(1 + 0.4 * height, 1 + 0.4 * height);
  }
  ctx.globalAlpha = 0.3 + 0.7 * surf;
  // Flippers under the body, then the body with a darker cape and a blowhole.
  ctx.fillStyle = '#5f8ba1';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(2.6, sd * 1.2);
    ctx.quadraticCurveTo(1.2, sd * 3.4, 0.2, sd * 3.3);
    ctx.lineTo(1.2, sd * 1.3);
    ctx.closePath();
    ctx.fill();
  }
  dolphinShape(ctx);
  ctx.fillStyle = surf > 0.3 ? '#8ab6cb' : '#5f8ba1';
  ctx.fill();
  ctx.fillStyle = surf > 0.3 ? '#5b8499' : '#4a7186';
  ctx.beginPath();
  ctx.ellipse(0.4, 0, 3.6, 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2c4756';
  ctx.beginPath();
  ctx.arc(3.4, 0, 0.32, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (surf > 0.5 && height === 0) {
    // A curl of foam off the nose as it breaks the surface.
    ctx.strokeStyle = `rgba(232, 244, 242, ${0.55 * (surf - 0.5) * 2})`;
    ctx.lineWidth = 0.7;
    const sp = 1 + 0.3 * Math.sin(time * 6 + m.phase);
    ctx.beginPath();
    ctx.moveTo(7.6, 0);
    ctx.quadraticCurveTo(5, -2.6 * sp, 2, -3 * sp);
    ctx.moveTo(7.6, 0);
    ctx.quadraticCurveTo(5, 2.6 * sp, 2, 3 * sp);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Whales ---------------------------------------------------------------------

// A humpback seen from above, nose along +x, about 42 units long.
function whaleShape(ctx, k = 1) {
  ctx.beginPath();
  ctx.moveTo(19 * k, 0);
  ctx.bezierCurveTo(19 * k, -4.5 * k, 12 * k, -7 * k, 5 * k, -7 * k);
  ctx.bezierCurveTo(-4 * k, -7 * k, -10 * k, -3.5 * k, -15 * k, -1.4 * k);
  ctx.quadraticCurveTo(-19 * k, -2 * k, -22 * k, -9 * k);
  ctx.quadraticCurveTo(-24 * k, -4 * k, -21.5 * k, 0);
  ctx.quadraticCurveTo(-24 * k, 4 * k, -22 * k, 9 * k);
  ctx.quadraticCurveTo(-19 * k, 2 * k, -15 * k, 1.4 * k);
  ctx.bezierCurveTo(-10 * k, 3.5 * k, -4 * k, 7 * k, 5 * k, 7 * k);
  ctx.bezierCurveTo(12 * k, 7 * k, 19 * k, 4.5 * k, 19 * k, 0);
  ctx.closePath();
}

function drawWhaleBody(ctx, roll = 0) {
  // Long pale flippers first, so the body overlaps their roots.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(9, s * 5);
    ctx.quadraticCurveTo(4, s * (15 + roll * 3), -4, s * (17 + roll * 2));
    ctx.quadraticCurveTo(2, s * 10, 4, s * 5);
    ctx.closePath();
    ctx.fillStyle = s > 0 ? '#c3d0d6' : '#9fb0b8';
    ctx.fill();
  }
  whaleShape(ctx);
  ctx.fillStyle = '#2e4452';
  ctx.fill();
  // Mottling and a pale knobbly head.
  ctx.fillStyle = 'rgba(160, 186, 196, 0.35)';
  for (const [x, y, r] of [[14, -1.5, 0.8], [15, 1.8, 0.7], [12.5, 0.3, 0.6], [16.5, 0, 0.5], [-3, 3.2, 1.4], [-7, -2, 1], [2, -4, 1.1]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // Ridge along the spine to the small dorsal hump.
  ctx.strokeStyle = 'rgba(20, 40, 52, 0.8)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-9, 0);
  ctx.stroke();
  ctx.fillStyle = '#1d313d';
  ctx.beginPath();
  ctx.ellipse(-7, 0, 2.2, 1, 0, 0, TAU);
  ctx.fill();
}

function drawWhaleBack(ctx, w, time, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(w.heading);
  // Glassy slick where its flukes stir the water.
  ctx.fillStyle = `rgba(232, 244, 242, ${0.07 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(-30, 0, 16, 9, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.85 * alpha;
  drawWhaleBody(ctx);
  ctx.globalAlpha = alpha;
  // Water washing over the back.
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.45)';
  ctx.lineWidth = 1;
  const sw = Math.sin(time * 1.4 + w.cx) * 1.5;
  ctx.beginPath();
  ctx.ellipse(1, 0, 21 + sw, 8.5, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawBreach(ctx, w, t) {
  const height = Math.sin(t * Math.PI);
  ctx.save();
  ctx.translate(w.x, w.y);
  // Shadow and the churned water it leaves.
  ctx.fillStyle = `rgba(232, 244, 242, ${0.35 * height})`;
  ctx.beginPath();
  ctx.arc(0, 0, 22 + 10 * t, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(height * 12, height * 16);
  ctx.rotate(w.heading);
  ctx.fillStyle = 'rgba(4, 22, 30, 0.3)';
  whaleShape(ctx);
  ctx.fill();
  ctx.restore();
  // The whale itself, up out of the water and rolling onto its back.
  ctx.rotate(w.heading + t * 0.9);
  const s = 1 + 0.5 * height;
  ctx.scale(s, s * (1 - 0.35 * Math.sin(t * Math.PI * 0.9)));
  drawWhaleBody(ctx, height);
  ctx.restore();
}

function drawSpout(ctx, w, game, left) {
  const age = 1.4 - left;
  const hx = w.x + Math.cos(w.heading) * 13;
  const hy = w.y + Math.sin(w.heading) * 13;
  const drift = age * 6;
  const wx = game.windHere.wx || 0;
  const wy = game.windHere.wy || 0;
  const ws = Math.hypot(wx, wy) || 1;
  for (let i = 0; i < 7; i++) {
    const r = 2 + age * (6 + i * 1.6);
    const off = drift * (0.4 + i * 0.25);
    ctx.fillStyle = `rgba(240, 248, 250, ${clamp(left / 1.4, 0, 1) * (0.55 - i * 0.06)})`;
    ctx.beginPath();
    ctx.arc(hx + (wx / ws) * off + Math.sin(i * 2.3) * age * 3, hy + (wy / ws) * off + Math.cos(i * 1.7) * age * 3, r, 0, TAU);
    ctx.fill();
  }
}

// --- Birds and fish ------------------------------------------------------------------

function gullWings(ctx, flap) {
  const lift = Math.sin(flap);
  const span = 4.6 * (0.75 + 0.25 * Math.cos(flap));
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.8, 0);
    ctx.quadraticCurveTo(0.9, s * span * 0.5, -0.4 - lift * 0.4, s * span);
    ctx.quadraticCurveTo(-0.6, s * span * 0.5, -1, 0);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGull(ctx, x, y, heading, flap, height) {
  ctx.save();
  ctx.translate(x + height * 0.5, y + height * 0.7);
  ctx.rotate(heading);
  ctx.fillStyle = 'rgba(4, 22, 30, 0.18)';
  gullWings(ctx, flap);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = '#d9e1e5';
  gullWings(ctx, flap);
  // Black wingtips.
  ctx.fillStyle = '#2a3238';
  const span = 4.6 * (0.75 + 0.25 * Math.cos(flap));
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-0.4 - Math.sin(flap) * 0.4, s * span * 0.95, 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.1, 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2b632';
  ctx.beginPath();
  ctx.moveTo(2.9, 0);
  ctx.lineTo(1.9, -0.3);
  ctx.lineTo(1.9, 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPerchedGull(ctx, g, boat, time) {
  ctx.save();
  ctx.translate(g.x, g.y);
  // Faces into the wind like gulls do; here, roughly toward the bow with a fidget.
  ctx.rotate(boat.heading + Math.sin(time * 0.7) * 0.5);
  ctx.fillStyle = 'rgba(4, 22, 30, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0.4, 0.5, 1.9, 1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c9d2d7';
  ctx.beginPath();
  ctx.ellipse(-0.3, 0, 1.9, 1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a3238';
  ctx.beginPath();
  ctx.ellipse(-1.8, 0, 0.6, 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(1.1, 0, 0.75, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2b632';
  ctx.beginPath();
  ctx.moveTo(2.4, 0);
  ctx.lineTo(1.6, -0.25);
  ctx.lineTo(1.6, 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlyingFish(ctx, f) {
  const t = (f.t - f.delay) / f.dur;
  if (t < -0.2 || t > 1.4) return;
  const d = clamp(t, 0, 1) * f.speed * f.dur;
  const x = f.x + Math.cos(f.a) * d;
  const y = f.y + Math.sin(f.a) * d;
  if (t < 0 || t > 1) {
    // Rings where it took off and where it splashed down.
    const age = t < 0 ? -t / 0.2 : (t - 1) / 0.4;
    ctx.strokeStyle = `rgba(232, 244, 242, ${0.5 * (1 - age)})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 1 + age * 4, 0, TAU);
    ctx.stroke();
    return;
  }
  const h = Math.sin(t * Math.PI);
  ctx.save();
  ctx.translate(x + h * 2, y + h * 3);
  ctx.rotate(f.a);
  ctx.fillStyle = 'rgba(4, 22, 30, 0.2)';
  ctx.fillRect(-1.2, -0.3, 2.4, 0.6);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.a);
  ctx.scale(1 + 0.3 * h, 1 + 0.3 * h);
  ctx.fillStyle = 'rgba(160, 220, 245, 0.55)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.6, 0);
    ctx.lineTo(-0.6, s * 2.2);
    ctx.lineTo(-1, s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#d6e6ee';
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.5, 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
