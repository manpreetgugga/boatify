import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS, cleanParams, track, hasAnalytics, analyticsOn, applyAnalytics, reportError, installErrorReports, worldReached, resetAnalyticsSession } from '../web/src/platform/analytics.js';

// A stand-in for the Android shell's BoatifyAnalytics bridge.
function fakeBridge(defaultOn = true) {
  const calls = [];
  return {
    calls,
    log: (name, json) => calls.push(['log', name, JSON.parse(json)]),
    error: (msg, stack, voyage) => calls.push(['error', msg, stack, voyage]),
    setEnabled: (on) => calls.push(['setEnabled', on]),
    defaultOn: () => defaultOn,
  };
}

beforeEach(() => {
  resetAnalyticsSession();
  delete globalThis.window;
});

test('without the shell, analytics does nothing at all', () => {
  assert.equal(hasAnalytics(), false);
  assert.equal(track('voyage_start', { level: 'lost-oar' }), false);
  assert.equal(analyticsOn({ analytics: true }), false);
  assert.equal(applyAnalytics({ analytics: true }), false);
  assert.equal(reportError('boom', '', 'lost-oar'), false);
});

test('only the listed events go out, with only their listed fields', () => {
  assert.equal(cleanParams('made_up_event', { a: 1 }), null);
  assert.deepEqual(cleanParams('voyage_complete', { level: 'lost-oar', world: 'home', stars: 3, time: 71.234, bumps: 2, name: 'Asha', email: 'a@b.c' }), {
    level: 'lost-oar',
    world: 'home',
    stars: 3,
    time: 71.2,
    bumps: 2,
  });
  // Free text, long strings and anything not a number or a short id are dropped.
  assert.deepEqual(cleanParams('share', { what: 'my progress!' }), {});
  assert.deepEqual(cleanParams('language', { lang: 'x'.repeat(41) }), {});
  assert.deepEqual(cleanParams('open_sea_end', { distance: Infinity, gates: NaN }), {});
  assert.deepEqual(cleanParams('backup_used', { how: { code: 'secret' } }), {});
});

test('events fit Firebase limits', () => {
  for (const [name, keys] of Object.entries(EVENTS)) {
    assert.match(name, /^[a-z][a-z_]{0,39}$/, name);
    assert.ok(keys.length <= 25, name);
    for (const k of keys) assert.match(k, /^[a-z][a-z_]{0,39}$/, `${name}.${k}`);
  }
});

test('with the shell, an event reaches it as JSON', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyAnalytics: b };
  assert.equal(track('voyage_start', { level: 'lost-oar', world: 'home', mode: 'voyage', stars: 3 }), true);
  assert.deepEqual(b.calls, [['log', 'voyage_start', { level: 'lost-oar', world: 'home', mode: 'voyage' }]]);
});

test("the player's choice wins; until then it follows the shell's default", () => {
  globalThis.window = { BoatifyAnalytics: fakeBridge(false) };
  assert.equal(analyticsOn({ analytics: null }), false);
  assert.equal(analyticsOn({ analytics: true }), true);
  const b = fakeBridge(true);
  globalThis.window = { BoatifyAnalytics: b };
  assert.equal(analyticsOn({ analytics: null }), true);
  assert.equal(analyticsOn({ analytics: false }), false);
  assert.equal(applyAnalytics({ analytics: false }), false);
  assert.equal(applyAnalytics({ analytics: null }), true);
  assert.deepEqual(b.calls, [['setEnabled', false], ['setEnabled', true]]);
});

test('script errors go as non-fatal reports, each once and only a few a session', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyAnalytics: b };
  assert.equal(reportError('x is undefined', 'at a\nat b', 'lost-oar'), true);
  assert.equal(reportError('x is undefined', 'at a', 'lost-oar'), false);
  for (let i = 0; i < 20; i++) reportError(`error ${i}`, '', 'coral-maze');
  const sent = b.calls.filter((c) => c[0] === 'error');
  assert.equal(sent.length, 8);
  assert.deepEqual(sent[0], ['error', 'x is undefined', 'at a\nat b', 'lost-oar']);
});

test('window errors and unhandled rejections are caught with the voyage they happened on', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyAnalytics: b };
  const handlers = {};
  installErrorReports({ addEventListener: (type, fn) => (handlers[type] = fn) }, () => 'kraken-fog');
  handlers.error({ error: new Error('bad sail') });
  handlers.unhandledrejection({ reason: new Error('lost promise') });
  handlers.unhandledrejection({ reason: 'plain text' });
  const sent = b.calls.filter((c) => c[0] === 'error').map((c) => [c[1], c[3]]);
  assert.deepEqual(sent, [['bad sail', 'kraken-fog'], ['lost promise', 'kraken-fog'], ['plain text', 'kraken-fog']]);
});

test('a world counts as reached once, and not when one of its voyages is already home', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyAnalytics: b };
  assert.equal(worldReached('volcano', false), true);
  assert.equal(worldReached('volcano', false), false);
  assert.equal(worldReached('harbor', true), false);
  assert.deepEqual(b.calls, [['log', 'world_reached', { world: 'volcano' }]]);
});

// Every track() call in the game names an event on the list.
function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

test("the game only tracks events that are on the list", () => {
  const src = fileURLToPath(new URL('../web/src/', import.meta.url));
  const used = new Set();
  for (const f of files(src)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\btrack\('([a-z_]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 10, `only ${[...used]}`);
  for (const name of used) assert.ok(EVENTS[name], `${name} is not in EVENTS`);
});

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const KT = 'android/app/src/main/java/io/github/manpreetgugga/boatify/';

test('Firebase is only in a build with google-services.json, and only in the Play bundle', () => {
  const gradle = read('android/app/build.gradle.kts');
  assert.match(gradle, /val firebaseOn = file\("google-services\.json"\)\.exists\(\)\s+if \(firebaseOn\) \{\s+apply\(plugin = "com\.google\.gms\.google-services"\)\s+apply\(plugin = "com\.google\.firebase\.crashlytics"\)/);
  assert.match(gradle, /buildConfigField\("boolean", "FIREBASE", firebaseOn\.toString\(\)\)/);
  const main = read(`${KT}MainActivity.kt`);
  assert.match(main, /if \(BuildConfig\.FIREBASE && FirebaseApp\.getApps\(this@MainActivity\)\.isNotEmpty\(\)\) \{\s+try \{\s+analytics = AnalyticsBridge/);
  const bridge = read(`${KT}AnalyticsBridge.kt`);
  for (const name of ['defaultOn', 'setEnabled', 'log', 'error']) {
    assert.match(bridge, new RegExp(`@JavascriptInterface\\s+fun ${name}\\(`), `the page can call ${name}`);
  }
  // Never the advertising id, never for ads, and nothing until the page says so.
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  for (const [name, value] of [
    ['google_analytics_adid_collection_enabled', 'false'],
    ['google_analytics_default_allow_ad_storage', 'false'],
    ['google_analytics_default_allow_ad_user_data', 'false'],
    ['google_analytics_default_allow_ad_personalization_signals', 'false'],
    ['google_analytics_default_allow_analytics_storage', 'false'],
    ['firebase_analytics_collection_enabled', 'false'],
    ['firebase_crashlytics_collection_enabled', 'false'],
  ]) {
    assert.match(manifest, new RegExp(`android:name="${name}"\\s+android:value="${value}"`), name);
  }
  // The config is written for the bundle step only, and never committed.
  const ci = read('.github/workflows/build.yml');
  const apk = ci.slice(ci.indexOf('- name: Build release APK'), ci.indexOf('- name: Unpack the upload key'));
  const bundle = ci.slice(ci.indexOf('- name: Build release bundle'), ci.indexOf('- name: Name the APK'));
  assert.doesNotMatch(apk, /GOOGLE_SERVICES_JSON|google-services/);
  assert.match(bundle, /GOOGLE_SERVICES_JSON: \$\{\{ secrets\.GOOGLE_SERVICES_JSON \}\}/);
  assert.match(bundle, /rm -f app\/google-services\.json/);
  assert.match(read('.gitignore'), /^google-services\.json$/m);
});
