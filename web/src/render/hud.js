// Instruments and on-screen controls, drawn in screen space (CSS pixels).

import { clamp, DEG, formatTime, compassPoint, toBearing, fromBearing, wrapAngle } from '../core/math.js';
import { toKnots, toMeters, formatDistance } from '../physics/sailing.js';
import { HEEL_WARNING, boatSpeed } from '../physics/boat.js';
import { relativeWindAngle, distanceToFinish } from '../world/game.js';
import { windFromBearing } from '../world/wind.js';
import { ESCORT_TIME } from '../world/wildlife.js';
import { chasingShip } from '../world/pirates.js';
import { ordinal } from '../world/regatta.js';
import { worldToScreen } from './camera.js';
import { C, font, FONT, rgba } from './palette.js';

function panel(ctx, x, y, w, h, r = 12) {
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, str, x, y, size, color = C.text, align = 'left', weight = 700, family = FONT.display, italic = false) {
  ctx.font = font(size, weight, family, italic);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

export function createHud() {
  return { minimap: null, minimapKey: '', flashT: 0 };
}

// Shrinks, then trims, a label so it fits `maxW` CSS pixels.
function fitText(ctx, str, size, maxW, weight, family, minSize = 9) {
  let s = size;
  ctx.font = font(s, weight, family);
  while (s > minSize && ctx.measureText(str).width > maxW) {
    s -= 0.5;
    ctx.font = font(s, weight, family);
  }
  if (ctx.measureText(str).width <= maxW) return { str, size: s };
  let cut = str;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
  return { str: `${cut.trimEnd()}…`, size: s };
}

export function drawHud(ctx, hud, game, cam, layout, controls, time, ghost = null) {
  const L = layout;
  if (game.sea) drawSeaClock(ctx, game, L, time);
  else if (game.race) drawRaceBox(ctx, game, L, time);
  else drawTopLeft(ctx, game, L);
  if (game.race) drawRivalTags(ctx, game, cam, L);
  if (ghost) drawGhostInfo(ctx, game, cam, L, ghost);
  drawEscort(ctx, game, L, time, ghost && ghost.gap !== null && game.time >= 2);
  drawMinimap(ctx, hud, game, cam, L, time);
  drawHull(ctx, game, L);
  if (game.castaways.length) drawRescue(ctx, game, L, time);
  drawPointers(ctx, game, cam, L, time);
  drawInstruments(ctx, game, L, controls, time);
  if (controls.touch) drawTouchControls(ctx, game, L, controls, time);
  else drawKeyHints(ctx, game, L, controls);
  drawStatus(ctx, game, L, time);
}

function drawTopLeft(ctx, game, L) {
  drawPause(ctx, L);

  const x = L.timer.x;
  const y = L.timer.y;
  const w = L.compact ? 150 : 176;
  panel(ctx, x, y, w, 44, 10);
  const par = game.level.par;
  const target = game.time <= par.gold ? par.gold : game.time <= par.silver ? par.silver : null;
  const starColor = game.time <= par.gold ? C.brass : game.time <= par.silver ? '#c9d3d6' : C.textDim;
  const starText = target ? `★ ${formatTime(target)}` : '★';
  ctx.font = font(11, 600, FONT.body);
  const starW = ctx.measureText(starText).width;
  const name = fitText(ctx, game.level.name.toUpperCase(), 11, w - 22 - starW - 8, 600, FONT.body);
  text(ctx, name.str, x + 12, y + 13, name.size, C.textDim, 'left', 600, FONT.body);
  text(ctx, formatTime(game.time), x + 12, y + 30, 21, C.text, 'left', 700);
  text(ctx, starText, x + w - 10, y + 13, 11, starColor, 'right', 600, FONT.body);
  // Pearls.
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.arc(x + w - 46, y + 30, 5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, `${game.pearls}/${game.pearlsTotal}`, x + w - 10, y + 31, 16, C.text, 'right', 700);
}

function drawPause(ctx, L) {
  const p = L.pause;
  panel(ctx, p.x, p.y, p.w, p.h, 10);
  ctx.fillStyle = C.text;
  ctx.fillRect(p.x + 15, p.y + 13, 5, 18);
  ctx.fillRect(p.x + 25, p.y + 13, 5, 18);
}

// On the open sea the timer counts down: time left, how far east, and
// the gates sailed through.
function drawSeaClock(ctx, game, L, time) {
  drawPause(ctx, L);
  const sea = game.sea;
  const x = L.timer.x;
  const y = L.timer.y;
  const w = L.compact ? 150 : 176;
  const low = sea.clock < 10 && game.status !== 'finished';
  panel(ctx, x, y, w, 44, 10);
  if (low) {
    ctx.strokeStyle = rgba(C.danger, 0.55 + 0.45 * Math.sin(time * 9));
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, 44, 10);
    else ctx.rect(x, y, w, 44);
    ctx.stroke();
  }
  text(ctx, 'OPEN SEA', x + 12, y + 13, 11, C.textDim, 'left', 600, FONT.body);
  text(ctx, `⚑ ${sea.gates}`, x + w - 10, y + 13, 11, C.warn, 'right', 700, FONT.body);
  text(ctx, formatTime(sea.clock), x + 12, y + 30, 21, low ? C.danger : C.text, 'left', 700);
  text(ctx, formatDistance(sea.best), x + w - 10, y + 31, 15, C.text, 'right', 700);
}

// In a regatta: the leg you are on, your place in the fleet and the race
// clock, with a warning chip underneath while you sail in dirty air.
function drawRaceBox(ctx, game, L, time) {
  drawPause(ctx, L);
  const race = game.race;
  const x = L.timer.x;
  const y = L.timer.y;
  const w = L.compact ? 150 : 176;
  panel(ctx, x, y, w, 44, 10);
  const marks = game.level.checkpoints.length;
  const leg = game.nextCheckpoint < marks ? `MARK ${game.nextCheckpoint + 1}/${marks}` : 'FINISH';
  text(ctx, 'REGATTA', x + 12, y + 13, 11, C.textDim, 'left', 600, FONT.body);
  text(ctx, leg, x + w - 10, y + 13, 11, C.warn, 'right', 700, FONT.body);
  text(ctx, formatTime(game.time), x + 12, y + 30, 21, C.text, 'left', 700);
  const place = race.place || 1;
  const field = race.rivals.length + 1;
  ctx.font = font(12, 600, FONT.body);
  const ofW = ctx.measureText(` / ${field}`).width;
  text(ctx, ` / ${field}`, x + w - 10, y + 32, 12, C.textDim, 'right', 600, FONT.body);
  text(ctx, ordinal(place), x + w - 10 - ofW, y + 30, 20, place === 1 ? C.brass : C.text, 'right', 800, FONT.display, true);
  if (race.dirty > 0.15 && game.status === 'sailing') {
    const cw = 92;
    const cy = y + 50;
    ctx.globalAlpha = clamp(race.dirty * 2.5, 0.5, 1) * (0.8 + 0.2 * Math.sin(time * 6));
    panel(ctx, x, cy, cw, 22, 8);
    text(ctx, 'DIRTY AIR', x + cw / 2, cy + 11.5, 11, C.warn, 'center', 800, FONT.body);
    ctx.globalAlpha = 1;
  }
}

// Each rival's name over its boat, in its sail color, unless the boat is
// behind the instrument panel or the chart.
function drawRivalTags(ctx, game, cam, L) {
  const under = (x, y, b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 12 && y < b.y + b.h + 12;
  for (const r of game.race.rivals) {
    const [sx, sy] = worldToScreen(cam, r.boat.x, r.boat.y);
    const ty = sy - r.boat.type.length * cam.scale * 1.05 - 4;
    if (sx < L.insets.l || sx > L.w - L.insets.r || ty < 0 || sy > L.h) continue;
    if (under(sx, ty, L.panel) || under(sx, ty, L.minimap)) continue;
    ctx.font = font(11, 800, FONT.body);
    const tw = ctx.measureText(r.name).width + 12;
    ctx.fillStyle = 'rgba(6, 22, 34, 0.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(sx - tw / 2, ty - 8, tw, 16, 8);
    else ctx.rect(sx - tw / 2, ty - 8, tw, 16);
    ctx.fill();
    text(ctx, r.name, sx, ty + 0.5, 11, r.look.sail, 'center', 800, FONT.body);
  }
}

// Label over the ghost boat and a chip under the timer: ahead or behind.
function drawGhostInfo(ctx, game, cam, L, ghost) {
  const { pose, gap } = ghost;
  const [sx, sy] = worldToScreen(cam, pose.x, pose.y);
  if (sx > 0 && sx < L.w && sy > 0 && sy < L.h) {
    ctx.globalAlpha = pose.done ? 0.45 : 0.85;
    text(ctx, 'BEST', sx, sy - 24, 11, '#bfefff', 'center', 700, FONT.display);
    ctx.globalAlpha = 1;
  }
  if (gap === null || game.time < 2) return;
  const ahead = gap < 0;
  const label = `${ahead ? '▲' : '▼'} ${Math.abs(gap).toFixed(1)} s ${ahead ? 'ahead' : 'behind'}`;
  const x = L.timer.x;
  const y = L.timer.y + 50;
  ctx.font = font(13, 700, FONT.display);
  const w = ctx.measureText(label).width + 50;
  panel(ctx, x, y, w, 22, 8);
  text(ctx, 'BEST', x + 9, y + 11.5, 10, '#bfefff', 'left', 700, FONT.display);
  text(ctx, label, x + w - 9, y + 11.5, 13, ahead ? C.ok : C.warn, 'right', 700, FONT.display);
}

// While dolphins ride the bow: a chip under the timer with how long they'll stay.
function drawEscort(ctx, game, L, time, belowGhost) {
  const pod = game.life && game.life.pods.find((p) => p.state === 'escort');
  if (!pod) return;
  const x = L.timer.x;
  const y = L.timer.y + (belowGhost ? 76 : 50);
  const w = L.compact ? 150 : 176;
  panel(ctx, x, y, w, 22, 8);
  const riding = pod.ride > 0.5;
  const label = riding ? 'DOLPHINS' : 'DOLPHINS…';
  text(ctx, label, x + 9, y + 11.5, 11, '#bfefff', 'left', 700, FONT.display);
  // Remaining ride, or a pulse while the pod is still catching up.
  const bx = x + 84;
  const bw = w - 94;
  ctx.fillStyle = 'rgba(191, 239, 255, 0.18)';
  ctx.fillRect(bx, y + 9, bw, 5);
  ctx.fillStyle = '#bfefff';
  if (riding) ctx.fillRect(bx, y + 9, bw * clamp(pod.timer / ESCORT_TIME, 0, 1), 5);
  else {
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 6);
    ctx.fillRect(bx, y + 9, bw, 5);
    ctx.globalAlpha = 1;
  }
}

// The open sea is too long for one map: it shows the stretch around the
// boat, redrawn as the boat moves on.
const SEA_MAP_W = 2400;
const SEA_MAP_STEP = 400;

function mapWindow(game) {
  if (!game.sea) return { x0: 0, width: game.level.width };
  const x0 = Math.max(0, Math.floor((game.boat.x - SEA_MAP_W * 0.3) / SEA_MAP_STEP) * SEA_MAP_STEP);
  return { x0, width: SEA_MAP_W };
}

function minimapScale(game, L, width) {
  const { level } = game;
  const k = Math.min(L.minimap.w / width, (L.minimap.w * 0.75) / level.height);
  return { k, w: width * k, h: level.height * k };
}

function buildMinimap(game, L, view) {
  const { level } = game;
  const { k, w, h } = minimapScale(game, L, view.width);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const m = c.getContext('2d');
  m.scale(dpr * k, dpr * k);
  m.translate(-view.x0, 0);
  m.fillStyle = 'rgba(15, 76, 92, 0.9)';
  m.fillRect(view.x0, 0, view.width, level.height);
  for (const cz of level.calms) {
    m.fillStyle = 'rgba(170, 222, 226, 0.25)';
    m.beginPath();
    m.arc(cz.x, cz.y, cz.r, 0, Math.PI * 2);
    m.fill();
  }
  for (const s of level.storms) {
    m.fillStyle = 'rgba(6, 12, 20, 0.35)';
    m.beginPath();
    m.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    m.fill();
  }
  for (const cur of level.currents) {
    m.save();
    m.translate(cur.x, cur.y);
    m.rotate(Math.atan2(cur.dirY, cur.dirX));
    m.fillStyle = 'rgba(120, 210, 225, 0.18)';
    m.fillRect(-cur.halfL, -cur.halfW, cur.halfL * 2, cur.halfW * 2);
    m.strokeStyle = 'rgba(200, 240, 245, 0.5)';
    m.lineWidth = 1 / k;
    for (let x = -cur.halfL + 60; x < cur.halfL; x += 140) {
      m.beginPath();
      m.moveTo(x - 30, -30);
      m.lineTo(x, 0);
      m.lineTo(x - 30, 30);
      m.stroke();
    }
    m.restore();
  }
  for (const wp of level.whirlpools) {
    m.strokeStyle = 'rgba(232, 244, 242, 0.55)';
    m.lineWidth = 1.2 / k;
    m.beginPath();
    m.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
    m.stroke();
    m.fillStyle = 'rgba(2, 10, 16, 0.6)';
    m.beginPath();
    m.arc(wp.x, wp.y, wp.r * 0.35, 0, Math.PI * 2);
    m.fill();
  }
  for (const kr of level.krakens) {
    m.strokeStyle = rgba(C.danger, 0.7);
    m.lineWidth = 1.2 / k;
    m.setLineDash([6 / k, 4 / k]);
    m.beginPath();
    m.arc(kr.x, kr.y, kr.r, 0, Math.PI * 2);
    m.stroke();
    m.setLineDash([]);
  }
  for (const isl of level.islands) {
    m.fillStyle = isl.kind === 'rock' ? '#8d867c' : isl.kind === 'ice' ? C.ice : C.sand;
    m.beginPath();
    isl.pts.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y)));
    m.closePath();
    m.fill();
  }
  for (const r of level.rocks) {
    m.fillStyle = r.material === 'coral' ? C.coral : '#cfc7bb';
    m.beginPath();
    m.arc(r.x, r.y, Math.max(r.r, 1.2 / k), 0, Math.PI * 2);
    m.fill();
  }
  return { canvas: c, w, h, k, x0: view.x0 };
}

function drawMinimap(ctx, hud, game, cam, L, time) {
  const view = mapWindow(game);
  const key = `${game.level.id}:${view.x0}:${Math.round(L.minimap.w)}:${C.danger}`;
  if (!hud.minimap || hud.minimapKey !== key) {
    hud.minimap = buildMinimap(game, L, view);
    hud.minimapKey = key;
  }
  const mm = hud.minimap;
  const y = L.minimap.y;
  // Everything below is placed in world units from the map's west edge.
  const x = L.minimap.x + (L.minimap.w - mm.w) - mm.x0 * mm.k;
  const left = x + mm.x0 * mm.k;
  L.minimap.drawn = { x: left, y, w: mm.w, h: mm.h };
  panel(ctx, left - 5, y - 5, mm.w + 10, mm.h + 10, 8);
  ctx.drawImage(mm.canvas, left, y, mm.w, mm.h);
  ctx.save();
  if (game.sea) {
    ctx.beginPath();
    ctx.rect(left, y, mm.w, mm.h);
    ctx.clip();
  }
  const k = mm.k;
  const { level, boat } = game;
  // View rectangle.
  const vw = cam.w / cam.scale;
  const vh = cam.h / cam.scale;
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + (cam.x - vw / 2) * k, y + (cam.y - vh / 2) * k, vw * k, vh * k);
  // Floes move, so they're drawn live.
  ctx.fillStyle = C.ice;
  for (const fl of level.floes) {
    ctx.beginPath();
    fl.pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + (px + fl.ox) * k, y + (py + fl.oy) * k) : ctx.moveTo(x + (px + fl.ox) * k, y + (py + fl.oy) * k)));
    ctx.closePath();
    ctx.fill();
  }
  for (const c of level.checkpoints) {
    if (game.sea && (c.x < mm.x0 || c.x > mm.x0 + SEA_MAP_W)) continue;
    ctx.fillStyle = c.reached ? C.ok : c.missed ? rgba(C.textDim, 0.5) : C.warn;
    ctx.beginPath();
    ctx.arc(x + c.x * k, y + c.y * k, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pirates: a dull mark in their cove, a pulsing one while they chase you.
  for (const ship of game.pirates ? game.pirates.ships : []) {
    const chasing = ship.state === 'chase';
    ctx.fillStyle = chasing ? C.danger : rgba(C.danger, 0.55);
    ctx.beginPath();
    ctx.arc(x + ship.x * k, y + ship.y * k, chasing ? 3.2 + Math.sin(time * 8) * 0.8 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The regatta fleet, each in its sail color.
  for (const r of game.race ? game.race.rivals : []) {
    ctx.fillStyle = r.look.sail;
    ctx.beginPath();
    ctx.arc(x + r.boat.x * k, y + r.boat.y * k, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Castaways still adrift blink white.
  for (const c of game.castaways) {
    if (c.state === 'aboard') continue;
    ctx.fillStyle = rgba(C.foam, 0.55 + 0.45 * Math.sin(time * 6));
    ctx.beginPath();
    ctx.arc(x + c.x * k, y + c.y * k, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const f = level.finish;
  if (!game.sea) {
    ctx.fillStyle = C.signal;
    ctx.beginPath();
    ctx.arc(x + f.x * k, y + f.y * k, 3.5 + Math.sin(time * 4), 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'B', x + f.x * k, y + f.y * k - 9, 10, C.signal, 'center', 800);
  }
  // Boat arrow.
  ctx.save();
  ctx.translate(x + boat.x * k, y + boat.y * k);
  ctx.rotate(boat.heading);
  ctx.fillStyle = C.foam;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3.5);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-4, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // North-up wind arrow in the corner.
  const ax = left + 12;
  const ay = y + 12;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(game.wind.angle);
  ctx.strokeStyle = C.foam;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(6, 0);
  ctx.moveTo(2, -3.5);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 3.5);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'N', left + mm.w - 8, y + 9, 9, C.textDim, 'center', 700);
}

function drawHull(ctx, game, L) {
  const d = L.minimap.drawn || L.minimap;
  const x = d.x - 5;
  const y = d.y + d.h + 12;
  const w = d.w + 10;
  panel(ctx, x, y, w, 26, 8);
  const hull = clamp(game.hull / 100, 0, 1);
  text(ctx, 'HULL', x + 9, y + 13.5, 11, C.textDim, 'left', 700);
  const bx = x + 44;
  const bw = w - 44 - 40;
  ctx.fillStyle = 'rgba(232, 244, 242, 0.12)';
  ctx.fillRect(bx, y + 9, bw, 8);
  ctx.fillStyle = hull > 0.5 ? C.ok : hull > 0.25 ? C.warn : C.danger;
  ctx.fillRect(bx, y + 9, bw * hull, 8);
  text(ctx, `${Math.ceil(game.hull)}%`, x + w - 8, y + 13.5, 13, C.text, 'right', 700);
}

// Under the hull bar: how many castaways are aboard, out of those adrift here.
function drawRescue(ctx, game, L, time) {
  const d = L.minimap.drawn || L.minimap;
  const x = d.x - 5;
  const y = d.y + d.h + 44;
  const w = d.w + 10;
  const aboard = game.castaways.filter((c) => c.state === 'aboard').length;
  const all = aboard === game.castaways.length;
  panel(ctx, x, y, w, 26, 8);
  // A lifebuoy: red and white quarters.
  const cx = x + 16;
  const cy = y + 13;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = i % 2 ? C.foam : '#e0503a';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2);
    ctx.stroke();
  }
  const hauling = game.castaways.some((c) => c.state !== 'aboard' && c.haul > 0);
  const label = hauling ? 'HAULING IN' : all ? 'ALL ABOARD' : aboard ? 'ABOARD' : 'CASTAWAY ADRIFT';
  const color = hauling ? rgba(C.ok, 0.7 + 0.3 * Math.sin(time * 10)) : all ? C.ok : C.textDim;
  const fit = fitText(ctx, label, 11, w - 70, 700, FONT.display);
  text(ctx, fit.str, x + 28, y + 13.5, fit.size, color, 'left', 700);
  text(ctx, `${aboard}/${game.castaways.length}`, x + w - 8, y + 13.5, 13, all ? C.ok : C.text, 'right', 700);
}

// Edge-of-screen arrows toward B, the next checkpoint, a castaway in sight and
// a pirate on your tail.
function drawPointers(ctx, game, cam, L, time) {
  const targets = [];
  const ship = chasingShip(game);
  if (ship) targets.push({ x: ship.x, y: ship.y, color: C.danger, label: 'PIRATE', dist: Math.hypot(ship.x - game.boat.x, ship.y - game.boat.y) });
  const f = game.level.finish;
  const next = game.level.checkpoints[game.nextCheckpoint];
  // A regatta points at B only once every mark is rounded.
  if (!game.sea && !(game.race && next)) targets.push({ x: f.x, y: f.y, color: C.signal, label: 'B', dist: distanceToFinish(game) });
  // Out on the open sea the next gate is the mark to steer for, and in a
  // regatta the next mark.
  const markLabel = game.sea ? 'GATE' : game.race && next ? `MARK ${next.label}` : '';
  if (next && !next.reached) targets.push({ x: next.x, y: next.y, color: C.warn, label: markLabel, dist: distanceToFinish(game) });
  for (const c of game.castaways) {
    const d = Math.hypot(c.x - game.boat.x, c.y - game.boat.y);
    if (c.state !== 'aboard' && d < 900) targets.push({ x: c.x, y: c.y, color: C.foam, label: 'SOS', dist: d });
  }
  // Pointers ride the edge of the open water between the HUD bands.
  const m = 30;
  const x0 = L.insets.l + m;
  const x1 = L.w - L.insets.r - m;
  const y0 = L.insets.t + 72;
  const y1 = Math.max(y0 + 40, L.panel.y - 18);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let first = null;
  for (const t of targets) {
    const [sx, sy] = worldToScreen(cam, t.x, t.y);
    if (sx > x0 && sx < x1 && sy > y0 && sy < y1) continue;
    const a = Math.atan2(sy - cy, sx - cx);
    const s = Math.min((x1 - x0) / 2 / Math.abs(Math.cos(a) || 1e-6), (y1 - y0) / 2 / Math.abs(Math.sin(a) || 1e-6));
    let px = cx + Math.cos(a) * s;
    let py = cy + Math.sin(a) * s;
    const mm = L.minimap;
    const underMap = (qx, qy) => qx > mm.x - 24 && qy < mm.y + mm.h + (game.castaways.length ? 76 : 44);
    if (underMap(px, py)) px = mm.x - 24;
    // Two targets in the same direction: slide the second pointer along the
    // edge so it doesn't sit on top of the first one and its label.
    if (first && Math.hypot(px - first.x, py - first.y) < 46) {
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const side = (px - first.x) * nx + (py - first.y) * ny >= 0 ? 1 : -1;
      const slide = (k) => [clamp(first.x + nx * k * 48, x0, x1), clamp(first.y + ny * k * 48, y0, y1)];
      const fits = ([qx, qy]) => Math.hypot(qx - first.x, qy - first.y) >= 40 && !underMap(qx, qy);
      [px, py] = [slide(side), slide(-side)].find(fits) || slide(side);
    }
    if (!first) first = { x: px, y: py };
    // A soft dark halo keeps the pointer and its label readable over ice.
    ctx.save();
    ctx.shadowColor = 'rgba(6, 20, 29, 0.9)';
    ctx.shadowBlur = 5;
    ctx.save();
    ctx.translate(px, py);
    const pulse = 1 + 0.08 * Math.sin(time * 5);
    ctx.scale(pulse, pulse);
    ctx.rotate(a);
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (t.label) {
      const lx = px - Math.cos(a) * 26;
      const ly = py - Math.sin(a) * 22;
      text(ctx, t.label, lx, ly - 7, 15, t.color, 'center', 800, FONT.display, true);
      text(ctx, `${Math.round(toMeters(t.dist))} m`, lx, ly + 8, 11, C.text, 'center', 600, FONT.body);
    }
    ctx.restore();
  }
}

// Just what you sail by: a compass with the wind on it, the wind, your speed
// and your heading. The boat on the compass reddens as she heels too far.
function drawInstruments(ctx, game, L, controls, time) {
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, 14);
  const { boat } = game;
  const cy = P.y + P.h / 2;

  // Compass, heading-up: your bow always points at the top.
  const R = P.h * 0.42;
  const dx = P.x + R + 12;
  ctx.save();
  ctx.translate(dx, cy);
  ctx.fillStyle = 'rgba(6, 20, 29, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 244, 242, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const turn = (a) => -Math.PI / 2 + a;
  for (let i = 0; i < 16; i++) {
    const a = turn(wrapAngle(fromBearing(i * 22.5) - boat.heading));
    const inner = i % 4 === 0 ? R - 5 : R - 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.stroke();
  }
  const rel = relativeWindAngle(game);
  const windA = turn(rel);
  const inIrons = Math.abs(rel) < 34 * DEG;
  ctx.fillStyle = inIrons ? rgba(C.danger, 0.35 + 0.2 * Math.sin(time * 8)) : 'rgba(214, 62, 169, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R - 1, windA - 34 * DEG, windA + 34 * DEG);
  ctx.closePath();
  ctx.fill();
  // Your boat, pointing up.
  const heel = Math.abs(boat.heel);
  ctx.fillStyle = heel > HEEL_WARNING ? C.danger : heel > HEEL_WARNING * 0.75 ? C.warn : C.foam;
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.4);
  ctx.quadraticCurveTo(R * 0.19, -R * 0.05, R * 0.12, R * 0.36);
  ctx.lineTo(-R * 0.12, R * 0.36);
  ctx.quadraticCurveTo(-R * 0.19, -R * 0.05, 0, -R * 0.4);
  ctx.fill();
  // The wind, from the rim inward.
  const ux = Math.cos(windA);
  const uy = Math.sin(windA);
  ctx.strokeStyle = C.brass;
  ctx.fillStyle = C.brass;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(ux * (R + 2), uy * (R + 2));
  ctx.lineTo(ux * R * 0.55, uy * R * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ux * R * 0.45, uy * R * 0.45);
  ctx.lineTo(ux * R * 0.7 - uy * 5, uy * R * 0.7 + ux * 5);
  ctx.lineTo(ux * R * 0.7 + uy * 5, uy * R * 0.7 - ux * 5);
  ctx.closePath();
  ctx.fill();
  // North, east, south and west turn round the card as you turn, on top so
  // the wind arrow never hides them.
  ctx.lineJoin = 'round';
  for (const [label, bearing] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const a = turn(wrapAngle(fromBearing(bearing) - boat.heading));
    const r = R - 10;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r + 1;
    ctx.font = font(label === 'N' ? 12 : 10, 800, FONT.display);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(6, 20, 29, 0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, x, y);
    text(ctx, label, x, y, label === 'N' ? 12 : 10, label === 'N' ? C.signal : C.text, 'center', 800);
  }
  ctx.restore();

  // Three readings: wind, speed, heading.
  const x0 = dx + R + 14;
  const colW = (P.x + P.w - 12 - x0) / 3;
  const top = P.y + 15;
  const big = L.compact ? 22 : 26;
  const valueY = cy + 3;
  const subY = P.y + P.h - 13;
  const reading = (i, label, value, unit, sub, color = C.text) => {
    const x = x0 + colW * i;
    text(ctx, label, x, top, 11, C.textDim, 'left', 700);
    text(ctx, value, x, valueY, big, color, 'left', 800, FONT.display, true);
    if (unit) {
      ctx.font = font(big, 800, FONT.display, true);
      text(ctx, unit, x + ctx.measureText(value).width + 3, valueY + 3, 12, C.textDim, 'left', 600, FONT.body);
    }
    if (sub) text(ctx, sub, x, subY, 12, C.textDim, 'left', 600, FONT.body);
  };
  const heading = toBearing(boat.heading);
  reading(0, 'WIND', toKnots(game.windHere.speed).toFixed(0), 'kn', `from ${compassPoint(windFromBearing(game.wind))}`);
  reading(1, 'SPEED', toKnots(boatSpeed(boat)).toFixed(1), 'kn', inIrons ? 'in irons' : null, inIrons ? C.danger : C.text);
  reading(2, 'HEADING', compassPoint(heading), null, `${String(Math.round(heading) % 360).padStart(3, '0')}°`);
}

function drawTouchControls(ctx, game, L, controls, time) {
  // Steering: no wheel, just a ring under the thumb with a dot that follows it.
  const h = L.helm;
  const helm = controls.helm || {};
  if (helm.active) {
    const { ax, ay } = helm;
    const r = h.r;
    ctx.fillStyle = 'rgba(6, 20, 29, 0.3)';
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // The side you're turning to lights up, more the harder you turn.
    const steer = clamp(controls.steer, -1, 1);
    if (Math.abs(steer) > 0.02) {
      const mid = steer > 0 ? 0 : Math.PI;
      const half = 0.25 + Math.abs(steer) * 0.9;
      ctx.strokeStyle = C.signal;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ax, ay, r, mid - half, mid + half);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.fillStyle = 'rgba(232, 244, 242, 0.6)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(ax + s * (r - 7), ay);
      ctx.lineTo(ax + s * (r - 15), ay - 6);
      ctx.lineTo(ax + s * (r - 15), ay + 6);
      ctx.closePath();
      ctx.fill();
    }
    // The dot sits under the thumb, kept inside the ring.
    let dx = helm.x - ax;
    let dy = helm.y - ay;
    const d = Math.hypot(dx, dy);
    const max = r * 0.85;
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
    }
    ctx.fillStyle = 'rgba(232, 244, 242, 0.92)';
    ctx.strokeStyle = 'rgba(6, 20, 29, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax + dx, ay + dy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (!helm.used) {
    // Until the first touch: where a thumb could go, and what to do.
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.globalAlpha = 0.45 + 0.25 * pulse;
    // A dark disc so the hint still shows over white ice.
    ctx.fillStyle = 'rgba(6, 20, 29, 0.28)';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 244, 242, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const slide = Math.sin(time * 1.6) * h.r * 0.45;
    ctx.fillStyle = 'rgba(232, 244, 242, 0.85)';
    ctx.beginPath();
    ctx.arc(h.x + slide, h.y, h.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // The words stay steady while the ring pulses.
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = 'rgba(6, 20, 29, 0.95)';
    ctx.shadowBlur = 5;
    text(ctx, 'TOUCH AND SLIDE TO STEER', h.x, h.y + h.r + 14, 12, C.text, 'center', 700);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;
  }

  // Gust jar button.
  const g = L.gust;
  const has = game.gustJars > 0;
  const boosting = game.boat.boostTime > 0;
  ctx.strokeStyle = has ? '#bff3ff' : 'rgba(232, 244, 242, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
  // Dark underneath so the button still shows over white ice.
  ctx.fillStyle = 'rgba(6, 20, 29, 0.35)';
  ctx.fill();
  if (has) {
    ctx.fillStyle = boosting ? 'rgba(120, 220, 240, 0.45)' : 'rgba(120, 220, 240, 0.22)';
    ctx.fill();
  }
  ctx.stroke();
  ctx.globalAlpha = has ? 1 : 0.45;
  ctx.save();
  ctx.translate(g.x, g.y - 4);
  ctx.scale(1.5, 1.5);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = time * (boosting ? 12 : 3) + i * 0.6;
    const r = 0.5 + i * 0.32;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  text(ctx, `GUST ×${game.gustJars}`, g.x, g.y + g.r * 0.55, 11, C.text, 'center', 800);
  ctx.globalAlpha = 1;

  // Sheet slider when trimming by hand.
  if (controls.manual) {
    const s = L.sheet;
    panel(ctx, s.x - s.w / 2, s.y, s.w, s.h, s.w / 2);
    const opt = clamp(game.boat.optimalTrim, 0, 1);
    ctx.fillStyle = rgba(C.ok, 0.4);
    ctx.fillRect(s.x - s.w / 2 + 4, s.y + 8 + (s.h - 16) * clamp(opt - 0.07, 0, 1), s.w - 8, (s.h - 16) * 0.14);
    const ty = s.y + 8 + (s.h - 16) * clamp(controls.trimTarget, 0, 1);
    ctx.fillStyle = controls.sheet && controls.sheet.active ? C.signal : C.foam;
    ctx.beginPath();
    ctx.arc(s.x, ty, s.w / 2 + 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'IN', s.x, s.y - 9, 10, C.textDim, 'center', 700);
    text(ctx, 'OUT', s.x, s.y + s.h + 10, 10, C.textDim, 'center', 700);
  }
}

function drawKeyHints(ctx, game, L, controls) {
  const y = L.panel.y - 12;
  const hint = controls.manual
    ? 'A/D steer · W/S sheet in/out · SPACE gust · P pause'
    : 'A/D or ←/→ steer · SPACE gust jar · T trim by hand · P pause';
  text(ctx, hint, L.w / 2, y, 12, 'rgba(232, 244, 242, 0.5)', 'center', 600, FONT.body);
  if (game.gustJars > 0) text(ctx, `Gust jars: ${game.gustJars}  (SPACE)`, L.w / 2, y - 18, 13, '#bff3ff', 'center', 700);
}

function drawStatus(ctx, game, L, time) {
  let msg = null;
  let color = C.warn;
  if (game.status === 'capsized') {
    msg = 'CAPSIZED! Righting the boat…';
    color = C.danger;
  } else if (game.status === 'sinking') {
    msg = game.sea ? 'HULL BREACHED! The run is over…' : 'HULL BREACHED! Back to the last buoy…';
    color = C.danger;
  } else if (Math.abs(game.boat.heel) > HEEL_WARNING && game.status === 'sailing') {
    msg = 'HEELING HARD: ease the sail or bear away!';
    color = C.danger;
  } else if (game.waterHere.vortex > 0.45 && game.status === 'sailing') {
    msg = 'WHIRLPOOL! Sail hard out of the swirl';
  }
  if (!msg) return;
  const y = L.insets.t + L.pad + 66;
  ctx.font = font(L.compact ? 17 : 20, 800, FONT.display, true);
  const w = ctx.measureText(msg).width + 32;
  ctx.globalAlpha = 0.85 + 0.15 * Math.sin(time * 8);
  panel(ctx, L.w / 2 - w / 2, y - 17, w, 34, 17);
  text(ctx, msg, L.w / 2, y, L.compact ? 17 : 20, color, 'center', 800, FONT.display, true);
  ctx.globalAlpha = 1;
}
