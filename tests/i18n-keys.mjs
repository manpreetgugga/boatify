// Every piece of English the game shows, for the language tests: the literal
// text passed to t() or marked N_() in the code, and the names, blurbs, tips
// and lines kept in the game's data, which are put through t() when shown.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as atlas from '../web/src/data/atlas.js';
import * as daily from '../web/src/data/daily.js';
import * as festivals from '../web/src/data/festivals.js';
import * as harbor from '../web/src/data/harbor.js';
import * as levels from '../web/src/data/levels.js';
import * as locker from '../web/src/data/locker.js';
import * as medals from '../web/src/data/medals.js';
import * as orders from '../web/src/data/orders.js';
import * as reminders from '../web/src/data/reminders.js';
import * as rumors from '../web/src/data/rumors.js';
import * as upgrades from '../web/src/data/upgrades.js';
import * as worlds from '../web/src/data/worlds.js';
import * as regatta from '../web/src/world/regatta.js';
import * as opensea from '../web/src/world/opensea.js';
import * as prologue from '../web/src/world/prologue.js';
import * as castaways from '../web/src/world/castaways.js';
import * as boat from '../web/src/physics/boat.js';
import { beaufort } from '../web/src/physics/sailing.js';
import { compassPoint } from '../web/src/core/math.js';

const SRC = new URL('../web/src/', import.meta.url).pathname;

// Fields of the data that are shown to the player.
const SHOWN = new Set(['name', 'blurb', 'text', 'note', 'notes', 'line', 'lines', 'teaser', 'riddle', 'unit', 'title', 'tag', 'step', 'tip', 'tips', 'caption', 'legs', 'home', 'label', 'names']);
// Lists of plain text kept in the data.
const LISTS = ['FIRST', 'SECOND', 'SAYINGS'];

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'i18n' ? [] : files(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

// The literal text in t('...') and N_('...') calls.
export function codeKeys() {
  const keys = new Map();
  const call = /\b(?:t|N_)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
  for (const f of files(SRC)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(call)) {
      const raw = m[1] ?? m[2] ?? m[3];
      // The code's own escapes, read the way JavaScript reads them.
      const s = m[3] !== undefined ? raw.replace(/\\`/g, '`') : JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`);
      if (/[A-Za-z]/.test(s) && !keys.has(s)) keys.set(s, f.slice(SRC.length));
    }
  }
  return keys;
}

function walk(v, key, out, from) {
  if (typeof v === 'string') {
    if (SHOWN.has(key) && /[A-Za-z]/.test(v)) out.set(v, out.get(v) || from);
  } else if (Array.isArray(v)) {
    for (const x of v) walk(x, key, out, from);
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) walk(x, k, out, from);
  }
}

// The data's text.
export function dataKeys() {
  const keys = new Map();
  const mods = { atlas, daily, festivals, harbor, levels, locker, medals, orders, reminders, rumors, upgrades, worlds, regatta, opensea, prologue, castaways, boat };
  for (const [name, mod] of Object.entries(mods)) {
    for (const [exp, v] of Object.entries(mod)) {
      if (typeof v === 'function') continue;
      if (LISTS.includes(exp)) walk(v, 'text', keys, `${name}.${exp}`);
      else if (exp === 'THEMES') walk(Object.values(v), 'text', keys, `${name}.${exp}`);
      else walk(v, exp === 'REGATTA_BLURB' || exp === 'SEA_BLURB' ? 'blurb' : '', keys, `${name}.${exp}`);
    }
  }
  for (let kn = 0; kn < 90; kn++) keys.set(beaufort(kn).name, 'sailing.beaufort');
  for (let b = 0; b < 360; b += 22.5) keys.set(compassPoint(b), 'math.compassPoint');
  return keys;
}

export function allKeys() {
  const keys = dataKeys();
  for (const [k, from] of codeKeys()) if (!keys.has(k)) keys.set(k, from);
  return keys;
}

// The {names} a string fills in.
export const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
