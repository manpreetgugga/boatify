import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { dailyVoyage, chartDaily, dailyCandidate, dateKey, dailyId, DAILY_VERSION } from '../web/src/data/daily.js';
import { buildLevel } from '../web/src/world/level.js';
import { isClear } from '../web/src/world/collision.js';
import { loadSave, recordResult, totalStars, markDaily, currentStreak, isDailyUnlocked, DAILY_UNLOCK } from '../web/src/platform/save.js';

const DAYS = ['2026-10-28', '2027-01-01', '2027-02-14', '2027-06-30'];

test('date keys are local calendar days', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('the same day always charts the same course, other days differ', () => {
  assert.deepEqual(dailyCandidate('2026-10-28', 0), dailyCandidate('2026-10-28', 0));
  const a = dailyVoyage(DAYS[0]);
  const b = dailyVoyage(DAYS[1]);
  assert.equal(a.id, dailyId(DAYS[0]));
  assert.notDeepEqual(a.islands, b.islands);
});

for (const key of DAYS) {
  test(`daily ${key}: sailable, with marks in open water and sensible par`, () => {
    const def = dailyVoyage(key);
    assert.ok(def, 'no course charted');
    assert.equal(def.daily, key);
    for (const k of ['name', 'blurb', 'size', 'start', 'finish', 'wind']) assert.ok(def[k], k);
    assert.ok(def.par.gold > 30 && def.par.gold < def.par.silver, `par ${def.par.gold}/${def.par.silver}`);
    const level = buildLevel(def);
    const inside = (p) => p.x > 0 && p.y > 0 && p.x < level.width && p.y < level.height;
    assert.ok(isClear(level, level.start.x, level.start.y, 14), 'start');
    assert.ok(isClear(level, level.finish.x, level.finish.y, 10), 'finish');
    for (const c of level.checkpoints) assert.ok(inside(c) && isClear(level, c.x, c.y, 10), `checkpoint ${c.x},${c.y}`);
    for (const p of level.pickups) assert.ok(inside(p) && isClear(level, p.x, p.y, 6), `${p.kind} at ${p.x},${p.y}`);
    assert.ok(def.pickups.filter((p) => p.kind === 'pearl').length >= 4, 'pearls');
  });
}

test('charting in slices gives every caller the same course', async () => {
  const key = '2030-05-05';
  const got = await Promise.all([0, 1].map(() => new Promise((done) => chartDaily(key, null, done, 2))));
  assert.ok(got[0] && got[0].daily === key && got[0].par.gold > 0);
  assert.equal(got[0], got[1]);
  assert.equal(dailyVoyage(key), got[0]);
});

test('a cached course from an earlier session is reused only for its day', () => {
  const today = '2031-03-03';
  const def = { ...dailyCandidate(today, 0), name: 'Cached' };
  assert.equal(dailyVoyage(today, { v: DAILY_VERSION, def }).name, 'Cached');
  const other = '2031-03-04';
  assert.notEqual(dailyVoyage(other, { v: DAILY_VERSION, def }).name, 'Cached');
});

test('daily results stay out of campaign stars and keep a streak', () => {
  const save = loadSave();
  const r = { time: 100, stars: 3, pearls: 4, pearlsTotal: 8, distance: 50, capsizes: 0 };
  recordResult(save, dailyId('2026-10-28'), r, [], 'daily');
  assert.equal(totalStars(save), 0);
  assert.equal(save.daily[dailyId('2026-10-28')].best, 100);

  markDaily(save, '2026-10-28');
  markDaily(save, '2026-10-28');
  assert.equal(save.streak.count, 1);
  markDaily(save, '2026-10-29');
  markDaily(save, '2026-10-30');
  assert.equal(currentStreak(save, '2026-10-30'), 3);
  assert.equal(currentStreak(save, '2026-10-31'), 3, 'alive until the day is missed');
  assert.equal(currentStreak(save, '2026-11-01'), 0);
  markDaily(save, '2026-11-02');
  assert.equal(save.streak.count, 1);
  assert.equal(save.streak.best, 3);
  // Month boundaries count as consecutive days.
  markDaily(save, '2026-11-30');
  markDaily(save, '2026-12-01');
  assert.equal(save.streak.count, 2);
});

test('old daily results are pruned', () => {
  const save = loadSave();
  const r = { time: 100, stars: 1, pearls: 0, pearlsTotal: 8 };
  for (let d = 1; d <= 40; d++) recordResult(save, dailyId(dateKey(new Date(2027, 0, d))), r, [], 'daily');
  const keys = Object.keys(save.daily).sort();
  assert.equal(keys.length, 30);
  assert.equal(keys[keys.length - 1], dailyId('2027-02-09'));
});

test('the daily voyage opens after the first campaign voyages', () => {
  const save = loadSave();
  const r = { time: 100, stars: 1, pearls: 0, pearlsTotal: 8 };
  for (let i = 0; i < DAILY_UNLOCK; i++) {
    assert.equal(isDailyUnlocked(save, LEVELS), false);
    recordResult(save, LEVELS[i].id, r);
  }
  assert.equal(isDailyUnlocked(save, LEVELS), true);
});
