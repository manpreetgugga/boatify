// Festival weeks: Halloween, Diwali, Christmas and New Year. For the week
// around each one the daily voyage is the festival's own, the sea is dressed
// for it (on the title screen too), and finishing that voyage puts the
// festival's sail in the Sail Locker for good. The sail can't be had any
// other way, so a missed week waits for next year.
//
// Weeks run on the phone's own calendar. Diwali moves with the moon, so its
// days are listed; the others fall on the same date every year.

// Lakshmi Puja, the main day of Diwali.
const DIWALI = {
  2026: [11, 8],
  2027: [10, 29],
  2028: [10, 17],
  2029: [11, 5],
  2030: [10, 26],
  2031: [11, 14],
  2032: [11, 2],
  2033: [10, 22],
  2034: [11, 10],
  2035: [10, 30],
};

export const FESTIVALS = [
  {
    id: 'halloween',
    name: 'Halloween',
    day: () => [10, 31],
    before: 6,
    after: 0,
    sail: 'pumpkin',
    theme: 'ghost',
    weather: { night: true, motes: 0.5 },
    names: ['Pumpkin Passage', 'Hollow Lantern Run', 'Bat Wing Sound', "Will-o'-the-Wisp Reach", 'Hallows Crossing', 'Cobweb Narrows'],
    blurb: 'Halloween night: jack-o’-lanterns bob on a dark sea and bats are out.',
    tip: 'Happy Halloween! Sail it home this week to win the Pumpkin sail.',
  },
  {
    id: 'diwali',
    name: 'Diwali',
    day: (y) => DIWALI[y] || null,
    before: 3,
    after: 3,
    sail: 'rangoli',
    theme: 'home',
    weather: { night: true },
    names: ['Diya Crossing', 'Marigold Sound', 'Rangoli Reach', 'Lamplight Passage', 'Sparkler Roads', 'Festival of Lights'],
    blurb: 'The festival of lights: little lamps float on the water and fireworks fill the sky.',
    tip: 'Happy Diwali! Sail it home this week to win the Rangoli sail.',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    day: () => [12, 25],
    before: 5,
    after: 1,
    sail: 'candy',
    theme: 'aurora',
    weather: { night: true, snow: 0.45, aurora: 0.6 },
    names: ['Snowfall Sound', 'Holly Reach', 'Mistletoe Passage', 'Silent Night Run', 'Evergreen Crossing', 'Candle Narrows'],
    blurb: 'Christmas Eve: snow is falling and every island has a tree lit up.',
    tip: 'Merry Christmas! Sail it home this week to win the Candy Cane sail.',
  },
  {
    id: 'newyear',
    name: 'New Year',
    day: () => [1, 1],
    before: 5,
    after: 1,
    sail: 'firework',
    theme: 'harbor',
    weather: { night: true },
    names: ['Midnight Crossing', 'Countdown Run', 'Auld Lang Syne Sound', 'First Light Passage', 'Resolution Reach', 'Sparkle Roads'],
    blurb: 'New Year: paper lanterns drift out to sea under the fireworks.',
    tip: 'Happy New Year! Sail it home this week to win the Firework sail.',
  },
];

const DAY = 24 * 60 * 60 * 1000;

// Day number (UTC midnight) for a YYYY-MM-DD key or a [y, m, d].
const dayOf = (y, m, d) => Date.UTC(y, m - 1, d) / DAY;
const parse = (key) => key.split('-').map(Number);
const keyOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);

// The festival's own day nearest to `n`: this year's, or next/last year's
// when the week runs over New Year.
function festivalDay(f, n, year) {
  let best = null;
  for (const y of [year - 1, year, year + 1]) {
    const md = f.day(y);
    if (!md) continue;
    const d = dayOf(y, md[0], md[1]);
    if (best === null || Math.abs(d - n) < Math.abs(best - n)) best = d;
  }
  return best;
}

// The festival whose week the day falls in, or null. Where two weeks meet
// (Diwali can come close to Halloween), the one whose own day is nearer
// wins, and Diwali on a tie.
export function festivalOn(key) {
  if (!/^\d{4}-\d\d-\d\d$/.test(key || '')) return null;
  const [y, m, d] = parse(key);
  const n = dayOf(y, m, d);
  let pick = null;
  let gap = Infinity;
  for (const f of FESTIVALS) {
    const day = festivalDay(f, n, y);
    if (day === null || n < day - f.before || n > day + f.after) continue;
    const g = Math.abs(n - day) - (f.id === 'diwali' ? 0.5 : 0);
    if (g < gap) {
      pick = f;
      gap = g;
    }
  }
  return pick;
}

// The first and last day of the festival's next week that hasn't ended yet,
// as YYYY-MM-DD keys, or null if it has no date listed that far ahead.
export function nextWeek(f, key) {
  const [y] = parse(key);
  const n = dayOf(...parse(key));
  for (const year of [y, y + 1, y + 2]) {
    const md = f.day(year);
    if (!md) continue;
    const day = dayOf(year, md[0], md[1]);
    if (day + f.after >= n) return [keyOf(day - f.before), keyOf(day + f.after)];
  }
  return null;
}

export function festivalById(id) {
  return FESTIVALS.find((f) => f.id === id) || null;
}

export function festivalForSail(sailId) {
  return FESTIVALS.find((f) => f.sail === sailId) || null;
}

// Finishing the festival's daily voyage during its week wins its sail, once.
// Returns the festival when the sail is new.
export function awardFestivalSail(save, def, today) {
  const f = def && def.festival ? festivalById(def.festival) : null;
  if (!f || festivalOn(today) !== f || festivalOn(def.daily) !== f) return null;
  const key = `gear:${f.sail}`;
  if (save.wallet.owned.includes(key)) return null;
  save.wallet.owned.push(key);
  return f;
}
