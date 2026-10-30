import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROWS, PIECES, HARBOR_TOTAL, HARBOR_COST, ROW_PEARLS, pieceById, isBuilt, harborBuilt, waitingOn, canBuild, rowDone, buildPiece, nextPiece } from '../web/src/data/harbor.js';
import { loadSave } from '../web/src/platform/save.js';
import { backupCode, readBackup } from '../web/src/platform/backup.js';
import { drawHarbor } from '../web/src/render/harbor.js';

// A canvas context that ignores drawing but checks every point is a number.
function stubContext() {
  const bad = [];
  const check = (name) => (...args) => {
    if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) bad.push(`${name}(${args.join(', ')})`);
    return { addColorStop() {} };
  };
  const ctx = new Proxy(
    { globalAlpha: 1 },
    {
      get: (t, k) => (k in t ? t[k] : check(String(k))),
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    },
  );
  return { ctx, bad };
}

globalThis.Path2D = class {
  constructor() {
    return new Proxy(this, { get: () => () => {} });
  }
};

// Build everything in an order the needs allow.
function buildAll(save) {
  save.wallet.coins += HARBOR_COST;
  let p;
  while ((p = nextPiece(save))) assert.ok(buildPiece(save, p.id), p.id);
}

test('every piece has a row, a price and needs that can be met', () => {
  assert.equal(HARBOR_TOTAL, 14);
  assert.equal(new Set(PIECES.map((p) => p.id)).size, PIECES.length, 'ids unique');
  for (const p of PIECES) {
    assert.ok(ROWS.some((r) => r.id === p.row), p.id);
    assert.ok(Number.isInteger(p.price) && p.price > 0, p.id);
    assert.ok(p.name && p.text, p.id);
    for (const id of p.needs || []) assert.ok(pieceById(id), `${p.id} needs ${id}`);
  }
  for (const r of ROWS) assert.ok(PIECES.filter((p) => p.row === r.id).length >= 3, r.id);
  assert.equal(HARBOR_COST, PIECES.reduce((sum, p) => sum + p.price, 0));
  assert.equal(pieceById('nope'), null);
  // No piece waits on itself, however far round.
  const deep = (id, seen = []) => {
    assert.ok(!seen.includes(id), `cycle through ${id}`);
    for (const n of pieceById(id).needs || []) deep(n, [...seen, id]);
  };
  for (const p of PIECES) deep(p.id);
});

test('a piece needs the coins and what comes before it', () => {
  const save = loadSave();
  save.wallet.coins = 1000;
  assert.deepEqual(harborBuilt(save), []);
  // The lamp needs the tower first.
  assert.equal(canBuild(save, pieceById('lamp')), false);
  assert.deepEqual(waitingOn(save, pieceById('lamp')).map((p) => p.id), ['tower']);
  assert.equal(buildPiece(save, 'lamp'), null);
  assert.equal(buildPiece(save, 'nope'), null);
  assert.equal(save.wallet.coins, 1000);
  // The jetty is the cheapest start.
  assert.equal(nextPiece(save).id, 'jetty');
  const r = buildPiece(save, 'jetty');
  assert.equal(r.piece.id, 'jetty');
  assert.equal(r.row, null);
  assert.equal(save.wallet.coins, 880);
  assert.ok(isBuilt(save, 'jetty'));
  // Not twice.
  assert.equal(buildPiece(save, 'jetty'), null);
  assert.equal(save.wallet.coins, 880);
  // Too dear.
  save.wallet.coins = 100;
  assert.equal(buildPiece(save, 'tower'), null);
  assert.equal(isBuilt(save, 'tower'), false);
  assert.equal(save.wallet.coins, 100);
  // With the jetty built the hut and rowing boat open up; nextPiece is the cheapest.
  assert.equal(nextPiece(save).id, 'dinghy');
});

test('finishing a row brings one black pearl, once', () => {
  const save = loadSave();
  save.wallet.coins = 5000;
  const pearls = save.wallet.blackPearls;
  assert.equal(buildPiece(save, 'jetty').row, null);
  assert.equal(buildPiece(save, 'quay').row, null);
  assert.equal(rowDone(save, 'docks'), false);
  const r = buildPiece(save, 'breakwater');
  assert.equal(r.row.id, 'docks');
  assert.ok(rowDone(save, 'docks'));
  assert.equal(save.wallet.blackPearls, pearls + ROW_PEARLS);
  assert.equal(save.wallet.coins, 5000 - 120 - 450 - 900);
});

test('the whole harbor can be built, and costs what it says', () => {
  const save = loadSave();
  const pearls = save.wallet.blackPearls;
  buildAll(save);
  assert.equal(harborBuilt(save).length, HARBOR_TOTAL);
  assert.equal(save.wallet.coins, 0);
  assert.equal(save.wallet.blackPearls, pearls + ROWS.length * ROW_PEARLS);
  for (const r of ROWS) assert.ok(rowDone(save, r.id), r.id);
  assert.equal(nextPiece(save), null);
});

test('the harbor draws with nothing, a little and everything built', () => {
  const save = loadSave();
  const stages = [[]];
  save.wallet.coins = HARBOR_COST;
  let p;
  while ((p = nextPiece(save))) {
    buildPiece(save, p.id);
    stages.push(harborBuilt(save));
  }
  for (const built of stages) {
    for (const [w, h, t] of [[300, 180, 0], [250, 150, 3.7], [640, 200, 91.2], [120, 320, 12]]) {
      const { ctx, bad } = stubContext();
      drawHarbor(ctx, built, w, h, t);
      assert.deepEqual(bad, [], `${built.join(',')} at ${w}x${h}`);
    }
  }
});

test('what is built travels in a backup code', async () => {
  const save = loadSave();
  buildAll(save);
  const r = await readBackup(await backupCode(save));
  assert.equal(r.ok, true);
  assert.deepEqual(harborBuilt(r.save), PIECES.map((p) => p.id));
});
