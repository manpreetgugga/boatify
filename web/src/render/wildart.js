// More far worlds' art: Jungle Delta (rainforest isles, mangroves with
// herons, lily pads, snags, hippos and crocodiles), Dino Lagoon (fern isles
// where a long-neck grazes, cliffs with pterosaurs, fossil ribs, giant
// turtles and the plesiosaur), Sunken City (marble ruins, a drowned tower,
// broken columns and stone heads, galleys and the moray in the gate) and the
// Ghost Sea (graveyard isles, a beached wreck, sunken masts, ghost ships and
// the wraith). worldart.js hands these over when it doesn't know a thing;
// each returns true when it drew it.
// Everything here is in world units with the camera applied.

import { pointInPolygon, clamp } from '../core/math.js';
import { TAU, hash, axisOf, store, raised, dangerRing, drawFlyer } from './artkit.js';

// Points on a jittered grid well inside a shape (within `keep` of the way
// from the centre to the edge), cached on the shape.
function fill(isl, key, step, keep) {
  const c = store(isl);
  if (c[key]) return c[key];
  const out = [];
  const b = isl.bounds;
  let i = 0;
  for (let y = b.minY + step / 2; y < b.maxY; y += step) {
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      i += 1;
      const px = x + (hash(isl.seed * 3.1 + i) - 0.5) * step * 0.8;
      const py = y + (hash(isl.seed * 5.7 + i) - 0.5) * step * 0.8;
      const ox = isl.cx + (px - isl.cx) / keep;
      const oy = isl.cy + (py - isl.cy) / keep;
      if (pointInPolygon(ox, oy, isl.pts)) out.push({ x: px, y: py, h: hash(isl.seed + i * 1.37), i });
    }
  }
  c[key] = out;
  return out;
}

// Points along the shore with the outward direction there.
function shore(isl, every) {
  const out = [];
  for (let i = 0; i < isl.pts.length; i += every) {
    const [x, y] = isl.pts[i];
    const d = Math.hypot(x - isl.cx, y - isl.cy) || 1;
    out.push({ x, y, nx: (x - isl.cx) / d, ny: (y - isl.cy) / d, h: hash(isl.seed * 1.7 + i), i });
  }
  return out;
}

function dot(ctx, x, y, r) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

function oval(ctx, x, y, rx, ry, rot = 0) {
  ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

// --- Shallows ----------------------------------------------------------------

export function drawWildShallows(ctx, isl, path, time) {
  switch (isl.kind) {
    case 'jungle':
    case 'mangrove': {
      // Brown river water at the bank, and lily pads in the still bits.
      ctx.strokeStyle = 'rgba(112, 100, 58, 0.24)';
      ctx.lineWidth = 46;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(134, 118, 70, 0.26)';
      ctx.lineWidth = 18;
      ctx.stroke(path);
      const pads = shore(isl, 3).filter((p) => p.h > 0.35);
      ctx.fillStyle = '#4c8a3a';
      ctx.beginPath();
      for (const p of pads) {
        const d = 16 + p.h * 14;
        const x = p.x + p.nx * d;
        const y = p.y + p.ny * d;
        const r = 3.5 + p.h * 3.5;
        const a = p.h * TAU;
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, a + 0.45, a + TAU - 0.45);
        ctx.closePath();
      }
      ctx.fill();
      ctx.fillStyle = '#ff8fc8';
      ctx.beginPath();
      for (const p of pads) if (p.h > 0.8) dot(ctx, p.x + p.nx * (16 + p.h * 14) + 1, p.y + p.ny * (16 + p.h * 14) - 1, 1.8);
      ctx.fill();
      return true;
    }
    case 'fern':
    case 'cliff':
      ctx.strokeStyle = 'rgba(120, 200, 170, 0.2)';
      ctx.lineWidth = 46;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(150, 215, 175, 0.24)';
      ctx.lineWidth = 18;
      ctx.stroke(path);
      return true;
    case 'ruin':
    case 'tower': {
      // Clear water over the drowned streets: old paving shows through.
      ctx.strokeStyle = 'rgba(170, 232, 220, 0.2)';
      ctx.lineWidth = 50;
      ctx.stroke(path);
      ctx.strokeStyle = `rgba(210, 250, 240, ${(0.08 + 0.05 * Math.sin(time * 1.4 + isl.seed)).toFixed(3)})`;
      ctx.lineWidth = 22;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(232, 246, 236, 0.17)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const p of shore(isl, 2)) {
        if (p.h < 0.3) continue;
        const d = 14 + p.h * 18;
        const x = p.x + p.nx * d;
        const y = p.y + p.ny * d;
        const a = Math.atan2(p.ny, p.nx);
        const s = 4 + p.h * 3;
        const c = Math.cos(a) * s;
        const si = Math.sin(a) * s;
        ctx.moveTo(x + c - si, y + si + c);
        ctx.lineTo(x - c - si, y - si + c);
        ctx.lineTo(x - c + si, y - si - c);
        ctx.lineTo(x + c + si, y + si - c);
        ctx.closePath();
      }
      ctx.stroke();
      return true;
    }
    case 'grave':
    case 'hulk': {
      ctx.strokeStyle = 'rgba(110, 150, 130, 0.13)';
      ctx.lineWidth = 46;
      ctx.stroke(path);
      ctx.strokeStyle = `rgba(150, 255, 200, ${(0.05 + 0.04 * Math.sin(time * 0.9 + isl.seed)).toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.stroke(path);
      return true;
    }
    default:
      return false;
  }
}

// --- Islands -----------------------------------------------------------------

export function drawWildIsland(ctx, isl, path, decor, time) {
  switch (isl.kind) {
    case 'jungle':
      drawJungle(ctx, isl, path, time);
      return true;
    case 'mangrove':
      drawMangrove(ctx, isl, path, time);
      return true;
    case 'fern':
      drawFernIsle(ctx, isl, path, decor, time);
      return true;
    case 'cliff':
      drawCliff(ctx, isl, path, time);
      return true;
    case 'ruin':
      drawRuin(ctx, isl, path, decor);
      return true;
    case 'tower':
      drawTower(ctx, isl, path, time);
      return true;
    case 'grave':
      drawGraves(ctx, isl, path, decor, time);
      return true;
    case 'hulk':
      drawHulk(ctx, isl, path, time);
      return true;
    default:
      return false;
  }
}

// Tree crowns: shadows, then each colour in one go, then the sunlit tops.
function drawCrowns(ctx, pts, size, colors, light, sway, time) {
  ctx.fillStyle = 'rgba(8, 20, 8, 0.4)';
  ctx.beginPath();
  for (const p of pts) dot(ctx, p.x + 3, p.y + 4, size[0] + p.h * size[1]);
  ctx.fill();
  colors.forEach((color, k) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const p of pts) {
      if (p.i % colors.length !== k) continue;
      const s = Math.sin(time * 1.3 + p.x * 0.05) * sway;
      dot(ctx, p.x + s, p.y, size[0] + p.h * size[1]);
    }
    ctx.fill();
  });
  ctx.fillStyle = light;
  ctx.beginPath();
  for (const p of pts) {
    const r = size[0] + p.h * size[1];
    const s = Math.sin(time * 1.3 + p.x * 0.05) * sway;
    dot(ctx, p.x - r * 0.28 + s, p.y - r * 0.32, r * 0.45);
  }
  ctx.fill();
}

// Rainforest: a mud bank, then the canopy, flowering trees, and macaws.
function drawJungle(ctx, isl, path, time) {
  const R = isl.radius;
  ctx.save();
  raised(ctx, path, '#2a2a18', '#463e26');
  ctx.strokeStyle = '#6e5c3a';
  ctx.lineWidth = 14;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(170, 150, 100, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke(path);
  const crowns = fill(isl, 'crowns', 19, 0.82);
  drawCrowns(ctx, crowns, [8, 7], ['#2f6b2a', '#3d7f30', '#28592a', '#4a8a36', '#356f2c'], 'rgba(150, 210, 90, 0.35)', 0.6, time);
  // Flowering trees.
  const blooms = ['#ff5fa2', '#ff9a3c', '#ffe066'];
  blooms.forEach((color, k) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const p of crowns) {
      if (p.h < 0.82 || p.i % 3 !== k) continue;
      for (let j = 0; j < 5; j++) dot(ctx, p.x + Math.cos(j * 1.26 + p.h * 9) * 6, p.y + Math.sin(j * 1.26 + p.h * 9) * 6, 1.8);
    }
    ctx.fill();
  });
  ctx.restore();
  // Macaws looping over the trees.
  const n = R > 80 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const a = time * (0.35 + i * 0.1) + isl.seed + i * 3;
    const r = R * (0.45 + 0.15 * i);
    drawFlyer(ctx, isl.cx + Math.cos(a) * r, isl.cy + Math.sin(a) * r * 0.8, a + Math.PI / 2, 6, time * 9 + i, i ? '#2f7fd6' : '#e5332a', i ? '#f2c230' : '#2f7fd6');
  }
}

// Mangroves stand on their roots in the water, with herons at the edge.
function drawMangrove(ctx, isl, path, time) {
  ctx.strokeStyle = '#4a3a26';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const p of shore(isl, 1)) {
    const out = 6 + p.h * 8;
    const sx = p.x - p.nx * 6;
    const sy = p.y - p.ny * 6;
    const ex = p.x + p.nx * out + p.ny * (p.h - 0.5) * 8;
    const ey = p.y + p.ny * out - p.nx * (p.h - 0.5) * 8;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(p.x + p.nx * out * 0.7, p.y + p.ny * out * 0.7 - 5, ex, ey);
  }
  ctx.stroke();
  ctx.save();
  raised(ctx, path, '#2c2a1c', '#3c3a24', 0.5);
  const crowns = fill(isl, 'crowns', 14, 0.9);
  drawCrowns(ctx, crowns, [6, 5], ['#3f5a2a', '#4d6a32', '#45612c'], 'rgba(150, 190, 100, 0.3)', 0.4, time);
  ctx.restore();
  // Herons wait at the water's edge.
  const spots = shore(isl, 7).filter((p) => p.h > 0.55).slice(0, 2);
  for (const p of spots) drawHeron(ctx, p.x + p.nx * 4, p.y + p.ny * 4, Math.atan2(p.ny, p.nx), time + p.h * 10);
}

function drawHeron(ctx, x, y, facing, time) {
  const peck = Math.max(0, Math.sin(time * 0.7)) ** 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facing);
  ctx.fillStyle = 'rgba(10, 20, 10, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 2.5, 5, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4f2ea';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 5, 3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#f4f2ea';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.quadraticCurveTo(6, -2, 6 + peck * 3, 0);
  ctx.stroke();
  ctx.fillStyle = '#f4f2ea';
  ctx.beginPath();
  ctx.arc(6 + peck * 3, 0, 1.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#e8b21e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7 + peck * 3, 0);
  ctx.lineTo(10.5 + peck * 3, 0);
  ctx.stroke();
  ctx.restore();
}

// Fern isle: a golden beach, ferns and cycads, a nest of eggs, and a
// long-neck grazing its way round.
function drawFernIsle(ctx, isl, path, decor, time) {
  const R = isl.radius;
  ctx.save();
  raised(ctx, path, '#3a4a1c', '#5a7c2c');
  ctx.strokeStyle = '#d2b472';
  ctx.lineWidth = 18;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(150, 120, 70, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.fillStyle = 'rgba(40, 70, 20, 0.35)';
  ctx.beginPath();
  for (const p of fill(isl, 'moss', 26, 0.8)) dot(ctx, p.x, p.y, 5 + p.h * 7);
  ctx.fill();
  // Ferns: fronds round each root, dark then light.
  ctx.lineCap = 'round';
  for (const [color, width] of [['#2c561c', 2.4], ['#86b443', 1]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    decor.forEach((d, i) => {
      const big = i % 3 === 0;
      const n = big ? 9 : 6;
      const len = (big ? 17 : 10) * d.s;
      for (let k = 0; k < n; k++) {
        const a = d.r + (k / n) * TAU + Math.sin(time * 1.2 + i + k) * 0.05;
        const ex = d.x + Math.cos(a) * len;
        const ey = d.y + Math.sin(a) * len;
        ctx.moveTo(d.x, d.y);
        ctx.quadraticCurveTo(d.x + Math.cos(a + 0.3) * len * 0.6, d.y + Math.sin(a + 0.3) * len * 0.6, ex, ey);
      }
    });
    ctx.stroke();
  }
  ctx.fillStyle = '#6a4a26';
  ctx.beginPath();
  decor.forEach((d, i) => {
    if (i % 3 === 0) dot(ctx, d.x, d.y, 2.6 * d.s);
  });
  ctx.fill();
  // A nest of eggs.
  if (hash(isl.seed * 0.7) > 0.35) {
    const a = hash(isl.seed) * TAU;
    const x = isl.cx + Math.cos(a) * R * 0.5;
    const y = isl.cy + Math.sin(a) * R * 0.5;
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const ea = k * 1.6 + isl.seed;
      ctx.fillStyle = '#efe6cf';
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(ea) * 3.4, y + Math.sin(ea) * 3.4, 3, 2.2, ea, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 100, 60, 0.6)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(ea) * 3.4 + 0.8, y + Math.sin(ea) * 3.4 - 0.5, 0.7, 0, TAU);
      ctx.fill();
    }
  }
  if (R > 70) {
    const a = time * 0.04 + isl.seed;
    const r = R * 0.28;
    drawSauropod(ctx, isl.cx + Math.cos(a) * r, isl.cy + Math.sin(a) * r * 0.8, a + Math.PI / 2, clamp(R / 130, 0.7, 1.2), time);
  }
  ctx.restore();
}

// A long-necked dinosaur from above, walking along +x.
function drawSauropod(ctx, x, y, heading, s, time) {
  const step = Math.sin(time * 1.6);
  const sway = Math.sin(time * 0.5) * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(10, 24, 8, 0.35)';
  ctx.beginPath();
  ctx.ellipse(5, 6, 20, 10, 0, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  // Tail.
  ctx.strokeStyle = '#5f7a58';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-28, -sway * 8, -38, -sway * 14);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-34, -sway * 12);
  ctx.lineTo(-46, -sway * 20);
  ctx.stroke();
  // Legs.
  ctx.fillStyle = '#4c6446';
  for (const [lx, ly, ph] of [[9, -8, 1], [9, 8, -1], [-9, -8, -1], [-9, 8, 1]]) {
    ctx.beginPath();
    ctx.ellipse(lx + step * ph * 2, ly, 4, 3, 0, 0, TAU);
    ctx.fill();
  }
  // Body.
  ctx.fillStyle = '#6f8c64';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 10, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 220, 160, 0.25)';
  ctx.beginPath();
  ctx.ellipse(-2, -3, 12, 5, 0, 0, TAU);
  ctx.fill();
  // Neck and head, swaying as it grazes.
  const hx = 40;
  const hy = sway * 18;
  ctx.strokeStyle = '#6f8c64';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.quadraticCurveTo(28, hy * 0.2, hx, hy);
  ctx.stroke();
  ctx.fillStyle = '#6f8c64';
  ctx.beginPath();
  ctx.ellipse(hx + 2, hy, 5, 3.4, sway * 0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a1a10';
  ctx.beginPath();
  dot(ctx, hx + 3, hy - 2, 0.9);
  dot(ctx, hx + 3, hy + 2, 0.9);
  ctx.fill();
  ctx.restore();
}

// Sea cliffs: a tall red mesa in steps, grass on top, pterosaurs circling.
function drawCliff(ctx, isl, path, time) {
  const R = isl.radius;
  const lift = 2.2;
  ctx.save();
  raised(ctx, path, '#4a281a', '#a0603a', lift);
  ctx.translate(-2.5 * lift, -3.5 * lift);
  for (const [k, color] of [[0.84, 'rgba(70, 34, 20, 0.45)'], [0.66, 'rgba(230, 170, 110, 0.35)'], [0.48, 'rgba(70, 34, 20, 0.4)']]) {
    ctx.save();
    ctx.translate(isl.cx, isl.cy);
    ctx.scale(k, k);
    ctx.translate(-isl.cx, -isl.cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 / k;
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(110, 150, 60, 0.55)';
  ctx.beginPath();
  for (const p of fill(isl, 'grass', 22, 0.45)) dot(ctx, p.x, p.y, 4 + p.h * 5);
  ctx.fill();
  ctx.restore();
  // Pterosaurs wheel round the top, their shadows on the sea below.
  const n = R > 70 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const a = time * (0.5 + i * 0.12) * (i ? -1 : 1) + isl.seed + i * 2;
    const r = R * (0.75 + 0.2 * i);
    const x = isl.cx + Math.cos(a) * r;
    const y = isl.cy + Math.sin(a) * r;
    const h = a + (i ? -Math.PI / 2 : Math.PI / 2);
    drawPterosaur(ctx, x + 30, y + 40, h, 14, time * 4 + i, 'rgba(4, 20, 18, 0.18)', null);
    drawPterosaur(ctx, x, y, h, 14, time * 4 + i, '#a8603a', '#d8925a');
  }
}

function drawPterosaur(ctx, x, y, heading, span, flap, wing, crest) {
  const beat = Math.sin(flap) * 0.25;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  for (const side of [-1, 1]) {
    ctx.lineTo(1, side * 2);
    ctx.lineTo(3 + beat * 6, side * span * (1 - Math.abs(beat)));
    ctx.quadraticCurveTo(-3, side * span * 0.5, -5, side * 1.5);
    ctx.lineTo(-5, 0);
  }
  ctx.closePath();
  ctx.fill();
  if (crest) {
    ctx.strokeStyle = crest;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(1, -3);
    ctx.stroke();
  }
  ctx.restore();
}

// Ruins of the drowned city: marble paving, columns standing and fallen,
// and on the big isles a temple floor.
function drawRuin(ctx, isl, path, decor) {
  const { a, hl, hw } = axisOf(isl);
  const R = isl.radius;
  ctx.save();
  raised(ctx, path, '#7a6a4c', '#cfbe96');
  ctx.save();
  ctx.translate(isl.cx, isl.cy);
  ctx.rotate(a);
  ctx.strokeStyle = 'rgba(130, 110, 76, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -hl; x <= hl; x += 13) {
    ctx.moveTo(x, -hw);
    ctx.lineTo(x, hw);
  }
  for (let y = -hw; y <= hw; y += 13) {
    ctx.moveTo(-hl, y);
    ctx.lineTo(hl, y);
  }
  ctx.stroke();
  const temple = R > 80 ? { l: Math.min(hl * 0.55, 60), w: Math.min(hw * 0.5, 34) } : null;
  if (temple) {
    const { l, w } = temple;
    ctx.fillStyle = 'rgba(60, 50, 30, 0.3)';
    ctx.fillRect(-l + 4, -w + 5, l * 2, w * 2);
    for (const [k, color] of [[1, '#d6ccb2'], [0.86, '#e4dcc6'], [0.72, '#f0eadb']]) {
      ctx.fillStyle = color;
      ctx.fillRect(-l * k, -w * k, l * 2 * k, w * 2 * k);
    }
    ctx.fillStyle = 'rgba(60, 50, 30, 0.35)';
    ctx.beginPath();
    for (let x = -l * 0.6; x <= l * 0.6 + 0.1; x += (l * 1.2) / 5) for (const side of [-1, 1]) dot(ctx, x + 1.5, side * w * 0.55 + 2, 4.2);
    ctx.fill();
    ctx.fillStyle = '#f7f3e8';
    ctx.beginPath();
    for (let x = -l * 0.6; x <= l * 0.6 + 0.1; x += (l * 1.2) / 5) for (const side of [-1, 1]) dot(ctx, x, side * w * 0.55, 3.6);
    ctx.fill();
  }
  ctx.restore();
  // Moss in the cracks.
  ctx.fillStyle = 'rgba(110, 150, 70, 0.4)';
  ctx.beginPath();
  for (const p of fill(isl, 'moss', 24, 0.85)) if (p.h > 0.5) dot(ctx, p.x, p.y, 3 + p.h * 5);
  ctx.fill();
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const inTemple = (d) => {
    if (!temple) return false;
    const dx = d.x - isl.cx;
    const dy = d.y - isl.cy;
    return Math.abs(dx * ca + dy * sa) < temple.l + 8 && Math.abs(-dx * sa + dy * ca) < temple.w + 8;
  };
  decor.forEach((d, i) => {
    if (inTemple(d)) return;
    if (i % 3 === 2) drawFallenColumn(ctx, d.x, d.y, d.r, d.s);
    else drawColumnTop(ctx, d.x, d.y, 5 * d.s, d.r, true);
  });
  ctx.restore();
}

function drawColumnTop(ctx, x, y, r, rot, standing) {
  if (standing) {
    ctx.fillStyle = 'rgba(60, 50, 30, 0.35)';
    ctx.beginPath();
    ctx.arc(x + r * 0.9, y + r * 1.2, r * 1.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d8cfb8';
    ctx.fillRect(x - r * 1.25, y - r * 1.25, r * 2.5, r * 2.5);
  }
  // A fluted drum seen end on: a scalloped rim, the joint where the next
  // drum sat, a crack right across and a little moss.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const n = 14;
  ctx.fillStyle = '#efe9da';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = ((k + 1) / n) * TAU;
    const am = (a0 + a1) / 2;
    ctx.quadraticCurveTo(Math.cos(am) * r * 0.84, Math.sin(am) * r * 0.84, Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 136, 104, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f6f1e4';
  ctx.beginPath();
  ctx.arc(-r * 0.06, -r * 0.06, r * 0.58, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 96, 70, 0.6)';
  ctx.lineWidth = Math.max(0.5, r * 0.05);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.3);
  ctx.lineTo(-r * 0.35, -r * 0.05);
  ctx.lineTo(-r * 0.1, -r * 0.28);
  ctx.lineTo(r * 0.4, r * 0.05);
  ctx.lineTo(r * 0.88, r * 0.38);
  ctx.stroke();
  ctx.fillStyle = 'rgba(80, 150, 90, 0.75)';
  dot(ctx, r * 0.55, -r * 0.55, r * 0.2);
  dot(ctx, r * 0.72, -r * 0.3, r * 0.14);
  dot(ctx, -r * 0.4, r * 0.62, r * 0.16);
  ctx.fill();
  ctx.restore();
}

function drawFallenColumn(ctx, x, y, rot, s) {
  const l = 26 * s;
  const w = 8 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(60, 50, 30, 0.35)';
  ctx.fillRect(-l / 2 + 2, -w / 2 + 3, l, w);
  ctx.fillStyle = '#e6dfcc';
  ctx.fillRect(-l / 2, -w / 2, l, w);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(-l / 2, -w / 2, l, w * 0.3);
  ctx.strokeStyle = 'rgba(130, 118, 92, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const k of [-0.2, 0.15]) {
    ctx.moveTo(l * k, -w / 2);
    ctx.lineTo(l * k + 1, w / 2);
  }
  ctx.stroke();
  ctx.restore();
}

// The drowned tower: its round top above the water, with battlements, a
// copper dome and a flag.
function drawTower(ctx, isl, path, time) {
  const T = Math.min(isl.radius * 0.5, 42);
  const { cx, cy } = isl;
  ctx.save();
  raised(ctx, path, '#6a5a40', '#bfae86', 0.8);
  ctx.fillStyle = 'rgba(110, 150, 70, 0.4)';
  ctx.beginPath();
  for (const p of fill(isl, 'moss', 22, 0.85)) if (p.h > 0.45) dot(ctx, p.x, p.y, 3 + p.h * 4);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(20, 30, 30, 0.35)';
  ctx.beginPath();
  ctx.arc(cx + 9, cy + 12, T, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9a8a6c';
  ctx.beginPath();
  ctx.arc(cx, cy, T, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d2c4a0';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 4, T * 0.94, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e6dabb';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    ctx.save();
    ctx.translate(cx - 3 + Math.cos(a) * T * 0.86, cy - 4 + Math.sin(a) * T * 0.86);
    ctx.rotate(a);
    ctx.fillRect(-2.5, -3.5, 5, 7);
    ctx.restore();
  }
  const dx = cx - 7;
  const dy = cy - 10;
  const g = ctx.createRadialGradient(dx - T * 0.2, dy - T * 0.2, 1, dx, dy, T * 0.62);
  g.addColorStop(0, '#a6e8d6');
  g.addColorStop(1, '#3f8a7a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(dx, dy, T * 0.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 80, 70, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + Math.cos(a) * T * 0.6, dy + Math.sin(a) * T * 0.6);
  }
  ctx.stroke();
  // Flag on the top of the dome.
  const wave = Math.sin(time * 5 + isl.seed);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(dx, dy);
  ctx.lineTo(dx - 4, dy - 6);
  ctx.stroke();
  ctx.fillStyle = '#d6452f';
  ctx.beginPath();
  ctx.moveTo(dx - 4, dy - 6);
  ctx.quadraticCurveTo(dx + 4, dy - 9 + wave * 2, dx + 10, dy - 7 + wave);
  ctx.lineTo(dx + 9, dy - 2 + wave);
  ctx.quadraticCurveTo(dx + 3, dy - 4 + wave * 2, dx - 3, dy - 2);
  ctx.closePath();
  ctx.fill();
  // Gulls round the tower.
  for (let i = 0; i < 2; i++) {
    const a = time * (0.6 + i * 0.15) + isl.seed + i * 2.5;
    const r = T + 18 + i * 14;
    drawFlyer(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, a + Math.PI / 2, 6, time * 7 + i, '#f4f2ea', '#dfe4e4');
  }
}

// Graveyard isle: dead grass, tombstones, twisted trees, lanterns and mist.
function graveLanterns(isl) {
  const c = store(isl);
  if (!c.lanterns) c.lanterns = fill(isl, 'lanternSpots', 40, 0.7).filter((p) => p.h > 0.62).slice(0, 4);
  return c.lanterns;
}

function deadTree(isl, d, i) {
  const c = store(isl);
  c.trees = c.trees || {};
  if (c.trees[i]) return c.trees[i];
  const lines = [];
  const grow = (x, y, a, len, w, depth, seed) => {
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    lines.push([x, y, ex, ey, w]);
    if (depth <= 0) return;
    const n = depth > 1 ? 2 : 3;
    for (let k = 0; k < n; k++) grow(ex, ey, a + (hash(seed + k) - 0.5) * 1.6, len * 0.62, w * 0.6, depth - 1, seed * 1.3 + k * 7);
  };
  for (let k = 0; k < 4; k++) grow(d.x, d.y, d.r + k * 1.57 + hash(i + k) * 0.6, 9 * d.s, 2.6, 2, isl.seed + i * 11 + k);
  c.trees[i] = lines;
  return lines;
}

function drawGraves(ctx, isl, path, decor, time) {
  ctx.save();
  raised(ctx, path, '#1e1f1b', '#393a32', 0.9);
  ctx.strokeStyle = '#4c4a3a';
  ctx.lineWidth = 10;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(150, 150, 120, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.fillStyle = 'rgba(20, 22, 18, 0.4)';
  ctx.beginPath();
  for (const p of fill(isl, 'mud', 26, 0.85)) dot(ctx, p.x, p.y, 4 + p.h * 7);
  ctx.fill();
  decor.forEach((d, i) => {
    if (i % 4 === 3) {
      ctx.strokeStyle = '#121210';
      ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1, w] of deadTree(isl, d, i)) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      return;
    }
    drawTombstone(ctx, d.x, d.y, d.s, (hash(d.x + d.y) - 0.5) * 0.5, i % 4 === 1);
  });
  for (const p of graveLanterns(isl)) drawLantern(ctx, p.x, p.y, time + p.h * 9);
  ctx.restore();
  // Mist drifts over the stones.
  for (let k = 0; k < 3; k++) {
    const a = time * 0.08 + k * 2.1 + isl.seed;
    const x = isl.cx + Math.cos(a) * isl.radius * 0.4;
    const y = isl.cy + Math.sin(a * 1.3) * isl.radius * 0.3;
    const r = isl.radius * (0.35 + 0.1 * k);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(200, 225, 215, 0.13)');
    g.addColorStop(1, 'rgba(200, 225, 215, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // Bats.
  for (let k = 0; k < 2; k++) {
    const a = time * (1.1 + k * 0.3) + isl.seed * 2 + k * 3;
    const r = isl.radius * (0.5 + 0.2 * Math.sin(time * 0.7 + k));
    drawFlyer(ctx, isl.cx + Math.cos(a) * r, isl.cy + Math.sin(a * 1.2) * r, a + Math.PI / 2 + Math.sin(time * 3 + k), 5, time * 14 + k, '#0e0e10', '#1c1c22');
  }
}

function drawTombstone(ctx, x, y, s, tilt, cross) {
  const w = 7 * s;
  const h = 9 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(8, 10, 8, 0.45)';
  ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  if (cross) {
    ctx.fillStyle = '#7c7e78';
    ctx.fillRect(-w * 0.14, -h / 2, w * 0.28, h);
    ctx.fillRect(-w / 2, -h * 0.22, w, h * 0.26);
  } else {
    ctx.fillStyle = '#5c5e5a';
    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2 + w / 2);
    ctx.arc(0, -h / 2 + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8c8e88';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 1, h / 2 - 1);
    ctx.lineTo(-w / 2 + 1, -h / 2 + w / 2);
    ctx.arc(0, -h / 2 + w / 2, w / 2 - 1, Math.PI, 0);
    ctx.lineTo(w / 2 - 2, h / 2 - 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 40, 36, 0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -h * 0.05);
    ctx.lineTo(w * 0.2, -h * 0.05);
    ctx.moveTo(-w * 0.25, h * 0.15);
    ctx.lineTo(w * 0.1, h * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLantern(ctx, x, y, time) {
  const flicker = 0.7 + 0.2 * Math.sin(time * 9) + 0.1 * Math.sin(time * 23);
  const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
  g.addColorStop(0, `rgba(200, 255, 160, ${(0.55 * flicker).toFixed(3)})`);
  g.addColorStop(1, 'rgba(200, 255, 160, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#20201c';
  ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  ctx.fillStyle = `rgba(230, 255, 190, ${flicker.toFixed(3)})`;
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
}

// A wreck run aground on a sand bar, ribs showing, mast fallen.
function drawHulk(ctx, isl, path, time) {
  const { a, hl, hw } = axisOf(isl);
  ctx.save();
  raised(ctx, path, '#3a362a', '#66604a', 0.7);
  ctx.fillStyle = 'rgba(30, 30, 24, 0.35)';
  ctx.beginPath();
  for (const p of fill(isl, 'mud', 24, 0.85)) dot(ctx, p.x, p.y, 3 + p.h * 6);
  ctx.fill();
  ctx.restore();
  const L = hl * 0.75;
  const B = Math.min(hw * 0.6, L * 0.32);
  ctx.save();
  ctx.translate(isl.cx, isl.cy);
  ctx.rotate(a + 0.12);
  const hullPath = () => {
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.quadraticCurveTo(L * 0.4, -B * 1.2, -L * 0.85, -B);
    ctx.lineTo(-L, 0);
    ctx.lineTo(-L * 0.85, B);
    ctx.quadraticCurveTo(L * 0.4, B * 1.2, L, 0);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(10, 10, 8, 0.45)';
  ctx.save();
  ctx.translate(5, 7);
  hullPath();
  ctx.fill();
  ctx.restore();
  hullPath();
  ctx.fillStyle = '#3a2a1c';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#5a4430';
  ctx.fillRect(-L, -B * 0.75, L * 2, B * 1.5);
  ctx.strokeStyle = 'rgba(30, 20, 12, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = -B; y <= B; y += 4) {
    ctx.moveTo(-L, y);
    ctx.lineTo(L, y);
  }
  ctx.stroke();
  // The hole, with ribs across it.
  ctx.fillStyle = '#100c08';
  ctx.beginPath();
  ctx.ellipse(-L * 0.25, B * 0.15, L * 0.28, B * 0.6, 0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#6e5238';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -L * 0.48; x <= -L * 0.02; x += L * 0.09) {
    ctx.moveTo(x, -B);
    ctx.lineTo(x, B);
  }
  ctx.stroke();
  ctx.restore();
  // Fallen mast and a rag of sail.
  ctx.strokeStyle = '#4a3624';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L * 0.15, 0);
  ctx.lineTo(L * 0.45, B * 2.2);
  ctx.stroke();
  const flap = Math.sin(time * 2 + isl.seed) * 2;
  ctx.fillStyle = 'rgba(190, 190, 170, 0.55)';
  ctx.beginPath();
  ctx.moveTo(L * 0.22, B * 0.5);
  ctx.lineTo(L * 0.4, B * 1.9);
  ctx.lineTo(L * 0.52 + flap, B * 1.6);
  ctx.lineTo(L * 0.46, B * 1.1 + flap);
  ctx.lineTo(L * 0.5 + flap, B * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const bx = isl.cx + Math.cos(a + 0.12) * L * 0.85;
  const by = isl.cy + Math.sin(a + 0.12) * L * 0.85;
  drawLantern(ctx, bx, by, time + isl.seed);
}

// --- Rocks -------------------------------------------------------------------

export function drawWildRock(ctx, r, time) {
  switch (r.material) {
    case 'snag':
      drawSnag(ctx, r, time);
      return true;
    case 'bones':
      drawBones(ctx, r);
      return true;
    case 'column':
      drawColumnTop(ctx, r.x, r.y, r.r, hash(r.x + r.y) * TAU, false);
      ctx.strokeStyle = 'rgba(60, 130, 80, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + 0.6, 0.6, 2.4);
      ctx.stroke();
      return true;
    case 'statue':
      drawStatueHead(ctx, r);
      return true;
    case 'mast':
      drawMastRock(ctx, r, time);
      return true;
    default:
      return false;
  }
}

// A drowned tree: a log with a broken branch, moss on top.
function drawSnag(ctx, r, time) {
  const rot = hash(r.x * 0.7 + r.y) * Math.PI + Math.sin(time * 0.5 + r.x) * 0.03;
  const l = r.r * 2;
  const w = r.r * 0.8;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.4)';
  ctx.lineWidth = w + 3 + Math.sin(time * 2 + r.x) * 0.8;
  ctx.beginPath();
  ctx.moveTo(-l / 2, 0);
  ctx.lineTo(l / 2, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 20, 10, 0.35)';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(-l / 2 + 2, 3);
  ctx.lineTo(l / 2 + 2, 3);
  ctx.stroke();
  ctx.strokeStyle = '#4a3420';
  ctx.beginPath();
  ctx.moveTo(-l / 2, 0);
  ctx.lineTo(l / 2, 0);
  ctx.stroke();
  ctx.strokeStyle = '#7a5a36';
  ctx.lineWidth = w * 0.45;
  ctx.beginPath();
  ctx.moveTo(-l / 2, -w * 0.15);
  ctx.lineTo(l / 2, -w * 0.15);
  ctx.stroke();
  ctx.strokeStyle = '#4a3420';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(l * 0.1, 0);
  ctx.lineTo(l * 0.28, -w * 1.1);
  ctx.stroke();
  ctx.fillStyle = '#a07a4a';
  ctx.beginPath();
  ctx.arc(l / 2, 0, w * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(90, 140, 60, 0.7)';
  ctx.beginPath();
  dot(ctx, -l * 0.2, -w * 0.2, w * 0.25);
  dot(ctx, l * 0.05, -w * 0.25, w * 0.2);
  ctx.fill();
  ctx.restore();
}

// Fossil ribs sticking out of the lagoon.
function drawBones(ctx, r) {
  const rot = hash(r.x + r.y * 0.3) * TAU;
  const R = r.r;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.lineCap = 'round';
  const ribs = () => {
    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.lineTo(R * 1.05, 0);
    for (let k = -1.5; k <= 1.5; k += 1) {
      const x = k * R * 0.42;
      for (const side of [-1, 1]) {
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x - R * 0.35, side * R * 0.75, x + R * 0.15, side * R * 0.95);
      }
    }
  };
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.35)';
  ctx.lineWidth = 5;
  ribs();
  ctx.stroke();
  ctx.translate(2, 3);
  ctx.strokeStyle = 'rgba(4, 20, 18, 0.35)';
  ctx.lineWidth = 3;
  ribs();
  ctx.stroke();
  ctx.translate(-2, -3);
  ctx.strokeStyle = '#efe7cf';
  ctx.lineWidth = 2.4;
  ribs();
  ctx.stroke();
  ctx.fillStyle = '#e2d8bc';
  ctx.beginPath();
  for (let k = -0.8; k <= 0.9; k += 0.3) dot(ctx, k * R, 0, 1.6);
  ctx.fill();
  ctx.restore();
}

// A statue's face looking up out of the water, eyes closed.
function drawStatueHead(ctx, r) {
  const R = r.r;
  const rot = (hash(r.x * 0.2 + r.y) - 0.5) * 1.2;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(10, 40, 46, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 3, R * 0.85, R, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#a89c82';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.85, R, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c8bda2';
  ctx.beginPath();
  ctx.ellipse(-R * 0.08, -R * 0.1, R * 0.7, R * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#6e6450';
  ctx.lineWidth = Math.max(0.8, R * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * R * 0.42, -R * 0.2);
    ctx.quadraticCurveTo(side * R * 0.26, -R * 0.08, side * R * 0.1, -R * 0.2);
  }
  ctx.moveTo(0, -R * 0.15);
  ctx.lineTo(-R * 0.06, R * 0.22);
  ctx.lineTo(R * 0.06, R * 0.26);
  ctx.moveTo(-R * 0.22, R * 0.5);
  ctx.quadraticCurveTo(0, R * 0.58, R * 0.22, R * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(90, 140, 70, 0.6)';
  ctx.beginPath();
  dot(ctx, -R * 0.5, -R * 0.6, R * 0.22);
  dot(ctx, R * 0.4, -R * 0.75, R * 0.16);
  ctx.fill();
  ctx.restore();
}

// A sunken ship's mast: the top, a yard across it with a torn sail.
function drawMastRock(ctx, r, time) {
  const R = r.r;
  const rot = hash(r.x + r.y * 0.9) * Math.PI;
  const flap = Math.sin(time * 2.2 + r.x);
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(232, 244, 242, 0.4)';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.75 + Math.sin(time * 2 + r.x) * 0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 205, 190, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-R * 1.1, 0);
  ctx.lineTo(R * 1.1, 0);
  ctx.lineTo(R * 0.9 + flap, R * 0.9);
  ctx.lineTo(R * 0.4, R * 0.6 + flap);
  ctx.lineTo(R * 0.1 + flap, R * 1.1);
  ctx.lineTo(-R * 0.4, R * 0.7);
  ctx.lineTo(-R * 0.9 - flap, R * 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2e2216';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, R * 0.28);
  ctx.beginPath();
  ctx.moveTo(-R * 1.15, 0);
  ctx.lineTo(R * 1.15, 0);
  ctx.stroke();
  ctx.strokeStyle = '#5a4430';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#4a3624';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.36, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// --- Drifters ------------------------------------------------------------------

export function drawWildFloe(ctx, f, path, decor, time) {
  switch (f.look) {
    case 'hippo':
      drawHippo(ctx, f, path, time);
      return true;
    case 'turtle':
      drawTurtle(ctx, f, path, time);
      return true;
    case 'galley':
      drawGalley(ctx, f, path, time);
      return true;
    case 'ghostship':
      drawGhostShip(ctx, f, path, time);
      return true;
    default:
      return false;
  }
}

// The head end of a drifter: the end of its long axis it is heading for.
function headOf(f) {
  const { a } = axisOf(f);
  const c = store(f);
  if (Math.hypot(f.vx, f.vy) > 0.3) c.face = Math.cos(a) * f.vx + Math.sin(a) * f.vy >= 0 ? 0 : Math.PI;
  return a + (c.face || 0);
}

// A hippo wallowing: a wet grey back, ears that twitch, and a bird riding.
function drawHippo(ctx, f, path, time) {
  const { hl, hw } = axisOf(f);
  const a = headOf(f);
  ctx.save();
  const g = ctx.createRadialGradient(f.cx - hl * 0.2, f.cy - hw * 0.3, 2, f.cx, f.cy, Math.max(hl, hw));
  g.addColorStop(0, '#a8949e');
  g.addColorStop(1, '#5e4c5a');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.strokeStyle = 'rgba(40, 28, 38, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.fillStyle = '#8a7684';
  ctx.beginPath();
  ctx.ellipse(hl * 0.78, 0, hl * 0.3, hw * 0.6, 0, 0, TAU);
  ctx.fill();
  const twitch = Math.sin(time * 3 + f.seed) > 0.85 ? 0.4 : 0;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#5e4c5a';
    ctx.beginPath();
    ctx.ellipse(hl * 0.6, side * hw * 0.45, 3.2, 2.2, side * (0.5 + twitch), 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d88a9a';
    ctx.beginPath();
    ctx.ellipse(hl * 0.6, side * hw * 0.45, 1.6, 1, side * (0.5 + twitch), 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(hl * 0.74, side * hw * 0.25, 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1014';
    ctx.beginPath();
    dot(ctx, hl * 0.76, side * hw * 0.25, 1);
    ctx.moveTo(hl * 1.0 + 1.6, side * hw * 0.17);
    ctx.ellipse(hl * 1.0, side * hw * 0.17, 1.6, 1, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(60, 40, 56, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [-0.1, 0.12]) {
    ctx.moveTo(hl * k, -hw * 0.5);
    ctx.quadraticCurveTo(hl * (k + 0.06), 0, hl * k, hw * 0.5);
  }
  ctx.stroke();
  // An oxpecker hitching a ride.
  ctx.fillStyle = '#7a5a3a';
  ctx.beginPath();
  ctx.ellipse(-hl * 0.25, -hw * 0.1, 3, 1.8, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.arc(-hl * 0.25 + 3, -hw * 0.1 + 0.9, 0.9, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// A giant sea turtle: paddling flippers, a plated shell, barnacles.
function drawTurtle(ctx, f, path, time) {
  const { hl, hw } = axisOf(f);
  const a = headOf(f);
  const stroke = Math.sin(time * 1.8 + f.seed);
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.fillStyle = '#5f7f5a';
  for (const side of [-1, 1]) {
    for (const [x, len, ph] of [[hl * 0.4, hw * 1.15, 1], [-hl * 0.55, hw * 0.6, -1]]) {
      ctx.save();
      ctx.translate(x, side * hw * 0.7);
      ctx.rotate(side * (0.6 + stroke * ph * 0.35));
      ctx.beginPath();
      ctx.ellipse(-len * 0.5, side * 2, len * 0.6, len * 0.2, side * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.ellipse(hl * 1.02, 0, hl * 0.22, hw * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a2214';
  ctx.beginPath();
  dot(ctx, hl * 1.1, -hw * 0.14, 1.4);
  dot(ctx, hl * 1.1, hw * 0.14, 1.4);
  ctx.fill();
  ctx.restore();
  ctx.save();
  const g = ctx.createRadialGradient(f.cx - hl * 0.15, f.cy - hw * 0.25, 2, f.cx, f.cy, Math.max(hl, hw));
  g.addColorStop(0, '#9aa266');
  g.addColorStop(1, '#4a5a32');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.strokeStyle = '#38442a';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.clip(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.strokeStyle = 'rgba(40, 50, 26, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    const x = k * hl * 0.45;
    ctx.moveTo(x + hl * 0.2, 0);
    for (let j = 1; j <= 6; j++) {
      const t = (j / 6) * TAU;
      ctx.lineTo(x + Math.cos(t) * hl * 0.2, Math.sin(t) * hw * 0.32);
    }
  }
  for (let k = -1; k <= 1; k++) {
    for (const side of [-1, 1]) {
      ctx.moveTo(k * hl * 0.45, side * hw * 0.32);
      ctx.lineTo(k * hl * 0.5, side * hw * 1.1);
    }
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(240, 236, 220, 0.75)';
  ctx.beginPath();
  for (let k = 0; k < 7; k++) dot(ctx, (hash(f.seed + k) - 0.5) * hl * 1.6, (hash(f.seed * 2 + k) - 0.5) * hw * 1.4, 1 + hash(k + f.seed * 3));
  ctx.fill();
  ctx.restore();
}

// An old galley: oars sweeping both sides, shields on the rails, a striped
// square sail and an eye painted on the bow.
function drawGalley(ctx, f, path, time) {
  const { a, hl, hw } = axisOf(f);
  const sweep = Math.sin(time * 2.4 + f.seed) * 0.45;
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.strokeStyle = '#c8a66a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const x = -hl * 0.58 + (i * hl * 1.16) / 7;
    for (const side of [-1, 1]) {
      ctx.moveTo(x, side * hw * 0.7);
      ctx.lineTo(x - Math.sin(sweep) * hw * 1.2, side * (hw * 0.7 + Math.cos(sweep) * hw * 1.1));
    }
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#6a3e1e';
  ctx.fill(path);
  ctx.clip(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.fillStyle = '#b08a56';
  ctx.beginPath();
  ctx.ellipse(0, 0, hl - 6, hw - 4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 50, 24, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let y = -hw; y <= hw; y += 4) {
    ctx.moveTo(-hl, y);
    ctx.lineTo(hl, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#e0b48a';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const x = -hl * 0.58 + (i * hl * 1.16) / 7;
    for (const side of [-1, 1]) dot(ctx, x + 2, side * hw * 0.4, 1.8);
  }
  ctx.fill();
  const shields = ['#d6452f', '#e8b21e', '#2f7fb8'];
  for (let i = 0; i < 9; i++) {
    const x = -hl * 0.65 + (i * hl * 1.3) / 8;
    for (const side of [-1, 1]) {
      ctx.fillStyle = shields[(i + (side > 0 ? 1 : 0)) % 3];
      ctx.beginPath();
      ctx.arc(x, side * (hw - 3), 2.6, 0, TAU);
      ctx.fill();
    }
  }
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f4f0e4';
    ctx.beginPath();
    ctx.ellipse(hl * 0.82, side * hw * 0.32, 3, 1.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(hl * 0.83, side * hw * 0.32, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // The sail stands above the hull, so it isn't clipped.
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.translate(-4, -6);
  const belly = 7;
  const sail = () => {
    ctx.beginPath();
    ctx.moveTo(0, -hw * 1.35);
    ctx.quadraticCurveTo(belly, 0, 0, hw * 1.35);
    ctx.lineTo(-4, hw * 1.35);
    ctx.quadraticCurveTo(belly - 4, 0, -4, -hw * 1.35);
    ctx.closePath();
  };
  sail();
  ctx.fillStyle = '#f2ead6';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#c0392b';
  for (let y = -hw * 1.35; y < hw * 1.35; y += 10) ctx.fillRect(-6, y, belly + 6, 5);
  ctx.restore();
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -hw * 1.45);
  ctx.lineTo(-2, hw * 1.45);
  ctx.stroke();
  ctx.restore();
}

// A ghost ship: you can see the sea through her hull, her sails are rags,
// and her lanterns burn green.
function drawGhostShip(ctx, f, path, time) {
  const { a, hl, hw } = axisOf(f);
  const flicker = 0.72 + 0.14 * Math.sin(time * 3 + f.seed) + 0.08 * Math.sin(time * 7.3);
  // A trail of green mist behind her.
  const back = Math.atan2(-f.vy, -f.vx);
  if (Math.hypot(f.vx, f.vy) > 0.3) {
    for (let i = 0; i < 5; i++) {
      const t = (time * 0.4 + i / 5) % 1;
      ctx.fillStyle = `rgba(150, 255, 200, ${(0.16 * (1 - t)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(f.cx + Math.cos(back) * (hl * 0.5 + t * 50), f.cy + Math.sin(back) * (hl * 0.5 + t * 50), 6 + t * 12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.save();
  ctx.globalAlpha = flicker;
  ctx.fillStyle = 'rgba(110, 150, 130, 0.6)';
  ctx.fill(path);
  ctx.strokeStyle = 'rgba(200, 255, 220, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.stroke(path);
  ctx.save();
  ctx.clip(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.strokeStyle = 'rgba(200, 255, 220, 0.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let y = -hw; y <= hw; y += 5) {
    ctx.moveTo(-hl, y);
    ctx.lineTo(hl, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(10, 24, 20, 0.55)';
  ctx.beginPath();
  oval(ctx, -hl * 0.15, hw * 0.3, hl * 0.12, hw * 0.25);
  oval(ctx, hl * 0.35, -hw * 0.35, hl * 0.08, hw * 0.2);
  ctx.fill();
  ctx.restore();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  for (const mx of [hl * 0.32, -hl * 0.28]) {
    const flap = Math.sin(time * 1.8 + mx) * 2;
    ctx.fillStyle = 'rgba(220, 240, 230, 0.5)';
    ctx.beginPath();
    ctx.moveTo(mx - 3, -hw * 1.2);
    ctx.lineTo(mx + 3, -hw * 1.2);
    for (let k = 0; k <= 6; k++) {
      const y = -hw * 1.2 + (k / 6) * hw * 2.4;
      ctx.lineTo(mx + 6 + (k % 2 ? 4 : 0) + flap, y);
    }
    ctx.lineTo(mx - 3, hw * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 40, 36, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 1, -hw * 0.5);
    ctx.lineTo(mx + 5, -hw * 0.1);
    ctx.moveTo(mx + 2, hw * 0.4);
    ctx.lineTo(mx + 6, hw * 0.7);
    ctx.stroke();
    ctx.strokeStyle = '#2e3a34';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 3, -hw * 1.3);
    ctx.lineTo(mx - 3, hw * 1.3);
    ctx.stroke();
  }
  // A skull at the stern rail.
  ctx.fillStyle = '#eef2e6';
  ctx.beginPath();
  ctx.arc(-hl * 0.78, 0, 3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a2420';
  ctx.beginPath();
  dot(ctx, -hl * 0.76, -1.1, 0.8);
  dot(ctx, -hl * 0.76, 1.1, 0.8);
  ctx.fill();
  ctx.restore();
  for (const s of [0.85, -0.7]) drawLantern(ctx, f.cx + Math.cos(a) * hl * s, f.cy + Math.sin(a) * hl * s, time + s * 5);
}

// --- Lairs -----------------------------------------------------------------------

// Already translated to the lair's centre.
export function drawWildLair(ctx, k, time) {
  switch (k.look) {
    case 'croc':
      drawCroc(ctx, k, time);
      return true;
    case 'plesio':
      drawPlesio(ctx, k, time);
      return true;
    case 'eel':
      drawEel(ctx, k, time);
      return true;
    case 'wraith':
      drawWraith(ctx, k, time);
      return true;
    default:
      return false;
  }
}

function warnGlow(ctx, R, t, inner, outer) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(${inner}, ${(0.55 * t).toFixed(3)})`);
  g.addColorStop(0.8, `rgba(${outer}, ${(0.18 * t).toFixed(3)})`);
  g.addColorStop(1, `rgba(${outer}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
}

function splash(ctx, R, t) {
  ctx.strokeStyle = `rgba(232, 244, 242, ${(0.7 * (1 - t)).toFixed(3)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.3 + t * 0.75), 0, TAU);
  ctx.stroke();
  const s = Math.sin(t * Math.PI);
  ctx.fillStyle = `rgba(232, 244, 242, ${(0.5 * s).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i;
    dot(ctx, Math.cos(a) * R * (0.25 + 0.55 * t), Math.sin(a) * R * (0.25 + 0.55 * t), 2.5 + 3 * s);
  }
  ctx.fill();
}

// A crocodile: eyes and nostrils just above the water, a shadow that grows,
// then the jaws.
function drawCroc(ctx, k, time) {
  const R = k.r;
  const head = (x, y, a, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(20, 34, 18, ${(0.25 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(-R * 0.25, 0, R * 0.5, R * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(232, 244, 242, ${(0.3 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(4, -5);
    ctx.lineTo(4, 5);
    ctx.lineTo(-14, 10);
    ctx.stroke();
    ctx.fillStyle = '#4a5a2a';
    ctx.beginPath();
    dot(ctx, 0, -4, 3.2);
    dot(ctx, 0, 4, 3.2);
    dot(ctx, 16, -1.6, 1.8);
    dot(ctx, 16, 1.6, 1.8);
    ctx.fill();
    ctx.fillStyle = '#f2d23a';
    ctx.beginPath();
    oval(ctx, 0.6, -4, 1.8, 1.2);
    oval(ctx, 0.6, 4, 1.8, 1.2);
    ctx.fill();
    ctx.fillStyle = '#101008';
    ctx.fillRect(0.2, -5, 0.8, 2);
    ctx.fillRect(0.2, 3, 0.8, 2);
    ctx.restore();
  };
  if (k.phase === 'idle') {
    const a = time * 0.18 + k.x;
    head(Math.cos(a) * R * 0.35, Math.sin(a) * R * 0.35, a + Math.PI / 2, 1);
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '18, 30, 14', '120, 140, 60');
    dangerRing(ctx, k, time, t);
    const a = hash(k.x + k.y) * TAU;
    head(Math.cos(a) * R * 0.3 * (1 - t), Math.sin(a) * R * 0.3 * (1 - t), a + Math.PI, 1 + t);
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  const open = Math.abs(Math.sin(t * Math.PI * 2)) * 0.45;
  splash(ctx, R, t);
  ctx.save();
  ctx.rotate(hash(k.x + k.y) * TAU + Math.PI);
  ctx.scale(0.6 + rise * 0.5, 0.6 + rise * 0.5);
  ctx.fillStyle = '#3a4a22';
  ctx.beginPath();
  ctx.ellipse(-R * 0.35, 0, R * 0.3, R * 0.2, 0, 0, TAU);
  ctx.fill();
  // The inside of the mouth first, then the jaws over it.
  if (open > 0.05) {
    ctx.fillStyle = '#c85a5a';
    ctx.beginPath();
    ctx.moveTo(-R * 0.18, 0);
    ctx.lineTo(R * 0.58 * Math.cos(open), -R * 0.58 * Math.sin(open));
    ctx.quadraticCurveTo(R * 0.66, 0, R * 0.58 * Math.cos(open), R * 0.58 * Math.sin(open));
    ctx.closePath();
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * open);
    ctx.fillStyle = '#f4f0e0';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = -R * 0.12 + i * R * 0.1;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + R * 0.03, -side * R * 0.05);
      ctx.lineTo(x + R * 0.06, 0);
    }
    ctx.fill();
    ctx.fillStyle = side < 0 ? '#4e6230' : '#44562a';
    ctx.beginPath();
    ctx.moveTo(-R * 0.22, 0);
    ctx.lineTo(-R * 0.22, side * R * 0.2);
    ctx.quadraticCurveTo(R * 0.3, side * R * 0.16, R * 0.6, side * R * 0.06);
    ctx.lineTo(R * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 30, 12, 0.45)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) dot(ctx, -R * 0.05 + i * R * 0.13, side * R * 0.1, R * 0.018);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#f2d23a';
  ctx.beginPath();
  dot(ctx, -R * 0.22, -R * 0.12, 2.6);
  dot(ctx, -R * 0.22, R * 0.12, 2.6);
  ctx.fill();
  ctx.restore();
}

// The plesiosaur: a long shadow circling, then the neck rises.
function drawPlesio(ctx, k, time) {
  const R = k.r;
  const body = (alpha, s) => {
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(6, 30, 28, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    oval(ctx, -R * 0.15, 0, R * 0.28, R * 0.17);
    for (const [x, y] of [[0, -1], [0, 1], [-0.32, -1], [-0.32, 1]]) oval(ctx, x * R, y * R * 0.2, R * 0.13, R * 0.05, y * 0.6);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = R * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R * 0.1, 0);
    ctx.quadraticCurveTo(R * 0.35, -R * 0.15, R * 0.55, -R * 0.05);
    ctx.moveTo(-R * 0.4, 0);
    ctx.lineTo(-R * 0.62, R * 0.06);
    ctx.stroke();
    ctx.restore();
  };
  if (k.phase === 'idle') {
    const a = time * 0.25 + k.y;
    ctx.save();
    ctx.translate(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    ctx.rotate(a + Math.PI / 2);
    body(0.2, 0.8);
    ctx.restore();
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '6, 30, 28', '120, 220, 200');
    dangerRing(ctx, k, time, t);
    ctx.save();
    ctx.rotate(time * 0.6 + k.y);
    body(0.25 + 0.3 * t, 0.85 + 0.2 * t);
    ctx.restore();
    ctx.fillStyle = `rgba(232, 244, 242, ${(0.5 * t).toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const pop = (time * 2.5 + i * 0.17) % 1;
      dot(ctx, Math.cos(i * 2.4) * R * 0.5 * pop, Math.sin(i * 2.4) * R * 0.5 * pop, 1.5 + pop * 3);
    }
    ctx.fill();
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  splash(ctx, R, t);
  ctx.save();
  const a = hash(k.x * 0.3 + k.y) * TAU + t * 1.6;
  ctx.rotate(a);
  ctx.fillStyle = '#3e6a5e';
  ctx.beginPath();
  ctx.ellipse(-R * 0.2, 0, R * 0.3, R * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a8a7a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-R * 0.05, side * R * 0.24, R * 0.16, R * 0.06, side * (0.5 + Math.sin(time * 6) * 0.3), 0, TAU);
    ctx.fill();
  }
  // The neck rises out of the sea and arches over the ring.
  const reach = R * (0.4 + 0.55 * rise);
  const hx = reach;
  const hy = -R * 0.2 * rise;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(4, 20, 18, 0.3)';
  ctx.lineWidth = R * 0.12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(reach * 0.5 + 8, R * 0.25 + 10, hx + 10, hy + 14);
  ctx.stroke();
  ctx.strokeStyle = '#4e7c6e';
  ctx.lineWidth = R * 0.13 * (0.8 + 0.4 * rise);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(reach * 0.5, -R * 0.3 * rise, hx, hy);
  ctx.stroke();
  ctx.strokeStyle = '#8fc0aa';
  ctx.lineWidth = R * 0.04;
  ctx.stroke();
  const s = 1 + rise * 0.5;
  ctx.translate(hx, hy);
  ctx.scale(s, s);
  ctx.fillStyle = '#4e7c6e';
  ctx.beginPath();
  ctx.ellipse(4, 0, 10, 6, 0, 0, TAU);
  ctx.fill();
  const open = 0.15 + 0.3 * rise;
  ctx.fillStyle = '#b84a4a';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(18, -18 * Math.sin(open));
  ctx.lineTo(18, 18 * Math.sin(open));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f0e0';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 2.6;
    const y = (x - 6) * Math.tan(open) * 0.9;
    ctx.moveTo(x, -y);
    ctx.lineTo(x + 1.2, -y + 2.4);
    ctx.lineTo(x + 2.4, -y);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.2, y - 2.4);
    ctx.lineTo(x + 2.4, y);
  }
  ctx.fill();
  ctx.fillStyle = '#f2d23a';
  ctx.beginPath();
  dot(ctx, 3, -4, 1.6);
  dot(ctx, 3, 4, 1.6);
  ctx.fill();
  ctx.restore();
}

// A moray in a drowned doorway: eyes in the dark, then it lunges.
function drawEel(ctx, k, time) {
  const R = k.r;
  const a = hash(k.x + k.y * 0.5) * TAU;
  ctx.save();
  ctx.rotate(a);
  const door = (alpha) => {
    ctx.fillStyle = `rgba(6, 26, 34, ${(0.4 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(-R * 0.7, -R * 0.18);
    ctx.lineTo(-R * 0.4, -R * 0.18);
    ctx.arc(-R * 0.4, 0, R * 0.18, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-R * 0.7, R * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(220, 240, 230, ${(0.22 * alpha).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  const eyes = (glow) => {
    ctx.fillStyle = `rgba(255, 240, 140, ${glow.toFixed(3)})`;
    ctx.beginPath();
    dot(ctx, -R * 0.45, -R * 0.06, 2);
    dot(ctx, -R * 0.45, R * 0.06, 2);
    ctx.fill();
  };
  if (k.phase === 'idle') {
    door(1);
    if (Math.sin(time * 0.9 + k.x) < 0.9) eyes(0.45);
    ctx.restore();
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    ctx.restore();
    warnGlow(ctx, R, t, '6, 26, 34', '160, 220, 120');
    dangerRing(ctx, k, time, t);
    ctx.save();
    ctx.rotate(a);
    door(1 + t);
    eyes(0.5 + 0.5 * t);
    ctx.restore();
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const out = Math.sin(t * Math.PI);
  ctx.restore();
  splash(ctx, R, t);
  ctx.save();
  ctx.rotate(a);
  door(1);
  // The body, from the doorway out across the ring, rippling.
  const len = R * 1.5 * out;
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const s = i / 16;
    pts.push([-R * 0.5 + s * len, Math.sin(s * 7 - time * 9) * R * 0.14 * s]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, w] of [['rgba(4, 20, 20, 0.3)', 0.2], ['#5a6a24', 0.17], ['#8a9a3a', 0.07]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = R * w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230, 220, 120, 0.7)';
  ctx.beginPath();
  for (let i = 2; i < 15; i += 2) dot(ctx, pts[i][0], pts[i][1] + (i % 4 ? 2 : -2), 1.4);
  ctx.fill();
  const [hx, hy] = pts[16];
  const open = 0.3 + 0.25 * Math.sin(time * 14);
  ctx.translate(hx, hy);
  ctx.fillStyle = '#5a6a24';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.13, R * 0.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c85050';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(R * 0.22, -R * 0.2 * Math.sin(open));
  ctx.lineTo(R * 0.22, R * 0.2 * Math.sin(open));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2ea9a';
  ctx.beginPath();
  dot(ctx, R * 0.02, -R * 0.06, 1.8);
  dot(ctx, R * 0.02, R * 0.06, 1.8);
  ctx.fill();
  ctx.restore();
}

// Will-o'-wisps circling, a skull in the glow, then the ghosts burst out.
function drawWraith(ctx, k, time) {
  const R = k.r;
  const wisp = (x, y, r, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(220, 255, 220, ${alpha.toFixed(3)})`);
    g.addColorStop(0.4, `rgba(150, 255, 190, ${(alpha * 0.5).toFixed(3)})`);
    g.addColorStop(1, 'rgba(150, 255, 190, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  const skull = (s, alpha, jaw) => {
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(210, 255, 225, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, -4, 16, 0, TAU);
    ctx.fill();
    ctx.fillRect(-9, 6, 18, 6 + jaw * 6);
    ctx.fillStyle = `rgba(8, 20, 16, ${(alpha * 1.2).toFixed(3)})`;
    ctx.beginPath();
    oval(ctx, -6, -4, 4.5, 5);
    oval(ctx, 6, -4, 4.5, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-2, 6);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-7, 9 + jaw * 3, 14, 1.4 + jaw * 3);
    ctx.restore();
  };
  if (k.phase === 'idle') {
    for (let i = 0; i < 3; i++) {
      const a = time * 0.6 + (i / 3) * TAU + k.x;
      wisp(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4 + Math.sin(time * 2 + i) * 4, 9, 0.5 + 0.2 * Math.sin(time * 3 + i));
    }
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '30, 60, 44', '150, 255, 190');
    dangerRing(ctx, k, time, t);
    skull(1.2 + t * 0.6, 0.15 + 0.35 * t, 0);
    for (let i = 0; i < 5; i++) {
      const a = time * (1.2 + t * 2) + (i / 5) * TAU;
      const r = R * (0.6 - 0.35 * t);
      wisp(Math.cos(a) * r, Math.sin(a) * r, 9 + t * 4, 0.6);
    }
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  ctx.strokeStyle = `rgba(170, 255, 200, ${(0.7 * (1 - t)).toFixed(3)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.3 + t * 0.75), 0, TAU);
  ctx.stroke();
  skull(1.8 + rise * 0.5, 0.6 * rise, rise);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3;
    const d = R * (0.2 + 0.8 * t);
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = `rgba(225, 255, 235, ${(0.75 * (1 - t * 0.6)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 0);
    for (let j = 0; j <= 4; j++) ctx.lineTo(7 - j * 3.5, 10 + (j % 2 ? 3 : 0) + Math.sin(time * 12 + i + j) * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 24, 18, 0.8)';
    ctx.beginPath();
    dot(ctx, -2.5, 0, 1.4);
    dot(ctx, 2.5, 0, 1.4);
    ctx.fill();
    ctx.restore();
  }
}

// --- Night lights -------------------------------------------------------------------

export function wildLights(level, time) {
  const out = [];
  for (const isl of level.islands) {
    if (isl.kind === 'grave') for (const p of graveLanterns(isl)) out.push([p.x, p.y, 44, 0.6]);
    else if (isl.kind === 'hulk') {
      const { a, hl } = axisOf(isl);
      out.push([isl.cx + Math.cos(a + 0.12) * hl * 0.64, isl.cy + Math.sin(a + 0.12) * hl * 0.64, 50, 0.6]);
    } else if (isl.kind === 'tower') out.push([isl.cx - 7, isl.cy - 10, 70, 0.6]);
  }
  for (const f of level.floes) {
    if (f.look === 'ghostship') out.push([f.cx + f.ox, f.cy + f.oy, f.radius * 1.3, 0.7]);
    else if (f.look === 'galley') out.push([f.cx + f.ox, f.cy + f.oy, f.radius * 0.9, 0.5]);
  }
  for (const k of level.krakens) {
    if (k.look === 'wraith') out.push([k.x, k.y, k.r * (k.phase === 'idle' ? 0.5 : 1), k.phase === 'idle' ? 0.4 : 0.75]);
  }
  return out;
}
