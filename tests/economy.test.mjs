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
import { commerce, setCommerceProvider, nativeProvider, installCommerce, creditOrder, buyPack, restoreOrders, watchVideo, videosLeft, PACKS, REWARDS } from '../web/src/platform/commerce.js';
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
  const w = cleanWallet({ coins: '120', blackPearls: -4, jars: 9, owned: ['boat:proa', 7], orders: 'x', ads: null, found: [] });
  assert.equal(w.coins, 120);
  assert.equal(w.blackPearls, 0);
  assert.equal(w.jars, JAR_HOLD);
  assert.deepEqual(w.owned, ['boat:proa']);
  assert.deepEqual(w.orders, []);
  assert.deepEqual(w.found, {});
  assert.deepEqual(w.ads, { day: null, seen: {} });
  assert.deepEqual(cleanWallet(null), blankWallet());
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

test('with no store in the app, nothing is for sale', async () => {
  setCommerceProvider(null);
  assert.equal(installCommerce({}).id, 'none');
  assert.ok(!commerce().storeReady());
  assert.ok(!commerce().adsReady());
  const save = rich();
  assert.equal((await buyPack(save, PACKS[0].id)).ok, false);
  assert.equal((await watchVideo(save, REWARDS.blackPearl, '2026-10-29')).ok, false);
  assert.equal(save.wallet.blackPearls, 0);
});

test('a paid order is credited once, saved before the store hears it is done', async () => {
  const log = [];
  setCommerceProvider({
    storeReady: () => true,
    purchase: async (id) => ({ ok: true, order: { id: 'GPA.1', product: id } }),
    finish: async (id) => log.push(`finish ${id}`),
    pending: async () => [
      { id: 'GPA.1', product: 'black_pearls_35' },
      { id: 'GPA.2', product: 'black_pearls_90' },
      { id: 'GPA.3', product: 'nonsense' },
    ],
  });
  const save = rich();
  const r = await buyPack(save, 'black_pearls_35', () => log.push('saved'));
  assert.deepEqual(r, { ok: true, blackPearls: 35 });
  assert.deepEqual(log, ['saved', 'finish GPA.1']);
  assert.deepEqual(creditOrder(save, { id: 'GPA.1', product: 'black_pearls_35' }), { ok: true, blackPearls: 0, repeat: true });
  // On the next launch: the pack already credited isn't paid again.
  assert.equal(await restoreOrders(save, () => {}), 90);
  assert.equal(save.wallet.blackPearls, 125);
  assert.equal(creditOrder(save, { product: 'black_pearls_10' }).ok, false);
  setCommerceProvider(null);
});

test('a rewarded video pays only when watched, a few times a day', async () => {
  let watched = true;
  setCommerceProvider({ adsReady: () => true, rewarded: async () => (watched ? { ok: true } : { ok: false, reason: 'cancelled' }) });
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
  setCommerceProvider(null);
});

test("the native bridge's replies come back to the right call", async () => {
  const host = {};
  const calls = [];
  const bridge = {
    storeReady: () => true,
    adsReady: () => {
      throw new Error('no ads sdk');
    },
    request(id, method, arg) {
      calls.push([method, arg]);
      const reply = method === 'prices' ? { ok: true, prices: { black_pearls_10: '$0.99' } } : method === 'purchase' ? { ok: true, order: { id: 'GPA.9', product: arg } } : { ok: true };
      setTimeout(() => host.BoatifyStoreReply(String(id), JSON.stringify(reply)), 1);
    },
  };
  const store = setCommerceProvider(nativeProvider(bridge, host));
  assert.ok(store.storeReady());
  assert.ok(!store.adsReady());
  assert.deepEqual(await store.prices(), { black_pearls_10: '$0.99' });
  const save = rich();
  assert.deepEqual(await buyPack(save, 'black_pearls_10'), { ok: true, blackPearls: 10 });
  assert.deepEqual(calls.map((c) => c[0]), ['prices', 'purchase', 'finish']);
  assert.equal(calls[0][1], PACKS.map((p) => p.id).join(','));
  host.BoatifyStoreReply('77', '{}'); // a stray reply is ignored
  setCommerceProvider(null);
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
