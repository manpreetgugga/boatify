import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { buildLevel } from '../web/src/world/level.js';
import { createGame } from '../web/src/world/game.js';
import { pointInPolygon } from '../web/src/core/math.js';
import { placeColonies, updateColonies } from '../web/src/render/penguins.js';

const DRIFT = LEVELS.find((d) => d.id === 'drift-ice');

test('penguins stand on the ice of every shelf, berg and big floe on Drift Ice', () => {
  const level = buildLevel(DRIFT);
  const huddles = placeColonies(level);
  const ice = level.islands.filter((isl) => isl.kind === 'ice');
  for (const isl of ice) {
    const on = huddles.filter((h) => !h.floe && pointInPolygon(h.x, h.y, isl.pts));
    assert.ok(on.length >= 1, `a huddle on the ice at ${Math.round(isl.cx)}, ${Math.round(isl.cy)}`);
    for (const h of on) for (const p of h.penguins) assert.ok(pointInPolygon(p.x, p.y, isl.pts), 'penguin on its ice');
  }
  for (const f of level.floes.filter((fl) => fl.radius >= 40)) {
    const h = huddles.find((hd) => hd.floe === f);
    assert.ok(h && h.penguins.length >= 2, 'penguins ride the floe');
    for (const p of h.penguins) assert.ok(pointInPolygon(p.x, p.y, f.pts), 'penguin on its floe');
  }
  assert.ok(huddles.reduce((n, h) => n + h.penguins.length, 0) >= 40, 'plenty of penguins');
});

test('penguins are placed the same way every time, and only on ice', () => {
  const a = placeColonies(buildLevel(DRIFT));
  const b = placeColonies(buildLevel(DRIFT));
  assert.deepEqual(
    a.map((h) => h.penguins.map((p) => [p.x, p.y])),
    b.map((h) => h.penguins.map((p) => [p.x, p.y])),
  );
  for (const def of LEVELS) {
    const level = buildLevel(def);
    const hasIce = level.islands.some((isl) => isl.kind === 'ice') || (level.floes || []).length > 0;
    if (!hasIce) assert.equal(placeColonies(level).length, 0, def.id);
  }
});

test('a boat sailing past sends penguins in for a swim, and they climb back out', () => {
  const game = createGame(DRIFT);
  const lf = {};
  updateColonies(lf, game, 0);
  const h = lf.colonies.huddles.find((hd) => hd.edge);
  // Park the boat just off the huddle's edge, moving.
  game.boat.x = h.edge.x + h.edge.nx * 30;
  game.boat.y = h.edge.y + h.edge.ny * 30;
  game.boat.vx = 6;
  game.boat.vy = 0;
  for (const p of h.penguins) p.cool = 0;
  let swam = false;
  for (let i = 0; i < 60 * 10 && !swam; i++) {
    updateColonies(lf, game, 1 / 60);
    swam = h.penguins.some((p) => p.s === 'swim');
  }
  assert.ok(swam, 'a penguin went for a swim');
  assert.ok(lf.colonies.near, 'the boat is near a colony');
  // Sail away: everyone is back on the ice before long.
  game.boat.x = -1000;
  game.boat.y = -1000;
  for (let i = 0; i < 60 * 15; i++) updateColonies(lf, game, 1 / 60);
  assert.ok(h.penguins.every((p) => p.s === 'stand'), 'all back on the ice');
  assert.equal(lf.colonies.near, false);
});
