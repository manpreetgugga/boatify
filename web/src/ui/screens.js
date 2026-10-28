// DOM menus layered over the canvas: title, voyage select, briefing, pause,
// results, settings, how-to-sail, the Shipyard and Sail Locker, medals and the
// logbook of bottle notes. Plus toasts.

import { formatTime, compassPoint, DEG } from '../core/math.js';
import { beaufort, toKnots, formatDistance } from '../physics/sailing.js';
import { POLAR } from '../world/autopilot.js';
import { SEA_BLURB, PEARL_TIME } from '../world/opensea.js';
import { REGATTA_BLURB, FLEETS, RIVALS, fleetFor, ordinal } from '../world/regatta.js';
import { BOAT_TYPES, BOAT_ORDER } from '../physics/boat.js';
import { drawBoat, drawSailFlat, VISUAL } from '../render/boat.js';
import { isUnlocked, totalStars, isDailyUnlocked, currentStreak, DAILY_UNLOCK, isBoatUnlocked, selectedBoat } from '../platform/save.js';
import { dateKey, dailyId } from '../data/daily.js';
import { MEDALS, isEarned, medalsEarned, medalProgress } from '../data/medals.js';
import { SAILS, HULLS, GEAR_TOTAL, boatLook, fittedGear, gearCount, isGearUnlocked, medalFor, rewardFor } from '../data/locker.js';
import { icon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function stars(n, total = 3) {
  let s = '';
  for (let i = 0; i < total; i++) s += `<span class="${i < n ? 'on' : ''}">★</span>`;
  return s;
}

function hazardsOf(def) {
  const out = [];
  if ((def.rocks || []).some((r) => r.material === 'coral')) out.push(['Coral reefs', true]);
  else if ((def.rocks || []).length) out.push(['Rocks', true]);
  if ((def.currents || []).length) out.push(['Currents', false]);
  if ((def.whirlpools || []).length) out.push(['Whirlpools', true]);
  if ((def.calms || []).length) out.push(['Calm patches', false]);
  if ((def.storms || []).length) out.push(['Squalls', true]);
  if ((def.krakens || []).length) out.push(['Kraken', true]);
  if ((def.floes || []).length) out.push(['Drifting ice', true]);
  const w = def.weather || {};
  if (w.fog) out.push(['Fog', false]);
  if (w.night) out.push(['Night', false]);
  if (w.lightning) out.push(['Lightning', false]);
  if (w.snow) out.push(['Snow', false]);
  if ((def.wind.events || []).length) out.push(['Wind shifts', false]);
  return out;
}

function windSentence(def) {
  const kn = toKnots(def.wind.speed);
  const bf = beaufort(kn);
  return `${Math.round(kn)} kn from the ${compassPoint(def.wind.from)} · ${bf.name}`;
}

// "Wed 28 Oct" for a YYYY-MM-DD key, in the phone's language.
function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

// Comparison with the previous best, or nothing on a first run.
const BOAT_STATS = [
  ['speed', 'Speed'],
  ['pointing', 'Upwind'],
  ['stability', 'Stability'],
  ['agility', 'Agility'],
  ['toughness', 'Toughness'],
];

function statBar(n) {
  let dots = '';
  for (let i = 1; i <= 5; i++) dots += `<i class="${i <= n ? 'on' : ''}"></i>`;
  return `<span class="bar" aria-label="${n} of 5">${dots}</span>`;
}

// A boat on a reach over a patch of open water, for the Shipyard cards and
// the Sail Locker.
function paintBoat(canvas, type, look) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 160;
  const h = canvas.clientHeight || 84;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const sea = ctx.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#0f4a5c');
  sea.addColorStop(1, '#0a3442');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(190, 235, 240, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = ((i * 37) % h) + 6;
    const x = (i * 53) % w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 9, y - 3, x + 18, y);
    ctx.stroke();
  }
  // The sail swings out to the lower side, so the hull sits high.
  const scale = Math.min(w / 24, h / 15);
  ctx.translate(w * 0.5, h * 0.36);
  ctx.scale(scale / VISUAL, scale / VISUAL);
  const boat = { type, x: 0, y: 0, vx: 0, vy: 0, heading: -0.3, heel: 0.42, boom: 0.7, drive: 4, luffing: false, rudder: 0, boostTime: 0 };
  drawBoat(ctx, boat, 0, { look });
}

// A sail hanging on the locker wall.
function paintSail(canvas, look) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 116;
  const h = canvas.clientHeight || 56;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#3b2a1e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 1;
  for (let x = 9; x < w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  const sh = h * 0.84;
  drawSailFlat(ctx, look, w / 2 - sh * 0.26, h * 0.07, sh);
}

function vsBest(time, prev) {
  if (prev === null || prev === undefined) return '';
  const d = time - prev;
  const txt = Math.abs(d) < 0.05 ? 'Dead heat' : d < 0 ? `${(-d).toFixed(1)} s faster` : `${d.toFixed(1)} s slower`;
  return `<span class="k">Vs. best</span><span class="v"${d < 0 ? ' style="color:var(--ok)"' : ''}>${txt}</span>`;
}

// The medals a voyage just earned, for the results card.
function medalStrip(medals = []) {
  if (!medals.length) return '';
  const chips = medals.map((m) => `<span class="medal-chip">${icon(m.icon, 18)}${esc(m.name)}</span>`).join('');
  const gear = medals.map((m) => rewardFor(m.id)).filter(Boolean);
  const note = gear.length ? `<p class="locker-note">New in the Sail Locker: ${gear.map((r) => esc(r.label)).join(', ')}</p>` : '';
  return `<div class="medal-strip"><span class="eyebrow">New medal${medals.length > 1 ? 's' : ''}</span>${chips}${note}</div>`;
}

function polarSvg() {
  // Speed by heading, drawn as the classic polar curve with the no-go wedge.
  const cx = 110;
  const cy = 112;
  const R = 82;
  let d = '';
  for (let side of [1, -1]) {
    for (let i = 0; i <= 18; i++) {
      const twa = i * 10;
      const v = POLAR[i] / 1.11;
      const a = (-90 + side * twa) * DEG;
      const x = cx + Math.cos(a) * R * v;
      const y = cy + Math.sin(a) * R * v;
      d += `${i === 0 && side === 1 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
  }
  const p = (deg, r) => [cx + Math.cos((deg - 90) * DEG) * r, cy + Math.sin((deg - 90) * DEG) * r];
  const [n1x, n1y] = p(-35, R);
  const [n2x, n2y] = p(35, R);
  const label = (deg, r, txt, anchor = 'start') => {
    const [x, y] = p(deg, r);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${txt}</text>`;
  };
  return `<svg viewBox="-40 0 300 230" role="img" aria-label="Boat speed for each heading relative to the wind">
    <g font-family="Barlow Condensed, sans-serif" font-size="12" font-weight="700" fill="#e8f4f2">
    <path d="M${cx} ${cy} L${n1x.toFixed(1)} ${n1y.toFixed(1)} A${R} ${R} 0 0 1 ${n2x.toFixed(1)} ${n2y.toFixed(1)} Z" fill="rgba(255,77,77,0.25)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(232,244,242,0.2)"/>
    <circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="rgba(232,244,242,0.12)"/>
    <path d="${d}Z" fill="rgba(214,62,169,0.18)" stroke="#d63ea9" stroke-width="2.5"/>
    <path d="M${cx} 4 L${cx} 24" stroke="#d9a441" stroke-width="3"/>
    <path d="M${cx - 6} 18 L${cx} 28 L${cx + 6} 18 Z" fill="#d9a441"/>
    <text x="${cx + 8}" y="16" fill="#d9a441">WIND</text>
    <text x="${cx}" y="${cy - R * 0.55}" text-anchor="middle" fill="#ff9a9a">NO-GO</text>
    ${label(50, R + 6, 'Close-hauled')}
    ${label(92, R + 4, 'Beam reach')}
    ${label(138, R + 10, 'Broad reach')}
    ${label(180, R + 16, 'Run', 'middle')}
    <path d="M${cx} ${cy - 9} Q${cx + 5} ${cy} ${cx + 3} ${cy + 9} L${cx - 3} ${cy + 9} Q${cx - 5} ${cy} ${cx} ${cy - 9} Z" fill="#e8f4f2"/>
    </g></svg>`;
}

function tackSvg() {
  return `<svg viewBox="0 0 200 230" role="img" aria-label="Zig-zag course upwind">
    <g font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic">
    <path d="M30 6 L30 30 M24 22 L30 32 L36 22" stroke="#d9a441" stroke-width="3" fill="none"/>
    <circle cx="110" cy="30" r="16" fill="none" stroke="#ff6b35" stroke-width="2.5" stroke-dasharray="6 4"/>
    <text x="110" y="37" text-anchor="middle" font-size="20" fill="#ff6b35">B</text>
    <path d="M100 210 L60 160 L150 110 L70 62 L104 40" fill="none" stroke="#d63ea9" stroke-width="2.5" stroke-dasharray="7 5"/>
    <text x="100" y="226" text-anchor="middle" font-size="18" fill="#d9a441">A</text>
    <path d="M100 210 L140 160" stroke="rgba(255,77,77,0.6)" stroke-width="2"/>
    <path d="M100 210 L100 60" stroke="rgba(255,77,77,0.35)" stroke-width="2" stroke-dasharray="3 5"/>
    <text x="146" y="160" font-size="12" fill="#ff9a9a">✕</text>
    <g fill="#e8f4f2"><circle cx="60" cy="160" r="4"/><circle cx="150" cy="110" r="4"/><circle cx="70" cy="62" r="4"/></g>
    <text x="160" y="104" font-size="12" font-style="normal" font-weight="700" fill="#e8f4f2">tack</text>
    </g></svg>`;
}

function trimSvg() {
  const boat = (x, y, boom, label) => {
    const bx = x + Math.sin(boom * DEG) * 38;
    const by = y + Math.cos(boom * DEG) * 38;
    return `<g>
      <path d="M${x} ${y - 34} Q${x + 13} ${y} ${x + 9} ${y + 30} L${x - 9} ${y + 30} Q${x - 13} ${y} ${x} ${y - 34} Z" fill="#8b5a3a"/>
      <path d="M${x} ${y - 8} L${bx.toFixed(1)} ${by.toFixed(1)}" stroke="#f5f0e4" stroke-width="5" stroke-linecap="round"/>
      <text x="${x}" y="${y + 52}" text-anchor="middle" font-size="13" fill="#e8f4f2">${label}</text></g>`;
  };
  return `<svg viewBox="0 0 220 200" role="img" aria-label="Sheet in upwind, ease out downwind">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700">
    <path d="M110 4 L110 22 M104 15 L110 25 L116 15" stroke="#d9a441" stroke-width="3" fill="none"/>
    ${boat(55, 100, 8, 'Upwind: sheet in')}
    ${boat(165, 100, 70, 'Downwind: ease out')}
    </g></svg>`;
}

function heelSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="Boat heeling in a gust">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13">
    <path d="M10 70 L60 70 M50 62 L62 70 L50 78" stroke="#d9a441" stroke-width="3" fill="none"/>
    <text x="10" y="58" fill="#d9a441">GUST</text>
    <rect x="0" y="150" width="220" height="50" fill="rgba(15,76,92,0.8)"/>
    <g transform="rotate(28 120 150)">
      <path d="M90 140 L150 140 L140 165 L100 165 Z" fill="#8b5a3a"/>
      <path d="M120 140 L120 40" stroke="#4a3220" stroke-width="4"/>
      <path d="M120 45 L120 135 L160 135 Z" fill="#f5f0e4"/>
    </g>
    <path d="M150 30 A90 90 0 0 1 200 110" fill="none" style="stroke: var(--danger)" stroke-width="2.5" stroke-dasharray="5 4"/>
    <text x="160" y="24" fill="#ff9a9a">capsize!</text>
    </g></svg>`;
}

function helmSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="Drag the wheel left or right to steer">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="14" fill="#e8f4f2">
    <g transform="translate(110 92)">
      <circle r="62" fill="rgba(4,22,30,0.55)" stroke="rgba(232,244,242,0.35)" stroke-width="2"/>
      <circle r="40" fill="none" stroke="#d9a441" stroke-width="7"/>
      <g stroke="#d9a441" stroke-width="5" stroke-linecap="round">
        <path d="M0 -40 L0 -54"/><path d="M0 40 L0 54"/><path d="M-40 0 L-54 0"/><path d="M40 0 L54 0"/>
        <path d="M28 -28 L38 -38"/><path d="M-28 28 L-38 38"/><path d="M28 28 L38 38"/><path d="M-28 -28 L-38 -38"/></g>
      <circle r="9" fill="#d9a441"/>
      <path d="M-74 0 l12 -9 v18 Z M74 0 l-12 -9 v18 Z" fill="#ff6b35"/>
      <circle cx="26" cy="10" r="14" fill="rgba(255,255,255,0.22)" stroke="#fff" stroke-width="2"/>
    </g>
    <text x="30" y="186" text-anchor="middle">port</text><text x="190" y="186" text-anchor="middle">starboard</text>
    <text x="110" y="186" text-anchor="middle" fill="#9fb8bd">A / D on a keyboard</text>
    </g></svg>`;
}

function hazardsSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="Hazards">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13" fill="#e8f4f2">
    <g transform="translate(45 45)"><circle r="30" fill="rgba(2,10,16,0.6)"/>
      <path d="M0 0 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0" fill="none" stroke="#e8f4f2" stroke-width="1.6"/></g>
    <text x="45" y="92" text-anchor="middle">Whirlpool</text>
    <g transform="translate(160 45)" stroke="#bfeaf0" stroke-width="2.5" fill="none">
      <path d="M-30 -14 l8 8 l-8 8 M-8 -14 l8 8 l-8 8 M14 -14 l8 8 l-8 8"/><path d="M-30 10 l8 8 l-8 8 M-8 10 l8 8 l-8 8 M14 10 l8 8 l-8 8"/></g>
    <text x="160" y="92" text-anchor="middle">Current</text>
    <g transform="translate(45 140)"><circle r="28" fill="rgba(170,222,226,0.3)"/><path d="M-16 -4 h32 M-12 6 h24" stroke="#e8f4f2" stroke-width="2"/></g>
    <text x="45" y="186" text-anchor="middle">Calm / wind shadow</text>
    <g transform="translate(160 140)"><circle r="28" fill="rgba(4,22,30,0.7)" style="stroke: var(--danger)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="M-12 8 q-6 -14 4 -20 M2 10 q2 -16 12 -18 M12 12 q10 -6 6 -18" stroke="#a5648c" stroke-width="5" fill="none" stroke-linecap="round"/></g>
    <text x="160" y="186" text-anchor="middle">Kraken</text>
    </g></svg>`;
}

function pickupsSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="Pickups">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13" fill="#e8f4f2" text-anchor="middle">
    <g transform="translate(55 50) scale(2.4)"><path d="M0 5 L-8 4 A8.5 9 0 0 1 8 4 Z" fill="#e9a8b5"/><circle cy="1" r="3.6" fill="#fbf6ee"/></g>
    <text x="55" y="88">Pearl</text>
    <g transform="translate(160 48) scale(2.4)"><rect x="-5.5" y="-6" width="11" height="13" rx="3" fill="rgba(120,220,240,0.35)" stroke="#bff3ff" stroke-width="1.2"/><rect x="-3.5" y="-8.5" width="7" height="3" fill="#8a6a3c"/></g>
    <text x="160" y="88">Gust jar</text>
    <g transform="translate(55 140) scale(2.4) rotate(12)"><rect x="-6" y="-6" width="12" height="12" fill="#9b6a3f" stroke="#5e3b25"/><rect x="-1.2" y="-4" width="2.4" height="8" style="fill: var(--ok)"/><rect x="-4" y="-1.2" width="8" height="2.4" style="fill: var(--ok)"/></g>
    <text x="55" y="180">Repair crate</text>
    <g transform="translate(160 140) scale(2.4) rotate(-35)"><rect x="-8" y="-3.5" width="12" height="7" rx="3" fill="rgba(90,170,110,0.9)"/><rect x="4" y="-1.8" width="4" height="3.6" fill="rgba(90,170,110,0.9)"/><rect x="7.5" y="-1.6" width="2.4" height="3.2" fill="#c9a36a"/><rect x="-5.5" y="-1.6" width="7" height="3.2" fill="#f2e6c8"/></g>
    <text x="160" y="180">Message in a bottle</text>
    </g></svg>`;
}

const HOWTO = [
  {
    title: 'The wind is your engine',
    svg: polarSvg,
    body: `<p>Your oar is gone, so the sail is all you have. The pink curve shows how fast you go on each heading. <b>Wind across the boat (a beam reach) is fastest.</b></p>
      <p>Pointing straight into the wind is the <b>no-go zone</b>: the sail just flaps and you stop. The shaded wedge on the wind dial marks it.</p>`,
  },
  {
    title: 'Steer with the wheel',
    svg: helmSvg,
    body: `<p><b>Touch:</b> put your thumb down anywhere on the left and slide it left or right. <b>Keyboard:</b> A / D or the arrow keys.</p>
      <p>The rudder needs water flowing past it, so steering is sluggish when you are slow. The streaks on the water show where the wind blows; dark ruffled patches are gusts, pale glassy water is a lull.</p>`,
  },
  {
    title: 'Zig-zag to go upwind',
    svg: tackSvg,
    body: `<p>If B is upwind, sail about 45° off the wind on one side, then turn through the wind and sail 45° off on the other. That's called <b>tacking</b>.</p>
      <p>Keep your speed up before you turn, or the boat stalls in the no-go zone (<b>in irons</b>). Downwind, turning your stern through the wind is a <b>gybe</b>: the boom swings hard!</p>`,
  },
  {
    title: 'Trim the sail',
    svg: trimSvg,
    body: `<p>By default the sail trims itself. Expert sailors can switch to <b>manual trim</b> in Settings: drag the slider on the right, or use W / S.</p>
      <p><b>Sheet in</b> (pull the sail tight) when heading upwind; <b>ease out</b> when the wind is behind you. Flapping (<b>luffing</b>) means it's too loose; <b>stalled</b> means it's too tight. Keep the marker in the bright sweet-spot band.</p>`,
  },
  {
    title: 'Heel, gusts and capsizing',
    svg: heelSvg,
    body: `<p>Strong wind leans the boat over. Past about 40° the heel meter hits its danger zone; push further and you <b>capsize</b>, losing time and hull.</p>
      <p>To recover, ease the sail out or turn away from the wind. A <b>gust jar</b> gives a burst of bottled wind: great for escaping whirlpools or calms.</p>`,
  },
  {
    title: 'Hazards',
    svg: hazardsSvg,
    body: `<p><b>Rocks and reefs</b> crack the hull. <b>Currents</b> carry you along, so aim upstream to cross. <b>Whirlpools</b> drag you to the eye. <b>Calm patches</b> and the lee of islands steal your wind.</p>
      <p><b>Squalls</b> bring savage gusts. In the fog lives a <b>kraken</b>: when the water boils, get out of the ring. Reach a buoy to save your spot.</p>`,
  },
  {
    title: 'Pickups',
    svg: pickupsSvg,
    body: `<p><b>Pearls</b> are treasure: collect them all on a voyage. <b>Gust jars</b> hold a burst of wind (up to three). <b>Repair crates</b> patch the hull.</p>
      <p><b>Bottles</b> carry notes from sailors who came before you. They're kept in your Logbook.</p>`,
  },
];

// Text size steps for the menus, as multiples of the normal size.
export const TEXT_SIZES = [1, 1.15, 1.3];

export function createUI(root, levels, handlers) {
  const screens = {};
  let current = null;
  let stack = [];
  let howtoPage = 0;
  let lastBriefing = 0;
  const toasts = root.querySelector('#toasts');

  // A voyage is referred to by its campaign index or as 'daily'.
  const defOf = (ref) => (ref === 'daily' ? handlers.daily() : levels[ref]);
  const recordOf = (save, def) => (def.daily ? save.daily : save.levels)[def.id];

  // Charting today's course can take a moment on a slow phone, so the button
  // says so until the briefing is ready.
  function openDaily(save, button, busyLabel) {
    if (!isDailyUnlocked(save, levels)) {
      ui.toast(`Finish the first ${DAILY_UNLOCK} voyages to unlock the daily voyage.`);
      return;
    }
    const label = busyLabel.textContent;
    const screen = current;
    busyLabel.textContent = "Charting today's course…";
    button.disabled = true;
    handlers.chartDaily((def) => {
      if (current !== screen) return; // the player moved on meanwhile
      if (def) {
        ui.briefing('daily', save);
        return;
      }
      busyLabel.textContent = label;
      button.disabled = false;
      ui.toast("Today's course couldn't be charted. Try again later.", 'warn');
    });
  }

  // Tips wait their turn so they never pile up over the course.
  let tipQueue = [];

  function dismiss(node) {
    clearTimeout(node._timer);
    if (node.classList.contains('out')) return;
    node.classList.add('out');
    setTimeout(() => {
      node.remove();
      if (node.classList.contains('tip') && tipQueue.length) {
        const next = tipQueue.shift();
        ui.toast(next.text, 'tip', next.ms);
      }
    }, 380);
  }

  function hold(node, ms) {
    clearTimeout(node._timer);
    node._until = performance.now() + ms;
    node._timer = setTimeout(() => dismiss(node), ms);
  }

  function mount(name, node) {
    if (screens[name]) screens[name].remove();
    screens[name] = node;
    root.appendChild(node);
    // Force layout so the fade-in transition runs.
    void node.offsetWidth;
    node.classList.add('open');
  }

  function close(name) {
    const node = screens[name];
    if (!node) return;
    delete screens[name];
    node.classList.remove('open');
    setTimeout(() => node.remove(), 260);
  }

  // `push` remembers the current screen for Back; `keep` leaves the history
  // alone (used when Back returns to a screen that has to be redrawn).
  function show(name, node, { push = false, keep = false } = {}) {
    if (current && current !== name) {
      if (push) stack.push(current);
      else if (!keep) stack = [];
      close(current);
    }
    current = name;
    mount(name, node);
    handlers.onScreen(name);
    const first = node.querySelector('[data-autofocus]') || node.querySelector('button');
    if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
  }

  function click(node, sel, fn) {
    node.querySelectorAll(sel).forEach((b) =>
      b.addEventListener('click', (e) => {
        handlers.onClick();
        fn(e, b);
      }),
    );
  }

  const ui = {
    get current() {
      return current;
    },

    get lastBriefing() {
      return lastBriefing;
    },

    hide() {
      if (current) close(current);
      current = null;
      stack = [];
      handlers.onScreen(null);
    },

    title(save) {
      const nextIndex = levels.findIndex((l) => !save.levels[l.id] || save.levels[l.id].best === null);
      const resume = nextIndex === -1 ? levels.length - 1 : nextIndex;
      const today = dateKey();
      const dailyOpen = isDailyUnlocked(save, levels);
      const sailedToday = !!save.daily[dailyId(today)];
      const streak = currentStreak(save, today);
      const node = el(`<section class="screen scrim" aria-label="Title">
        <div class="title-wrap">
          <div class="eyebrow">A sailing voyage</div>
          <h1 class="logo" aria-label="No Paddle">NO <span>PADDLE</span></h1>
          <p class="tagline">A squall snapped your oar. Now only the wind can carry you from <b>A</b> to <b>B</b>. Read it, ride it, and don't capsize.</p>
          <div class="title-buttons">
            <button class="btn primary" data-act="play" data-autofocus>${save.stats.voyages ? 'Set sail' : 'Start voyage'}</button>
            <button class="btn" data-act="voyages">Voyages</button>
            <button class="btn" data-act="howto">How to sail</button>
          </div>
          <div class="title-buttons">
            ${dailyOpen ? `<button class="btn small ${sailedToday ? '' : 'fresh'}" data-act="daily">Daily voyage</button>` : ''}
            ${dailyOpen ? `<button class="btn small ${save.openSea.runs ? '' : 'fresh'}" data-act="sea">Open Sea</button>` : ''}
            ${dailyOpen ? `<button class="btn small ${save.regatta.races ? '' : 'fresh'}" data-act="regatta">Regatta</button>` : ''}
            <button class="btn small ${gearCount(save) > save.gearSeen ? 'fresh' : ''}" data-act="shipyard">Shipyard</button>
            <button class="btn small ${medalsEarned(save) > save.medalsSeen ? 'fresh' : ''}" data-act="medals">Medals</button>
            <button class="btn small" data-act="logbook">Logbook</button>
            <button class="btn small" data-act="settings">Settings</button>
          </div>
          <div class="title-meta"><span>★ <b>${totalStars(save)}</b> / ${levels.length * 3}</span><span>Voyage ${resume + 1} of ${levels.length}</span><span>Medals <b>${medalsEarned(save)}</b> / ${MEDALS.length}</span>${streak ? `<span>Streak <b>${streak}</b></span>` : ''}<span>v${esc(globalThis.BOATIFY_VERSION || 'dev')}</span></div>
        </div>
      </section>`);
      click(node, '[data-act=play]', () => (save.seenIntro ? ui.briefing(resume, save) : ui.howto(save, true, resume)));
      click(node, '[data-act=voyages]', () => ui.voyages(save, true));
      click(node, '[data-act=daily]', (e, b) => openDaily(save, b, b));
      click(node, '[data-act=sea]', () => ui.seaBriefing(save));
      click(node, '[data-act=regatta]', () => ui.regattaBriefing(save));
      click(node, '[data-act=howto]', () => ui.howto(save));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      click(node, '[data-act=medals]', () => ui.medals(save));
      click(node, '[data-act=logbook]', () => ui.logbook(save));
      click(node, '[data-act=settings]', () => ui.settings(save));
      show('title', node);
    },

    voyages(save, push = false) {
      const cards = levels
        .map((l, i) => {
          const rec = save.levels[l.id];
          const open = isUnlocked(save, levels, i);
          const isNext = open && (!rec || rec.best === null);
          return `<button class="voyage ${open ? '' : 'locked'} ${isNext ? 'next' : ''}" data-i="${i}" ${open ? '' : 'aria-disabled="true"'}>
            <span class="num">${String(i + 1).padStart(2, '0')}</span>
            <span class="name">${esc(l.name)}</span>
            <span class="stars">${stars(rec ? rec.stars : 0)}</span>
            <span class="best">${rec && rec.best !== null ? `Best ${formatTime(rec.best)} · ◆ ${rec.pearls}/${rec.pearlsTotal ?? '?'}` : open ? 'Not sailed yet' : 'Finish the last voyage'}</span>
          </button>`;
        })
        .join('');
      const today = dateKey();
      const dailyOpen = isDailyUnlocked(save, levels);
      const dailyRec = save.daily[dailyId(today)];
      const charted = handlers.dailyPeek();
      const streak = currentStreak(save, today);
      const dailyLine = !dailyOpen
        ? `Finish voyage ${DAILY_UNLOCK} to unlock`
        : dailyRec
          ? `Best ${formatTime(dailyRec.best)}${streak ? ` · Streak ${streak}` : ''}`
          : streak
            ? `Streak ${streak} · keep it going`
            : 'A new course every day';
      const dailyCard = `<button class="voyage daily ${dailyOpen ? '' : 'locked'}" data-act="daily" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">Daily</span>
            <span class="name">${esc(charted ? charted.name : dayLabel(today))}</span>
            <span class="stars">${stars(dailyRec ? dailyRec.stars : 0)}</span>
            <span class="best">${dailyLine}</span>
          </button>`;
      const sea = save.openSea;
      const seaCard = `<button class="voyage sea ${dailyOpen ? '' : 'locked'}" data-act="sea" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">Endless</span>
            <span class="name">Open Sea</span>
            <span class="stars">${sea.runs ? `⚑ ${sea.gates}` : ''}</span>
            <span class="best">${!dailyOpen ? `Finish voyage ${DAILY_UNLOCK} to unlock` : sea.runs ? `Furthest ${formatDistance(sea.best)}` : 'How far east can you sail?'}</span>
          </button>`;
      const race = save.regatta;
      const raceCard = `<button class="voyage regatta ${dailyOpen ? '' : 'locked'}" data-act="regatta" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">Race</span>
            <span class="name">Regatta</span>
            <span class="stars">${race.wins ? `🏆 ${race.wins}` : ''}</span>
            <span class="best">${!dailyOpen ? `Finish voyage ${DAILY_UNLOCK} to unlock` : race.races ? `${FLEETS[fleetFor(race.wins)].name} fleet · ${race.races} raced` : 'Race three rival boats'}</span>
          </button>`;
      const node = el(`<section class="screen dim" aria-label="Voyages">
        <div class="sheet">
          <div class="sheet-head"><h2>Voyages</h2><span class="eyebrow">★ ${totalStars(save)} / ${levels.length * 3}</span><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body"><div class="voyage-grid">${dailyCard}${seaCard}${raceCard}${cards}</div></div>
        </div></section>`);
      click(node, '.voyage[data-i]', (e, b) => {
        const i = Number(b.dataset.i);
        if (!isUnlocked(save, levels, i)) {
          ui.toast('Finish the previous voyage to unlock this one.');
          return;
        }
        ui.briefing(i, save);
      });
      click(node, '.voyage.daily', (e, b) => openDaily(save, b, b.querySelector('.best')));
      click(node, '.voyage.sea', () => {
        if (!isDailyUnlocked(save, levels)) ui.toast(`Finish the first ${DAILY_UNLOCK} voyages to unlock the Open Sea.`);
        else ui.seaBriefing(save, 'push');
      });
      click(node, '.voyage.regatta', () => {
        if (!isDailyUnlocked(save, levels)) ui.toast(`Finish the first ${DAILY_UNLOCK} voyages to unlock the Regatta.`);
        else ui.regattaBriefing(save, 'push');
      });
      click(node, '[data-act=back]', () => ui.back());
      show('voyages', node, { push });
    },

    // `how`: 'push' from a menu, 'replace' to take the current screen's
    // place, 'restore' when coming back to it.
    briefing(index, save, how = 'push') {
      if (index === 'sea') {
        ui.seaBriefing(save, how);
        return;
      }
      if (index === 'regatta') {
        ui.regattaBriefing(save, how);
        return;
      }
      const def = defOf(index);
      const rec = recordOf(save, def);
      const streak = def.daily ? currentStreak(save, def.daily) : 0;
      const chips = hazardsOf(def)
        .map(([name, bad]) => `<span class="chip ${bad ? 'danger' : ''}">${name}</span>`)
        .join('');
      const pearls = (def.pickups || []).filter((p) => p.kind === 'pearl').length;
      const node = el(`<section class="screen dim" aria-label="Voyage briefing">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">${def.daily ? `Daily voyage · ${esc(dayLabel(def.daily))}` : `Voyage ${index + 1}`}</span><h2>${esc(def.name)}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(def.blurb)}</p>
            <div>
              <div class="eyebrow">Conditions</div>
              <dl class="facts">
                <dt>Wind</dt><dd>${windSentence(def)}</dd>
                <dt>Goal</dt><dd>Reach the ${def.finish.kind === 'lighthouse' ? 'lighthouse' : 'harbor'} at <b style="color:var(--signal)">B</b></dd>
                <dt>Pearls</dt><dd>${pearls}</dd>
                <dt>Boat</dt><dd>${esc(BOAT_TYPES[selectedBoat(save)].name)} <button class="link" data-act="shipyard">Change</button></dd>
              </dl>
              <div class="chips">${chips}</div>
            </div>
            <div>
              <div class="eyebrow">Times</div>
              <dl class="facts">
                <dt style="color:var(--brass)">★★★</dt><dd>under ${formatTime(def.par.gold)}</dd>
                <dt>★★</dt><dd>under ${formatTime(def.par.silver)}</dd>
                <dt>Best</dt><dd>${rec && rec.best !== null ? `${formatTime(rec.best)} <span style="color:var(--brass)">${'★'.repeat(rec.stars)}</span>` : '—'}</dd>
                ${def.daily ? `<dt>Streak</dt><dd>${streak ? days(streak) : 'Finish today to start one'}</dd>` : ''}
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="go" data-autofocus>Set sail</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay(index));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = index;
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    seaBriefing(save, how = 'push') {
      const rec = save.openSea;
      const medal = MEDALS.find((m) => m.id === 'far-horizon');
      const [have, need] = medalProgress(medal, save, levels);
      const node = el(`<section class="screen dim" aria-label="Open Sea briefing">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">Endless</span><h2>Open Sea</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(SEA_BLURB)}</p>
            <div>
              <div class="eyebrow">How it works</div>
              <dl class="facts">
                <dt>Clock</dt><dd>Counts down from about a minute</dd>
                <dt>Gates</dt><dd>Sail between the two buoys to add the next leg's time</dd>
                <dt>Pearls</dt><dd>+${PEARL_TIME} s each</dd>
                <dt>Hull</dt><dd>If she sinks, the run is over</dd>
                <dt>Boat</dt><dd>${esc(BOAT_TYPES[selectedBoat(save)].name)} <button class="link" data-act="shipyard">Change</button></dd>
              </dl>
            </div>
            <div>
              <div class="eyebrow">Records</div>
              <dl class="facts">
                <dt>Furthest</dt><dd>${rec.runs ? formatDistance(rec.best) : '—'}</dd>
                <dt>Most gates</dt><dd>${rec.runs ? rec.gates : '—'}</dd>
                <dt>Runs</dt><dd>${rec.runs}</dd>
                <dt>Medal</dt><dd>${isEarned(save, medal.id) ? `${esc(medal.name)} <span style="color:var(--brass)">earned</span>` : `${esc(medal.name)}: ${have} / ${need} km`}</dd>
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="go" data-autofocus>Set sail</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay('sea'));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = 'sea';
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    regattaBriefing(save, how = 'push') {
      const rec = save.regatta;
      const fleet = FLEETS[fleetFor(rec.wins)];
      const medal = MEDALS.find((m) => m.id === 'line-honours');
      const rivals = RIVALS.map((r) => `<span class="chip" style="color:${r.look.sail}">${esc(r.name)} · ${esc(BOAT_TYPES[r.boat].name)}</span>`).join('');
      const node = el(`<section class="screen dim" aria-label="Regatta briefing">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">${esc(fleet.name)} fleet</span><h2>Regatta</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(REGATTA_BLURB)}</p>
            <div>
              <div class="eyebrow">The course</div>
              <dl class="facts">
                <dt>Legs</dt><dd>Mark <b style="color:var(--warn)">1</b>, mark <b style="color:var(--warn)">2</b>, then the harbor at <b style="color:var(--signal)">B</b></dd>
                <dt>Fleet</dt><dd>${esc(fleet.name)}${fleet.id === 'championship' ? '' : `: win ${fleet.id === 'club' ? 1 : 3 - rec.wins} more to step up`}</dd>
                <dt>Boat</dt><dd>${esc(BOAT_TYPES[selectedBoat(save)].name)} <button class="link" data-act="shipyard">Change</button></dd>
              </dl>
              <div class="chips">${rivals}</div>
            </div>
            <div>
              <div class="eyebrow">Records</div>
              <dl class="facts">
                <dt>Wins</dt><dd>${rec.wins} of ${rec.races}</dd>
                <dt>Podiums</dt><dd>${rec.podiums}</dd>
                <dt>Best win</dt><dd>${rec.best !== null ? formatTime(rec.best) : '—'}</dd>
                <dt>Medal</dt><dd>${esc(medal.name)}${isEarned(save, medal.id) ? ' <span style="color:var(--brass)">earned</span>' : ': win a race'}</dd>
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="go" data-autofocus>Race</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay('regatta'));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = 'regatta';
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    pause(game, save) {
      const sea = game.sea;
      const race = game.race;
      const marks = game.level.checkpoints.length;
      const rows = sea
        ? `<span class="k">Clock</span><span class="v">${formatTime(sea.clock)}</span>
              <span class="k">Distance</span><span class="v">${formatDistance(sea.best)} · ⚑ ${sea.gates}</span>`
        : race
          ? `<span class="k">Time</span><span class="v">${formatTime(game.time)}</span>
              <span class="k">Place</span><span class="v">${ordinal(race.place || 1)} of ${race.rivals.length + 1}</span>
              <span class="k">Leg</span><span class="v">${game.nextCheckpoint < marks ? `To mark ${game.nextCheckpoint + 1}` : 'To the harbor'}</span>`
          : `<span class="k">Time</span><span class="v">${formatTime(game.time)}</span>
              <span class="k">Pearls</span><span class="v">${game.pearls} / ${game.pearlsTotal}</span>`;
      const node = el(`<section class="screen dim" aria-label="Paused">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>Paused</h2><span class="eyebrow">${esc(game.level.name)}</span></div>
          <div class="sheet-body">
            <div class="stat-rows">
              ${rows}
              <span class="k">Hull</span><span class="v">${Math.ceil(game.hull)}%</span>
            </div>
            <div class="setting" style="margin-top:8px">
              <span class="label"><b>Trim the sail by hand</b><small>Off: the sail trims itself</small></span>
              <button class="toggle" role="switch" data-set="manual" aria-checked="${!save.settings.autoTrim}" aria-label="Manual trim"></button>
            </div>
            <div class="setting">
              <span class="label"><b>Sound</b></span>
              <button class="toggle" role="switch" data-set="sound" aria-checked="${save.settings.sound}" aria-label="Sound"></button>
            </div>
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="quit">Voyages</button>
            <button class="btn small" data-act="restart">Restart</button>
            <button class="btn primary" data-act="resume" data-autofocus>Resume</button>
          </div>
        </div></section>`);
      click(node, '[data-set=manual]', (e, b) => {
        save.settings.autoTrim = !save.settings.autoTrim;
        b.setAttribute('aria-checked', String(!save.settings.autoTrim));
        handlers.onSettings(save.settings);
      });
      click(node, '[data-set=sound]', (e, b) => {
        save.settings.sound = !save.settings.sound;
        b.setAttribute('aria-checked', String(save.settings.sound));
        handlers.onSettings(save.settings);
      });
      click(node, '[data-act=resume]', () => handlers.onResume());
      click(node, '[data-act=restart]', () => handlers.onRestart());
      click(node, '[data-act=quit]', () => handlers.onQuit());
      show('pause', node);
    },

    results(index, result, improved, save) {
      tipQueue = []; // the voyage is over, its tips are moot
      const def = defOf(index);
      const hasNext = !def.daily && index + 1 < levels.length;
      const rec = recordOf(save, def);
      const streak = def.daily ? currentStreak(save, def.daily) : 0;
      const node = el(`<section class="screen dim" aria-label="Voyage complete">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><h2>${def.finish.kind === 'lighthouse' ? 'Lighthouse reached' : 'Harbor reached'}</h2></div>
          <div class="sheet-body">
            <div class="result-stars">${stars(0)}</div>
            <div class="stat-rows">
              <span class="k">Time</span><span class="v">${formatTime(result.time)}${improved.time && !improved.first ? '<span class="badge">NEW BEST</span>' : ''}</span>
              <span class="k">Best</span><span class="v">${formatTime(rec.best)}</span>
              ${vsBest(result.time, improved.prevBest)}
              <span class="k">Pearls</span><span class="v">${result.pearls} / ${result.pearlsTotal}${result.pearls === result.pearlsTotal && result.pearlsTotal ? '<span class="badge">ALL</span>' : ''}</span>
              <span class="k">Hull</span><span class="v">${Math.ceil(result.hull)}%</span>
              <span class="k">Capsizes</span><span class="v">${result.capsizes}</span>
              <span class="k">Next star</span><span class="v">${result.stars >= 3 ? 'Got them all' : `under ${formatTime(result.stars === 2 ? def.par.gold : def.par.silver)}`}</span>
              ${(improved.newBoats || []).map((name) => `<span class="k">Shipyard</span><span class="v">${esc(name)}<span class="badge">NEW BOAT</span></span>`).join('')}
              ${def.daily ? `<span class="k">Streak</span><span class="v">${days(streak)}${improved.first && streak > 1 ? '<span class="badge">+1</span>' : ''}</span>` : ''}
            </div>
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            ${hasNext ? '<button class="btn small" data-act="voyages">Voyages</button>' : ''}
            <button class="btn small" data-act="retry">Retry</button>
            ${hasNext ? '<button class="btn primary" data-act="next" data-autofocus>Next voyage</button>' : '<button class="btn primary" data-act="voyages" data-autofocus>Done</button>'}
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=next]', () => handlers.onPlay(index + 1));
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      show('results', node);
      const starEls = node.querySelectorAll('.result-stars span');
      starEls.forEach((s, i) => {
        if (i < result.stars) {
          setTimeout(() => {
            s.classList.add('on');
            handlers.onStar(i);
          }, 350 + i * 320);
        }
      });
      // New medals pop in once the stars have landed.
      const medalEls = node.querySelectorAll('.medal-chip');
      if (medalEls.length) {
        setTimeout(() => {
          if (current !== 'results') return;
          medalEls.forEach((m) => m.classList.add('on'));
          handlers.onMedal();
        }, 500 + result.stars * 320);
      }
    },

    seaResults(result, improved, save) {
      tipQueue = [];
      const rec = save.openSea;
      const node = el(`<section class="screen dim" aria-label="Run over">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><span class="eyebrow">Open Sea</span><h2>${result.reason === 'sunk' ? 'The hull gave out' : 'Out of time'}</h2></div>
          <div class="sheet-body">
            <div class="sea-distance">${formatDistance(result.distance)} <small>east</small>${improved.best && !improved.first ? '<span class="badge">NEW BEST</span>' : ''}</div>
            <div class="stat-rows">
              <span class="k">Furthest</span><span class="v">${formatDistance(rec.best)}</span>
              <span class="k">Gates</span><span class="v">${result.gates}${result.missed ? ` (${result.missed} missed)` : ''}${improved.gates && !improved.first ? '<span class="badge">MOST</span>' : ''}</span>
              <span class="k">Pearls</span><span class="v">${result.pearls}</span>
              <span class="k">Time at sea</span><span class="v">${formatTime(result.time)}</span>
              <span class="k">Capsizes</span><span class="v">${result.capsizes}</span>
            </div>
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="voyages">Voyages</button>
            <button class="btn primary" data-act="retry" data-autofocus>Sail again</button>
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      show('results', node);
      const medalEls = node.querySelectorAll('.medal-chip');
      if (medalEls.length) {
        setTimeout(() => {
          if (current !== 'results') return;
          medalEls.forEach((m) => m.classList.add('on'));
          handlers.onMedal();
        }, 500);
      }
    },

    raceResults(result, improved, save) {
      tipQueue = [];
      const rec = save.regatta;
      const fleet = FLEETS.find((f) => f.id === result.fleet) || FLEETS[0];
      const head = result.place === 1 ? 'You won!' : `${ordinal(result.place)} place`;
      const rows = result.standings
        .map((e, i) => {
          const time = e.time !== null ? formatTime(e.time) : e.marks < 2 ? `mark ${e.marks + 1}` : 'sailing';
          return `<span class="k">${ordinal(i + 1)}</span><span class="v ${e.player ? 'you' : ''}">${e.player ? '<b>You</b>' : esc(e.name)} <small>${time}</small></span>`;
        })
        .join('');
      const stepUp = fleetFor(rec.wins) > fleetFor(rec.wins - (improved.won ? 1 : 0));
      const node = el(`<section class="screen dim" aria-label="Race over">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><span class="eyebrow">Regatta · ${esc(fleet.name)} fleet</span><h2>${head}</h2></div>
          <div class="sheet-body">
            <div class="result-stars">${stars(0)}</div>
            <div class="stat-rows standings">${rows}</div>
            <div class="stat-rows">
              <span class="k">Time</span><span class="v">${formatTime(result.time)}${improved.time && !improved.firstWin ? '<span class="badge">BEST WIN</span>' : ''}</span>
              <span class="k">Bumps</span><span class="v">${result.bumps}</span>
              <span class="k">Wins</span><span class="v">${rec.wins} of ${rec.races}</span>
              ${stepUp ? `<span class="k">Next race</span><span class="v">${esc(FLEETS[fleetFor(rec.wins)].name)} fleet<span class="badge">STEP UP</span></span>` : ''}
            </div>
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="voyages">Voyages</button>
            <button class="btn primary" data-act="retry" data-autofocus>Race again</button>
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      show('results', node);
      node.querySelectorAll('.result-stars span').forEach((s, i) => {
        if (i < result.stars) {
          setTimeout(() => {
            s.classList.add('on');
            handlers.onStar(i);
          }, 350 + i * 320);
        }
      });
      const medalEls = node.querySelectorAll('.medal-chip');
      if (medalEls.length) {
        setTimeout(() => {
          if (current !== 'results') return;
          medalEls.forEach((m) => m.classList.add('on'));
          handlers.onMedal();
        }, 500 + result.stars * 320);
      }
    },

    // `restore` redraws it on the way back from the Sail Locker.
    shipyard(save, restore = false) {
      const chosen = selectedBoat(save);
      const have = totalStars(save);
      const gear = fittedGear(save);
      const cards = BOAT_ORDER.map((id) => {
        const t = BOAT_TYPES[id];
        const open = isBoatUnlocked(save, id);
        const picked = id === chosen;
        const action = picked
          ? '<button class="btn small" disabled>Sailing</button>'
          : open
            ? `<button class="btn small primary" data-boat="${id}">Choose</button>`
            : `<button class="btn small" data-boat="${id}" aria-disabled="true">★ ${t.unlock} to unlock</button>`;
        return `<div class="boat-card ${open ? '' : 'locked'} ${picked ? 'picked' : ''}">
            <canvas class="boat-art" data-type="${id}" aria-hidden="true"></canvas>
            <div class="boat-head"><h3>${esc(t.name)}</h3><span class="tag">${esc(t.tag)}</span></div>
            <p class="boat-blurb">${esc(t.blurb)}</p>
            <dl class="boat-stats">${BOAT_STATS.map(([k, label]) => `<dt>${label}</dt><dd>${statBar(t.stats[k])}</dd>`).join('')}</dl>
            ${action}
          </div>`;
      }).join('');
      const node = el(`<section class="screen dim" aria-label="Shipyard">
        <div class="sheet wide">
          <div class="sheet-head"><h2>Shipyard</h2><span class="eyebrow">★ ${have} / ${levels.length * 3}</span><button class="btn small ${gearCount(save) > save.gearSeen ? 'fresh' : ''}" data-act="locker">Sail Locker</button><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body"><p class="sheet-note">Earn stars on the voyages to unlock new boats. Each one handles the wind its own way.</p><div class="boat-grid">${cards}</div></div>
        </div></section>`);
      click(node, '[data-boat]', (e, b) => {
        const t = BOAT_TYPES[b.dataset.boat];
        if (!isBoatUnlocked(save, t.id)) {
          ui.toast(`Earn ${t.unlock - have} more ★ to unlock the ${t.name}.`);
          return;
        }
        handlers.onBoat(t.id);
        ui.back();
      });
      click(node, '[data-act=locker]', () => ui.locker(save));
      click(node, '[data-act=back]', () => ui.back());
      show('shipyard', node, restore ? { keep: true } : { push: true });
      node.querySelectorAll('canvas.boat-art').forEach((c) => {
        const type = BOAT_TYPES[c.dataset.type];
        paintBoat(c, type, boatLook(type, gear));
      });
    },

    locker(save) {
      const type = BOAT_TYPES[selectedBoat(save)];
      const card = (kind, g) => {
        const open = isGearUnlocked(save, g);
        const medal = medalFor(g);
        const sub = !medal ? `The ${esc(type.name.split(' ').pop().toLowerCase())}'s own` : open ? esc(medal.name) : `${icon('lock', 13)}${esc(medal.name)}`;
        return `<button class="gear ${open ? '' : 'locked'}" data-kind="${kind}" data-id="${g.id}" aria-label="${esc(g.name)}${open ? '' : ', locked'}">
            <canvas class="gear-art" aria-hidden="true"></canvas><b>${esc(g.name)}</b><small>${sub}</small></button>`;
      };
      const node = el(`<section class="screen dim" aria-label="Sail Locker">
        <div class="sheet wide">
          <div class="sheet-head"><h2>Sail Locker</h2><span class="eyebrow">${gearCount(save)} / ${GEAR_TOTAL}</span><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body">
            <div class="locker-top"><canvas class="locker-preview" aria-hidden="true"></canvas>
              <div><b class="locker-fit"></b><p class="locker-blurb">Every medal puts a new sail or hull paint in the locker. They change how your boat looks, never how it sails.</p></div></div>
            <h3 class="setting-group">Sails</h3>
            <div class="gear-grid">${SAILS.map((g) => card('sail', g)).join('')}</div>
            <h3 class="setting-group">Hull paint</h3>
            <div class="gear-grid">${HULLS.map((g) => card('hull', g)).join('')}</div>
          </div>
        </div></section>`);
      const paint = () => {
        const fitted = fittedGear(save);
        paintBoat(node.querySelector('.locker-preview'), type, boatLook(type, fitted));
        const sail = SAILS.find((g) => g.id === fitted.sail);
        const hull = HULLS.find((g) => g.id === fitted.hull);
        node.querySelector('.locker-fit').textContent = `${sail.name} · ${hull.name}`;
        node.querySelectorAll('.gear').forEach((b) => {
          const { kind, id } = b.dataset;
          const picked = fitted[kind] === id;
          b.classList.toggle('picked', picked);
          b.setAttribute('aria-pressed', String(picked));
          const look = boatLook(type, { ...fitted, [kind]: id });
          if (kind === 'sail') paintSail(b.querySelector('canvas'), look);
          else paintBoat(b.querySelector('canvas'), type, look);
        });
      };
      click(node, '.gear', (e, b) => {
        const { kind, id } = b.dataset;
        const g = (kind === 'sail' ? SAILS : HULLS).find((x) => x.id === id);
        if (!isGearUnlocked(save, g)) {
          const medal = medalFor(g);
          ui.toast(`Earn the ${medal.name} medal for the ${g.name} ${kind === 'sail' ? 'sail' : 'hull paint'}. ${medal.text}`);
          return;
        }
        handlers.onGear(kind, id);
        paint();
      });
      click(node, '[data-act=back]', () => ui.back());
      show('locker', node, { push: true });
      paint();
      if (save.gearSeen !== gearCount(save)) {
        save.gearSeen = gearCount(save);
        handlers.onSeen();
      }
    },

    settings(save) {
      const s = save.settings;
      // Reduced motion may still be following the phone's own setting.
      const value = (key) => (key === 'reduceMotion' ? handlers.motionReduced() : !!s[key]);
      const toggle = (key, label, sub, invert = false) => `<div class="setting">
        <span class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
        <button class="toggle" role="switch" data-key="${key}" data-invert="${invert}" aria-checked="${invert ? !value(key) : value(key)}" aria-label="${label}"></button></div>`;
      const seg = (key, label, sub, options) => `<div class="setting"><span class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
              <div class="seg" data-key="${key}" role="group" aria-label="${label}">
                ${options.map(([v, name]) => `<button data-v="${v}" aria-pressed="${s[key] === v}">${name}</button>`).join('')}
              </div></div>`;
      const node = el(`<section class="screen dim" aria-label="Settings">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>Settings</h2><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body">
            <h3 class="setting-group">Sound and feel</h3>
            ${toggle('sound', 'Sound effects', '')}
            ${toggle('music', 'Music', 'A quiet sea shanty-ish tune')}
            ${toggle('vibration', 'Vibration', 'Bumps, capsizes and pickups')}
            <h3 class="setting-group">Sailing</h3>
            ${toggle('autoTrim', 'Trim the sail by hand', 'For experienced sailors: W / S or the right-hand slider', true)}
            ${toggle('leftHanded', 'Left-handed controls', 'Steer on the right, gust button on the left')}
            ${seg('steerSensitivity', 'Steering', 'How hard a small thumb movement turns', [[0.75, 'Gentle'], [1, 'Normal'], [1.35, 'Sharp']])}
            ${toggle('ghost', 'Race your best run', 'A pale ghost boat replays your fastest voyage')}
            <h3 class="setting-group">Seeing and reading</h3>
            ${toggle('colorblind', 'Colour-blind friendly', 'Blue for good and orange for danger, instead of green and red')}
            ${toggle('reduceMotion', 'Reduce motion', 'No screen shake or lightning flashes, lighter rain and snow')}
            ${seg('textSize', 'Text size', 'Menus, tips and messages in bottles', TEXT_SIZES.map((v, i) => [v, ['Normal', 'Large', 'Largest'][i]]))}
            ${seg('quality', 'Graphics', 'Lower is easier on older phones', [['low', 'Low'], ['high', 'High']])}
            <h3 class="setting-group">Progress</h3>
            <div class="setting"><span class="label"><b>Reset progress</b><small>Clears times, stars, medals and the logbook</small></span>
              <button class="btn small" data-act="reset">Reset</button></div>
          </div>
        </div></section>`);
      click(node, '.toggle', (e, b) => {
        const key = b.dataset.key;
        const invert = b.dataset.invert === 'true';
        s[key] = !value(key);
        b.setAttribute('aria-checked', String(invert ? !s[key] : s[key]));
        handlers.onSettings(s);
      });
      click(node, '.seg button', (e, b) => {
        const seg = b.parentElement;
        const key = seg.dataset.key;
        const raw = b.dataset.v;
        s[key] = key === 'quality' ? raw : Number(raw);
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        handlers.onSettings(s);
      });
      click(node, '[data-act=reset]', (e, b) => {
        if (b.dataset.confirm) {
          handlers.onReset();
          ui.toast('Progress cleared.');
          b.textContent = 'Done';
          b.disabled = true;
        } else {
          b.dataset.confirm = '1';
          b.textContent = 'Tap again';
        }
      });
      click(node, '[data-act=back]', () => ui.back());
      show('settings', node, { push: true });
    },

    howto(save, thenPlay = false, playIndex = 0) {
      howtoPage = 0;
      const node = el(`<section class="screen dim" aria-label="How to sail">
        <div class="sheet">
          <div class="sheet-head"><h2>How to sail</h2><button class="btn small" data-act="skip">${thenPlay ? 'Skip' : 'Close'}</button></div>
          <div class="sheet-body"><div class="howto"><div class="fig"></div><div class="txt"></div></div></div>
          <div class="sheet-foot"><div class="dots">${HOWTO.map(() => '<i></i>').join('')}</div>
            <button class="btn small" data-act="prev">Back</button>
            <button class="btn primary" data-act="next" data-autofocus>Next</button></div>
        </div></section>`);
      const render = () => {
        const page = HOWTO[howtoPage];
        node.querySelector('.fig').innerHTML = page.svg();
        node.querySelector('.txt').innerHTML = `<h3>${page.title}</h3>${page.body}`;
        node.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === howtoPage));
        node.querySelector('[data-act=prev]').disabled = howtoPage === 0;
        const last = howtoPage === HOWTO.length - 1;
        node.querySelector('[data-act=next]').textContent = last ? (thenPlay ? 'Set sail' : 'Done') : 'Next';
        node.querySelector('.sheet-body').scrollTop = 0;
      };
      const finish = () => {
        save.seenIntro = true;
        handlers.onSeenIntro();
        if (thenPlay) ui.briefing(playIndex, save, 'replace');
        else ui.back();
      };
      click(node, '[data-act=prev]', () => {
        howtoPage = Math.max(0, howtoPage - 1);
        render();
      });
      click(node, '[data-act=next]', () => {
        if (howtoPage === HOWTO.length - 1) finish();
        else {
          howtoPage += 1;
          render();
        }
      });
      click(node, '[data-act=skip]', finish);
      render();
      show('howto', node, { push: true });
    },

    medals(save) {
      const got = medalsEarned(save);
      const cards = MEDALS.map((m) => {
        const earned = isEarned(save, m.id);
        const p = earned ? null : medalProgress(m, save, levels);
        const meter =
          p && p[1] > 1
            ? `<span class="medal-meter"><i style="width:${Math.round((100 * Math.min(p[0], p[1])) / p[1])}%"></i></span><span class="medal-count">${p[0]} / ${p[1]}${m.unit ? ` ${m.unit}` : ''}</span>`
            : '';
        const day = save.medals[m.id];
        const when = earned && /^\d{4}-\d\d-\d\d$/.test(day) ? `<span class="medal-count">${esc(dayLabel(day))}</span>` : '';
        const gear = rewardFor(m.id);
        const reward = gear ? `<span class="medal-reward">Sail Locker: ${esc(gear.label)}</span>` : '';
        return `<div class="medal ${earned ? 'earned' : ''}">
            <span class="medal-disc">${icon(m.icon, 26)}</span>
            <span class="medal-text"><b>${esc(m.name)}</b><small>${esc(m.text)}</small>${reward}${meter}${when}</span>
          </div>`;
      }).join('');
      const node = el(`<section class="screen dim" aria-label="Medals">
        <div class="sheet wide">
          <div class="sheet-head"><h2>Medals</h2><span class="eyebrow">${got} / ${MEDALS.length}</span><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body"><div class="medal-grid">${cards}</div></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      show('medals', node, { push: true });
      if (save.medalsSeen !== got) {
        save.medalsSeen = got;
        handlers.onSeen();
      }
    },

    logbook(save) {
      const notes = save.notes.length
        ? save.notes.map((n) => `<p class="note-card">“${esc(n)}”</p>`).join('')
        : '<p class="empty">No bottles found yet. Keep an eye on the water.</p>';
      const s = save.stats;
      const node = el(`<section class="screen dim" aria-label="Logbook">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>Logbook</h2><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body">
            <div class="stat-rows" style="margin-bottom:14px">
              <span class="k">Voyages finished</span><span class="v">${s.voyages}</span>
              <span class="k">Distance sailed</span><span class="v">${(s.distance * 0.000309).toFixed(2)} km</span>
              <span class="k">Capsizes</span><span class="v">${s.capsizes}</span>
            </div>
            <div class="eyebrow" style="margin-bottom:8px">Messages in bottles · ${save.notes.length}</div>
            ${notes}
          </div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      show('logbook', node, { push: true });
    },

    // Go back one screen. Returns false when there is nowhere to go.
    back() {
      if (!current) return false;
      const prev = stack.pop();
      if (!prev) {
        if (current === 'title') return false;
        handlers.onBackToTitle();
        return true;
      }
      handlers.onBackTo(prev);
      return true;
    },

    // kind: '' | 'good' | 'warn' | 'note' | 'tip' (one at a time, queued) |
    // 'alert' (danger right now, never waits).
    // `soon` puts a tip at the head of the queue, for news that can't wait.
    toast(text, kind = '', ms = 3200, soon = false) {
      const live = [...toasts.children].filter((t) => !t.classList.contains('out'));
      // The same message again just stays up longer.
      const same = live.find((t) => t.textContent === text);
      if (same) {
        hold(same, ms);
        return;
      }
      if (kind === 'tip') {
        const shown = live.find((t) => t.classList.contains('tip'));
        if (shown) {
          if (!tipQueue.some((q) => q.text === text)) tipQueue[soon ? 'unshift' : 'push']({ text, ms });
          if (tipQueue.length > 3) tipQueue.splice(soon ? 3 : 0, 1);
          // Hurry the current tip along so the next one isn't stale.
          if (shown._until - performance.now() > 2200) hold(shown, 2200);
          return;
        }
      }
      const node = el(`<div class="toast ${kind}"></div>`);
      node.textContent = text;
      toasts.appendChild(node);
      if (live.length >= 2) dismiss(live[0]);
      hold(node, ms);
    },

    clearToasts() {
      tipQueue = [];
      toasts.innerHTML = '';
    },

    countdown(onDone) {
      const node = el('<div class="countdown" aria-live="polite"></div>');
      root.appendChild(node);
      const steps = ['3', '2', '1', 'Sail!'];
      let i = 0;
      const tick = () => {
        if (i >= steps.length) {
          node.remove();
          return;
        }
        node.innerHTML = `<span>${steps[i]}</span>`;
        handlers.onCount(i, steps.length);
        if (i === steps.length - 1) onDone();
        i += 1;
        setTimeout(tick, i === steps.length ? 700 : 650);
      };
      tick();
      return () => node.remove();
    },
  };
  return ui;
}
