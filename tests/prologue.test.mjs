import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFilm, stepFilm, endFilm, drainFilmEvents, shotAt, SHOTS, FILM_END, OAR_LOST, GUIDE_AT, CALLOUTS, PROLOGUE } from '../web/src/world/prologue.js';
import { boatSpeed } from '../web/src/physics/boat.js';
import { isClear } from '../web/src/world/collision.js';
import { loadSave } from '../web/src/platform/save.js';

// Run the whole film headless, noting what happens along the way.
function screen() {
  const film = createFilm();
  const seen = { shots: [], events: [], at: {} };
  const note = (key, value) => (seen.at[key] = seen.at[key] || []).push(value);
  while (!film.done) {
    stepFilm(film, 1 / 60);
    const b = film.game.boat;
    note(film.shot.id, { speed: boatSpeed(b), luffing: b.luffing, oar: film.oar.state, t: film.t });
    for (const e of drainFilmEvents(film)) {
      seen.events.push({ ...e, t: film.t });
      if (e.type === 'shot') seen.shots.push(e.id);
    }
  }
  return { film, seen };
}

const { film, seen } = screen();
const mid = (key) => seen.at[key].filter((s, i, all) => i > all.length / 2);

test('the film plays through, every shot in order, without a scratch on her', () => {
  assert.deepEqual(seen.shots, SHOTS.slice(1).map((s) => s.id));
  assert.equal(seen.events.at(-1).type, 'end');
  assert.ok(film.t >= FILM_END && film.t < FILM_END + 0.1);
  assert.equal(film.game.status, 'sailing');
  assert.equal(film.game.hull, 100);
  assert.equal(film.game.capsizes, 0);
  const captions = seen.events.filter((e) => e.type === 'shot').map((e) => e.caption);
  assert.ok(captions.slice(0, -1).every((c) => c.length > 10), 'every shot but the title card says something');
});

test('it opens on home, then cuts to her far out, rowing for it', () => {
  assert.equal(SHOTS[0].id, 'home');
  assert.match(SHOTS[0].caption, /^Home/);
  assert.equal(PROLOGUE.finish.kind, 'home');
  const strokes = seen.events.filter((e) => e.type === 'stroke');
  assert.ok(strokes.every((e) => e.t >= SHOTS[1].at), 'no oar strokes heard over the home shot');
  assert.ok(seen.at.home.every((s) => s.oar === 'held'));
  assert.ok(PROLOGUE.finish.x - PROLOGUE.start.x > 1000, 'home is far away');
});

test('rowing out, the oar strokes; in the squall the sea takes it', () => {
  const strokes = seen.events.filter((e) => e.type === 'stroke');
  assert.ok(strokes.length >= 5 && strokes.every((e) => e.t < OAR_LOST));
  assert.ok(seen.at.dawn.every((s) => s.oar === 'held' && s.speed > 2 && s.speed < 6), 'pulled along by the oar in a calm');
  const lost = seen.events.find((e) => e.type === 'oar');
  const splash = seen.events.find((e) => e.type === 'splash');
  assert.ok(lost && Math.abs(lost.t - OAR_LOST) < 0.05);
  assert.ok(splash && splash.t > lost.t && splash.t < lost.t + 2, 'it lands soon after');
  assert.equal(seen.events.filter((e) => e.type === 'thunder').length, 3);
  assert.equal(film.oar.state, 'adrift');
  assert.ok(Math.max(...seen.at.squall.map((s) => s.speed)) > 15, 'the squall drives her hard');
});

test('head to wind the sail flaps and she stops; across it she flies', () => {
  const irons = mid('irons');
  assert.ok(irons.every((s) => s.luffing), 'luffing all through the back half of the shot');
  assert.ok(Math.min(...irons.map((s) => s.speed)) < 2);
  const reach = mid('reach');
  assert.ok(reach.every((s) => !s.luffing && s.speed > 9), `reach speeds ${reach.map((s) => s.speed.toFixed(1))}`);
  assert.ok(film.game.escortTime > 2, 'and the dolphins come along');
});

test('stuck in irons, dolphins show the way, and she follows them', () => {
  const guide = seen.events.find((e) => e.type === 'guide');
  assert.ok(guide && Math.abs(guide.t - GUIDE_AT) < 0.05);
  assert.equal(shotAt(guide.t).id, 'irons');
  const join = seen.events.find((e) => e.type === 'dolphins' && e.phase === 'join');
  assert.ok(join && join.guide, 'the same dolphins ride her bow');
  assert.equal(shotAt(join.t).id, 'reach');
  assert.ok(!PROLOGUE.dolphins, 'no other pod steals the scene');
});

test('the chart lays a way to B from wherever she is', () => {
  const at = SHOTS.find((s) => s.id === 'chart').at;
  assert.ok(film.route && Math.abs(film.route.at - at) < 0.05);
  for (const c of CALLOUTS) assert.ok(c.at > at && c.at < FILM_END);
  // Nothing in the script steers her onto the rocks.
  const g = film.game;
  assert.ok(isClear(g.level, g.boat.x, g.boat.y, 10));
  assert.ok(PROLOGUE.finish.x > g.boat.x, 'B still lies ahead when the film ends');
});

test('shots are found by time, and the film can be ended early', () => {
  assert.equal(shotAt(0).id, 'home');
  assert.equal(shotAt(SHOTS[1].at).id, 'dawn');
  assert.equal(shotAt(OAR_LOST).id, 'lost');
  assert.equal(shotAt(999).id, 'title');
  const f = createFilm();
  stepFilm(f, 1 / 60);
  endFilm(f);
  endFilm(f);
  assert.deepEqual(drainFilmEvents(f).map((e) => e.type), ['end']);
  const t = f.t;
  stepFilm(f, 1);
  assert.equal(f.t, t, 'an ended film stands still');
});

test('a fresh save has not seen the prologue', () => {
  const save = loadSave();
  assert.equal(save.seenFilm, false);
  assert.equal(save.stats.voyages, 0);
});
