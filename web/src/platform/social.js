// Spreading the word: what a Share button says, the link it carries, and when
// the game may ask for a rating on Google Play.

import { formatTime } from '../core/math.js';
import { formatDistance } from '../physics/sailing.js';
import { ordinal } from '../world/regatta.js';

export const PLAY_LINK = 'https://play.google.com/store/apps/details?id=io.github.manpreetgugga.boatify';

const PITCH = 'No Paddle, a sailing game where only the wind can carry you home.';

// The text for a Share button. kind: 'game' (Settings), 'voyage', 'sea' or 'race'.
export function shareText(kind, info = {}) {
  let brag = '';
  if (kind === 'voyage') {
    const stars = info.stars ? ` with ${info.stars} ${info.stars === 1 ? 'star' : 'stars'}` : '';
    brag = `I sailed ${info.name} in ${formatTime(info.time)}${stars} in ${PITCH} Can you beat it?`;
  } else if (kind === 'sea') {
    brag = `I sailed ${formatDistance(info.distance)} east on the Open Sea in ${PITCH} How far can you get?`;
  } else if (kind === 'race') {
    brag = `${info.place === 1 ? 'I won a regatta' : `I came ${ordinal(info.place)} in a regatta`} in ${PITCH} Race me!`;
  } else {
    brag = `Try ${PITCH}`;
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
