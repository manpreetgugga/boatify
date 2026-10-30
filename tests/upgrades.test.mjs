import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, UPGRADE_STEPS, UPGRADE_PRICES, UPGRADE_TOTAL, partById, upgradeLevel, upgradeLevels, upgradeCount, nextPrice, buyUpgrade, withUpgrades } from '../web/src/data/upgrades.js';
import { BOAT_ORDER, BOAT_TYPES, createBoat, stepBoat, boatSpeed } from '../web/src/physics/boat.js';
import { createGame } from '../web/src/world/game.js';
import { voyageDef, CAMPAIGN } from '../web/src/data/worlds.js';
import { loadSave } from '../web/src/platform/save.js';
import { backupCode, readBackup } from '../web/src/platform/backup.js';

// Hold a boat on a heading in a steady wind and see how she goes.
function sail(type, windAngle, wind, secs = 40) {
  const b = createBoat(0, 0, 0, type);
  const env = { wx: Math.cos(windAngle) * wind, wy: Math.sin(windAngle) * wind, cx: 0, cy: 0 };
  let heel = 0;
  for (let t = 0; t < secs; t += 1 / 60) {
    stepBoat(b, { steer: 0, autoTrim: true }, env, 1 / 60);
    b.heading = 0;
    b.yawRate = 0;
    if (t > secs - 10) heel = Math.max(heel, Math.abs(b.heel));
  }
  // Made good straight into the wind.
  const vmg = -(b.vx * Math.cos(windAngle) + b.vy * Math.sin(windAngle));
  return { speed: boatSpeed(b), vmg, heel };
}

const REACH = Math.PI / 2; // wind on the beam
const CLOSE = Math.PI - 0.85; // close-hauled

test('three parts, three steps each, for every boat', () => {
  assert.deepEqual(PARTS.map((p) => p.id), ['sails', 'keel', 'hull']);
  assert.deepEqual(PARTS.map((p) => p.stat), ['speed', 'pointing', 'stability']);
  for (const p of PARTS) assert.ok(p.name && p.label && p.icon && p.text && p.step, p.id);
  assert.equal(UPGRADE_PRICES.length, UPGRADE_STEPS);
  for (let i = 1; i < UPGRADE_PRICES.length; i++) assert.ok(UPGRADE_PRICES[i] > UPGRADE_PRICES[i - 1]);
  assert.equal(UPGRADE_TOTAL, BOAT_ORDER.length * 9);
  assert.equal(partById('nope'), null);
});

test('steps are bought in order, with coins, up to three', () => {
  const save = loadSave();
  save.wallet.coins = 2000;
  assert.deepEqual(upgradeLevels(save, 'sloop'), { sails: 0, keel: 0, hull: 0 });
  assert.equal(nextPrice(save, 'sloop', 'sails'), UPGRADE_PRICES[0]);
  for (let i = 0; i < UPGRADE_STEPS; i++) {
    const r = buyUpgrade(save, 'sloop', 'sails');
    assert.equal(r.part.id, 'sails');
    assert.equal(r.level, i + 1);
  }
  assert.equal(save.wallet.coins, 2000 - UPGRADE_PRICES.reduce((a, b) => a + b, 0));
  assert.equal(upgradeLevel(save, 'sloop', 'sails'), UPGRADE_STEPS);
  assert.equal(nextPrice(save, 'sloop', 'sails'), null);
  // A fourth step isn't there to buy.
  const coins = save.wallet.coins;
  assert.equal(buyUpgrade(save, 'sloop', 'sails'), null);
  assert.equal(save.wallet.coins, coins);
  // Each boat keeps her own.
  assert.equal(upgradeLevel(save, 'skiff', 'sails'), 0);
  assert.equal(upgradeCount(save, 'sloop'), 3);
  assert.equal(upgradeCount(save), 3);
  // Unknown boats and parts, and too few coins, buy nothing.
  assert.equal(buyUpgrade(save, 'raft', 'sails'), null);
  assert.equal(buyUpgrade(save, 'sloop', 'oars'), null);
  save.wallet.coins = UPGRADE_PRICES[0] - 1;
  assert.equal(buyUpgrade(save, 'skiff', 'keel'), null);
  assert.equal(save.wallet.coins, UPGRADE_PRICES[0] - 1);
  // A step bought out of order (a hand-edited save) doesn't count past a gap.
  save.wallet.owned.push('upgrade:junk:hull:2');
  assert.equal(upgradeLevel(save, 'junk', 'hull'), 0);
});

test('with nothing bought a boat is just her type, and types are never changed', () => {
  const before = JSON.stringify(BOAT_TYPES);
  for (const id of BOAT_ORDER) {
    const t = BOAT_TYPES[id];
    assert.equal(withUpgrades(t, { sails: 0, keel: 0, hull: 0 }), t);
    assert.equal(withUpgrades(t), t);
    const up = withUpgrades(t, { sails: 3, keel: 3, hull: 3 });
    assert.notEqual(up, t);
    assert.equal(up.id, id);
    assert.equal(up.look, t.look);
    assert.ok(up.sailPower > t.sailPower && up.swayDrag > t.swayDrag && up.rightingMoment > t.rightingMoment);
    assert.deepEqual(up.upgrades, { sails: 3, keel: 3, hull: 3 });
  }
  assert.equal(JSON.stringify(BOAT_TYPES), before);
});

test('sails make her faster, the keel better upwind and the hull stiffer', () => {
  for (const id of BOAT_ORDER) {
    const t = BOAT_TYPES[id];
    const base = sail(t, REACH, 9);
    const fast = sail(withUpgrades(t, { sails: 3 }), REACH, 9);
    assert.ok(fast.speed > base.speed * 1.03, `${id} speed ${base.speed} -> ${fast.speed}`);
    // But never a different boat: a few percent, not a jump.
    assert.ok(fast.speed < base.speed * 1.08, `${id} speed ${base.speed} -> ${fast.speed}`);
    const up = sail(t, CLOSE, 9);
    const keel = sail(withUpgrades(t, { keel: 3 }), CLOSE, 9);
    assert.ok(keel.vmg > up.vmg * 1.04, `${id} upwind ${up.vmg} -> ${keel.vmg}`);
    const gust = sail(t, REACH, 14);
    const stiff = sail(withUpgrades(t, { hull: 3 }), REACH, 14);
    assert.ok(stiff.heel < gust.heel * 0.9, `${id} heel ${gust.heel} -> ${stiff.heel}`);
    // Each step helps a little more than the last one bought.
    const one = sail(withUpgrades(t, { sails: 1 }), REACH, 9).speed;
    assert.ok(one > base.speed && one < fast.speed, id);
  }
});

test("a voyage is sailed in the player's boat as upgraded", () => {
  const def = voyageDef(CAMPAIGN[0].id);
  const plain = createGame(def, { boat: 'junk' });
  assert.equal(plain.boat.type, BOAT_TYPES.junk);
  const game = createGame(def, { boat: 'junk', upgrades: { sails: 2, keel: 0, hull: 1 } });
  assert.equal(game.boat.type.id, 'junk');
  assert.equal(game.boat.type.sailPower, BOAT_TYPES.junk.sailPower * 1.08);
  assert.equal(game.boat.type.rightingMoment, BOAT_TYPES.junk.rightingMoment * 1.1);
  assert.equal(game.boat.type.swayDrag, BOAT_TYPES.junk.swayDrag);
});

test('upgrades travel in a backup code', async () => {
  const save = loadSave();
  save.wallet.coins = 5000;
  buyUpgrade(save, 'proa', 'keel');
  buyUpgrade(save, 'proa', 'keel');
  buyUpgrade(save, 'galleon', 'hull');
  const r = await readBackup(await backupCode(save));
  assert.equal(r.ok, true);
  assert.deepEqual(upgradeLevels(r.save, 'proa'), { sails: 0, keel: 2, hull: 0 });
  assert.deepEqual(upgradeLevels(r.save, 'galleon'), { sails: 0, keel: 0, hull: 1 });
  assert.equal(upgradeCount(r.save), 3);
});
