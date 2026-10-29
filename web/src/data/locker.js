// The Sail Locker: sail designs and hull paints. They change how a boat
// looks, never how it sails. Every medal unlocks one, so the goals beyond the
// stars have something to show for them out on the water, and a few more are
// bought with coins (`price`).
//
// A sail's `marks` are drawn over the cloth in sail coordinates: `u` runs
// along the foot from the mast (0) to the clew (1) and `h` up the luff from
// the foot (0) to the head (1). Sizes are in foot lengths.
//   band:  [h0, h1]          a stripe across the sail
//   panel: [u0, u1]          a strip from the foot up to the leech
//   line:  [h, amp, waves]   a wavy line across, `sharp` for a zigzag
//   disc / skull / star: [u, h, r]
//   dots:  [[u, h], ...] with radius `r`
//   grid:  n                 chart lines n to a side

import { MEDALS, isEarned } from './medals.js';

export const SAILS = [
  { id: 'stock', name: 'Stock canvas' },
  { id: 'harbor', name: 'Harbor Stripe', medal: 'cast-off', cloth: '#f5f0e4', shade: '#d9d2c2', marks: [{ band: [0.14, 0.26], color: '#d6452f' }] },
  {
    id: 'sunrise',
    name: 'Sunrise',
    medal: 'gold-wind',
    cloth: '#ffd27a',
    shade: '#e2b35d',
    marks: [
      { band: [-0.1, 0.22], color: '#f47c3c' },
      { disc: [0.26, 0.42, 0.17], color: '#fff2c2' },
    ],
  },
  {
    id: 'pearl',
    name: 'Mother of Pearl',
    medal: 'pearl-diver',
    cloth: '#f4e6ee',
    shade: '#dccad4',
    marks: [
      { band: [-0.1, 0.1], color: '#e3b3c6' },
      { dots: [[0.2, 0.3], [0.45, 0.22], [0.3, 0.55], [0.12, 0.72], [0.62, 0.15]], r: 0.06, color: '#ffffff' },
    ],
  },
  { id: 'petrel', name: 'Storm Petrel', medal: 'storm-rider', cloth: '#5f6d7a', shade: '#4b5762', marks: [{ line: [0.36, 0.09, 3], sharp: true, width: 0.09, color: '#ffd23f' }] },
  {
    id: 'kraken',
    name: 'Kraken Ink',
    medal: 'kraken-dodger',
    cloth: '#4d2c66',
    shade: '#3b2150',
    marks: [
      { line: [0.24, 0.05, 2], width: 0.1, color: '#2fb5a4' },
      { dots: [[0.18, 0.46], [0.36, 0.42], [0.12, 0.64]], r: 0.05, color: '#e9a6c9' },
    ],
  },
  {
    id: 'floe',
    name: 'Ice Floe',
    medal: 'ice-pilot',
    cloth: '#e8f5fb',
    shade: '#c9dfe9',
    marks: [
      { panel: [0.18, 0.3], color: '#a6d4ea' },
      { panel: [0.48, 0.6], color: '#a6d4ea' },
    ],
  },
  {
    id: 'dolphin',
    name: 'Dolphin',
    medal: 'bow-rider',
    cloth: '#5aa8d6',
    shade: '#4789b1',
    marks: [
      { band: [-0.1, 0.08], color: '#f5f0e4' },
      { line: [0.3, 0.06, 1.5], width: 0.08, color: '#f5f0e4' },
    ],
  },
  { id: 'jolly', name: 'Jolly Roger', medal: 'clean-getaway', cloth: '#1f1f24', shade: '#151518', marks: [{ skull: [0.27, 0.36, 0.16] }] },
  {
    id: 'chart',
    name: "Navigator's Chart",
    medal: 'navigator',
    cloth: '#efe2c0',
    shade: '#d6c7a3',
    marks: [
      { grid: 5, color: 'rgba(110, 80, 40, 0.45)' },
      { star: [0.28, 0.34, 0.14], color: '#b23a2a' },
    ],
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    medal: 'treasure-hunter',
    cloth: '#f5f0e4',
    shade: '#d9d2c2',
    marks: ['#e5484d', '#f28c28', '#f5c518', '#3ddc97', '#3b8fe0', '#8b5cf6'].map((color, i) => ({ panel: [i / 6, (i + 1) / 6], color })),
  },
  {
    id: 'admiral',
    name: "Admiral's Blue",
    medal: 'admiral',
    cloth: '#22406f',
    shade: '#1a3256',
    marks: [
      { band: [0.1, 0.17], color: '#e2b44d' },
      { star: [0.26, 0.46, 0.14], color: '#e2b44d' },
    ],
  },
  {
    id: 'compass',
    name: 'Compass Rose',
    medal: 'far-horizon',
    cloth: '#f2ead6',
    shade: '#d8cfb8',
    marks: [
      { band: [-0.1, 0.06], color: '#2a5d8f' },
      { star: [0.27, 0.4, 0.17], color: '#2a5d8f' },
      { disc: [0.27, 0.4, 0.04], color: '#c8423a' },
    ],
  },
  {
    id: 'regatta',
    name: 'Regatta Stripes',
    medal: 'line-honours',
    cloth: '#f5f0e4',
    shade: '#d8d2c4',
    marks: [
      { band: [0.08, 0.15], color: '#c8423a' },
      { band: [0.19, 0.23], color: '#22406f' },
      { disc: [0.3, 0.5, 0.13], color: '#22406f' },
      { disc: [0.3, 0.5, 0.07], color: '#f5f0e4' },
    ],
  },
  {
    id: 'lifebuoy',
    name: 'Lifebuoy',
    medal: 'lifeline',
    cloth: '#f5f0e4',
    shade: '#d9d2c2',
    marks: [
      { panel: [0, 0.25], color: '#e0503a' },
      { panel: [0.5, 0.75], color: '#e0503a' },
      { band: [0.5, 0.58], color: '#f2b33d' },
    ],
  },
  {
    id: 'lava',
    name: 'Lava Flow',
    medal: 'world-volcano',
    cloth: '#2b2422',
    shade: '#1f1918',
    marks: [
      { line: [0.22, 0.07, 2.5], sharp: true, width: 0.1, color: '#ff6a2a' },
      { line: [0.5, 0.05, 2], width: 0.06, color: '#ffb347' },
    ],
  },
  {
    id: 'nebula',
    name: 'Nebula',
    medal: 'world-alien',
    cloth: '#2c1f52',
    shade: '#221840',
    marks: [
      { band: [-0.1, 0.12], color: '#7b4fd6' },
      { disc: [0.3, 0.42, 0.1], color: '#4ee6c4' },
      { dots: [[0.18, 0.3], [0.44, 0.22], [0.26, 0.6], [0.12, 0.74], [0.56, 0.14]], r: 0.035, color: '#e8fff7' },
    ],
  },
  // Bought with coins in the locker.
  {
    id: 'royal',
    name: 'Royal Purple',
    price: 400,
    cloth: '#5b2a86',
    shade: '#47206a',
    marks: [
      { band: [0.06, 0.12], color: '#e2b44d' },
      { band: [0.15, 0.17], color: '#e2b44d' },
      { star: [0.27, 0.44, 0.13], color: '#e2b44d' },
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    price: 600,
    cloth: '#f6c46a',
    shade: '#dca650',
    marks: [
      { band: [-0.1, 0.2], color: '#7a3a8c' },
      { band: [0.2, 0.36], color: '#c8435a' },
      { band: [0.36, 0.52], color: '#ef7a3c' },
      { disc: [0.3, 0.7, 0.12], color: '#fff3c4' },
    ],
  },
  {
    id: 'diamond-dust',
    name: 'Diamond Dust',
    price: 1000,
    cloth: '#e3f6fc',
    shade: '#c2e2ee',
    marks: [
      { band: [-0.1, 0.08], color: '#7fd8f0' },
      { dots: [[0.16, 0.3], [0.38, 0.24], [0.24, 0.5], [0.1, 0.66], [0.52, 0.14], [0.3, 0.72]], r: 0.045, color: '#ffffff' },
      { dots: [[0.28, 0.36], [0.14, 0.48], [0.44, 0.34]], r: 0.03, color: '#7fd8f0' },
    ],
  },
];

export const HULLS = [
  { id: 'stock', name: 'Stock paint' },
  { id: 'coral', name: 'Coral', medal: 'not-a-scratch', hull: '#e0674f', hullDark: '#9c3c2b', trim: '#f5f0e4' },
  { id: 'whitewash', name: 'Whitewash', medal: 'pure-wind', hull: '#eceee8', hullDark: '#8d989c', trim: '#2f7fb8' },
  { id: 'racing', name: 'Racing Green', medal: 'personal-best', hull: '#1f5b43', hullDark: '#123526', trim: '#e2b44d' },
  { id: 'midnight', name: 'Midnight', medal: 'whale-watcher', hull: '#1c2a4a', hullDark: '#0d1526', trim: '#e2b44d' },
  { id: 'driftwood', name: 'Driftwood', medal: 'beachcomber', hull: '#9c9488', hullDark: '#5f5a52', deck: '#cdbf9f' },
  { id: 'teak', name: 'Teak and Brass', medal: 'shipwright', hull: '#7a4a2a', hullDark: '#4a2a15', deck: '#c99a62', trim: '#d9a441' },
  { id: 'gilded', name: 'Gilded', medal: 'fleet-captain', hull: '#d9a441', hullDark: '#8f6820', trim: '#fff1c4' },
  { id: 'sunset', name: 'Sunset', medal: 'day-sailor', hull: '#f08a3c', hullDark: '#a85a20', trim: '#ffe1a8' },
  { id: 'seafoam', name: 'Seafoam', medal: 'week-at-sea', hull: '#7fc8b8', hullDark: '#3f8a7b', trim: '#f5f0e4' },
  { id: 'copper', name: 'Copper Bottom', medal: 'long-haul', hull: '#b06a3b', hullDark: '#6e3c1c', trim: '#58b39a' },
  { id: 'rescue', name: 'Rescue Orange', medal: 'no-one-left-behind', hull: '#f26a21', hullDark: '#a8430f', trim: '#f5f0e4' },
  { id: 'pilot', name: 'Harbor Pilot', medal: 'world-harbor', hull: '#e8b21e', hullDark: '#9a7310', trim: '#1f2a33' },
  // Bought with coins in the locker.
  { id: 'ocean', name: 'Ocean Blue', price: 300, hull: '#2f6fb0', hullDark: '#1c4370', trim: '#f5f0e4' },
  { id: 'cherry', name: 'Cherry Red', price: 300, hull: '#b8282f', hullDark: '#6e161b', trim: '#f2d27a' },
  { id: 'ebony', name: 'Ebony and Gold', price: 800, hull: '#24222a', hullDark: '#0c0b0f', deck: '#6a5642', trim: '#e2b44d' },
];

const LISTS = { sail: SAILS, hull: HULLS };
const KIND_NAME = { sail: 'sail', hull: 'hull paint' };

export function lockerItem(kind, id) {
  return LISTS[kind].find((g) => g.id === id) || LISTS[kind][0];
}

export function medalFor(item) {
  return MEDALS.find((m) => m.id === item.medal) || null;
}

export function isGearUnlocked(save, item) {
  if (item.price) return !!(save.wallet && save.wallet.owned.includes(`gear:${item.id}`));
  return !item.medal || isEarned(save, item.medal);
}

// The fitted sail and hull paint, or stock if a choice is no longer
// unlocked (say, after a progress reset).
export function fittedGear(save) {
  const pick = (kind) => {
    const item = lockerItem(kind, save.settings[kind]);
    return isGearUnlocked(save, item) ? item.id : 'stock';
  };
  return { sail: pick('sail'), hull: pick('hull') };
}

export function gearCount(save) {
  return [...SAILS, ...HULLS].filter((g) => g.medal && isGearUnlocked(save, g)).length;
}

// Medal rewards only: the bought paints don't count toward the set.
export const GEAR_TOTAL = [...SAILS, ...HULLS].filter((g) => g.medal).length;

// What a medal puts in the locker, for the medals screen and results card.
export function rewardFor(medalId) {
  for (const kind of ['sail', 'hull']) {
    const item = LISTS[kind].find((g) => g.medal === medalId);
    if (item) return { kind, item, label: `${item.name} ${KIND_NAME[kind]}` };
  }
  return null;
}

// A boat type's look with the chosen sail and hull paint on it.
const looks = new Map();
export function boatLook(type, gear = {}) {
  const sail = lockerItem('sail', gear.sail);
  const hull = lockerItem('hull', gear.hull);
  const key = `${type.id}/${sail.id}/${hull.id}`;
  let look = looks.get(key);
  if (!look) {
    look = { ...type.look };
    if (sail.cloth) Object.assign(look, { sail: sail.cloth, sailShade: sail.shade, marks: sail.marks });
    if (hull.hull) Object.assign(look, { hull: hull.hull, hullDark: hull.hullDark, deck: hull.deck || look.deck, trim: hull.trim || null });
    looks.set(key, look);
  }
  return look;
}
