// Harbor talk: one line on the title screen about something you haven't
// found yet. A voyage still to sail, a secret medal, a boat on the slipway,
// someone still adrift. Once there's nothing left to find, old sailors' sayings.

import { BOAT_ORDER, BOAT_TYPES } from '../physics/boat.js';
import { isUnlocked, isDailyUnlocked, isBoatUnlocked, totalStars } from '../platform/save.js';
import { MEDALS, isSealed } from './medals.js';

export const SAYINGS = [
  'The wind never blows the same way twice.',
  'Dark ruffled water means wind. Glassy water means none.',
  "An old sailor swears the gulls know where the gusts are. He won't say how.",
  'Ease the sail before the gust, not after it.',
  'Nobody ever sailed straight into the wind. Nobody.',
];

export function rumors(save, levels) {
  const out = [];
  levels.forEach((l, i) => {
    const sailed = save.levels[l.id] && save.levels[l.id].best !== null;
    if (!sailed) out.push(`${l.name}: ${l.teaser}`);
    // Someone is still out there, once you know the waters.
    if (isUnlocked(save, levels, i)) {
      for (const c of l.castaways || []) {
        if (!save.crew.some((k) => k.name === c.name)) out.push(`${c.name} was seen adrift in ${l.name}, waving.`);
      }
    }
  });
  for (const m of MEDALS) if (isSealed(m, save, levels)) out.push(`A secret medal: “${m.riddle}”`);
  const stars = totalStars(save);
  for (const id of BOAT_ORDER) {
    const t = BOAT_TYPES[id];
    if (!isBoatUnlocked(save, id)) out.push(`The shipwright is building a ${t.name}. It's yours at ★ ${t.unlock}, and you have ${stars}.`);
  }
  if (!isDailyUnlocked(save, levels)) out.push('Sailors say a new sea is charted every sunrise, for those who know the way.');
  else {
    if (!save.openSea.runs) out.push("No one has found the end of the Open Sea. Maybe there isn't one.");
    if (!save.regatta.races) out.push('Petrel, Marlin and Squall are looking for a fourth boat to race.');
  }
  return out.length ? out : SAYINGS.slice();
}

export function pickRumor(save, levels, rand = Math.random) {
  const list = rumors(save, levels);
  return list[Math.floor(rand() * list.length) % list.length];
}
