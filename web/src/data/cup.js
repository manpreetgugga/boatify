// The Regatta Cup: four races, one on each course, against the same three
// rivals. Every race scores points by place, and the most points after the
// fourth takes the cup. The fleet is set when the cup starts, so a win on the
// way doesn't move you up mid-cup. Winning a cup puts a trophy on the shelf
// for that fleet, and the first one also wins the Silver Cutter.
//
// The cup under way lives in save.cup.now (null between cups):
// { fleet, race, points: [you, ...rivals], last: [who finished 1st, 2nd...], places }

import { COURSES, FLEETS, RIVALS } from '../world/regatta.js';
import { N_ } from '../i18n/index.js';

export const CUP_COURSES = COURSES.map((c) => c.id);
export const CUP_RACES = CUP_COURSES.length;
export const CUP_POINTS = [10, 6, 4, 2]; // for 1st to 4th in a race
export const CUP_BOAT = 'cutter';
// What the cup pays for where you finish in it.
export const CUP_PRIZES = [
  { coins: 500, blackPearls: 2 },
  { coins: 250, blackPearls: 0 },
  { coins: 120, blackPearls: 0 },
  { coins: 50, blackPearls: 0 },
];
const NAMES = ['You', ...RIVALS.map((r) => r.name)];

export function blankCup() {
  return { now: null, sailed: 0, trophies: Object.fromEntries(FLEETS.map((f) => [f.id, 0])) };
}

const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
const order = (v) => (Array.isArray(v) && v.length === NAMES.length && [...v].sort().every((w, i) => w === i) ? v : null);

// A cup as stored (or read from a backup code), with anything malformed put
// back to no cup.
export function cleanCup(data) {
  const base = blankCup();
  if (!data || typeof data !== 'object') return base;
  const t = data.trophies && typeof data.trophies === 'object' ? data.trophies : {};
  for (const f of FLEETS) base.trophies[f.id] = count(t[f.id]);
  base.sailed = count(data.sailed);
  const n = data.now;
  if (n && typeof n === 'object' && Array.isArray(n.points) && n.points.length === NAMES.length) {
    const race = Math.min(CUP_RACES - 1, count(n.race));
    base.now = {
      fleet: Math.min(FLEETS.length - 1, count(n.fleet)),
      race,
      points: n.points.map(count),
      last: order(n.last) || NAMES.map((_, i) => i),
      places: (Array.isArray(n.places) ? n.places : []).map(count).filter((p) => p >= 1 && p <= NAMES.length).slice(0, race),
    };
  }
  return base;
}

export function startCup(save, fleet) {
  save.cup.now = { fleet, race: 0, points: NAMES.map(() => 0), last: NAMES.map((_, i) => i), places: [] };
  return save.cup.now;
}

// The course of the cup's next race.
export function cupCourse(save) {
  const now = save.cup.now;
  return CUP_COURSES[now ? now.race : 0];
}

// The table, best first: points, then the better place in the last race.
// `gained` is the points each boat just scored, to show beside them.
export function cupTable(now, gained = null) {
  return NAMES.map((name, i) => ({ name, player: i === 0, points: now.points[i], gained: gained ? gained[i] : 0, last: now.last.indexOf(i) })).sort((a, b) => b.points - a.points || a.last - b.last);
}

export function trophyCount(save) {
  return Object.values(save.cup.trophies).reduce((a, b) => a + b, 0);
}

// Score a finished cup race from its standings. Returns what the results
// show: points gained, the table, and when it was the last race, your place
// in the cup, the trophy, the prize and the boat if this cup won her.
export function scoreCupRace(save, result) {
  const now = save.cup.now;
  if (!now) return null;
  const finish = result.standings.map((e) => (e.player ? 0 : NAMES.indexOf(e.name))).filter((w) => w >= 0);
  const gained = NAMES.map(() => 0);
  finish.forEach((who, i) => (gained[who] = CUP_POINTS[i] || 0));
  now.points = now.points.map((p, i) => p + gained[i]);
  if (finish.length === NAMES.length) now.last = finish;
  now.places.push(result.place);
  const out = { race: now.race + 1, of: CUP_RACES, fleet: FLEETS[now.fleet].id, gained: gained[0], table: cupTable(now, gained), places: [...now.places], done: false };
  now.race += 1;
  if (now.race < CUP_RACES) return out;
  out.done = true;
  out.place = out.table.findIndex((e) => e.player) + 1;
  out.prize = CUP_PRIZES[out.place - 1];
  save.cup.sailed += 1;
  save.cup.now = null;
  if (out.place === 1) {
    save.cup.trophies[out.fleet] += 1;
    out.trophy = out.fleet;
    if (!save.wallet.owned.includes(`boat:${CUP_BOAT}`)) {
      save.wallet.owned.push(`boat:${CUP_BOAT}`);
      out.boat = CUP_BOAT;
    }
  }
  return out;
}

// The cup's prize as a pay line, once the last race is in. A video on the
// results doesn't double it.
export function cupPay(cup) {
  return cup && cup.done && cup.prize.coins ? [{ label: N_('Cup prize'), coins: cup.prize.coins }] : [];
}
