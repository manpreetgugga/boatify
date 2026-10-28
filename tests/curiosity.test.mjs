import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../web/src/data/levels.js';
import { MEDALS, isSealed, awardMedals } from '../web/src/data/medals.js';
import { rumors, pickRumor, SAYINGS } from '../web/src/data/rumors.js';
import { loadSave, recordResult } from '../web/src/platform/save.js';

const byId = (id) => LEVELS.find((l) => l.id === id);
const sealed = (save) => MEDALS.filter((m) => isSealed(m, save, LEVELS)).map((m) => m.id);

// Finish voyages in order, the way a player would.
function sailTo(save, count) {
  for (const def of LEVELS.slice(0, count)) recordResult(save, def.id, { time: 60, stars: 3, pearls: 0, pearlsTotal: 0, hull: 100, capsizes: 0 });
}

test('every voyage has a teaser of its own', () => {
  const seen = new Set();
  for (const l of LEVELS) {
    assert.ok(l.teaser && l.teaser.length > 15 && l.teaser.length < 60, `${l.id}: ${l.teaser}`);
    assert.ok(!seen.has(l.teaser));
    seen.add(l.teaser);
  }
});

test('a sealed medal has a riddle and a place it is won in', () => {
  for (const m of MEDALS.filter((x) => x.seal)) {
    assert.ok(m.seal === 'daily' || byId(m.seal), `${m.id} is sealed to ${m.seal}`);
    assert.ok(m.riddle && m.riddle.length > 20, m.id);
    assert.ok(!m.riddle.toLowerCase().includes(m.name.toLowerCase()), `${m.id}'s riddle gives its name away`);
  }
  assert.ok(MEDALS.filter((m) => m.seal).length >= 10, 'plenty of secrets');
});

test('seals break as the waters are reached', () => {
  const save = loadSave();
  const fresh = sealed(save);
  assert.ok(fresh.includes('kraken-dodger') && fresh.includes('line-honours') && fresh.includes('bow-rider'));
  assert.ok(!fresh.includes('cast-off') && !fresh.includes('navigator'), 'the plain goals are never secret');
  sailTo(save, 1);
  assert.ok(!sealed(save).includes('bow-rider'), 'Beam Reach Bay is open: its medals are charted');
  assert.ok(sealed(save).includes('not-a-scratch'));
  sailTo(save, 3);
  assert.ok(!sealed(save).includes('line-honours') && !sealed(save).includes('not-a-scratch'), 'the daily voyage and the Coral Maze are open');
  assert.ok(sealed(save).includes('kraken-dodger'));
  sailTo(save, LEVELS.length);
  assert.deepEqual(sealed(save), []);
});

test('an earned medal is never sealed, wherever it was won', () => {
  const save = loadSave();
  // Dolphins swim in the very first voyage too.
  const def = LEVELS[0];
  const r = { time: 60, stars: 1, pearls: 0, pearlsTotal: 0, hull: 100, capsizes: 0, hits: {}, escort: 12, boat: 'sloop' };
  const improved = recordResult(save, def.id, r);
  awardMedals(save, LEVELS, { def, result: r, improved });
  save.levels['lost-oar'].best = null; // as if voyage two were still out of reach
  assert.ok(!isSealed(MEDALS.find((m) => m.id === 'bow-rider'), save, LEVELS));
});

test('harbor talk is about what is left to find', () => {
  const save = loadSave();
  const fresh = rumors(save, LEVELS);
  assert.ok(fresh.some((r) => r.includes('Kraken Fog')));
  assert.ok(fresh.some((r) => r.startsWith('A secret medal')));
  assert.ok(fresh.some((r) => r.includes('shipwright')));
  assert.ok(!fresh.some((r) => r.includes('Old Tomas')), "no word of a castaway in waters you can't reach yet");
  sailTo(save, 1);
  assert.ok(rumors(save, LEVELS).some((r) => r.includes('Old Tomas')));
  assert.ok(!rumors(save, LEVELS).some((r) => r.startsWith('Lost Oar')), 'a sailed voyage is no rumor');
  // Find everything there is to find (three stars everywhere buys every boat),
  // and the old sayings are all that's left.
  sailTo(save, LEVELS.length);
  for (const l of LEVELS) for (const c of l.castaways || []) save.crew.push({ name: c.name, line: c.line });
  save.openSea.runs = 1;
  save.regatta.races = 1;
  assert.deepEqual(rumors(save, LEVELS), SAYINGS);
});

test('a rumor is picked from the list', () => {
  const save = loadSave();
  const list = rumors(save, LEVELS);
  assert.equal(pickRumor(save, LEVELS, () => 0), list[0]);
  assert.equal(pickRumor(save, LEVELS, () => 0.999999), list.at(-1));
});
