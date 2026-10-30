import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { awardMedals } from '../web/src/data/medals.js';
import { rewardFor } from '../web/src/data/locker.js';
import { loadSave, recordRace } from '../web/src/platform/save.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { courseGoal } from '../web/src/world/level.js';
import { hullContact, bounce } from '../web/src/world/contact.js';
import { isClear } from '../web/src/world/collision.js';
import { angleDiff, fromBearing, DEG } from '../web/src/core/math.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { regattaDef, fleetFor, dirtyAirAt, shadeWind, giveWay, standings, FLEETS, RIVALS, REGATTA, DIRTY_REACH } from '../web/src/world/regatta.js';
import { ordinal } from '../web/src/i18n/index.js';

const idle = () => ({ steer: 0, trimTarget: 0.5, autoTrim: true, boost: false });
const race = (seed = 3, fleet = 0) => createGame(regattaDef(seed, fleet));
// Park the fleet out of the way, so a test can sail the player alone.
const park = (g) => g.race.rivals.forEach((r, i) => Object.assign(r.boat, { x: 40, y: 40 + i * 60, vx: 0, vy: 0 }));

test('every regatta is charted from its seed: two marks, a start line and a harbor', () => {
  const a = regattaDef(5, 1);
  assert.deepEqual(regattaDef(5, 1), a);
  assert.notDeepEqual(regattaDef(6, 1).checkpoints, a.checkpoints);
  assert.equal(a.id, REGATTA);
  assert.ok(a.race && a.fleet === 1);
  assert.equal(a.checkpoints.length, 2);
  assert.deepEqual(a.checkpoints.map((c) => c.label), ['1', '2']);
  // The marks lie upwind (west) of the line, the harbor downwind of it.
  for (const c of a.checkpoints) assert.ok(c.x < a.start.x - 300);
  assert.ok(a.finish.x > a.start.x);
  assert.equal(a.fleetStart.length, 3);
  const ys = [a.start, ...a.fleetStart].map((s) => s.y).sort((p, q) => p - q);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 60, 'room between boats on the line');
  // Each regatta has its own gusts, not just its own course.
  assert.notEqual(regattaDef(5).windSeed, regattaDef(6).windSeed);
});

test('the racing line is a course you can sail: tacks up the beat, clear of land, through every mark', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = race(seed);
    const { line } = g.race;
    const { level } = g;
    const windFrom = fromBearing(g.wind.baseFrom);
    assert.equal(line.length, level.checkpoints.length + 1);
    assert.deepEqual(line[0].pts[0], [g.boat.x, g.boat.y], 'it sets out from where you start');
    [...level.checkpoints, level.finish].forEach((stop, i) => {
      assert.deepEqual(line[i].pts.at(-1), [stop.x, stop.y], `seed ${seed} leg ${i} ends at its mark`);
      if (i) assert.deepEqual(line[i].pts[0], line[i - 1].pts.at(-1), 'each leg picks up where the last one ended');
    });
    assert.equal(line[0].turn, 'tack', `seed ${seed}: the beat is sailed in tacks`);
    assert.ok(line[0].pts.length >= 3);
    for (const leg of line) {
      for (let j = 1; j < leg.pts.length; j++) {
        const [ax, ay] = leg.pts[j - 1];
        const [bx, by] = leg.pts[j];
        const twa = Math.abs(angleDiff(Math.atan2(by - ay, bx - ax), windFrom)) / DEG;
        assert.ok(twa > 44 && twa < 160, `seed ${seed}: a board ${twa.toFixed(0)} degrees off the wind`);
        for (let t = 0; t <= 1; t += 0.05) assert.ok(isClear(level, ax + (bx - ax) * t, ay + (by - ay) * t, 8), `seed ${seed}: the line runs over land`);
      }
    }
  }
});

test('the fleet steps up with your wins', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(fleetFor), [0, 1, 1, 2, 2]);
  for (let i = 1; i < FLEETS.length; i++) assert.ok(FLEETS[i].power[0] > FLEETS[i - 1].power[0]);
  const club = race(2, 0);
  const champs = race(2, 2);
  club.race.rivals.forEach((r, i) => assert.ok(r.boat.type.sailPower < champs.race.rivals[i].boat.type.sailPower));
  assert.deepEqual(club.race.rivals.map((r) => r.name), RIVALS.map((r) => r.name));
  assert.deepEqual(['1st', '2nd', '3rd', '4th'], [1, 2, 3, 4].map(ordinal));
});

test('marks count only in order, and the course points at the next one', () => {
  const g = race(4);
  park(g);
  const [one, two] = g.level.checkpoints;
  assert.equal(courseGoal(g), one);
  Object.assign(g.boat, { x: two.x, y: two.y });
  stepGame(g, idle(), 1 / 60);
  assert.equal(g.nextCheckpoint, 0, 'mark 2 before mark 1 does not count');
  Object.assign(g.boat, { x: one.x, y: one.y });
  stepGame(g, idle(), 1 / 60);
  assert.ok(drainEvents(g).some((e) => e.type === 'checkpoint' && e.index === 0));
  assert.equal(courseGoal(g), two);
  Object.assign(g.boat, { x: two.x, y: two.y });
  stepGame(g, idle(), 1 / 60);
  assert.equal(g.nextCheckpoint, 2);
  assert.equal(courseGoal(g), g.level.finish);
});

test('the harbor is no finish until every mark is rounded', () => {
  const g = race(4);
  park(g);
  const f = g.level.finish;
  Object.assign(g.boat, { x: f.x, y: f.y });
  for (let i = 0; i < 30; i++) stepGame(g, idle(), 1 / 60);
  assert.equal(g.status, 'sailing');
  const early = drainEvents(g).filter((e) => e.type === 'early');
  assert.equal(early.length, 1, 'one warning, not one a frame');
  assert.equal(early[0].mark, 0);
  g.nextCheckpoint = 2;
  stepGame(g, idle(), 1 / 60);
  assert.equal(g.status, 'finished');
  const end = drainEvents(g).find((e) => e.type === 'finish');
  assert.ok(end.race && end.place === 1 && end.field === 4 && end.stars === 3);
  assert.equal(end.standings[0].name, 'You');
  assert.ok(end.standings[0].player && end.standings[0].time === g.time);
});

test('a sail casts dirty air downwind, and it takes some of your wind', () => {
  const g = race(2);
  park(g);
  const r = g.race.rivals[0];
  const dx = Math.cos(g.wind.angle);
  const dy = Math.sin(g.wind.angle);
  Object.assign(r.boat, { x: 600, y: 500 });
  // Right behind it, downwind: deep in the shadow.
  const lee = dirtyAirAt(g, 600 + dx * 40, 500 + dy * 40, g.boat);
  assert.ok(lee > 0.5, `lee ${lee}`);
  // Further back it thins out, and abeam or upwind there is none.
  assert.ok(dirtyAirAt(g, 600 + dx * 120, 500 + dy * 120, g.boat) < lee);
  assert.equal(dirtyAirAt(g, 600 + dx * (DIRTY_REACH + 10), 500 + dy * (DIRTY_REACH + 10), g.boat), 0);
  assert.equal(dirtyAirAt(g, 600 - dy * 60, 500 + dx * 60, g.boat), 0);
  assert.equal(dirtyAirAt(g, 600 - dx * 40, 500 - dy * 40, g.boat), 0);
  // A boat never shades itself.
  assert.equal(dirtyAirAt(g, 600 + dx * 40, 500 + dy * 40, r.boat), 0);
  const w = { wx: dx * 8, wy: dy * 8, speed: 8 };
  Object.assign(g.boat, { x: 600 + dx * 40, y: 500 + dy * 40 });
  const shade = shadeWind(g, g.boat, w);
  assert.ok(shade > 0.5 && w.speed < 8 * 0.9 && w.speed > 8 * 0.6, `speed ${w.speed}`);
  // The HUD reads the shade the boat is sailing in.
  stepGame(g, idle(), 1 / 60);
  assert.ok(g.race.dirty > 0.4);
});

test('boats that touch push apart and lose way, and a rival gives way', () => {
  const g = race(2);
  park(g);
  const r = g.race.rivals[1];
  Object.assign(g.boat, { x: 800, y: 500, heading: 0, vx: 6, vy: 0 });
  Object.assign(r.boat, { x: 812, y: 500, heading: Math.PI, vx: -6, vy: 0 });
  const gap = () => Math.hypot(r.boat.x - g.boat.x, r.boat.y - g.boat.y);
  const before = gap();
  stepGame(g, idle(), 1 / 60);
  const bump = drainEvents(g).find((e) => e.type === 'bump');
  assert.ok(bump && bump.impact > 1.5);
  assert.equal(g.race.bumps, 1);
  assert.ok(gap() > before, 'pushed apart');
  assert.ok(g.boat.vx < 6 && r.boat.vx > -6, 'both lose way');
  // With you dead ahead, a rival steers off; with you astern it does not.
  Object.assign(g.boat, { x: 1000, y: 300 });
  Object.assign(r.boat, { x: 970, y: 297, heading: 0 });
  assert.ok(giveWay(g, r.boat) < 0, 'you are to starboard, so it bears away to port');
  Object.assign(r.boat, { x: 1040, y: 300 });
  assert.equal(giveWay(g, r.boat), 0);
});

test('the fleet races the course: marks in order, then home, each given a place', () => {
  const g = race(7);
  // You drift in the harbor approach; the fleet races on.
  Object.assign(g.boat, { x: 1650, y: 60 });
  const rounded = new Map();
  const homes = [];
  for (let i = 0; i < 300 * 30 && g.race.rivals.some((r) => r.finished === null); i++) {
    stepGame(g, idle(), 1 / 30);
    for (const r of g.race.rivals) {
      if (r.next !== (rounded.get(r) ?? 0)) {
        assert.equal(r.next, (rounded.get(r) ?? 0) + 1, 'one mark at a time');
        rounded.set(r, r.next);
      }
    }
    homes.push(...drainEvents(g).filter((e) => e.type === 'rival' && e.phase === 'finish'));
  }
  assert.deepEqual(homes.map((e) => e.place), [1, 2, 3]);
  for (const r of g.race.rivals) {
    assert.equal(r.next, 2);
    assert.ok(r.finished > 100 && r.finished < 300, `${r.name} home at ${r.finished}`);
  }
  // Boats home rank by time, ahead of you still out on the course.
  const order = standings(g);
  assert.ok(order.at(-1).player);
  assert.deepEqual(order.slice(0, 3).map((e) => e.name), homes.map((e) => e.name));
});

test('the autopilot can sail a whole regatta and gets a place', () => {
  const g = race(1);
  const ap = createAutopilot(g);
  const dt = 1 / 30;
  for (let i = 0; i < 320 * 30 && g.status !== 'finished'; i++) {
    stepGame(g, autopilotInput(ap, g, dt), dt);
    drainEvents(g);
  }
  assert.equal(g.status, 'finished');
  assert.ok(g.result.place >= 1 && g.result.place <= 4);
  assert.equal(g.result.standings.length, 4);
  assert.equal(g.result.fleet, 'club');
  assert.ok(g.result.time > 120 && g.result.time < 260, `time ${g.result.time}`);
});

test('a hull meets rocks through the shared contact code', () => {
  const g = race(3);
  const rock = { x: 500, y: 500, r: 10, material: 'rock' };
  g.level.rocks = [rock];
  Object.assign(g.boat, { x: 500 - 14, y: 500, heading: 0, vx: 5, vy: 0 });
  const hit = hullContact(g.level, g.boat);
  assert.ok(hit && hit.depth > 0 && hit.nx < 0);
  const impact = bounce(g.boat, hit);
  assert.ok(impact > 4 && impact <= 5);
  assert.ok(g.boat.vx < 0, 'bounced back off the rock');
  assert.equal(bounce(g.boat, hit), 0, 'already moving away');
});

test('a race is saved, and the first win is worth Line Honours', () => {
  const save = loadSave();
  const result = (place, time) => ({ race: true, place, time, stars: place === 1 ? 3 : place === 2 ? 2 : 1, jars: 0, boat: 'skiff', distance: 900, capsizes: 1 });
  const third = recordRace(save, result(3, 190));
  assert.equal(third.won, false);
  assert.deepEqual(save.regatta, { races: 1, wins: 0, podiums: 1, best: null });
  assert.ok(!awardMedals(save, LEVELS).some((m) => m.id === 'line-honours'));
  const run = { def: regattaDef(3), result: result(1, 182) };
  run.improved = recordRace(save, run.result);
  assert.ok(run.improved.won && run.improved.firstWin && run.improved.time);
  assert.deepEqual(save.regatta, { races: 2, wins: 1, podiums: 2, best: 182 });
  assert.equal(save.stats.voyages, 2);
  assert.ok(save.sailed.includes('skiff'));
  const medals = awardMedals(save, LEVELS, run).map((m) => m.id);
  assert.ok(medals.includes('line-honours'));
  // A first place is three stars, but no par time was beaten.
  assert.ok(!medals.includes('gold-wind') && !medals.includes('pure-wind') && !medals.includes('personal-best'));
  assert.equal(rewardFor('line-honours').label, 'Regatta Stripes sail');
  const slower = recordRace(save, result(1, 190));
  assert.ok(slower.won && !slower.firstWin && !slower.time);
  assert.equal(save.regatta.best, 182);
  assert.equal(fleetFor(save.regatta.wins), 1);
});
