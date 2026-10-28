// Progress and settings in localStorage. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the
// game keeps working from memory.

import { BOAT_TYPES, BOAT_ORDER } from '../physics/boat.js';
import { dateKey } from '../data/daily.js';

const KEY = 'boatify.save.v1';
const GHOST_KEY = 'boatify.ghosts.v1';
const DAILY_KEY = 'boatify.daily.v1';
const DAILY_KEEP = 30; // days of daily results to remember

// Campaign voyages to finish before the daily voyage opens.
export const DAILY_UNLOCK = 3;

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  autoTrim: true,
  leftHanded: false,
  steerSensitivity: 1,
  quality: 'high',
  ghost: true,
  boat: 'sloop',
  colorblind: false,
  reduceMotion: null, // null: follow the phone's own setting
  textSize: 1,
};

function blank() {
  return {
    levels: {},
    daily: {},
    streak: { count: 0, best: 0, last: null },
    settings: { ...DEFAULT_SETTINGS },
    notes: [],
    stats: { voyages: 0, distance: 0, capsizes: 0, pearls: 0 },
    medals: {}, // medal id -> day it was earned
    medalsSeen: 0, // how many medals the Medals screen last showed
    sailed: [], // boats that have finished a voyage
    seenIntro: false,
  };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function loadSave() {
  let data = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  const base = blank();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    stats: { ...base.stats, ...(data.stats || {}) },
    streak: { ...base.streak, ...(isObj(data.streak) ? data.streak : {}) },
    levels: isObj(data.levels) ? data.levels : {},
    daily: isObj(data.daily) ? data.daily : {},
    notes: Array.isArray(data.notes) ? data.notes : [],
    medals: isObj(data.medals) ? data.medals : {},
    medalsSeen: Number(data.medalsSeen) || 0,
    sailed: Array.isArray(data.sailed) ? data.sailed : [],
  };
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

// Merge a finished voyage into the save. Returns what improved. Daily voyages
// go in their own bucket so they don't count toward the campaign's stars.
export function recordResult(save, levelId, result, notes = [], bucket = 'levels') {
  const records = save[bucket];
  const prev = records[levelId] || { best: null, stars: 0, pearls: 0, runs: 0 };
  const improved = {
    time: prev.best === null || result.time < prev.best,
    stars: result.stars > prev.stars,
    pearls: result.pearls > prev.pearls,
    first: prev.best === null,
    prevBest: prev.best,
  };
  records[levelId] = {
    best: improved.time ? result.time : prev.best,
    stars: Math.max(prev.stars, result.stars),
    pearls: Math.max(prev.pearls, result.pearls),
    pearlsTotal: result.pearlsTotal,
    runs: (prev.runs || 0) + 1,
  };
  if (bucket === 'daily') {
    const keys = Object.keys(records).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - DAILY_KEEP))) delete records[k];
  }
  for (const n of notes) if (n && !save.notes.includes(n)) save.notes.push(n);
  if (result.boat && !save.sailed.includes(result.boat)) save.sailed.push(result.boat);
  save.stats.voyages += 1;
  save.stats.distance += result.distance || 0;
  save.stats.capsizes += result.capsizes || 0;
  writeSave(save);
  return improved;
}

export function isUnlocked(save, levels, index) {
  if (index === 0) return true;
  // A voyage you've already finished stays open, even if one is added before it.
  const own = levels[index] && save.levels[levels[index].id];
  if (own && own.best !== null) return true;
  const prev = levels[index - 1];
  return !!(prev && save.levels[prev.id] && save.levels[prev.id].best !== null);
}

export function isDailyUnlocked(save, levels) {
  return levels.slice(0, DAILY_UNLOCK).every((l) => save.levels[l.id] && save.levels[l.id].best !== null);
}

function dayBefore(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// Count a finished daily voyage toward the run of consecutive days.
export function markDaily(save, key) {
  const s = save.streak;
  if (s.last === key) return s;
  s.count = s.last === dayBefore(key) ? s.count + 1 : 1;
  s.best = Math.max(s.best, s.count);
  s.last = key;
  return s;
}

// Days in a row up to today; still alive until today's voyage is missed.
export function currentStreak(save, today) {
  const s = save.streak;
  return s.last === today || s.last === dayBefore(today) ? s.count : 0;
}

// Boats in the Shipyard unlock with campaign stars.
export function isBoatUnlocked(save, id) {
  const type = BOAT_TYPES[id];
  return !!type && totalStars(save) >= type.unlock;
}

export function unlockedBoats(save) {
  return BOAT_ORDER.filter((id) => isBoatUnlocked(save, id));
}

// The chosen boat, or the sloop if that choice is no longer unlocked (say,
// after a progress reset).
export function selectedBoat(save) {
  return isBoatUnlocked(save, save.settings.boat) ? save.settings.boat : 'sloop';
}

export function totalStars(save) {
  return Object.values(save.levels).reduce((a, l) => a + (l.stars || 0), 0);
}

export function resetProgress(save) {
  const settings = save.settings;
  const fresh = blank();
  Object.assign(save, fresh, { settings });
  writeSave(save);
  clearGhosts();
}

// Best-run ghosts live under their own key so the main save stays small.
// The in-memory copy keeps them for the session when storage is blocked.
let ghosts = null;

function readGhosts() {
  if (ghosts) return ghosts;
  try {
    const raw = window.localStorage.getItem(GHOST_KEY);
    const data = raw ? JSON.parse(raw) : null;
    ghosts = data && typeof data === 'object' ? data : {};
  } catch {
    ghosts = {};
  }
  return ghosts;
}

export function loadGhost(levelId) {
  return readGhosts()[levelId] || null;
}

export function storeGhost(levelId, ghost) {
  const all = readGhosts();
  // Only today's daily ghost is worth keeping.
  if (levelId.startsWith('daily-')) for (const k of Object.keys(all)) if (k.startsWith('daily-')) delete all[k];
  all[levelId] = ghost;
  try {
    window.localStorage.setItem(GHOST_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function clearGhosts() {
  ghosts = {};
  try {
    window.localStorage.removeItem(GHOST_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

// Today's generated course, so reopening the game doesn't chart it again.
let dailyCourse;

export function loadDailyCourse() {
  if (dailyCourse !== undefined) return dailyCourse;
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    dailyCourse = raw ? JSON.parse(raw) : null;
  } catch {
    dailyCourse = null;
  }
  return dailyCourse;
}

export function storeDailyCourse(record) {
  dailyCourse = record;
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(record));
  } catch {
    // Charting again next time is fine.
  }
}
