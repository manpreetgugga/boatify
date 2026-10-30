import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, ENTRIES, ATLAS_TOTAL, PAGE_REWARD, SIGHT, entryById, pageById, hasMet, atlasCount, pageDone, pageRewarded, recordSighting, atlasInView } from '../web/src/data/atlas.js';
import { CAMPAIGN, WORLDS, voyageDef } from '../web/src/data/worlds.js';
import { createGame } from '../web/src/world/game.js';
import { ICONS } from '../web/src/ui/icons.js';
import { loadSave } from '../web/src/platform/save.js';
import { backupCode, readBackup } from '../web/src/platform/backup.js';

const TYPES = ['lair', 'floe', 'isle', 'rock', 'whirlpool', 'pirates', 'pod', 'whale', 'storm', 'calm', 'current', 'weather'];

// Everywhere worth standing in a voyage: the start and every thing in it.
function spots(game) {
  const L = game.level;
  return [
    [game.boat.x, game.boat.y],
    ...L.krakens.map((k) => [k.x, k.y]),
    ...L.floes.map((f) => [f.cx, f.cy]),
    ...L.islands.map((i) => [i.cx, i.cy]),
    ...L.rocks.map((r) => [r.x, r.y]),
    ...[...L.whirlpools, ...L.storms, ...L.calms, ...L.currents].map((w) => [w.x, w.y]),
    ...game.pirates.ships.map((s) => [s.x, s.y]),
    ...game.life.pods.map((p) => [p.x, p.y]),
    ...game.life.whales.map((w) => [w.x, w.y]),
  ];
}

test('every page and entry is complete, and every world has a page', () => {
  assert.equal(ATLAS_TOTAL, ENTRIES.length);
  assert.equal(new Set(ENTRIES.map((e) => e.id)).size, ENTRIES.length, 'entry ids unique');
  assert.equal(new Set(PAGES.map((p) => p.id)).size, PAGES.length, 'page ids unique');
  for (const p of PAGES) {
    assert.ok(p.name && /^#[0-9a-f]{6}$/i.test(p.color), p.id);
    assert.ok(p.entries.length >= 4, p.id);
  }
  for (const e of ENTRIES) {
    assert.ok(e.name && e.text, e.id);
    assert.ok(ICONS.includes(e.icon), `${e.id} icon ${e.icon}`);
    assert.ok(TYPES.includes(e.match.type), `${e.id} ${e.match.type}`);
    assert.equal(entryById(e.id).page, e.page);
  }
  for (const w of WORLDS) assert.ok(pageById(w.id), `a page for ${w.id}`);
  assert.equal(entryById('nope'), null);
  assert.equal(pageById('nope'), null);
});

test('every entry can be met somewhere in the voyages', () => {
  const save = loadSave();
  const seen = new Set();
  for (const v of CAMPAIGN) {
    const game = createGame(voyageDef(v.id), {});
    for (const [x, y] of spots(game)) {
      game.boat.x = x;
      game.boat.y = y;
      for (const id of atlasInView(game, save)) seen.add(id);
    }
  }
  assert.deepEqual(ENTRIES.filter((e) => !seen.has(e.id)).map((e) => e.id), []);
});

test('a thing is met only once the boat comes near it', () => {
  const save = loadSave();
  const v = CAMPAIGN.find((c) => createGame(voyageDef(c.id), {}).level.krakens.some((k) => k.look === 'kraken'));
  const game = createGame(voyageDef(v.id), {});
  const k = game.level.krakens.find((q) => q.look === 'kraken');
  game.boat.x = k.x + SIGHT + k.r + 40;
  game.boat.y = k.y;
  assert.ok(!atlasInView(game, save).includes('kraken'));
  game.boat.x = k.x + SIGHT * 0.5;
  assert.ok(atlasInView(game, save).includes('kraken'));
  // Once written in, it isn't news again.
  recordSighting(save, 'kraken');
  assert.ok(!atlasInView(game, save).includes('kraken'));
  // Weather is met from the start of a foggy voyage.
  const foggy = CAMPAIGN.map((c) => createGame(voyageDef(c.id), {})).find((g) => g.level.weather.fog >= 0.4);
  assert.ok(atlasInView(foggy, save).includes('fog'));
  // No game, nothing seen.
  assert.deepEqual(atlasInView(null, save), []);
});

test('entries are written once, and a full page pays once', () => {
  const save = loadSave();
  const coins = save.wallet.coins;
  const pearls = save.wallet.blackPearls;
  assert.equal(recordSighting(save, 'nope'), null);
  const page = pageById('volcano');
  const [first, ...rest] = page.entries;
  const r = recordSighting(save, first.id);
  assert.equal(r.entry.id, first.id);
  assert.equal(r.page, null);
  assert.ok(hasMet(save, first.id));
  assert.equal(recordSighting(save, first.id), null);
  assert.equal(atlasCount(save, 'volcano'), 1);
  for (const e of rest.slice(0, -1)) assert.equal(recordSighting(save, e.id).page, null);
  assert.equal(pageDone(save, 'volcano'), false);
  assert.equal(save.wallet.coins, coins);
  const last = recordSighting(save, rest.at(-1).id);
  assert.equal(last.page.id, 'volcano');
  assert.ok(pageDone(save, 'volcano') && pageRewarded(save, 'volcano'));
  assert.equal(save.wallet.coins, coins + PAGE_REWARD.coins);
  assert.equal(save.wallet.blackPearls, pearls + PAGE_REWARD.blackPearls);
  // Everything else filled in: every page pays, once.
  for (const e of ENTRIES) recordSighting(save, e.id);
  assert.equal(atlasCount(save), ATLAS_TOTAL);
  assert.equal(save.wallet.coins, coins + PAGES.length * PAGE_REWARD.coins);
  assert.equal(save.wallet.blackPearls, pearls + PAGES.length * PAGE_REWARD.blackPearls);
});

test('the atlas travels in a backup code', async () => {
  const save = loadSave();
  for (const e of pageById('home').entries) recordSighting(save, e.id);
  recordSighting(save, 'duck');
  save.atlasSeen = 7;
  const r = await readBackup(await backupCode(save));
  assert.equal(r.ok, true);
  assert.equal(atlasCount(r.save), pageById('home').entries.length + 1);
  assert.ok(pageRewarded(r.save, 'home'));
  assert.ok(hasMet(r.save, 'duck'));
  assert.equal(r.save.atlasSeen, 7);
});
