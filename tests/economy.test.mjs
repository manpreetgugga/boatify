import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { dist } from '../web/src/core/math.js';
import { loadSave, resetProgress, isBoatUnlocked, selectedBoat } from '../web/src/platform/save.js';
import { isGearUnlocked, SAILS, HULLS } from '../web/src/data/locker.js';
import {
  PAY,
  blankWallet,
  cleanWallet,
  voyagePay,
  seaPay,
  racePay,
  payOut,
  blackPearlWaiting,
  spend,
  canAfford,
  shortOf,
  buyJar,
  jarsAboard,
  useJars,
  tradeBlackPearl,
  buyBoat,
  buyGear,
  JAR_HOLD,
  JAR_PRICE,
  TRADE_COINS,
  BOAT_PRICES,
} from '../web/src/data/economy.js';
import { ads, setAdsProvider, nativeAds, installAds, watchVideo, videosLeft, countVoyage, breakDue, takeBreak, REWARDS, BREAK } from '../web/src/platform/ads.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { isClear } from '../web/src/world/collision.js';
import { holdsBlackPearl } from '../web/src/world/blackpearls.js';
import { openSeaDef, reviveRun, endRun } from '../web/src/world/opensea.js';
import { BOAT_ORDER } from '../web/src/physics/boat.js';

const total = (lines) => lines.reduce((a, l) => a + l.coins, 0);
const rich = (coins = 0, blackPearls = 0) => {
  const save = loadSave();
  save.wallet.coins = coins;
  save.wallet.blackPearls = blackPearls;
  return save;
};

test('a new save starts with an empty purse, and a broken one is mended', () => {
  assert.deepEqual(loadSave().wallet, blankWallet());
  const w = cleanWallet({ coins: '120', blackPearls: -4, jars: 9, owned: ['boat:proa', 7], orders: ['GPA.1'], noAds: true, ads: null, found: [] });
  assert.equal(w.coins, 120);
  assert.equal(w.blackPearls, 0);
  assert.equal(w.jars, JAR_HOLD);
  assert.deepEqual(w.owned, ['boat:proa']);
  assert.deepEqual(w.found, {});
  assert.deepEqual(w.ads, { day: null, seen: {}, since: 0, last: 0 });
  // Nothing was ever sold, so there are no orders or ad-free flags to keep.
  assert.deepEqual(Object.keys(w).sort(), Object.keys(blankWallet()).sort());
  assert.deepEqual(cleanWallet(null), blankWallet());
  const kept = cleanWallet({ ads: { day: '2026-10-29', seen: { black_pearl: 2 }, since: 2, last: 1700 } });
  assert.deepEqual(kept.ads, { day: '2026-10-29', seen: { black_pearl: 2 }, since: 2, last: 1700 });
});

test('diamonds saved before 0.22 come back as black pearls', () => {
  const w = cleanWallet({ coins: 40, diamonds: 7, found: { 'whirlpool-strait': 1 } });
  assert.equal(w.blackPearls, 7);
  assert.equal(w.diamonds, undefined);
  assert.deepEqual(w.found, { 'whirlpool-strait': 1 });
  assert.equal(cleanWallet({ blackPearls: 3, diamonds: 9 }).blackPearls, 3);
});

test('a voyage pays for finishing, stars, pearls, rescues and medals', () => {
  const def = LEVELS[1];
  const result = { stars: 2, pearls: 3, rescued: [{ name: 'Tomas' }] };
  const first = voyagePay(def, result, { first: true, prevStars: 0, medals: ['cast-off'] });
  const labels = first.map((l) => l.label);
  assert.deepEqual(labels, ['Voyage', '2 ★', 'New stars', 'Pearls', 'Rescued', 'First time home', 'Medal']);
  assert.equal(total(first), PAY.finish + 2 * PAY.star + 2 * PAY.newStar + 3 * PAY.pearl + PAY.rescue + PAY.first + PAY.medal);
  // Sailing it again for the same stars pays only the run itself.
  const again = voyagePay(def, { stars: 2, pearls: 0, rescued: [] }, { first: false, prevStars: 2 });
  assert.equal(total(again), PAY.finish + 2 * PAY.star);
  // One better: one new star.
  const better = voyagePay(def, { stars: 3, pearls: 0, rescued: [] }, { first: false, prevStars: 2 });
  assert.ok(better.some((l) => l.label === 'New star' && l.coins === PAY.newStar));
});

test('the daily voyage pays once a day, more for a streak', () => {
  const def = { ...LEVELS[0], daily: '2026-10-29' };
  const lines = voyagePay(def, { stars: 1, pearls: 0, rescued: [] }, { first: true, prevStars: 0 }, 4);
  assert.ok(lines.some((l) => l.label === 'Daily voyage' && l.coins === PAY.daily));
  assert.ok(lines.some((l) => l.label === '4-day streak' && l.coins === 4 * PAY.streak));
  assert.ok(!lines.some((l) => l.label === 'First time home'));
  const week = voyagePay(def, { stars: 1, pearls: 0, rescued: [] }, { first: true, prevStars: 0 }, 30);
  assert.ok(week.some((l) => l.coins === 7 * PAY.streak));
  const twice = voyagePay(def, { stars: 1, pearls: 0, rescued: [] }, { first: false, prevStars: 1 }, 4);
  assert.ok(!twice.some((l) => l.label === 'Daily voyage'));
});

test('the open sea pays by distance and gates, a regatta by place', () => {
  const sea = seaPay({ distance: 2450, gates: 3, pearls: 2 }, {});
  assert.equal(total(sea), 24 + 3 * PAY.gate + 2 * PAY.pearl);
  assert.equal(total(racePay({ place: 1, bumps: 0 }, {})), PAY.place[0] + PAY.clean);
  assert.equal(total(racePay({ place: 4, bumps: 2 }, {})), PAY.place[3]);
  assert.equal(total(racePay({ place: 9, bumps: 2 }, {})), PAY.place[3]);
  assert.ok(seaPay({ distance: 40, gates: 0, pearls: 0 }, {}).every((l) => l.coins > 0));
});

test("a voyage's black pearl is paid once; the open sea's every time", () => {
  const save = rich();
  assert.ok(blackPearlWaiting(save, 'whirlpool-strait'));
  const a = payOut(save, [{ label: 'Voyage', coins: 10 }], { blackPearls: 1, voyage: 'whirlpool-strait' });
  assert.deepEqual([a.coins, a.blackPearls], [10, 1]);
  assert.ok(!blackPearlWaiting(save, 'whirlpool-strait'));
  const b = payOut(save, [{ label: 'Voyage', coins: 10 }], { blackPearls: 1, voyage: 'whirlpool-strait' });
  assert.equal(b.blackPearls, 0);
  payOut(save, [], { blackPearls: 1 });
  payOut(save, [], { blackPearls: 1 });
  assert.equal(save.wallet.blackPearls, 3);
  assert.equal(save.wallet.coins, 20);
  assert.equal(save.wallet.earned, 20);
});

test('spending takes only what the purse covers', () => {
  const save = rich(100, 2);
  assert.ok(!spend(save, { coins: 120 }));
  assert.ok(!spend(save, { blackPearls: 3 }));
  assert.equal(save.wallet.coins, 100);
  assert.ok(canAfford(save, { coins: 100 }));
  assert.deepEqual(shortOf(save, { coins: 160 }), { coins: 60 });
  assert.deepEqual(shortOf(save, { blackPearls: 5 }), { blackPearls: 3 });
  assert.ok(spend(save, { coins: 40 }));
  assert.ok(spend(save, { blackPearls: 2 }));
  assert.deepEqual([save.wallet.coins, save.wallet.blackPearls], [60, 0]);
});

test('gust jars wait in the hold and are only lost once used', () => {
  const save = rich(JAR_PRICE * 5);
  for (let i = 0; i < 5; i++) buyJar(save);
  assert.equal(save.wallet.jars, JAR_HOLD);
  assert.equal(save.wallet.coins, JAR_PRICE * 2);
  const carried = jarsAboard(save);
  assert.equal(carried, JAR_HOLD);
  // One used, one picked up on the way: the pickup goes first.
  assert.equal(useJars(save, carried, 3), 0);
  assert.equal(useJars(save, carried, 1), 2);
  assert.equal(save.wallet.jars, 1);
  // A game takes them aboard.
  const game = createGame(LEVELS[0], { startJars: jarsAboard(save) });
  assert.equal(game.gustJars, 1);
});

test('a black pearl trades for coins', () => {
  const save = rich(0, 1);
  assert.ok(tradeBlackPearl(save));
  assert.ok(!tradeBlackPearl(save));
  assert.deepEqual([save.wallet.coins, save.wallet.blackPearls], [TRADE_COINS, 0]);
});

test('black pearls unlock a boat before the stars do, and a reset keeps it', () => {
  for (const id of BOAT_ORDER.slice(1)) assert.ok(BOAT_PRICES[id] > 0, id);
  const save = rich(0, BOAT_PRICES.proa);
  assert.ok(!isBoatUnlocked(save, 'proa'));
  assert.ok(!buyBoat(save, 'galleon'));
  assert.ok(buyBoat(save, 'proa'));
  assert.ok(!buyBoat(save, 'proa'), 'not twice');
  assert.ok(isBoatUnlocked(save, 'proa'));
  save.settings.boat = 'proa';
  assert.equal(selectedBoat(save), 'proa');
  resetProgress(save);
  assert.ok(isBoatUnlocked(save, 'proa'));
});

test('sails and paints for sale are bought with coins', () => {
  const forSale = [...SAILS, ...HULLS].filter((g) => g.price);
  assert.ok(forSale.length >= 6);
  for (const g of forSale) assert.ok(!g.medal, g.id);
  const item = forSale[0];
  const save = rich(item.price - 1);
  assert.ok(!isGearUnlocked(save, item));
  assert.ok(!buyGear(save, item));
  save.wallet.coins += 1;
  assert.ok(buyGear(save, item));
  assert.ok(isGearUnlocked(save, item));
  assert.equal(save.wallet.coins, 0);
});

test('with no ads in the app, no video or ad ever plays', async () => {
  setAdsProvider(null);
  assert.equal(installAds({}).id, 'none');
  assert.ok(!ads().adsReady());
  assert.ok(!ads().breakReady());
  const save = rich();
  assert.equal((await takeBreak(save)).reason, 'unavailable');
  assert.equal((await watchVideo(save, REWARDS.blackPearl, '2026-10-29')).ok, false);
  assert.equal(save.wallet.blackPearls, 0);
});

test('a rewarded video pays only when watched, a few times a day', async () => {
  let watched = true;
  setAdsProvider({ adsReady: () => true, rewarded: async () => (watched ? { ok: true } : { ok: false, reason: 'cancelled' }) });
  const save = rich();
  const day = '2026-10-29';
  for (let i = 0; i < REWARDS.blackPearl.perDay; i++) assert.ok((await watchVideo(save, REWARDS.blackPearl, day)).ok);
  assert.equal(videosLeft(save, REWARDS.blackPearl, day), 0);
  assert.equal((await watchVideo(save, REWARDS.blackPearl, day)).reason, 'limit');
  assert.equal(save.wallet.blackPearls, REWARDS.blackPearl.perDay);
  // A new day, and the other placement has its own count.
  assert.equal(videosLeft(save, REWARDS.blackPearl, '2026-10-30'), REWARDS.blackPearl.perDay);
  watched = false;
  assert.equal((await watchVideo(save, REWARDS.blackPearl, '2026-10-30')).ok, false);
  assert.equal(videosLeft(save, REWARDS.blackPearl, '2026-10-30'), REWARDS.blackPearl.perDay);
  setAdsProvider(null);
});

test("the native bridge's replies come back to the right call", async () => {
  const host = {};
  const calls = [];
  let ready = false;
  const bridge = {
    adsReady: () => {
      throw new Error('no ads sdk');
    },
    breakReady: () => ready,
    request(id, method, arg) {
      calls.push([method, arg]);
      setTimeout(() => host.BoatifyAdsReply(String(id), JSON.stringify(method === 'rewarded' ? { ok: false, reason: 'cancelled' } : { ok: true })), 1);
    },
  };
  assert.equal(installAds({ BoatifyAds: bridge }).id, 'native');
  setAdsProvider(nativeAds(bridge, host));
  assert.ok(!ads().adsReady());
  const save = rich();
  save.wallet.ads.since = BREAK.every;
  // Not loaded: the game doesn't ask for it.
  assert.equal((await takeBreak(save, 1)).ok, false);
  assert.deepEqual(calls, []);
  ready = true;
  assert.ok(ads().breakReady());
  assert.deepEqual(await takeBreak(save, 1), { ok: true });
  assert.deepEqual(await ads().rewarded(REWARDS.secondWind.id), { ok: false, reason: 'cancelled' });
  assert.deepEqual(calls, [
    ['interstitial', BREAK.id],
    ['rewarded', REWARDS.secondWind.id],
  ]);
  host.BoatifyAdsReply('77', '{}'); // a stray reply is ignored
  setAdsProvider(null);
});

test('ad privacy options open only through a bridge that says they are needed', async () => {
  assert.equal(ads().privacyRequired(), false);
  assert.deepEqual(await ads().privacyOptions(), { ok: false, reason: 'unavailable' });
  const host = {};
  const calls = [];
  let required = false;
  const bridge = {
    privacyRequired: () => required,
    request(id, method, arg) {
      calls.push([method, arg]);
      setTimeout(() => host.BoatifyAdsReply(id, '{"ok":true}'), 1);
    },
  };
  setAdsProvider(nativeAds(bridge, host));
  assert.equal(ads().privacyRequired(), false);
  required = true;
  assert.equal(ads().privacyRequired(), true);
  assert.deepEqual(await ads().privacyOptions(), { ok: true });
  assert.deepEqual(calls, [['privacy', '']]);
  // An older shell without the flag never asks.
  setAdsProvider(nativeAds({ request() {} }, host));
  assert.equal(ads().privacyRequired(), false);
  setAdsProvider(null);
});

test('the ad between voyages waits until the player is hooked, then comes every few voyages', () => {
  const save = rich();
  const t = 10 * 60 * 1000;
  // Home Waters plays free of them, however many times it is sailed.
  for (let home = 1; home <= BREAK.hooked; home++) {
    countVoyage(save, home);
    countVoyage(save, home);
    assert.equal(breakDue(save, home, t), false);
  }
  for (let i = 1; i < BREAK.every; i++) {
    countVoyage(save, BREAK.hooked + 1);
    assert.equal(breakDue(save, BREAK.hooked + 1, t), false);
  }
  countVoyage(save, BREAK.hooked + 1);
  assert.equal(save.wallet.ads.since, BREAK.every);
  assert.equal(breakDue(save, BREAK.hooked + 1, t), true);
  // Never close behind another ad, a video for black pearls included...
  save.wallet.ads.last = t - BREAK.gap + 1000;
  assert.equal(breakDue(save, BREAK.hooked + 1, t), false);
  save.wallet.ads.last = t - BREAK.gap;
  assert.equal(breakDue(save, BREAK.hooked + 1, t), true);
  // ...though a clock set back doesn't hold it off for good.
  save.wallet.ads.last = t + 60 * 60 * 1000;
  assert.equal(breakDue(save, BREAK.hooked + 1, t), true);
});

test('a played ad starts the count again; one that never showed is tried next time', async () => {
  let shows = false;
  const asked = [];
  setAdsProvider({
    breakReady: () => true,
    interstitial: async (id) => {
      asked.push(id);
      return shows ? { ok: true } : { ok: false, reason: 'no-fill' };
    },
  });
  const save = rich();
  save.wallet.ads.since = BREAK.every;
  assert.deepEqual(await takeBreak(save, 5000), { ok: false, reason: 'no-fill' });
  assert.equal(save.wallet.ads.since, BREAK.every);
  assert.equal(save.wallet.ads.last, 0);
  shows = true;
  assert.deepEqual(await takeBreak(save, 5000), { ok: true });
  assert.deepEqual(asked, [BREAK.id, BREAK.id]);
  assert.equal(save.wallet.ads.since, 0);
  assert.equal(save.wallet.ads.last, 5000);
  setAdsProvider({ breakReady: () => false, interstitial: async () => assert.fail('asked while not ready') });
  assert.equal((await takeBreak(save)).reason, 'unavailable');
  setAdsProvider(null);
});

test('a rewarded video counts as an ad for the gap between ads', async () => {
  setAdsProvider({ adsReady: () => true, rewarded: async () => ({ ok: true }) });
  const save = rich();
  save.wallet.ads.since = BREAK.every;
  await watchVideo(save, REWARDS.blackPearl, '2026-10-29', 90_000);
  assert.equal(save.wallet.ads.last, 90_000);
  assert.equal(breakDue(save, BREAK.hooked + 1, 90_000 + 60_000), false);
  assert.equal(breakDue(save, BREAK.hooked + 1, 90_000 + BREAK.gap), true);
  setAdsProvider(null);
});

test('every voyage with a whirlpool, kraken or pirate hides a black pearl in clear water near it', () => {
  const withLairs = LEVELS.filter(holdsBlackPearl);
  assert.ok(withLairs.length >= 3);
  for (const def of LEVELS) {
    const game = createGame(def, { blackPearl: true });
    const gems = game.level.pickups.filter((p) => p.kind === 'blackPearl');
    assert.equal(gems.length, holdsBlackPearl(def) ? 1 : 0, def.id);
    if (!gems.length) continue;
    const d = gems[0];
    assert.ok(isClear(game.level, d.x, d.y, 15), def.id);
    const lairs = [...game.level.whirlpools, ...game.level.krakens, ...(def.pirates || []).map((p) => ({ ...p, r: 300 }))];
    assert.ok(lairs.some((l) => dist(l.x, l.y, d.x, d.y) <= l.r), `${def.id}: black pearl far from danger`);
    // Always the same place, and none when it has been found.
    const again = createGame(def, { blackPearl: true }).level.pickups.find((p) => p.kind === 'blackPearl');
    assert.deepEqual([again.x, again.y], [d.x, d.y]);
    assert.ok(!createGame(def).level.pickups.some((p) => p.kind === 'blackPearl'));
  }
});

test('picking up a black pearl counts it in the result', () => {
  const def = LEVELS.find(holdsBlackPearl);
  const game = createGame(def, { blackPearl: true });
  const gem = game.level.pickups.find((p) => p.kind === 'blackPearl');
  Object.assign(game.boat, { x: gem.x, y: gem.y, vx: 0, vy: 0 });
  stepGame(game, { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false }, 1 / 60);
  assert.equal(game.blackPearls, 1);
  assert.ok(drainEvents(game).some((e) => e.type === 'pickup' && e.kind === 'blackPearl'));
});

test('a second wind puts an Open Sea run back on the water', () => {
  const game = createGame(openSeaDef(11), { blackPearl: true });
  game.hull = 20;
  game.sea.clock = 0;
  endRun(game, 'time');
  assert.equal(game.status, 'finished');
  drainEvents(game);
  reviveRun(game, 30);
  assert.equal(game.status, 'sailing');
  assert.equal(game.result, null);
  assert.equal(game.sea.clock, 30);
  assert.equal(game.hull, 60);
  assert.equal(game.sea.revived, 1);
  assert.ok(drainEvents(game).some((e) => e.type === 'revive'));
  for (let i = 0; i < 120; i++) stepGame(game, { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false }, 1 / 60);
  assert.equal(game.status, 'sailing');
  assert.ok(game.sea.clock < 30);
});

test('the open sea hides at most one black pearl a run, by a whirlpool', () => {
  let found = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const game = createGame(openSeaDef(seed), { blackPearl: true });
    const idle = { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false };
    // Chart a long way ahead by carrying the boat east.
    for (let i = 0; i < 60; i++) {
      game.boat.x += 120;
      game.sea.clock = 60;
      stepGame(game, idle, 1 / 30);
    }
    const gems = game.level.pickups.filter((p) => p.kind === 'blackPearl');
    assert.ok(gems.length <= 1, `seed ${seed}`);
    for (const g of gems) assert.ok(game.level.whirlpools.some((w) => dist(w.x, w.y, g.x, g.y) <= w.r), `seed ${seed}`);
    found += gems.length;
    const none = createGame(openSeaDef(seed));
    for (let i = 0; i < 60; i++) {
      none.boat.x += 120;
      none.sea.clock = 60;
      stepGame(none, idle, 1 / 30);
    }
    assert.ok(!none.level.pickups.some((p) => p.kind === 'blackPearl'));
  }
  assert.ok(found > 0, 'some runs should have one');
});
