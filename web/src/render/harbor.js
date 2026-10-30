// Your harbor, seen from above: the island and whatever has been built on it
// (data/harbor.js). Drawn into a box on the title screen and the Harbor
// screen, on a plan 300 by 180 across, scaled to fit.

import { C } from './palette.js';
import { BOAT_TYPES } from '../physics/boat.js';
import { drawBoat, VISUAL } from './boat.js';

const PLAN_W = 300;
const PLAN_H = 180;

// The island: a blob on the left, its beach facing the docks on the right.
const ISLE = { x: 96, y: 92, rx: 82, ry: 66 };

function isle(ctx, k) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const wob = 1 + 0.06 * Math.sin(a * 3 + 0.6) + 0.04 * Math.sin(a * 5 + 2);
    ctx.lineTo(ISLE.x + Math.cos(a) * ISLE.rx * k * wob, ISLE.y + Math.sin(a) * ISLE.ry * k * wob);
  }
  ctx.closePath();
}

function sea(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, PLAN_H);
  g.addColorStop(0, '#0f4a5c');
  g.addColorStop(1, '#0a3442');
  ctx.fillStyle = g;
  ctx.fillRect(-PLAN_W, -PLAN_H, PLAN_W * 3, PLAN_H * 3);
  ctx.strokeStyle = 'rgba(190, 235, 240, 0.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const x = ((i * 67 + time * 6) % (PLAN_W + 40)) - 20;
    const y = (i * 41) % PLAN_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 7, y - 2.5, x + 14, y);
    ctx.stroke();
  }
}

function land(ctx, time) {
  isle(ctx, 1.07);
  ctx.strokeStyle = `rgba(232, 244, 242, ${0.55 + 0.15 * Math.sin(time * 1.3)})`;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = C.sand;
  ctx.fill();
  isle(ctx, 0.8);
  ctx.fillStyle = C.grass;
  ctx.fill();
  ctx.fillStyle = C.grassDark;
  for (const [x, y, r] of [[52, 112, 6], [70, 138, 4.5], [118, 140, 5], [40, 86, 4], [90, 46, 4.5]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // The path from the point down to the shore.
  ctx.strokeStyle = 'rgba(230, 207, 152, 0.75)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(42, 50);
  ctx.quadraticCurveTo(100, 70, 160, 112);
  ctx.stroke();
}

function shadowRect(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(20, 40, 10, 0.32)';
  ctx.fillRect(x + 2, y + 3, w, h);
}

// A house from above: two roof halves, a chimney, maybe a lit door.
function house(ctx, x, y, w, h, rot, roof, roofDark, time, smoke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  shadowRect(ctx, -w / 2, -h / 2, w, h);
  ctx.fillStyle = roof;
  ctx.fillRect(-w / 2, -h / 2, w, h / 2);
  ctx.fillStyle = roofDark;
  ctx.fillRect(-w / 2, 0, w, h / 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(w / 2 - 6, -h / 2 + 1.5, 3, 3);
  ctx.restore();
  if (!smoke) return;
  ctx.fillStyle = 'rgba(240, 240, 240, 0.45)';
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.5 + i / 3 + x * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(x + w / 2 - 4 + t * 10, y - h / 2 - t * 9, 1.2 + t * 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tower(ctx, lit, time) {
  const x = 40;
  const y = 48;
  ctx.fillStyle = C.rock;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ece0';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d64545';
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? '#fff3b0' : '#5a5650';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (!lit) return;
  const a = time * 1.1;
  const g = ctx.createRadialGradient(x, y, 3, x, y, 150);
  g.addColorStop(0, 'rgba(255, 243, 176, 0.45)');
  g.addColorStop(1, 'rgba(255, 243, 176, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, 150, a - 0.14, a + 0.14);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 16);
  glow.addColorStop(0, 'rgba(255, 236, 160, 0.55)');
  glow.addColorStop(1, 'rgba(255, 236, 160, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
}

function planks(ctx, x0, x1, y, w) {
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(x0, y - w / 2, x1 - x0, w);
  ctx.fillStyle = '#a77a4c';
  for (let x = x0; x < x1; x += 4.5) ctx.fillRect(x, y - w / 2, 3, w);
  ctx.fillStyle = '#5e3b25';
  for (const px of [x0 + 12, (x0 + x1) / 2, x1 - 2]) {
    ctx.beginPath();
    ctx.arc(px, y - w / 2 - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(px, y + w / 2 + 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function jetty(ctx) {
  planks(ctx, 156, 236, 120, 7);
}

function quay(ctx) {
  const y = 70;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(150, y - 3, 102, 14);
  ctx.fillStyle = C.rockLight;
  ctx.fillRect(148, y - 6, 102, 12);
  ctx.strokeStyle = C.rock;
  ctx.lineWidth = 0.8;
  for (let x = 148; x < 250; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(148, y);
  ctx.lineTo(250, y);
  ctx.stroke();
  ctx.fillStyle = C.rockDark;
  for (const x of [176, 206, 236]) {
    ctx.beginPath();
    ctx.arc(x, y + 6.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function breakwater(ctx, time) {
  // A rock arm out at sea, curving round the basin from the north-east.
  const cx = 190;
  const cy = 96;
  const r = 96;
  ctx.strokeStyle = `rgba(232, 244, 242, ${0.4 + 0.2 * Math.sin(time * 1.7)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, -1.05, 0.62);
  ctx.stroke();
  for (let i = 0; i <= 18; i++) {
    const a = -1.05 + (i / 18) * 1.67;
    const rr = 5.5 + ((i * 7) % 4);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    ctx.fillStyle = C.rockDark;
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 2, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 3 ? C.rock : C.rockLight;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function market(ctx) {
  const stripes = [['#d64545', '#f2ece0'], ['#2f7fbf', '#f2ece0'], ['#e8a23a', '#f2ece0']];
  stripes.forEach(([a, b], i) => {
    const x = 128 + i * 15;
    const y = 82 + i * 3;
    shadowRect(ctx, x, y, 12, 10);
    for (let s = 0; s < 4; s++) {
      ctx.fillStyle = s % 2 ? b : a;
      ctx.fillRect(x + s * 3, y, 3, 10);
    }
  });
}

function rowingBoat(ctx, x, y, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 1.4) * 0.05);
  ctx.fillStyle = 'rgba(0, 10, 18, 0.35)';
  ctx.beginPath();
  ctx.ellipse(1.5, 2, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c99a62';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6e4628';
  ctx.fillRect(-2, -2.6, 1.6, 5.2);
  ctx.fillRect(3, -2.6, 1.4, 5.2);
  // Oars shipped along the sides.
  ctx.strokeStyle = '#d8b07a';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-6, -3.4);
  ctx.lineTo(6, -3.8);
  ctx.moveTo(-6, 3.4);
  ctx.lineTo(6, 3.8);
  ctx.stroke();
  ctx.restore();
}

// A boat of the fleet, tied up with her sail slack, rocking gently.
function moored(ctx, typeId, x, y, heading, length, time, look) {
  const type = BOAT_TYPES[typeId];
  ctx.save();
  ctx.translate(x, y);
  const s = length / (type.length * VISUAL);
  ctx.scale(s, s);
  const boat = { type, x: 0, y: 0, vx: 0, vy: 0, heading: heading + Math.sin(time * 1.1 + x) * 0.03, heel: Math.sin(time * 1.3 + y) * 0.05, boom: 0.15, drive: 0, luffing: true, rudder: 0, boostTime: 0 };
  drawBoat(ctx, boat, time, look ? { look: { ...type.look, ...look } } : {});
  ctx.restore();
}

// The fishing smack's tanned sails.
const SMACK = { sail: '#b5532e', sailShade: '#8f3f22', marks: null };

// Draw the harbor with `built` (a list of piece ids) into a w by h box.
export function drawHarbor(ctx, built, w, h, time = 0) {
  const has = new Set(built);
  const s = Math.min(w / PLAN_W, h / PLAN_H);
  ctx.save();
  ctx.translate((w - PLAN_W * s) / 2, (h - PLAN_H * s) / 2);
  ctx.scale(s, s);
  sea(ctx, time);
  if (has.has('breakwater')) breakwater(ctx, time);
  if (has.has('quay')) quay(ctx);
  if (has.has('jetty')) jetty(ctx);
  land(ctx, time);
  // Boats in the basin, behind the jetty and quay heads.
  if (has.has('ship')) moored(ctx, 'galleon', 214, 40, 0, 46, time);
  if (has.has('junk')) moored(ctx, 'junk', 204, 92, Math.PI, 34, time);
  if (has.has('smack')) moored(ctx, 'sloop', 198, 140, 0, 28, time, SMACK);
  if (has.has('dinghy')) rowingBoat(ctx, 244, 128, time);
  if (has.has('market')) market(ctx);
  if (has.has('hut')) house(ctx, 140, 130, 16, 12, 0.2, '#8a6a4a', '#6e523a', time, false);
  if (has.has('cottages')) {
    house(ctx, 106, 66, 18, 13, -0.1, '#c0392b', '#962a1e', time, true);
    house(ctx, 80, 104, 18, 13, 0.15, '#2f7fbf', '#245f8f', time, false);
    house(ctx, 104, 124, 17, 12, -0.25, '#e8a23a', '#b97f2a', time, true);
  }
  if (has.has('inn')) {
    house(ctx, 128, 104, 26, 16, 0.05, '#7e3f8f', '#5f2f6c', time, true);
    ctx.fillStyle = '#ffd678';
    ctx.fillRect(114, 112, 4, 3);
  }
  if (has.has('keeper')) house(ctx, 64, 40, 15, 11, -0.4, '#f2ece0', '#cfc6b4', time, true);
  if (has.has('tower')) tower(ctx, has.has('lamp'), time);
  ctx.restore();
}
