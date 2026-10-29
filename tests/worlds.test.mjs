import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS, CAMPAIGN, voyageDef, voyageLabel, getWorld } from '../web/src/data/worlds.js';
import { CHARTS } from '../web/src/data/charts.js';
import { MEDALS } from '../web/src/data/medals.js';
import { rumors } from '../web/src/data/rumors.js';
import { charterVoyage } from '../web/src/world/charter.js';
import { levelSignature } from '../web/src/world/ghost.js';
import { buildLevel } from '../web/src/world/level.js';
import { isClear } from '../web/src/world/collision.js';
import { createNavGrid, findPath, createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { THEMES, MAP_ISLAND, MAP_ROCK, MAP_FLOE } from '../web/src/render/themes.js';
import { loadSave } from '../web/src/platform/save.js';
import { fromBearing, wrapAngle } from '../web/src/core/math.js';

const FAR = WORLDS.filter((w) => w.id !== 'home');

test('campaign ids are unique and every far world has ten voyages', () => {
  const ids = CAMPAIGN.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const w of FAR) {
    assert.equal(w.voyages.length, 10, w.id);
    for (const k of ['name', 'blurb', 'accent', 'theme']) assert.ok(w[k], `${w.id}.${k}`);
    for (const v of w.voyages) for (const k of ['name', 'blurb', 'teaser']) assert.ok(v[k], `${v.id}.${k}`);
  }
});

test('every far world has its colours, map colours and a medal', () => {
  for (const w of FAR) {
    assert.ok(THEMES[w.theme], `${w.id} theme`);
    for (const [kind] of w.kinds) assert.ok(MAP_ISLAND[kind], `${w.id} island ${kind}`);
    for (const [kind] of w.rocks) assert.ok(MAP_ROCK[kind], `${w.id} rock ${kind}`);
    if (w.drifter) assert.ok(MAP_FLOE[w.drifter.look], `${w.id} drifter ${w.drifter.look}`);
    assert.ok(MEDALS.some((m) => m.id === `world-${w.id}`), `${w.id} medal`);
  }
});

test('voyage labels name the world past Home Waters', () => {
  assert.equal(voyageLabel(CAMPAIGN[0].id), 'Voyage 1');
  const w = FAR[0];
  assert.equal(voyageLabel(w.voyages[2].id), `${w.name} · 3`);
  assert.equal(getWorld('nowhere'), null);
});

test('a new sailor hears of the next world, not of its voyages', () => {
  const said = rumors(loadSave(), CAMPAIGN);
  assert.ok(said.some((s) => s.includes(FAR[0].name)));
  for (const w of FAR) for (const v of w.voyages) assert.ok(!said.some((s) => s.includes(v.teaser)), v.id);
});

for (const w of FAR) {
  w.voyages.forEach((spec, index) => {
    test(`${spec.id}: charted course still matches its chart`, () => {
      const chart = CHARTS[spec.id];
      assert.ok(chart, 'not charted: run node scripts/chart-worlds.mjs');
      assert.equal(levelSignature(charterVoyage(w, index, chart[0])), chart[3]);
      assert.ok(chart[1] < chart[2], 'gold beats silver');
    });

    test(`${spec.id}: marks sit in open water and a route runs from A to B`, () => {
      const def = voyageDef(spec.id);
      const level = buildLevel(def);
      const inside = (p) => p.x > 0 && p.y > 0 && p.x < level.width && p.y < level.height;
      assert.ok(inside(level.start) && isClear(level, level.start.x, level.start.y, 14), 'start');
      assert.ok(inside(level.finish) && isClear(level, level.finish.x, level.finish.y, 10), 'finish');
      for (const c of level.checkpoints) assert.ok(inside(c) && isClear(level, c.x, c.y, 10), `checkpoint ${c.x},${c.y}`);
      const grid = createNavGrid(level);
      const path = findPath(grid, level.start.x, level.start.y, level.finish.x, level.finish.y, wrapAngle(fromBearing(def.wind.from)));
      assert.ok(path && path.length > 1);
    });

    test(`${spec.id}: the autopilot sails home inside the two-star time`, () => {
      const def = voyageDef(spec.id);
      const game = createGame(def);
      const ap = createAutopilot(game);
      const dt = 1 / 30;
      while (game.status !== 'finished' && game.time < def.par.silver * 1.5) {
        stepGame(game, autopilotInput(ap, game, dt), dt);
        drainEvents(game);
      }
      assert.equal(game.status, 'finished', `stuck at ${game.boat.x.toFixed(0)},${game.boat.y.toFixed(0)} after ${game.time.toFixed(0)} s`);
      assert.ok(game.result.time <= def.par.silver, `${game.result.time.toFixed(1)} s vs silver ${def.par.silver}`);
      assert.ok(game.hull > 40, `hull ${game.hull.toFixed(0)}`);
    });
  });
}
