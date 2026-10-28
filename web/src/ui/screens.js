// DOM menus layered over the canvas: title, voyage select, briefing, pause,
// results, settings, how-to-sail and the logbook of bottle notes. Plus toasts.

import { formatTime, compassPoint, DEG } from '../core/math.js';
import { beaufort, toKnots } from '../physics/sailing.js';
import { POLAR } from '../world/autopilot.js';
import { isUnlocked, totalStars } from '../platform/save.js';

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
  const w = def.weather || {};
  if (w.fog) out.push(['Fog', false]);
  if (w.night) out.push(['Night', false]);
  if (w.lightning) out.push(['Lightning', false]);
  if ((def.wind.events || []).length) out.push(['Wind shifts', false]);
  return out;
}

function windSentence(def) {
  const kn = toKnots(def.wind.speed);
  const bf = beaufort(kn);
  return `${Math.round(kn)} kn from the ${compassPoint(def.wind.from)} · ${bf.name}`;
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
  return `<svg viewBox="0 0 220 230" role="img" aria-label="Boat speed for each heading relative to the wind">
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
    <path d="M150 30 A90 90 0 0 1 200 110" fill="none" stroke="#ff4d4d" stroke-width="2.5" stroke-dasharray="5 4"/>
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
    <g transform="translate(160 140)"><circle r="28" fill="rgba(4,22,30,0.7)" stroke="#ff4d4d" stroke-width="2" stroke-dasharray="5 4"/>
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
    <g transform="translate(55 140) scale(2.4) rotate(12)"><rect x="-6" y="-6" width="12" height="12" fill="#9b6a3f" stroke="#5e3b25"/><rect x="-1.2" y="-4" width="2.4" height="8" fill="#3ddc97"/><rect x="-4" y="-1.2" width="8" height="2.4" fill="#3ddc97"/></g>
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
      <p>Pointing straight into the wind is the <b>no-go zone</b>: the sail just flaps and you stop. The red wedge on the wind dial marks it.</p>`,
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
      <p><b>Sheet in</b> (pull the sail tight) when heading upwind; <b>ease out</b> when the wind is behind you. Flapping (<b>luffing</b>) means it's too loose; <b>stalled</b> means it's too tight. Stay in the green band.</p>`,
  },
  {
    title: 'Heel, gusts and capsizing',
    svg: heelSvg,
    body: `<p>Strong wind leans the boat over. Past about 40° the heel meter turns red; push further and you <b>capsize</b>, losing time and hull.</p>
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

export function createUI(root, levels, handlers) {
  const screens = {};
  let current = null;
  let stack = [];
  let howtoPage = 0;
  let lastBriefing = 0;
  const toasts = root.querySelector('#toasts');

  function dismiss(node) {
    clearTimeout(node._timer);
    node.classList.add('out');
    setTimeout(() => node.remove(), 380);
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

  function show(name, node, { push = false } = {}) {
    if (current && current !== name) {
      if (push) stack.push(current);
      else stack = [];
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
      const node = el(`<section class="screen scrim" aria-label="Title">
        <div class="title-wrap">
          <div class="eyebrow">A sailing voyage</div>
          <h1 class="logo">BOAT<span>IFY</span></h1>
          <p class="tagline">A squall snapped your oar. Now only the wind can carry you from <b>A</b> to <b>B</b>. Read it, ride it, and don't capsize.</p>
          <div class="title-buttons">
            <button class="btn primary" data-act="play" data-autofocus>${save.stats.voyages ? 'Set sail' : 'Start voyage'}</button>
            <button class="btn" data-act="voyages">Voyages</button>
            <button class="btn" data-act="howto">How to sail</button>
          </div>
          <div class="title-buttons">
            <button class="btn small" data-act="logbook">Logbook</button>
            <button class="btn small" data-act="settings">Settings</button>
          </div>
          <div class="title-meta"><span>★ <b>${totalStars(save)}</b> / ${levels.length * 3}</span><span>Voyage ${resume + 1} of ${levels.length}</span><span>v${esc(globalThis.BOATIFY_VERSION || 'dev')}</span></div>
        </div>
      </section>`);
      click(node, '[data-act=play]', () => (save.seenIntro ? ui.briefing(resume, save) : ui.howto(save, true, resume)));
      click(node, '[data-act=voyages]', () => ui.voyages(save, true));
      click(node, '[data-act=howto]', () => ui.howto(save));
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
      const node = el(`<section class="screen dim" aria-label="Voyages">
        <div class="sheet">
          <div class="sheet-head"><h2>Voyages</h2><span class="eyebrow">★ ${totalStars(save)} / ${levels.length * 3}</span><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body"><div class="voyage-grid">${cards}</div></div>
        </div></section>`);
      click(node, '.voyage', (e, b) => {
        const i = Number(b.dataset.i);
        if (!isUnlocked(save, levels, i)) {
          ui.toast('Finish the previous voyage to unlock this one.');
          return;
        }
        ui.briefing(i, save);
      });
      click(node, '[data-act=back]', () => ui.back());
      show('voyages', node, { push });
    },

    briefing(index, save, replace = false) {
      const def = levels[index];
      const rec = save.levels[def.id];
      const chips = hazardsOf(def)
        .map(([name, bad]) => `<span class="chip ${bad ? 'danger' : ''}">${name}</span>`)
        .join('');
      const pearls = (def.pickups || []).filter((p) => p.kind === 'pearl').length;
      const node = el(`<section class="screen dim" aria-label="Voyage briefing">
        <div class="sheet">
          <div class="sheet-head"><span class="eyebrow">Voyage ${index + 1}</span><h2>${esc(def.name)}</h2></div>
          <div class="sheet-body"><div class="brief">
            <p class="lead">${esc(def.blurb)}</p>
            <div>
              <div class="eyebrow">Conditions</div>
              <dl class="facts">
                <dt>Wind</dt><dd>${windSentence(def)}</dd>
                <dt>Goal</dt><dd>Reach the ${def.finish.kind === 'lighthouse' ? 'lighthouse' : 'harbor'} at <b style="color:var(--signal)">B</b></dd>
                <dt>Pearls</dt><dd>${pearls}</dd>
              </dl>
              <div class="chips">${chips}</div>
            </div>
            <div>
              <div class="eyebrow">Times</div>
              <dl class="facts">
                <dt style="color:var(--brass)">★★★</dt><dd>under ${formatTime(def.par.gold)}</dd>
                <dt>★★</dt><dd>under ${formatTime(def.par.silver)}</dd>
                <dt>Best</dt><dd>${rec && rec.best !== null ? `${formatTime(rec.best)} <span style="color:var(--brass)">${'★'.repeat(rec.stars)}</span>` : '—'}</dd>
              </dl>
            </div>
          </div></div>
          <div class="sheet-foot"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="go" data-autofocus>Set sail</button></div>
        </div></section>`);
      click(node, '[data-act=back]', () => ui.back());
      click(node, '[data-act=go]', () => handlers.onPlay(index));
      lastBriefing = index;
      show('briefing', node, { push: !replace });
    },

    pause(game, save) {
      const node = el(`<section class="screen dim" aria-label="Paused">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>Paused</h2><span class="eyebrow">${esc(game.level.name)}</span></div>
          <div class="sheet-body">
            <div class="stat-rows">
              <span class="k">Time</span><span class="v">${formatTime(game.time)}</span>
              <span class="k">Pearls</span><span class="v">${game.pearls} / ${game.pearlsTotal}</span>
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
      const def = levels[index];
      const hasNext = index + 1 < levels.length;
      const rec = save.levels[def.id];
      const node = el(`<section class="screen dim" aria-label="Voyage complete">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>${def.finish.kind === 'lighthouse' ? 'Lighthouse reached' : 'Harbor reached'}</h2></div>
          <div class="sheet-body">
            <div class="result-stars">${stars(0)}</div>
            <div class="stat-rows">
              <span class="k">Time</span><span class="v">${formatTime(result.time)}${improved.time && !improved.first ? '<span class="badge">NEW BEST</span>' : ''}</span>
              <span class="k">Best</span><span class="v">${formatTime(rec.best)}</span>
              <span class="k">Pearls</span><span class="v">${result.pearls} / ${result.pearlsTotal}${result.pearls === result.pearlsTotal && result.pearlsTotal ? '<span class="badge">ALL</span>' : ''}</span>
              <span class="k">Hull</span><span class="v">${Math.ceil(result.hull)}%</span>
              <span class="k">Capsizes</span><span class="v">${result.capsizes}</span>
              <span class="k">Next star</span><span class="v">${result.stars >= 3 ? 'Got them all' : `under ${formatTime(result.stars === 2 ? def.par.gold : def.par.silver)}`}</span>
            </div>
          </div>
          <div class="sheet-foot">
            <button class="btn small" data-act="voyages">Voyages</button>
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
    },

    settings(save) {
      const s = save.settings;
      const toggle = (key, label, sub, invert = false) => `<div class="setting">
        <span class="label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
        <button class="toggle" role="switch" data-key="${key}" data-invert="${invert}" aria-checked="${invert ? !s[key] : s[key]}" aria-label="${label}"></button></div>`;
      const node = el(`<section class="screen dim" aria-label="Settings">
        <div class="sheet narrow">
          <div class="sheet-head"><h2>Settings</h2><button class="btn small" data-act="back">Back</button></div>
          <div class="sheet-body">
            ${toggle('sound', 'Sound effects', '')}
            ${toggle('music', 'Music', 'A quiet sea shanty-ish tune')}
            ${toggle('vibration', 'Vibration', 'Bumps, capsizes and pickups')}
            ${toggle('autoTrim', 'Trim the sail by hand', 'For experienced sailors: W / S or the right-hand slider', true)}
            ${toggle('leftHanded', 'Left-handed controls', 'Steer on the right, gust button on the left')}
            <div class="setting"><span class="label"><b>Steering</b><small>How hard a small thumb movement turns</small></span>
              <div class="seg" data-key="steerSensitivity">
                <button data-v="0.75" aria-pressed="${s.steerSensitivity === 0.75}">Gentle</button>
                <button data-v="1" aria-pressed="${s.steerSensitivity === 1}">Normal</button>
                <button data-v="1.35" aria-pressed="${s.steerSensitivity === 1.35}">Sharp</button>
              </div></div>
            <div class="setting"><span class="label"><b>Graphics</b><small>Lower is easier on older phones</small></span>
              <div class="seg" data-key="quality">
                <button data-v="low" aria-pressed="${s.quality === 'low'}">Low</button>
                <button data-v="high" aria-pressed="${s.quality === 'high'}">High</button>
              </div></div>
            <div class="setting"><span class="label"><b>Reset progress</b><small>Clears times, stars and the logbook</small></span>
              <button class="btn small" data-act="reset">Reset</button></div>
          </div>
        </div></section>`);
      click(node, '.toggle', (e, b) => {
        const key = b.dataset.key;
        const invert = b.dataset.invert === 'true';
        s[key] = !s[key];
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
        if (thenPlay) ui.briefing(playIndex, save, true);
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

    toast(text, kind = '', ms = 3200) {
      // The same message again just stays up longer.
      for (const t of toasts.children) {
        if (t.textContent === text && !t.classList.contains('out')) {
          clearTimeout(t._timer);
          t._timer = setTimeout(() => dismiss(t), ms);
          return;
        }
      }
      const node = el(`<div class="toast ${kind}"></div>`);
      node.textContent = text;
      toasts.appendChild(node);
      const live = [...toasts.children].filter((t) => !t.classList.contains('out'));
      if (live.length > 2) dismiss(live[0]);
      node._timer = setTimeout(() => dismiss(node), ms);
    },

    clearToasts() {
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
