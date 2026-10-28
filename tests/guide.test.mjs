import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { GUIDE } from '../web/src/world/guide.js';
import { ESCORT_TIME } from '../web/src/world/wildlife.js';
import { DEG, angleDiff } from '../web/src/core/math.js';

const HELM = { steer: 0, trimTarget: 0.5, autoTrim: true, boost: false };
const byId = (id) => LEVELS.find((l) => l.id === id);

// Bow to the wind and dead in the water.
function inIrons(def, options = { guide: true }) {
  const game = createGame(def, options);
  game.boat.heading = game.wind.angle + Math.PI;
  game.boat.vx = game.boat.vy = 0;
  return game;
}

// Sail on, holding the boat to a heading if one is given; returns the events.
function sail(game, seconds, heading = null) {
  const seen = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    if (heading !== null) {
      game.boat.heading = heading;
      game.boat.yawRate = 0;
    }
    stepGame(game, HELM, 1 / 60);
    for (const e of drainEvents(game)) seen.push({ ...e, t: game.clock });
  }
  return seen;
}

const guidePod = (game) => game.life.pods.find((p) => p.guide);

test('stuck head to wind, dolphins come and swim off across it', () => {
  for (const id of ['lost-oar', 'into-the-wind', 'storm-front']) {
    const game = inIrons(byId(id));
    const windFrom = game.wind.angle + Math.PI;
    const call = sail(game, 6).find((e) => e.type === 'guide');
    assert.ok(call, `${id}: no dolphins`);
    assert.equal(call.reason, 'irons');
    const pod = guidePod(game);
    const off = Math.abs(angleDiff(windFrom, pod.way));
    assert.ok(off > 45 * DEG, `${id}: the way is ${(off / DEG).toFixed(0)}° off the wind, too close to it`);
    // They surface on the side to turn to.
    const side = Math.sign(angleDiff(game.boat.heading, pod.way));
    const across = angleDiff(game.boat.heading, Math.atan2(call.y - game.boat.y, call.x - game.boat.x));
    assert.equal(Math.sign(across), side, `${id}: the dolphins came up on the wrong side`);
  }
});

test('no dolphins with hints off, or for a sailor stopped by a castaway on purpose', () => {
  assert.ok(!sail(inIrons(byId('lost-oar'), {}), 8).some((e) => e.type === 'guide'), 'hints are off unless asked for');
  const def = byId('beam-reach');
  const game = inIrons(def);
  const c = def.castaways[0];
  Object.assign(game.boat, { x: c.x - 60, y: c.y });
  game.boat.heading = game.wind.angle + Math.PI;
  assert.ok(!sail(game, 6).some((e) => e.type === 'guide'));
});

test('follow them up to speed and they ride the bow, then swim off for good', () => {
  const game = inIrons(byId('lost-oar'));
  sail(game, 6);
  const pod = guidePod(game);
  const seen = sail(game, 6, pod.way);
  const join = seen.find((e) => e.type === 'dolphins' && e.phase === 'join');
  assert.ok(join && join.guide, 'they joined');
  assert.equal(pod.state, 'escort');
  assert.ok(game.boat.escort > 0);
  sail(game, ESCORT_TIME + 8, pod.way);
  assert.ok(!game.life.pods.includes(pod), 'gone once the ride is over');
});

test('ignored, they give up, and come again only after a while', () => {
  const game = inIrons(byId('lost-oar'));
  const first = sail(game, 6).find((e) => e.type === 'guide');
  const pod = guidePod(game);
  // Stay put, bow to the wind, long past when they give up.
  const seen = [];
  for (let t = 0; t < GUIDE.cooldown + 4; t += 1 / 60) {
    game.boat.heading = game.wind.angle + Math.PI;
    game.boat.vx = game.boat.vy = 0;
    stepGame(game, HELM, 1 / 60);
    seen.push(...drainEvents(game).map((e) => ({ ...e, t: game.clock })));
  }
  assert.ok(!game.life.pods.includes(pod), 'the first pod has gone');
  const next = seen.find((e) => e.type === 'guide');
  assert.ok(next && next.t - first.t >= GUIDE.cooldown - 0.1, `again after ${next && (next.t - first.t).toFixed(1)}s`);
});

// Head away from the harbor, across the wind.
function wrongWay(game, def) {
  const away = Math.atan2(game.boat.y - def.finish.y, game.boat.x - def.finish.x);
  const windFrom = game.wind.angle + Math.PI;
  return Math.abs(angleDiff(windFrom, away)) < 60 * DEG ? windFrom + Math.sign(angleDiff(windFrom, away)) * 90 * DEG : away;
}

test('sailing off away from B, they show the way back', () => {
  const def = byId('lost-oar');
  const game = createGame(def, { guide: true });
  const heading = wrongWay(game, def);
  game.boat.heading = heading;
  const call = sail(game, 14, heading).find((e) => e.type === 'guide');
  assert.ok(call, 'no dolphins');
  assert.equal(call.reason, 'astray');
  const pod = guidePod(game);
  assert.ok(Math.abs(angleDiff(heading, pod.way)) > 60 * DEG, 'they turn her round');
});

test('sailing off to fetch a castaway is not being lost', () => {
  const def = byId('lost-oar');
  const game = createGame(def, { guide: true });
  const heading = wrongWay(game, def);
  game.boat.heading = heading;
  const at = { x: game.boat.x + Math.cos(heading) * 900, y: game.boat.y + Math.sin(heading) * 900 };
  game.castaways.push({ ...at, name: 'Test', line: '', id: 0, state: 'adrift', haul: 0, seen: false, fast: false });
  assert.ok(!sail(game, 14, heading).some((e) => e.type === 'guide'));
});
