import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { awardMedals } from '../web/src/data/medals.js';
import { rewardFor } from '../web/src/data/locker.js';
import { dailyCandidate } from '../web/src/data/daily.js';
import { loadSave, recordResult } from '../web/src/platform/save.js';
import { createBoat, stepBoat, boatSpeed } from '../web/src/physics/boat.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { buildLevel } from '../web/src/world/level.js';
import { isClear } from '../web/src/world/collision.js';
import { createNavGrid, findPath } from '../web/src/world/autopilot.js';
import { HAUL_R, HAUL_SPEED, HAUL_TIME, SIGHT_R, DRIFTERS } from '../web/src/world/castaways.js';

const idle = () => ({ steer: 0, trimTarget: 0.5, autoTrim: true, boost: false });
const voyage = (id) => LEVELS.find((l) => l.id === id);
// Hold the boat still beside a castaway for a while, as if hove to.
const sitBeside = (g, c, seconds, speed = 0) => {
  const evs = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    Object.assign(g.boat, { x: c.x + 12, y: c.y, vx: speed, vy: 0 });
    stepGame(g, idle(), 1 / 60);
    evs.push(...drainEvents(g));
  }
  return evs;
};

test('every voyage after the first has a castaway adrift in open, reachable water', () => {
  assert.ok(!LEVELS[0].castaways, 'the first voyage is about learning the wind');
  const names = new Set();
  for (const def of LEVELS.slice(1)) {
    assert.equal(def.castaways.length, 1, def.id);
    const [c] = def.castaways;
    assert.ok(c.name && c.line && !names.has(c.name), `${def.id} castaway is someone new`);
    names.add(c.name);
    const g = createGame(def);
    assert.ok(isClear(g.level, c.x, c.y, 40), `${def.id}: ${c.name} is clear of rocks and shore`);
    const grid = createNavGrid(g.level, g.wind, 14);
    assert.ok(findPath(grid, g.level.start.x, g.level.start.y, c.x, c.y, g.level.start.heading).length >= 2, `${def.id}: a way out to ${c.name}`);
  }
});

test('a castaway shouts once when you come in sight', () => {
  const g = createGame(voyage('beam-reach'));
  const [c] = g.castaways;
  Object.assign(g.boat, { x: c.x - SIGHT_R + 20, y: c.y, vx: 0, vy: 0 });
  stepGame(g, idle(), 1 / 60);
  stepGame(g, idle(), 1 / 60);
  const seen = drainEvents(g).filter((e) => e.type === 'castaway');
  assert.deepEqual(seen.map((e) => e.phase), ['sighted']);
  assert.equal(seen[0].name, 'Old Tomas');
});

test('sweep past too fast and they cannot grab the line', () => {
  const g = createGame(voyage('beam-reach'));
  const [c] = g.castaways;
  c.seen = true;
  const evs = sitBeside(g, c, HAUL_TIME * 2, HAUL_SPEED + 3);
  assert.equal(c.state, 'adrift');
  assert.equal(c.haul, 0);
  assert.deepEqual(evs.filter((e) => e.type === 'castaway').map((e) => e.phase), ['fast'], 'one shout per pass');
  // Out of reach and back again: a fresh pass, a fresh shout.
  Object.assign(g.boat, { x: c.x + HAUL_R + 100, y: c.y });
  stepGame(g, idle(), 1 / 60);
  const again = sitBeside(g, c, 0.2, HAUL_SPEED + 3);
  assert.ok(again.some((e) => e.type === 'castaway' && e.phase === 'fast'));
});

test('stop alongside and they are hauled aboard, then ride home with you', () => {
  const g = createGame(voyage('beam-reach'));
  const [c] = g.castaways;
  c.seen = true;
  const early = sitBeside(g, c, HAUL_TIME * 0.6);
  assert.ok(c.haul > 0 && c.state === 'adrift', 'still hauling');
  assert.ok(!early.some((e) => e.type === 'castaway'));
  // Drift off and the line slips back.
  Object.assign(g.boat, { x: c.x + HAUL_R + 60, y: c.y, vx: 0, vy: 0 });
  for (let i = 0; i < 60; i++) stepGame(g, idle(), 1 / 60);
  assert.equal(c.haul, 0);
  const evs = sitBeside(g, c, HAUL_TIME + 0.1);
  const aboard = evs.find((e) => e.type === 'castaway' && e.phase === 'aboard');
  assert.ok(aboard && aboard.line === c.line);
  assert.equal(c.state, 'aboard');
  assert.equal(g.boat.crew, 1);
  // Home at B: the result names who was brought ashore.
  const f = g.level.finish;
  g.nextCheckpoint = g.level.checkpoints.length;
  Object.assign(g.boat, { x: f.x, y: f.y });
  stepGame(g, idle(), 1 / 60);
  assert.equal(g.status, 'finished');
  assert.deepEqual(g.result.rescued, [{ name: 'Old Tomas', line: c.line }]);
  assert.equal(g.result.castaways, 1);
});

test('no hauling while capsized', () => {
  const g = createGame(voyage('into-the-wind'));
  const [c] = g.castaways;
  g.status = 'capsized';
  g.statusTimer = 10;
  sitBeside(g, c, HAUL_TIME + 0.5);
  assert.equal(c.state, 'adrift');
});

test('crew on the rail: she heels less and sails a touch slower', () => {
  const sail = (crew) => {
    const b = createBoat(0, 0, 0);
    b.crew = crew;
    const env = { wx: 0, wy: 14, cx: 0, cy: 0 }; // wind on the beam
    for (let i = 0; i < 120 * 20; i++) stepBoat(b, idle(), env, 1 / 120);
    return { heel: Math.abs(b.heel), speed: boatSpeed(b) };
  };
  const alone = sail(0);
  const two = sail(2);
  assert.ok(two.heel < alone.heel * 0.85, `heel ${two.heel} vs ${alone.heel}`);
  assert.ok(two.speed < alone.speed && two.speed > alone.speed * 0.9, `speed ${two.speed} vs ${alone.speed}`);
});

test('a rescue is saved, and three home wins Lifeline', () => {
  const save = loadSave();
  const run = (rescued) => ({ time: 100, stars: 2, pearls: 0, pearlsTotal: 3, hull: 90, capsizes: 0, boat: 'sloop', castaways: 1, rescued });
  const tomas = { name: 'Old Tomas', line: 'Gulls.' };
  const first = recordResult(save, 'beam-reach', run([]));
  assert.deepEqual(first.crew, []);
  assert.equal(save.levels['beam-reach'].rescued, 0);
  const second = recordResult(save, 'beam-reach', run([tomas]));
  assert.deepEqual(second.crew, ['Old Tomas']);
  assert.equal(save.levels['beam-reach'].rescued, 1);
  // Sailing it again without stopping keeps the rescue on the record.
  recordResult(save, 'beam-reach', run([]));
  assert.equal(save.levels['beam-reach'].rescued, 1);
  assert.deepEqual(save.crew, [tomas]);
  assert.ok(!awardMedals(save, LEVELS).some((m) => m.id === 'lifeline'));
  recordResult(save, 'into-the-wind', run([{ name: 'Ines', line: 'Supper.' }]));
  const again = recordResult(save, 'beam-reach', run([tomas]));
  assert.deepEqual(again.crew, [], 'Tomas is already in the logbook');
  assert.equal(save.crew.length, 2);
  assert.equal(save.stats.rescued, 3);
  const medals = awardMedals(save, LEVELS).map((m) => m.id);
  assert.ok(medals.includes('lifeline') && !medals.includes('no-one-left-behind'));
  assert.equal(rewardFor('lifeline').label, 'Lifebuoy sail');
});

test('rescue everyone and No One Left Behind is yours', () => {
  const save = loadSave();
  for (const def of LEVELS) {
    const rescued = (def.castaways || []).map(({ name, line }) => ({ name, line }));
    recordResult(save, def.id, { time: 100, stars: 1, pearls: 0, pearlsTotal: 0, hull: 90, capsizes: 0, boat: 'sloop', castaways: rescued.length, rescued });
  }
  assert.equal(save.crew.length, LEVELS.length - 1);
  assert.ok(awardMedals(save, LEVELS).some((m) => m.id === 'no-one-left-behind'));
  assert.equal(rewardFor('no-one-left-behind').label, 'Rescue Orange hull paint');
});

test('a daily voyage has someone adrift too', () => {
  let found = 0;
  for (let day = 1; day <= 12; day++) {
    const def = dailyCandidate(`2026-11-${String(day).padStart(2, '0')}`, 0);
    if (!def) continue;
    found += 1;
    assert.equal(def.castaways.length, 1);
    const [c] = def.castaways;
    assert.ok(DRIFTERS.some((d) => d.name === c.name && d.line === c.line));
    assert.ok(isClear(buildLevel(def), c.x, c.y, 40));
  }
  assert.ok(found >= 6, `${found} charted days`);
});
