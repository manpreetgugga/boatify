import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { buildLevel } from '../web/src/world/level.js';
import { createGame } from '../web/src/world/game.js';
import { pointInPolygon, dist } from '../web/src/core/math.js';
import { placeGreenery, placeIslandLife, updateIslandLife, islandAnimals, shore } from '../web/src/render/islandlife.js';

const DT = 1 / 30;

function islands(kind) {
  return LEVELS.flatMap((def) => buildLevel(def).islands.filter((isl) => isl.kind === kind).map((isl) => ({ def, isl })));
}

test('plants grow inside every island, the same way every time, and none on the ice', () => {
  for (const { def, isl } of [...islands('sand'), ...islands('rock')]) {
    const g = placeGreenery(isl);
    const shapes = [...g.ground, ...g.beach, ...g.plants].flatMap((b) => b.shapes);
    assert.ok(shapes.length > 20, `${def.id}: something grows`);
    for (const s of shapes) {
      // Shapes are anchored inside; clumps and petals may spill a little.
      const [x, y] = [s[1], s[2]];
      assert.ok(pointInPolygon(x, y, isl.pts) || shore(x, y, isl.pts).d < 10, `${def.id}: ${s[0]} at ${Math.round(x)}, ${Math.round(y)}`);
    }
    assert.deepEqual(placeGreenery(isl), g);
  }
  const ice = buildLevel(LEVELS.find((d) => d.id === 'drift-ice')).islands;
  for (const isl of ice) {
    const g = placeGreenery(isl);
    assert.equal(g.ground.length + g.beach.length + g.plants.length, 0);
  }
});

test('crabs, turtles and seals live by the water; goats graze inland, out from under the palms', () => {
  let turtles = 0;
  let seals = 0;
  let goats = 0;
  for (const { def, isl } of [...islands('sand'), ...islands('rock')]) {
    const life = placeIslandLife(isl);
    assert.ok(life.crabs.length >= 1, `${def.id}: crabs`);
    for (const c of life.crabs) {
      assert.ok(pointInPolygon(c.ax, c.ay, isl.pts), 'crab on the island');
      assert.ok(shore(c.ax, c.ay, isl.pts).d < 10, 'crab by the water');
    }
    for (const a of [...life.turtles, ...life.seals]) {
      assert.ok(pointInPolygon(a.x, a.y, isl.pts), `${a.kind} on the island`);
      const d = shore(a.x, a.y, isl.pts).d;
      assert.ok(d >= 3.5 && d < 12, `${a.kind} near the water (${d.toFixed(1)})`);
      assert.ok(!pointInPolygon(a.edge.x, a.edge.y, isl.pts), `${a.kind} goes in off the island`);
    }
    assert.equal(isl.kind === 'sand' ? life.seals.length : life.turtles.length, 0, 'turtles on sand, seals on rock');
    for (const g of life.goats) {
      assert.ok(pointInPolygon(g.x, g.y, isl.pts), 'goat on the island');
      assert.ok(shore(g.x, g.y, isl.pts).d > 12, 'goat inland');
      if (!g.kid) assert.ok(!g.herd.shade.some(([x, y, r]) => dist(x, y, g.x, g.y) < r), 'goat out from under the palms');
    }
    turtles += life.turtles.length;
    seals += life.seals.length;
    goats += life.goats.length;
    assert.deepEqual(
      placeIslandLife(isl).goats.map((g) => [g.x, g.y]),
      life.goats.map((g) => [g.x, g.y]),
    );
  }
  assert.ok(turtles >= 10 && seals >= 20 && goats >= 40, `plenty of animals: ${turtles} turtles, ${seals} seals, ${goats} goats`);
  // The first voyage has some of everything.
  const first = buildLevel(LEVELS[0]).islands.map(placeIslandLife);
  for (const k of ['crabs', 'turtles', 'seals', 'goats', 'parrots']) assert.ok(first.some((l) => l[k].length), `${k} on the first voyage`);
});

test('a boat sailing close sends turtles and seals into the sea, and they haul out once it has gone', () => {
  for (const [kind, list] of [['sand', 'turtles'], ['rock', 'seals']]) {
    const game = createGame(LEVELS[0]);
    const isl = game.level.islands.find((i) => i.kind === kind && placeIslandLife(i)[list].length);
    const lf = {};
    game.boat.x = isl.cx;
    game.boat.y = isl.cy;
    updateIslandLife(lf, game, 0);
    const a = lf.isles.map.get(isl)[list][0];
    game.boat.x = a.edge.x + a.edge.nx * 25;
    game.boat.y = a.edge.y + a.edge.ny * 25;
    game.boat.vx = 6;
    game.boat.vy = 0;
    a.cool = 0;
    let swam = false;
    for (let i = 0; i < 30 * 10 && !swam; i++) {
      updateIslandLife(lf, game, DT);
      swam = a.state === 'swim';
    }
    assert.ok(swam, `the ${list} went for a swim`);
    assert.equal(lf.isles.near, kind === 'sand' ? 'turtle' : 'seal');
    // Sail off, but stay close enough that the island keeps moving.
    game.boat.x = isl.bounds.maxX + 400;
    for (let i = 0; i < 30 * 40; i++) updateIslandLife(lf, game, DT);
    assert.equal(a.state, 'rest', `the ${list} hauled out`);
  }
});

test('goats keep to their pasture and parrots fly from palm to palm', () => {
  const game = createGame(LEVELS[0]);
  const lf = {};
  const isl = game.level.islands.find((i) => placeIslandLife(i).goats.length && placeIslandLife(i).parrots.length);
  assert.ok(isl, 'an island with goats and parrots on the first voyage');
  game.boat.x = isl.bounds.maxX + 200;
  game.boat.y = isl.cy;
  let flew = 0;
  let landed = 0;
  updateIslandLife(lf, game, 0);
  const life = lf.isles.map.get(isl);
  const was = life.parrots.map((p) => p.state);
  for (let i = 0; i < 30 * 120; i++) {
    updateIslandLife(lf, game, DT);
    life.parrots.forEach((p, k) => {
      if (p.state !== was[k]) {
        if (p.state === 'fly') flew += 1;
        else landed += 1;
        was[k] = p.state;
      }
    });
    if (i % 30) continue;
    for (const g of life.goats) {
      assert.ok(pointInPolygon(g.x, g.y, isl.pts), 'goat on the island');
      assert.ok(dist(g.x, g.y, g.herd.x, g.herd.y) <= g.herd.r + 5, 'goat in its pasture');
    }
  }
  assert.ok(flew >= 3 && landed >= 3, `parrots flew ${flew} times and landed ${landed}`);
  assert.ok(life.goats.some((g) => dist(g.x, g.y, g.tx, g.ty) > 0 || g.state === 'graze'));
  const all = islandAnimals(lf, game);
  assert.ok(all.goats.length >= life.goats.length);
});
