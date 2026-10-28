import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { blob } from '../web/src/world/shapes.js';
import { buildLevel } from '../web/src/world/level.js';
import { isClear } from '../web/src/world/collision.js';
import { moveFloes, floeOffset, inFloeLane } from '../web/src/world/floes.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { loadSave, recordResult, isUnlocked } from '../web/src/platform/save.js';

const DT = 1 / 60;
const ICY = LEVELS.filter((def) => (def.floes || []).length);

test('there is a voyage with drifting ice', () => {
  assert.ok(ICY.length > 0);
});

test('floes swing back and forth on a fixed beat', () => {
  const level = buildLevel(ICY[0]);
  for (const f of level.floes) {
    for (const t of [0, 7.5, 33, 61.25]) {
      moveFloes(level, t);
      const [ox, oy] = floeOffset(f, t);
      assert.ok(Math.abs(f.ox - ox) < 1e-9 && Math.abs(f.oy - oy) < 1e-9);
      assert.ok(Math.abs(ox) <= Math.abs(f.drift[0]) + 1e-9 && Math.abs(oy) <= Math.abs(f.drift[1]) + 1e-9);
      const [ax, ay] = floeOffset(f, t + f.period);
      assert.ok(Math.abs(ax - ox) < 1e-6 && Math.abs(ay - oy) < 1e-6, 'back where it was one period later');
    }
  }
});

for (const def of ICY) {
  test(`${def.id}: the ice never slides through land, and marks sit clear of it`, () => {
    const level = buildLevel(def);
    for (const [i, f] of level.floes.entries()) {
      for (let k = 0; k <= 20; k++) {
        const s = -1 + k / 10;
        for (const [px, py] of f.pts) {
          const x = px + f.drift[0] * s;
          const y = py + f.drift[1] * s;
          assert.ok(isClear(level, x, y, 10), `floe ${i} hits land or rocks at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        }
      }
    }
    for (const p of def.pickups) assert.equal(inFloeLane(level, p.x, p.y, 24), false, `${p.kind} at ${p.x},${p.y}`);
    for (const c of def.checkpoints) assert.equal(inFloeLane(level, c.x, c.y, 45), false, `checkpoint at ${c.x},${c.y}`);
    assert.equal(inFloeLane(level, def.start.x, def.start.y, 40), false, 'start');
    assert.equal(inFloeLane(level, def.finish.x, def.finish.y, def.finish.r + 20), false, 'finish');
  });

  test(`${def.id}: the autopilot times its crossings and never hits the ice`, () => {
    for (const [boat, seed] of [['sloop', 0], ['junk', 2]]) {
      const game = createGame(def, { boat, seed });
      const pilot = createAutopilot(game);
      let hits = 0;
      while (game.status !== 'finished' && game.time < 400) {
        stepGame(game, autopilotInput(pilot, game, DT), DT);
        hits += drainEvents(game).filter((e) => e.type === 'collide' && e.material === 'ice').length;
      }
      assert.equal(game.status, 'finished', `${boat}: ${game.status}`);
      assert.equal(hits, 0, `${boat} hit the ice ${hits} times`);
    }
  });
}

test('a drifting floe shoves and dents a boat in its way', () => {
  const def = {
    ...LEVELS[0],
    id: 'floe-test',
    start: { x: 400, y: 400, heading: 0 },
    wind: { from: 90, speed: 3, gust: 0, shift: 0, period: 50 },
    islands: [],
    rocks: [],
    pickups: [],
    checkpoints: [],
    tips: [],
    floes: [{ pts: blob(400, 250, 40, 5, 0.1), drift: [0, 120], period: 40 }],
  };
  const game = createGame(def);
  const events = [];
  for (let i = 0; i < 60 * 10; i++) {
    stepGame(game, { steer: 0, trimTarget: 1, autoTrim: false, boost: false }, DT);
    events.push(...drainEvents(game));
  }
  assert.ok(events.some((e) => e.type === 'collide' && e.material === 'ice'), 'the floe hit the boat');
  assert.ok(game.hull < 100, `hull ${game.hull}`);
  assert.ok(game.boat.y > 410, `pushed south to ${game.boat.y.toFixed(0)}`);
});

test('a voyage you have finished stays open even if one is added before it', () => {
  const save = loadSave();
  const last = LEVELS.length - 1;
  assert.equal(isUnlocked(save, LEVELS, last), false);
  recordResult(save, LEVELS[last].id, { time: 100, stars: 1, pearls: 0, pearlsTotal: 5 });
  assert.equal(isUnlocked(save, LEVELS, last), true);
  assert.equal(isUnlocked(save, LEVELS, last - 1), false);
});
