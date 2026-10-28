import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { awardMedals } from '../web/src/data/medals.js';
import { rewardFor } from '../web/src/data/locker.js';
import { angleDiff } from '../web/src/core/math.js';
import { toMeters, formatDistance } from '../web/src/physics/sailing.js';
import { loadSave, recordSeaRun } from '../web/src/platform/save.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { courseGoal } from '../web/src/world/level.js';
import { createAutopilot, autopilotInput, createNavGrid, findPath } from '../web/src/world/autopilot.js';
import { openSeaDef, generosity, updateOpenSea, STRETCH, OPEN_SEA } from '../web/src/world/opensea.js';

const idle = () => ({ steer: 0, trimTarget: 0.5, autoTrim: true, boost: false });
const DEG = Math.PI / 180;

test('every Open Sea run is charted from its seed', () => {
  const a = openSeaDef(7);
  assert.deepEqual(openSeaDef(7), a);
  assert.notDeepEqual(openSeaDef(8).wind, a.wind);
  assert.equal(a.id, OPEN_SEA);
  assert.ok(a.endless);
  const game = (seed) => {
    const g = createGame(openSeaDef(seed));
    return [g.sea.clock, g.level.checkpoints.map((c) => [c.x, c.y]), g.level.islands.length, g.level.pickups.map((p) => [p.x, p.y])];
  };
  assert.deepEqual(game(7), game(7));
});

test('the wind wanders but never settles dead on the nose', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { wind } = openSeaDef(seed);
    assert.ok(wind.events.length > 30);
    for (const e of wind.events) {
      const off = Math.abs(angleDiff(90 * DEG, e.from * DEG)) / DEG;
      assert.ok(off > 28 - 1e-9, `seed ${seed}: wind from ${e.from}`);
      assert.ok(e.speed >= 12 && e.speed <= 20);
    }
  }
});

test('the run starts with gates charted ahead and a clock to reach the first', () => {
  const g = createGame(openSeaDef(3));
  const { level, sea } = g;
  assert.ok(sea.clock > 20 && sea.clock < 120, `clock ${sea.clock}`);
  assert.ok(level.checkpoints.length >= 3);
  assert.ok(sea.charted * STRETCH >= g.boat.x + 2000);
  let x = g.boat.x;
  for (const c of level.checkpoints) {
    assert.ok(c.gate && c.x > x, 'gates run east');
    assert.ok(c.y > 200 && c.y < level.height - 200);
    x = c.x;
  }
  assert.equal(courseGoal(g), level.checkpoints[0]);
  assert.equal(generosity(0), 1.4);
  assert.ok(generosity(30) === 0.5 && generosity(4) < generosity(3));
});

test('a gate puts time back on the clock and points on to the next', () => {
  const g = createGame(openSeaDef(3));
  const [gate, after] = g.level.checkpoints;
  const before = g.sea.clock;
  Object.assign(g.boat, { x: gate.x, y: gate.y });
  stepGame(g, idle(), 1 / 60);
  const hit = drainEvents(g).find((e) => e.type === 'checkpoint');
  assert.ok(hit && hit.bonus > 5, 'checkpoint event with a bonus');
  assert.equal(g.sea.gates, 1);
  assert.ok(Math.abs(g.sea.clock - (before + hit.bonus)) < 0.1);
  assert.equal(courseGoal(g), after);
});

test('sailing past a gate, or through a later one, counts it as missed', () => {
  const g = createGame(openSeaDef(5));
  const [first, second, third] = g.level.checkpoints;
  Object.assign(g.boat, { x: first.x + first.r + 160, y: first.y > 600 ? first.y - 300 : first.y + 300 });
  updateOpenSea(g, 1 / 60);
  assert.equal(g.sea.missed, 1);
  assert.ok(first.missed && !first.reached);
  assert.ok(drainEvents(g).some((e) => e.type === 'gate' && e.phase === 'missed'));
  assert.equal(courseGoal(g), second);

  Object.assign(g.boat, { x: third.x, y: third.y });
  stepGame(g, idle(), 1 / 60);
  assert.equal(g.sea.missed, 2, 'the second gate was skipped');
  assert.equal(g.sea.gates, 1);
  assert.ok(second.missed && third.reached);
});

test('the run ends when the clock runs out, scored by distance east', () => {
  const g = createGame(openSeaDef(2));
  for (let i = 0; i < 120; i++) stepGame(g, idle(), 1 / 60);
  drainEvents(g);
  g.sea.clock = 0.4;
  const ticks = [];
  for (let i = 0; i < 60 && g.status !== 'finished'; i++) {
    stepGame(g, idle(), 1 / 60);
    ticks.push(...drainEvents(g));
  }
  assert.equal(g.status, 'finished');
  const end = ticks.find((e) => e.type === 'finish');
  assert.ok(end && end.endless && end.reason === 'time');
  assert.equal(end.stars, 0);
  assert.ok(end.distance > 0 && end.distance === g.sea.best);
  assert.ok(ticks.some((e) => e.type === 'clock' && e.left === 1));
});

test('a hull that gives out ends the run instead of sending you back', () => {
  const g = createGame(openSeaDef(2));
  g.hull = 0;
  for (let i = 0; i < 60 * 4 && g.status !== 'finished'; i++) stepGame(g, idle(), 1 / 60);
  assert.equal(g.status, 'finished');
  assert.equal(g.result.reason, 'sunk');
});

test('the sea is charted ahead of the boat and forgotten behind it', () => {
  const g = createGame(openSeaDef(9));
  for (let x = g.boat.x; x < 12000; x += 250) {
    g.boat.x = x;
    updateOpenSea(g, 1 / 60);
  }
  drainEvents(g);
  const { level, sea, wind, life } = g;
  assert.ok(sea.charted * STRETCH >= g.boat.x + 2000);
  assert.ok(level.checkpoints.at(-1).x > g.boat.x + 1000);
  const cut = g.boat.x - 2000;
  assert.ok(level.islands.every((isl) => isl.bounds.maxX > cut));
  assert.ok(level.rocks.every((r) => r.x > cut));
  assert.ok(level.pickups.every((p) => p.x > cut));
  assert.ok(wind.shadows.every((s) => s.x + s.reach > cut));
  assert.ok(life.whales.every((w) => w.cx + w.rx > cut));
  assert.ok(level.islands.length < 20 && level.pickups.length < 40, 'the sea stays small');
  assert.ok(sea.missed > 10, 'every gate passed this way was missed');
  assert.ok(toMeters(sea.best) > 3000);
});

test('the autopilot makes headway through the gates', () => {
  const g = createGame(openSeaDef(4));
  const ap = createAutopilot(g);
  const dt = 1 / 30;
  for (let i = 0; i < 90 * 30 && g.status !== 'finished'; i++) {
    stepGame(g, autopilotInput(ap, g, dt), dt);
    drainEvents(g);
  }
  assert.ok(g.sea.gates >= 2, `gates ${g.sea.gates}`);
  assert.ok(g.sea.best > 900, `best ${g.sea.best}`);
  assert.ok(ap.grid.x0 > 0, 'the nav grid moved along with the boat');
});

test('a nav grid can cover a window of a long sea', () => {
  const g = createGame(openSeaDef(6));
  const grid = createNavGrid(g.level, g.wind, 14, { x0: 4010, x1: 5600 });
  assert.ok(grid.x0 <= 4010 && grid.x0 > 3900);
  assert.ok(grid.cols * 16 < 1700, 'only the window is gridded');
  const path = findPath(grid, 4100, 650, 5400, 400, Math.PI);
  assert.ok(path.length >= 2);
  for (const [x] of path) assert.ok(x >= grid.x0 - 1 && x <= 5600, `path point x ${x}`);
});

test('a run is saved as a record, and a long one wins Far Horizon', () => {
  const save = loadSave();
  const run = (km, gates) => ({ endless: true, distance: km * 1000 / toMeters(1), gates, sailed: km * 1100 / toMeters(1), capsizes: 1 });
  const first = recordSeaRun(save, run(0.8, 4));
  assert.deepEqual(first, { best: true, prevDistance: null, gates: true, first: true });
  assert.ok(!awardMedals(save, LEVELS).some((m) => m.id === 'far-horizon'));
  const worse = recordSeaRun(save, run(0.5, 6));
  assert.equal(worse.best, false);
  assert.equal(worse.gates, true);
  assert.ok(Math.abs(worse.prevDistance - run(0.8).distance) < 1e-6);
  assert.equal(save.openSea.runs, 2);
  assert.equal(save.openSea.gates, 6);
  assert.equal(save.stats.voyages, 2);
  assert.equal(save.stats.capsizes, 2);
  recordSeaRun(save, run(1.6, 9));
  assert.ok(awardMedals(save, LEVELS).some((m) => m.id === 'far-horizon'));
  assert.equal(rewardFor('far-horizon').label, 'Compass Rose sail');
  assert.equal(formatDistance(run(1.6).distance), '1.60 km');
  assert.equal(formatDistance(run(0.5).distance), '500 m');
});
