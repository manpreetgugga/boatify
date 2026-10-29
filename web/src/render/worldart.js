// The far worlds' art: Volcano Isles (lava cones, basalt columns, pumice
// rafts, steam vents), Harbor City (container quays with cranes and crowds,
// pilings, loose containers, ferries, a crane that drops boxes) and Planet
// Zeta (crystal isles, fungus forests with eyes, spore pods, giant jellies
// and the beasts below). Each draw function returns true when it drew the
// thing, so the home renderer only draws what it knows.
// Everything here is in world units with the camera applied.

import { pointInPolygon, clamp } from '../core/math.js';
import { TAU, hash, axisOf, store, raised, dangerRing, drawPerson, SHIRTS } from './artkit.js';
import { drawWildShallows, drawWildIsland, drawWildRock, drawWildFloe, drawWildLair, wildLights } from './wildart.js';

const CONTAINER_COLORS = ['#d6452f', '#2f7fb8', '#e8b21e', '#3a9a5b', '#e07a2f', '#7a4fd6', '#c9ccd0', '#1f6f78'];

// --- Shallows ----------------------------------------------------------------

export function drawWorldShallows(ctx, isl, path, time) {
  switch (isl.kind) {
    case 'cone':
    case 'basalt': {
      // Warm water steams around the black rock.
      ctx.strokeStyle = 'rgba(120, 110, 100, 0.16)';
      ctx.lineWidth = 40;
      ctx.stroke(path);
      const lap = 0.5 + 0.5 * Math.sin(time * 1.2 + isl.seed);
      ctx.strokeStyle = `rgba(220, 220, 214, ${(0.1 + 0.1 * lap).toFixed(3)})`;
      ctx.lineWidth = 10 + lap * 4;
      ctx.stroke(path);
      return true;
    }
    case 'quay':
      // Dredged deep right up to the wall: just a dark line of shadow.
      ctx.strokeStyle = 'rgba(4, 16, 22, 0.35)';
      ctx.lineWidth = 14;
      ctx.stroke(path);
      return true;
    case 'crystal':
    case 'spore': {
      const glow = 0.5 + 0.5 * Math.sin(time * 0.9 + isl.seed);
      const rgb = isl.kind === 'crystal' ? '170, 130, 255' : '110, 240, 200';
      ctx.strokeStyle = `rgba(${rgb}, ${(0.1 + 0.08 * glow).toFixed(3)})`;
      ctx.lineWidth = 48;
      ctx.stroke(path);
      ctx.strokeStyle = `rgba(${rgb}, ${(0.18 + 0.1 * glow).toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.stroke(path);
      return true;
    }
    default:
      return drawWildShallows(ctx, isl, path, time);
  }
}

// --- Islands -----------------------------------------------------------------

export function drawWorldIsland(ctx, isl, path, decor, time, game) {
  switch (isl.kind) {
    case 'cone':
      drawCone(ctx, isl, path, time, game);
      return true;
    case 'basalt':
      drawBasalt(ctx, isl, path, time);
      return true;
    case 'quay':
      drawQuay(ctx, isl, path, time, game);
      return true;
    case 'crystal':
      drawCrystalIsle(ctx, isl, path, decor, time);
      return true;
    case 'spore':
      drawSporeIsle(ctx, isl, path, decor, time, game);
      return true;
    default:
      return drawWildIsland(ctx, isl, path, decor, time);
  }
}


// A volcano: dark slopes, glowing rivulets, a crater of lava, and smoke that
// leans with the wind.
function drawCone(ctx, isl, path, time, game) {
  const { cx, cy } = isl;
  const R = isl.radius;
  ctx.save();
  raised(ctx, path, '#1c1514', '#2e2421');
  const g = ctx.createRadialGradient(cx - R * 0.05, cy - R * 0.08, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#7a5240');
  g.addColorStop(0.3, '#55392f');
  g.addColorStop(0.75, '#33261f');
  g.addColorStop(1, 'rgba(30, 22, 20, 0)');
  ctx.fillStyle = g;
  ctx.fill(path);
  // Ridges down the slopes.
  ctx.strokeStyle = 'rgba(12, 8, 8, 0.35)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + isl.seed;
    const bend = (hash(isl.seed + i) - 0.5) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.26, cy + Math.sin(a) * R * 0.26);
    ctx.quadraticCurveTo(cx + Math.cos(a + bend) * R * 0.6, cy + Math.sin(a + bend) * R * 0.6, cx + Math.cos(a + bend * 2) * R * 1.05, cy + Math.sin(a + bend * 2) * R * 1.05);
    ctx.stroke();
  }
  // Lava running down.
  const glow = 0.65 + 0.35 * Math.sin(time * 2.2 + isl.seed);
  for (let i = 0; i < 3; i++) {
    const a = isl.seed * 1.7 + i * 2.2;
    const w = (hash(isl.seed * 3 + i) - 0.5) * 0.5;
    const path2 = new Path2D();
    path2.moveTo(cx + Math.cos(a) * R * 0.18, cy + Math.sin(a) * R * 0.18);
    path2.bezierCurveTo(
      cx + Math.cos(a + w) * R * 0.4,
      cy + Math.sin(a + w) * R * 0.4,
      cx + Math.cos(a - w) * R * 0.6,
      cy + Math.sin(a - w) * R * 0.6,
      cx + Math.cos(a + w * 0.5) * R * 0.86,
      cy + Math.sin(a + w * 0.5) * R * 0.86,
    );
    ctx.strokeStyle = `rgba(255, 90, 30, ${(0.5 * glow).toFixed(3)})`;
    ctx.lineWidth = 7;
    ctx.stroke(path2);
    ctx.strokeStyle = `rgba(255, 196, 90, ${(0.8 * glow).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.stroke(path2);
  }
  // The crater.
  const cr = Math.max(14, R * 0.2);
  ctx.fillStyle = '#140e0d';
  ctx.beginPath();
  ctx.arc(cx, cy, cr * 1.3, 0, TAU);
  ctx.fill();
  const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
  lg.addColorStop(0, '#fff0a0');
  lg.addColorStop(0.45, '#ffad3a');
  lg.addColorStop(1, '#d8361a');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(cx, cy, cr * (0.92 + 0.05 * Math.sin(time * 3 + isl.seed)), 0, TAU);
  ctx.fill();
  // Crust drifting on the lava.
  ctx.fillStyle = 'rgba(60, 20, 10, 0.55)';
  for (let i = 0; i < 4; i++) {
    const a = time * 0.3 + i * 1.6 + isl.seed;
    const d = cr * (0.25 + 0.4 * hash(isl.seed + i * 7));
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr * 0.22, cr * 0.13, a, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Smoke drifts downwind, past the shore.
  const wa = game.wind.angle;
  const dx = Math.cos(wa);
  const dy = Math.sin(wa);
  for (let i = 0; i < 7; i++) {
    const t = (time * 0.12 + i / 7 + hash(isl.seed) * 0.5) % 1;
    const wob = Math.sin(time * 0.7 + i * 2) * cr * 0.6 * t;
    const x = cx + dx * t * R * 2.2 - dy * wob;
    const y = cy + dy * t * R * 2.2 + dx * wob;
    ctx.fillStyle = `rgba(78, 72, 70, ${(0.38 * (1 - t) * Math.min(1, t * 6)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, cr * (0.7 + 2 * t), 0, TAU);
    ctx.fill();
  }
}

// Basalt: black rock that cooled into six-sided columns.
function drawBasalt(ctx, isl, path, time) {
  const c = store(isl);
  if (!c.hexes) {
    const b = isl.bounds;
    const s = 9;
    const hexes = new Path2D();
    const tops = new Path2D();
    const w = s * Math.sqrt(3);
    let row = 0;
    for (let y = b.minY - s; y < b.maxY + s; y += s * 1.5, row++) {
      for (let x = b.minX - w + (row % 2 ? w / 2 : 0); x < b.maxX + w; x += w) {
        if (!pointInPolygon(x, y, isl.pts)) continue;
        const target = hash(x * 0.37 + y * 1.13) < 0.3 ? tops : hexes;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + Math.PI / 6;
          const px = x + Math.cos(a) * s * 0.92;
          const py = y + Math.sin(a) * s * 0.92;
          if (k) target.lineTo(px, py);
          else target.moveTo(px, py);
        }
        target.closePath();
      }
    }
    c.hexes = hexes;
    c.tops = tops;
  }
  ctx.save();
  raised(ctx, path, '#17161a', '#2c2b31');
  ctx.fillStyle = '#3a3940';
  ctx.fill(c.tops);
  ctx.strokeStyle = 'rgba(10, 10, 12, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke(c.hexes);
  ctx.stroke(c.tops);
  ctx.strokeStyle = 'rgba(140, 136, 150, 0.35)';
  ctx.lineWidth = 5;
  ctx.stroke(path);
  // A thread of steam from a warm crack now and then.
  const t = (time * 0.2 + hash(isl.seed)) % 1;
  ctx.fillStyle = `rgba(220, 220, 220, ${(0.18 * (1 - t)).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(isl.cx + t * 18, isl.cy - t * 26, 6 + t * 14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// A quay: a concrete apron stacked with containers, a gantry crane rolling
// along its rails, bollards and tyres on the edge, and dock workers who wave
// when you sail close.
function drawQuay(ctx, isl, path, time, game) {
  const { a, hl, hw } = axisOf(isl);
  ctx.save();
  raised(ctx, path, '#5a6166', '#9aa2a6', 0.7);
  ctx.translate(isl.cx, isl.cy);
  ctx.rotate(a);
  // Weathered slabs.
  ctx.strokeStyle = 'rgba(70, 76, 80, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -hl + 30; x < hl; x += 30) {
    ctx.moveTo(x, -hw);
    ctx.lineTo(x, hw);
  }
  ctx.stroke();
  // Safety line.
  ctx.strokeStyle = 'rgba(240, 200, 60, 0.6)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(-hl + 7, -hw + 7, hl * 2 - 14, hw * 2 - 14);
  ctx.setLineDash([]);
  // Containers in rows along the quay.
  const cl = 22;
  const cw = 9;
  const rows = Math.max(0, Math.floor((hw * 2 - 30) / (cw + 2)));
  const y0 = -((rows - 1) * (cw + 2)) / 2;
  for (let r = 0; r < rows; r++) {
    for (let x = -hl + 16; x + cl < hl - 14; x += cl + 3) {
      const h = hash(isl.seed * 13 + r * 31 + x * 0.7);
      if (h < 0.22) continue;
      const color = CONTAINER_COLORS[Math.floor(h * 997) % CONTAINER_COLORS.length];
      const stack = h > 0.7 ? 2 : 1;
      const y = y0 + r * (cw + 2) - cw / 2;
      ctx.fillStyle = 'rgba(20, 24, 28, 0.35)';
      ctx.fillRect(x + 1.5 * stack, y + 2 * stack, cl, cw);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cl, cw);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let k = 3; k < cl; k += 3) ctx.fillRect(x + k, y, 0.8, cw);
      if (stack > 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(x, y, cl, 1.6);
      }
    }
  }
  // Bollards and tyres.
  for (let x = -hl + 18; x < hl - 10; x += 34) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#2b2f33';
      ctx.beginPath();
      ctx.arc(x, side * (hw - 4), 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#16181a';
      ctx.beginPath();
      ctx.ellipse(x + 15, side * (hw + 0.5), 4.5, 2, 0, 0, TAU);
      ctx.fill();
    }
  }
  // A gantry crane rolling slowly along.
  if (hl > 70 && hw > 22) {
    const x = Math.sin(time * 0.15 + isl.seed) * (hl - 30);
    ctx.fillStyle = 'rgba(20, 24, 28, 0.3)';
    ctx.fillRect(x - 9, -hw + 2, 22, hw * 2 - 4);
    ctx.strokeStyle = '#e8a21e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 12, -hw - 4, 20, hw * 2 + 8);
    ctx.beginPath();
    ctx.moveTo(x - 12, -hw - 4);
    ctx.lineTo(x + 8, hw + 4);
    ctx.moveTo(x + 8, -hw - 4);
    ctx.lineTo(x - 12, hw + 4);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const trolley = Math.sin(time * 0.4 + isl.seed * 2) * (hw - 6);
    ctx.fillStyle = '#c7861a';
    ctx.fillRect(x - 8, trolley - 4, 12, 8);
    ctx.fillStyle = '#2c3a44';
    ctx.fillRect(x - 6, trolley - 2.5, 4, 5);
  }
  // Dock workers along the water's edge.
  const boat = game.boat;
  const bx = boat.x - isl.cx;
  const by = boat.y - isl.cy;
  const lx = bx * Math.cos(a) + by * Math.sin(a);
  const ly = -bx * Math.sin(a) + by * Math.cos(a);
  const n = Math.max(2, Math.round(hl / 45));
  for (let i = 0; i < n; i++) {
    const side = hash(isl.seed + i * 3.3) < 0.5 ? -1 : 1;
    const x = -hl + 20 + ((hl * 2 - 40) * (i + 0.5)) / n;
    const y = side * (hw - 10);
    const near = Math.hypot(lx - x, ly - y) < 230;
    drawPerson(ctx, x, y, side, SHIRTS[(isl.seed + i) % SHIRTS.length], near ? Math.sin(time * 9 + i) : null);
  }
  ctx.restore();
}


// Crystal isle: violet stone and clusters of glowing crystal.
function drawCrystalIsle(ctx, isl, path, decor, time) {
  ctx.save();
  raised(ctx, path, '#20173c', '#3f3170');
  ctx.strokeStyle = 'rgba(190, 150, 255, 0.45)';
  ctx.lineWidth = 6;
  ctx.stroke(path);
  for (const d of decor) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + d.x * 0.05 + d.y * 0.03);
    ctx.save();
    ctx.translate(d.x, d.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * d.s);
    g.addColorStop(0, `rgba(200, 160, 255, ${(0.3 + 0.2 * pulse).toFixed(3)})`);
    g.addColorStop(1, 'rgba(200, 160, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * d.s, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate(d.r + k * 2.1);
      drawShard(ctx, 12 * d.s * (1 - k * 0.18), 3.6 * d.s, pulse);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

// One crystal lying along +x from the origin.
function drawShard(ctx, len, w, pulse) {
  ctx.fillStyle = '#8b63e6';
  ctx.beginPath();
  ctx.moveTo(0, -w);
  ctx.lineTo(len * 0.75, -w);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.75, w);
  ctx.lineTo(0, w);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d6c2ff';
  ctx.beginPath();
  ctx.moveTo(0, -w);
  ctx.lineTo(len * 0.75, -w);
  ctx.lineTo(len, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255, 255, 255, ${(0.4 + 0.5 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(len * 0.8, -w * 0.3, Math.max(0.8, w * 0.35), 0, TAU);
  ctx.fill();
}

// Fungus forest: mossy ground, giant caps, and eyes on stalks that follow
// the boat (and blink).
function drawSporeIsle(ctx, isl, path, decor, time, game) {
  ctx.save();
  raised(ctx, path, '#163232', '#2a5650');
  ctx.strokeStyle = 'rgba(120, 230, 200, 0.4)';
  ctx.lineWidth = 6;
  ctx.stroke(path);
  ctx.fillStyle = 'rgba(160, 255, 210, 0.12)';
  for (let i = 0; i < 30; i++) {
    const x = isl.cx + (hash(isl.seed + i) - 0.5) * isl.radius * 1.6;
    const y = isl.cy + (hash(isl.seed * 2 + i) - 0.5) * isl.radius * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 3 + hash(i + isl.seed * 5) * 5, 0, TAU);
    ctx.fill();
  }
  const caps = ['#c45ab3', '#e07ac8', '#ff9f5a', '#8fd0ff'];
  decor.forEach((d, i) => {
    if (i % 3 === 2) {
      drawEye(ctx, d.x, d.y, 4.5 * d.s, game.boat, time, d.r);
      return;
    }
    const r = 9 * d.s;
    ctx.fillStyle = 'rgba(8, 20, 20, 0.35)';
    ctx.beginPath();
    ctx.arc(d.x + 2, d.y + 3, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = caps[i % caps.length];
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let k = 0; k < 4; k++) {
      const a = d.r + k * 1.7;
      ctx.beginPath();
      ctx.arc(d.x + Math.cos(a) * r * 0.5, d.y + Math.sin(a) * r * 0.5, r * 0.14, 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
}

function drawEye(ctx, x, y, r, boat, time, seed) {
  const look = Math.atan2(boat.y - y, boat.x - x);
  const blink = Math.sin(time * 0.8 + seed * 5) > 0.96;
  ctx.fillStyle = '#3d2a52';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.35, 0, TAU);
  ctx.fill();
  if (blink) {
    ctx.strokeStyle = '#f2e8ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#f6f2e0';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a0f24';
  ctx.beginPath();
  ctx.arc(x + Math.cos(look) * r * 0.45, y + Math.sin(look) * r * 0.45, r * 0.45, 0, TAU);
  ctx.fill();
}

// --- Rocks -------------------------------------------------------------------

export function drawWorldRock(ctx, r, time) {
  switch (r.material) {
    case 'basalt':
      drawHexRock(ctx, r);
      return true;
    case 'piling':
      drawPiling(ctx, r);
      return true;
    case 'container':
      drawLooseContainer(ctx, r, time);
      return true;
    case 'shard':
      drawShardRock(ctx, r, time);
      return true;
    case 'pod':
      drawPod(ctx, r, time);
      return true;
    default:
      return drawWildRock(ctx, r, time);
  }
}

function hexPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = rot + (k / 6) * TAU;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawHexRock(ctx, r) {
  const rot = hash(r.x + r.y) * TAU;
  ctx.fillStyle = '#141316';
  hexPath(ctx, r.x, r.y, r.r, rot);
  ctx.fill();
  ctx.fillStyle = '#3a3940';
  hexPath(ctx, r.x - r.r * 0.12, r.y - r.r * 0.16, r.r * 0.78, rot);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 146, 160, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPiling(ctx, r) {
  ctx.fillStyle = '#3e2c1b';
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a6a44';
  ctx.beginPath();
  ctx.arc(r.x - r.r * 0.1, r.y - r.r * 0.14, r.r * 0.82, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(62, 44, 27, 0.6)';
  ctx.lineWidth = 0.8;
  for (const k of [0.55, 0.3]) {
    ctx.beginPath();
    ctx.arc(r.x - r.r * 0.1, r.y - r.r * 0.14, r.r * k, 0, TAU);
    ctx.stroke();
  }
  // Weed at the waterline.
  ctx.strokeStyle = 'rgba(60, 120, 70, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r + 0.6, 0.4, 2.2);
  ctx.stroke();
}

function drawLooseContainer(ctx, r, time) {
  const h = hash(r.x * 0.31 + r.y * 0.77);
  const rot = h * Math.PI + Math.sin(time * 0.6 + r.x) * 0.04;
  const color = CONTAINER_COLORS[Math.floor(h * 991) % CONTAINER_COLORS.length];
  const l = r.r * 1.9;
  const w = r.r * 0.95;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(4, 16, 22, 0.35)';
  ctx.fillRect(-l / 2 + 1.5, -w / 2 + 2, l, w);
  ctx.fillStyle = color;
  ctx.fillRect(-l / 2, -w / 2, l, w);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let x = -l / 2 + 2.5; x < l / 2; x += 2.6) ctx.fillRect(x, -w / 2, 0.8, w);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-l / 2, -w / 2, l, w);
  ctx.restore();
}

function drawShardRock(ctx, r, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2 + r.x * 0.1);
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.fillStyle = `rgba(200, 160, 255, ${(0.18 + 0.12 * pulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 0, r.r * 1.5, 0, TAU);
  ctx.fill();
  const rot = hash(r.x + r.y * 3) * TAU;
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.rotate(rot + k * 2.1);
    drawShard(ctx, r.r * 1.15, r.r * 0.36, pulse);
    ctx.restore();
  }
  ctx.restore();
}

function drawPod(ctx, r, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.7 + r.y * 0.1);
  ctx.fillStyle = '#1f4a44';
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(r.x - r.r * 0.25, r.y - r.r * 0.3, 0, r.x, r.y, r.r);
  g.addColorStop(0, '#9ff5d6');
  g.addColorStop(1, '#2f7a6c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r.x - r.r * 0.08, r.y - r.r * 0.1, r.r * 0.86, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 230, 120, ${(0.4 + 0.5 * pulse).toFixed(3)})`;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + r.x;
    ctx.beginPath();
    ctx.arc(r.x + Math.cos(a) * r.r * 0.45, r.y + Math.sin(a) * r.r * 0.45, r.r * 0.15, 0, TAU);
    ctx.fill();
  }
}

// --- Drifters ------------------------------------------------------------------

// The body of a drifting thing, at its current offset (already translated).
export function drawWorldFloe(ctx, f, path, decor, time) {
  switch (f.look) {
    case 'pumice':
      drawPumice(ctx, f, path, decor);
      return true;
    case 'ferry':
      drawFerry(ctx, f, path, time);
      return true;
    case 'jelly':
      drawJelly(ctx, f, path, time);
      return true;
    default:
      return drawWildFloe(ctx, f, path, decor, time);
  }
}

function drawPumice(ctx, f, path, decor) {
  ctx.save();
  raised(ctx, path, '#6e6862', '#a9a299', 0.4);
  ctx.fillStyle = 'rgba(80, 74, 68, 0.6)';
  for (let i = 0; i < 26; i++) {
    const x = f.cx + (hash(f.seed + i) - 0.5) * f.radius * 1.5;
    const y = f.cy + (hash(f.seed * 3 + i) - 0.5) * f.radius * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 1 + hash(i * 7 + f.seed) * 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(210, 204, 194, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke(path);
  ctx.restore();
  for (const d of decor) {
    ctx.fillStyle = '#8e877e';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5 * d.s, 0, TAU);
    ctx.fill();
  }
}

// A harbor ferry, double-ended: red hull band, white deck, a bridge house in
// the middle with its funnel, lifeboats, and passengers at the rails.
function drawFerry(ctx, f, path, time) {
  const { a, hl, hw } = axisOf(f);
  ctx.save();
  ctx.fillStyle = '#b8282f';
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.fillStyle = '#eef0ec';
  ctx.beginPath();
  ctx.ellipse(0, 0, hl - 4, hw - 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c9ccc8';
  ctx.fillRect(-hl, -1, hl * 2, 2);
  // Bridge house with windows.
  const bl = hl * 0.62;
  const bw = hw * 0.62;
  ctx.fillStyle = 'rgba(20, 24, 28, 0.25)';
  ctx.fillRect(-bl + 2, -bw + 3, bl * 2, bw * 2);
  ctx.fillStyle = '#fbfbf7';
  ctx.fillRect(-bl, -bw, bl * 2, bw * 2);
  ctx.fillStyle = '#2c4a63';
  for (let x = -bl + 4; x < bl - 4; x += 7) {
    ctx.fillRect(x, -bw + 2, 4, 2.4);
    ctx.fillRect(x, bw - 4.4, 4, 2.4);
  }
  // Funnel.
  ctx.fillStyle = '#b8282f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.6, 2.6, 0, 0, TAU);
  ctx.fill();
  // Lifeboats.
  ctx.fillStyle = '#f28c28';
  for (const x of [-bl * 0.6, bl * 0.6]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x, side * (bw + 2.6), 5, 1.8, 0, 0, TAU);
      ctx.fill();
    }
  }
  // Passengers at the rails, waving.
  for (let i = 0; i < 6; i++) {
    const x = -hl * 0.75 + (hl * 1.5 * (i + 0.5)) / 6;
    if (Math.abs(x) < bl + 2) continue;
    const side = i % 2 ? 1 : -1;
    drawPerson(ctx, x, side * (hw * 0.55), side, SHIRTS[(f.seed + i) % SHIRTS.length], Math.sin(time * 7 + i));
  }
  ctx.restore();
  // Smoke from the funnel, trailing behind.
  const back = Math.atan2(-f.vy, -f.vx);
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.5 + i / 4) % 1;
    ctx.fillStyle = `rgba(60, 60, 64, ${(0.25 * (1 - t)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(f.cx + Math.cos(back) * t * 40, f.cy + Math.sin(back) * t * 40, 4 + t * 9, 0, TAU);
    ctx.fill();
  }
}

// A giant jelly: a pulsing translucent dome with trailing tentacles.
function drawJelly(ctx, f, path, time) {
  const R = f.radius;
  const pulse = Math.sin(time * 2.4 + f.seed);
  const back = Math.atan2(-f.vy, -f.vx);
  const trailing = Math.hypot(f.vx, f.vy) > 0.5 ? back : time * 0.3 + f.seed;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = trailing + (i - 4) * 0.22;
    ctx.strokeStyle = `rgba(255, 160, 220, ${(0.28 + 0.1 * Math.sin(time * 2 + i)).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(f.cx + Math.cos(a) * R * 0.6, f.cy + Math.sin(a) * R * 0.6);
    for (let k = 1; k <= 6; k++) {
      const d = R * (0.6 + k * 0.22);
      const w = Math.sin(time * 3 + i + k * 0.9) * 0.12;
      ctx.lineTo(f.cx + Math.cos(a + w) * d, f.cy + Math.sin(a + w) * d);
    }
    ctx.stroke();
  }
  ctx.translate(f.cx, f.cy);
  ctx.scale(1 + pulse * 0.04, 1 + pulse * 0.04);
  ctx.translate(-f.cx, -f.cy);
  const g = ctx.createRadialGradient(f.cx - R * 0.15, f.cy - R * 0.2, R * 0.1, f.cx, f.cy, R * 1.05);
  g.addColorStop(0, 'rgba(255, 220, 245, 0.85)');
  g.addColorStop(0.6, 'rgba(240, 130, 210, 0.55)');
  g.addColorStop(1, 'rgba(190, 80, 200, 0.4)');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.strokeStyle = 'rgba(255, 210, 245, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  // Four lobes inside, like a moon jelly.
  ctx.strokeStyle = 'rgba(255, 120, 200, 0.6)';
  ctx.lineWidth = 2.4;
  for (let k = 0; k < 4; k++) {
    const a = f.seed + k * (TAU / 4) + time * 0.2;
    ctx.beginPath();
    ctx.arc(f.cx + Math.cos(a) * R * 0.32, f.cy + Math.sin(a) * R * 0.32, R * 0.16, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Lairs -----------------------------------------------------------------------

// Already translated to the lair's centre.
export function drawLair(ctx, k, time) {
  switch (k.look) {
    case 'vent':
      drawVent(ctx, k, time);
      return true;
    case 'crane':
      drawCraneDrop(ctx, k, time);
      return true;
    case 'beast':
      drawBeast(ctx, k, time);
      return true;
    default:
      return drawWildLair(ctx, k, time);
  }
}


// A steam vent on the sea floor: it breathes, it glows, then it blows.
function drawVent(ctx, k, time) {
  const R = k.r;
  if (k.phase === 'idle') {
    ctx.fillStyle = 'rgba(255, 110, 40, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.25, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const t = (time * 0.35 + i / 4) % 1;
      ctx.fillStyle = `rgba(230, 230, 226, ${(0.22 * (1 - t)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(i * 1.9) * R * 0.2 * t, Math.sin(i * 1.9) * R * 0.2 * t - t * 20, 4 + t * 14, 0, TAU);
      ctx.fill();
    }
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(255, 140, 40, ${(0.45 * t).toFixed(3)})`);
    g.addColorStop(0.6, `rgba(200, 60, 20, ${(0.2 * t).toFixed(3)})`);
    g.addColorStop(1, 'rgba(200, 60, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    dangerRing(ctx, k, time, t);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 26) * R * 0.9;
      const pop = (time * 3 + i * 0.13) % 1;
      ctx.fillStyle = `rgba(255, 220, 180, ${((1 - pop) * t * 0.7).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5 + pop * 4, 0, TAU);
      ctx.fill();
    }
    return;
  }
  // The blow: a fountain of steam and glowing rock.
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(255, 230, 140, ${(0.8 * rise).toFixed(3)})`);
  g.addColorStop(0.3, `rgba(255, 120, 30, ${(0.55 * rise).toFixed(3)})`);
  g.addColorStop(1, 'rgba(120, 30, 10, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i * 0.37;
    const d = R * (0.2 + 0.9 * t) * (0.6 + 0.4 * hash(i));
    ctx.fillStyle = `rgba(255, ${150 + Math.round(80 * hash(i + 3))}, 60, ${(1 - t).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2.5 + 2 * hash(i + 9), 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + time * 0.3;
    ctx.fillStyle = `rgba(235, 232, 226, ${(0.4 * rise).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.35 * t, Math.sin(a) * R * 0.35 * t, R * (0.18 + 0.3 * t), 0, TAU);
    ctx.fill();
  }
}

// A crane swings a container over the water and drops it.
function drawCraneDrop(ctx, k, time) {
  const R = k.r;
  // The boom reaches in from the south-west edge of the ring.
  const sway = Math.sin(time * 0.5 + k.x) * 0.15;
  const ba = -2.3 + sway;
  const bx = Math.cos(ba) * R * 1.25;
  const by = Math.sin(ba) * R * 1.25;
  const drop = k.phase === 'strike' ? clamp(k.phaseTime / 1.6, 0, 1) : 0;
  const warn = k.phase === 'warning' ? clamp(k.phaseTime / 1.8, 0, 1) : 0;
  if (k.phase === 'warning') {
    ctx.fillStyle = `rgba(4, 14, 20, ${(0.35 * warn).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    dangerRing(ctx, k, time, warn);
  }
  if (k.phase === 'strike') {
    const splash = Math.sin(drop * Math.PI);
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.7 * (1 - drop)).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.3 + drop * 0.8), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(232, 244, 242, ${(0.5 * splash).toFixed(3)})`;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const d = R * (0.2 + 0.6 * drop);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 3 + 3 * splash, 0, TAU);
      ctx.fill();
    }
  }
  // Shadow of the box on the water, darker as it comes down.
  const size = 1 + (k.phase === 'warning' ? warn * 0.5 : k.phase === 'strike' ? 0.6 : 0);
  ctx.save();
  ctx.rotate(0.4 + sway);
  ctx.fillStyle = `rgba(4, 14, 20, ${(0.15 + 0.35 * warn + (k.phase === 'strike' ? 0.2 : 0)).toFixed(3)})`;
  ctx.fillRect(-14 * size, -6 * size, 28 * size, 12 * size);
  // The container itself, hanging above (it looks bigger, being nearer).
  const lift = k.phase === 'strike' ? 1 - drop : 1;
  const s = 1 + 0.5 * lift;
  const color = CONTAINER_COLORS[Math.floor(hash(k.x + k.y) * 991) % CONTAINER_COLORS.length];
  if (k.phase !== 'strike' || drop < 0.55) {
    ctx.translate(-6 * lift, -10 * lift);
    ctx.fillStyle = color;
    ctx.fillRect(-14 * s, -6 * s, 28 * s, 12 * s);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let x = -14 * s + 3; x < 14 * s; x += 3 * s) ctx.fillRect(x, -6 * s, 0.9 * s, 12 * s);
  }
  ctx.restore();
  // Boom and cable.
  ctx.strokeStyle = 'rgba(4, 14, 20, 0.3)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(bx + 6, by + 8);
  ctx.lineTo(6, 8);
  ctx.stroke();
  ctx.strokeStyle = '#e8a21e';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(bx - 6, by - 10);
  ctx.lineTo(-6, -10);
  ctx.stroke();
  ctx.strokeStyle = '#a8700f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = bx - 6 + (-6 - bx + 6) * t;
    const y = by - 10 + (-10 - by + 10) * t;
    ctx.moveTo(x - 3, y - 3);
    ctx.lineTo(x + 3, y + 3);
  }
  ctx.stroke();
}

// Something enormous under the violet sea: two eyes, then a mouth.
function drawBeast(ctx, k, time) {
  const R = k.r;
  const eyes = (open, glow) => {
    for (const side of [-1, 1]) {
      const x = side * R * 0.28;
      const y = -R * 0.1;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.18);
      g.addColorStop(0, `rgba(255, 240, 120, ${(0.9 * glow).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255, 200, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R * 0.18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 250, 200, ${(0.8 * glow).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, R * 0.07, R * 0.07 * open, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(20, 0, 30, ${(0.9 * glow).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, R * 0.018, R * 0.055 * open, 0, 0, TAU);
      ctx.fill();
    }
  };
  if (k.phase === 'idle') {
    ctx.fillStyle = 'rgba(14, 4, 30, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.7, R * 0.5, 0, 0, TAU);
    ctx.fill();
    const blink = Math.sin(time * 0.6 + k.x) > 0.93 ? 0.1 : 1;
    eyes(blink, 0.4 + 0.15 * Math.sin(time * 1.3));
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(20, 6, 40, ${(0.6 * t).toFixed(3)})`);
    g.addColorStop(0.8, `rgba(120, 240, 200, ${(0.18 * t).toFixed(3)})`);
    g.addColorStop(1, 'rgba(120, 240, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    dangerRing(ctx, k, time, t);
    eyes(1, 0.6 + 0.4 * t);
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  ctx.fillStyle = `rgba(20, 6, 40, ${(0.55 * rise).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.95, 0, TAU);
  ctx.fill();
  // Feelers.
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const reach = R * (0.4 + 0.65 * rise);
    const curl = Math.sin(time * 6 + i) * 0.5;
    ctx.strokeStyle = '#2f8f7c';
    ctx.lineWidth = 8 * (0.5 + rise * 0.5);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    ctx.quadraticCurveTo(Math.cos(a + curl * 0.5) * reach * 0.7, Math.sin(a + curl * 0.5) * reach * 0.7, Math.cos(a + curl) * reach, Math.sin(a + curl) * reach);
    ctx.stroke();
    ctx.strokeStyle = '#8ff0cc';
    ctx.lineWidth = 2.5 * (0.5 + rise * 0.5);
    ctx.stroke();
  }
  // The mouth, ringed with teeth.
  const mr = R * 0.38 * (0.4 + 0.6 * rise);
  ctx.fillStyle = '#1a0624';
  ctx.beginPath();
  ctx.arc(0, 0, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5b2a86';
  ctx.beginPath();
  ctx.arc(0, 0, mr * 0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2ead6';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.12) * mr, Math.sin(a - 0.12) * mr);
    ctx.lineTo(Math.cos(a) * mr * 0.7, Math.sin(a) * mr * 0.7);
    ctx.lineTo(Math.cos(a + 0.12) * mr, Math.sin(a + 0.12) * mr);
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.6 * rise).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.6 + t * 0.5), 0, TAU);
  ctx.stroke();
}

// --- Night lights -------------------------------------------------------------------

// Points of light a world's things give off at night or in fog: [x, y, r, strength].
export function worldLights(level, time) {
  const out = [];
  for (const isl of level.islands) {
    if (isl.kind === 'cone') out.push([isl.cx, isl.cy, Math.max(60, isl.radius * 0.7), 0.85]);
    else if (isl.kind === 'quay') {
      const { a, hl, hw } = axisOf(isl);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let x = -hl + 30; x < hl - 10; x += 70) {
        for (const side of [-1, 1]) out.push([isl.cx + x * ca - side * hw * sa, isl.cy + x * sa + side * hw * ca, 46, 0.7]);
      }
    } else if (isl.kind === 'crystal' || isl.kind === 'spore') {
      for (const d of isl.decor) out.push([d.x, d.y, isl.kind === 'crystal' ? 40 : 28, 0.45 + 0.15 * Math.sin(time * 1.6 + d.x * 0.05)]);
    }
  }
  for (const f of level.floes) {
    if (f.look === 'jelly') out.push([f.cx + f.ox, f.cy + f.oy, f.radius * 1.6, 0.7]);
    else if (f.look === 'ferry') out.push([f.cx + f.ox, f.cy + f.oy, f.radius * 1.2, 0.7]);
  }
  for (const k of level.krakens) {
    if (k.look === 'vent') out.push([k.x, k.y, k.r * (k.phase === 'idle' ? 0.4 : 1), k.phase === 'idle' ? 0.35 : 0.8]);
    else if (k.look === 'beast' && k.phase !== 'idle') out.push([k.x, k.y, k.r, 0.6]);
  }
  for (const r of level.rocks) if (r.material === 'shard' || r.material === 'pod') out.push([r.x, r.y, r.r * 3, 0.4]);
  return out.concat(wildLights(level, time));
}
