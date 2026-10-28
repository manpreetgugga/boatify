import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPages } from '../scripts/build.mjs';

test('the bundle is one self-contained page', () => {
  const { full, artifact } = buildPages();
  const js = full.match(/<script>\n([\s\S]*)\n<\/script>/)[1];
  assert.doesNotThrow(() => new Function(js));
  assert.ok(!/^\s*(import|export)\s/m.test(js), 'no module syntax left');
  assert.ok(!/src="|href="(?!data:)/.test(full.replace(/<a [^>]*>/g, '')), 'no external files');
  assert.ok(full.includes('data:font/woff2;base64,'));
  assert.ok(full.startsWith('<!doctype html>'));
  assert.ok(!artifact.includes('<!doctype') && !artifact.includes('<body'));
  assert.match(artifact, /<title>[^<]+<\/title>/);
});
