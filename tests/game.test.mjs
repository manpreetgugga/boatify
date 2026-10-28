import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { recordResult, isUnlocked, totalStars, loadSave } from '../web/src/platform/save.js';

const idle = () => ({ steer: 0, trimTarget: 0.5, autoTrim: true, boost: false });

test('the simulation is deterministic for the same voyage', () => {
  const run = () => {
    const g = createGame(LEVELS[1]);
    for (let i = 0; i < 600; i++) stepGame(g, { ...idle(), steer: Math.sin(i / 40) }, 1 / 60);
    return [g.boat.x, g.boat.y, g.time];
  };
  assert.deepEqual(run(), run());
});

test('first tips appear at the start of a voyage', () => {
  const g = createGame(LEVELS[0]);
  stepGame(g, idle(), 0.05);
  const events = drainEvents(g);
  assert.ok(events.some((e) => e.type === 'tip'));
});

test('a gust jar gives a burst of speed', () => {
  const g = createGame(LEVELS[0], { startJars: 1 });
  for (let i = 0; i < 300; i++) stepGame(g, idle(), 1 / 60);
  drainEvents(g);
  stepGame(g, { ...idle(), boost: true }, 1 / 60);
  assert.equal(g.gustJars, 0);
  assert.ok(drainEvents(g).some((e) => e.type === 'boost'));
});

test('saving results keeps the best time and unlocks the next voyage', () => {
  const save = loadSave();
  const ids = LEVELS.map((l) => l.id);
  assert.equal(isUnlocked(save, LEVELS, 1), false);
  const r1 = recordResult(save, ids[0], { time: 90, stars: 2, pearls: 3, pearlsTotal: 9, distance: 100, capsizes: 1 }, ['note a']);
  assert.ok(r1.first && r1.time);
  const r2 = recordResult(save, ids[0], { time: 100, stars: 1, pearls: 5, pearlsTotal: 9, distance: 100, capsizes: 0 }, ['note a', 'note b']);
  assert.equal(r2.time, false);
  assert.equal(save.levels[ids[0]].best, 90);
  assert.equal(save.levels[ids[0]].stars, 2);
  assert.equal(save.levels[ids[0]].pearls, 5);
  assert.deepEqual(save.notes, ['note a', 'note b']);
  assert.equal(isUnlocked(save, LEVELS, 1), true);
  assert.equal(totalStars(save), 2);
});
