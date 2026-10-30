import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { isClear } from '../web/src/world/collision.js';
import { angleDiff, fromBearing, DEG } from '../web/src/core/math.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { regattaDef, COURSES, courseById, RIVALS, FLEETS } from '../web/src/world/regatta.js';
import { CUP_COURSES, CUP_RACES, CUP_POINTS, CUP_PRIZES, CUP_BOAT, startCup, cupCourse, cupTable, scoreCupRace, cupPay, cleanCup, trophyCount } from '../web/src/data/cup.js';
import { doubleOf } from '../web/src/data/economy.js';
import { loadSave, isBoatUnlocked } from '../web/src/platform/save.js';
import { backupCode, readBackup } from '../web/src/platform/backup.js';

const idle = () => ({ steer: 0, trimTarget: 0.5, autoTrim: true, boost: false });

// A finished race's result with the fleet home in this order ('You' for you).
function finish(names) {
  const place = names.indexOf('You') + 1;
  return { race: true, place, stars: place === 1 ? 3 : place === 2 ? 2 : 1, standings: names.map((name) => ({ name, player: name === 'You', time: 100, marks: 3 })) };
}
const [P, M, S] = RIVALS.map((r) => r.name);

test('the cup sails every course once, each charted from its seed', () => {
  assert.equal(CUP_RACES, 4);
  assert.deepEqual(CUP_COURSES, COURSES.map((c) => c.id));
  assert.equal(courseById('nope').id, 'triangle');
  for (const c of COURSES) {
    const a = regattaDef(9, 2, c.id);
    assert.deepEqual(regattaDef(9, 2, c.id), a, `${c.id} is the same from the same seed`);
    assert.notDeepEqual(regattaDef(10, 2, c.id).checkpoints, a.checkpoints);
    assert.ok(a.race && a.fleet === 2 && a.course === c.id);
    assert.equal(a.checkpoints.length, c.id === 'triangle' ? 2 : 3);
    assert.deepEqual(a.checkpoints.map((k) => k.label), a.checkpoints.map((_, i) => String(i + 1)));
    for (const k of a.checkpoints) assert.ok(k.x > 40 && k.x < 1660 && k.y > 40 && k.y < 1060, `${c.id} mark inside the race area`);
    assert.ok(a.finish.x > a.start.x, 'the harbor is downwind of the line');
    const ys = [a.start, ...a.fleetStart].map((s) => s.y).sort((p, q) => p - q);
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 60, 'room between boats on the line');
    assert.ok(a.tips[0].text.includes(a.checkpoints.length === 2 ? 'mark 1, then mark 2' : 'marks 1, 2 and 3'));
  }
  // Each course has its own seas from the same seed.
  assert.notEqual(regattaDef(9, 0, 'slalom').windSeed, regattaDef(9, 0, 'island').windSeed);
});

test('every course has a racing line you can sail, clear of land, through every mark', () => {
  for (const c of COURSES) {
    for (let seed = 1; seed <= 15; seed++) {
      const g = createGame(regattaDef(seed, 0, c.id));
      const { line } = g.race;
      const { level } = g;
      const windFrom = fromBearing(g.wind.baseFrom);
      assert.equal(line.length, level.checkpoints.length + 1);
      for (const k of level.checkpoints) assert.ok(isClear(level, k.x, k.y, k.r), `${c.id} ${seed}: mark ${k.label} in open water`);
      [...level.checkpoints, level.finish].forEach((stop, i) => assert.deepEqual(line[i].pts.at(-1), [stop.x, stop.y]));
      for (const leg of line) {
        for (let j = 1; j < leg.pts.length; j++) {
          const [ax, ay] = leg.pts[j - 1];
          const [bx, by] = leg.pts[j];
          const twa = Math.abs(angleDiff(Math.atan2(by - ay, bx - ax), windFrom)) / DEG;
          assert.ok(twa > 44 && twa < 160, `${c.id} ${seed}: a board ${twa.toFixed(0)} degrees off the wind`);
          for (let t = 0; t <= 1; t += 0.05) assert.ok(isClear(level, ax + (bx - ax) * t, ay + (by - ay) * t, 8), `${c.id} ${seed}: the line runs over land`);
        }
      }
    }
  }
});

// Seed 7 of Up and Down once left two rivals pinned together at mark 1.
for (const [course, seeds] of [['updown', [7, 2]], ['slalom', [3]], ['island', [5]]]) {
  test(`the fleet races ${courseById(course).name} round every mark and home`, () => {
    for (const seed of seeds) {
      const g = createGame(regattaDef(seed, 1, course));
      Object.assign(g.boat, { x: 1650, y: 60 });
      const marks = g.level.checkpoints.length;
      for (let i = 0; i < 400 * 30 && g.race.rivals.some((r) => r.finished === null); i++) {
        stepGame(g, idle(), 1 / 30);
        drainEvents(g);
      }
      for (const r of g.race.rivals) {
        assert.equal(r.next, marks, `${seed}: ${r.name} rounded every mark`);
        assert.ok(r.finished > 100 && r.finished < 380, `${seed}: ${r.name} home at ${r.finished}`);
      }
    }
  });
}

test('the autopilot can sail every cup course and gets a place', () => {
  for (const c of COURSES.slice(1)) {
    const g = createGame(regattaDef(2, 0, c.id));
    const ap = createAutopilot(g);
    for (let i = 0; i < 400 * 30 && g.status !== 'finished'; i++) {
      stepGame(g, autopilotInput(ap, g, 1 / 30), 1 / 30);
      drainEvents(g);
    }
    assert.equal(g.status, 'finished', c.id);
    assert.equal(g.result.marks, 3);
    assert.ok(g.result.place >= 1 && g.result.place <= 4);
    assert.ok(g.result.time > 120 && g.result.time < 330, `${c.id} time ${g.result.time}`);
  }
});

test('a cup scores points race by race, and the most points takes the cup', () => {
  const save = loadSave();
  assert.equal(save.cup.now, null);
  assert.equal(cupCourse(save), 'triangle');
  startCup(save, 1);
  const r1 = scoreCupRace(save, finish([P, 'You', M, S]));
  assert.equal(r1.race, 1);
  assert.equal(r1.done, false);
  assert.equal(r1.gained, CUP_POINTS[1]);
  assert.deepEqual(r1.table.map((e) => [e.name, e.points, e.gained]), [[P, 10, 10], ['You', 6, 6], [M, 4, 4], [S, 2, 2]]);
  assert.equal(cupCourse(save), 'updown');
  scoreCupRace(save, finish(['You', P, S, M]));
  assert.equal(cupCourse(save), 'slalom');
  // Level on points: the better place in the last race goes ahead.
  assert.deepEqual(cupTable(save.cup.now).slice(0, 2).map((e) => [e.name, e.points]), [['You', 16], [P, 16]]);
  scoreCupRace(save, finish([P, 'You', M, S]));
  const coins = save.wallet.coins;
  const last = scoreCupRace(save, finish(['You', S, P, M]));
  assert.ok(last.done);
  assert.equal(last.place, 1);
  assert.deepEqual(last.places, [2, 1, 2, 1]);
  assert.equal(last.table[0].points, 32);
  assert.equal(last.trophy, 'open');
  assert.equal(last.boat, CUP_BOAT);
  assert.deepEqual(last.prize, CUP_PRIZES[0]);
  assert.equal(save.wallet.coins, coins, 'the prize is paid with the race, by the game');
  assert.equal(save.cup.now, null);
  assert.equal(save.cup.sailed, 1);
  assert.deepEqual(save.cup.trophies, { club: 0, open: 1, championship: 0 });
  assert.equal(trophyCount(save), 1);
  assert.ok(isBoatUnlocked(save, CUP_BOAT));
  assert.equal(scoreCupRace(save, finish(['You', P, M, S])), null, 'no cup, nothing to score');
  // The next cup won is a trophy, but the boat is won only once.
  startCup(save, 2);
  for (let i = 0; i < CUP_RACES; i++) {
    const r = scoreCupRace(save, finish(['You', P, M, S]));
    if (i === CUP_RACES - 1) assert.ok(r.done && r.trophy === 'championship' && !r.boat);
  }
  assert.equal(save.wallet.owned.filter((o) => o === `boat:${CUP_BOAT}`).length, 1);
  assert.equal(trophyCount(save), 2);
});

test('a lost cup pays by place, with no trophy, and its prize is never doubled', () => {
  const save = loadSave();
  startCup(save, 0);
  let r;
  for (let i = 0; i < CUP_RACES; i++) r = scoreCupRace(save, finish([P, M, 'You', S]));
  assert.ok(r.done && r.place === 3 && !r.trophy && !r.boat);
  assert.deepEqual(r.prize, CUP_PRIZES[2]);
  assert.equal(trophyCount(save), 0);
  assert.ok(!isBoatUnlocked(save, CUP_BOAT));
  const lines = cupPay(r);
  assert.deepEqual(lines, [{ label: 'Cup prize', coins: CUP_PRIZES[2].coins }]);
  assert.equal(doubleOf({ coins: 100 + lines[0].coins, lines: [{ label: 'Place', coins: 100 }, ...lines] }), 100);
  assert.deepEqual(cupPay({ done: false }), []);
  assert.deepEqual(cupPay(null), []);
});

test('a cup under way and the trophies travel in a backup code, and bad data is no cup', async () => {
  const save = loadSave();
  startCup(save, 2);
  scoreCupRace(save, finish([S, 'You', P, M]));
  save.cup.trophies.club = 2;
  const r = await readBackup(await backupCode(save));
  assert.equal(r.ok, true);
  assert.deepEqual(r.save.cup, save.cup);
  assert.equal(cupCourse(r.save), 'updown');
  // Junk in a stored cup never reaches the screen.
  assert.deepEqual(cleanCup(null), { now: null, sailed: 0, trophies: { club: 0, open: 0, championship: 0 } });
  const odd = cleanCup({ sailed: '<b>', trophies: { club: -3, open: 'x', championship: 2.7 }, now: { fleet: 9, race: 40, points: [1, 2, '<i>', 4], last: [0, 0, 1, 2], places: [9, 2, 'x'] } });
  assert.equal(odd.sailed, 0);
  assert.deepEqual(odd.trophies, { club: 0, open: 0, championship: 2 });
  assert.equal(odd.now.fleet, FLEETS.length - 1);
  assert.equal(odd.now.race, CUP_RACES - 1);
  assert.deepEqual(odd.now.points, [1, 2, 0, 4]);
  assert.deepEqual(odd.now.last, [0, 1, 2, 3]);
  assert.deepEqual(odd.now.places, [2]);
  assert.equal(cleanCup({ now: { points: [1, 2] } }).now, null);
});
