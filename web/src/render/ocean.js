// The sea itself: base water with drifting wave texture, the wind map that
// shows gusts (dark, ruffled water) and lulls (pale, glassy water), currents
// and whirlpools.

import { createRng } from '../core/rng.js';
import { clamp } from '../core/math.js';
import { sampleWind } from '../world/wind.js';
import { screenToWorld, viewBounds } from './camera.js';
import { C } from './palette.js';

const TILE_PX = 384;
const TILE_WORLD = 192;

function makeWaveTile(seed, count, alphaLo, alphaHi, lenLo, lenHi, width) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  const rng = createRng(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, TILE_PX);
    const y = rng.range(0, TILE_PX);
    const l = rng.range(lenLo, lenHi);
    const bend = rng.range(0.15, 0.45);
    ctx.strokeStyle = `rgba(232, 244, 242, ${rng.range(alphaLo, alphaHi).toFixed(3)})`;
    ctx.lineWidth = width * rng.range(0.7, 1.3);
    for (const ox of [-TILE_PX, 0, TILE_PX]) {
      for (const oy of [-TILE_PX, 0, TILE_PX]) {
        ctx.beginPath();
        ctx.moveTo(x + ox - l / 2, y + oy);
        ctx.quadraticCurveTo(x + ox, y + oy - l * bend, x + ox + l / 2, y + oy);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

export function createOcean(ctx) {
  const big = makeWaveTile(11, 70, 0.05, 0.12, 18, 46, 2.2);
  const small = makeWaveTile(23, 130, 0.04, 0.1, 6, 16, 1.4);
  const ocean = {
    patternBig: ctx.createPattern(big, 'repeat'),
    patternSmall: ctx.createPattern(small, 'repeat'),
    windMap: document.createElement('canvas'),
    windMapCtx: null,
    windImage: null,
    windFrame: 0,
    sample: {},
  };
  ocean.windMapCtx = ocean.windMap.getContext('2d');
  return ocean;
}

function setPatternOffset(pattern, ox, oy) {
  if (pattern && pattern.setTransform && typeof DOMMatrix !== 'undefined') {
    const k = TILE_WORLD / TILE_PX;
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
  }
}

// Called with the camera already applied (world units).
export function drawWater(ctx, ocean, game, cam, time) {
  const v = viewBounds(cam, 40);
  const { level, wind } = game;
  ctx.fillStyle = C.sea;
  ctx.fillRect(v.minX, v.minY, v.maxX - v.minX, v.maxY - v.minY);

  // Beyond the chart edge the water turns deep and dark.
  ctx.fillStyle = 'rgba(4, 16, 26, 0.55)';
  if (v.minX < 0) ctx.fillRect(v.minX, v.minY, -v.minX, v.maxY - v.minY);
  if (v.maxX > level.width) ctx.fillRect(level.width, v.minY, v.maxX - level.width, v.maxY - v.minY);
  if (v.minY < 0) ctx.fillRect(Math.max(0, v.minX), v.minY, Math.min(level.width, v.maxX) - Math.max(0, v.minX), -v.minY);
  if (v.maxY > level.height)
    ctx.fillRect(Math.max(0, v.minX), level.height, Math.min(level.width, v.maxX) - Math.max(0, v.minX), v.maxY - level.height);

  const dx = Math.cos(wind.angle);
  const dy = Math.sin(wind.angle);
  setPatternOffset(ocean.patternBig, dx * time * 4, dy * time * 4);
  ctx.fillStyle = ocean.patternBig;
  ctx.fillRect(v.minX, v.minY, v.maxX - v.minX, v.maxY - v.minY);
  setPatternOffset(ocean.patternSmall, dx * time * 9 + 40, dy * time * 9 + 70);
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 0.7);
  ctx.fillStyle = ocean.patternSmall;
  ctx.fillRect(v.minX, v.minY, v.maxX - v.minX, v.maxY - v.minY);
  ctx.globalAlpha = 1;

  // Chart border.
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.18)';
  ctx.lineWidth = 2 / cam.scale;
  ctx.setLineDash([10 / cam.scale, 8 / cam.scale]);
  if (level.endless) {
    // Only the stretch in view: the open sea's chart is far too long to dash.
    ctx.beginPath();
    for (const y of [0, level.height]) {
      ctx.moveTo(Math.max(0, v.minX), y);
      ctx.lineTo(v.maxX, y);
    }
    ctx.stroke();
  } else ctx.strokeRect(0, 0, level.width, level.height);
  ctx.setLineDash([]);
}

// Screen-space overlay of wind strength. Computed on a coarse grid and
// scaled up smoothly, refreshed every other frame.
export function drawWindMap(ctx, ocean, game, cam) {
  const cell = 16;
  const gw = Math.ceil(cam.w / cell) + 1;
  const gh = Math.ceil(cam.h / cell) + 1;
  const map = ocean.windMap;
  if (map.width !== gw || map.height !== gh) {
    map.width = gw;
    map.height = gh;
    ocean.windImage = ocean.windMapCtx.createImageData(gw, gh);
    ocean.windFrame = 0;
  }
  if (ocean.windFrame++ % 2 === 0) {
    const data = ocean.windImage.data;
    const base = Math.max(1, game.wind.speed);
    const s = ocean.sample;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const [wx, wy] = screenToWorld(cam, i * cell, j * cell);
        sampleWind(game.wind, wx, wy, s);
        const m = s.speed / base;
        const k = (j * gw + i) * 4;
        if (m > 1) {
          const a = clamp((m - 1) * 1.1, 0, 0.42);
          data[k] = 2;
          data[k + 1] = 16;
          data[k + 2] = 30;
          data[k + 3] = a * 255;
        } else {
          const a = clamp((1 - m) * 0.42, 0, 0.32);
          data[k] = 170;
          data[k + 1] = 222;
          data[k + 2] = 226;
          data[k + 3] = a * 255;
        }
      }
    }
    ocean.windMapCtx.putImageData(ocean.windImage, 0, 0);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(map, 0, 0, gw, gh, -cell / 2, -cell / 2, gw * cell, gh * cell);
  ctx.restore();
}

// Currents and whirlpools, world units.
export function drawFlows(ctx, game, cam, time) {
  const v = viewBounds(cam, 200);
  for (const c of game.level.currents) {
    const reach = Math.max(c.halfL, c.halfW);
    if (c.x + reach < v.minX || c.x - reach > v.maxX || c.y + reach < v.minY || c.y - reach > v.maxY) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(c.dirY, c.dirX));
    ctx.beginPath();
    ctx.rect(-c.halfL, -c.halfW, c.halfL * 2, c.halfW * 2);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, -c.halfW, 0, c.halfW);
    grad.addColorStop(0, 'rgba(90, 200, 215, 0)');
    grad.addColorStop(0.5, 'rgba(90, 200, 215, 0.09)');
    grad.addColorStop(1, 'rgba(90, 200, 215, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-c.halfL, -c.halfW, c.halfL * 2, c.halfW * 2);
    const gap = 54;
    const shift = (time * c.speed * 2.2) % gap;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let y = -c.halfW + 30; y < c.halfW - 10; y += 46) {
      const edge = 1 - Math.abs(y) / c.halfW;
      for (let x = -c.halfL - gap + shift + (y % 2 ? 20 : 0); x < c.halfL; x += gap) {
        const endFade = 1 - Math.abs(x) / c.halfL;
        ctx.strokeStyle = `rgba(200, 240, 245, ${(0.32 * edge * endFade).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 7);
        ctx.lineTo(x, y);
        ctx.lineTo(x - 7, y + 7);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  for (const w of game.level.whirlpools) {
    if (w.x + w.r < v.minX || w.x - w.r > v.maxX || w.y + w.r < v.minY || w.y - w.r > v.maxY) continue;
    ctx.save();
    ctx.translate(w.x, w.y);
    const grad = ctx.createRadialGradient(0, 0, w.core * 0.5, 0, 0, w.r);
    grad.addColorStop(0, 'rgba(1, 8, 14, 0.85)');
    grad.addColorStop(0.25, 'rgba(3, 20, 32, 0.45)');
    grad.addColorStop(1, 'rgba(3, 20, 32, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w.r, 0, Math.PI * 2);
    ctx.fill();
    const arms = 6;
    ctx.lineCap = 'round';
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * Math.PI * 2 + time * 1.3 * w.spin;
      let px = 0;
      let py = 0;
      for (let k = 0; k <= 26; k++) {
        const t = k / 26;
        const r = w.core + (w.r - w.core) * t;
        const ang = base - w.spin * 2.3 * Math.log(r / w.core);
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        if (k > 0) {
          ctx.strokeStyle = `rgba(232, 244, 242, ${(0.42 * (1 - t) * Math.min(1, 0.4 + 2.4 * t)).toFixed(3)})`;
          ctx.lineWidth = 2.6 * (1 - t) + 0.6;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        px = x;
        py = y;
      }
    }
    ctx.strokeStyle = `rgba(232, 244, 242, ${0.5 + 0.2 * Math.sin(time * 6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, w.core, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
