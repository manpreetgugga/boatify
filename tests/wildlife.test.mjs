import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { createBoat, stepBoat, boatSpeed } from '../web/src/physics/boat.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { isClear } from '../web/src/world/collision.js';
import { updateWildlife, JOIN_SPEED, WHALE } from '../web/src/world/wildlife.js';
import { awardMedals } from '../web/src/data/medals.js';
import { loadSave, recordResult } from '../web/src/platform/save.js';

const DT = 1 / 60;
const byId = (id) => LEVELS.find((l) => l.id === id);
const withLife = LEVELS.filter((l) => (l.dolphins || []).length || (l.whales || []).length);

// Steps only the sea life, with the boat placed by hand.
function tick(game, seconds, place = () => {}) {
  for (let t = 0; t < seconds; t += DT) {
    game.time += DT;
    game.clock += DT;
    place(game);
    updateWildlife(game, DT);
  }
  return drainEvents(game);
}

test('several voyages have sea life, and it stays in open water', () => {
  assert.ok(withLife.some((l) => l.dolphins) && withLife.some((l) => l.whales));
  for (const def of withLife) {
    const game = createGame(def, { seed: 3 });
    const ap = createAutopilot(game);
    let stuck = 0;
    for (let i = 0; i < 60 * 90 && game.status !== 'finished'; i++) {
      stepGame(game, autopilotInput(ap, game, DT), DT);
      for (const p of game.life.pods) {
        if (p.state === 'escort') continue;
        for (const m of p.members) if (!isClear(game.level, m.x, m.y, 4)) stuck += 1;
      }
      for (const w of game.life.whales) if (!isClear(game.level, w.x, w.y, 20)) stuck += 1;
    }
    assert.equal(stuck, 0, `${def.id}: sea life on land`);
  }
});

test('dolphins on the bow push the boat faster', () => {
  const steady = (escort) => {
    const b = createBoat(0, 0, Math.PI / 2);
    for (let i = 0; i < 120 * 40; i++) {
      b.heading = Math.PI / 2;
      b.yawRate = 0;
      b.escort = escort;
      stepBoat(b, { steer: 0, trimTarget: 0.5, autoTrim: true }, { wx: 14, wy: 0, cx: 0, cy: 0 }, 1 / 120);
    }
    return boatSpeed(b);
  };
  const plain = steady(0);
  const riding = steady(1);
  assert.ok(riding > plain * 1.08, `${riding.toFixed(2)} vs ${plain.toFixed(2)}`);
});

test('a pod joins only a boat sailing fast enough, and leaves one that slows down', () => {
  const game = createGame(byId('lost-oar'), { seed: 1 });
  const pod = game.life.pods[0];
  const atPod = (speed) => (g) => {
    g.boat.x = pod.x + 30;
    g.boat.y = pod.y;
    g.boat.heading = 0;
    g.boat.vx = speed;
    g.boat.vy = 0;
  };
  tick(game, 3, atPod(JOIN_SPEED * 0.6));
  assert.equal(pod.state, 'roam', 'too slow to interest them');

  atPod(JOIN_SPEED + 4)(game);
  const joined = tick(game, 0.5, (g) => {
    g.boat.x += g.boat.vx * DT;
  });
  assert.equal(pod.state, 'escort');
  assert.ok(joined.some((e) => e.type === 'dolphins' && e.phase === 'join'));
  tick(game, 4, (g) => {
    g.boat.vx = JOIN_SPEED + 4;
    g.boat.x += g.boat.vx * DT;
  });
  assert.ok(game.boat.escort > 0.5, 'the pod forms up on the bow');
  assert.ok(game.escortTime > 0);

  const left = tick(game, 2, (g) => {
    g.boat.vx = 1;
  });
  assert.equal(pod.state, 'leave');
  assert.ok(left.some((e) => e.type === 'dolphins' && e.phase === 'leave' && e.reason === 'slow'));
  tick(game, 3);
  assert.equal(game.boat.escort, 0);
  // And they don't come straight back.
  tick(game, 3, atPod(JOIN_SPEED + 4));
  assert.notEqual(pod.state, 'escort');
});

// Runs the sea life until the whale is mid-breach.
function untilBreach(game) {
  const w = game.life.whales[0];
  for (let i = 0; i < 60 * WHALE.period * 2 && w.phase !== 'breach'; i++) tick(game, DT);
  assert.equal(w.phase, 'breach');
  return w;
}

test('a breaching whale sends out a swell that shoves the boat away', () => {
  const game = createGame(byId('whirlpool-strait'), { seed: 1 });
  const w = untilBreach(game);
  let hit = null;
  const events = tick(game, 3, (g) => {
    hit = hit || g.life.swells.some((s) => s.hit);
    if (!hit) {
      g.boat.x = w.x + 100;
      g.boat.y = w.y;
      g.boat.vx = 0;
      g.boat.vy = 0;
    }
  });
  assert.ok(events.some((e) => e.type === 'whale' && e.phase === 'breach'));
  const swell = events.find((e) => e.type === 'swell');
  assert.ok(swell && swell.strength > 0.3);
  assert.ok(game.boat.vx > 2, 'pushed away from the whale');
  assert.equal(game.closeBreaches, 1);
  assert.equal(game.hull, 100, 'a swell rocks you but does no damage');
});

test('a whale landing on the boat dents the hull', () => {
  const game = createGame(byId('whirlpool-strait'), { seed: 1 });
  const w = untilBreach(game);
  const events = tick(game, 2, (g) => {
    g.boat.x = w.x + 5;
    g.boat.y = w.y;
  });
  assert.ok(events.some((e) => e.type === 'collide' && e.material === 'whale'));
  assert.equal(game.hits.whale, 1);
  assert.ok(game.hull < 100);
});

test('sea life is the same for the same seed', () => {
  const run = () => {
    const game = createGame(byId('lost-oar'), { seed: 7 });
    const ap = createAutopilot(game);
    for (let i = 0; i < 60 * 40; i++) stepGame(game, autopilotInput(ap, game, DT), DT);
    return JSON.stringify(game.life.pods.map((p) => [p.state, p.x.toFixed(3), p.members.map((m) => m.x.toFixed(3))]));
  };
  assert.equal(run(), run());
});

test('Bow Rider and Whale Watcher medals', () => {
  const def = byId('whirlpool-strait');
  const result = (extra) => ({ time: def.par.gold + 30, stars: 1, pearls: 0, pearlsTotal: 1, hull: 80, capsizes: 0, hits: {}, jars: 1, boat: 'sloop', distance: 1000, ...extra });
  const sail = (save, extra) => {
    const r = result(extra);
    const improved = recordResult(save, def.id, r);
    return awardMedals(save, LEVELS, { def, result: r, improved }).map((m) => m.id);
  };
  const save = loadSave();
  let got = sail(save, { escort: 6, whales: 1, hits: { whale: 1 } });
  assert.ok(!got.includes('bow-rider') && !got.includes('whale-watcher'));
  got = sail(save, { escort: 12, whales: 1 });
  assert.ok(got.includes('bow-rider') && got.includes('whale-watcher'));
});
