// DOM menus layered over the canvas: title, voyage select, briefing, pause,
// results, settings, how-to-sail, the Shipyard and Sail Locker, the Shop,
// medals and the logbook of bottle notes. Plus toasts and the confirm box.

import { formatTime, compassPoint, DEG } from '../core/math.js';
import { beaufort, toKnots, formatDistance } from '../physics/sailing.js';
import { POLAR } from '../world/autopilot.js';
import { SEA_BLURB, PEARL_TIME } from '../world/opensea.js';
import { REGATTA_BLURB, FLEETS, RIVALS, COURSES, fleetFor } from '../world/regatta.js';
import { CUP_RACES, CUP_POINTS, CUP_PRIZES, CUP_BOAT, cupTable, trophyCount } from '../data/cup.js';
import { BOAT_TYPES, BOAT_ORDER } from '../physics/boat.js';
import { drawBoat, drawSailFlat, VISUAL } from '../render/boat.js';
import { helmsman } from '../render/skipper.js';
import { drawHarbor } from '../render/harbor.js';
import { isUnlocked, totalStars, isDailyUnlocked, currentStreak, DAILY_UNLOCK, isBoatUnlocked, selectedBoat, ZOOMS } from '../platform/save.js';
import { dateKey, dailyId } from '../data/daily.js';
import { festivalOn, festivalById, nextWeek } from '../data/festivals.js';
import { PARTS, UPGRADE_STEPS, upgradeLevel, upgradeLevels, upgradeCount, nextPrice, buyUpgrade } from '../data/upgrades.js';
import { PAGES, ATLAS_TOTAL, PAGE_REWARD, hasMet, atlasCount, pageDone, pageRewarded } from '../data/atlas.js';
import { ROWS, PIECES, HARBOR_TOTAL, ROW_PEARLS, harborBuilt, isBuilt, waitingOn, rowDone, buildPiece, nextPiece } from '../data/harbor.js';
import { MEDALS, isEarned, isSealed, medalsEarned, medalProgress } from '../data/medals.js';
import { pickRumor } from '../data/rumors.js';
import { SAILS, HULLS, GEAR_TOTAL, boatLook, fittedGear, gearCount, isGearUnlocked, medalFor, rewardFor } from '../data/locker.js';
import { formatCoins, canAfford, shortOf, buyJar, tradeBlackPearl, buyBoat, buyGear, BOAT_PRICES, JAR_PRICE, JAR_HOLD, TRADE_COINS, SECOND_WIND, SECOND_WIND_TIME } from '../data/economy.js';
import { hasAnalytics, analyticsOn } from '../platform/analytics.js';
import { ads, REWARDS, watchVideo, videosLeft } from '../platform/ads.js';
import { shareText } from '../platform/social.js';
import { backupCode, readBackup } from '../platform/backup.js';
import { CHEST, dayOrders, todaysOrders, swapOrder } from '../data/orders.js';
import { holdsBlackPearl } from '../world/blackpearls.js';
import { LEVELS } from '../data/levels.js';
import { WORLDS, getWorld, voyageDef, voyageLabel } from '../data/worlds.js';
import { reminderTimes } from '../data/reminders.js';
import { icon } from './icons.js';
import { t, N_, ordinal, shortDate, nameOf, blurbOf, LANGS, currentLang } from '../i18n/index.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The title keeps "How to sail" for the first few voyages; after that it lives
// in Settings, with the prologue.
export const HOWTO_ON_TITLE = 3;

// The title's ways to sail, as small chips, and the rest of the menu as a dock
// of icons. `label` is given escaped (it may hold markup); `name` reads it aloud.
function chip(act, ic, label, fresh, name = '') {
  return `<button class="btn small chip ${fresh ? 'fresh' : ''}" data-act="${act}"${name ? ` aria-label="${esc(name)}"` : ''}>${icon(ic, 18)}<span>${label}</span></button>`;
}

function tile(act, ic, label, fresh, name = '') {
  return `<button class="dock-tile ${fresh ? 'fresh' : ''}" data-act="${act}"${name ? ` aria-label="${esc(name)}"` : ''}>${icon(ic, 22)}<span>${esc(label)}</span></button>`;
}

// The purse: coins and black pearls, as shown in a sheet's head or on the title.
function wallet(save) {
  const w = save.wallet;
  return `<span class="wallet" aria-label="${t('{coins} coins, {pearls} black pearls', { coins: formatCoins(w.coins), pearls: w.blackPearls })}"><span class="coins">${icon('coin', 17)}<b>${formatCoins(w.coins)}</b></span><span class="gems">${icon('blackPearl', 17)}<b>${w.blackPearls}</b></span></span>`;
}

// Show the purse again after a purchase.
function refreshWallet(node, save) {
  node.querySelectorAll('.wallet').forEach((w) => {
    w.outerHTML = wallet(save);
  });
}

const priceTag = (price) => (price.blackPearls ? `${icon('blackPearl', 16)}${price.blackPearls}` : `${icon('coin', 16)}${formatCoins(price.coins)}`);

function needMore(save, price) {
  const short = shortOf(save, price);
  if (short.blackPearls === 1) return t('You need 1 more black pearl. They lie where the sea is most dangerous: by whirlpools, krakens and pirates.');
  if (short.blackPearls) return t('You need {n} more black pearls. They lie where the sea is most dangerous: by whirlpools, krakens and pirates.', { n: short.blackPearls });
  return t('You need {n} more coins. Every voyage you sail pays some.', { n: formatCoins(short.coins) });
}

// The cup's points table, best first. `gained` is this race's points, if shown.
function cupRows(table) {
  return table
    .map((e, i) => `<span class="k">${ordinal(i + 1)}</span><span class="v ${e.player ? 'you' : ''}">${e.player ? `<b>${t('You')}</b>` : esc(e.name)} <small>${t('{n} pts', { n: e.points })}${e.gained ? ` · +${e.gained}` : ''}</small></span>`)
    .join('');
}

// Where you stand in a cup under way, in a line.
function cupStanding(now) {
  const table = cupTable(now);
  const place = table.findIndex((e) => e.player);
  const gap = place ? table[0].points - table[place].points : table[0].points - table[1].points;
  const vars = { place: ordinal(place + 1), n: gap, name: table[place ? 0 : 1].name };
  const where = !gap
    ? t("You're level on points with {name} at the top.", vars)
    : place
      ? gap === 1 ? t("You're {place}, 1 point behind {name}.", vars) : t("You're {place}, {n} points behind {name}.", vars)
      : gap === 1 ? t('You lead by 1 point.') : t('You lead by {n} points.', vars);
  return `${t('Race {n} of {of} next.', { n: now.race + 1, of: CUP_RACES })} ${where}`;
}

// What a voyage paid, under its results, with a video to pay its coins twice
// over (`extra` more) when one is on offer.
function rewardStrip(pay, extra = 0) {
  if (!pay || (!pay.coins && !pay.blackPearls)) return '';
  return `<div class="reward">${rewardInner(pay)}${extra > 0 ? `<button class="btn small double-btn" data-act="double" aria-label="${t('Watch a video for {n} more coins', { n: formatCoins(extra) })}">${icon('play', 16)} ×2 <span class="coins">+${formatCoins(extra)}</span></button>` : ''}</div>`;
}

// Why a pasted backup code couldn't be read.
// What a backup code (or the cloud's copy) holds, as {list} and {last}.
function progressList(sum) {
  const holds = [
    `★ ${sum.stars}`,
    sum.voyages === 1 ? t('1 voyage home') : t('{n} voyages home', { n: sum.voyages }),
    t('{coins} coins', { coins: formatCoins(sum.coins) }),
    sum.blackPearls === 1 ? t('1 black pearl') : t('{n} black pearls', { n: sum.blackPearls }),
    sum.medals === 1 ? t('1 medal') : t('{n} medals', { n: sum.medals }),
  ];
  return { list: holds.slice(0, -1).join(', '), last: holds.at(-1) };
}

const BACKUP_TROUBLE = {
  empty: N_('Paste a backup code in the box first.'),
  'not-a-code': N_("That isn't a No Paddle backup code."),
  damaged: N_('That code is cut short or has a typo. Copy it again on the other phone.'),
  unsupported: N_("This phone can't open that code. Update Android System WebView and try again."),
};

const shareButton = () => `<button class="btn icon" data-act="share" aria-label="${t('Share')}">${icon('share', 18)}</button>`;

// A pay line's label. A streak's carries its length.
function payLabel(label) {
  const streak = /^(\d+)-day streak$/.exec(label);
  return streak ? t('{n}-day streak', { n: streak[1] }) : t(label);
}

// A Sail Locker reward, "Lifebuoy sail", in the game's language.
const gearName = (r) => (r.kind === 'sail' ? t('{name} sail', { name: t(r.item.name) }) : t('{name} hull paint', { name: t(r.item.name) }));

function rewardInner(pay) {
  const lines = pay.lines.map((l) => `${esc(payLabel(l.label))} <b>${formatCoins(l.coins)}</b>`).join(' · ');
  return `<div class="reward-sum"><span class="coins">${icon('coin', 20)}+${formatCoins(pay.coins)}</span>${pay.blackPearls ? `<span class="gems">${icon('blackPearl', 20)}+${pay.blackPearls}</span>` : ''}${pay.doubled ? '<span class="badge">×2</span>' : ''}</div>
      <small>${lines}${pay.blackPearls ? ` · ${t('Black pearl')} <b>${pay.blackPearls}</b>` : ''}</small>`;
}

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function stars(n, total = 3) {
  let s = '';
  for (let i = 0; i < total; i++) s += `<span class="${i < n ? 'on' : ''}">★</span>`;
  return s;
}

// What each world's rocks, lairs and drifting things are called.
const ROCK_NAMES = { coral: N_('Coral reefs'), rock: N_('Rocks'), basalt: N_('Rocks'), piling: N_('Pilings'), container: N_('Containers'), shard: N_('Crystal shards'), pod: N_('Spore pods'), snag: N_('Snags'), bones: N_('Fossil bones'), column: N_('Columns'), statue: N_('Statues'), mast: N_('Sunken masts'), berg: N_('Ice chunks'), ball: N_('Beach balls'), brick: N_('Toy bricks'), balloon: N_('Balloons'), puff: N_('Cloud puffs') };
const LAIR_NAMES = { kraken: N_('Kraken'), vent: N_('Steam vents'), crane: N_('Cranes'), beast: N_('Beasts'), croc: N_('Crocodiles'), plesio: N_('Plesiosaurs'), eel: N_('Giant eels'), wraith: N_('Wraiths'), orca: N_('Orcas'), jack: N_('Jack-in-the-boxes'), storm: N_('Thunderclouds') };
const DRIFT_NAMES = { ice: N_('Drifting ice'), pumice: N_('Pumice rafts'), ferry: N_('Ferries'), jelly: N_('Jellies'), hippo: N_('Hippos'), turtle: N_('Giant turtles'), galley: N_('Galleys'), ghostship: N_('Ghost ships'), berg: N_('Icebergs'), duck: N_('Rubber ducks'), airship: N_('Airships') };

function hazardsOf(def) {
  const out = [];
  const once = (names, list, key, fallback, bad) => {
    for (const n of new Set((list || []).map((x) => names[x[key]] || fallback))) out.push([t(n), bad]);
  };
  if ((def.rocks || []).some((r) => r.material === 'coral')) out.push([t('Coral reefs'), true]);
  once(ROCK_NAMES, (def.rocks || []).filter((r) => r.material !== 'coral'), 'material', N_('Rocks'), true);
  if ((def.currents || []).length) out.push([t('Currents'), false]);
  if ((def.whirlpools || []).length) out.push([t('Whirlpools'), true]);
  if ((def.calms || []).length) out.push([t('Calm patches'), false]);
  if ((def.storms || []).length) out.push([t('Squalls'), true]);
  once(LAIR_NAMES, def.krakens, 'look', N_('Kraken'), true);
  once(DRIFT_NAMES, def.floes, 'look', N_('Drifting ice'), true);
  if ((def.pirates || []).length) out.push([t('Pirates'), true]);
  const w = def.weather || {};
  if (w.fog) out.push([t('Fog'), false]);
  if (w.night) out.push([t('Night'), false]);
  if (w.lightning) out.push([t('Lightning'), false]);
  if (w.snow) out.push([t('Snow'), false]);
  if (w.ash) out.push([t('Ash'), false]);
  if ((def.wind.events || []).length) out.push([t('Wind shifts'), false]);
  return out;
}

function windSentence(def) {
  const kn = toKnots(def.wind.speed);
  const bf = beaufort(kn);
  return `${t('{kn} kn from the {dir}', { kn: Math.round(kn), dir: t(compassPoint(def.wind.from)) })} · ${t(bf.name)}`;
}

// "Wed 28 Oct" for a YYYY-MM-DD key, in the game's language.
function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return shortDate(new Date(y, m - 1, d));
}

const days = (n) => (n === 1 ? t('1 day') : t('{n} days', { n }));

// Where a voyage ends: a harbor, a lighthouse, or home itself.
const goalOf = (def) => (def.finish.kind === 'home' ? t('home') : def.finish.kind === 'lighthouse' ? t('the lighthouse') : t('the harbor'));
const ARRIVED = { home: N_('Home at last'), lighthouse: N_('Lighthouse reached'), harbor: N_('Harbor reached') };

// The Home Waters panel counts down the voyages left on the way home.
function wayHome(save, levels, at, accent) {
  const done = at.filter((i) => (save.levels[levels[i].id] || {}).best != null).length;
  const left = at.length - done;
  const line = !left ? t('You made it home. Now the wider seas are calling.') : left === 1 ? t('One more voyage, and you are home.') : done ? t('Home is {n} voyages away.', { n: left }) : t('Your oar is lost and home is {n} voyages away.', { n: left });
  const dots = at.map((i, n) => `<i class="${n < done ? 'on' : ''}"></i>`).join('');
  return `<div class="way-home ${left ? '' : 'made-it'}" style="--accent:${accent}"><p>${esc(line)}</p><span class="track" aria-hidden="true">${dots}${icon('home', 16)}</span></div>`;
}

// Comparison with the previous best, or nothing on a first run.
const BOAT_STATS = [
  ['speed', N_('Speed')],
  ['pointing', N_('Upwind')],
  ['stability', N_('Stability')],
  ['agility', N_('Agility')],
  ['toughness', N_('Toughness')],
];

// `plus` is the boatyard upgrades on top, shown after the bar.
function statBar(n, plus = 0) {
  let dots = '';
  for (let i = 1; i <= 5; i++) dots += `<i class="${i <= n ? 'on' : ''}"></i>`;
  const more = plus ? `<b class="bar-plus">+${plus}</b>` : '';
  return `<span class="bar" aria-label="${plus ? t('{n} of 5, upgraded {plus}', { n, plus }) : t('{n} of 5', { n })}">${dots}${more}</span>`;
}

// A boat's stats, with its upgrades.
function boatStats(bt, levels = {}) {
  const plus = (k) => {
    const part = PARTS.find((p) => p.stat === k);
    return (part && levels[part.id]) || 0;
  };
  return `<dl class="boat-stats">${BOAT_STATS.map(([k, label]) => `<dt>${t(label)}</dt><dd>${statBar(bt.stats[k], plus(k))}</dd>`).join('')}</dl>`;
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
  // The sail swings out to the lower side, so the hull sits high. The big
  // ships are drawn smaller so they fit the card.
  const scale = Math.min(w / 24, h / 15) * Math.min(1, 12.5 / type.length);
  ctx.translate(w * 0.5, h * 0.36);
  ctx.scale(scale / VISUAL, scale / VISUAL);
  const boat = { type, x: 0, y: 0, vx: 0, vy: 0, heading: -0.3, heel: 0.42, boom: 0.7, drive: 4, luffing: false, rudder: 0, boostTime: 0 };
  drawBoat(ctx, boat, 0, { look, skipper: helmsman(type, -1) });
}

// Your harbor in its frame, kept moving while it's on screen (painted once
// when motion is reduced).
function showHarbor(canvas, save, still) {
  let last = -1;
  const paint = (now) => {
    if (!canvas.isConnected) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h && now - last >= 50) {
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHarbor(ctx, harborBuilt(save), w, h, still ? 4 : now / 1000);
      if (still) return;
    }
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
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
  const txt = Math.abs(d) < 0.05 ? t('Dead heat') : d < 0 ? t('{n} s faster', { n: (-d).toFixed(1) }) : t('{n} s slower', { n: d.toFixed(1) });
  return `<span class="k">${t('Vs. best')}</span><span class="v"${d < 0 ? ' style="color:var(--ok)"' : ''}>${txt}</span>`;
}

// The medals a voyage just earned, for the results card.
function medalStrip(medals = []) {
  if (!medals.length) return '';
  const chips = medals.map((m) => `<span class="medal-chip">${icon(m.icon, 18)}${esc(t(m.name))}</span>`).join('');
  const gear = medals.map((m) => rewardFor(m.id)).filter(Boolean);
  const note = gear.length ? `<p class="locker-note">${t('New in the Sail Locker: {list}', { list: gear.map((r) => esc(gearName(r))).join(', ') })}</p>` : '';
  return `<div class="medal-strip"><span class="eyebrow">${medals.length > 1 ? t('New medals') : t('New medal')}</span>${chips}${note}</div>`;
}

// The orders a voyage finished or moved along, for the results card.
function orderStrip(r) {
  if (!r || (!r.done.length && !r.moved.length)) return '';
  const chips = r.done.map((o) => `<span class="order-chip">${icon(o.icon, 17)}${esc(t(o.text))}<b>${icon('coin', 15)}${o.pay}</b></span>`).join('');
  const chest = r.blackPearls ? `<span class="order-chip chest">${icon('chest', 17)}${t("Harbourmaster's chest")}<b>${icon('blackPearl', 15)}${r.blackPearls}</b></span>` : '';
  const notes = r.moved.map((o) => `${esc(t(o.text))} <b>${Math.floor(o.progress)} / ${o.goal}</b>`);
  if (r.left) notes.push(t('{n} more to open the chest', { n: r.left }));
  const note = notes.length ? `<small class="order-note">${notes.join(' · ')}</small>` : '';
  const head = r.done.length > 1 ? t('Orders done') : r.done.length ? t('Order done') : t('Orders');
  return `<div class="order-strip"><span class="eyebrow">${head}</span>${chips}${chest}${note}</div>`;
}

// "5 h 20 min" to the next day's orders.
function untilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next - now) / 60000));
  const h = Math.floor(mins / 60);
  return h ? t('{h} h {m} min', { h, m: mins % 60 }) : t('{m} min', { m: mins });
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
  return `<svg viewBox="-40 0 300 230" role="img" aria-label="${t('Boat speed for each heading relative to the wind')}">
    <g font-family="Barlow Condensed, sans-serif" font-size="12" font-weight="700" fill="#e8f4f2">
    <path d="M${cx} ${cy} L${n1x.toFixed(1)} ${n1y.toFixed(1)} A${R} ${R} 0 0 1 ${n2x.toFixed(1)} ${n2y.toFixed(1)} Z" fill="rgba(255,77,77,0.25)"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(232,244,242,0.2)"/>
    <circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="rgba(232,244,242,0.12)"/>
    <path d="${d}Z" fill="rgba(214,62,169,0.18)" stroke="#d63ea9" stroke-width="2.5"/>
    <path d="M${cx} 4 L${cx} 24" stroke="#d9a441" stroke-width="3"/>
    <path d="M${cx - 6} 18 L${cx} 28 L${cx + 6} 18 Z" fill="#d9a441"/>
    <text x="${cx + 8}" y="16" fill="#d9a441">${t('WIND')}</text>
    <text x="${cx}" y="${cy - R * 0.55}" text-anchor="middle" fill="#ff9a9a">${t('NO-GO')}</text>
    ${label(50, R + 6, t('Close-hauled'))}
    ${label(92, R + 4, t('Beam reach'))}
    ${label(138, R + 10, t('Broad reach'))}
    ${label(180, R + 16, t('Run'), 'middle')}
    <path d="M${cx} ${cy - 9} Q${cx + 5} ${cy} ${cx + 3} ${cy + 9} L${cx - 3} ${cy + 9} Q${cx - 5} ${cy} ${cx} ${cy - 9} Z" fill="#e8f4f2"/>
    </g></svg>`;
}

function tackSvg() {
  return `<svg viewBox="0 0 200 230" role="img" aria-label="${t('Zig-zag course upwind')}">
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
    <text x="160" y="104" font-size="12" font-style="normal" font-weight="700" fill="#e8f4f2">${t('tack')}</text>
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
  return `<svg viewBox="0 0 220 200" role="img" aria-label="${t('Sheet in upwind, ease out downwind')}">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700">
    <path d="M110 4 L110 22 M104 15 L110 25 L116 15" stroke="#d9a441" stroke-width="3" fill="none"/>
    ${boat(55, 100, 8, t('Upwind: sheet in'))}
    ${boat(165, 100, 70, t('Downwind: ease out'))}
    </g></svg>`;
}

function heelSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="${t('Boat heeling in a gust')}">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13">
    <path d="M10 70 L60 70 M50 62 L62 70 L50 78" stroke="#d9a441" stroke-width="3" fill="none"/>
    <text x="10" y="58" fill="#d9a441">${t('GUST')}</text>
    <rect x="0" y="150" width="220" height="50" fill="rgba(15,76,92,0.8)"/>
    <g transform="rotate(28 120 150)">
      <path d="M90 140 L150 140 L140 165 L100 165 Z" fill="#8b5a3a"/>
      <path d="M120 140 L120 40" stroke="#4a3220" stroke-width="4"/>
      <path d="M120 45 L120 135 L160 135 Z" fill="#f5f0e4"/>
    </g>
    <path d="M150 30 A90 90 0 0 1 200 110" fill="none" style="stroke: var(--danger)" stroke-width="2.5" stroke-dasharray="5 4"/>
    <text x="160" y="24" fill="#ff9a9a">${t('capsize!')}</text>
    </g></svg>`;
}

function helmSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="${t('Put your thumb down anywhere and slide it left or right to steer')}">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="14" fill="#e8f4f2">
    <g transform="translate(110 92)">
      <circle r="56" fill="rgba(4,22,30,0.4)" stroke="rgba(232,244,242,0.55)" stroke-width="2.5"/>
      <path d="M39.6 -39.6 A56 56 0 0 1 39.6 39.6" fill="none" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>
      <path d="M-68 0 l10 -8 v16 Z M68 0 l-10 -8 v16 Z" fill="#e8f4f2" opacity="0.7"/>
      <circle cx="0" cy="0" r="4" fill="rgba(232,244,242,0.45)"/>
      <path d="M2 0 H22" stroke="rgba(232,244,242,0.45)" stroke-width="2" stroke-dasharray="3 3"/>
      <circle cx="30" cy="0" r="17" fill="rgba(232,244,242,0.9)"/>
      <path d="M22 26 q6 -14 8 -26 q4 0 6 4 l6 26 Z" fill="rgba(232,244,242,0.25)"/>
    </g>
    <text x="30" y="186" text-anchor="middle">${t('port')}</text><text x="190" y="186" text-anchor="middle">${t('starboard')}</text>
    <text x="110" y="186" text-anchor="middle" fill="#9fb8bd">${t('A / D on a keyboard')}</text>
    </g></svg>`;
}

function hazardsSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="${t('Hazards')}">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13" fill="#e8f4f2">
    <g transform="translate(45 45)"><circle r="30" fill="rgba(2,10,16,0.6)"/>
      <path d="M0 0 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0" fill="none" stroke="#e8f4f2" stroke-width="1.6"/></g>
    <text x="45" y="92" text-anchor="middle">${t('Whirlpool')}</text>
    <g transform="translate(160 45)" stroke="#bfeaf0" stroke-width="2.5" fill="none">
      <path d="M-30 -14 l8 8 l-8 8 M-8 -14 l8 8 l-8 8 M14 -14 l8 8 l-8 8"/><path d="M-30 10 l8 8 l-8 8 M-8 10 l8 8 l-8 8 M14 10 l8 8 l-8 8"/></g>
    <text x="160" y="92" text-anchor="middle">${t('Current')}</text>
    <g transform="translate(45 140)"><circle r="28" fill="rgba(170,222,226,0.3)"/><path d="M-16 -4 h32 M-12 6 h24" stroke="#e8f4f2" stroke-width="2"/></g>
    <text x="45" y="186" text-anchor="middle">${t('Calm / wind shadow')}</text>
    <g transform="translate(160 140)"><circle r="28" fill="rgba(4,22,30,0.7)" style="stroke: var(--danger)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="M-12 8 q-6 -14 4 -20 M2 10 q2 -16 12 -18 M12 12 q10 -6 6 -18" stroke="#a5648c" stroke-width="5" fill="none" stroke-linecap="round"/></g>
    <text x="160" y="186" text-anchor="middle">${t('Kraken')}</text>
    </g></svg>`;
}

function pickupsSvg() {
  return `<svg viewBox="0 0 220 200" role="img" aria-label="${t('Pickups')}">
    <g font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="13" fill="#e8f4f2" text-anchor="middle">
    <g transform="translate(55 50) scale(2.4)"><path d="M0 5 L-8 4 A8.5 9 0 0 1 8 4 Z" fill="#e9a8b5"/><circle cy="1" r="3.6" fill="#fbf6ee"/></g>
    <text x="55" y="88">${t('Pearl')}</text>
    <g transform="translate(160 48) scale(2.4)"><rect x="-5.5" y="-6" width="11" height="13" rx="3" fill="rgba(120,220,240,0.35)" stroke="#bff3ff" stroke-width="1.2"/><rect x="-3.5" y="-8.5" width="7" height="3" fill="#8a6a3c"/></g>
    <text x="160" y="88">${t('Gust jar')}</text>
    <g transform="translate(55 140) scale(2.4) rotate(12)"><rect x="-6" y="-6" width="12" height="12" fill="#9b6a3f" stroke="#5e3b25"/><rect x="-1.2" y="-4" width="2.4" height="8" style="fill: var(--ok)"/><rect x="-4" y="-1.2" width="8" height="2.4" style="fill: var(--ok)"/></g>
    <text x="55" y="180">${t('Repair crate')}</text>
    <g transform="translate(160 140) scale(2.4) rotate(-35)"><rect x="-8" y="-3.5" width="12" height="7" rx="3" fill="rgba(90,170,110,0.9)"/><rect x="4" y="-1.8" width="4" height="3.6" fill="rgba(90,170,110,0.9)"/><rect x="7.5" y="-1.6" width="2.4" height="3.2" fill="#c9a36a"/><rect x="-5.5" y="-1.6" width="7" height="3.2" fill="#f2e6c8"/></g>
    <text x="160" y="180">${t('Message in a bottle')}</text>
    </g></svg>`;
}

const HOWTO = [
  {
    title: N_('The wind is your engine'),
    svg: polarSvg,
    body: N_(`<p>Your oar is gone, so the sail is all you have. The pink curve shows how fast you go on each heading. <b>Wind across the boat (a beam reach) is fastest.</b></p>
      <p>Pointing straight into the wind is the <b>no-go zone</b>: the sail just flaps and you stop. The shaded wedge on the compass marks it.</p>`),
  },
  {
    title: N_('Steer with your thumb'),
    svg: helmSvg,
    body: N_(`<p><b>Touch:</b> put your thumb down anywhere on the left: a ring appears under it. Slide right to turn right, left to turn left; let go to sail straight. <b>Keyboard:</b> A / D or the arrow keys.</p>
      <p>The rudder needs water flowing past it, so steering is sluggish when you are slow. The streaks on the water show where the wind blows; dark ruffled patches are gusts, pale glassy water is a lull.</p>`),
  },
  {
    title: N_('Zig-zag to go upwind'),
    svg: tackSvg,
    body: N_(`<p>If B is upwind, sail about 45° off the wind on one side, then turn through the wind and sail 45° off on the other. That's called <b>tacking</b>.</p>
      <p>Keep your speed up before you turn, or the boat stalls in the no-go zone (<b>in irons</b>). Downwind, turning your stern through the wind is a <b>gybe</b>: the boom swings hard!</p>`),
  },
  {
    title: N_('Trim the sail'),
    svg: trimSvg,
    body: N_(`<p>By default the sail trims itself. Expert sailors can switch to <b>manual trim</b> in Settings: drag the slider on the right, or use W / S.</p>
      <p><b>Sheet in</b> (pull the sail tight) when heading upwind; <b>ease out</b> when the wind is behind you. Flapping (<b>luffing</b>) means it's too loose; <b>stalled</b> means it's too tight. Keep the marker in the bright sweet-spot band.</p>`),
  },
  {
    title: N_('Heel, gusts and capsizing'),
    svg: heelSvg,
    body: N_(`<p>Strong wind leans the boat over. Past about 40° the little boat on the compass turns red; push further and you <b>capsize</b>, losing time and hull.</p>
      <p>To recover, ease the sail out or turn away from the wind. A <b>gust jar</b> gives a burst of bottled wind: great for escaping whirlpools or calms.</p>`),
  },
  {
    title: N_('Hazards'),
    svg: hazardsSvg,
    body: N_(`<p><b>Rocks and reefs</b> crack the hull. <b>Currents</b> carry you along, so aim upstream to cross. <b>Whirlpools</b> drag you to the eye. <b>Calm patches</b> and the lee of islands steal your wind.</p>
      <p><b>Squalls</b> bring savage gusts. In the fog lives a <b>kraken</b>: when the water boils, get out of the ring. Reach a buoy to save your spot.</p>`),
  },
  {
    title: N_('Pickups'),
    svg: pickupsSvg,
    body: N_(`<p><b>Pearls</b> are treasure: collect them all on a voyage. <b>Gust jars</b> hold a burst of wind (up to three). <b>Repair crates</b> patch the hull.</p>
      <p><b>Bottles</b> carry notes from sailors who came before you. They're kept in your Logbook.</p>`),
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

  // The first voyage not yet sailed, or the last one once they all are.
  const resumeIndex = (save) => {
    const next = levels.findIndex((l) => !save.levels[l.id] || save.levels[l.id].best === null);
    return next === -1 ? levels.length - 1 : next;
  };

  // A voyage is referred to by its campaign index or as 'daily'.
  const defOf = (ref) => (ref === 'daily' ? handlers.daily() : voyageDef(levels[ref].id) || levels[ref]);
  const worldAt = (i) => (levels[i] && levels[i].world) || 'home';
  // The world the Voyages screen shows: the last one looked at or sailed in.
  let worldTab = null;
  const recordOf = (save, def) => (def.daily ? save.daily : save.levels)[def.id];

  // How to win a festival sail: today, if it's that week, else when it comes.
  function festivalHint(save, g) {
    const f = festivalById(g.festival);
    const today = dateKey();
    const open = isDailyUnlocked(save, levels);
    const vars = { fest: t(f.name), sail: t(g.name), n: DAILY_UNLOCK };
    if (festivalOn(today) === f) return open ? t("It's {fest} week! Sail today's {fest} voyage home to win the {sail} sail.", vars) : t("It's {fest} week! Finish the first {n} voyages to open the daily voyage, then sail today's {fest} voyage home to win the {sail} sail.", vars);
    const w = nextWeek(f, today);
    const when = w ? { ...vars, from: dayLabel(w[0]), to: dayLabel(w[1]) } : vars;
    if (open) return w ? t('Sail the daily voyage in {fest} week ({from} to {to}) to win the {sail} sail.', when) : t('Sail the daily voyage in {fest} week to win the {sail} sail.', vars);
    return w ? t('Finish the first {n} voyages to open the daily voyage, then sail it in {fest} week ({from} to {to}) to win the {sail} sail.', when) : t('Finish the first {n} voyages to open the daily voyage, then sail it in {fest} week to win the {sail} sail.', vars);
  }

  // Charting today's course can take a moment on a slow phone, so the button
  // says so until the briefing is ready.
  function openDaily(save, button, busyLabel) {
    if (!isDailyUnlocked(save, levels)) {
      ui.toast(t('Finish the first {n} voyages to unlock the daily voyage.', { n: DAILY_UNLOCK }));
      return;
    }
    const label = busyLabel.textContent;
    const screen = current;
    busyLabel.textContent = t("Charting today's course…");
    button.disabled = true;
    handlers.chartDaily((def) => {
      if (current !== screen) return; // the player moved on meanwhile
      if (def) {
        ui.briefing('daily', save);
        return;
      }
      busyLabel.textContent = label;
      button.disabled = false;
      ui.toast(t("Today's course couldn't be charted. Try again later."), 'warn');
    });
  }

  // Unlock a boat with black pearls, after asking. `after` redraws the screen.
  function unlockBoat(save, id, after) {
    const bt = BOAT_TYPES[id];
    const price = { blackPearls: BOAT_PRICES[id] };
    if (!canAfford(save, price)) {
      ui.toast(needMore(save, price));
      return;
    }
    ui.confirm({
      title: t('Unlock the {boat}?', { boat: t(bt.name) }),
      text: t('She is yours for good, without waiting for the {n} stars.', { n: bt.unlock }),
      ok: `${t('Unlock')} ${priceTag(price)}`,
      onOk: () => {
        if (!buyBoat(save, id)) return;
        handlers.onBoat(id);
        handlers.onWallet();
        ui.toast(t("The {boat} is yours. She's waiting at the quay.", { boat: t(bt.name) }), 'good');
        after();
      },
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

  // A Share button: the phone's share sheet, or the clipboard in a browser.
  async function shareOut(text) {
    const r = await handlers.onShare(text);
    if (r === 'copied') ui.toast(t('Copied. Paste it to a friend.'));
    else if (r === 'failed') ui.toast(t("Sharing didn't work here."));
  }

  // The results' Share button, and the video that doubles the coins.
  function wireResults(node, pay, text) {
    click(node, '[data-act=share]', () => shareOut(text));
    click(node, '[data-act=double]', async (e, b) => {
      b.disabled = true;
      const ok = await handlers.onDouble(pay);
      if (!b.isConnected) return;
      if (!ok) {
        b.disabled = false;
        ui.toast(t('No video right now.'));
        return;
      }
      const strip = b.closest('.reward');
      strip.innerHTML = rewardInner(pay);
      strip.classList.add('doubled');
    });
  }

  const ui = {
    // A Settings switch flipped from outside (the phone answering), if Settings is open.
    setToggle(key, on) {
      const b = root.querySelector(`.toggle[data-key="${key}"]`);
      if (b) b.setAttribute('aria-checked', String(on));
    },

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

    // Set sail on the next voyage not yet sailed (by way of How to Sail the
    // first time).
    begin(save) {
      const resume = resumeIndex(save);
      if (save.seenIntro) ui.briefing(resume, save);
      else ui.howto(save, true, resume);
    },

    title(save) {
      const resume = resumeIndex(save);
      const today = dateKey();
      const dailyOpen = isDailyUnlocked(save, levels);
      const sailedToday = !!save.daily[dailyId(today)];
      const streak = currentStreak(save, today);
      const orders = dailyOpen ? dayOrders(save, today) : null;
      // A festival week dresses the title and names the sail it gives.
      const fest = festivalOn(today);
      const sail = fest && SAILS.find((g) => g.id === fest.sail);
      const talk = fest && dailyOpen && !isGearUnlocked(save, sail)
        ? `<p class="rumor festive"><span>${esc(t('{fest} week', { fest: t(fest.name) }))}</span> ${esc(t("Sail today's {fest} voyage home to win the {sail} sail.", { fest: t(fest.name), sail: t(sail.name) }))}</p>`
        : `<p class="rumor"><span>${t('Harbor talk')}</span> ${esc(pickRumor(save, levels))}</p>`;
      // Your harbor, once the daily voyage opens; a dot when coins cover the next piece.
      const next = dailyOpen && nextPiece(save);
      const builtCount = harborBuilt(save).length;
      const harbor = dailyOpen
        ? `<button class="harbor-view ${next && save.wallet.coins >= next.price ? 'fresh' : ''}" data-act="harbor" aria-label="${t('Your harbor, {n} of {of} built', { n: builtCount, of: HARBOR_TOTAL })}"><canvas aria-hidden="true"></canvas><span class="harbor-tag">${t('Your harbor')} <b>${builtCount}/${HARBOR_TOTAL}</b></span></button>`
        : '';
      const node = el(`<section class="screen scrim title ${fest ? `festive ${fest.id}` : ''}" aria-label="${t('Title')}">
        <div class="title-wrap">
          <div class="eyebrow">${fest ? esc(t('{fest} week', { fest: t(fest.name) })) : t('A sailing voyage')}</div>
          <h1 class="logo" aria-label="No Paddle">NO <span>PADDLE</span></h1>
          <p class="tagline">${t("A squall took your oar. Now only the wind can carry you from <b>A</b> to <b>B</b>. Read it. Ride it. Don't capsize.")}</p>
          ${talk}
          <div class="title-buttons">
            <button class="btn primary" data-act="play" data-autofocus>${save.stats.voyages ? t('Set sail') : t('Start voyage')}</button>
            <button class="btn" data-act="voyages">${t('Voyages')}</button>
            ${save.stats.voyages < HOWTO_ON_TITLE ? `<button class="btn" data-act="howto">${t('How to sail')}</button>` : ''}
          </div>
          ${dailyOpen ? `<div class="title-modes">
            ${chip('daily', 'sun', fest ? esc(t('{fest} voyage', { fest: t(fest.name) })) : t('Daily voyage'), !sailedToday)}
            ${chip('sea', 'horizon', t('Open Sea'), !save.openSea.runs)}
            ${chip('regatta', 'fleet', t('Regatta'), !save.regatta.races)}
            ${orders ? chip('orders', 'bottle', `${t('Orders')} <span class="btn-tally">${orders.done.length}/${orders.picks.length}</span>`, !orders.seen && orders.done.length < orders.picks.length, t('Orders, {n} of {of} done', { n: orders.done.length, of: orders.picks.length })) : ''}
          </div>` : ''}
          <nav class="title-dock">
            ${tile('shipyard', 'anchor', t('Shipyard'), gearCount(save) > save.gearSeen)}
            ${dailyOpen ? tile('harbor', 'home', t('Harbor'), !!(next && save.wallet.coins >= next.price), t('Your harbor, {n} of {of} built', { n: builtCount, of: HARBOR_TOTAL })) : ''}
            ${tile('shop', 'chest', t('Shop'), save.wallet.blackPearls && !save.sightings.shop)}
            ${tile('medals', 'trophy', t('Medals'), medalsEarned(save) > save.medalsSeen)}
            ${tile('atlas', 'map', t('Atlas'), atlasCount(save) > save.atlasSeen, t('Sea Atlas, {n} of {of}', { n: atlasCount(save), of: ATLAS_TOTAL }))}
            ${tile('logbook', 'book', t('Logbook'), false)}
            ${tile('settings', 'gear', t('Settings'), !save.seenFilm)}
          </nav>
          <div class="title-meta">${wallet(save)}<span>★ <b>${totalStars(save)}</b> / ${levels.length * 3}</span><span>${esc(voyageLabel(levels[resume].id) || t('Voyage {n}', { n: resume + 1 }))}</span><span>${t('Medals')} <b>${medalsEarned(save)}</b> / ${MEDALS.length}</span>${streak ? `<span>${t('Streak')} <b>${streak}</b></span>` : ''}<span>v${esc(globalThis.BOATIFY_VERSION || 'dev')}</span></div>
          ${harbor}
        </div>
      </section>`);
      click(node, '[data-act=play]', () => ui.begin(save));
      click(node, '[data-act=voyages]', () => ui.voyages(save, true));
      click(node, '[data-act=orders]', () => ui.orders(save));
      click(node, '[data-act=daily]', (e, b) => openDaily(save, b, b));
      click(node, '[data-act=harbor]', () => ui.harbor(save));
      click(node, '[data-act=sea]', () => ui.seaBriefing(save));
      click(node, '[data-act=regatta]', () => ui.regattaBriefing(save));
      click(node, '[data-act=howto]', () => ui.howto(save));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      click(node, '[data-act=shop]', () => ui.shop(save));
      click(node, '[data-act=medals]', () => ui.medals(save));
      click(node, '[data-act=atlas]', () => ui.atlas(save));
      click(node, '[data-act=logbook]', () => ui.logbook(save));
      click(node, '[data-act=settings]', () => ui.settings(save));
      click(node, '[data-act=film]', () => handlers.onFilm());
      show('title', node);
      const view = node.querySelector('.harbor-view canvas');
      if (view) showHarbor(view, save, handlers.motionReduced());
    },

    // Your harbor: what's built, and what coins can build next.
    harbor(save, restore = false) {
      const built = harborBuilt(save).length;
      const card = (p) => {
        const done = isBuilt(save, p.id);
        const wait = waitingOn(save, p);
        const sub = wait.length && !done ? esc(wait.length > 1 ? t('Needs the {a} and the {b} first', { a: t(wait[0].name), b: t(wait[1].name) }) : t('Needs the {a} first', { a: t(wait[0].name) })) : esc(t(p.text));
        const button = done
          ? `<button class="btn small" disabled>${t('Built')}</button>`
          : wait.length
            ? `<button class="btn small" disabled aria-label="${t('Locked')}">${icon('lock', 14)}</button>`
            : `<button class="btn small" data-build="${p.id}" aria-label="${esc(t('Build the {piece} for {n} coins', { piece: t(p.name), n: formatCoins(p.price) }))}">${priceTag({ coins: p.price })}</button>`;
        return `<div class="shop-item ${done ? 'built' : ''}"><span class="shop-art">${icon(ROWS.find((r) => r.id === p.row).icon, 28)}</span><span class="shop-text"><b>${esc(t(p.name))}</b><small>${sub}</small></span>${button}</div>`;
      };
      const rows = ROWS.map(
        (r) => `<h3 class="setting-group">${esc(t(r.name))}${rowDone(save, r.id) ? ` · ${t('done')}` : ''}</h3>
            <div class="shop-grid">${PIECES.filter((p) => p.row === r.id).map(card).join('')}</div>`,
      ).join('');
      const node = el(`<section class="screen dim" aria-label="${t('Your harbor')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Your harbor')}</h2><span class="eyebrow">${built} / ${HARBOR_TOTAL}</span>${wallet(save)}<button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <div class="locker-top"><canvas class="harbor-preview" aria-hidden="true"></canvas>
              <div><b class="locker-fit">${built === HARBOR_TOTAL ? t('Every piece is built') : built ? t('{n} of {of} built', { n: built, of: HARBOR_TOTAL }) : t('An empty island')}</b><p class="locker-blurb">${ROW_PEARLS === 1 ? t('Coins from your voyages build the harbor up piece by piece, and the title screen shows it growing. Finish a row and the harbor folk bring you a black pearl.') : t('Coins from your voyages build the harbor up piece by piece, and the title screen shows it growing. Finish a row and the harbor folk bring you {n} black pearls.', { n: ROW_PEARLS })}</p></div></div>
            ${rows}
          </div>
        </div></section>`);
      click(node, '[data-build]', (e, b) => {
        const p = PIECES.find((x) => x.id === b.dataset.build);
        const price = { coins: p.price };
        if (!canAfford(save, price)) {
          ui.toast(needMore(save, price));
          return;
        }
        ui.confirm({
          title: t('Build the {piece}?', { piece: t(p.name) }),
          text: t(p.text),
          ok: `${t('Build')} ${priceTag(price)}`,
          onOk: () => {
            const r = buildPiece(save, p.id);
            if (!r) return;
            handlers.onWallet();
            ui.toast(r.row ? t('That finishes the {row}! The harbor folk bring you a black pearl.', { row: t(r.row.name) }) : t('The {piece} is built.', { piece: t(p.name) }), 'good', 3000);
            ui.harbor(save, true);
          },
        });
      });
      click(node, '[data-act=back]', () => ui.back());
      show('harbor', node, restore ? { keep: true } : { push: true });
      showHarbor(node.querySelector('.harbor-preview'), save, handlers.motionReduced());
    },

    // The prologue's frame: letterbox bars, the caption under the picture, a
    // way out, and the title card it ends on. Returns the film's controls.
    film() {
      const node = el(`<section class="screen film" aria-label="${t('Prologue')}">
        <div class="film-bar top"><button class="btn small film-skip" data-act="skip">${t('Skip')}</button></div>
        <div class="film-card" hidden>
          <div class="eyebrow">${t('A sailing voyage')}</div>
          <h1 class="logo" aria-label="No Paddle">NO <span>PADDLE</span></h1>
          <p class="tagline">${t('Only the wind, and the way home.')}</p>
          <button class="btn primary" data-act="helm">${t('Take the helm')}</button>
        </div>
        <div class="film-bar bottom"><p class="film-caption" aria-live="polite"></p></div>
      </section>`);
      const caption = node.querySelector('.film-caption');
      const card = node.querySelector('.film-card');
      let fade = 0;
      click(node, '[data-act=skip]', () => handlers.onFilmDone(false));
      click(node, '[data-act=helm]', () => handlers.onFilmDone(true));
      show('film', node);
      return {
        // Captions fade out, change, and fade back in.
        caption(text) {
          clearTimeout(fade);
          caption.classList.add('out');
          fade = setTimeout(() => {
            caption.textContent = t(text);
            caption.classList.toggle('out', !text);
          }, 320);
        },
        card() {
          card.hidden = false;
          void card.offsetWidth;
          card.classList.add('in');
          node.classList.add('ending');
          const helm = card.querySelector('[data-act=helm]');
          if (!matchMedia('(pointer: coarse)').matches) helm.focus({ preventScroll: true });
        },
      };
    },

    voyages(save, push = false) {
      const tab = WORLDS.some((w) => w.id === worldTab) ? worldTab : worldAt(resumeIndex(save));
      const card = (l, i) => {
        const rec = save.levels[l.id];
        const open = isUnlocked(save, levels, i);
        const isNext = open && (!rec || rec.best === null);
        return `<button class="voyage ${open ? '' : 'locked'} ${isNext ? 'next' : ''}" data-i="${i}" ${open ? '' : 'aria-disabled="true"'}>
            <span class="num">${String((l.index ?? i) + 1).padStart(2, '0')}</span>
            <span class="name">${esc(t(l.name))}</span>
            <span class="stars">${stars(rec ? rec.stars : 0)}</span>
            <span class="best">${rec && rec.best !== null ? `${t('Best')} ${formatTime(rec.best)} · ${icon('pearl', 13)}${rec.pearls}/${rec.pearlsTotal ?? '?'}${save.wallet.found[l.id] ? ` · ${icon('blackPearl', 13)}` : ''}` : `<em class="teaser">${esc(t(l.teaser))}</em>`}</span>
          </button>`;
      };
      // Each world's voyages, in campaign order, with its first one's index.
      const worlds = WORLDS.map((w) => {
        const at = levels.map((l, i) => i).filter((i) => worldAt(i) === w.id);
        const have = at.reduce((a, i) => a + ((save.levels[levels[i].id] || {}).stars || 0), 0);
        return { w, at, have, open: at.length > 0 && isUnlocked(save, levels, at[0]) };
      }).filter((x) => x.at.length);
      const today = dateKey();
      const dailyOpen = isDailyUnlocked(save, levels);
      const dailyRec = save.daily[dailyId(today)];
      const charted = handlers.dailyPeek();
      const streak = currentStreak(save, today);
      const locked = t('Finish voyage {n} to unlock', { n: DAILY_UNLOCK });
      const dailyLine = !dailyOpen
        ? locked
        : dailyRec
          ? `${t('Best')} ${formatTime(dailyRec.best)}${streak ? ` · ${t('Streak')} ${streak}` : ''}`
          : streak
            ? t('Streak {n} · keep it going', { n: streak })
            : t('A new course every day');
      const dailyCard = `<button class="voyage daily ${dailyOpen ? '' : 'locked'}" data-act="daily" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">${t('Daily')}</span>
            <span class="name">${esc(charted ? nameOf(charted) : dayLabel(today))}</span>
            <span class="stars">${stars(dailyRec ? dailyRec.stars : 0)}</span>
            <span class="best">${dailyLine}</span>
          </button>`;
      const sea = save.openSea;
      const seaCard = `<button class="voyage sea ${dailyOpen ? '' : 'locked'}" data-act="sea" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">${t('Endless')}</span>
            <span class="name">${t('Open Sea')}</span>
            <span class="stars">${sea.runs ? `⚑ ${sea.gates}` : ''}</span>
            <span class="best">${!dailyOpen ? locked : sea.runs ? t('Furthest {d}', { d: formatDistance(sea.best) }) : t('How far east can you sail?')}</span>
          </button>`;
      const race = save.regatta;
      const raceCard = `<button class="voyage regatta ${dailyOpen ? '' : 'locked'}" data-act="regatta" ${dailyOpen ? '' : 'aria-disabled="true"'}>
            <span class="num">${t('Race')}</span>
            <span class="name">${t('Regatta')}</span>
            <span class="stars">${race.wins ? `🏆 ${race.wins}` : ''}</span>
            <span class="best">${!dailyOpen ? locked : race.races ? t('{fleet} fleet · {n} raced', { fleet: t(FLEETS[fleetFor(race.wins)].name), n: race.races }) : t('Race three rival boats')}</span>
          </button>`;
      const tabs = worlds
        .map(({ w, at, have, open }) => `<button class="world-tab ${open ? '' : 'locked'}" role="tab" data-world="${w.id}" aria-selected="${w.id === tab}" style="--accent:${w.accent}"><b>${esc(t(w.name))}</b><small>${open ? `★ ${have} / ${at.length * 3}` : `🔒 ${t('{n} voyages', { n: at.length })}`}</small></button>`)
        .join('');
      const panels = worlds
        .map(({ w, at }) => `<div class="world-panel" role="tabpanel" data-world="${w.id}" ${w.id === tab ? '' : 'hidden'}>
            ${w.id === 'home' ? wayHome(save, levels, at, w.accent) : `<p class="world-blurb" style="--accent:${w.accent}">${esc(t(w.blurb))}</p>`}
            <div class="voyage-grid">${w.id === 'home' ? dailyCard + seaCard + raceCard : ''}${at.map((i) => card(levels[i], i)).join('')}</div>
          </div>`)
        .join('');
      const node = el(`<section class="screen dim" aria-label="${t('Voyages')}">
        <div class="sheet">
          <div class="sheet-head"><h2>${t('Voyages')}</h2><span class="eyebrow">★ ${totalStars(save)} / ${levels.length * 3}</span><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body"><div class="world-tabs" role="tablist" aria-label="${t('Worlds')}">${tabs}</div>${panels}</div>
        </div></section>`);
      click(node, '.world-tab', (e, b) => {
        worldTab = b.dataset.world;
        node.querySelectorAll('.world-tab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        node.querySelectorAll('.world-panel').forEach((x) => (x.hidden = x.dataset.world !== worldTab));
        node.querySelector('.sheet-body').scrollTop = 0;
      });
      click(node, '.voyage[data-i]', (e, b) => {
        const i = Number(b.dataset.i);
        if (!isUnlocked(save, levels, i)) {
          const w = getWorld(worldAt(i));
          if (worldAt(i - 1) !== worldAt(i)) ui.toast(t('Finish {a} to reach {b}.', { a: t(levels[i - 1].name), b: t(w.name) }));
          else ui.toast(t('Finish {a} to sail on to {b}.', { a: t(levels[i - 1].name), b: t(levels[i].name) }));
          return;
        }
        ui.briefing(i, save);
      });
      click(node, '.voyage.daily', (e, b) => openDaily(save, b, b.querySelector('.best')));
      click(node, '.voyage.sea', () => {
        if (!isDailyUnlocked(save, levels)) ui.toast(t('Finish the first {n} voyages to unlock the Open Sea.', { n: DAILY_UNLOCK }));
        else ui.seaBriefing(save, 'push');
      });
      click(node, '.voyage.regatta', () => {
        if (!isDailyUnlocked(save, levels)) ui.toast(t('Finish the first {n} voyages to unlock the Regatta.', { n: DAILY_UNLOCK }));
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
      if (index === 'cup') {
        ui.cupBriefing(save, how);
        return;
      }
      const def = defOf(index);
      const rec = recordOf(save, def);
      const streak = def.daily ? currentStreak(save, def.daily) : 0;
      const chips = hazardsOf(def)
        .map(([name, bad]) => `<span class="chip ${bad ? 'danger' : ''}">${name}</span>`)
        .join('');
      const pearls = (def.pickups || []).filter((p) => p.kind === 'pearl').length;
      const node = el(`<section class="screen dim" aria-label="${t('Voyage briefing')}">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">${def.daily ? `${def.festival ? esc(t('{fest} voyage', { fest: t(festivalById(def.festival).name) })) : t('Daily voyage')} · ${esc(dayLabel(def.daily))}` : esc(voyageLabel(levels[index].id) || t('Voyage {n}', { n: index + 1 }))}</span><h2>${esc(nameOf(def))}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(blurbOf(def))}</p>
            <div>
              <div class="eyebrow">${t('Conditions')}</div>
              <dl class="facts">
                <dt>${t('Wind')}</dt><dd>${windSentence(def)}</dd>
                <dt>${t('Goal')}</dt><dd>${t('Reach {goal} at <b style="color:var(--signal)">B</b>', { goal: goalOf(def) })}</dd>
                <dt>${t('Pearls')}</dt><dd>${pearls}</dd>
                ${holdsBlackPearl(def) ? `<dt>${t('Black pearl')}</dt><dd>${save.wallet.found[def.id] ? `<span style="color:var(--gem)">${t('brought home ✓')}</span>` : t('One lies near the danger')}</dd>` : ''}
                ${save.wallet.jars ? `<dt>${t('Gust jars')}</dt><dd>${t('{n} from the hold', { n: save.wallet.jars })}</dd>` : ''}
                ${(def.castaways || []).map((c) => `<dt>${t('Castaway')}</dt><dd>${rec && rec.rescued ? t('{name} <span style="color:var(--ok)">rescued ✓</span>', { name: esc(t(c.name)) }) : t('{name} is adrift. Stop alongside', { name: esc(t(c.name)) })}</dd>`).join('')}
                <dt>${t('Boat')}</dt><dd>${esc(t(BOAT_TYPES[selectedBoat(save)].name))} <button class="link" data-act="shipyard">${t('Change')}</button></dd>
              </dl>
              <div class="chips">${chips}</div>
            </div>
            <div>
              <div class="eyebrow">${t('Times')}</div>
              <dl class="facts">
                <dt style="color:var(--brass)">★★★</dt><dd>${t('under {time}', { time: formatTime(def.par.gold) })}</dd>
                <dt>★★</dt><dd>${t('under {time}', { time: formatTime(def.par.silver) })}</dd>
                <dt>${t('Best')}</dt><dd>${rec && rec.best !== null ? `${formatTime(rec.best)} <span style="color:var(--brass)">${'★'.repeat(rec.stars)}</span>` : '—'}</dd>
                ${def.daily ? `<dt>${t('Streak')}</dt><dd>${streak ? days(streak) : t('Finish today to start one')}</dd>` : ''}
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">${t('Back')}</button><button class="btn primary" data-act="go" data-autofocus>${t('Set sail')}</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay(index));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = index;
      if (typeof index === 'number') worldTab = worldAt(index);
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    seaBriefing(save, how = 'push') {
      const rec = save.openSea;
      const medal = MEDALS.find((m) => m.id === 'far-horizon');
      const [have, need] = medalProgress(medal, save, LEVELS);
      const node = el(`<section class="screen dim" aria-label="${t('Open Sea briefing')}">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">${t('Endless')}</span><h2>${t('Open Sea')}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(t(SEA_BLURB))}</p>
            <div>
              <div class="eyebrow">${t('How it works')}</div>
              <dl class="facts">
                <dt>${t('Clock')}</dt><dd>${t('Counts down from about a minute')}</dd>
                <dt>${t('Gates')}</dt><dd>${t("Sail between the two buoys to add the next leg's time")}</dd>
                <dt>${t('Pearls')}</dt><dd>${t('+{n} s each', { n: PEARL_TIME })}</dd>
                <dt>${t('Hull')}</dt><dd>${t('If she sinks, the run is over')}</dd>
                <dt>${t('Boat')}</dt><dd>${esc(t(BOAT_TYPES[selectedBoat(save)].name))} <button class="link" data-act="shipyard">${t('Change')}</button></dd>
              </dl>
            </div>
            <div>
              <div class="eyebrow">${t('Records')}</div>
              <dl class="facts">
                <dt>${t('Furthest')}</dt><dd>${rec.runs ? formatDistance(rec.best) : '—'}</dd>
                <dt>${t('Most gates')}</dt><dd>${rec.runs ? rec.gates : '—'}</dd>
                <dt>${t('Runs')}</dt><dd>${rec.runs}</dd>
                <dt>${t('Medal')}</dt><dd>${isEarned(save, medal.id) ? `${esc(t(medal.name))} <span style="color:var(--brass)">${t('earned')}</span>` : `${esc(t(medal.name))}: ${have} / ${need} km`}</dd>
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">${t('Back')}</button><button class="btn primary" data-act="go" data-autofocus>${t('Set sail')}</button></div>
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
      const rivals = RIVALS.map((r) => `<span class="chip" style="color:${r.look.sail}">${esc(r.name)} · ${esc(t(BOAT_TYPES[r.boat].name))}</span>`).join('');
      const fleetName = esc(t('{fleet} fleet', { fleet: t(fleet.name) }));
      const node = el(`<section class="screen dim" aria-label="${t('Regatta briefing')}">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">${fleetName}</span><h2>${t('Regatta')}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(t(REGATTA_BLURB))}</p>
            <div>
              <div class="eyebrow">${t('The course')}</div>
              <dl class="facts">
                <dt>${t('Legs')}</dt><dd>${t('Mark <b style="color:var(--warn)">1</b>, mark <b style="color:var(--warn)">2</b>, then the harbor at <b style="color:var(--signal)">B</b>')}</dd>
                <dt>${t('Fleet')}</dt><dd>${esc(t(fleet.name))}${fleet.id === 'championship' ? '' : `: ${t('win {n} more to step up', { n: fleet.id === 'club' ? 1 : 3 - rec.wins })}`}</dd>
                <dt>${t('Boat')}</dt><dd>${esc(t(BOAT_TYPES[selectedBoat(save)].name))} <button class="link" data-act="shipyard">${t('Change')}</button></dd>
              </dl>
              <div class="chips">${rivals}</div>
            </div>
            <div>
              <div class="eyebrow">${t('Records')}</div>
              <dl class="facts">
                <dt>${t('Wins')}</dt><dd>${t('{n} of {of}', { n: rec.wins, of: rec.races })}</dd>
                <dt>${t('Podiums')}</dt><dd>${rec.podiums}</dd>
                <dt>${t('Best win')}</dt><dd>${rec.best !== null ? formatTime(rec.best) : '—'}</dd>
                <dt>${t('Medal')}</dt><dd>${esc(t(medal.name))}${isEarned(save, medal.id) ? ` <span style="color:var(--brass)">${t('earned')}</span>` : `: ${t('win a race')}`}</dd>
                <dt>${t('Cup')}</dt><dd>${save.cup.now ? t('Race {n} of {of} next', { n: save.cup.now.race + 1, of: CUP_RACES }) : trophyCount(save) ? `${icon('trophy', 14)} ${t('{n} won', { n: trophyCount(save) })}` : t('{n} races, one trophy', { n: CUP_RACES })}</dd>
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">${t('Back')}</button><button class="btn ${save.cup.sailed || save.cup.now ? '' : 'fresh'}" data-act="cup">${icon('trophy', 16)} ${t('Cup')}</button><button class="btn primary" data-act="go" data-autofocus>${t('Race')}</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay('regatta'));
      click(node, '[data-act=cup]', () => ui.cupBriefing(save));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = 'regatta';
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    // The Regatta Cup: its four courses, the points so far and the trophy shelf.
    cupBriefing(save, how = 'push') {
      const now = save.cup.now;
      const fleet = FLEETS[now ? now.fleet : fleetFor(save.regatta.wins)];
      const next = now ? now.race : 0;
      const races = COURSES.map((c, i) => {
        const state = i < next ? 'done' : i === next ? 'next' : '';
        const note = i < next ? ordinal(now.places[i]) : i === next ? t('Next') : '';
        return `<li class="${state}"><b>${i + 1}</b><span>${esc(t(c.name))}</span>${note ? `<small>${note}</small>` : ''}</li>`;
      }).join('');
      const table = now && next ? `<div class="eyebrow">${t('Points')}</div><div class="stat-rows standings cup-table">${cupRows(cupTable(now))}</div>` : '';
      const shelf = FLEETS.map((f) => {
        const n = save.cup.trophies[f.id];
        const label = !n ? t('{fleet} cup, not won yet', { fleet: t(f.name) }) : n === 1 ? t('{fleet} cup, won once', { fleet: t(f.name) }) : t('{fleet} cup, won {n} times', { fleet: t(f.name), n });
        return `<div class="trophy ${n ? 'won' : ''} ${f.id}" role="img" aria-label="${esc(label)}">${icon('trophy', 30)}<span>${esc(t(f.name))}</span><small>${n ? `× ${n}` : '—'}</small></div>`;
      }).join('');
      const boat = BOAT_TYPES[CUP_BOAT];
      const prize = CUP_PRIZES[0];
      const go = now ? t('Race {n}: {course}', { n: next + 1, course: t(COURSES[next].name) }) : t('Start the cup');
      const node = el(`<section class="screen dim" aria-label="${t('Regatta Cup')}">
        <div class="sheet cup-sheet">
          <div class="sheet-head"><span class="eyebrow">${esc(t('{fleet} fleet', { fleet: t(fleet.name) }))}</span><h2>${t('Regatta Cup')}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${now && next ? cupStanding(now) : t('{n} races on {n} courses against the same three rivals. Each race scores {a}, {b}, {c} and {d} points from first to fourth, and the most points after the last race takes the cup.', { n: CUP_RACES, a: CUP_POINTS[0], b: CUP_POINTS[1], c: CUP_POINTS[2], d: CUP_POINTS[3] })}</p>
            <div>
              <div class="eyebrow">${t('The races')}</div>
              <ol class="cup-races">${races}</ol>
            </div>
            <div>
              <div class="eyebrow shelf-label">${t('Trophies')}</div>
              <div class="trophy-shelf">${shelf}</div>
              <dl class="facts">
                <dt>${t('Prize')}</dt><dd>${isBoatUnlocked(save, CUP_BOAT) ? t('{coins} coins and {n} black pearls', { coins: formatCoins(prize.coins), n: prize.blackPearls }) : t('{coins} coins and {n} black pearls, and your first cup wins the <b>{boat}</b>', { coins: formatCoins(prize.coins), n: prize.blackPearls, boat: esc(t(boat.name)) })}</dd>
                <dt>${t('Boat')}</dt><dd>${esc(t(BOAT_TYPES[selectedBoat(save)].name))} <button class="link" data-act="shipyard">${t('Change')}</button></dd>
              </dl>
              ${table}
            </div>
          </div><p class="sheet-note">${t('A race counts once you cross the line, so a restart sails it again.')}</p></div>
          <div class="sheet-foot"><button class="btn" data-act="back">${t('Back')}</button><button class="btn primary" data-act="go" data-autofocus>${esc(go)}</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay('cup'));
      click(node, '[data-act=shipyard]', () => ui.shipyard(save));
      lastBriefing = 'cup';
      show('briefing', node, { push: how === 'push', keep: how === 'restore' });
    },

    pause(game, save) {
      const sea = game.sea;
      const race = game.race;
      const marks = game.level.checkpoints.length;
      const rows = sea
        ? `<span class="k">${t('Clock')}</span><span class="v">${formatTime(sea.clock)}</span>
              <span class="k">${t('Distance')}</span><span class="v">${formatDistance(sea.best)} · ⚑ ${sea.gates}</span>`
        : race
          ? `<span class="k">${t('Time')}</span><span class="v">${formatTime(game.time)}</span>
              <span class="k">${t('Place')}</span><span class="v">${t('{place} of {n}', { place: ordinal(race.place || 1), n: race.rivals.length + 1 })}</span>
              <span class="k">${t('Leg')}</span><span class="v">${game.nextCheckpoint < marks ? t('To mark {n}', { n: game.nextCheckpoint + 1 }) : t('To the harbor')}</span>`
          : `<span class="k">${t('Time')}</span><span class="v">${formatTime(game.time)}</span>
              <span class="k">${t('Pearls')}</span><span class="v">${game.pearls} / ${game.pearlsTotal}</span>
              ${game.castaways.map((c) => `<span class="k">${esc(t(c.name))}</span><span class="v">${c.state === 'aboard' ? t('Aboard') : t('Adrift')}</span>`).join('')}`;
      const node = el(`<section class="screen dim" aria-label="${t('Paused')}">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>${t('Paused')}</h2><span class="eyebrow">${esc(nameOf(game.level))}</span></div>
          <div class="sheet-body">
            <div class="stat-rows">
              ${rows}
              <span class="k">${t('Hull')}</span><span class="v">${Math.ceil(game.hull)}%</span>
            </div>
            <div class="setting" style="margin-top:8px">
              <span class="label"><b>${t('Trim the sail by hand')}</b><small>${t('Off: the sail trims itself')}</small></span>
              <button class="toggle" role="switch" data-set="manual" aria-checked="${!save.settings.autoTrim}" aria-label="${t('Manual trim')}"></button>
            </div>
            <div class="setting">
              <span class="label"><b>${t('Sound')}</b></span>
              <button class="toggle" role="switch" data-set="sound" aria-checked="${save.settings.sound}" aria-label="${t('Sound')}"></button>
            </div>
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="quit">${t('Voyages')}</button>
            <button class="btn small" data-act="restart">${t('Restart')}</button>
            <button class="btn primary" data-act="resume" data-autofocus>${t('Resume')}</button>
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
      // The last voyage of a world opens the next one.
      const nextWorld = hasNext && worldAt(index + 1) !== worldAt(index) ? getWorld(worldAt(index + 1)) : null;
      const rec = recordOf(save, def);
      const streak = def.daily ? currentStreak(save, def.daily) : 0;
      const node = el(`<section class="screen dim" aria-label="${t('Voyage complete')}">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head">${def.finish.kind === 'home' ? `<div class="arrived"><h2>${t(ARRIVED.home)}</h2><p class="homecoming">${t('The lamp was lit all along, and someone was waiting.')}</p></div>` : `<h2>${t(ARRIVED[def.finish.kind] || ARRIVED.harbor)}</h2>`}</div>
          <div class="sheet-body">
            <div class="result-stars">${stars(0)}</div>
            <div class="stat-rows">
              <span class="k">${t('Time')}</span><span class="v">${formatTime(result.time)}${improved.time && !improved.first ? `<span class="badge">${t('NEW BEST')}</span>` : ''}</span>
              <span class="k">${t('Best')}</span><span class="v">${formatTime(rec.best)}</span>
              ${vsBest(result.time, improved.prevBest)}
              <span class="k">${t('Pearls')}</span><span class="v">${result.pearls} / ${result.pearlsTotal}${result.pearls === result.pearlsTotal && result.pearlsTotal ? `<span class="badge">${t('ALL')}</span>` : ''}</span>
              ${result.castaways ? `<span class="k">${t('Rescued')}</span><span class="v">${result.rescued.length ? `${esc(result.rescued.map((c) => t(c.name)).join(', '))}<span class="badge">${t('SAFE')}</span>` : t('Left adrift')}</span>` : ''}
              <span class="k">${t('Hull')}</span><span class="v">${Math.ceil(result.hull)}%</span>
              <span class="k">${t('Capsizes')}</span><span class="v">${result.capsizes}</span>
              <span class="k">${t('Next star')}</span><span class="v">${result.stars >= 3 ? t('Got them all') : t('under {time}', { time: formatTime(result.stars === 2 ? def.par.gold : def.par.silver) })}</span>
              ${(improved.newBoats || []).map((name) => `<span class="k">${t('Shipyard')}</span><span class="v">${esc(t(name))}<span class="badge">${t('NEW BOAT')}</span></span>`).join('')}
              ${improved.festivalSail ? `<span class="k">${t('Sail Locker')}</span><span class="v">${esc(t('{name} sail', { name: t(SAILS.find((g) => g.id === improved.festivalSail.sail).name) }))}<span class="badge">${esc(t(improved.festivalSail.name).toUpperCase())}</span></span>` : ''}
              ${def.daily ? `<span class="k">${t('Streak')}</span><span class="v">${days(streak)}${improved.first && streak > 1 ? '<span class="badge">+1</span>' : ''}</span>` : ''}
            </div>
            ${rewardStrip(improved.pay, handlers.doubleOf(improved.pay))}
            ${orderStrip(improved.orders)}
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            ${shareButton()}
            ${hasNext ? `<button class="btn small" data-act="voyages">${t('Voyages')}</button>` : ''}
            <button class="btn small" data-act="retry">${t('Retry')}</button>
            ${hasNext ? `<button class="btn primary" data-act="next" data-autofocus>${nextWorld ? esc(t('Sail to {world}', { world: t(nextWorld.name) })) : t('Next voyage')}</button>` : `<button class="btn primary" data-act="voyages" data-autofocus>${t('Done')}</button>`}
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=next]', () => handlers.onPlay(index + 1));
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      wireResults(node, improved.pay, shareText('voyage', { name: nameOf(def), time: result.time, stars: result.stars }));
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
          // On a short screen the strip can sit below the fold.
          medalEls[0].parentNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          handlers.onMedal();
        }, 500 + result.stars * 320);
      }
    },

    seaResults(result, improved, save) {
      tipQueue = [];
      const rec = save.openSea;
      const node = el(`<section class="screen dim" aria-label="${t('Run over')}">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><span class="eyebrow">${t('Open Sea')}</span><h2>${result.reason === 'sunk' ? t('The hull gave out') : t('Out of time')}</h2></div>
          <div class="sheet-body">
            <div class="sea-distance">${formatDistance(result.distance)} <small>${t('east')}</small>${improved.best && !improved.first ? `<span class="badge">${t('NEW BEST')}</span>` : ''}</div>
            <div class="stat-rows">
              <span class="k">${t('Furthest')}</span><span class="v">${formatDistance(rec.best)}</span>
              <span class="k">${t('Gates')}</span><span class="v">${result.gates}${result.missed ? ` (${t('{n} missed', { n: result.missed })})` : ''}${improved.gates && !improved.first ? `<span class="badge">${t('MOST')}</span>` : ''}</span>
              <span class="k">${t('Pearls')}</span><span class="v">${result.pearls}</span>
              <span class="k">${t('Time at sea')}</span><span class="v">${formatTime(result.time)}</span>
              <span class="k">${t('Capsizes')}</span><span class="v">${result.capsizes}</span>
            </div>
            ${rewardStrip(improved.pay, handlers.doubleOf(improved.pay))}
            ${orderStrip(improved.orders)}
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            ${shareButton()}
            <button class="btn small" data-act="voyages">${t('Voyages')}</button>
            <button class="btn primary" data-act="retry" data-autofocus>${t('Sail again')}</button>
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      wireResults(node, improved.pay, shareText('sea', { distance: result.distance }));
      show('results', node);
      const medalEls = node.querySelectorAll('.medal-chip');
      if (medalEls.length) {
        setTimeout(() => {
          if (current !== 'results') return;
          medalEls.forEach((m) => m.classList.add('on'));
          // On a short screen the strip can sit below the fold.
          medalEls[0].parentNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          handlers.onMedal();
        }, 500);
      }
    },

    raceResults(result, improved, save) {
      tipQueue = [];
      const rec = save.regatta;
      const cup = improved.cup;
      const fleet = FLEETS.find((f) => f.id === result.fleet) || FLEETS[0];
      const head = cup && cup.done ? (cup.place === 1 ? t('You won the cup!') : t('{place} in the cup', { place: ordinal(cup.place) })) : result.place === 1 ? t('You won!') : t('{place} place', { place: ordinal(result.place) });
      const marks = result.marks || 2;
      const rows = result.standings
        .map((e, i) => {
          const time = e.time !== null ? formatTime(e.time) : e.marks < marks ? t('mark {n}', { n: e.marks + 1 }) : t('sailing');
          return `<span class="k">${ordinal(i + 1)}</span><span class="v ${e.player ? 'you' : ''}">${e.player ? `<b>${t('You')}</b>` : esc(e.name)} <small>${time}</small></span>`;
        })
        .join('');
      const stepUp = fleetFor(rec.wins) > fleetFor(rec.wins - (improved.won ? 1 : 0));
      const eyebrow = cup ? `${t('Regatta Cup')} · ${t('Race {n} of {of}', { n: cup.race, of: cup.of })}` : `${t('Regatta')} · ${esc(t('{fleet} fleet', { fleet: t(fleet.name) }))}`;
      const trophy = cup && cup.done && cup.trophy ? `<div class="cup-won ${cup.trophy}">${icon('trophy', 56)}<span>${esc(t('{fleet} Cup', { fleet: t(fleet.name) }))}</span>${cup.boat ? `<small>${esc(t("The {boat} is yours. She's waiting in the Shipyard.", { boat: t(BOAT_TYPES[cup.boat].name) }))}</small>` : ''}</div>` : '';
      const table = cup ? `<div class="eyebrow">${cup.done ? t('Final points') : t('Cup points')}</div><div class="stat-rows standings cup-table">${cupRows(cup.table)}</div>` : '';
      const foot = !cup
        ? `<button class="btn primary" data-act="retry" data-autofocus>${t('Race again')}</button>`
        : cup.done
          ? `<button class="btn primary" data-act="cup" data-autofocus>${t('Regatta Cup')}</button>`
          : `<button class="btn primary" data-act="next" data-autofocus>${esc(t('Race {n}: {course}', { n: cup.race + 1, course: t(COURSES[cup.race].name) }))}</button>`;
      const node = el(`<section class="screen dim" aria-label="${cup && cup.done ? t('Cup over') : t('Race over')}">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><span class="eyebrow">${eyebrow}</span><h2>${head}</h2></div>
          <div class="sheet-body">
            ${trophy || `<div class="result-stars">${stars(0)}</div>`}
            ${cup ? '' : `<div class="stat-rows standings">${rows}</div>`}
            ${table}
            <div class="stat-rows">
              <span class="k">${t('Time')}</span><span class="v">${formatTime(result.time)}${improved.time && !improved.firstWin ? `<span class="badge">${t('BEST WIN')}</span>` : ''}</span>
              <span class="k">${t('Bumps')}</span><span class="v">${result.bumps}</span>
              <span class="k">${t('Wins')}</span><span class="v">${t('{n} of {of}', { n: rec.wins, of: rec.races })}</span>
              ${stepUp ? `<span class="k">${t('Next race')}</span><span class="v">${esc(t('{fleet} fleet', { fleet: t(FLEETS[fleetFor(rec.wins)].name) }))}<span class="badge">${t('STEP UP')}</span></span>` : ''}
            </div>
            ${rewardStrip(improved.pay, handlers.doubleOf(improved.pay))}
            ${orderStrip(improved.orders)}
            ${medalStrip(improved.medals)}
          </div>
          <div class="sheet-foot">
            ${shareButton()}
            <button class="btn small" data-act="voyages">${t('Voyages')}</button>
            ${foot}
          </div>
        </div></section>`);
      click(node, '[data-act=retry]', () => handlers.onRestart());
      click(node, '[data-act=next]', () => handlers.onPlay('cup'));
      click(node, '[data-act=cup]', () => handlers.onCup());
      click(node, '[data-act=voyages]', () => handlers.onQuit());
      wireResults(node, improved.pay, shareText('race', { place: result.place }));
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
          // On a short screen the strip can sit below the fold.
          medalEls[0].parentNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        const bt = BOAT_TYPES[id];
        const open = isBoatUnlocked(save, id);
        const picked = id === chosen;
        const ups = upgradeCount(save, id);
        const upgrade = `<button class="btn small" data-upgrade="${id}" aria-label="${esc(t('Upgrade the {boat}, {n} of {of}', { boat: t(bt.name), n: ups, of: PARTS.length * UPGRADE_STEPS }))}">${icon('hammer', 14)} ${ups}/${PARTS.length * UPGRADE_STEPS}</button>`;
        const action = picked
          ? `<div class="boat-buy"><button class="btn small" disabled>${t('Sailing')}</button>${upgrade}</div>`
          : open
            ? `<div class="boat-buy"><button class="btn small primary" data-boat="${id}">${t('Choose')}</button>${upgrade}</div>`
            : bt.prize
              ? `<div class="boat-buy"><button class="btn small" data-boat="${id}" aria-disabled="true">${icon('trophy', 14)} ${t('Win the Regatta Cup')}</button></div>`
              : `<div class="boat-buy"><button class="btn small" data-boat="${id}" aria-disabled="true">★ ${t('{n} to unlock', { n: bt.unlock })}</button><button class="btn small gem-btn" data-buy="${id}" aria-label="${t('Unlock now for {n} black pearls', { n: BOAT_PRICES[id] })}">${priceTag({ blackPearls: BOAT_PRICES[id] })} ${t('Now')}</button></div>`;
        return `<div class="boat-card ${open ? '' : 'locked'} ${picked ? 'picked' : ''}">
            <canvas class="boat-art" data-type="${id}" aria-hidden="true"></canvas>
            <div class="boat-head"><h3>${esc(t(bt.name))}</h3><span class="tag">${esc(t(bt.tag))}</span></div>
            <p class="boat-blurb">${esc(t(bt.blurb))}</p>
            ${boatStats(bt, open ? upgradeLevels(save, id) : {})}
            ${action}
          </div>`;
      }).join('');
      const node = el(`<section class="screen dim" aria-label="${t('Shipyard')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Shipyard')}</h2><span class="eyebrow">★ ${have} / ${levels.length * 3}</span><button class="btn small ${gearCount(save) > save.gearSeen ? 'fresh' : ''}" data-act="locker">${t('Sail Locker')}</button><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body"><p class="sheet-note">${t('Earn stars on the voyages to unlock new boats, or unlock one now with black pearls. Each one handles the wind its own way, and coins upgrade her sails, keel and hull.')}</p><div class="boat-grid">${cards}</div></div>
        </div></section>`);
      click(node, '[data-boat]', (e, b) => {
        const bt = BOAT_TYPES[b.dataset.boat];
        if (!isBoatUnlocked(save, bt.id)) {
          ui.toast(bt.prize ? t('Win the Regatta Cup to sail the {boat}.', { boat: t(bt.name) }) : t('Earn {n} more ★ to unlock the {boat}.', { n: bt.unlock - have, boat: t(bt.name) }));
          return;
        }
        handlers.onBoat(bt.id);
        ui.back();
      });
      click(node, '[data-buy]', (e, b) => unlockBoat(save, b.dataset.buy, () => ui.shipyard(save, true)));
      click(node, '[data-upgrade]', (e, b) => ui.upgrades(save, b.dataset.upgrade));
      click(node, '[data-act=locker]', () => ui.locker(save));
      click(node, '[data-act=back]', () => ui.back());
      show('shipyard', node, restore ? { keep: true } : { push: true });
      node.querySelectorAll('canvas.boat-art').forEach((c) => {
        const type = BOAT_TYPES[c.dataset.type];
        paintBoat(c, type, boatLook(type, gear));
      });
    },

    // The boatyard: coins for one boat's sails, keel and hull.
    upgrades(save, id, restore = false) {
      const bt = BOAT_TYPES[id];
      const levels = upgradeLevels(save, id);
      const all = PARTS.length * UPGRADE_STEPS;
      const done = upgradeCount(save, id);
      const pips = (n) => `<span class="pips" aria-hidden="true">${Array.from({ length: UPGRADE_STEPS }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
      const card = (p) => {
        const n = levels[p.id];
        const price = nextPrice(save, id, p.id);
        const button =
          price === null
            ? `<button class="btn small" disabled>${t('Done')}</button>`
            : `<button class="btn small" data-part="${p.id}" aria-label="${esc(t('Upgrade the {part} to step {n} for {coins} coins', { part: t(p.name).toLowerCase(), n: n + 1, coins: formatCoins(price) }))}">${priceTag({ coins: price })}</button>`;
        const sub = price === null ? esc(t('{stat} +{n}, fully upgraded', { stat: t(p.label), n })) : `${esc(t(p.text))} ${esc(t('Next: {step}.', { step: t(p.step) }))}`;
        return `<div class="shop-item ${price === null ? 'built' : ''}"><span class="shop-art">${icon(p.icon, 28)}</span><span class="shop-text"><b>${esc(t(p.name))} ${pips(n)}</b><small>${sub}</small></span>${button}</div>`;
      };
      const node = el(`<section class="screen dim" aria-label="${t('Boatyard')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Boatyard')}</h2><span class="eyebrow">${done} / ${all}</span>${wallet(save)}<button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <div class="locker-top"><canvas class="locker-preview" aria-hidden="true"></canvas>
              <div><b class="locker-fit">${esc(t(bt.name))}</b>${boatStats(bt, levels)}</div></div>
            <div class="shop-grid">${PARTS.map(card).join('')}</div>
            <p class="sheet-note">${t('Each boat keeps her own upgrades, three steps for each part. They help on every voyage, the Open Sea and the regatta.')}</p>
          </div>
        </div></section>`);
      click(node, '[data-part]', (e, b) => {
        const p = PARTS.find((x) => x.id === b.dataset.part);
        const price = { coins: nextPrice(save, id, p.id) };
        if (!canAfford(save, price)) {
          ui.toast(needMore(save, price));
          return;
        }
        ui.confirm({
          title: t('Upgrade the {part}?', { part: t(p.name).toLowerCase() }),
          text: `${t(p.text)} ${t('Step {n} of {of}: {step}.', { n: upgradeLevel(save, id, p.id) + 1, of: UPGRADE_STEPS, step: t(p.step) })}`,
          ok: `${t('Upgrade')} ${priceTag(price)}`,
          onOk: () => {
            const r = buyUpgrade(save, id, p.id);
            if (!r) return;
            handlers.onWallet();
            ui.toast(r.level === UPGRADE_STEPS ? t('{part} fully upgraded on the {boat}.', { part: t(p.name), boat: t(bt.name) }) : t('New {part} fitted: {stat} +{n}.', { part: t(p.name).toLowerCase(), stat: t(p.label).toLowerCase(), n: r.level }), 'good', 2600);
            ui.upgrades(save, id, true);
          },
        });
      });
      click(node, '[data-act=back]', () => ui.back());
      show('upgrades', node, restore ? { keep: true } : { push: true });
      paintBoat(node.querySelector('.locker-preview'), bt, boatLook(bt, fittedGear(save)));
    },

    locker(save) {
      const type = BOAT_TYPES[selectedBoat(save)];
      const card = (kind, g) => {
        const open = isGearUnlocked(save, g);
        const medal = medalFor(g);
        const name = medal && isSealed(medal, save, LEVELS) ? t('A secret medal') : medal && esc(t(medal.name));
        const fest = g.festival && festivalById(g.festival);
        const sub = fest ? `${open ? '' : icon('lock', 13)}${esc(t('{fest} week', { fest: t(fest.name) }))}` : g.price ? (open ? t('From the Shop') : priceTag({ coins: g.price })) : !medal ? t("The boat's own") : open ? name : `${icon('lock', 13)}${name}`;
        const state = open ? '' : g.price ? `, ${t('{coins} coins', { coins: formatCoins(g.price) })}` : `, ${t('locked')}`;
        return `<button class="gear ${open ? '' : g.price ? 'for-sale' : 'locked'}" data-kind="${kind}" data-id="${g.id}" aria-label="${esc(t(g.name))}${state}">
            <canvas class="gear-art" aria-hidden="true"></canvas><b>${esc(t(g.name))}</b><small>${sub}</small></button>`;
      };
      const node = el(`<section class="screen dim" aria-label="${t('Sail Locker')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Sail Locker')}</h2><span class="eyebrow">${gearCount(save)} / ${GEAR_TOTAL}</span>${wallet(save)}<button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <div class="locker-top"><canvas class="locker-preview" aria-hidden="true"></canvas>
              <div><b class="locker-fit"></b><p class="locker-blurb">${t('Every medal puts a new sail or hull paint in the locker, a few more are for sale, and each festival week brings a sail of its own. They change how your boat looks, never how it sails.')}</p></div></div>
            <h3 class="setting-group">${t('Sails')}</h3>
            <div class="gear-grid">${SAILS.map((g) => card('sail', g)).join('')}</div>
            <h3 class="setting-group">${t('Hull paint')}</h3>
            <div class="gear-grid">${HULLS.map((g) => card('hull', g)).join('')}</div>
          </div>
        </div></section>`);
      const paint = () => {
        const fitted = fittedGear(save);
        paintBoat(node.querySelector('.locker-preview'), type, boatLook(type, fitted));
        const sail = SAILS.find((g) => g.id === fitted.sail);
        const hull = HULLS.find((g) => g.id === fitted.hull);
        node.querySelector('.locker-fit').textContent = `${t(sail.name)} · ${t(hull.name)}`;
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
        if (!isGearUnlocked(save, g) && g.price) {
          const price = { coins: g.price };
          if (!canAfford(save, price)) {
            ui.toast(needMore(save, price));
            return;
          }
          ui.confirm({
            title: kind === 'sail' ? t('Buy the {name} sail?', { name: t(g.name) }) : t('Buy the {name} hull paint?', { name: t(g.name) }),
            text: t('Every boat in the Shipyard can wear it. It changes how she looks, never how she sails.'),
            ok: `${t('Buy')} ${priceTag(price)}`,
            onOk: () => {
              if (!buyGear(save, g)) return;
              handlers.onWallet();
              handlers.onGear(kind, id);
              b.classList.remove('for-sale');
              b.setAttribute('aria-label', t(g.name));
              b.querySelector('small').textContent = t('From the Shop');
              refreshWallet(node, save);
              paint();
            },
          });
          return;
        }
        if (!isGearUnlocked(save, g) && g.festival) {
          ui.toast(festivalHint(save, g));
          return;
        }
        if (!isGearUnlocked(save, g)) {
          const medal = medalFor(g);
          const vars = { name: t(g.name), medal: t(medal.name) };
          if (isSealed(medal, save, LEVELS)) ui.toast(`${kind === 'sail' ? t('A secret medal unlocks the {name} sail.', vars) : t('A secret medal unlocks the {name} hull paint.', vars)} “${t(medal.riddle)}”`);
          else ui.toast(`${kind === 'sail' ? t('Earn the {medal} medal for the {name} sail.', vars) : t('Earn the {medal} medal for the {name} hull paint.', vars)} ${t(medal.text)}`);
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

    // `restore` redraws it in place, as after a change of language.
    settings(save, restore = false) {
      const s = save.settings;
      // Reduced motion may still be following the phone's own setting, and
      // reminders are only on if the phone allows them too.
      const value = (key) => (key === 'reduceMotion' ? handlers.motionReduced() : key === 'reminders' ? !!s.reminders && handlers.remindersAllowed() : key === 'analytics' ? analyticsOn(s) : !!s[key]);
      const toggle = (key, label, sub, invert = false) => `<div class="setting">
        <span class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
        <button class="toggle" role="switch" data-key="${key}" data-invert="${invert}" aria-checked="${invert ? !value(key) : value(key)}" aria-label="${label}"></button></div>`;
      const seg = (key, label, sub, options, wide = false) => `<div class="setting ${wide ? 'wide' : ''}"><span class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
              <div class="seg ${wide ? 'wrap' : ''}" data-key="${key}" role="group" aria-label="${label}">
                ${options.map(([v, name]) => `<button data-v="${v}" aria-pressed="${s[key] === v}">${name}</button>`).join('')}
              </div></div>`;
      const sizes = [t('Normal'), t('Large'), t('Largest')];
      // The word "Language" stays in English too, for anyone who picked one they can't read.
      const langLabel = currentLang() === 'en' ? t('Language') : `${t('Language')} · Language`;
      // Google Play Games, when the app has it: { signedIn, name }, else null.
      const games = handlers.games ? handlers.games() : null;
      const node = el(`<section class="screen dim" aria-label="${t('Settings')}">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>${t('Settings')}</h2><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <h3 class="setting-group">${t('Sound and feel')}</h3>
            ${toggle('sound', t('Sound effects'), '')}
            ${toggle('music', t('Music'), t('A quiet sea shanty-ish tune'))}
            ${toggle('vibration', t('Vibration'), t('Bumps, capsizes and pickups'))}
            ${handlers.canRemind ? toggle('reminders', t('Reminders'), t('A nudge from the harbor at {times}', { times: reminderTimes() })) : ''}
            <h3 class="setting-group">${t('Sailing')}</h3>
            ${toggle('autoTrim', t('Trim the sail by hand'), t('For experienced sailors: W / S or the right-hand slider'), true)}
            ${toggle('leftHanded', t('Left-handed controls'), t('Steer on the right, gust button on the left'))}
            ${seg('steerSensitivity', t('Steering'), t('How hard a small thumb movement turns'), [[0.75, t('Gentle')], [1, t('Normal')], [1.35, t('Sharp')]])}
            ${seg('zoom', t('View'), t('How close the camera sits. The magnifier button changes it while you sail'), ZOOMS.map(([v, name]) => [v, t(name)]))}
            ${toggle('ghost', t('Race your best run'), t('A pale ghost boat replays your fastest voyage'))}
            ${toggle('hints', t('Dolphin hints'), t('Stuck or lost? Dolphins show you which way to turn'))}
            <h3 class="setting-group">${t('Seeing and reading')}</h3>
            ${seg('lang', langLabel, '', [['auto', t("Phone's")], ...LANGS.map((l) => [l.id, l.name])], true)}
            ${toggle('colorblind', t('Colour-blind friendly'), t('Blue for good and orange for danger, instead of green and red'))}
            ${toggle('reduceMotion', t('Reduce motion'), t('No screen shake or lightning flashes, lighter rain and snow'))}
            ${seg('textSize', t('Text size'), t('Menus, tips and messages in bottles'), TEXT_SIZES.map((v, i) => [v, sizes[i]]))}
            ${seg('quality', t('Graphics'), t('Lower is easier on older phones'), [['low', t('Low')], ['high', t('High')]])}
            ${ads().privacyRequired() ? `<h3 class="setting-group">${t('Privacy')}</h3>
            <div class="setting"><span class="label"><b>${t('Ad privacy')}</b><small>${t('Change what you agreed to for ads')}</small></span>
              <button class="btn small" data-act="privacy">${t('Options')}</button></div>` : ''}
            <h3 class="setting-group">${t('Friends')}</h3>
            <div class="setting"><span class="label"><b>${t('Tell a friend')}</b><small>${t('Send them the link to No Paddle')}</small></span>
              <button class="btn small" data-act="share">${icon('share', 16)} ${t('Share')}</button></div>
            ${games ? `<h3 class="setting-group">${t('Google Play Games')}</h3>
            ${games.signedIn ? `<div class="setting"><span class="label"><b>${t('Leaderboards')}</b><small>${games.name ? t('Signed in as {name}', { name: esc(games.name) }) : t('Signed in')}</small></span>
              <button class="btn small" data-act="boards">${t('Show')}</button></div>
            <div class="setting"><span class="label"><b>${t('Cloud save')}</b><small>${t('Your progress is copied to the cloud as you sail')}</small></span>
              <span class="setting-buttons"><button class="btn small" data-act="cloud-load">${t('Load')}</button><button class="btn small" data-act="cloud-save">${t('Save')}</button></span></div>` : `<div class="setting"><span class="label"><b>${t('Leaderboards and cloud save')}</b><small>${t('Sign in with Google Play Games')}</small></span>
              <button class="btn small primary" data-act="games-in">${t('Sign in')}</button></div>`}` : ''}
            ${hasAnalytics() ? `<h3 class="setting-group">${t('Analytics')}</h3>
            ${toggle('analytics', t('Analytics and crash reports'), t('Anonymous: how far players get, and what went wrong in a crash. Nothing about you.'))}` : ''}
            <h3 class="setting-group">${t('Help')}</h3>
            <div class="setting"><span class="label"><b>${t('How to sail')}</b><small>${t('Tacking, trim and gusts, step by step')}</small></span>
              <button class="btn small" data-act="howto">${t('Open')}</button></div>
            <div class="setting"><span class="label"><b>${t('Prologue')}</b><small>${t('The film of the squall that took your oar')}</small></span>
              <button class="btn small ${save.seenFilm ? '' : 'fresh'}" data-act="film" aria-label="${t('Watch the prologue')}">${t('Watch')}</button></div>
            <h3 class="setting-group">${t('Progress')}</h3>
            <div class="setting"><span class="label"><b>${t('Backup code')}</b><small>${t('Move your progress to another phone')}</small></span>
              <button class="btn small" data-act="backup">${t('Show')}</button></div>
            <div class="setting"><span class="label"><b>${t('Reset progress')}</b><small>${t('Clears times, stars, medals and the logbook')}</small></span>
              <button class="btn small" data-act="reset">${t('Reset')}</button></div>
          </div>
        </div></section>`);
      click(node, '.toggle', (e, b) => {
        const key = b.dataset.key;
        const invert = b.dataset.invert === 'true';
        s[key] = !value(key);
        b.setAttribute('aria-checked', String(invert ? !s[key] : s[key]));
        handlers.onSettings(s, key);
      });
      click(node, '.seg button', (e, b) => {
        const seg = b.parentElement;
        const key = seg.dataset.key;
        const raw = b.dataset.v;
        s[key] = key === 'quality' || key === 'lang' ? raw : Number(raw);
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        handlers.onSettings(s, key);
        if (key === 'lang') {
          const scroll = node.querySelector('.sheet-body').scrollTop;
          ui.settings(save, true).querySelector('.sheet-body').scrollTop = scroll;
        }
      });
      click(node, '[data-act=reset]', (e, b) => {
        if (b.dataset.confirm) {
          handlers.onReset();
          ui.toast(t('Progress cleared.'));
          b.textContent = t('Done');
          b.disabled = true;
        } else {
          b.dataset.confirm = '1';
          b.textContent = t('Tap again');
        }
      });
      click(node, '[data-act=share]', () => shareOut(shareText('game')));
      click(node, '[data-act=backup]', () => ui.backup(save));
      click(node, '[data-act=howto]', () => ui.howto(save));
      click(node, '[data-act=film]', () => handlers.onFilm());
      click(node, '[data-act=games-in]', () => handlers.onGamesSignIn());
      click(node, '[data-act=boards]', () => handlers.onLeaderboards());
      click(node, '[data-act=cloud-save]', async (e, b) => {
        b.disabled = true;
        const r = await handlers.onCloudSave();
        b.disabled = false;
        // 'asked': the cloud had more, and the player is being asked about it.
        if (r === 'saved') ui.toast(t('Saved to the cloud.'), 'good');
        else if (r === 'failed') ui.toast(t("Couldn't reach Google Play Games. Try again later."), 'warn');
      });
      click(node, '[data-act=cloud-load]', async (e, b) => {
        b.disabled = true;
        const r = await handlers.onCloudLoad();
        b.disabled = false;
        if (!r.ok) ui.toast(t("Couldn't reach Google Play Games. Try again later."), 'warn');
        else if (!r.found) ui.toast(t("There's no progress in the cloud yet."));
        else if (!r.backup.ok) ui.toast(t("The progress in the cloud couldn't be read."), 'warn');
        else {
          ui.confirm({
            title: t("Replace this phone's progress?"),
            text: t("The cloud holds {list} and {last}. What's on this phone now will be gone.", progressList(r.backup.summary)),
            ok: t('Restore'),
            onOk: () => handlers.onRestore(r.backup.save, 'cloud'),
          });
        }
      });
      click(node, '[data-act=privacy]', async () => {
        const r = await ads().privacyOptions();
        if (!r.ok) ui.toast(t("The privacy options couldn't open. Try again later."));
      });
      click(node, '[data-act=back]', () => ui.back());
      show('settings', node, restore ? { keep: true } : { push: true });
      return node;
    },

    // Backup code: this phone's progress as a code to copy, and a box to paste
    // one from another phone.
    backup(save) {
      const node = el(`<section class="screen dim" aria-label="${t('Backup code')}">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>${t('Backup code')}</h2><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body backup">
            <h3 class="setting-group">${t("This phone's progress")}</h3>
            <p class="sheet-note backup-note">${t('Copy the code and keep it somewhere safe, like a note or a message to yourself.')}</p>
            <textarea class="backup-code" readonly rows="3" spellcheck="false" aria-label="${t("This phone's backup code")}">…</textarea>
            <div class="backup-foot"><button class="btn small primary" data-act="copy" disabled>${icon('copy', 16)} ${t('Copy code')}</button></div>
            <h3 class="setting-group">${t('Bring progress here')}</h3>
            <p class="sheet-note backup-note">${t('Paste the code from your other phone. It takes the place of the progress on this one.')}</p>
            <textarea class="backup-paste" rows="3" spellcheck="false" autocomplete="off" placeholder="NP1.…" aria-label="${t('Paste a backup code')}"></textarea>
            <div class="backup-foot">${handlers.canPaste ? `<button class="btn small" data-act="paste">${t('Paste')}</button>` : ''}<button class="btn small primary" data-act="restore">${t('Restore')}</button></div>
          </div>
        </div></section>`);
      const mine = node.querySelector('.backup-code');
      const box = node.querySelector('.backup-paste');
      backupCode(save).then((code) => {
        mine.value = code;
        node.querySelector('[data-act=copy]').disabled = false;
      });
      mine.addEventListener('focus', () => mine.select());
      click(node, '[data-act=copy]', async (e, b) => {
        if (await handlers.onCopy(mine.value)) {
          ui.toast(t('Copied. Keep it somewhere safe.'), 'good');
          b.lastChild.textContent = ` ${t('Copied')}`;
        } else {
          mine.focus();
          mine.select();
          ui.toast(t('Hold the code and choose Copy.'));
        }
      });
      click(node, '[data-act=paste]', async () => {
        const text = await handlers.onPaste();
        if (text) box.value = text.trim();
        else {
          box.focus();
          ui.toast(t('Hold the box and choose Paste.'));
        }
      });
      click(node, '[data-act=restore]', async (e, b) => {
        b.disabled = true;
        const r = await readBackup(box.value);
        b.disabled = false;
        if (!r.ok) {
          ui.toast(t(BACKUP_TROUBLE[r.reason]), 'warn', 5000);
          return;
        }
        ui.confirm({
          title: t("Replace this phone's progress?"),
          text: t("The code holds {list} and {last}. What's on this phone now will be gone.", progressList(r.summary)),
          ok: t('Restore'),
          onOk: () => handlers.onRestore(r.save),
        });
      });
      click(node, '[data-act=back]', () => ui.back());
      show('backup', node, { push: true });
    },

    howto(save, thenPlay = false, playIndex = 0) {
      howtoPage = 0;
      const node = el(`<section class="screen dim" aria-label="${t('How to sail')}">
        <div class="sheet">
          <div class="sheet-head"><h2>${t('How to sail')}</h2><button class="btn small" data-act="skip">${thenPlay ? t('Skip') : t('Close')}</button></div>
          <div class="sheet-body"><div class="howto"><div class="fig"></div><div class="txt"></div></div></div>
          <div class="sheet-foot"><div class="dots">${HOWTO.map(() => '<i></i>').join('')}</div>
            <button class="btn small" data-act="prev">${t('Back')}</button>
            <button class="btn primary" data-act="next" data-autofocus>${t('Next')}</button></div>
        </div></section>`);
      const render = () => {
        const page = HOWTO[howtoPage];
        node.querySelector('.fig').innerHTML = page.svg();
        node.querySelector('.txt').innerHTML = `<h3>${t(page.title)}</h3>${t(page.body)}`;
        node.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === howtoPage));
        node.querySelector('[data-act=prev]').disabled = howtoPage === 0;
        const last = howtoPage === HOWTO.length - 1;
        node.querySelector('[data-act=next]').textContent = last ? (thenPlay ? t('Set sail') : t('Done')) : t('Next');
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
      let sealed = 0;
      const cards = MEDALS.map((m) => {
        const earned = isEarned(save, m.id);
        const gear = rewardFor(m.id);
        const reward = gear ? `<span class="medal-reward">${esc(t('Sail Locker: {gear}', { gear: gearName(gear) }))}</span>` : '';
        if (isSealed(m, save, LEVELS)) {
          // A secret: only its riddle, until you reach the waters it's won in.
          sealed += 1;
          return `<div class="medal sealed">
            <span class="medal-disc" aria-hidden="true">?</span>
            <span class="medal-text"><b><span aria-hidden="true">???</span><span class="sr-only">${t('Secret medal')}</span></b><small class="riddle">“${esc(t(m.riddle))}”</small>${reward}</span>
          </div>`;
        }
        const p = earned ? null : medalProgress(m, save, LEVELS);
        const meter =
          p && p[1] > 1
            ? `<span class="medal-meter"><i style="width:${Math.round((100 * Math.min(p[0], p[1])) / p[1])}%"></i></span><span class="medal-count">${p[0]} / ${p[1]}${m.unit ? ` ${esc(t(m.unit))}` : ''}</span>`
            : '';
        const day = save.medals[m.id];
        const when = earned && /^\d{4}-\d\d-\d\d$/.test(day) ? `<span class="medal-count">${esc(dayLabel(day))}</span>` : '';
        return `<div class="medal ${earned ? 'earned' : ''}">
            <span class="medal-disc">${icon(m.icon, 26)}</span>
            <span class="medal-text"><b>${esc(t(m.name))}</b><small>${esc(t(m.text))}</small>${reward}${meter}${when}</span>
          </div>`;
      }).join('');
      const node = el(`<section class="screen dim" aria-label="${t('Medals')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Medals')}</h2><span class="eyebrow">${got} / ${MEDALS.length}${sealed ? ` · ${t('{n} secret', { n: sealed })}` : ''}</span><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">${sealed ? `<p class="sheet-note">${sealed > 1 ? t("{n} medals are still a secret. Each one breaks its seal when you reach the waters it's won in.", { n: sealed }) : t("1 medal is still a secret. It breaks its seal when you reach the waters it's won in.")}</p>` : ''}<div class="medal-grid">${cards}</div></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      show('medals', node, { push: true });
      if (save.medalsSeen !== got) {
        save.medalsSeen = got;
        handlers.onSeen();
      }
    },

    // The Sea Atlas: one page at a time, with tabs for every page. It opens
    // on the page that's furthest along without being full.
    atlas(save, pageId = null) {
      const open = (id) => PAGES.find((p) => p.id === id);
      const page =
        open(pageId) ||
        [...PAGES].filter((p) => !pageDone(save, p.id) && atlasCount(save, p.id)).sort((a, b) => atlasCount(save, b.id) / b.entries.length - atlasCount(save, a.id) / a.entries.length)[0] ||
        PAGES.find((p) => !pageDone(save, p.id)) ||
        PAGES[0];
      const met = atlasCount(save);
      const tabs = PAGES.map((p) => {
        const n = atlasCount(save, p.id);
        const full = n === p.entries.length;
        return `<button class="atlas-tab ${p.id === page.id ? 'on' : ''} ${full ? 'full' : ''}" data-page="${p.id}" style="--page:${p.color}" aria-pressed="${p.id === page.id}" aria-label="${esc(t('{page}, {n} of {of}', { page: t(p.name), n, of: p.entries.length }))}">${esc(t(p.name))} <small>${full ? '✓' : `${n}/${p.entries.length}`}</small></button>`;
      }).join('');
      const cards = page.entries
        .map((e) =>
          hasMet(save, e.id)
            ? `<div class="atlas-card met"><span class="atlas-art">${icon(e.icon, 30)}</span><span class="atlas-text"><b>${esc(t(e.name))}</b><small>${esc(t(e.text))}</small></span></div>`
            : `<div class="atlas-card"><span class="atlas-art" aria-hidden="true">${icon(e.icon, 30)}<i>?</i></span><span class="atlas-text"><b><span aria-hidden="true">???</span><span class="sr-only">${t('Not met yet')}</span></b><small>${page.id === 'weather' ? t('Out in the weather somewhere.') : esc(t('Somewhere in {page}.', { page: t(page.name) }))}</small></span></div>`,
        )
        .join('');
      const n = atlasCount(save, page.id);
      const prize = t('{coins} coins and {n} black pearl', { coins: PAGE_REWARD.coins, n: PAGE_REWARD.blackPearls });
      const foot = pageRewarded(save, page.id)
        ? `<p class="atlas-foot done">${icon('star', 16)} ${t('Page filled. Reward collected: {prize}.', { prize })}</p>`
        : `<p class="atlas-foot"><span class="medal-meter"><i style="width:${Math.round((100 * n) / page.entries.length)}%"></i></span> ${t('Fill this page for {prize}.', { prize })}</p>`;
      const node = el(`<section class="screen dim" aria-label="${t('Sea Atlas')}">
        <div class="sheet wide atlas" style="--page:${page.color}">
          <div class="sheet-head"><h2>${t('Sea Atlas')}</h2><span class="eyebrow">${met} / ${ATLAS_TOTAL}</span><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <p class="sheet-note">${t("Sail near a creature or a sight and it's written in. Every page you fill pays {prize}.", { prize })}</p>
            <div class="atlas-tabs" role="group" aria-label="${t('Pages')}">${tabs}</div>
            <h3 class="atlas-title">${esc(t(page.name))} <small>${n} / ${page.entries.length}</small></h3>
            <div class="atlas-grid">${cards}</div>
            ${foot}
          </div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-page]', (e, b) => {
        const scroll = node.querySelector('.atlas-tabs').scrollLeft;
        const next = ui.atlas(save, b.dataset.page);
        next.querySelector('.atlas-tabs').scrollLeft = scroll;
        next.querySelector('.atlas-tab.on').focus({ preventScroll: true });
      });
      show('atlas', node, pageId ? { keep: true } : { push: true });
      const tab = node.querySelector('.atlas-tab.on');
      if (tab && !pageId) tab.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (save.atlasSeen !== met) {
        save.atlasSeen = met;
        handlers.onSeen();
      }
      return node;
    },

    logbook(save) {
      const notes = save.notes.length
        ? save.notes.map((n) => `<p class="note-card">“${esc(t(n))}”</p>`).join('')
        : `<p class="empty">${t('No bottles found yet. Keep an eye on the water.')}</p>`;
      const crew = save.crew.length
        ? save.crew.map((c) => `<p class="note-card crew"><b>${esc(t(c.name))}</b> “${esc(t(c.line))}”</p>`).join('')
        : `<p class="empty">${t('Nobody hauled from the water yet. Listen for shouts.')}</p>`;
      const s = save.stats;
      const node = el(`<section class="screen dim" aria-label="${t('Logbook')}">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>${t('Logbook')}</h2><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <div class="stat-rows" style="margin-bottom:14px">
              <span class="k">${t('Voyages finished')}</span><span class="v">${s.voyages}</span>
              <span class="k">${t('Distance sailed')}</span><span class="v">${(s.distance * 0.000309).toFixed(2)} km</span>
              <span class="k">${t('Capsizes')}</span><span class="v">${s.capsizes}</span>
              <span class="k">${t('Castaways rescued')}</span><span class="v">${s.rescued}</span>
            </div>
            <div class="eyebrow" style="margin-bottom:8px">${t('Messages in bottles')} · ${save.notes.length}</div>
            ${notes}
            <div class="eyebrow" style="margin:16px 0 8px">${t('Sailors you brought home')} · ${save.crew.length}</div>
            ${crew}
          </div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      show('logbook', node, { push: true });
    },

    // The harbourmaster's three jobs for today, the chest for all three, and
    // one swap a day. `restore` redraws it after a swap.
    orders(save, restore = false) {
      const today = dateKey();
      const list = todaysOrders(save, today);
      const o = save.orders;
      const done = list.filter((d) => d.done).length;
      const row = (d) => {
        const p = Math.floor(d.progress);
        const side = d.done
          ? `<span class="order-pay done">${t('Done')}</span>`
          : `<span class="order-pay">${icon('coin', 16)}${d.pay}</span>${o.swapped ? '' : `<button class="btn small" data-swap="${d.id}" aria-label="${esc(t('Swap: {order}', { order: t(d.text) }))}">${t('Swap')}</button>`}`;
        return `<div class="shop-item order ${d.done ? 'done' : ''}">
            <span class="shop-art">${icon(d.icon, 28)}</span>
            <span class="shop-text"><b>${esc(t(d.text))}</b><small>${esc(t(d.note))}</small><span class="order-meter"><span class="medal-meter"><i style="width:${Math.round((100 * p) / d.goal)}%"></i></span><span class="medal-count">${p} / ${d.goal}</span></span></span>
            <span class="order-side">${side}</span>
          </div>`;
      };
      const chest = `<div class="shop-item order chest ${o.chest ? 'done' : ''}">
          <span class="shop-art">${icon('chest', 28)}</span>
          <span class="shop-text"><b>${t("Harbourmaster's chest")}</b><small>${o.chest ? t('Opened today. Another waits tomorrow.') : t('Finish all three orders today to open it.')}</small></span>
          <span class="order-side">${o.chest ? `<span class="order-pay done">${t('Opened')}</span>` : `<span class="order-pay gem">${icon('blackPearl', 16)}${CHEST}</span>`}</span>
        </div>`;
      const node = el(`<section class="screen dim" aria-label="${t('Orders')}">
        <div class="sheet">
          <div class="sheet-head"><h2>${t('Orders')}</h2><span class="eyebrow">${t('{n} / {of} done', { n: done, of: list.length })}</span><button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <p class="sheet-note">${t("Three jobs from the harbourmaster, new every day. Each one pays the moment it's done, and all three open the chest.")}</p>
            <div class="order-list">${list.map(row).join('')}${chest}</div>
            <p class="order-foot">${o.swapped ? t("You've swapped an order today.") : t('You can swap one order a day.')} ${t('New orders in {time}.', { time: untilMidnight() })}</p>
          </div>
        </div></section>`);
      click(node, '[data-swap]', (e, b) => {
        const order = list.find((d) => d.id === b.dataset.swap);
        ui.confirm({
          title: t('Swap this order?'),
          text: `${t('“{order}” goes back and another order of its kind takes its place.', { order: t(order.text) })}${order.progress ? ` ${t('Its progress is lost.')}` : ''} ${t('You can swap one order a day.')}`,
          ok: t('Swap'),
          onOk: () => {
            const next = swapOrder(save, dateKey(), order.id);
            if (!next) return;
            handlers.onSeen();
            if (current !== 'orders') return;
            ui.orders(save, true);
            ui.toast(t('New order: {order}.', { order: t(next.text) }), 'good', 2400);
          },
        });
      });
      click(node, '[data-act=back]', () => ui.back());
      show('orders', node, restore ? { keep: true } : { push: true });
      if (!o.seen) {
        o.seen = true;
        handlers.onSeen();
      }
    },

    // A black pearl for a video, supplies for coins, boats for black pearls.
    // Nothing is sold for money. The video says "Coming soon" until ads are in.
    shop(save, restore = false) {
      const today = dateKey();
      const videos = ads().adsReady();
      const item = (art, name, sub, button) =>
        `<div class="shop-item"><span class="shop-art">${art}</span><span class="shop-text"><b>${name}</b><small>${sub}</small></span>${button}</div>`;
      const video = item(
        icon('play', 28),
        t('Watch a video'),
        t('One black pearl · {n} left today', { n: `<span data-left>${videosLeft(save, REWARDS.blackPearl, today)}</span>` }),
        `<button class="btn small" data-video ${videos ? '' : 'disabled'}>${videos ? t('Watch') : t('Coming soon')}</button>`,
      );
      const boats = BOAT_ORDER.filter((id) => BOAT_PRICES[id] && !isBoatUnlocked(save, id));
      const node = el(`<section class="screen dim" aria-label="${t('Shop')}">
        <div class="sheet wide">
          <div class="sheet-head"><h2>${t('Shop')}</h2>${wallet(save)}<button class="btn small" data-act="back">${t('Back')}</button></div>
          <div class="sheet-body">
            <h3 class="setting-group">${t('Black pearls')}</h3>
            <p class="sheet-note">${t("Black pearls are rare, far rarer than the white ones. On some voyages one lies where the sea is most dangerous: in a whirlpool's pull, over a kraken's lair, off a pirate cove. Bring it home to keep it.")}</p>
            <div class="shop-grid">${video}</div>
            <h3 class="setting-group">${t('Supplies')}</h3>
            <div class="shop-grid">
              ${item(icon('wind', 28), t('Gust jar'), t('Goes aboard on your next voyage. In the hold: {n} / {of}', { n: `<b data-jars>${save.wallet.jars}</b>`, of: JAR_HOLD }), `<button class="btn small" data-buy="jar">${priceTag({ coins: JAR_PRICE })}</button>`)}
              ${item(icon('coin', 28), t('Trade a black pearl'), t('{coins} coins for one black pearl', { coins: formatCoins(TRADE_COINS) }), `<button class="btn small" data-buy="trade">${priceTag({ blackPearls: 1 })}</button>`)}
            </div>
            <h3 class="setting-group">${t('Boats')}</h3>
            <div class="shop-grid">${
              boats.length
                ? boats
                    .map((id) => {
                      const bt = BOAT_TYPES[id];
                      return item(`<canvas class="shop-boat" data-type="${id}" aria-hidden="true"></canvas>`, esc(t(bt.name)), `${esc(t(bt.tag))} · ${t('or ★ {n}', { n: bt.unlock })}`, `<button class="btn small gem-btn" data-boat="${id}" aria-label="${esc(t('Unlock the {boat} for {n} black pearls', { boat: t(bt.name), n: BOAT_PRICES[id] }))}">${priceTag({ blackPearls: BOAT_PRICES[id] })}</button>`);
                    })
                    .join('')
                : `<p class="shop-empty">${t('Every boat in the Shipyard is yours.')}</p>`
            }</div>
            <h3 class="setting-group">${t('Your harbor')}</h3>
            <div class="shop-grid">${item(icon('anchor', 28), t('Your harbor'), t('A lighthouse, docks, houses and boats, built with coins. {n} / {of} built.', { n: harborBuilt(save).length, of: HARBOR_TOTAL }), `<button class="btn small" data-act="harbor">${t('Show')}</button>`)}</div>
            <h3 class="setting-group">${t('Sails and paints')}</h3>
            <div class="shop-grid">${item(icon('crown', 28), t('Sail Locker'), t('Royal purple, sunset and diamond-dust sails, and new hull paints, for coins.'), `<button class="btn small" data-act="locker">${t('Show')}</button>`)}</div>
          </div>
        </div></section>`);
      const redraw = () => {
        refreshWallet(node, save);
        node.querySelector('[data-jars]').textContent = save.wallet.jars;
        node.querySelector('[data-left]').textContent = videosLeft(save, REWARDS.blackPearl, today);
      };
      click(node, '[data-act=harbor]', () => ui.harbor(save));
      click(node, '[data-buy=jar]', () => {
        if (save.wallet.jars >= JAR_HOLD) {
          ui.toast(t('The hold is full: {n} jars is all a voyage carries.', { n: JAR_HOLD }));
          return;
        }
        if (!buyJar(save)) {
          ui.toast(needMore(save, { coins: JAR_PRICE }));
          return;
        }
        handlers.onWallet();
        ui.toast(t('A gust jar is stowed for your next voyage.'), 'good', 2400);
        redraw();
      });
      click(node, '[data-buy=trade]', () => {
        if (!canAfford(save, { blackPearls: 1 })) {
          ui.toast(needMore(save, { blackPearls: 1 }));
          return;
        }
        ui.confirm({
          title: t('Trade a black pearl?'),
          text: t('One black pearl for {coins} coins.', { coins: formatCoins(TRADE_COINS) }),
          ok: `${t('Trade')} ${priceTag({ blackPearls: 1 })}`,
          onOk: () => {
            if (!tradeBlackPearl(save)) return;
            handlers.onWallet();
            redraw();
          },
        });
      });
      click(node, '[data-boat]', (e, b) => unlockBoat(save, b.dataset.boat, () => ui.shop(save, true)));
      click(node, '[data-video]', async (e, b) => {
        if (!videosLeft(save, REWARDS.blackPearl, today)) {
          ui.toast(t('That is all the videos for today. More tomorrow!'));
          return;
        }
        b.disabled = true;
        const r = await watchVideo(save, REWARDS.blackPearl, today);
        b.disabled = false;
        if (r.ok) handlers.onWallet();
        if (current !== 'shop') return;
        if (r.ok) ui.toast(t('+1 black pearl. Thanks for watching!'), 'good');
        else if (r.reason !== 'cancelled') ui.toast(t('No video right now. Try again later.'));
        redraw();
      });
      click(node, '[data-act=locker]', () => ui.locker(save));
      click(node, '[data-act=back]', () => ui.back());
      show('shop', node, restore ? { keep: true } : { push: true });
      node.querySelectorAll('canvas.shop-boat').forEach((c) => {
        const type = BOAT_TYPES[c.dataset.type];
        paintBoat(c, type, boatLook(type, fittedGear(save)));
      });
      if (!save.sightings.shop) {
        save.sightings.shop = true;
        handlers.onSeen();
      }
    },

    // Ask before spending. `ok` is the confirm button's label (may hold an icon).
    // A phone that has just signed in to Google Play Games finds more
    // progress in the cloud than it has itself.
    cloudFound(backup, { onBring, onKeep }) {
      ui.confirm({
        title: t('Progress found in the cloud'),
        text: t('Google Play Games has your progress with {list} and {last}. Bring it to this phone? What is on it now will be gone.', progressList(backup.summary)),
        ok: t('Bring it here'),
        onOk: onBring,
        no: t("Keep this phone's"),
        onNo: onKeep,
      });
    },

    // Settings drawn again where it stands, as after signing in.
    refreshSettings(save) {
      if (ui.current !== 'settings') return;
      const body = screens.settings && screens.settings.querySelector('.sheet-body');
      const scroll = body ? body.scrollTop : 0;
      ui.settings(save, true).querySelector('.sheet-body').scrollTop = scroll;
    },

    // `no` and `onNo` name the other answer, when it's more than "not now".
    confirm({ title, text, ok = t('OK'), onOk, no = t('Not now'), onNo }) {
      ui.closeConfirm();
      const node = el(`<div class="confirm" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="confirm-box">
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
          <div class="confirm-foot"><button class="btn small" data-act="no">${esc(no)}</button><button class="btn small primary" data-act="yes">${ok}</button></div>
        </div></div>`);
      click(node, '[data-act=no]', () => {
        ui.closeConfirm();
        if (onNo) onNo();
      });
      click(node, '[data-act=yes]', () => {
        ui.closeConfirm();
        onOk();
      });
      node.addEventListener('click', (e) => {
        if (e.target === node) ui.closeConfirm();
      });
      root.appendChild(node);
      void node.offsetWidth;
      node.classList.add('open');
      if (!matchMedia('(pointer: coarse)').matches) node.querySelector('[data-act=yes]').focus({ preventScroll: true });
    },

    // Returns true if a confirm box was open.
    closeConfirm() {
      const box = root.querySelector('.confirm');
      if (!box) return false;
      box.remove();
      return true;
    },

    // An Open Sea run has ended: offer a second wind for black pearls (or a video).
    secondWind(result, save, { onTake, onVideo, onEnd }) {
      tipQueue = [];
      const price = { blackPearls: SECOND_WIND };
      const video = ads().adsReady() && videosLeft(save, REWARDS.secondWind, dateKey()) > 0;
      const node = el(`<section class="screen dim" aria-label="${t('Second wind')}">
        <div class="sheet narrow results-sheet">
          <div class="sheet-head"><span class="eyebrow">${t('Open Sea')} · ${formatDistance(result.distance)} ${t('east')}</span><h2>${result.reason === 'sunk' ? t('The hull gave out') : t('Out of time')}</h2>${wallet(save)}</div>
          <div class="sheet-body">
            <p class="second-wind">${icon('wind', 30)}<span>${t('Take a <b>second wind</b>: {n} more seconds on the clock and the hull patched up, right where you are.', { n: SECOND_WIND_TIME })}</span></p>
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="end">${t('End run')}</button>
            ${video ? `<button class="btn small" data-act="video">${icon('play', 16)} ${t('Watch a video')}</button>` : ''}
            <button class="btn primary" data-act="take" data-autofocus ${canAfford(save, price) ? '' : 'disabled'}>${t('Sail on')} ${priceTag(price)}</button>
          </div>
        </div></section>`);
      click(node, '[data-act=end]', () => onEnd());
      click(node, '[data-act=take]', () => onTake());
      click(node, '[data-act=video]', async (e, b) => {
        b.disabled = true;
        const ok = await onVideo();
        if (!ok && current === 'secondwind') {
          b.disabled = false;
          ui.toast(t('No video right now.'));
        }
      });
      show('secondwind', node);
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

    // kind: '' | 'good' | 'warn' | 'note' | 'note rescue' | 'tip' (one at a time, queued) |
    // 'alert' (danger right now, never waits).
    // `soon` puts a tip at the head of the queue, for news that can't wait.
    toast(text, kind = '', ms = 3200, soon = false) {
      const live = [...toasts.children].filter((n) => !n.classList.contains('out'));
      // The same message again just stays up longer.
      const same = live.find((n) => n.textContent === text);
      if (same) {
        hold(same, ms);
        return;
      }
      if (kind === 'tip') {
        const shown = live.find((n) => n.classList.contains('tip'));
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
      // The label drawn before the text, in the game's language.
      const tag = /\brescue\b/.test(kind) ? t('Hauled aboard') : /\bnote\b/.test(kind) ? t('Message in a bottle') : /\btip\b/.test(kind) ? t('Tip') : /\balert\b/.test(kind) ? t('Danger') : /\batlas\b/.test(kind) ? t('Atlas') : '';
      if (tag) node.dataset.tag = tag;
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
      const steps = ['3', '2', '1', t('Sail!')];
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
