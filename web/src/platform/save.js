// Progress and settings in localStorage. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the
// game keeps working from memory.

const KEY = 'boatify.save.v1';

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  autoTrim: true,
  leftHanded: false,
  steerSensitivity: 1,
  quality: 'high',
};

function blank() {
  return { levels: {}, settings: { ...DEFAULT_SETTINGS }, notes: [], stats: { voyages: 0, distance: 0, capsizes: 0, pearls: 0 }, seenIntro: false };
}

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
    levels: data.levels && typeof data.levels === 'object' ? data.levels : {},
    notes: Array.isArray(data.notes) ? data.notes : [],
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

// Merge a finished voyage into the save. Returns what improved.
export function recordResult(save, levelId, result, notes = []) {
  const prev = save.levels[levelId] || { best: null, stars: 0, pearls: 0, runs: 0 };
  const improved = {
    time: prev.best === null || result.time < prev.best,
    stars: result.stars > prev.stars,
    pearls: result.pearls > prev.pearls,
    first: prev.best === null,
  };
  save.levels[levelId] = {
    best: improved.time ? result.time : prev.best,
    stars: Math.max(prev.stars, result.stars),
    pearls: Math.max(prev.pearls, result.pearls),
    pearlsTotal: result.pearlsTotal,
    runs: (prev.runs || 0) + 1,
  };
  for (const n of notes) if (n && !save.notes.includes(n)) save.notes.push(n);
  save.stats.voyages += 1;
  save.stats.distance += result.distance || 0;
  save.stats.capsizes += result.capsizes || 0;
  writeSave(save);
  return improved;
}

export function isUnlocked(save, levels, index) {
  if (index === 0) return true;
  const prev = levels[index - 1];
  return !!(prev && save.levels[prev.id] && save.levels[prev.id].best !== null);
}

export function totalStars(save) {
  return Object.values(save.levels).reduce((a, l) => a + (l.stars || 0), 0);
}

export function resetProgress(save) {
  const settings = save.settings;
  const fresh = blank();
  Object.assign(save, fresh, { settings });
  writeSave(save);
}
