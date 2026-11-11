import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave } from '../web/src/platform/save.js';
import { doubleOf, doublePay, payOut } from '../web/src/data/economy.js';
import { setAdsProvider, watchVideo, videosLeft, REWARDS } from '../web/src/platform/ads.js';
import { PLAY_LINK, shareText, REVIEW, reviewDue, markReview, FEEDBACK_EMAIL, feedbackMail } from '../web/src/platform/social.js';
import { readFileSync } from 'node:fs';

const DAY = 24 * 60 * 60 * 1000;

test('a video pays the coins again, once, and shows on the bill', () => {
  const save = loadSave();
  const pay = payOut(save, [
    { label: 'Finish', coins: 40 },
    { label: 'Stars', coins: 30 },
  ]);
  assert.equal(save.wallet.coins, 70);
  assert.equal(doublePay(save, pay), 70);
  assert.equal(save.wallet.coins, 140);
  assert.equal(save.wallet.earned, 140);
  assert.equal(pay.coins, 140);
  assert.ok(pay.doubled);
  assert.deepEqual(pay.lines.at(-1), { label: 'Video', coins: 70 });
  // Not twice, and not for a voyage that paid nothing.
  assert.equal(doubleOf(pay), 0);
  assert.equal(doublePay(save, pay), 0);
  assert.equal(save.wallet.coins, 140);
  assert.equal(doublePay(save, payOut(save, [])), 0);
  assert.equal(doublePay(save, null), 0);
});

test("medals and orders aren't doubled", () => {
  const save = loadSave();
  const pay = payOut(save, [
    { label: 'Voyage', coins: 10 },
    { label: 'Medals', coins: 200 },
    { label: 'Orders', coins: 80 },
  ]);
  assert.equal(doubleOf(pay), 10);
  assert.equal(doublePay(save, pay), 10);
  assert.equal(pay.coins, 300);
  assert.equal(save.wallet.coins, 300);
  assert.equal(doubleOf(payOut(save, [{ label: 'Medal', coins: 50 }])), 0);
});

test('doubling coins is a rewarded video with its own daily limit', async () => {
  const save = loadSave();
  setAdsProvider({ adsReady: () => true, rewarded: async () => ({ ok: true }) });
  try {
    const left = videosLeft(save, REWARDS.doubleCoins, '2026-10-30');
    assert.equal(left, REWARDS.doubleCoins.perDay);
    const r = await watchVideo(save, REWARDS.doubleCoins, '2026-10-30');
    assert.equal(r.ok, true);
    assert.equal(save.wallet.blackPearls, 0);
    assert.equal(videosLeft(save, REWARDS.doubleCoins, '2026-10-30'), left - 1);
    // The other videos keep their own count.
    assert.equal(videosLeft(save, REWARDS.secondWind, '2026-10-30'), REWARDS.secondWind.perDay);
  } finally {
    setAdsProvider(null);
  }
});

test('share texts brag about the result and carry the Play link', () => {
  const voyage = shareText('voyage', { name: 'Harbor Mouth', time: 83.4, stars: 3 });
  assert.match(voyage, /Harbor Mouth/);
  assert.match(voyage, /3 stars/);
  assert.match(voyage, /1:23/);
  assert.match(shareText('voyage', { name: 'X', time: 60, stars: 1 }), /1 star /);
  assert.match(shareText('race', { place: 1 }), /won a regatta/);
  assert.match(shareText('race', { place: 3 }), /came 3rd/);
  assert.match(shareText('sea', { distance: 100 }), / east on the Open Sea/);
  for (const t of [voyage, shareText('game'), shareText('sea', { distance: 5000 }), shareText('race', { place: 2 })]) {
    assert.ok(t.endsWith(PLAY_LINK), t);
    assert.ok(!t.includes('undefined') && !t.includes('NaN'), t);
  }
  assert.match(PLAY_LINK, /id=io\.github\.manpreetgugga\.boatify$/);
});

test('the rating box waits for a few voyages and a three-star finish, a month apart, three times at most', () => {
  const save = loadSave();
  assert.deepEqual(save.review, { asked: 0, last: 0 });
  const now = Date.UTC(2026, 9, 30);
  assert.equal(reviewDue(save, { stars: 3, finished: REVIEW.after - 1 }, now), false);
  assert.equal(reviewDue(save, { stars: 2, finished: 20 }, now), false);
  assert.equal(reviewDue(save, { stars: 3, finished: REVIEW.after }, now), true);
  markReview(save, now);
  assert.equal(reviewDue(save, { stars: 3, finished: 20 }, now + 10 * DAY), false);
  assert.equal(reviewDue(save, { stars: 3, finished: 20 }, now + 31 * DAY), true);
  markReview(save, now + 31 * DAY);
  markReview(save, now + 62 * DAY);
  assert.equal(save.review.asked, REVIEW.most);
  assert.equal(reviewDue(save, { stars: 3, finished: 50 }, now + 400 * DAY), false);
});

test('feedback goes to one address and says which version it came from', () => {
  assert.match(FEEDBACK_EMAIL, /^[^@\s]+@[^@\s]+\.[a-z]+$/);
  const mail = feedbackMail('0.44.0', 'hi');
  assert.equal(mail.subject, 'No Paddle feedback');
  assert.match(mail.body, /^\n+---\nNo Paddle v0\.44\.0 · hi$/, 'room to write first, then the version');
  assert.match(feedbackMail(undefined, 'en').body, /vdev/);
});

test('Back on the title asks before closing, unless turned off', () => {
  assert.equal(loadSave().settings.confirmExit, true);
  const main = readFileSync(new URL('../web/src/main.js', import.meta.url), 'utf8');
  assert.match(main, /!isAndroidApp \|\| !save\.settings\.confirmExit\) return false/);
  assert.match(main, /onOk: \(\) => exitApp\(\)/);
  const kt = readFileSync(new URL('../android/app/src/main/java/io/github/manpreetgugga/boatify/MainActivity.kt', import.meta.url), 'utf8');
  for (const fn of ['fun openStore()', 'fun sendFeedback(', 'market://details?id=']) assert.ok(kt.includes(fn), `the shell has ${fn}`);
});
