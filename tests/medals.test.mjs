import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { MEDALS, awardMedals, isEarned, medalsEarned, medalProgress } from '../web/src/data/medals.js';
import { ICONS } from '../web/src/ui/icons.js';
import { BOAT_ORDER, BOAT_TYPES } from '../web/src/physics/boat.js';
import { loadSave, recordResult, markDaily } from '../web/src/platform/save.js';
import { createGame, stepGame } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';

const DT = 1 / 60;
const byId = (id) => LEVELS.find((l) => l.id === id);

function result(def, extra = {}) {
  const pearlsTotal = def.pickups.filter((p) => p.kind === 'pearl').length;
  return { time: def.par.gold + 30, stars: 1, pearls: 0, pearlsTotal, hull: 80, capsizes: 0, hits: {}, jars: 1, boat: 'sloop', distance: 1000, ...extra };
}

// Record a voyage and hand out its medals, the way the game does.
function sail(save, def, extra = {}) {
  const r = result(def, extra);
  const improved = recordResult(save, def.id, r);
  return awardMedals(save, LEVELS, { def, result: r, improved }).map((m) => m.id);
}

test('every medal has a unique id, a name, a goal and an icon', () => {
  const ids = new Set();
  for (const m of MEDALS) {
    assert.ok(m.id && !ids.has(m.id), m.id);
    ids.add(m.id);
    assert.ok(m.name && m.text, m.id);
    assert.ok(ICONS.includes(m.icon), `${m.id} icon ${m.icon}`);
    assert.ok(m.run || m.progress, `${m.id} can be earned`);
  }
});

test('a new save has no medals, and the first voyage earns Cast Off once', () => {
  const save = loadSave();
  assert.deepEqual(awardMedals(save, LEVELS), []);
  assert.equal(medalsEarned(save), 0);
  assert.ok(sail(save, LEVELS[0]).includes('cast-off'));
  assert.ok(isEarned(save, 'cast-off'));
  assert.ok(!sail(save, LEVELS[0]).includes('cast-off'), 'not handed out twice');
});

test('single-voyage medals check what happened on that voyage', () => {
  const save = loadSave();
  const kraken = LEVELS.find((l) => (l.krakens || []).length);
  assert.ok(!sail(save, kraken, { hits: { kraken: 1 } }).includes('kraken-dodger'));
  assert.ok(sail(save, kraken, { hits: { rock: 2 } }).includes('kraken-dodger'));

  const ice = LEVELS.find((l) => (l.floes || []).length);
  assert.ok(!sail(save, ice, { hits: { ice: 1 } }).includes('ice-pilot'));
  assert.ok(sail(save, ice).includes('ice-pilot'));

  const storm = LEVELS.find((l) => (l.storms || []).length);
  assert.ok(!sail(save, storm, { capsizes: 1 }).includes('storm-rider'));
  assert.ok(sail(save, storm).includes('storm-rider'));

  const coral = LEVELS.find((l) => (l.rocks || []).some((r) => r.material === 'coral'));
  assert.ok(!sail(save, coral, { hull: 99.5 }).includes('not-a-scratch'));
  assert.ok(sail(save, coral, { hull: 100 }).includes('not-a-scratch'));

  // None of them count on a voyage without the hazard.
  const plain = loadSave();
  const got = sail(plain, LEVELS[0], { hull: 100, stars: 3, jars: 0 });
  for (const id of ['kraken-dodger', 'ice-pilot', 'storm-rider', 'not-a-scratch', 'pure-wind']) assert.ok(!got.includes(id), id);
});

test('three stars without a gust jar earns Pure Wind; with one it does not', () => {
  const save = loadSave();
  const def = LEVELS[1];
  let got = sail(save, def, { time: def.par.gold - 1, stars: 3, jars: 2 });
  assert.ok(got.includes('gold-wind') && !got.includes('pure-wind'));
  got = sail(save, def, { time: def.par.gold - 2, stars: 3, jars: 0 });
  assert.ok(got.includes('pure-wind'));
});

test('Personal Best needs a best time beaten by five seconds', () => {
  const save = loadSave();
  const def = LEVELS[2];
  assert.ok(!sail(save, def, { time: 200 }).includes('personal-best'), 'a first run has nothing to beat');
  assert.ok(!sail(save, def, { time: 196 }).includes('personal-best'));
  assert.ok(sail(save, def, { time: 190 }).includes('personal-best'));
});

test('campaign medals count up and land on the last voyage', () => {
  const save = loadSave();
  const nav = MEDALS.find((m) => m.id === 'navigator');
  for (const [i, def] of LEVELS.entries()) {
    assert.deepEqual(medalProgress(nav, save, LEVELS), [i, LEVELS.length]);
    const got = sail(save, def, { stars: 3, time: def.par.gold - 1 });
    assert.equal(got.includes('navigator'), i === LEVELS.length - 1);
    assert.equal(got.includes('admiral'), i === LEVELS.length - 1);
  }
  assert.ok(isEarned(save, 'shipwright'), 'every boat unlocked with every star');
});

test('pearls, bottles, boats, days and distance medals', () => {
  const save = loadSave();
  for (const def of LEVELS) {
    const notes = def.pickups.filter((p) => p.kind === 'bottle').map((p) => p.note);
    const r = result(def, { pearls: def.pickups.filter((p) => p.kind === 'pearl').length });
    const improved = recordResult(save, def.id, r, notes);
    awardMedals(save, LEVELS, { def, result: r, improved });
  }
  assert.ok(isEarned(save, 'pearl-diver') && isEarned(save, 'treasure-hunter') && isEarned(save, 'beachcomber'));
  assert.ok(!isEarned(save, 'fleet-captain'));
  for (const id of BOAT_ORDER) sail(save, LEVELS[0], { boat: id });
  assert.ok(isEarned(save, 'fleet-captain'));

  assert.ok(!isEarned(save, 'long-haul'));
  const haul = MEDALS.find((m) => m.id === 'long-haul');
  const [km, need] = medalProgress(haul, save, LEVELS);
  assert.ok(km > 0 && km < need, `${km} km`);
  sail(save, LEVELS[0], { distance: 80000 });
  assert.ok(isEarned(save, 'long-haul'));

  assert.ok(!isEarned(save, 'day-sailor'));
  for (let d = 1; d <= 7; d++) {
    const key = `2026-03-0${d}`;
    markDaily(save, key);
    recordResult(save, `daily-${key}`, result(LEVELS[0]), [], 'daily');
    const got = awardMedals(save, LEVELS).map((m) => m.id);
    assert.equal(got.includes('week-at-sea'), d === 7, `day ${d}`);
  }
  assert.ok(isEarned(save, 'day-sailor'));
});

test('medals already earned in an older save are handed out on load', () => {
  const save = loadSave();
  for (const def of LEVELS.slice(0, 3)) recordResult(save, def.id, result(def, { stars: 3 }));
  delete save.medals;
  const reloaded = { ...loadSave(), levels: save.levels, stats: save.stats };
  const got = awardMedals(reloaded, LEVELS).map((m) => m.id);
  assert.ok(got.includes('cast-off') && got.includes('gold-wind'));
  assert.ok(!got.includes('navigator'));
});

test('a voyage result carries the boat, the gust jars used and the knocks taken', () => {
  const def = byId('coral-maze') || LEVELS[3];
  const game = createGame(def, { boat: 'junk', seed: 3 });
  const pilot = createAutopilot(game);
  while (game.status !== 'finished' && game.time < 400) stepGame(game, autopilotInput(pilot, game, DT), DT);
  const r = game.result;
  assert.equal(r.boat, BOAT_TYPES.junk.id);
  assert.equal(typeof r.jars, 'number');
  assert.equal(typeof r.hits, 'object');
  const knocks = Object.values(r.hits).reduce((a, n) => a + n, 0);
  assert.ok(knocks >= r.collisions, `${knocks} knocks for ${r.collisions} collisions`);
});
