// Boat upgrades: coins buy each boat better sails, a deeper keel and a
// stiffer hull, three steps each. Sails give more drive (speed), the keel
// slides less sideways (pointing, so she makes better ground upwind) and the
// hull stands up to a gust (stability). Each boat keeps her own, and they
// only ever change the player's boat, never the regatta fleet.
//
// What's bought lives in the wallet's `owned` list as
// 'upgrade:<boat>:<part>:<step>', so it travels with the save and backup codes.

import { BOAT_ORDER, BOAT_TYPES } from '../physics/boat.js';

export const PARTS = [
  {
    id: 'sails',
    name: 'Sails',
    stat: 'speed',
    label: 'Speed',
    icon: 'wind',
    text: 'New cloth, cut fuller: more drive from the same wind.',
    step: '+4% drive',
  },
  {
    id: 'keel',
    name: 'Keel',
    stat: 'pointing',
    label: 'Upwind',
    icon: 'anchor',
    text: 'A deeper fin: she slides sideways less and makes ground upwind.',
    step: '12% less leeway',
  },
  {
    id: 'hull',
    name: 'Hull',
    stat: 'stability',
    label: 'Stability',
    icon: 'shield',
    text: 'More ballast down low: she heels less in a gust.',
    step: '10% stiffer',
  },
];

export const UPGRADE_STEPS = 3;
export const UPGRADE_PRICES = [150, 350, 700]; // coins for each step, in order
export const UPGRADE_TOTAL = BOAT_ORDER.length * PARTS.length * UPGRADE_STEPS;

// How much each step changes the boat.
const SAIL_STEP = 0.04;
const KEEL_STEP = 0.12;
const HULL_STEP = 0.1;

const key = (boat, part, step) => `upgrade:${boat}:${part}:${step}`;

export function partById(id) {
  return PARTS.find((p) => p.id === id) || null;
}

// Steps bought, 0 to UPGRADE_STEPS. Steps are bought in order, so the first
// missing one ends the count.
export function upgradeLevel(save, boat, part) {
  let n = 0;
  while (n < UPGRADE_STEPS && save.wallet.owned.includes(key(boat, part, n + 1))) n++;
  return n;
}

// { sails, keel, hull } for a boat.
export function upgradeLevels(save, boat) {
  return Object.fromEntries(PARTS.map((p) => [p.id, upgradeLevel(save, boat, p.id)]));
}

// Steps bought over a boat's three parts, or over every boat.
export function upgradeCount(save, boat) {
  const boats = boat ? [boat] : BOAT_ORDER;
  return boats.reduce((sum, b) => sum + PARTS.reduce((s, p) => s + upgradeLevel(save, b, p.id), 0), 0);
}

// What the next step of a part costs, or null when it's fully upgraded.
export function nextPrice(save, boat, part) {
  const n = upgradeLevel(save, boat, part);
  return n < UPGRADE_STEPS ? UPGRADE_PRICES[n] : null;
}

// Buy a part's next step if the coins cover it. Returns null when it can't be
// bought, else { part, level }.
export function buyUpgrade(save, boat, part) {
  const p = partById(part);
  if (!p || !BOAT_TYPES[boat]) return null;
  const price = nextPrice(save, boat, part);
  if (price === null || save.wallet.coins < price) return null;
  const level = upgradeLevel(save, boat, part) + 1;
  save.wallet.coins -= price;
  save.wallet.owned.push(key(boat, part, level));
  return { part: p, level };
}

// The boat as upgraded: the same type with its numbers changed. With nothing
// bought it's the type itself.
export function withUpgrades(type, levels) {
  const { sails = 0, keel = 0, hull = 0 } = levels || {};
  if (!sails && !keel && !hull) return type;
  const k = 1 + KEEL_STEP * keel;
  return {
    ...type,
    sailPower: type.sailPower * (1 + SAIL_STEP * sails),
    swayDrag: type.swayDrag * k,
    swayDragLinear: type.swayDragLinear * k,
    rightingMoment: type.rightingMoment * (1 + HULL_STEP * hull),
    upgrades: { sails, keel, hull },
  };
}
