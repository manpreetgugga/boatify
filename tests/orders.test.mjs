import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDERS, CHEST, pickOrders, dayOrders, todaysOrders, ordersLeft, tallyOrders, swapOrder, cleanOrders } from '../web/src/data/orders.js';
import { loadSave, writeSave, resetProgress } from '../web/src/platform/save.js';

const DAY = '2026-10-29';
const blankSave = () => ({ orders: null });
// A voyage brought home with nothing special about it.
const plain = (extra = {}) => ({ stars: 1, pearls: 0, collisions: 1, rescued: [], escort: 0, ...extra });
// A save whose orders for the day are these three.
const withPicks = (picks) => {
  const save = blankSave();
  dayOrders(save, DAY).picks = picks;
  return save;
};

test('each day has one order of each kind, the same for everyone', () => {
  for (const day of ['2026-01-01', '2026-06-15', DAY, '2027-02-28']) {
    const picks = pickOrders(day);
    assert.deepEqual(picks, pickOrders(day));
    assert.deepEqual(
      picks.map((id) => ORDERS.find((o) => o.id === id).slot),
      [0, 1, 2],
    );
  }
  // Over a month every order turns up.
  const seen = new Set();
  for (let d = 1; d <= 31; d++) pickOrders(`2026-12-${String(d).padStart(2, '0')}`).forEach((id) => seen.add(id));
  assert.equal(seen.size, ORDERS.length);
});

test('every order has a goal, pay and words for the board', () => {
  const ids = new Set();
  for (const o of ORDERS) {
    assert.ok(!ids.has(o.id), o.id);
    ids.add(o.id);
    assert.ok(o.goal >= 1 && o.pay > 0, o.id);
    assert.ok(o.text && o.note && o.icon, o.id);
  }
});

test('voyages move orders on and pay when one is done', () => {
  const save = withPicks(['voyages', 'gold', 'rescue']);
  let r = tallyOrders(save, DAY, 'voyage', plain());
  assert.deepEqual(r.done, []);
  assert.deepEqual(r.moved.map((o) => [o.id, o.progress]), [['voyages', 1]]);
  assert.equal(r.left, 3);
  assert.equal(r.coins, 0);

  r = tallyOrders(save, DAY, 'voyage', plain({ stars: 3, rescued: [{ name: 'Pip' }] }));
  assert.deepEqual(r.done.map((o) => o.id), ['rescue']);
  assert.equal(r.coins, 100);
  assert.equal(r.left, 2);
  assert.equal(r.blackPearls, 0);

  r = tallyOrders(save, DAY, 'sea', plain({ stars: 3 }));
  assert.deepEqual(r.done.map((o) => o.id), ['voyages']);
  // Three stars on an Open Sea run don't count: it has no stars to win.
  assert.equal(todaysOrders(save, DAY).find((o) => o.id === 'gold').progress, 1);
  assert.equal(ordersLeft(save, DAY), 1);
});

test('all three done opens the chest, once', () => {
  const save = withPicks(['daily', 'clean', 'podium']);
  tallyOrders(save, DAY, 'daily', plain({ collisions: 0 }));
  tallyOrders(save, DAY, 'race', { place: 4, stars: 0 });
  let r = tallyOrders(save, DAY, 'voyage', plain({ collisions: 0 }));
  assert.deepEqual(r.done.map((o) => o.id), ['clean']);
  assert.equal(r.blackPearls, 0);
  r = tallyOrders(save, DAY, 'race', { place: 2, stars: 2 });
  assert.deepEqual(r.done.map((o) => o.id), ['podium']);
  assert.equal(r.blackPearls, CHEST);
  assert.equal(r.left, 0);
  assert.equal(save.orders.chest, true);
  r = tallyOrders(save, DAY, 'race', { place: 1, stars: 3 });
  assert.deepEqual(r, { done: [], moved: [], left: 0, coins: 0, blackPearls: 0 });
});

test('orders count what each one asks for', () => {
  const save = withPicks(['pearls', 'record', 'dolphins']);
  tallyOrders(save, DAY, 'voyage', plain({ pearls: 9, escort: 2.5 }));
  // A first time home is not a best time beaten.
  tallyOrders(save, DAY, 'voyage', plain(), { time: true, first: true });
  let list = todaysOrders(save, DAY);
  assert.deepEqual(list.map((o) => o.progress), [9, 0, 2.5]);
  const r = tallyOrders(save, DAY, 'sea', plain({ pearls: 40, escort: 3 }), { time: true });
  // Pearls cap at the goal; a sea run's "best" isn't a voyage's best time.
  assert.deepEqual(r.done.map((o) => o.id), ['pearls', 'dolphins']);
  list = todaysOrders(save, DAY);
  assert.deepEqual(list.map((o) => [o.progress, o.done]), [[15, true], [0, false], [5, true]]);
  tallyOrders(save, DAY, 'voyage', plain(), { time: true });
  assert.equal(ordersLeft(save, DAY), 0);
});

test('Open Sea gates count on the Open Sea only', () => {
  const save = withPicks(['voyages', 'gold', 'gates']);
  tallyOrders(save, DAY, 'voyage', plain({ gates: 9 }));
  assert.equal(todaysOrders(save, DAY)[2].progress, 0);
  const r = tallyOrders(save, DAY, 'sea', plain({ gates: 9 }));
  assert.deepEqual(r.done.map((o) => o.id), ['gates']);
});

test('one order a day can be swapped for another of its kind', () => {
  const save = withPicks(['pearls', 'gold', 'rescue']);
  tallyOrders(save, DAY, 'voyage', plain({ pearls: 4, rescued: [{ name: 'Pip' }] }));
  assert.equal(swapOrder(save, DAY, 'rescue'), null, 'not one already done');
  assert.equal(swapOrder(save, DAY, 'nope'), null);
  const next = swapOrder(save, DAY, 'pearls');
  assert.equal(next.slot, 0);
  assert.notEqual(next.id, 'pearls');
  assert.equal(save.orders.picks[0], next.id);
  assert.equal(save.orders.progress.pearls, undefined);
  assert.equal(swapOrder(save, DAY, 'gold'), null, 'once a day');
});

test('a new day brings new orders', () => {
  const save = withPicks(['voyages', 'gold', 'rescue']);
  tallyOrders(save, DAY, 'voyage', plain({ rescued: [{ name: 'Pip' }] }));
  swapOrder(save, DAY, 'gold');
  save.orders.seen = true;
  const next = '2026-10-30';
  const o = dayOrders(save, next);
  assert.equal(o.day, next);
  assert.deepEqual(o.picks, pickOrders(next));
  assert.deepEqual([o.done, o.progress, o.chest, o.swapped, o.seen], [[], {}, false, false, false]);
  assert.equal(ordersLeft(save, next), 3);
});

test('stored orders are checked as they load', () => {
  assert.equal(cleanOrders(null), null);
  assert.equal(cleanOrders({ day: DAY, picks: ['gold', 'voyages', 'rescue'] }), null, 'each pick from its own kind');
  assert.equal(cleanOrders({ day: DAY, picks: ['voyages', 'gold'] }), null);
  assert.equal(cleanOrders({ day: DAY, picks: ['voyages', 'gold', 'sunk'] }), null);
  const o = cleanOrders({ day: DAY, picks: ['voyages', 'gold', 'rescue'], progress: { voyages: 99, gold: -2, rescue: 'x', junk: 4 }, done: ['voyages', 'junk'], chest: 'yes', swapped: true, seen: 1 });
  assert.deepEqual(o, { day: DAY, picks: ['voyages', 'gold', 'rescue'], progress: { voyages: 3, gold: 0, rescue: 0 }, done: ['voyages'], chest: false, swapped: true, seen: false });
});

test("today's orders are kept in the save", () => {
  const store = new Map();
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  try {
    const save = loadSave();
    assert.equal(save.orders, null);
    save.orders = null;
    dayOrders(save, DAY).picks = ['voyages', 'gold', 'rescue'];
    tallyOrders(save, DAY, 'voyage', plain({ stars: 3 }));
    swapOrder(save, DAY, 'rescue');
    assert.ok(writeSave(save));
    const back = loadSave();
    assert.deepEqual(todaysOrders(back, DAY), todaysOrders(save, DAY));
    assert.deepEqual(back.orders.done, save.orders.done);
    assert.equal(back.orders.swapped, true);
  } finally {
    delete globalThis.window;
  }
});

test("starting over keeps the day's orders, so the chest opens once", () => {
  const save = loadSave();
  dayOrders(save, DAY).picks = ['voyages', 'gold', 'rescue'];
  Object.assign(save.orders, { done: ['voyages', 'gold', 'rescue'], chest: true });
  resetProgress(save);
  assert.equal(save.orders.chest, true);
  assert.equal(tallyOrders(save, DAY, 'voyage', plain({ stars: 3 })).blackPearls, 0);
});
