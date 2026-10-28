import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { isClear } from '../web/src/world/collision.js';
import { updatePirates, pirateSpeed, PIRATE } from '../web/src/world/pirates.js';
import { DEG } from '../web/src/core/math.js';
import { awardMedals } from '../web/src/data/medals.js';
import { loadSave, recordResult } from '../web/src/platform/save.js';

const DT = 1 / 60;
const def = LEVELS.find((l) => l.id === 'pirate-waters');

// Steps only the pirates, with the boat moved by hand.
function tick(game, seconds, place = () => {}) {
  for (let t = 0; t < seconds; t += DT) {
    game.time += DT;
    game.clock += DT;
    place(game);
    updatePirates(game, DT);
  }
  return drainEvents(game);
}

// A pirate game with the brig already on your tail.
function chase(ship, boat) {
  const game = createGame(def, { seed: 1 });
  const s = game.pirates.ships[0];
  Object.assign(s, { state: 'chase', heading: Math.PI / 2, reload: 99 }, ship);
  Object.assign(game.boat, { vx: 0, vy: 0 }, boat);
  return { game, s };
}

const gap = (game, s) => Math.hypot(s.x - game.boat.x, s.y - game.boat.y);
const sail = (g) => {
  g.boat.x += g.boat.vx * DT;
  g.boat.y += g.boat.vy * DT;
};

test('square sails: fast downwind, slow across the wind, nothing into it', () => {
  assert.equal(pirateSpeed(0), 0);
  assert.equal(pirateSpeed(60 * DEG), 0);
  assert.ok(pirateSpeed(90 * DEG) < 0.85);
  assert.ok(pirateSpeed(180 * DEG) > 1.1);
});

test('the brig runs down a boat sailing downwind, but not one on a beam reach', () => {
  // Wind from the north. Downwind is south.
  const down = chase({ x: 250, y: 200, heading: Math.PI / 2, speed: 12 }, { x: 250, y: 400, vy: 8.5 });
  const d0 = gap(down.game, down.s);
  tick(down.game, 15, sail);
  assert.ok(gap(down.game, down.s) < d0 - 60, `downwind: ${d0.toFixed(0)} -> ${gap(down.game, down.s).toFixed(0)}`);

  const beam = chase({ x: 150, y: 950, heading: 0, speed: 10 }, { x: 330, y: 950, vx: 16 });
  const b0 = gap(beam.game, beam.s);
  tick(beam.game, 15, sail);
  assert.ok(gap(beam.game, beam.s) > b0 + 40, `beam reach: ${b0.toFixed(0)} -> ${gap(beam.game, beam.s).toFixed(0)}`);
});

test('the brig cannot sail up to a boat waiting upwind of it', () => {
  const { game, s } = chase({ x: 300, y: 520, heading: -Math.PI / 2 }, { x: 300, y: 290 });
  const d0 = gap(game, s);
  tick(game, 20);
  assert.ok(gap(game, s) > d0 - 45, `${d0.toFixed(0)} -> ${gap(game, s).toFixed(0)}`);
});

test('the reef gap lets the boat through but not the brig', () => {
  const game = createGame(def, { seed: 1 });
  assert.ok(isClear(game.level, 1504, 802, 13), 'room for the boat');
  assert.ok(!isClear(game.level, 1504, 802, PIRATE.draught), 'too tight for the brig');
  for (const p of def.pirates) assert.ok(isClear(game.level, p.x, p.y, PIRATE.draught + 10), 'the cove is open water');

  // A boat on the far side of the reef: the brig has no way through and gives up.
  const far = chase({ x: 1380, y: 802, heading: 0 }, { x: 1600, y: 802 });
  const events = tick(far.game, 0.1);
  assert.ok(events.some((e) => e.type === 'pirate' && e.phase === 'giveup' && e.reason === 'reef'));
  assert.equal(far.s.state, 'home');

  // Even sent straight at the gap, it can't squeeze through.
  const forced = chase({ x: 1440, y: 802, heading: 0, state: 'home', home: { x: 1620, y: 802 } }, { x: 300, y: 300 });
  tick(forced.game, 25);
  assert.ok(forced.s.x < 1495, `brig reached x=${forced.s.x.toFixed(0)}`);
});

test('cannonballs land where they are marked, and only a hit dents the hull', () => {
  const { game, s } = chase({ x: 700, y: 650, heading: 0, reload: 0 }, { x: 700, y: 760 });
  // The boat sits on the brig's beam: it fires a broadside.
  let events = tick(game, 0.1);
  assert.ok(events.some((e) => e.type === 'cannon' && e.phase === 'fire' && e.side !== 0));
  const ball = game.pirates.balls[0];
  // Dodge: move off the marked spot.
  events = tick(game, 2, (g) => {
    g.boat.x = ball.x1 + 40;
    g.boat.y = ball.y1;
    s.reload = 99;
  });
  assert.ok(events.some((e) => e.type === 'cannon' && e.phase === 'splash'));
  assert.equal(game.hull, 100);
  // Sit on the mark: hit.
  Object.assign(s, { x: 700, y: 650, heading: 0, reload: 0 });
  Object.assign(game.boat, { x: 700, y: 760 });
  tick(game, 0.1);
  const next = game.pirates.balls[0];
  events = tick(game, 2, (g) => {
    g.boat.x = next.x1;
    g.boat.y = next.y1;
    s.reload = 99;
  });
  assert.ok(events.some((e) => e.type === 'cannon' && e.phase === 'hit'));
  assert.equal(game.hits.cannon, 1);
  assert.ok(game.hull < 100);
});

test('the bow chaser fires at a boat dead ahead', () => {
  const { game } = chase({ x: 700, y: 650, heading: 0, reload: 0 }, { x: 820, y: 650 });
  const events = tick(game, 0.1);
  assert.ok(events.some((e) => e.type === 'cannon' && e.phase === 'fire' && e.side === 0));
});

test('getting rammed hurts and shoves the boat clear', () => {
  const { game, s } = chase({ x: 700, y: 650, heading: 0, speed: 12 }, { x: 714, y: 652 });
  const events = tick(game, 0.2);
  assert.ok(events.some((e) => e.type === 'collide' && e.material === 'wood'));
  assert.equal(game.hits.pirate, 1);
  assert.ok(game.hull < 100);
  assert.ok(gap(game, s) > PIRATE.beam / 2, 'pushed off the hull');
});

test('the pirates give up when you outrun them or reach the harbor', () => {
  const run = chase({ x: 300, y: 300 }, { x: 900, y: 700 });
  let events = tick(run.game, 5);
  assert.ok(events.some((e) => e.type === 'pirate' && e.reason === 'outran'));
  assert.equal(run.s.state, 'home');

  const home = chase({ x: 1700, y: 900 }, { x: 1900, y: 700 });
  events = tick(home.game, 0.1);
  assert.ok(events.some((e) => e.type === 'pirate' && e.reason === 'harbor'));
});

test('a lurking brig spots a boat that comes close', () => {
  const game = createGame(def, { seed: 1 });
  const s = game.pirates.ships[0];
  let events = tick(game, 1, (g) => Object.assign(g.boat, { x: s.x, y: s.y + s.spot + 40 }));
  assert.equal(s.state, 'lurk');
  events = tick(game, 0.1, (g) => Object.assign(g.boat, { x: s.x, y: s.y + s.spot - 40 }));
  assert.equal(s.state, 'chase');
  assert.ok(events.some((e) => e.type === 'pirate' && e.phase === 'spotted'));
  assert.equal(game.chases, 1);
});

test('the pirate chase is the same for the same seed', () => {
  const run = () => {
    const game = createGame(def, { seed: 5 });
    const ap = createAutopilot(game);
    for (let i = 0; i < 60 * 90; i++) stepGame(game, autopilotInput(ap, game, DT), DT);
    const s = game.pirates.ships[0];
    return JSON.stringify([s.state, s.x.toFixed(3), s.y.toFixed(3), s.shots, game.hull]);
  };
  assert.equal(run(), run());
});

test('Clean Getaway medal', () => {
  const result = (extra) => ({ time: def.par.gold + 30, stars: 1, pearls: 0, pearlsTotal: 1, hull: 80, capsizes: 0, hits: {}, jars: 1, boat: 'sloop', distance: 1000, ...extra });
  const sail = (save, extra) => {
    const r = result(extra);
    const improved = recordResult(save, def.id, r);
    return awardMedals(save, LEVELS, { def, result: r, improved }).map((m) => m.id);
  };
  const save = loadSave();
  assert.ok(!sail(save, { chases: 1, hits: { cannon: 1 } }).includes('clean-getaway'));
  assert.ok(!sail(save, { chases: 0 }).includes('clean-getaway'));
  assert.ok(sail(save, { chases: 1 }).includes('clean-getaway'));
});
