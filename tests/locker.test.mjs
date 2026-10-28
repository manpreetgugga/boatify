import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { MEDALS, awardMedals } from '../web/src/data/medals.js';
import { SAILS, HULLS, GEAR_TOTAL, boatLook, fittedGear, gearCount, isGearUnlocked, rewardFor } from '../web/src/data/locker.js';
import { BOAT_ORDER, BOAT_TYPES, createBoat } from '../web/src/physics/boat.js';
import { loadSave, recordResult, resetProgress } from '../web/src/platform/save.js';
import { drawBoat, drawSailFlat } from '../web/src/render/boat.js';

const HEX = /^#[0-9a-f]{6}$/;

// A canvas context that ignores drawing but checks every point is a number.
function stubContext() {
  const bad = [];
  const check = (name) => (...args) => {
    if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) bad.push(`${name}(${args.join(', ')})`);
  };
  const ctx = new Proxy(
    { globalAlpha: 1 },
    {
      get: (t, k) => (k in t ? t[k] : check(String(k))),
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    },
  );
  return { ctx, bad };
}

globalThis.Path2D = class {
  constructor() {
    return new Proxy(this, { get: () => () => {} });
  }
};

test('every medal puts exactly one sail or hull paint in the locker', () => {
  for (const list of [SAILS, HULLS]) {
    assert.equal(list[0].id, 'stock');
    assert.ok(!list[0].medal);
    assert.equal(new Set(list.map((g) => g.id)).size, list.length);
  }
  const gear = [...SAILS, ...HULLS].filter((g) => g.medal);
  assert.equal(gear.length, GEAR_TOTAL);
  assert.equal(GEAR_TOTAL, MEDALS.length);
  for (const m of MEDALS) {
    assert.equal(gear.filter((g) => g.medal === m.id).length, 1, m.id);
    assert.ok(rewardFor(m.id), m.id);
  }
  assert.equal(rewardFor('clean-getaway').label, 'Jolly Roger sail');
  assert.equal(rewardFor('whale-watcher').label, 'Midnight hull paint');
});

test('locker colors are well formed', () => {
  for (const s of SAILS.slice(1)) {
    assert.match(s.cloth, HEX, s.id);
    assert.match(s.shade, HEX, s.id);
    assert.ok(Array.isArray(s.marks) && s.marks.length, s.id);
  }
  for (const h of HULLS.slice(1)) {
    assert.match(h.hull, HEX, h.id);
    assert.match(h.hullDark, HEX, h.id);
    for (const k of ['deck', 'trim']) if (h[k]) assert.match(h[k], HEX, `${h.id} ${k}`);
  }
});

test('gear is fitted only once its medal is earned, and a reset takes it off', () => {
  const save = loadSave();
  Object.assign(save.settings, { sail: 'harbor', hull: 'midnight' });
  assert.deepEqual(fittedGear(save), { sail: 'stock', hull: 'stock' });
  assert.equal(gearCount(save), 0);

  // The first voyage earns Cast Off, which unlocks the Harbor Stripe.
  const def = LEVELS[0];
  const result = { time: def.par.gold + 30, stars: 1, pearls: 0, pearlsTotal: 1, hull: 80, capsizes: 0, hits: {}, jars: 1, boat: 'sloop', distance: 1000 };
  const improved = recordResult(save, def.id, result);
  awardMedals(save, LEVELS, { def, result, improved });
  assert.ok(isGearUnlocked(save, SAILS.find((g) => g.id === 'harbor')));
  assert.deepEqual(fittedGear(save), { sail: 'harbor', hull: 'stock' });
  assert.ok(gearCount(save) >= 1);

  save.medals['whale-watcher'] = '2026-10-28';
  assert.deepEqual(fittedGear(save), { sail: 'harbor', hull: 'midnight' });

  resetProgress(save);
  assert.deepEqual(fittedGear(save), { sail: 'stock', hull: 'stock' });
  assert.equal(save.settings.sail, 'harbor', 'the choice is remembered for when the medal is won again');
});

test('a look paints over the boat type without changing how it sails', () => {
  const junk = BOAT_TYPES.junk;
  assert.deepEqual(boatLook(junk, {}), junk.look, 'stock keeps the red junk sail');
  const pirate = boatLook(junk, { sail: 'jolly', hull: 'midnight' });
  assert.equal(pirate.sail, SAILS.find((g) => g.id === 'jolly').cloth);
  assert.equal(pirate.hull, HULLS.find((g) => g.id === 'midnight').hull);
  assert.equal(pirate.deck, junk.look.deck, 'no deck paint keeps the deck');
  assert.equal(boatLook(junk, { sail: 'jolly', hull: 'midnight' }), pirate, 'looks are cached');
  assert.equal(boatLook(junk, { sail: 'nonsense' }).sail, junk.look.sail);
  assert.equal(junk.look.sail, '#c4492f', 'the boat type itself is untouched');
});

test('every sail and hull paint draws on every boat without a bad point', () => {
  for (const id of BOAT_ORDER) {
    const type = BOAT_TYPES[id];
    for (const sail of SAILS) {
      for (const hull of [HULLS[0], HULLS[HULLS.length - 1]]) {
        const look = boatLook(type, { sail: sail.id, hull: hull.id });
        for (const [heel, boom, luffing] of [[0, 0.02, false], [0.4, 0.8, false], [-0.6, -1.2, true]]) {
          const boat = { ...createBoat(0, 0, 0.3, type), heel, boom, luffing, drive: 4 };
          const { ctx, bad } = stubContext();
          drawBoat(ctx, boat, 1.2, { look, pennant: [3, 1] });
          assert.deepEqual(bad, [], `${id} ${sail.id} ${hull.id} heel ${heel}`);
        }
        const { ctx, bad } = stubContext();
        drawSailFlat(ctx, look, 10, 4, 50);
        assert.deepEqual(bad, [], `flat ${sail.id}`);
      }
    }
  }
});
