import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { buildLevel } from '../web/src/world/level.js';
import { isClear } from '../web/src/world/collision.js';
import { createNavGrid, findPath } from '../web/src/world/autopilot.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { fromBearing, wrapAngle } from '../web/src/core/math.js';

test('voyage ids are unique and data is complete', () => {
  const ids = new Set();
  for (const def of LEVELS) {
    assert.ok(!ids.has(def.id), `duplicate id ${def.id}`);
    ids.add(def.id);
    for (const k of ['name', 'blurb', 'size', 'start', 'finish', 'wind', 'par']) assert.ok(def[k], `${def.id}.${k}`);
    assert.ok(def.par.gold < def.par.silver, `${def.id} par`);
  }
});

for (const def of LEVELS) {
  test(`${def.id}: marks sit in open water inside the chart`, () => {
    const level = buildLevel(def);
    const inside = (p) => p.x > 0 && p.y > 0 && p.x < level.width && p.y < level.height;
    assert.ok(inside(level.start) && isClear(level, level.start.x, level.start.y, 14), 'start');
    assert.ok(inside(level.finish) && isClear(level, level.finish.x, level.finish.y, 10), 'finish');
    for (const c of level.checkpoints) assert.ok(inside(c) && isClear(level, c.x, c.y, 10), `checkpoint ${c.x},${c.y}`);
    for (const p of level.pickups) assert.ok(inside(p) && isClear(level, p.x, p.y, 6), `${p.kind} at ${p.x},${p.y}`);
  });

  test(`${def.id}: a navigable route exists from A to B`, () => {
    const level = buildLevel(def);
    const grid = createNavGrid(level);
    const path = findPath(grid, level.start.x, level.start.y, level.finish.x, level.finish.y, wrapAngle(fromBearing(def.wind.from)));
    assert.ok(path && path.length > 1);
  });

  test(`${def.id}: the autopilot can sail it inside the two-star time`, () => {
    const game = createGame(def);
    const ap = createAutopilot(game);
    const dt = 1 / 30;
    while (game.status !== 'finished' && game.time < def.par.silver * 1.5) {
      stepGame(game, autopilotInput(ap, game, dt), dt);
      drainEvents(game);
    }
    assert.equal(game.status, 'finished', `stuck at ${game.boat.x.toFixed(0)},${game.boat.y.toFixed(0)} after ${game.time.toFixed(0)} s`);
    assert.ok(game.result.time <= def.par.silver, `${game.result.time.toFixed(1)} s vs silver ${def.par.silver}`);
  });
}
