// The game's languages. Text is written in English in the code and the data,
// and t() looks it up in the chosen language's table, keyed by the English.
// Anything a table lacks stays in English. {name} in a string is filled from
// the values passed with it.

import { HI } from './hi.js';
import { ES } from './es.js';
import { PT } from './pt.js';
import { ID } from './id.js';

export const LANGS = [
  { id: 'en', name: 'English' },
  { id: 'hi', name: 'हिन्दी' },
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
  { id: 'id', name: 'Bahasa Indonesia' },
];

export const TABLES = { hi: HI, es: ES, pt: PT, id: ID };

let lang = 'en';
let table = null;

// The first of the phone's languages the game speaks, else English.
export function detectLang(list) {
  const prefs = list || (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  for (const p of prefs) {
    const code = String(p || '').toLowerCase().split(/[-_]/)[0];
    // Old Android reports Indonesian as "in".
    const id = code === 'in' ? 'id' : code;
    if (LANGS.some((l) => l.id === id)) return id;
  }
  return 'en';
}

// 'auto' follows the phone; anything unknown is English.
export function setLang(choice) {
  lang = choice === 'auto' || !choice ? detectLang() : LANGS.some((l) => l.id === choice) ? choice : 'en';
  table = TABLES[lang] || null;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

export const currentLang = () => lang;

export function t(s, vars) {
  let out = (table && table[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

// 1st, 2nd... in the language's own way.
export function ordinal(n) {
  if (lang === 'es') return `${n}.º`;
  if (lang === 'pt') return `${n}º`;
  if (lang === 'id') return `ke-${n}`;
  if (lang === 'hi') return `#${n}`;
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
}

// A date as "Wed 28 Oct" in the game's language.
export function shortDate(date) {
  try {
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : lang, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return date.toDateString().slice(0, 10);
  }
}

// Marks English text kept in a table for t() to look up later.
export const N_ = (s) => s;

// A voyage's name and blurb. The daily voyage's are put together from parts.
export const nameOf = (def) => (def.nameParts ? t('{first} {second}', { first: t(def.nameParts[0]), second: t(def.nameParts[1]) }) : t(def.name));
export const blurbOf = (def) => (def.blurbParts ? def.blurbParts.map((p) => t(p)).join(' ') : t(def.blurb));
