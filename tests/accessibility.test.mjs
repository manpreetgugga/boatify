import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C, setColorblind, rgba } from '../web/src/render/palette.js';
import { loadSave, DEFAULT_SETTINGS } from '../web/src/platform/save.js';
import { TEXT_SIZES } from '../web/src/ui/screens.js';

test('the colour-blind palette swaps good, warning and danger colours and swaps back', () => {
  const before = { ok: C.ok, warn: C.warn, danger: C.danger };
  setColorblind(true);
  assert.notEqual(C.ok, before.ok);
  assert.notEqual(C.danger, before.danger);
  assert.notEqual(C.ok, C.danger);
  setColorblind(false);
  assert.deepEqual({ ok: C.ok, warn: C.warn, danger: C.danger }, before);
});

test('rgba turns a hex colour into a canvas colour', () => {
  assert.equal(rgba('#ff4d4d', 0.5), 'rgba(255, 77, 77, 0.500)');
  assert.equal(rgba('#000000', 1), 'rgba(0, 0, 0, 1.000)');
});

test('a new save follows the phone for motion and uses normal text', () => {
  const save = loadSave();
  assert.equal(save.settings.colorblind, false);
  assert.equal(save.settings.reduceMotion, null);
  assert.equal(save.settings.textSize, 1);
  assert.ok(TEXT_SIZES.includes(DEFAULT_SETTINGS.textSize));
  assert.ok(TEXT_SIZES.every((v, i) => i === 0 || v > TEXT_SIZES[i - 1]), 'sizes go up');
});
