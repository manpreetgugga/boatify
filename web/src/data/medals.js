// Medals: goals beyond the stars. Some are won in a single voyage, others
// count up across the whole save. A medal, once earned, is kept for good.

import { BOAT_ORDER } from '../physics/boat.js';
import { toMeters } from '../physics/sailing.js';
import { totalStars, unlockedBoats } from '../platform/save.js';
import { dateKey } from './daily.js';

const LONG_HAUL_KM = 25;
const STREAK_DAYS = 7;
const BEST_BY = 5; // seconds off a best time for Personal Best

const finished = (rec) => !!rec && rec.best !== null && rec.best !== undefined;
const records = (save, levels) => levels.map((l) => save.levels[l.id]);
const count = (list, fn) => list.filter(fn).length;
const has = (list) => (list || []).length > 0;

// Every bottle note in the campaign, so the logbook can be checked for gaps.
function campaignNotes(levels) {
  return levels.flatMap((l) => (l.pickups || []).filter((p) => p.kind === 'bottle').map((p) => p.note));
}

// `run(r)` decides a single voyage, with r = { def, result, improved }.
// `progress(save, levels)` returns [have, need] for medals that add up.
export const MEDALS = [
  {
    id: 'cast-off',
    name: 'Cast Off',
    icon: 'anchor',
    text: 'Finish your first voyage.',
    progress: (save) => [Math.min(1, save.stats.voyages), 1],
  },
  {
    id: 'gold-wind',
    name: 'Gold Wind',
    icon: 'star',
    text: 'Earn all three stars on a voyage.',
    run: ({ result }) => result.stars >= 3,
    progress: (save, levels) => [Math.min(1, count(records(save, levels), (r) => r && r.stars >= 3)), 1],
  },
  {
    id: 'pearl-diver',
    name: 'Pearl Diver',
    icon: 'pearl',
    text: 'Collect every pearl on a voyage.',
    run: ({ result }) => result.pearlsTotal > 0 && result.pearls >= result.pearlsTotal,
    progress: (save, levels) => [Math.min(1, count(records(save, levels), (r) => r && r.pearlsTotal && r.pearls >= r.pearlsTotal)), 1],
  },
  {
    id: 'not-a-scratch',
    name: 'Not a Scratch',
    icon: 'shield',
    text: 'Thread a coral reef without a single dent.',
    run: ({ def, result }) => (def.rocks || []).some((r) => r.material === 'coral') && result.hull >= 100,
  },
  {
    id: 'pure-wind',
    name: 'Pure Wind',
    icon: 'wind',
    text: 'Earn three stars on a voyage with gust jars, and leave them all shut.',
    run: ({ def, result }) => result.stars >= 3 && !result.jars && (def.pickups || []).some((p) => p.kind === 'gust'),
  },
  {
    id: 'personal-best',
    name: 'Personal Best',
    icon: 'clock',
    text: `Beat your best time on a voyage by ${BEST_BY} seconds or more.`,
    run: ({ result, improved }) => improved.prevBest !== null && improved.prevBest !== undefined && improved.prevBest - result.time >= BEST_BY,
  },
  {
    id: 'storm-rider',
    name: 'Storm Rider',
    icon: 'bolt',
    text: 'Sail through the squalls without capsizing.',
    run: ({ def, result }) => has(def.storms) && result.capsizes === 0,
  },
  {
    id: 'kraken-dodger',
    name: 'Kraken Dodger',
    icon: 'tentacle',
    text: 'Get past the kraken without it laying a tentacle on you.',
    run: ({ def, result }) => has(def.krakens) && !(result.hits || {}).kraken,
  },
  {
    id: 'ice-pilot',
    name: 'Ice Pilot',
    icon: 'snow',
    text: 'Cross the drift ice without touching it.',
    run: ({ def, result }) => has(def.floes) && !(result.hits || {}).ice,
  },
  {
    id: 'bow-rider',
    name: 'Bow Rider',
    icon: 'dolphin',
    text: 'Have dolphins ride your bow wave for 10 seconds in one voyage.',
    run: ({ result }) => (result.escort || 0) >= 10,
  },
  {
    id: 'whale-watcher',
    name: 'Whale Watcher',
    icon: 'whale',
    text: 'See a whale breach up close without it landing on you.',
    run: ({ result }) => (result.whales || 0) >= 1 && !(result.hits || {}).whale,
  },
  {
    id: 'clean-getaway',
    name: 'Clean Getaway',
    icon: 'skull',
    text: 'Get away from a pirate chase without taking a single cannonball or ram.',
    run: ({ def, result }) => has(def.pirates) && (result.chases || 0) >= 1 && !(result.hits || {}).cannon && !(result.hits || {}).pirate,
  },
  {
    id: 'navigator',
    name: 'Navigator',
    icon: 'map',
    text: 'Finish every voyage.',
    progress: (save, levels) => [count(records(save, levels), finished), levels.length],
  },
  {
    id: 'treasure-hunter',
    name: 'Treasure Hunter',
    icon: 'gem',
    text: 'Collect every pearl on every voyage.',
    progress: (save, levels) => [count(records(save, levels), (r) => r && r.pearls >= (r.pearlsTotal || 0)), levels.length],
  },
  {
    id: 'admiral',
    name: 'Admiral',
    icon: 'crown',
    text: 'Earn all three stars on every voyage.',
    progress: (save, levels) => [totalStars(save), levels.length * 3],
  },
  {
    id: 'beachcomber',
    name: 'Beachcomber',
    icon: 'bottle',
    text: 'Find every message in a bottle.',
    progress: (save, levels) => {
      const notes = campaignNotes(levels);
      return [count(notes, (n) => save.notes.includes(n)), notes.length];
    },
  },
  {
    id: 'shipwright',
    name: 'Shipwright',
    icon: 'hammer',
    text: 'Unlock every boat in the Shipyard.',
    progress: (save) => [unlockedBoats(save).length, BOAT_ORDER.length],
  },
  {
    id: 'fleet-captain',
    name: 'Fleet Captain',
    icon: 'fleet',
    text: 'Finish a voyage in every boat.',
    progress: (save) => [count(BOAT_ORDER, (id) => save.sailed.includes(id)), BOAT_ORDER.length],
  },
  {
    id: 'day-sailor',
    name: 'Day Sailor',
    icon: 'sun',
    text: 'Finish a daily voyage.',
    progress: (save) => [Math.min(1, Object.keys(save.daily).length), 1],
  },
  {
    id: 'week-at-sea',
    name: 'Week at Sea',
    icon: 'flame',
    text: `Sail the daily voyage ${STREAK_DAYS} days in a row.`,
    progress: (save) => [Math.min(save.streak.best, STREAK_DAYS), STREAK_DAYS],
  },
  {
    id: 'long-haul',
    name: 'Long Haul',
    icon: 'compass',
    text: `Sail ${LONG_HAUL_KM} km in all.`,
    unit: 'km',
    progress: (save) => [Math.min(LONG_HAUL_KM, Math.floor(toMeters(save.stats.distance) / 100) / 10), LONG_HAUL_KM],
  },
];

export function isEarned(save, id) {
  return !!save.medals[id];
}

export function medalsEarned(save) {
  return MEDALS.filter((m) => isEarned(save, m.id)).length;
}

export function medalProgress(medal, save, levels) {
  return medal.progress ? medal.progress(save, levels) : null;
}

// Hand out every medal the save (and the voyage just sailed, if any) has
// earned. Returns the new ones. The caller writes the save.
export function awardMedals(save, levels, run = null) {
  const fresh = [];
  for (const m of MEDALS) {
    if (isEarned(save, m.id)) continue;
    let won = false;
    if (m.run && run) won = m.run(run);
    if (!won && m.progress) {
      const [have, need] = m.progress(save, levels);
      won = have >= need;
    }
    if (won) {
      save.medals[m.id] = dateKey();
      fresh.push(m);
    }
  }
  return fresh;
}
