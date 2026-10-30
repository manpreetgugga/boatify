import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ASK_EVERY,
  URGENT_PRIORITY,
  hasUpdates,
  isUrgent,
  updatePlan,
  titleNotice,
  installUpdates,
  onUpdateInfo,
  considerUpdate,
  applyUpdate,
  updateNotice,
  resetUpdates,
} from '../web/src/platform/updates.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

// A stand-in for the Android shell's BoatifyUpdates bridge.
function fakeBridge() {
  const calls = [];
  return {
    calls,
    check: () => calls.push(['check']),
    start: (immediate) => calls.push(['start', immediate]),
    restart: () => calls.push(['restart']),
  };
}

function fakeStorage() {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}

// Play's answer for an ordinary new version.
const NEWER = { available: true, downloading: false, downloaded: false, immediate: true, flexible: true, priority: 0, staleDays: 2, version: 4300, current: 4201, minVersion: 0 };

beforeEach(() => {
  resetUpdates();
  delete globalThis.window;
  globalThis.localStorage = fakeStorage();
});

test('without the shell (GitHub APK, browser), updates do nothing', () => {
  assert.equal(hasUpdates(), false);
  installUpdates({ canAsk: () => true, notice: () => assert.fail('no notice without Play') });
  assert.equal(applyUpdate(), false);
  assert.equal(considerUpdate(), null);
  assert.equal(updateNotice(), null);
});

test('an ordinary update downloads in the background, asked for at most once a day', () => {
  const now = 1_800_000_000_000;
  assert.equal(updatePlan(NEWER, { lastAsked: 0, now }), 'flexible');
  assert.equal(updatePlan(NEWER, { lastAsked: now - ASK_EVERY + 60_000, now }), null);
  assert.equal(updatePlan(NEWER, { lastAsked: now - ASK_EVERY, now }), 'flexible');
  assert.equal(updatePlan({ ...NEWER, flexible: false }, { now }), null);
  assert.equal(updatePlan({ ...NEWER, available: false }, { now }), null);
  assert.equal(updatePlan({ ...NEWER, downloading: true }, { now }), null);
  assert.equal(updatePlan(null), null);
});

test('a downloaded update waits for a restart from the title', () => {
  assert.equal(updatePlan({ ...NEWER, available: false, downloaded: true }), 'restart');
  assert.equal(titleNotice({ ...NEWER, downloaded: true }, false), 'restart');
  assert.equal(titleNotice(NEWER, false), null);
});

test('priority 5 or a Remote Config minimum makes an update urgent: asked at once, once a launch', () => {
  assert.equal(URGENT_PRIORITY, 5);
  assert.equal(isUrgent({ ...NEWER, priority: 4 }), false);
  assert.equal(isUrgent({ ...NEWER, priority: 5 }), true);
  assert.equal(isUrgent({ ...NEWER, minVersion: 4300 }), true);
  assert.equal(isUrgent({ ...NEWER, minVersion: 4201 }), false);
  // Asked once a day doesn't hold it back...
  const now = 1_800_000_000_000;
  assert.equal(updatePlan({ ...NEWER, priority: 5 }, { lastAsked: now, now }), 'immediate');
  assert.equal(updatePlan({ ...NEWER, priority: 5, immediate: false }, { lastAsked: now, now }), 'flexible');
  // ...but once turned down this launch, the title says so instead of asking again.
  assert.equal(updatePlan({ ...NEWER, priority: 5 }, { urgentAsked: true }), null);
  assert.equal(titleNotice({ ...NEWER, priority: 5 }, true), 'outdated');
  assert.equal(titleNotice({ ...NEWER, priority: 5, available: false }, true), null);
});

test('nothing is asked mid-voyage; the title asks, and only once that day', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyUpdates: b };
  let onTitle = false;
  const notices = [];
  installUpdates({ canAsk: () => onTitle, notice: (s) => notices.push(s) });
  assert.deepEqual(b.calls, [['check']]);
  assert.equal(hasUpdates(), true);

  onUpdateInfo(NEWER);
  assert.deepEqual(b.calls, [['check']], 'not while sailing');

  onTitle = true;
  const now = 1_800_000_000_000;
  assert.equal(considerUpdate(now), 'flexible');
  assert.deepEqual(b.calls.at(-1), ['start', false]);
  assert.equal(globalThis.localStorage.getItem('boatify.updateAsked'), String(now));
  assert.equal(considerUpdate(now + 3600_000), null);
  assert.equal(b.calls.filter((c) => c[0] === 'start').length, 1);

  // Downloaded: the title offers the restart, and the button restarts.
  onUpdateInfo({ ...NEWER, available: false, downloaded: true });
  assert.equal(notices.at(-1), 'restart');
  assert.equal(updateNotice(), 'restart');
  assert.equal(applyUpdate(), true);
  assert.deepEqual(b.calls.at(-1), ['restart']);
});

test('an urgent update opens Play at once, and a refusal leaves an Update button', () => {
  const b = fakeBridge();
  globalThis.window = { BoatifyUpdates: b };
  const notices = [];
  installUpdates({ canAsk: () => true, notice: (s) => notices.push(s) });
  onUpdateInfo({ ...NEWER, minVersion: 4300 });
  assert.deepEqual(b.calls.at(-1), ['start', true]);
  // The player said no: Play reports the same update again.
  onUpdateInfo({ ...NEWER, minVersion: 4300 });
  assert.equal(b.calls.filter((c) => c[0] === 'start').length, 1);
  assert.equal(notices.at(-1), 'outdated');
  assert.equal(applyUpdate(), true);
  assert.deepEqual(b.calls.at(-1), ['start', true]);
  // An urgent ask doesn't use up the day's ordinary one.
  assert.equal(globalThis.localStorage.getItem('boatify.updateAsked'), null);
});

test('the game survives storage that throws', () => {
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const b = fakeBridge();
  globalThis.window = { BoatifyUpdates: b };
  installUpdates({ canAsk: () => true, notice: () => {} });
  onUpdateInfo(NEWER);
  assert.deepEqual(b.calls.at(-1), ['start', false]);
});

test('the Android shell, the page and CI are wired for in-app updates', () => {
  const gradle = read('android/app/build.gradle.kts');
  assert.match(gradle, /com\.google\.android\.play:app-update:/);
  assert.match(gradle, /com\.google\.firebase:firebase-config/);

  const activity = read('android/app/src/main/java/io/github/manpreetgugga/boatify/MainActivity.kt');
  // Only a copy Google Play installed gets the bridge.
  assert.match(activity, /if \(UpdateBridge\.fromPlay\(this@MainActivity\)\) \{[\s\S]*?addJavascriptInterface\(it, "BoatifyUpdates"\)/);
  assert.match(activity, /requestCode == UpdateBridge\.REQUEST\) updates\?\.onResult\(resultCode\)/);

  const bridge = read('android/app/src/main/java/io/github/manpreetgugga/boatify/UpdateBridge.kt');
  assert.match(bridge, /installer == PLAY_STORE/);
  assert.match(bridge, /"com\.android\.vending"/);
  assert.match(bridge, /MIN_VERSION = "min_version_code"/);
  assert.match(bridge, /if \(!BuildConfig\.FIREBASE \|\| FirebaseApp\.getApps\(activity\)\.isEmpty\(\)\) return/);
  for (const key of ['available', 'downloading', 'downloaded', 'immediate', 'flexible', 'priority', 'current', 'minVersion']) {
    assert.match(bridge, new RegExp(`\\.put\\("${key}"`), key);
  }

  const main = read('web/src/main.js');
  assert.match(main, /installUpdates\(\{ canAsk: \(\) => mode === 'title'/);
  assert.match(main, /if \(withMenu\) ui\.title\(save\);\s+considerUpdate\(\);/);
  assert.match(read('web/src/platform/native.js'), /onUpdate\(info\) \{\s+if \(handlers\.update\) handlers\.update\(info\);/);
  assert.match(read('web/src/ui/screens.js'), /\$\{notice \? updateLine\(notice\) : talk\}/);

  assert.match(read('.github/workflows/build.yml'), /inAppUpdatePriority: \$\{\{ vars\.PLAY_UPDATE_PRIORITY \|\| 0 \}\}/);
  const docs = read('docs/PLAY_STORE.md');
  assert.match(docs, /internal app sharing/i);
  assert.match(docs, /min_version_code/);
});
