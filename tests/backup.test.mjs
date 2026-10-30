import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, restoreSave } from '../web/src/platform/save.js';
import { backupCode, readBackup, summarize } from '../web/src/platform/backup.js';
import { CAMPAIGN } from '../web/src/data/worlds.js';

// A well-sailed save: every voyage home, coins, medals, notes and crew.
function seasoned() {
  const save = loadSave();
  for (const l of CAMPAIGN) save.levels[l.id] = { best: 61.5, stars: 3, pearls: 4, pearlsTotal: 4, rescued: 1, castaways: 1, runs: 3 };
  save.wallet.coins = 12345;
  save.wallet.blackPearls = 7;
  save.medals = { 'cast-off': '2026-10-01', 'gold-wind': '2026-10-02' };
  save.notes = ['The reef sleeps under the blue water.', 'Café crème, señor: unicode survives.'];
  save.crew = [{ name: 'Old Tomas', line: 'I thought no one would come.' }];
  save.settings.sail = 'rainbow';
  save.stats.voyages = 330;
  return save;
}

test('a backup code carries the whole save to another phone', async () => {
  const save = seasoned();
  const code = await backupCode(save);
  assert.match(code, /^NP1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  // Short enough to paste in a message.
  assert.ok(code.length < 12000, `${code.length} chars`);
  const r = await readBackup(code);
  assert.equal(r.ok, true);
  assert.deepEqual(r.save, JSON.parse(JSON.stringify(save)));
  assert.deepEqual(r.summary, { stars: CAMPAIGN.length * 3, voyages: CAMPAIGN.length, coins: 12345, blackPearls: 7, medals: 2 });
  assert.deepEqual(summarize(loadSave()), { stars: 0, voyages: 0, coins: 0, blackPearls: 0, medals: 0 });
});

test('spaces and line breaks from pasting are ignored', async () => {
  const code = await backupCode(seasoned());
  const messy = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} ${code.slice(90)}\n`;
  assert.equal((await readBackup(messy)).ok, true);
});

test('a code cut short, mistyped or not a code at all is refused', async () => {
  const code = await backupCode(seasoned());
  assert.deepEqual(await readBackup(''), { ok: false, reason: 'empty' });
  assert.deepEqual(await readBackup('hello there'), { ok: false, reason: 'not-a-code' });
  assert.deepEqual(await readBackup(code.slice(0, -20)), { ok: false, reason: 'not-a-code' });
  const [kind, body, sum] = code.split('.');
  const typo = body.slice(0, 50) + (body[50] === 'A' ? 'B' : 'A') + body.slice(51);
  assert.deepEqual(await readBackup(`${kind}.${typo}.${sum}`), { ok: false, reason: 'damaged' });
  assert.deepEqual(await readBackup(`${kind}.${body.slice(0, -10)}.${sum}`), { ok: false, reason: 'damaged' });
});

test("without compression the code is plain, and still reads back", async () => {
  const keep = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  let code;
  try {
    code = await backupCode(seasoned());
  } finally {
    globalThis.CompressionStream = keep;
  }
  assert.match(code, /^NP0\./);
  const r = await readBackup(code);
  assert.equal(r.ok, true);
  assert.equal(r.save.wallet.coins, 12345);
});

test('a code with markup in it, or junk where the save should be, is refused', async () => {
  const sneaky = seasoned();
  sneaky.stats.voyages = '<img src=x onerror=alert(1)>';
  assert.deepEqual(await readBackup(await backupCode(sneaky)), { ok: false, reason: 'damaged' });
  const notASave = await backupCode([1, 2, 3]);
  assert.deepEqual(await readBackup(notASave), { ok: false, reason: 'damaged' });
  // Odd values are put right rather than trusted.
  const odd = seasoned();
  odd.stats.capsizes = 'lots';
  odd.medals = 'none';
  const r = await readBackup(await backupCode(odd));
  assert.equal(r.ok, true);
  assert.equal(r.save.stats.capsizes, 0);
  assert.deepEqual(r.save.medals, {});
});

test("restoring takes the place of this phone's progress, keeping the same save object", async () => {
  const here = loadSave();
  here.wallet.coins = 5;
  here.junk = 'left over';
  const r = await readBackup(await backupCode(seasoned()));
  restoreSave(here, r.save);
  assert.equal(here.wallet.coins, 12345);
  assert.equal(here.settings.sail, 'rainbow');
  assert.equal(here.junk, undefined);
  assert.equal(Object.keys(here.levels).length, CAMPAIGN.length);
});
