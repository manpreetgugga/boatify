// Harbor talk: one line on the title screen about something you haven't
// found yet. A voyage still to sail, a secret medal, a boat on the slipway,
// someone still adrift. Once there's nothing left to find, old sailors' sayings.

import { BOAT_ORDER, BOAT_TYPES } from '../physics/boat.js';
import { isUnlocked, isDailyUnlocked, isBoatUnlocked, totalStars } from '../platform/save.js';
import { MEDALS, isSealed } from './medals.js';
import { LEVELS } from './levels.js';
import { getWorld } from './worlds.js';
import { t, N_ } from '../i18n/index.js';

export const SAYINGS = [
  N_('The wind never blows the same way twice.'),
  N_('Dark ruffled water means wind. Glassy water means none.'),
  N_("An old sailor swears the gulls know where the gusts are. He won't say how."),
  N_('Ease the sail before the gust, not after it.'),
  N_('Nobody ever sailed straight into the wind. Nobody.'),
];

// Lines come out in the game's language.

export function rumors(save, levels) {
  const out = [];
  // Word of a far world's voyages waits until you reach it; until then the
  // talk is of the world itself.
  const firstOf = new Map();
  levels.forEach((l, i) => firstOf.has(l.world) || firstOf.set(l.world, i));
  const reached = (l) => !l.world || l.world === 'home' || isUnlocked(save, levels, firstOf.get(l.world));
  const next = levels.find((l) => !reached(l));
  if (next) {
    const w = getWorld(next.world);
    if (w) out.push(`${t('Sailors talk of {world}, past the last lighthouse.', { world: t(w.name) })} ${t(w.blurb)}`);
  }
  levels.forEach((l, i) => {
    if (!reached(l)) return;
    const sailed = save.levels[l.id] && save.levels[l.id].best !== null;
    if (!sailed) out.push(`${t(l.name)}: ${t(l.teaser)}`);
    // Someone is still out there, once you know the waters.
    if (isUnlocked(save, levels, i)) {
      for (const c of l.castaways || []) {
        if (!save.crew.some((k) => k.name === c.name)) out.push(t('{name} was seen adrift in {place}, waving.', { name: t(c.name), place: t(l.name) }));
      }
    }
  });
  for (const m of MEDALS) if (isSealed(m, save, LEVELS)) out.push(`${t('A secret medal:')} “${t(m.riddle)}”`);
  const stars = totalStars(save);
  for (const id of BOAT_ORDER) {
    const bt = BOAT_TYPES[id];
    if (isBoatUnlocked(save, id)) continue;
    if (bt.prize) out.push(t('The shipwright is building a {boat} for whoever first wins the Regatta Cup.', { boat: t(bt.name) }));
    else out.push(t("The shipwright is building a {boat}. It's yours at ★ {n}, and you have {stars}.", { boat: t(bt.name), n: bt.unlock, stars }));
  }
  if (!isDailyUnlocked(save, levels)) out.push(t('Sailors say a new sea is charted every sunrise, for those who know the way.'));
  else {
    if (!save.openSea.runs) out.push(t("No one has found the end of the Open Sea. Maybe there isn't one."));
    if (!save.regatta.races) out.push(t('Petrel, Marlin and Squall are looking for a fourth boat to race.'));
  }
  return out.length ? out : SAYINGS.map((s) => t(s));
}

export function pickRumor(save, levels, rand = Math.random) {
  const list = rumors(save, levels);
  return list[Math.floor(rand() * list.length) % list.length];
}
