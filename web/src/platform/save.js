// Progress and settings in localStorage. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the
// game keeps working from memory.

import { BOAT_TYPES, BOAT_ORDER } from '../physics/boat.js';
import { dateKey } from '../data/daily.js';
import { blankWallet, cleanWallet } from '../data/economy.js';
import { cleanOrders } from '../data/orders.js';

const KEY = 'boatify.save.v1';
const GHOST_KEY = 'boatify.ghosts.v1';
const DAILY_KEY = 'boatify.daily.v1';
const DAILY_KEEP = 30; // days of daily results to remember

// How close the camera sits, from the zoom button or Settings.
export const ZOOMS = [
  [0.8, 'Far'],
  [1, 'Normal'],
  [1.25, 'Close'],
  [1.55, 'Closer'],
];

// The next zoom step in (dir 1) or out (dir -1); tapping the button (dir 0)
// goes in and wraps round from the closest to the farthest.
export function nextZoom(zoom, dir = 0) {
  const i = Math.max(0, ZOOMS.findIndex(([z]) => z === zoom));
  if (dir) return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))][0];
  return ZOOMS[(i + 1) % ZOOMS.length][0];
}

// The step closest to a pinched zoom, judged by ratio.
export function nearestZoom(zoom) {
  let best = ZOOMS[0][0];
  for (const [z] of ZOOMS) if (Math.abs(Math.log(z / zoom)) < Math.abs(Math.log(best / zoom))) best = z;
  return best;
}

export function zoomName(zoom) {
  const z = ZOOMS.find(([v]) => v === zoom);
  return z ? z[1] : 'Normal';
}

// Campaign voyages to finish before the daily voyage opens.
export const DAILY_UNLOCK = 3;

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  autoTrim: true,
  leftHanded: false,
  steerSensitivity: 1,
  zoom: 1, // camera: one of ZOOMS
  quality: 'high',
  ghost: true,
  hints: true, // dolphins show the way when you're stuck or lost
  boat: 'sloop',
  sail: 'stock', // Sail Locker choices
  hull: 'stock',
  colorblind: false,
  reduceMotion: null, // null: follow the phone's own setting
  textSize: 1,
  reminders: true, // reminders on the phone at 9 am, 6 pm and 9 pm (Android)
};

function blank() {
  return {
    levels: {},
    daily: {},
    openSea: { best: 0, gates: 0, runs: 0 }, // best distance east, most gates in a run
    regatta: { races: 0, wins: 0, podiums: 0, best: null }, // best: fastest winning time
    streak: { count: 0, best: 0, last: null },
    settings: { ...DEFAULT_SETTINGS },
    notes: [],
    stats: { voyages: 0, distance: 0, capsizes: 0, pearls: 0, rescued: 0 },
    crew: [], // castaways brought home: { name, line }, once each
    medals: {}, // medal id -> day it was earned
    medalsSeen: 0, // how many medals the Medals screen last showed
    gearSeen: 0, // how many Sail Locker items the locker last showed
    sailed: [], // boats that have finished a voyage
    sightings: {}, // sea life the player has had the first-meeting tip for
    wallet: blankWallet(), // coins, black pearls and what they bought
    orders: null, // today's orders from the harbourmaster (data/orders.js)
    seenIntro: false,
    seenFilm: false, // the prologue has played through or been skipped
    remindersAsked: false, // the phone has been asked to allow reminders
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
    openSea: { ...base.openSea, ...(isObj(data.openSea) ? data.openSea : {}) },
    regatta: { ...base.regatta, ...(isObj(data.regatta) ? data.regatta : {}) },
    levels: isObj(data.levels) ? data.levels : {},
    daily: isObj(data.daily) ? data.daily : {},
    notes: Array.isArray(data.notes) ? data.notes : [],
    crew: Array.isArray(data.crew) ? data.crew : [],
    medals: isObj(data.medals) ? data.medals : {},
    medalsSeen: Number(data.medalsSeen) || 0,
    gearSeen: Number(data.gearSeen) || 0,
    sailed: Array.isArray(data.sailed) ? data.sailed : [],
    sightings: isObj(data.sightings) ? data.sightings : {},
    wallet: cleanWallet(data.wallet),
    orders: cleanOrders(data.orders),
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
  const rescued = result.rescued || [];
  const improved = {
    time: prev.best === null || result.time < prev.best,
    stars: result.stars > prev.stars,
    pearls: result.pearls > prev.pearls,
    first: prev.best === null,
    prevBest: prev.best,
    prevStars: prev.stars,
    // Someone not met before, now safe ashore.
    crew: rescued.filter((c) => !save.crew.some((k) => k.name === c.name)).map((c) => c.name),
  };
  records[levelId] = {
    best: improved.time ? result.time : prev.best,
    stars: Math.max(prev.stars, result.stars),
    pearls: Math.max(prev.pearls, result.pearls),
    pearlsTotal: result.pearlsTotal,
    rescued: Math.max(prev.rescued || 0, rescued.length),
    castaways: result.castaways || 0,
    runs: (prev.runs || 0) + 1,
  };
  for (const c of rescued) if (!save.crew.some((k) => k.name === c.name)) save.crew.push({ name: c.name, line: c.line });
  save.stats.rescued += rescued.length;
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

// Merge an Open Sea run into the save. Returns what improved.
export function recordSeaRun(save, result) {
  const prev = save.openSea;
  const improved = {
    best: result.distance > prev.best,
    prevDistance: prev.runs ? prev.best : null,
    gates: result.gates > prev.gates,
    first: !prev.runs,
  };
  save.openSea = {
    best: Math.max(prev.best, result.distance),
    gates: Math.max(prev.gates, result.gates),
    runs: prev.runs + 1,
  };
  save.stats.voyages += 1;
  save.stats.distance += result.sailed || 0;
  save.stats.capsizes += result.capsizes || 0;
  writeSave(save);
  return improved;
}

// Merge a regatta into the save. Returns what improved.
export function recordRace(save, result) {
  const prev = save.regatta;
  const won = result.place === 1;
  const improved = {
    won,
    firstWin: won && !prev.wins,
    time: won && (prev.best === null || result.time < prev.best),
    prevWin: prev.best, // not prevBest: every course is new, so Personal Best can't apply
    first: !prev.races,
  };
  save.regatta = {
    races: prev.races + 1,
    wins: prev.wins + (won ? 1 : 0),
    podiums: prev.podiums + (result.place <= 3 ? 1 : 0),
    best: improved.time ? result.time : prev.best,
  };
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

// Boats in the Shipyard unlock with campaign stars, or early with black pearls.
export function isBoatUnlocked(save, id) {
  const type = BOAT_TYPES[id];
  return !!type && (totalStars(save) >= type.unlock || !!(save.wallet && save.wallet.owned.includes(`boat:${id}`)));
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

// The wallet stays: what was bought (and the black pearls already found) isn't
// progress to start over. Today's orders stay too, so they never pay twice.
export function resetProgress(save) {
  const { settings, wallet, orders } = save;
  const fresh = blank();
  Object.assign(save, fresh, { settings, wallet, orders });
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

// About 12 KB each; this many is plenty and keeps clear of the storage limit.
const GHOST_CAP = 40;

export function loadGhost(levelId) {
  return readGhosts()[levelId] || null;
}

export function storeGhost(levelId, ghost) {
  const all = readGhosts();
  // Only today's daily ghost is worth keeping.
  if (levelId.startsWith('daily-')) for (const k of Object.keys(all)) if (k.startsWith('daily-')) delete all[k];
  // The newest go last, and the oldest make room once there are many.
  delete all[levelId];
  all[levelId] = ghost;
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - GHOST_CAP))) delete all[k];
  for (let tries = 0; tries < 3; tries++) {
    try {
      window.localStorage.setItem(GHOST_KEY, JSON.stringify(all));
      return true;
    } catch {
      // Storage is full: drop the older half and try again.
      const rest = Object.keys(all).filter((k) => k !== levelId);
      if (!rest.length) return false;
      for (const k of rest.slice(0, Math.ceil(rest.length / 2))) delete all[k];
    }
  }
  return false;
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
