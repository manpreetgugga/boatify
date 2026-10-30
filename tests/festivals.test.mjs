import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FESTIVALS, festivalOn, nextWeek, festivalById, festivalForSail, awardFestivalSail } from '../web/src/data/festivals.js';
import { dailyCandidate, dailyVoyage } from '../web/src/data/daily.js';
import { SAILS, isGearUnlocked, gearCount } from '../web/src/data/locker.js';
import { buildLevel } from '../web/src/world/level.js';
import { festiveFloats, festiveLights } from '../web/src/render/festive.js';
import { isClear } from '../web/src/world/collision.js';
import { loadSave } from '../web/src/platform/save.js';

const on = (key) => (festivalOn(key) || {}).id || null;

test('each festival has a week, a sail in the locker and names for its voyage', () => {
  for (const f of FESTIVALS) {
    const sail = SAILS.find((g) => g.id === f.sail);
    assert.ok(sail, f.sail);
    assert.equal(sail.festival, f.id);
    assert.equal(festivalForSail(f.sail), f);
    assert.equal(festivalById(f.id), f);
    assert.ok(f.names.length >= 4 && f.blurb && f.tip.includes(sail.name), f.id);
    assert.ok(f.weather.night, `${f.id} is a night voyage`);
  }
});

test('the weeks fall where they should', () => {
  assert.equal(on('2026-10-24'), null);
  assert.equal(on('2026-10-25'), 'halloween');
  assert.equal(on('2026-10-30'), 'halloween');
  assert.equal(on('2026-10-31'), 'halloween');
  assert.equal(on('2026-11-04'), null);
  assert.equal(on('2026-11-05'), 'diwali');
  assert.equal(on('2026-11-08'), 'diwali');
  assert.equal(on('2026-11-11'), 'diwali');
  assert.equal(on('2026-11-12'), null);
  assert.equal(on('2026-12-19'), null);
  assert.equal(on('2026-12-20'), 'christmas');
  assert.equal(on('2026-12-26'), 'christmas');
  assert.equal(on('2026-12-27'), 'newyear');
  assert.equal(on('2027-01-01'), 'newyear');
  assert.equal(on('2027-01-02'), 'newyear');
  assert.equal(on('2027-01-03'), null);
  assert.equal(on('2027-06-30'), null);
  assert.equal(on('not a day'), null);
  assert.equal(on(''), null);
});

test('when Diwali comes close to Halloween, each keeps its own day', () => {
  // Diwali 2027 is 29 October.
  assert.equal(on('2027-10-26'), 'diwali');
  assert.equal(on('2027-10-29'), 'diwali');
  assert.equal(on('2027-10-31'), 'halloween');
  // 30 October is a day from each: Diwali has it.
  assert.equal(on('2027-10-30'), 'diwali');
  // Diwali 2035 falls on 30 October too.
  assert.equal(on('2035-10-30'), 'diwali');
  assert.equal(on('2035-10-31'), 'halloween');
});

test('the next week of a festival, across the turn of the year', () => {
  const ny = festivalById('newyear');
  assert.deepEqual(nextWeek(ny, '2026-10-30'), ['2026-12-27', '2027-01-02']);
  assert.deepEqual(nextWeek(ny, '2027-01-02'), ['2026-12-27', '2027-01-02']);
  assert.deepEqual(nextWeek(ny, '2027-01-03'), ['2027-12-27', '2028-01-02']);
  const h = festivalById('halloween');
  assert.deepEqual(nextWeek(h, '2026-10-30'), ['2026-10-25', '2026-10-31']);
  assert.deepEqual(nextWeek(h, '2026-11-01'), ['2027-10-25', '2027-10-31']);
  assert.deepEqual(nextWeek(festivalById('diwali'), '2026-12-01'), ['2027-10-26', '2027-11-01']);
  // Past the listed Diwali dates there is no week to name.
  assert.equal(nextWeek(festivalById('diwali'), '2036-01-01'), null);
});

test("a festival week's daily voyage is dressed for it and still sailable", () => {
  for (const [key, id] of [['2026-10-30', 'halloween'], ['2026-11-08', 'diwali'], ['2026-12-24', 'christmas'], ['2026-12-31', 'newyear']]) {
    const def = dailyVoyage(key);
    assert.ok(def, `${key} charted`);
    const f = festivalById(id);
    assert.equal(def.festival, id);
    assert.equal(def.theme, f.theme);
    assert.ok(f.names.includes(def.name), def.name);
    assert.ok(def.blurb.startsWith(f.blurb));
    assert.equal(def.weather.night, true);
    assert.equal(def.tips[0].text, f.tip);
    const level = buildLevel(def);
    assert.equal(level.festival, id);
    assert.ok(isClear(level, def.start.x, def.start.y, 30), 'start clear');
  }
  const plain = dailyCandidate('2027-06-30', 0);
  assert.equal(plain && plain.festival, undefined);
});

test('festival floats sit in open water, clear of the start and finish', () => {
  for (const key of ['2026-10-30', '2026-11-08', '2026-12-24', '2026-12-31']) {
    const level = buildLevel(dailyVoyage(key));
    const floats = festiveFloats(level);
    assert.ok(floats.length >= 10, `${key}: ${floats.length} floats`);
    assert.deepEqual(festiveFloats(level), floats, 'cached');
    for (const p of floats) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(isClear(level, p.x, p.y, 8), `${key}: float on land at ${p.x},${p.y}`);
      assert.ok(Math.hypot(p.x - level.start.x, p.y - level.start.y) > 60, 'too near the start');
    }
    for (const l of festiveLights(level)) assert.ok(l.length === 4 && l.every(Number.isFinite), String(l));
  }
  const plain = buildLevel(dailyVoyage('2027-06-30'));
  assert.equal(festiveFloats(plain).length, 0);
});

test('the sail is won once, on the festival voyage, in its week', () => {
  const save = loadSave();
  const sail = SAILS.find((g) => g.id === 'pumpkin');
  assert.equal(isGearUnlocked(save, sail), false);
  const before = gearCount(save);
  const def = dailyVoyage('2026-10-30');
  // Out of the week (an old voyage finished late), nothing.
  assert.equal(awardFestivalSail(save, def, '2026-11-02'), null);
  // A plain voyage, nothing.
  assert.equal(awardFestivalSail(save, { daily: '2026-10-30' }, '2026-10-30'), null);
  assert.equal(awardFestivalSail(save, null, '2026-10-30'), null);
  // A forged festival on another week's day, nothing.
  assert.equal(awardFestivalSail(save, { ...def, daily: '2026-06-01' }, '2026-10-30'), null);
  assert.equal(awardFestivalSail(save, def, '2026-10-30'), festivalById('halloween'));
  assert.equal(isGearUnlocked(save, sail), true);
  assert.equal(awardFestivalSail(save, def, '2026-10-31'), null, 'only once');
  assert.equal(save.wallet.owned.filter((k) => k === 'gear:pumpkin').length, 1);
  // Festival sails don't count toward the medal set.
  assert.equal(gearCount(save), before);
  // The other festivals' sails stay locked.
  for (const id of ['rangoli', 'candy', 'firework']) assert.equal(isGearUnlocked(save, SAILS.find((g) => g.id === id)), false);
});
