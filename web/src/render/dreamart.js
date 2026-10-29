// The last far worlds' art: Aurora Ice (glaciers with seals and a polar
// bear, tundra with an igloo and reindeer, icebergs and the orca), Toy Bay
// (heaps of toy bricks, a sandcastle with a moat, beach balls, rubber ducks
// and the jack-in-the-box) and Sky Sea (cloud banks, floating isles with
// waterfalls, hot-air balloons, airships and the thundercloud). wildart.js
// hands these over when it doesn't know a thing; each returns true when it
// drew it.
// Everything here is in world units with the camera applied.

import { clamp } from '../core/math.js';
import { TAU, hash, axisOf, store, raised, dangerRing, drawFlyer, drawPerson, fill, shore, dot, oval, headOf, warnGlow, splash } from './artkit.js';

const TOY = ['#e5484d', '#3b8fe0', '#f5c518', '#3ddc97', '#f28c28', '#8b5cf6'];
const TOY_SIDE = ['#a83236', '#2a6fb8', '#c99a10', '#26a872', '#c0661a', '#6a3fd0'];

// --- Shallows ----------------------------------------------------------------

export function drawDreamShallows(ctx, isl, path, time) {
  switch (isl.kind) {
    case 'glacier':
    case 'tundra': {
      // Milky meltwater at the edge, and brash ice bobbing in it.
      ctx.strokeStyle = 'rgba(160, 225, 240, 0.22)';
      ctx.lineWidth = 48;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(205, 242, 252, 0.26)';
      ctx.lineWidth = 18;
      ctx.stroke(path);
      ctx.fillStyle = 'rgba(240, 250, 255, 0.85)';
      ctx.beginPath();
      for (const p of shore(isl, 3)) {
        if (p.h < 0.4) continue;
        const d = 12 + p.h * 22 + Math.sin(time * 0.8 + p.i) * 1.5;
        const x = p.x + p.nx * d;
        const y = p.y + p.ny * d;
        const s = 1.6 + p.h * 3;
        const a = p.h * 9;
        ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        for (let j = 1; j < 5; j++) {
          const k = s * (0.6 + hash(p.i + j) * 0.5);
          ctx.lineTo(x + Math.cos(a + j * 1.26) * k, y + Math.sin(a + j * 1.26) * k);
        }
        ctx.closePath();
      }
      ctx.fill();
      return true;
    }
    case 'blocks':
    case 'sandcastle': {
      // Bathwater: bright, with a ring of soap foam and bubbles.
      ctx.strokeStyle = 'rgba(190, 250, 245, 0.26)';
      ctx.lineWidth = 46;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(240, 255, 255, 0.3)';
      ctx.lineWidth = 16;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of shore(isl, 2)) {
        if (p.h < 0.45) continue;
        const d = 10 + p.h * 20 + Math.sin(time * 1.2 + p.i) * 2;
        dot(ctx, p.x + p.nx * d, p.y + p.ny * d, 1.2 + p.h * 2.4);
      }
      ctx.stroke();
      return true;
    }
    case 'cloud':
    case 'floater': {
      // Mist round the edge; a floating isle also throws its shadow far below.
      if (isl.kind === 'floater') {
        ctx.save();
        ctx.translate(34, 46);
        ctx.fillStyle = 'rgba(20, 50, 90, 0.16)';
        ctx.fill(path);
        ctx.restore();
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.16 + 0.04 * Math.sin(time * 0.7 + isl.seed)).toFixed(3)})`;
      ctx.lineWidth = 52;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 20;
      ctx.stroke(path);
      return true;
    }
    default:
      return false;
  }
}

// --- Islands -----------------------------------------------------------------

export function drawDreamIsland(ctx, isl, path, decor, time) {
  switch (isl.kind) {
    case 'glacier':
      drawGlacier(ctx, isl, path, time);
      return true;
    case 'tundra':
      drawTundra(ctx, isl, path, time);
      return true;
    case 'blocks':
      drawBlocks(ctx, isl, path, time);
      return true;
    case 'sandcastle':
      drawSandcastle(ctx, isl, path, time);
      return true;
    case 'cloud':
      drawCloudBank(ctx, isl, path, time);
      return true;
    case 'floater':
      drawFloater(ctx, isl, path, time);
      return true;
    default:
      return false;
  }
}

// A glacier: a blue ice cliff, a snowfield with crevasses and meltwater
// pools, seals hauled out on the edge, and on the long ones a polar bear.
function drawGlacier(ctx, isl, path, time) {
  const { a, hl } = axisOf(isl);
  ctx.save();
  raised(ctx, path, '#5d9ec0', '#e6f2f8', 1.3);
  ctx.strokeStyle = '#bcdcec';
  ctx.lineWidth = 7;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke(path);
  const spots = fill(isl, 'snow', 30, 0.8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  for (const p of spots) if (p.h > 0.45) oval(ctx, p.x, p.y, 8 + p.h * 8, 4 + p.h * 3, a + 0.3);
  ctx.fill();
  // Crevasses run across the way the ice flows.
  const ca = Math.cos(a + Math.PI / 2);
  const sa = Math.sin(a + Math.PI / 2);
  ctx.strokeStyle = 'rgba(70, 140, 180, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const p of spots) {
    if (p.h > 0.3) continue;
    const l = 6 + p.h * 20;
    ctx.moveTo(p.x - ca * l, p.y - sa * l);
    ctx.lineTo(p.x + Math.cos(a) * 2.5, p.y + Math.sin(a) * 2.5);
    ctx.lineTo(p.x + ca * l, p.y + sa * l);
  }
  ctx.stroke();
  ctx.fillStyle = '#4fb2da';
  ctx.beginPath();
  for (const p of spots) if (p.h > 0.86) oval(ctx, p.x + 6, p.y - 4, 4 + (p.h - 0.86) * 50, 3, a);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  for (const p of spots) if (p.h > 0.86) oval(ctx, p.x + 4, p.y - 5, 1.6 + (p.h - 0.86) * 12, 0.9, a);
  ctx.fill();
  ctx.restore();
  // Seals hauled out at the edge, up on the ice.
  const seals = shore(isl, 9).filter((p) => p.h > 0.62).slice(0, 3);
  for (const p of seals) {
    const along = Math.atan2(p.ny, p.nx) + (p.h > 0.8 ? 1 : -1) * (Math.PI / 2);
    drawSeal(ctx, p.x - p.nx * 9 - 3.2, p.y - p.ny * 9 - 4.5, along, time + p.h * 9);
  }
  // A polar bear plods up and down the long way.
  if (hl > 70) {
    const u = time * 0.05 + isl.seed;
    const x = isl.cx + Math.cos(a) * hl * 0.45 * Math.sin(u) - 3.2;
    const y = isl.cy + Math.sin(a) * hl * 0.45 * Math.sin(u) - 4.5;
    drawBear(ctx, x, y, Math.cos(u) >= 0 ? a : a + Math.PI, time);
  }
}

// A seal lying on the ice: a grey slug of a body, flippers, a whiskery face
// it lifts now and then.
function drawSeal(ctx, x, y, heading, time) {
  const look = Math.sin(time * 0.7) > 0.8 ? 1.4 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = 'rgba(40, 80, 110, 0.25)';
  ctx.beginPath();
  ctx.ellipse(1.2, 1.6, 7.5, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5f6872';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-9.6, -2.6);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-9.6, 2.6);
  ctx.closePath();
  oval(ctx, 1.6, -2.9, 2, 0.9, -0.5);
  oval(ctx, 1.6, 2.9, 2, 0.9, 0.5);
  ctx.fill();
  ctx.fillStyle = '#76808a';
  ctx.beginPath();
  ctx.ellipse(-0.5, 0, 6.6, 2.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a949e';
  ctx.beginPath();
  ctx.ellipse(5 + look, 0, 2.5, 2.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(50, 56, 64, 0.5)';
  ctx.beginPath();
  dot(ctx, -2, -1, 0.6);
  dot(ctx, 0.5, 1.2, 0.5);
  dot(ctx, -4, 0.6, 0.5);
  ctx.fill();
  ctx.fillStyle = '#14181c';
  ctx.beginPath();
  dot(ctx, 5.9 + look, -0.9, 0.45);
  dot(ctx, 5.9 + look, 0.9, 0.45);
  dot(ctx, 7.3 + look, 0, 0.4);
  ctx.fill();
  ctx.restore();
}

// A polar bear from above: a cream back, a long neck and a small head,
// paws stepping.
function drawBear(ctx, x, y, heading, time) {
  const step = Math.sin(time * 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = 'rgba(40, 90, 120, 0.25)';
  ctx.beginPath();
  ctx.ellipse(1.5, 2, 10, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ddd2b8';
  ctx.beginPath();
  oval(ctx, 4 + step * 1.5, -3.8, 1.8, 1.3);
  oval(ctx, 4 - step * 1.5, 3.8, 1.8, 1.3);
  oval(ctx, -4.5 - step * 1.5, -3.6, 1.8, 1.3);
  oval(ctx, -4.5 + step * 1.5, 3.6, 1.8, 1.3);
  dot(ctx, -8.4, 0, 1);
  ctx.fill();
  ctx.fillStyle = '#f4efe0';
  ctx.beginPath();
  oval(ctx, -1, 0, 7.5, 4.2);
  oval(ctx, 5.6, 0, 3.4, 2.5);
  oval(ctx, 9, 0, 2.5, 2);
  ctx.fill();
  ctx.fillStyle = '#ddd2b8';
  ctx.beginPath();
  dot(ctx, 8.2, -1.8, 0.8);
  dot(ctx, 8.2, 1.8, 0.8);
  ctx.fill();
  ctx.fillStyle = '#14181c';
  ctx.beginPath();
  dot(ctx, 11.3, 0, 0.65);
  dot(ctx, 9.8, -0.8, 0.35);
  dot(ctx, 9.8, 0.8, 0.35);
  ctx.fill();
  ctx.restore();
}

// Where the igloo and the stone cairn stand on a tundra isle.
function tundraCamp(isl) {
  const c = store(isl);
  if (c.camp) return c.camp;
  const pts = fill(isl, 'tundra', 16, 0.85);
  const from = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = { x: isl.cx, y: isl.cy };
  let best = mid;
  for (const p of pts) if (from(p, mid) < from(best, mid) || best === mid) best = p;
  let cairn = null;
  for (const p of pts) if (from(p, best) > 26 && (!cairn || p.h > cairn.h)) cairn = p;
  c.camp = {
    igloo: { x: best.x - 2, y: best.y - 3, door: hash(isl.seed) * TAU },
    cairn: cairn ? { x: cairn.x - 2, y: cairn.y - 3 } : null,
  };
  return c.camp;
}

// Tundra: brown rock with snow in the hollows, moss and berries, an igloo
// with a lamp lit inside, a stone inukshuk, and reindeer grazing.
function drawTundra(ctx, isl, path, time) {
  const R = isl.radius;
  ctx.save();
  raised(ctx, path, '#4c4a40', '#7e7a6a', 0.8);
  ctx.strokeStyle = 'rgba(200, 196, 180, 0.5)';
  ctx.lineWidth = 5;
  ctx.stroke(path);
  const spots = fill(isl, 'tundra', 16, 0.85);
  ctx.fillStyle = '#6f7d4a';
  ctx.beginPath();
  for (const p of spots) if (p.h < 0.35) oval(ctx, p.x, p.y, 6 + p.h * 10, 4 + p.h * 6, p.h * 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(242, 246, 248, 0.85)';
  ctx.beginPath();
  for (const p of spots) {
    if (p.h <= 0.62) continue;
    // A clump of snow left in a hollow.
    const r = 2 + (p.h - 0.6) * 7;
    for (let j = 0; j < 3; j++) dot(ctx, p.x + Math.cos(p.h * 30 + j * 2.1) * r, p.y + Math.sin(p.h * 30 + j * 2.1) * r * 0.6, r * (1 - j * 0.2));
  }
  ctx.fill();
  ctx.fillStyle = '#c0304a';
  ctx.beginPath();
  for (const p of spots) {
    if (p.h < 0.08 || p.h > 0.16) continue;
    dot(ctx, p.x + 3, p.y, 1.1);
    dot(ctx, p.x + 5, p.y + 1.5, 1.1);
    dot(ctx, p.x + 2.4, p.y + 2.4, 1.1);
  }
  ctx.fill();
  ctx.restore();
  const camp = tundraCamp(isl);
  if (camp.cairn) drawInukshuk(ctx, camp.cairn.x, camp.cairn.y, hash(isl.seed + 2) * TAU);
  drawIgloo(ctx, camp.igloo.x, camp.igloo.y, clamp(R * 0.16, 6, 10), camp.igloo.door);
  // Reindeer grazing, ambling a step now and then.
  const herd = spots.filter((p) => p.h > 0.4 && p.h < 0.6 && Math.hypot(p.x - camp.igloo.x, p.y - camp.igloo.y) > 18).slice(0, R > 70 ? 3 : 1);
  for (const p of herd) {
    const amble = Math.sin(time * 0.25 + p.i);
    drawReindeer(ctx, p.x + amble * 3 - 2, p.y - 3, p.h * 40 + Math.sin(time * 0.3 + p.i) * 0.5, time + p.i);
  }
}

// An igloo from above: a dome of snow blocks and its entrance tunnel.
function drawIgloo(ctx, x, y, r, door) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30, 50, 70, 0.3)';
  ctx.beginPath();
  dot(ctx, 2.4, 3.2, r * 1.05);
  ctx.fill();
  ctx.save();
  ctx.rotate(door);
  ctx.fillStyle = '#d8e6ee';
  ctx.fillRect(r * 0.5, -r * 0.42, r * 0.95, r * 0.84);
  ctx.fillStyle = '#2a3440';
  ctx.fillRect(r * 1.35, -r * 0.26, r * 0.12, r * 0.52);
  ctx.restore();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#bcd2e0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110, 145, 170, 0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  dot(ctx, 0, 0, r * 0.68);
  dot(ctx, 0, 0, r * 0.36);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU + (i % 2) * 0.26;
    const [r0, r1] = i % 2 ? [r * 0.36, r * 0.68] : [r * 0.68, r];
    ctx.moveTo(Math.cos(t) * r0, Math.sin(t) * r0);
    ctx.lineTo(Math.cos(t) * r1, Math.sin(t) * r1);
  }
  ctx.stroke();
  ctx.restore();
}

// An inukshuk: stones stacked into a figure with its arms out.
function drawInukshuk(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(30, 30, 24, 0.35)';
  ctx.fillRect(-5, -1, 16, 5);
  ctx.fillStyle = '#7c786c';
  ctx.fillRect(-3.4, -3.4, 2.6, 2.4);
  ctx.fillRect(-3.4, 1, 2.6, 2.4);
  ctx.fillStyle = '#9a9588';
  ctx.fillRect(-1.2, -6.5, 3.2, 13);
  ctx.fillStyle = '#b2ad9f';
  ctx.fillRect(-0.8, -2, 3.6, 4);
  ctx.fillStyle = '#c4bfb0';
  ctx.fillRect(0.2, -1.2, 2.2, 2.4);
  ctx.restore();
}

// A reindeer grazing: a brown back with a pale rump, its head down, antlers.
function drawReindeer(ctx, x, y, heading, time) {
  const chew = Math.sin(time * 3) * 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = 'rgba(30, 30, 20, 0.3)';
  ctx.beginPath();
  ctx.ellipse(1.4, 1.8, 6.5, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a5a3e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8e0cc';
  ctx.beginPath();
  dot(ctx, -4.4, 0, 1.4);
  oval(ctx, 3.4, 0, 1.6, 1.8);
  ctx.fill();
  ctx.fillStyle = '#5e432c';
  ctx.beginPath();
  ctx.ellipse(6 + chew, 0, 1.9, 1.3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d2bc94';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(5.4, s * 0.7);
    ctx.quadraticCurveTo(4.6, s * 3.2, 6.6, s * 4.4);
    ctx.moveTo(5, s * 2.2);
    ctx.lineTo(3.4, s * 3.4);
    ctx.moveTo(5.8, s * 3.4);
    ctx.lineTo(7.6, s * 3);
  }
  ctx.stroke();
  ctx.restore();
}

// --- Toy Bay islands -----------------------------------------------------------

// A heap of toy bricks on a green baseplate: studs everywhere, bricks
// stacked in every colour, a flag on top, and a toy sailor waving.
function drawBlocks(ctx, isl, path, time) {
  const { a, hl, hw } = axisOf(isl);
  ctx.save();
  raised(ctx, path, '#2f7d3a', '#4fbf5a', 0.7);
  ctx.translate(isl.cx, isl.cy);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(10, 60, 20, 0.35)';
  ctx.beginPath();
  for (let x = -hl; x <= hl; x += 9) for (let y = -hw; y <= hw; y += 9) dot(ctx, x + 0.7, y + 0.9, 2.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170, 240, 170, 0.6)';
  ctx.beginPath();
  for (let x = -hl; x <= hl; x += 9) for (let y = -hw; y <= hw; y += 9) dot(ctx, x - 0.5, y - 0.6, 1);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.clip(path);
  const bricks = fill(isl, 'bricks', 22, 0.74);
  let top = null;
  for (const p of bricks) {
    if (p.h < 0.25) continue;
    const c = p.i % TOY.length;
    const turn = a + (p.h > 0.62 ? Math.PI / 2 : 0);
    drawToyBrick(ctx, p.x, p.y, turn, 8, 4, TOY[c], TOY_SIDE[c], 1);
    // Some are stacked two high.
    if (p.h > 0.8) {
      const d = (p.i + 2) % TOY.length;
      drawToyBrick(ctx, p.x - 3, p.y - 4, turn + Math.PI / 2, 6, 4, TOY[d], TOY_SIDE[d], 1.8);
      if (!top || p.h > top.h) top = p;
    }
  }
  ctx.restore();
  // A flag on the tallest stack.
  if (top) {
    const x = top.x - 6;
    const y = top.y - 10;
    const flap = Math.sin(time * 4 + isl.seed);
    ctx.strokeStyle = '#f4f4f4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 7);
    ctx.stroke();
    ctx.fillStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 7);
    ctx.lineTo(x + 6 + flap, y - 6 + flap * 0.5);
    ctx.lineTo(x - 1.4, y - 3.6);
    ctx.closePath();
    ctx.fill();
  }
  // A toy sailor with a yellow face stands on the plate and waves.
  const spot = bricks.find((p) => p.h < 0.25);
  if (spot) drawPerson(ctx, spot.x - 1, spot.y - 2, 1, TOY[spot.i % 2 ? 0 : 1], Math.sin(time * 5 + isl.seed), '#f5c518');
}

// A toy brick: a darker side, the top, and its studs. `w` and `h` are half
// its length and width; `lift` is how tall it stands.
function drawToyBrick(ctx, x, y, rot, w, h, color, side, lift) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0, 30, 10, 0.3)';
  ctx.fillRect(-w + 1.2 * lift, -h + 1.8 * lift, w * 2, h * 2);
  ctx.restore();
  ctx.save();
  ctx.translate(x - 1.4 * lift, y - 2 * lift);
  ctx.rotate(rot);
  ctx.fillStyle = side;
  ctx.fillRect(-w + 1.4, -h + 1.8, w * 2, h * 2);
  ctx.fillStyle = color;
  ctx.fillRect(-w, -h, w * 2, h * 2);
  const n = Math.max(1, Math.round(w / 4));
  const m = Math.max(1, Math.round(h / 4));
  ctx.fillStyle = side;
  ctx.beginPath();
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) dot(ctx, -w + (i + 0.5) * ((w * 2) / n) + 0.5, -h + (j + 0.5) * ((h * 2) / m) + 0.7, 1.4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) dot(ctx, -w + (i + 0.5) * ((w * 2) / n), -h + (j + 0.5) * ((h * 2) / m), 1.4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) dot(ctx, -w + (i + 0.5) * ((w * 2) / n) - 0.5, -h + (j + 0.5) * ((h * 2) / m) - 0.5, 0.5);
  ctx.fill();
  ctx.restore();
}

// A sandcastle: damp sand, a moat, a wall with four towers flying pennants,
// a keep in the middle, and a bucket and spade left on the beach.
function drawSandcastle(ctx, isl, path, time) {
  const { a, hl, hw } = axisOf(isl);
  const sand = fill(isl, 'sand', 18, 0.85);
  ctx.save();
  raised(ctx, path, '#b8955a', '#ecd9a0', 0.6);
  ctx.strokeStyle = '#d6b87c';
  ctx.lineWidth = 8;
  ctx.stroke(path);
  ctx.strokeStyle = 'rgba(160, 128, 80, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const p of sand) {
    if (p.h > 0.3) continue;
    ctx.moveTo(p.x - 5, p.y);
    ctx.quadraticCurveTo(p.x, p.y - 2, p.x + 5, p.y);
  }
  ctx.stroke();
  ctx.fillStyle = '#f6d0c4';
  ctx.beginPath();
  for (const p of sand) if (p.h > 0.93) oval(ctx, p.x, p.y, 2.4, 1.8, p.h * 9);
  ctx.fill();
  ctx.restore();
  const s = clamp(Math.min(hl, hw) * 0.5, 12, 44);
  ctx.save();
  ctx.translate(isl.cx - 1.5, isl.cy - 2);
  ctx.rotate(a);
  // The moat, with the sea let in.
  ctx.strokeStyle = '#c9a868';
  ctx.lineWidth = s * 0.26;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.2, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#6fd0dc';
  ctx.lineWidth = s * 0.17;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.25 + 0.15 * Math.sin(time * 1.5 + isl.seed)).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = -time * 6;
  ctx.stroke();
  ctx.setLineDash([]);
  // The wall, its crenels, and the courtyard.
  const w = s * 0.75;
  ctx.fillStyle = '#a8864e';
  ctx.fillRect(-w + 2, -w + 3, w * 2, w * 2);
  ctx.fillStyle = '#e2c88c';
  ctx.fillRect(-w, -w, w * 2, w * 2);
  ctx.fillStyle = '#cdb078';
  ctx.fillRect(-w * 0.72, -w * 0.72, w * 1.44, w * 1.44);
  ctx.fillStyle = '#f2deae';
  ctx.beginPath();
  const step = w / 3;
  for (let i = 0; i < 6; i += 2) {
    for (const [x, y, ww, hh] of [
      [-w + i * step, -w, step, s * 0.1],
      [-w + i * step, w - s * 0.1, step, s * 0.1],
      [-w, -w + i * step, s * 0.1, step],
      [w - s * 0.1, -w + i * step, s * 0.1, step],
    ])
      ctx.rect(x, y, ww, hh);
  }
  ctx.fill();
  // The keep.
  const k = s * 0.3;
  ctx.fillStyle = '#a8864e';
  ctx.fillRect(-k + 2, -k + 3, k * 2, k * 2);
  ctx.fillStyle = '#ecd29a';
  ctx.fillRect(-k - 1, -k - 1.5, k * 2, k * 2);
  ctx.fillStyle = '#f8e6bc';
  ctx.fillRect(-k * 0.5 - 1, -k * 0.5 - 1.5, k, k);
  // Towers at the corners, with pennants.
  const tr = s * 0.28;
  [
    [-w, -w],
    [w, -w],
    [w, w],
    [-w, w],
  ].forEach(([x, y], i) => {
    ctx.fillStyle = '#a8864e';
    ctx.beginPath();
    dot(ctx, x + 2, y + 3, tr);
    ctx.fill();
    ctx.fillStyle = '#e8cf96';
    ctx.beginPath();
    dot(ctx, x - 1, y - 1.5, tr);
    ctx.fill();
    ctx.fillStyle = '#c9a868';
    ctx.beginPath();
    dot(ctx, x - 1, y - 1.5, tr * 0.55);
    ctx.fill();
    ctx.fillStyle = '#f6e4b8';
    ctx.beginPath();
    for (let j = 0; j < 8; j++) {
      const t = (j / 8) * TAU;
      dot(ctx, x - 1 + Math.cos(t) * tr * 0.8, y - 1.5 + Math.sin(t) * tr * 0.8, tr * 0.18);
    }
    ctx.fill();
    if (i % 2 === 0) {
      const flap = Math.sin(time * 5 + i + isl.seed);
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 1, y - 1.5);
      ctx.lineTo(x - 3, y - 9);
      ctx.stroke();
      ctx.fillStyle = i ? '#3b8fe0' : '#e5484d';
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 9);
      ctx.lineTo(x + 5 + flap, y - 8 + flap * 0.6);
      ctx.lineTo(x - 2.4, y - 5.6);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.restore();
  // A bucket and spade, on the far side of the beach.
  let far = null;
  for (const p of sand) {
    const d = Math.hypot(p.x - isl.cx, p.y - isl.cy);
    if (d > s * 1.6 && (!far || p.h > far.h)) far = p;
  }
  if (far) drawBucket(ctx, far.x - 1, far.y - 1.5, far.h * TAU);
}

function drawBucket(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(80, 60, 30, 0.3)';
  ctx.beginPath();
  dot(ctx, 1.5, 2, 5.4);
  ctx.fill();
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  dot(ctx, 0, 0, 5.2);
  ctx.fill();
  ctx.fillStyle = '#a83236';
  ctx.beginPath();
  dot(ctx, 0, 0, 3.8);
  ctx.fill();
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, -1.2, 1.2);
  ctx.stroke();
  ctx.fillStyle = '#3b8fe0';
  ctx.beginPath();
  oval(ctx, 11, 2, 3, 2.2, 0.3);
  ctx.fill();
  ctx.strokeStyle = '#2a6fb8';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8.5, 1.2);
  ctx.lineTo(2.5, -2);
  ctx.stroke();
  ctx.restore();
}

// --- Sky Sea islands -----------------------------------------------------------

// A cloud bank: soft heaps of cloud, grey underneath and sunlit on top, with
// a rainbow over the big ones and a gull wheeling.
function drawCloudBank(ctx, isl, path, time) {
  const R = isl.radius;
  const rim = shore(isl, 2);
  const inner = fill(isl, 'puffs', 22, 0.8);
  const heap = (dx, dy, k, color) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.beginPath();
    for (const p of rim) {
      const r = (8 + p.h * 9) * k * (1 + 0.05 * Math.sin(time * 0.8 + p.i));
      dot(ctx, p.x - p.nx * r * 0.7, p.y - p.ny * r * 0.7, r);
    }
    for (const p of inner) dot(ctx, p.x, p.y, (13 + p.h * 9) * k * (1 + 0.04 * Math.sin(time * 0.6 + p.i)));
    ctx.fill();
    ctx.restore();
  };
  heap(3, 5, 1, '#a9c2da');
  heap(0, 0, 1, '#d0deec');
  // Sunlit tops on each puff, up and to the left, so the crevices between
  // them stay in shade.
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const p of rim) {
    const r = (8 + p.h * 9) * (1 + 0.05 * Math.sin(time * 0.8 + p.i));
    dot(ctx, p.x - p.nx * r * 0.7 - r * 0.12, p.y - p.ny * r * 0.7 - r * 0.16, r * 0.86);
  }
  for (const p of inner) {
    const r = (13 + p.h * 9) * (1 + 0.04 * Math.sin(time * 0.6 + p.i));
    dot(ctx, p.x - r * 0.12, p.y - r * 0.16, r * 0.86);
  }
  ctx.fill();
  ctx.restore();
  if (R > 90) {
    const bands = ['255, 80, 80', '255, 160, 60', '255, 230, 80', '90, 210, 120', '80, 150, 255', '150, 100, 240'];
    ctx.lineWidth = 3.2;
    bands.forEach((rgb, i) => {
      ctx.strokeStyle = `rgba(${rgb}, 0.32)`;
      ctx.beginPath();
      ctx.arc(isl.cx, isl.cy + R * 0.35, R * 0.75 - i * 3.2, Math.PI + 0.35, TAU - 0.35);
      ctx.stroke();
    });
  }
  const g = time * 0.3 + isl.seed;
  drawFlyer(ctx, isl.cx + Math.cos(g) * R * 0.6, isl.cy + Math.sin(g) * R * 0.5, g + Math.PI / 2, 6, time * 7, '#ffffff', '#d8e4ee');
}

// Where the cottage and the waterfall are on a floating isle.
function floaterSpots(isl) {
  const c = store(isl);
  if (c.spots) return c.spots;
  const pts = fill(isl, 'meadow', 16, 0.8);
  const mid = { x: isl.cx, y: isl.cy };
  let house = mid;
  for (const p of pts) if (house === mid || Math.hypot(p.x - mid.x, p.y - mid.y) < Math.hypot(house.x - mid.x, house.y - mid.y)) house = p;
  let fall = null;
  for (const p of shore(isl, 1)) {
    const face = p.nx * 0.6 + p.ny * 0.8;
    if (!fall || face > fall.face) fall = { ...p, face };
  }
  c.spots = { house: { x: house.x - 3, y: house.y - 4 }, fall, pts };
  return c.spots;
}

// A floating isle: rock hanging under it, grass on top, trees, a cottage
// with smoke from the chimney, sheep, and a waterfall pouring off the edge.
function drawFloater(ctx, isl, path, time) {
  const R = isl.radius;
  const { house, fall, pts } = floaterSpots(isl);
  // The rock underneath shows below the edge.
  ctx.save();
  ctx.translate(9, 13);
  ctx.fillStyle = '#4a3828';
  ctx.fill(path);
  ctx.restore();
  ctx.fillStyle = '#4a3828';
  ctx.beginPath();
  for (const p of shore(isl, 3)) {
    const face = p.nx * 0.6 + p.ny * 0.8;
    if (face < 0.2) continue;
    const l = 6 + p.h * 14 * face;
    const x = p.x + 9;
    const y = p.y + 13;
    ctx.moveTo(x - p.ny * 5, y + p.nx * 5);
    ctx.lineTo(x + p.nx * l * 0.5 + 5, y + p.ny * l * 0.5 + 8);
    ctx.lineTo(x + p.ny * 5, y - p.nx * 5);
    ctx.closePath();
  }
  ctx.fill();
  ctx.save();
  ctx.translate(4.5, 6.5);
  ctx.fillStyle = '#6a5440';
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#6f9a44';
  ctx.fill(path);
  ctx.clip(path);
  ctx.strokeStyle = '#4f7a30';
  ctx.lineWidth = 5;
  ctx.stroke(path);
  ctx.fillStyle = '#86b052';
  ctx.beginPath();
  for (const p of pts) if (p.h > 0.7) oval(ctx, p.x, p.y, 7 + p.h * 5, 4 + p.h * 3, p.h * 7);
  ctx.fill();
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  for (const p of pts) if (p.h > 0.3 && p.h < 0.36) for (let j = 0; j < 4; j++) dot(ctx, p.x + Math.cos(j * 1.6 + p.h * 40) * 4, p.y + Math.sin(j * 1.6 + p.h * 40) * 4, 0.9);
  ctx.fill();
  // A stream down to the falls.
  if (fall) {
    ctx.strokeStyle = '#7fd0f0';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(house.x + 4, house.y + 6);
    ctx.quadraticCurveTo((house.x + fall.x) / 2 + 8, (house.y + fall.y) / 2 - 6, fall.x, fall.y);
    ctx.stroke();
  }
  ctx.restore();
  // The falls spill over the edge and fade into the sky.
  if (fall) {
    ctx.save();
    ctx.translate(fall.x, fall.y);
    ctx.rotate(Math.atan2(fall.ny + 0.6, fall.nx + 0.4));
    const g = ctx.createLinearGradient(0, 0, 46, 0);
    g.addColorStop(0, 'rgba(225, 245, 255, 0.8)');
    g.addColorStop(1, 'rgba(225, 245, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -3.6);
    ctx.lineTo(46, -6.5);
    ctx.lineTo(46, 6.5);
    ctx.lineTo(0, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    for (const o of [-2.4, -0.8, 0.8, 2.4]) {
      ctx.moveTo(0, o);
      ctx.lineTo(46, o * 1.8);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const mist = ctx.createRadialGradient(42, 0, 0, 42, 0, 11);
    mist.addColorStop(0, `rgba(255, 255, 255, ${(0.3 + 0.1 * Math.sin(time * 3)).toFixed(3)})`);
    mist.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = mist;
    ctx.beginPath();
    dot(ctx, 42, 0, 11);
    ctx.fill();
    ctx.restore();
  }
  // Trees, clear of the cottage.
  const trees = pts.filter((p) => p.h < 0.3 && Math.hypot(p.x - house.x, p.y - house.y) > 16);
  ctx.fillStyle = 'rgba(20, 40, 10, 0.35)';
  ctx.beginPath();
  for (const p of trees) dot(ctx, p.x + 2.5, p.y + 3.5, 6 + p.h * 8);
  ctx.fill();
  ctx.fillStyle = '#3f7a2c';
  ctx.beginPath();
  for (const p of trees) dot(ctx, p.x + Math.sin(time * 1.2 + p.x * 0.05) * 0.5, p.y, 6 + p.h * 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(170, 220, 110, 0.4)';
  ctx.beginPath();
  for (const p of trees) dot(ctx, p.x - 2, p.y - 2.4, (6 + p.h * 8) * 0.45);
  ctx.fill();
  // Sheep.
  for (const p of pts) {
    if (p.h < 0.5 || p.h > 0.58 || Math.hypot(p.x - house.x, p.y - house.y) < 14) continue;
    const x = p.x + Math.sin(time * 0.2 + p.i) * 2;
    ctx.fillStyle = 'rgba(20, 40, 10, 0.3)';
    ctx.beginPath();
    dot(ctx, x + 1, p.y + 1.4, 2.6);
    ctx.fill();
    ctx.fillStyle = '#f8f6ee';
    ctx.beginPath();
    dot(ctx, x, p.y, 2.5);
    ctx.fill();
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    dot(ctx, x + 2.4, p.y - 0.4, 1);
    ctx.fill();
  }
  drawCottage(ctx, house.x, house.y, hash(isl.seed + 4) * 0.8 - 0.4, time, R > 70 ? 1.2 : 1);
}

// A cottage from above: a red roof with its ridge, a chimney and its smoke.
function drawCottage(ctx, x, y, rot, time, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(20, 40, 10, 0.35)';
  ctx.fillRect(-6, -3.5, 14, 10);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-8, -5.5, 14, 5.5);
  ctx.fillStyle = '#962a1e';
  ctx.fillRect(-8, 0, 14, 5.5);
  ctx.strokeStyle = '#6e1e14';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(6, 0);
  ctx.stroke();
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(2, -4.6, 2.4, 2.4);
  ctx.restore();
  ctx.fillStyle = 'rgba(240, 240, 240, 0.5)';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.6 + i / 4) % 1;
    dot(ctx, x + 3 * s + t * 10, y - 3.5 * s - t * 9, 1.2 + t * 3);
  }
  ctx.fill();
}

// --- Rocks -------------------------------------------------------------------

export function drawDreamRock(ctx, r, time) {
  switch (r.material) {
    case 'berg':
      drawBergBit(ctx, r);
      return true;
    case 'ball':
      drawBeachBall(ctx, r, time);
      return true;
    case 'brick': {
      const c = Math.floor(hash(r.x * 0.3 + r.y) * TOY.length);
      drawToyBrick(ctx, r.x + 1, r.y + 1.4, hash(r.y + r.x * 0.7) * Math.PI, r.r * 0.85, r.r * 0.85, TOY[c], TOY_SIDE[c], 1);
      return true;
    }
    case 'balloon':
      drawBalloon(ctx, r, time);
      return true;
    case 'puff':
      drawPuff(ctx, r, time);
      return true;
    default:
      return false;
  }
}

// A chunk of ice: a jagged lump, blue at the waterline and white on top.
function drawBergBit(ctx, r) {
  const c = store(r);
  if (!c.path) {
    c.path = new Path2D();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU + hash(r.x + i) * 0.5;
      const d = r.r * (0.82 + hash(r.y + i * 3.3) * 0.3);
      const x = r.x + Math.cos(t) * d;
      const y = r.y + Math.sin(t) * d;
      if (i) c.path.lineTo(x, y);
      else c.path.moveTo(x, y);
    }
    c.path.closePath();
  }
  ctx.save();
  raised(ctx, c.path, '#5ea6cc', '#f0faff', 0.8);
  ctx.strokeStyle = 'rgba(150, 205, 230, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x - r.r * 0.5, r.y - r.r * 0.1);
  ctx.lineTo(r.x - 1, r.y - 2);
  ctx.lineTo(r.x + r.r * 0.3, r.y + r.r * 0.4);
  ctx.stroke();
  ctx.restore();
}

// A beach ball turning slowly as it bobs.
function drawBeachBall(ctx, r, time) {
  const R = r.r * (1 + 0.03 * Math.sin(time * 2 + r.x));
  const spin = time * 0.4 + hash(r.x + r.y) * TAU;
  const colors = ['#e5484d', '#ffffff', '#3b8fe0', '#ffffff', '#f5c518', '#ffffff'];
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.fillStyle = 'rgba(0, 40, 60, 0.25)';
  ctx.beginPath();
  dot(ctx, 2, 3, R);
  ctx.fill();
  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, spin + (i / 6) * TAU, spin + ((i + 1) / 6) * TAU);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  g.addColorStop(1, 'rgba(0, 20, 40, 0.25)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.restore();
}

const BALLOONS = [
  ['#f28c28', '#f5c518'],
  ['#e5484d', '#ffffff'],
  ['#3b8fe0', '#f5c518'],
  ['#8b5cf6', '#3ddc97'],
];

// A hot-air balloon from above, swaying, its shadow on the sea far below.
function drawBalloon(ctx, r, time) {
  const R = r.r;
  const sway = Math.sin(time * 0.6 + r.x) * 1.5;
  const colors = BALLOONS[Math.floor(hash(r.x * 0.37 + r.y * 1.91) * BALLOONS.length)];
  ctx.save();
  ctx.fillStyle = 'rgba(20, 50, 90, 0.16)';
  ctx.beginPath();
  dot(ctx, r.x + 16, r.y + 22, R * 0.9);
  ctx.fill();
  ctx.translate(r.x + sway, r.y);
  ctx.rotate(hash(r.y) * TAU);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = colors[i % 2];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, (i / 10) * TAU, ((i + 1) / 10) * TAU);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  g.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  g.addColorStop(1, 'rgba(60, 20, 0, 0.3)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7a4a2a';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// A little cloud puff, breathing.
function drawPuff(ctx, r, time) {
  const R = r.r;
  const b = 1 + 0.05 * Math.sin(time * 0.9 + r.x);
  const lobes = (dx, dy, k, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    dot(ctx, r.x + dx, r.y + dy, R * 0.7 * k * b);
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * TAU + hash(r.x) * 3;
      dot(ctx, r.x + dx + Math.cos(t) * R * 0.5, r.y + dy + Math.sin(t) * R * 0.45, R * 0.5 * k * b);
    }
    ctx.fill();
  };
  lobes(2, 3, 1, 'rgba(150, 180, 210, 0.7)');
  lobes(0, 0, 1, '#eef4fa');
  lobes(-1.2, -1.6, 0.75, '#ffffff');
}

// --- Drifters ----------------------------------------------------------------

export function drawDreamFloe(ctx, f, path, decor, time) {
  switch (f.look) {
    case 'berg':
      drawBerg(ctx, f, path);
      return true;
    case 'duck':
      drawDuck(ctx, f, path, time);
      return true;
    case 'airship':
      drawAirship(ctx, f, path, time);
      return true;
    default:
      return false;
  }
}

// An iceberg: deep blue sides, a white top with facets, and a snow cap.
function drawBerg(ctx, f, path) {
  const lx = -2.5 * 1.8;
  const ly = -3.5 * 1.8;
  raised(ctx, path, '#3f86b0', '#e4f2f8', 1.8);
  ctx.strokeStyle = 'rgba(120, 180, 210, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const p of shore(f, 3)) {
    if (p.h < 0.5) continue;
    ctx.moveTo(f.cx + lx, f.cy + ly);
    ctx.lineTo(p.x + lx, p.y + ly);
  }
  ctx.stroke();
  ctx.save();
  ctx.translate(f.cx + lx, f.cy + ly);
  ctx.scale(0.5, 0.5);
  ctx.translate(-f.cx, -f.cy);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill(path);
  ctx.restore();
}

// A rubber duck the size of a boat: yellow, an orange beak, a painted eye,
// wings, and a tail that flicks up.
function drawDuck(ctx, f, path, time) {
  const { hl, hw } = axisOf(f);
  const a = headOf(f);
  const bob = Math.sin(time * 2 + f.seed) * 0.05;
  const g = ctx.createRadialGradient(f.cx - hl * 0.2, f.cy - hw * 0.35, 2, f.cx, f.cy, Math.max(hl, hw));
  g.addColorStop(0, '#fff2a0');
  g.addColorStop(0.6, '#f7d038');
  g.addColorStop(1, '#d9a816');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.strokeStyle = 'rgba(160, 110, 10, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a + bob);
  ctx.fillStyle = '#f7d038';
  ctx.beginPath();
  ctx.moveTo(-hl * 0.7, -hw * 0.25);
  ctx.quadraticCurveTo(-hl * 1.15, 0, -hl * 0.7, hw * 0.25);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#efc22a';
    ctx.beginPath();
    ctx.ellipse(-hl * 0.15, side * hw * 0.5, hl * 0.38, hw * 0.26, side * 0.18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 130, 10, 0.4)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(-hl * 0.15, side * hw * 0.5, hl * 0.38, hw * 0.26, side * 0.18, side > 0 ? 0.15 : Math.PI + 0.15, side > 0 ? Math.PI - 0.15 : TAU - 0.15);
    ctx.stroke();
  }
  const hr = hw * 0.62;
  const hx = hl * 0.45;
  ctx.fillStyle = 'rgba(150, 100, 0, 0.3)';
  ctx.beginPath();
  dot(ctx, hx + 1.5, 2, hr);
  ctx.fill();
  const hg = ctx.createRadialGradient(hx - hr * 0.3, -hr * 0.35, 1, hx, 0, hr);
  hg.addColorStop(0, '#fff6b0');
  hg.addColorStop(1, '#f2c62a');
  ctx.fillStyle = hg;
  ctx.beginPath();
  dot(ctx, hx, 0, hr);
  ctx.fill();
  ctx.fillStyle = '#f28c28';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.05, 0, hr * 0.5, hr * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 70, 10, 0.6)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.62, 0);
  ctx.lineTo(hx + hr * 1.5, 0);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    oval(ctx, hx + hr * 0.3, side * hr * 0.5, hr * 0.26, hr * 0.2);
    ctx.fill();
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    dot(ctx, hx + hr * 0.36, side * hr * 0.5, hr * 0.12);
    ctx.fill();
  }
}

// An airship cruising low: its shadow on the sea, tail fins, a silver
// envelope with a red band, propellers and blinking lights.
function drawAirship(ctx, f, path, time) {
  const { hl, hw } = axisOf(f);
  const a = headOf(f);
  ctx.save();
  ctx.save();
  ctx.translate(26, 38);
  ctx.fillStyle = 'rgba(20, 50, 90, 0.14)';
  ctx.fill(path);
  ctx.restore();
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  const L = hl * 0.98;
  const W = hw * 0.92;
  // Tail fins and the propellers on their struts.
  ctx.fillStyle = '#b0352a';
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(-L * 0.6, s * W * 0.5);
    ctx.lineTo(-L * 1.02, s * W * 1.25);
    ctx.lineTo(-L * 1.04, s * W * 0.25);
    ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = '#4a4e56';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(-L * 0.2, s * W * 0.9);
    ctx.lineTo(-L * 0.2, s * W * 1.2);
  }
  ctx.stroke();
  const spin = time * 30;
  ctx.fillStyle = 'rgba(60, 64, 72, 0.35)';
  ctx.beginPath();
  for (const s of [-1, 1]) oval(ctx, -L * 0.28, s * W * 1.22, 1.4, W * 0.3 * (0.6 + 0.4 * Math.abs(Math.sin(spin))));
  ctx.fill();
  // The envelope fills the airship's own outline, lit from the top left
  // whichever way it is heading.
  ctx.rotate(-a);
  ctx.translate(-f.cx, -f.cy);
  const d = hw * 0.8;
  const g = ctx.createLinearGradient(f.cx - d, f.cy - d, f.cx + d, f.cy + d);
  g.addColorStop(0, '#f2f4f8');
  g.addColorStop(0.45, '#d6dae2');
  g.addColorStop(1, '#8a909c');
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.translate(f.cx, f.cy);
  ctx.rotate(a);
  ctx.strokeStyle = 'rgba(90, 96, 110, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = -L * 0.8; x < L * 0.85; x += L * 0.16) {
    const h = W * Math.sqrt(Math.max(0, 1 - (x / L) ** 2));
    ctx.moveTo(x, -h);
    ctx.quadraticCurveTo(x + 4, 0, x, h);
  }
  ctx.moveTo(-L, 0);
  ctx.lineTo(L, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(192, 57, 43, 0.85)';
  ctx.fillRect(L * 0.38, -W, L * 0.1, W * 2);
  ctx.fillRect(L * 0.52, -W, L * 0.04, W * 2);
  ctx.restore();
  const blink = Math.sin(time * 3 + f.seed) > 0.4;
  ctx.fillStyle = blink ? '#ff4a4a' : 'rgba(255, 74, 74, 0.35)';
  ctx.beginPath();
  dot(ctx, 0, -W * 0.98, 1.8);
  ctx.fill();
  ctx.fillStyle = blink ? '#4aff8a' : 'rgba(74, 255, 138, 0.35)';
  ctx.beginPath();
  dot(ctx, 0, W * 0.98, 1.8);
  ctx.fill();
  ctx.fillStyle = blink ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  dot(ctx, -L * 1.03, 0, 1.6);
  ctx.fill();
  ctx.restore();
}

// --- Lairs -----------------------------------------------------------------------

// Already translated to the lair's centre.
export function drawDreamLair(ctx, k, time) {
  switch (k.look) {
    case 'orca':
      drawOrca(ctx, k, time);
      return true;
    case 'jack':
      drawJack(ctx, k, time);
      return true;
    case 'storm':
      drawThunder(ctx, k, time);
      return true;
    default:
      return false;
  }
}

// An orca: a tall black fin cutting circles, then faster and closer, then
// it breaches.
function drawOrca(ctx, k, time) {
  const R = k.r;
  const fin = (x, y, heading, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16 * s, -7 * s);
    ctx.lineTo(3 * s, 0);
    ctx.lineTo(-16 * s, 7 * s);
    ctx.stroke();
    ctx.fillStyle = 'rgba(4, 10, 20, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-5 * s, 0, 15 * s, 4.5 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0e1216';
    ctx.beginPath();
    ctx.moveTo(3 * s, 0.6 * s);
    ctx.quadraticCurveTo(-1 * s, -2 * s, -9 * s, -7 * s);
    ctx.quadraticCurveTo(-5 * s, -2 * s, -5 * s, 1.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  if (k.phase === 'idle') {
    const a = time * 0.35 + k.x;
    fin(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45, a + Math.PI / 2, 1);
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '6, 14, 30', '60, 120, 170');
    dangerRing(ctx, k, time, t);
    const a = time * (0.35 + t * 1.8) + k.x;
    const r = R * 0.45 * (1 - t * 0.55);
    fin(Math.cos(a) * r, Math.sin(a) * r, a + Math.PI / 2, 1 + t * 0.4);
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const rise = Math.sin(t * Math.PI);
  splash(ctx, R, t);
  ctx.save();
  ctx.rotate(hash(k.x + k.y) * TAU);
  ctx.fillStyle = `rgba(4, 10, 20, ${(0.3 * rise).toFixed(3)})`;
  ctx.beginPath();
  oval(ctx, 8 * rise, 12 * rise, R * 0.42, R * 0.16);
  ctx.fill();
  ctx.scale(0.6 + rise * 0.55, 0.6 + rise * 0.55);
  const L = R * 0.42;
  const W = R * 0.14;
  ctx.fillStyle = '#0e1216';
  ctx.beginPath();
  ctx.moveTo(-L * 0.85, 0);
  ctx.lineTo(-L * 1.25, -W * 1.2);
  ctx.quadraticCurveTo(-L * 1.1, 0, -L * 1.25, W * 1.2);
  ctx.closePath();
  for (const s of [-1, 1]) oval(ctx, L * 0.25, s * W * 1.2, W * 0.9, W * 0.45, s * 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, L, W, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4f7f8';
  ctx.beginPath();
  for (const s of [-1, 1]) oval(ctx, L * 0.55, s * W * 0.55, W * 0.45, W * 0.22, s * 0.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190, 200, 210, 0.7)';
  ctx.beginPath();
  oval(ctx, -L * 0.25, 0, W * 0.8, W * 0.5);
  ctx.fill();
  ctx.fillStyle = '#1c2228';
  ctx.beginPath();
  ctx.moveTo(L * 0.05, 0);
  ctx.lineTo(-L * 0.3, -W * 0.25);
  ctx.lineTo(-L * 0.3, W * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A jack-in-the-box bobbing on the waves: the crank turns, the box shakes,
// then the lid flies open and out springs the clown.
function drawJack(ctx, k, time) {
  const R = k.r;
  const tilt = hash(k.x + k.y) * 0.8;
  const box = (s, shake, crank, lid) => {
    const h = R * 0.18 * s;
    ctx.save();
    ctx.rotate(tilt + Math.sin(time * 40) * shake * 0.1);
    ctx.fillStyle = 'rgba(0, 30, 50, 0.3)';
    ctx.fillRect(-h + 3, -h + 4, h * 2, h * 2);
    ctx.fillStyle = '#a83236';
    ctx.fillRect(-h + 1.5, -h + 2, h * 2, h * 2);
    if (lid > 0) {
      ctx.fillStyle = '#3a1410';
      ctx.fillRect(-h, -h, h * 2, h * 2);
      ctx.fillStyle = lid > 0.5 ? '#f29a8c' : '#e5484d';
      ctx.fillRect(-h - h * 2 * Math.sin(lid * Math.PI * 0.5), -h, h * 2 * Math.abs(Math.cos(lid * Math.PI)), h * 2);
    } else {
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(-h, -h, h * 2, h * 2);
      ctx.strokeStyle = '#3b8fe0';
      ctx.lineWidth = h * 0.14;
      ctx.strokeRect(-h * 0.92, -h * 0.92, h * 1.84, h * 1.84);
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const t = (i / 5) * TAU - Math.PI / 2;
        const u = t + TAU / 10;
        ctx.lineTo(Math.cos(t) * h * 0.6, Math.sin(t) * h * 0.6);
        ctx.lineTo(Math.cos(u) * h * 0.26, Math.sin(u) * h * 0.26);
      }
      ctx.closePath();
      ctx.fill();
    }
    // The crank on the side.
    const c = time * crank;
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = h * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(h, 0);
    ctx.lineTo(h * 1.35, 0);
    ctx.lineTo(h * 1.35 + Math.cos(c) * h * 0.35, Math.sin(c) * h * 0.35);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    dot(ctx, h * 1.35 + Math.cos(c) * h * 0.35, Math.sin(c) * h * 0.35, h * 0.12);
    ctx.fill();
    ctx.restore();
  };
  if (k.phase === 'idle') {
    const a = time * 0.4 + k.x;
    ctx.save();
    ctx.translate(Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15);
    box(1, 0, 1.5, 0);
    ctx.restore();
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '255, 60, 120', '255, 210, 60');
    dangerRing(ctx, k, time, t);
    box(1 + t * 0.15, t, 3 + t * 14, 0);
    // A tune plays faster and faster.
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.4 + 0.5 * t).toFixed(3)})`;
    ctx.font = `bold ${Math.round(R * 0.14)}px sans-serif`;
    for (let i = 0; i < 3; i++) {
      const u = (time * (0.6 + t) + i / 3) % 1;
      ctx.fillText(i % 2 ? '♫' : '♪', Math.cos(i * 2.1 + k.x) * R * 0.3 + u * 10, Math.sin(i * 2.1 + k.x) * R * 0.3 - u * R * 0.3);
    }
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  splash(ctx, R, t);
  box(1.15, 0, 0, Math.min(1, t * 5));
  const pop = Math.min(1, t * 6);
  const boing = 1 + Math.sin(t * 20) * Math.exp(-t * 3) * 0.3;
  const hr = R * 0.17 * pop * boing;
  if (hr < 1) return;
  ctx.strokeStyle = '#9aa0aa';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) dot(ctx, 0, 0, hr * (0.55 + i * 0.22));
  ctx.stroke();
  const petals = ['#8b5cf6', '#f5c518'];
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = petals[i % 2];
    ctx.beginPath();
    const u = (i / 10) * TAU + t * 2;
    dot(ctx, Math.cos(u) * hr * 1.05, Math.sin(u) * hr * 1.05, hr * 0.36);
    ctx.fill();
  }
  ctx.fillStyle = '#3ddc97';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const u = (i / 6) * TAU + 0.3;
    dot(ctx, Math.cos(u) * hr * 0.82, Math.sin(u) * hr * 0.82, hr * 0.28);
  }
  ctx.fill();
  ctx.fillStyle = '#fff4e8';
  ctx.beginPath();
  dot(ctx, 0, 0, hr * 0.78);
  ctx.fill();
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  dot(ctx, 0, hr * 0.05, hr * 0.17);
  ctx.fill();
  ctx.strokeStyle = '#e5484d';
  ctx.lineWidth = Math.max(1, hr * 0.1);
  ctx.beginPath();
  ctx.arc(0, hr * 0.05, hr * 0.48, 0.35, Math.PI - 0.35);
  ctx.stroke();
  ctx.fillStyle = '#2a2a3a';
  ctx.beginPath();
  dot(ctx, -hr * 0.28, -hr * 0.25, hr * 0.09);
  dot(ctx, hr * 0.28, -hr * 0.25, hr * 0.09);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 120, 140, 0.45)';
  ctx.beginPath();
  dot(ctx, -hr * 0.48, hr * 0.12, hr * 0.13);
  dot(ctx, hr * 0.48, hr * 0.12, hr * 0.13);
  ctx.fill();
}

// A thundercloud low over the sea: it drifts and grumbles, darkens and
// flickers, then lightning strikes all round inside the ring.
function drawThunder(ctx, k, time) {
  const R = k.r;
  const cloud = (s, dark, flash) => {
    const lobes = (dx, dy, kk) => {
      ctx.beginPath();
      dot(ctx, dx, dy, R * 0.24 * s * kk);
      for (let i = 0; i < 7; i++) {
        const t = (i / 7) * TAU + hash(k.x + i) * 0.6;
        dot(ctx, dx + Math.cos(t) * R * 0.22 * s, dy + Math.sin(t) * R * 0.18 * s, R * (0.13 + hash(k.y + i) * 0.05) * s * kk);
      }
    };
    ctx.fillStyle = 'rgba(10, 20, 40, 0.2)';
    lobes(R * 0.12, R * 0.16, 1);
    ctx.fill();
    const g = Math.round(150 - dark * 80);
    ctx.fillStyle = `rgb(${g - 14}, ${g - 6}, ${g + 10})`;
    lobes(1.5, 2.5, 1);
    ctx.fill();
    ctx.fillStyle = `rgb(${g + 20}, ${g + 26}, ${g + 40})`;
    lobes(-1.5, -2, 0.8);
    ctx.fill();
    if (flash > 0) {
      const f = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.4 * s);
      f.addColorStop(0, `rgba(240, 245, 255, ${(0.8 * flash).toFixed(3)})`);
      f.addColorStop(1, 'rgba(240, 245, 255, 0)');
      ctx.fillStyle = f;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.4 * s, 0, TAU);
      ctx.fill();
    }
  };
  if (k.phase === 'idle') {
    ctx.save();
    ctx.translate(Math.cos(time * 0.2 + k.x) * R * 0.2, Math.sin(time * 0.17 + k.x) * R * 0.2);
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const u = (time * 1.4 + i / 10) % 1;
      const x = Math.cos(i * 2.3 + k.x) * R * 0.22 + R * 0.1;
      const y = Math.sin(i * 2.3 + k.x) * R * 0.2 + R * 0.12 + u * 6;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1.5, y + 4);
    }
    ctx.stroke();
    cloud(1, 0.3, 0);
    ctx.restore();
    return;
  }
  if (k.phase === 'warning') {
    const t = clamp(k.phaseTime / 1.8, 0, 1);
    warnGlow(ctx, R, t, '30, 36, 60', '140, 160, 220');
    dangerRing(ctx, k, time, t);
    const flicker = Math.sin(time * 23) > 0.7 ? t : 0;
    cloud(1 + t * 0.35, 0.3 + t * 0.7, flicker * 0.7);
    return;
  }
  const t = clamp(k.phaseTime / 1.6, 0, 1);
  const beat = Math.floor(t * 6);
  ctx.fillStyle = `rgba(220, 230, 255, ${(0.3 * (1 - t)).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  splash(ctx, R, t);
  // The cloud first, then the bolts over it, forking out from under it to
  // strike the sea all round the ring.
  cloud(1.35, 1, 0.8 * (1 - t));
  const bolts = [];
  for (let i = 0; i < 5; i++) {
    const a = hash(k.x + i * 7.1 + beat * 3.3) * TAU;
    const d = R * (0.45 + hash(k.y + i * 2.9 + beat) * 0.5);
    const pts = [[Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12]];
    for (let j = 1; j <= 6; j++) {
      const u = 0.12 + (j / 6) * 0.88;
      const wob = j < 6 ? (hash(i * 13 + j * 5.7 + beat) - 0.5) * R * 0.16 : 0;
      pts.push([Math.cos(a) * d * u - Math.sin(a) * wob, Math.sin(a) * d * u + Math.cos(a) * wob]);
    }
    bolts.push(pts);
  }
  const fade = 0.55 + 0.45 * Math.abs(Math.sin(t * 6 * Math.PI));
  for (const pts of bolts) {
    const [x, y] = pts[pts.length - 1];
    const r = R * 0.22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(235, 242, 255, ${(0.75 * fade).toFixed(3)})`);
    g.addColorStop(0.4, `rgba(170, 190, 255, ${(0.3 * fade).toFixed(3)})`);
    g.addColorStop(1, 'rgba(170, 190, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  for (const pts of bolts) pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(160, 180, 255, ${(0.4 * fade).toFixed(3)})`;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.7 + 0.3 * fade).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232, 244, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const pts of bolts) {
    const [x, y] = pts[pts.length - 1];
    dot(ctx, x, y, 4 + 6 * ((t * 6) % 1));
  }
  ctx.stroke();
}

// --- Night lights -------------------------------------------------------------------

export function dreamLights(level, time) {
  const out = [];
  for (const isl of level.islands) {
    if (isl.kind === 'tundra') {
      const { igloo } = tundraCamp(isl);
      out.push([igloo.x, igloo.y, 46, 0.6]);
    } else if (isl.kind === 'floater') {
      const { house } = floaterSpots(isl);
      out.push([house.x, house.y, 50, 0.55]);
    } else if (isl.kind === 'sandcastle') out.push([isl.cx, isl.cy, 64, 0.5]);
  }
  for (const f of level.floes) if (f.look === 'airship') out.push([f.cx + f.ox, f.cy + f.oy, f.radius * 0.9, 0.5]);
  for (const k of level.krakens) {
    if (k.look !== 'storm') continue;
    if (k.phase === 'strike') out.push([k.x, k.y, k.r * 1.3, 0.9]);
    else if (k.phase === 'warning' && Math.sin(time * 23) > 0.7) out.push([k.x, k.y, k.r, 0.5]);
  }
  return out;
}
