import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createGame, stepGame } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { createRecorder, recordGhost, finishGhost, isValidGhost, ghostAt, ghostGap, GHOST_DT } from '../web/src/world/ghost.js';

function sailFor(seconds) {
  const game = createGame(LEVELS[0]);
  const ap = createAutopilot(game);
  const rec = createRecorder(game);
  const track = [];
  const dt = 1 / 60;
  for (let i = 0; i < seconds / dt; i++) {
    stepGame(game, autopilotInput(ap, game, dt), dt);
    recordGhost(rec, game);
    track.push({ t: game.time, x: game.boat.x, y: game.boat.y });
  }
  return { game, ghost: finishGhost(rec, game.time), track };
}

test('a recorded ghost replays the track it sailed', () => {
  const { ghost, track } = sailFor(20);
  assert.ok(isValidGhost(ghost, LEVELS[0]));
  assert.equal(ghost.dt, GHOST_DT);
  for (const p of track.filter((_, i) => i % 97 === 0)) {
    const g = ghostAt(ghost, p.t);
    assert.ok(Math.hypot(g.x - p.x, g.y - p.y) < 1.5, `ghost strays at t=${p.t.toFixed(2)}`);
    assert.equal(g.done, false);
  }
  assert.equal(ghostAt(ghost, 25).done, true);
});

test('ghosts from another voyage or an old layout are rejected', () => {
  const { ghost } = sailFor(3);
  assert.equal(isValidGhost(ghost, LEVELS[1]), false);
  assert.equal(isValidGhost({ ...ghost, sig: 'old' }, LEVELS[0]), false);
  assert.equal(isValidGhost({ ...ghost, data: [1, 2, 3] }, LEVELS[0]), false);
  assert.equal(isValidGhost(null, LEVELS[0]), false);
});

test('the gap says how far behind or ahead of the ghost you are', () => {
  const { ghost, track } = sailFor(20);
  const at10 = track.find((p) => p.t >= 10);
  // Same spot as the ghost at 10 s: 3 s behind if it is now 13 s, 2 s ahead at 8 s.
  assert.ok(Math.abs(ghostGap(ghost, at10.x, at10.y, 13) - 3) < 0.25);
  assert.ok(Math.abs(ghostGap(ghost, at10.x, at10.y, 8) + 2) < 0.25);
  // Far off the ghost's line there is no meaningful gap.
  assert.equal(ghostGap(ghost, at10.x + 500, at10.y + 500, 10), null);
});
