import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createGame } from '../web/src/world/game.js';
import { createSkipper, updateSkipper, helmsman } from '../web/src/render/skipper.js';
import { BOAT_TYPES } from '../web/src/physics/boat.js';

const DT = 1 / 60;

function run(sk, game, seconds, until = () => false) {
  for (let i = 0; i < seconds / DT; i++) {
    updateSkipper(sk, game, DT);
    if (until(sk)) return true;
  }
  return false;
}

function sailing() {
  const game = createGame(LEVELS[0]);
  Object.assign(game.boat, { vx: 5, vy: 0, rudder: 0, heel: 0.1, boom: 0.5 });
  game.status = 'sailing';
  return game;
}

test('left alone, the skipper leaves the tiller for a stroll, and comes back when you steer', () => {
  const game = sailing();
  const sk = createSkipper();
  updateSkipper(sk, game, DT);
  assert.equal(sk.doing, 'helm');
  const strolled = run(sk, game, 30, (s) => !s.path.length && ['bow', 'mast', 'rail'].includes(s.doing));
  assert.ok(strolled, 'went up the deck');
  const wasAt = sk.u;

  game.boat.rudder = 0.6;
  const back = run(sk, game, 6, (s) => !s.path.length && s.doing === 'helm');
  assert.ok(back, 'back at the helm');
  assert.ok(sk.u < wasAt, 'aft of where he was');
  // He stays put while you're steering.
  run(sk, game, 20);
  assert.equal(sk.doing, 'helm');
  assert.equal(sk.path.length, 0);
});

test('he sits out on the windward rail when she heels, and swaps sides on a tack', () => {
  const game = sailing();
  const sk = createSkipper();
  game.boat.heel = 0.6;
  assert.ok(run(sk, game, 6, (s) => !s.path.length && s.doing === 'hike'), 'hiking');
  const side = Math.sign(sk.v);
  assert.equal(side, -Math.sign(game.boat.boom), 'on the windward side');
  game.boat.boom = -0.5;
  run(sk, game, DT);
  assert.ok(sk.duck, 'ducks under the boom');
  assert.ok(run(sk, game, 6, (s) => !s.path.length && s.doing === 'hike'), 'hiking again');
  assert.equal(Math.sign(sk.v), -side, 'on the new windward side');
});

test('he swims when she goes over, climbs back aboard, and cheers a pearl and the finish', () => {
  const game = sailing();
  const sk = createSkipper();
  run(sk, game, 1);
  game.status = 'capsized';
  run(sk, game, 1);
  assert.equal(sk.doing, 'swim');
  game.status = 'sailing';
  run(sk, game, DT);
  assert.equal(sk.doing, 'helm');

  game.pearls = (game.pearls || 0) + 1;
  run(sk, game, DT);
  assert.ok(sk.cheer > 0, 'cheers the pearl');

  game.status = 'finished';
  assert.ok(run(sk, game, 10, (s) => s.doing === 'cheer'), 'cheering at the bow');
  assert.ok(sk.u > 0.2, 'up at the bow');
});

test('he stays on deck on every boat, and the fleet helmsmen sit at their tillers', () => {
  for (const type of Object.values(BOAT_TYPES)) {
    const game = sailing();
    game.boat.type = type;
    const sk = createSkipper();
    for (let i = 0; i < 6000; i++) {
      game.boat.rudder = i % 1500 < 200 ? 0.5 : 0;
      game.boat.heel = i % 2400 < 300 ? 0.6 : 0.1;
      if (i % 900 === 0) game.boat.boom = -game.boat.boom;
      updateSkipper(sk, game, DT);
      assert.ok(Math.abs(sk.u) <= 0.5 && Math.abs(sk.v) <= 0.5, `${type.id} on deck at ${sk.u}, ${sk.v}`);
    }
    const h = helmsman(type, 1);
    assert.equal(h.doing, 'helm');
    assert.ok(h.u < 0, `${type.id} helmsman sits aft`);
  }
});
