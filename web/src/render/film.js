// The prologue's camera and the marks it draws over the sea: the oar, the
// wind, the no-go wedge, the fast reach, and on the chart the way home with
// what lies on it. Captions, the letterbox and the title card are DOM (see
// ui/screens.js).

import { approach, clamp, smoothstep } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';
import { toKnots } from '../physics/sailing.js';
import { CALLOUTS, ROUTE, oarlock } from '../world/prologue.js';
import { baseScale } from './camera.js';
import { homeIsle } from './terrain.js';
import { VISUAL } from './boat.js';
import { C, font } from './palette.js';
import { t } from '../i18n/index.js';

const WIDE = ['chart', 'dangers', 'title'];
// Shots that open with a cut rather than the camera gliding over.
const CUTS = ['dawn'];
// The skipper, sat in the cockpit.
export const SKIPPER = [{ shirt: '#2f6fb3', skin: '#e8b48c' }];

// Where the camera wants to be for this moment of the film.
function aim(film, w, h) {
  const { game, oar, shot, shotTime } = film;
  const b = game.boat;
  const base = baseScale(w, h);
  if (WIDE.includes(shot.id)) {
    const L = game.level;
    const fit = Math.min(w / (L.width + 100), h / (L.height + 80));
    return { x: L.width / 2, y: L.height / 2, zoom: fit / base, rate: 1.1 };
  }
  switch (shot.id) {
    case 'home': {
      // Close on the isle, easing in.
      const isle = homeIsle(game.level.finish);
      return { x: isle.x - 10, y: isle.y + 4, zoom: 1.45 + 0.3 * clamp(shotTime / 5.5, 0, 1), rate: 0.8 };
    }
    case 'dawn':
      return { x: b.x + 14, y: b.y - 4, zoom: 1.5 - 0.15 * clamp(shotTime / 4.5, 0, 1), rate: 0.8 };
    case 'oar':
      return { x: b.x + 4, y: b.y, zoom: 1.75, rate: 0.8 };
    case 'squall':
      return { x: b.x + b.vx * 0.6, y: b.y + b.vy * 0.6, zoom: 1.15, rate: 1.6 };
    case 'lost':
      // Hold the boat and the oar in frame as they part.
      return { x: (b.x + oar.x) / 2, y: (b.y + oar.y) / 2, zoom: 1.25, rate: 1.4 };
    case 'irons':
      return { x: b.x, y: b.y, zoom: 1.35, rate: 1.2 };
    case 'reach':
      return { x: b.x + b.vx * 1.2, y: b.y + b.vy * 1.2, zoom: 1.1, rate: 1.2 };
    default:
      return { x: b.x, y: b.y, zoom: 1.05, rate: 1.2 };
  }
}

export function snapFilmCamera(cam, film, w, h) {
  const a = aim(film, w, h);
  cam.shot = film.shot.id;
  cam.w = w;
  cam.h = h;
  cam.x = a.x;
  cam.y = a.y;
  cam.scale = baseScale(w, h) * a.zoom;
}

export function updateFilmCamera(cam, film, dt, w, h) {
  if (cam.shot !== film.shot.id) {
    cam.shot = film.shot.id;
    if (CUTS.includes(cam.shot)) return snapFilmCamera(cam, film, w, h);
  }
  const a = aim(film, w, h);
  cam.w = w;
  cam.h = h;
  cam.x = approach(cam.x, a.x, a.rate, dt);
  cam.y = approach(cam.y, a.y, a.rate, dt);
  cam.scale = approach(cam.scale, baseScale(w, h) * a.zoom, a.rate, dt);
  // The squall shakes the frame (not with reduced motion).
  const squall = film.shot.id === 'squall' || (film.shot.id === 'lost' && film.shotTime < 1.5);
  cam.shake = squall ? Math.max(cam.shake, 0.32) : Math.max(0, cam.shake - dt * 2.2);
  const s = cam.still ? 0 : cam.shake * cam.shake * 7;
  cam.ox = (Math.random() * 2 - 1) * s;
  cam.oy = (Math.random() * 2 - 1) * s;
}

// Text that stays the same size on screen whatever the zoom.
function label(ctx, cam, text, x, y, { size = 15, color = C.foam, pill = null, weight = 800 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / cam.scale, 1 / cam.scale);
  ctx.font = font(size, weight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (pill) {
    const tw = ctx.measureText(text).width + size * 1.1;
    const th = size * 1.7;
    ctx.fillStyle = pill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
    else ctx.rect(-tw / 2, -th / 2, tw, th);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function drawOar(ctx, film, time) {
  const { oar, game } = film;
  const b = game.boat;
  let x;
  let y;
  let angle;
  let lift = 0;
  if (oar.state === 'held') {
    const lock = oarlock(b, VISUAL);
    x = lock.x;
    y = lock.y;
    // Swept fore and aft from the oarlock, out over the port side.
    angle = b.heading - Math.PI / 2 - oar.sweep * 0.5;
  } else {
    x = oar.x;
    y = oar.y;
    angle = oar.angle;
    lift = oar.z;
  }
  const inboard = oar.state === 'held' ? 4 : 7.5;
  const outboard = oar.state === 'held' ? 12 : 7.5;
  ctx.save();
  // Shadow on the water while it flies.
  if (lift > 0.5) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0, 10, 18, 0.3)';
    ctx.fillRect(-inboard, -0.9, inboard + outboard, 1.8);
    ctx.restore();
  }
  ctx.translate(x, y - lift * 0.8);
  ctx.rotate(angle);
  const grow = 1 + lift * 0.03;
  ctx.scale(grow, grow);
  // Ripples where the blade bites, or around it adrift.
  const dipped = oar.state === 'held' ? oar.dip : oar.state === 'adrift' ? 1 : 0;
  if (dipped) {
    const p = (time * (oar.state === 'held' ? 1.25 : 0.6)) % 1;
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.55 * (1 - p)).toFixed(3)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(outboard - 2.5, 0, 3 + p * 6, 2 + p * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9a777';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-inboard, 0);
  ctx.lineTo(outboard - 4, 0);
  ctx.stroke();
  ctx.fillStyle = dipped && oar.state === 'held' ? '#8a6640' : '#b18a5a';
  ctx.beginPath();
  ctx.ellipse(outboard - 2, 0, 3, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Bold arrows streaming down the wind past the boat.
function drawWindArrows(ctx, cam, film, fade) {
  const { boat, wind } = film.game;
  const dx = Math.cos(wind.angle);
  const dy = Math.sin(wind.angle);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = -1; i <= 1; i++) {
    const p = ((film.t * 0.45 + i * 0.33) % 1 + 1) % 1;
    const along = -60 + p * 120;
    const across = i * 34;
    const x = boat.x + dx * along - dy * across;
    const y = boat.y + dy * along + dx * across;
    const a = fade * Math.sin(p * Math.PI) * 0.75;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wind.angle);
    ctx.strokeStyle = `rgba(232, 244, 242, ${a.toFixed(3)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(1, -6);
    ctx.lineTo(8, 0);
    ctx.lineTo(1, 6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  label(ctx, cam, t('WIND'), boat.x - dx * 48 - dy * 20, boat.y - dy * 48 + dx * 20, { size: 15, pill: `rgba(4, 22, 34, ${(0.6 * fade).toFixed(3)})`, color: `rgba(232, 244, 242, ${fade.toFixed(3)})` });
}

function wedge(ctx, x, y, r, mid, half, fill, edge) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, mid - half, mid + half);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawNoGo(ctx, cam, film, fade) {
  const { boat, wind } = film.game;
  const up = wind.angle + Math.PI;
  const r = 52;
  ctx.save();
  ctx.globalAlpha = fade;
  wedge(ctx, boat.x, boat.y, r, up, Math.PI / 4, 'rgba(255, 77, 77, 0.2)', 'rgba(255, 77, 77, 0.65)');
  ctx.restore();
  label(ctx, cam, t('NO-GO'), boat.x + Math.cos(up) * r * 0.72, boat.y + Math.sin(up) * r * 0.72, { size: 14, pill: `rgba(120, 18, 18, ${(0.75 * fade).toFixed(3)})`, color: `rgba(255, 236, 236, ${fade.toFixed(3)})` });
  if (boat.luffing) {
    const flap = Math.sin(film.t * 12) > 0 ? t('flap') : t('flap!');
    label(ctx, cam, flap, boat.x - Math.cos(up) * 26, boat.y - Math.sin(up) * 26, { size: 13, color: `rgba(255, 200, 87, ${fade.toFixed(3)})`, weight: 700 });
  }
}

function drawReach(ctx, cam, film, fade) {
  const { boat, wind } = film.game;
  const up = wind.angle + Math.PI;
  const r = 52;
  ctx.save();
  ctx.globalAlpha = fade;
  for (const side of [-1, 1]) wedge(ctx, boat.x, boat.y, r, up + side * Math.PI / 2, 22 * (Math.PI / 180), 'rgba(61, 220, 151, 0.18)', 'rgba(61, 220, 151, 0.6)');
  ctx.restore();
  const h = boat.heading;
  label(ctx, cam, t('FASTEST'), boat.x + Math.cos(h) * r * 0.8, boat.y + Math.sin(h) * r * 0.8, { size: 14, pill: `rgba(8, 70, 46, ${(0.75 * fade).toFixed(3)})`, color: `rgba(230, 255, 242, ${fade.toFixed(3)})` });
  const kn = Math.round(toKnots(boatSpeed(boat)));
  label(ctx, cam, t('{n} kn', { n: kn }), boat.x - Math.cos(h) * 30, boat.y - Math.sin(h) * 30 + 12, { size: 18, color: `rgba(232, 244, 242, ${fade.toFixed(3)})` });
}

// The way home, drawn out from the boat a stretch at a time.
function drawRoute(ctx, cam, film, from) {
  const pts = [[from.x, from.y], ...ROUTE];
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(d);
    total += d;
  }
  let left = total * smoothstep(0, 3.2, film.t - from.at);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 87, 0.9)';
  ctx.lineWidth = 2.4 / cam.scale;
  ctx.setLineDash([9 / cam.scale, 7 / cam.scale]);
  ctx.lineDashOffset = (-film.t * 22) / cam.scale;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const k = Math.min(1, left / lens[i - 1]);
    ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k);
    left -= lens[i - 1];
  }
  ctx.stroke();
  ctx.restore();
  const home = film.game.level.finish;
  const arrive = smoothstep(2.6, 3.4, film.t - from.at);
  if (arrive > 0) {
    const p = (film.t * 0.8) % 1;
    ctx.save();
    ctx.globalAlpha *= arrive;
    ctx.strokeStyle = `rgba(255, 106, 33, ${(0.9 * (1 - p)).toFixed(3)})`;
    ctx.lineWidth = 3 / cam.scale;
    ctx.beginPath();
    ctx.arc(home.x, home.y, home.r + p * 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    label(ctx, cam, 'HOME', home.x, home.y - home.r - 26 / cam.scale, { size: 16, pill: `rgba(140, 50, 10, ${(0.85 * arrive).toFixed(3)})`, color: `rgba(255, 240, 230, ${arrive.toFixed(3)})` });
  }
}

// Something in the fog: a grey bank, a shape, a question.
function drawFog(ctx, cam, x, y, k, time) {
  ctx.save();
  ctx.globalAlpha *= k;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + time * 0.08;
    const gx = x + Math.cos(a) * 46;
    const gy = y + Math.sin(a) * 30;
    const g = ctx.createRadialGradient(gx, gy, 6, gx, gy, 90);
    g.addColorStop(0, 'rgba(196, 210, 214, 0.55)');
    g.addColorStop(1, 'rgba(196, 210, 214, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  // A long shadow turning under the surface.
  ctx.fillStyle = 'rgba(10, 20, 30, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + Math.sin(time * 0.6) * 10, y + 12, 70, 22, 0.3 + Math.sin(time * 0.4) * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // And a tentacle tip, curling.
  ctx.strokeStyle = 'rgba(70, 40, 70, 0.75)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const curl = Math.sin(time * 1.4) * 0.6;
  ctx.beginPath();
  ctx.moveTo(x + 30, y + 30);
  ctx.quadraticCurveTo(x + 52, y - 4, x + 40 + curl * 12, y - 26);
  ctx.quadraticCurveTo(x + 30, y - 40, x + 22 - curl * 6, y - 30);
  ctx.stroke();
  ctx.restore();
}

function drawCallouts(ctx, cam, film, time) {
  for (const c of CALLOUTS) {
    const k = smoothstep(c.at, c.at + 0.5, film.t);
    if (k <= 0) continue;
    if (c.fog) {
      drawFog(ctx, cam, c.x, c.y, k, time);
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      label(ctx, cam, '?', c.x, c.y - 4, { size: 34 * pulse, color: `rgba(255, 255, 255, ${k.toFixed(3)})` });
      continue;
    }
    const p = (time * 0.7 + c.x * 0.001) % 1;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.strokeStyle = `rgba(255, 200, 87, ${(0.8 * (1 - p)).toFixed(3)})`;
    ctx.lineWidth = 2 / cam.scale;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40 + p * 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const pop = 0.6 + 0.4 * smoothstep(c.at, c.at + 0.3, film.t);
    label(ctx, cam, t(c.text).toUpperCase(), c.x, c.y - 56 / cam.scale - 10, { size: 15 * pop, pill: `rgba(4, 22, 34, ${(0.8 * k).toFixed(3)})`, color: `rgba(255, 200, 87, ${k.toFixed(3)})` });
  }
}

// World-space marks, drawn under the camera after the boat.
export function drawFilmWorld(ctx, cam, film, time) {
  if (film.oar.state !== 'adrift' || film.shot.id === 'lost' || film.shot.id === 'wind') drawOar(ctx, film, time);
  const { id } = film.shot;
  const st = film.shotTime;
  const fadeIn = (d = 0.6) => smoothstep(0, d, st);
  if (id === 'wind') drawWindArrows(ctx, cam, film, fadeIn(1) * (1 - smoothstep(4.5, 5.5, st)));
  if (id === 'irons') drawNoGo(ctx, cam, film, fadeIn(1.2));
  if (id === 'reach') drawReach(ctx, cam, film, fadeIn(1.4) * (1 - smoothstep(5.8, 6.5, st)));
  if (film.route) {
    // The chart fades back behind the title card.
    ctx.save();
    if (id === 'title') ctx.globalAlpha = 1 - 0.85 * smoothstep(0, 1.2, st);
    drawRoute(ctx, cam, film, film.route);
    drawCallouts(ctx, cam, film, time);
    ctx.restore();
  }
}

// Screen-space light: a warm dawn that the squall washes out.
export function drawFilmLight(ctx, film, w, h) {
  const dawn = 1 - smoothstep(12.5, 15.5, film.t);
  if (dawn > 0) {
    // The sun just up in the east, below the letterbox.
    const sx = w * 0.82;
    const sy = h * 0.14;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.8);
    g.addColorStop(0, `rgba(255, 196, 128, ${(0.5 * dawn).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(255, 150, 100, ${(0.22 * dawn).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255, 130, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // A soft vignette, like an old film.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 6, 12, 0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
