import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { BOAT_TYPES, BOAT_ORDER } from '../web/src/physics/boat.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { createRecorder, recordGhost, finishGhost } from '../web/src/world/ghost.js';
import { loadSave, recordResult, selectedBoat, unlockedBoats, isBoatUnlocked, resetProgress } from '../web/src/platform/save.js';

const DT = 1 / 60;

function sail(def, boat, limit = 400) {
  const game = createGame(def, { boat });
  const pilot = createAutopilot(game);
  while (game.status !== 'finished' && game.time < limit) {
    stepGame(game, autopilotInput(pilot, game, DT), DT);
    drainEvents(game);
  }
  return game;
}

test('every boat in the shipyard is complete and they unlock in order', () => {
  assert.deepEqual(Object.keys(BOAT_TYPES).sort(), [...BOAT_ORDER].sort());
  let last = -1;
  for (const id of BOAT_ORDER) {
    const t = BOAT_TYPES[id];
    assert.equal(t.id, id);
    for (const k of ['name', 'tag', 'blurb', 'look', 'stats']) assert.ok(t[k], `${id}.${k}`);
    for (const k of ['hull', 'hullDark', 'deck', 'sail', 'sailShade']) assert.match(t.look[k], /^#[0-9a-f]{6}$/i, `${id}.look.${k}`);
    for (const v of Object.values(t.stats)) assert.ok(v >= 1 && v <= 5);
    assert.ok(t.unlock > last, `${id} unlocks after the one before`);
    last = t.unlock;
  }
  assert.equal(BOAT_TYPES[BOAT_ORDER[0]].unlock, 0, 'the first boat is free');
});

test('a tougher hull takes less damage from the same rocks', () => {
  // On a beam reach straight into a wall of rocks.
  const def = {
    ...LEVELS[0],
    id: 'rock-test',
    start: { x: 140, y: 400, heading: 90 },
    wind: { from: 0, speed: 16, gust: 0, shift: 0, period: 50 },
    islands: [],
    rocks: Array.from({ length: 9 }, (_, i) => ({ x: 330, y: 320 + i * 20, r: 12 })),
    pickups: [],
    tips: [],
  };
  const loss = (boat) => {
    const g = createGame(def, { boat });
    for (let i = 0; i < 60 * 12; i++) stepGame(g, { steer: 0, trimTarget: 1, autoTrim: true, boost: false }, DT);
    return 100 - g.hull;
  };
  const skiff = loss('skiff');
  const junk = loss('junk');
  assert.ok(skiff > 0, 'the skiff hit the rocks');
  assert.ok(junk < skiff * 0.6, `junk ${junk.toFixed(1)} vs skiff ${skiff.toFixed(1)}`);
});

for (const id of BOAT_ORDER) {
  test(`the ${BOAT_TYPES[id].name} can sail the first voyages within the silver time`, () => {
    for (const def of LEVELS.slice(0, 4)) {
      const g = sail(def, id);
      assert.equal(g.status, 'finished', `${def.id}: ${g.status} at ${g.time.toFixed(1)}s`);
      assert.ok(g.time < def.par.silver * 1.15, `${def.id}: ${g.time.toFixed(1)}s, silver ${def.par.silver}s`);
      assert.equal(g.capsizes, 0, `${def.id}: capsized`);
    }
  });
}

test('boats unlock with campaign stars and the choice falls back to the sloop', () => {
  const save = loadSave();
  assert.deepEqual(unlockedBoats(save), ['sloop']);
  save.settings.boat = 'junk';
  assert.equal(selectedBoat(save), 'sloop', 'a locked boat is never sailed');
  const r = { time: 60, stars: 3, pearls: 0, pearlsTotal: 5 };
  for (const def of LEVELS.slice(0, 4)) recordResult(save, def.id, r);
  assert.ok(isBoatUnlocked(save, 'skiff') && isBoatUnlocked(save, 'proa'));
  assert.equal(isBoatUnlocked(save, 'junk'), false);
  save.settings.boat = 'proa';
  assert.equal(selectedBoat(save), 'proa');
  assert.equal(isBoatUnlocked(save, 'galleon'), false);
  resetProgress(save);
  assert.equal(selectedBoat(save), 'sloop');
});

test('running dead downwind does not gybe back and forth', () => {
  const def = { ...LEVELS[0], start: { x: 140, y: 400, heading: 90 }, wind: { from: 270, speed: 16, gust: 0, shift: 0, period: 50 }, islands: [], rocks: [], pickups: [], tips: [] };
  const g = createGame(def);
  let gybes = 0;
  for (let i = 0; i < 60 * 10; i++) {
    stepGame(g, { steer: 0, trimTarget: 1, autoTrim: true, boost: false }, DT);
    gybes += drainEvents(g).filter((e) => e.type === 'gybe').length;
  }
  assert.ok(gybes <= 1, `${gybes} gybes`);
});

test('a ghost remembers which boat sailed it', () => {
  const g = createGame(LEVELS[0], { boat: 'proa' });
  const rec = createRecorder(g);
  for (let i = 0; i < 120; i++) {
    stepGame(g, { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false }, DT);
    recordGhost(rec, g);
  }
  assert.equal(finishGhost(rec, g.time).boat, 'proa');
});
