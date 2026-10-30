// Spreading the word: what a Share button says, the link it carries, and when
// the game may ask for a rating on Google Play.

import { formatTime } from '../core/math.js';
import { formatDistance } from '../physics/sailing.js';
import { t, N_, ordinal } from '../i18n/index.js';

export const PLAY_LINK = 'https://play.google.com/store/apps/details?id=io.github.manpreetgugga.boatify';

const PITCH = N_('No Paddle, a sailing game where only the wind can carry you home.');

// The text for a Share button. kind: 'game' (Settings), 'voyage', 'sea' or 'race'.
export function shareText(kind, info = {}) {
  const pitch = t(PITCH);
  let brag = '';
  if (kind === 'voyage') {
    const vars = { name: info.name, time: formatTime(info.time), n: info.stars, pitch };
    if (info.stars === 1) brag = t('I sailed {name} in {time} with 1 star in {pitch} Can you beat it?', vars);
    else if (info.stars) brag = t('I sailed {name} in {time} with {n} stars in {pitch} Can you beat it?', vars);
    else brag = t('I sailed {name} in {time} in {pitch} Can you beat it?', vars);
  } else if (kind === 'sea') {
    brag = t('I sailed {distance} east on the Open Sea in {pitch} How far can you get?', { distance: formatDistance(info.distance), pitch });
  } else if (kind === 'race') {
    brag = info.place === 1 ? t('I won a regatta in {pitch} Race me!', { pitch }) : t('I came {place} in a regatta in {pitch} Race me!', { place: ordinal(info.place), pitch });
  } else {
    brag = t('Try {pitch}', { pitch });
  }
  return `${brag} ${PLAY_LINK}`;
}

// Google Play's own "Rate this game" box: only after a three-star finish,
// once the player has sailed a few voyages home, a month apart at the least,
// and three times at most. Play itself may still decide not to show it.
export const REVIEW = { after: 6, gap: 30 * 24 * 60 * 60 * 1000, most: 3 };

export function reviewDue(save, { stars, finished }, now = Date.now()) {
  const r = save.review;
  if (stars < 3 || finished < REVIEW.after || r.asked >= REVIEW.most) return false;
  return !r.last || now - r.last >= REVIEW.gap;
}

export function markReview(save, now = Date.now()) {
  save.review.asked += 1;
  save.review.last = now;
}
