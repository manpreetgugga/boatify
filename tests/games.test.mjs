import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasGames, gamesState, gamesEvent, onGamesChange, cloudSave, cloudLoad, submitScore, gameScores, newScores, cloudChoice, cloudDue, loadCloudMemo, storeCloudMemo, CLOUD_GAP, BOARDS } from '../web/src/platform/games.js';
import { loadSave } from '../web/src/platform/save.js';
import { backupCode, readBackup, summarize } from '../web/src/platform/backup.js';
import { toMeters } from '../web/src/physics/sailing.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const KT = 'android/app/src/main/java/io/github/manpreetgugga/boatify/';

// A stand-in for the Android shell's BoatifyGames bridge.
function fakeShell(signedIn = true) {
  const calls = [];
  const store = {};
  globalThis.window = {
    BoatifyGames: {
      state: () => JSON.stringify({ signedIn, name: signedIn ? 'Skipper' : '' }),
      signInNow: () => calls.push(['signIn']),
      showLeaderboards: () => calls.push(['boards']),
      submitScore: (b, s) => calls.push(['score', b, s]),
      cloudSave: (code, about) => calls.push(['save', code, about]),
      cloudLoad: () => calls.push(['load']),
    },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)) },
  };
  return calls;
}

test('without the shell, Play Games is off and asks nothing', async () => {
  delete globalThis.window;
  assert.equal(hasGames(), false);
  assert.deepEqual(gamesState(), { signedIn: false, name: '' });
  assert.equal(await cloudSave('NP1.x.y', ''), false);
  assert.deepEqual(await cloudLoad(), { ok: false, code: '' });
  submitScore('stars', 3); // nothing to call, nothing thrown
  assert.deepEqual(loadCloudMemo(), { checked: false, last: 0, sum: '' }, 'no storage: a fresh note');
});

test('the scores on the leaderboards come from the save, and only better ones go up', () => {
  const save = loadSave();
  assert.deepEqual(gameScores(save), { stars: 0, sea: 0, streak: 0, wins: 0 });
  save.levels.a = { best: 40, stars: 3 };
  save.levels.b = { best: 50, stars: 2 };
  save.openSea.best = 5000;
  save.streak.best = 4;
  save.regatta.wins = 2;
  const scores = gameScores(save);
  assert.deepEqual(scores, { stars: 5, sea: Math.floor(toMeters(5000)), streak: 4, wins: 2 });
  assert.deepEqual(Object.keys(scores), BOARDS);
  assert.deepEqual(newScores({ stars: 5, sea: 0, streak: 4, wins: 2 }, {}), [['stars', 5], ['streak', 4], ['wins', 2]], 'nothing for an empty board');
  assert.deepEqual(newScores(scores, { stars: 5, sea: scores.sea, streak: 3, wins: 9 }), [['streak', 4]]);
});

test('a new phone asks before the cloud has more, and keeps its own otherwise', () => {
  const here = { stars: 10, voyages: 4, medals: 2, coins: 50 };
  assert.equal(cloudChoice(null, here), 'none');
  assert.equal(cloudChoice({ stars: 10, voyages: 4, medals: 2, coins: 900 }, here), 'keep', 'coins alone are no reason to ask');
  assert.equal(cloudChoice({ stars: 3, voyages: 1, medals: 0 }, here), 'keep');
  assert.equal(cloudChoice({ stars: 3, voyages: 9, medals: 0 }, here), 'ask');
  assert.equal(cloudChoice({ stars: 0, voyages: 0, medals: 3 }, { stars: 0, voyages: 0, medals: 0 }), 'ask');
});

test('the cloud is written only once the phone has looked, and not too often', () => {
  const now = 10 * CLOUD_GAP;
  assert.equal(cloudDue({ checked: false, last: 0 }, now, true), false, 'never before looking, even when asked');
  assert.equal(cloudDue({ checked: true, last: 0 }, now), true);
  assert.equal(cloudDue({ checked: true, last: now - CLOUD_GAP / 2 }, now), false);
  assert.equal(cloudDue({ checked: true, last: now - CLOUD_GAP / 2 }, now, true), true, 'leaving the app writes at once');
});

test('the shell signs in, saves and loads through the bridge', async () => {
  const calls = fakeShell(true);
  try {
    assert.equal(hasGames(), true);
    gamesEvent({ kind: 'signin', ok: false });
    assert.equal(gamesState().signedIn, false);
    let told = null;
    const stop = onGamesChange((s) => (told = s));
    gamesEvent({ kind: 'signin', ok: true, name: 'Skipper' });
    assert.deepEqual([told.signedIn, told.name], [true, 'Skipper']);
    stop();

    const saved = cloudSave('NP1.abc.0123abcd', '★ 3');
    const again = cloudSave('NP1.abc.0123abcd', '★ 3');
    assert.equal(calls.filter((c) => c[0] === 'save').length, 1, 'one write at a time');
    gamesEvent({ kind: 'saved', ok: true });
    assert.deepEqual([await saved, await again], [true, true]);

    const loaded = cloudLoad();
    gamesEvent({ kind: 'loaded', ok: true, code: 'NP1.abc.0123abcd' });
    assert.deepEqual(await loaded, { ok: true, code: 'NP1.abc.0123abcd' });
    const none = cloudLoad();
    gamesEvent({ kind: 'loaded', ok: false, code: 'ignored' });
    assert.deepEqual(await none, { ok: false, code: '' });

    storeCloudMemo({ checked: true, last: 5, sum: 'abc' });
    assert.deepEqual(loadCloudMemo(), { checked: true, last: 5, sum: 'abc' });
    gamesEvent(null);
    gamesEvent({ kind: 'nonsense' });
  } finally {
    delete globalThis.window;
  }
});

test("the cloud's copy is a backup code that reads back to the same progress", async () => {
  const save = loadSave();
  save.levels.a = { best: 40, stars: 3 };
  save.medals.first = '2026-10-30';
  const r = await readBackup(await backupCode(save));
  assert.ok(r.ok);
  assert.deepEqual(r.summary, summarize(save));
  assert.equal(cloudChoice(r.summary, summarize(loadSave())), 'ask', 'a blank phone is offered it');
  assert.equal(cloudChoice(r.summary, summarize(save)), 'keep', 'the same phone keeps its own');
});

test('the app only starts Play Games with an app id, and the build never needs one', () => {
  const gradle = read('android/app/build.gradle.kts');
  assert.match(gradle, /setting\("PLAY_GAMES_APP_ID"\)\.orEmpty\(\)/);
  assert.match(gradle, /resValue\("string", "play_games_app_id", playGamesAppId\)/);
  assert.match(gradle, /play-services-games-v2:/);
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /com\.google\.android\.gms\.games\.APP_ID"\s+android:value="@string\/play_games_app_id"/);
  const main = read(`${KT}MainActivity.kt`);
  assert.match(main, /if \(BuildConfig\.PLAY_GAMES_APP_ID\.isNotEmpty\(\)\) \{\s+games = GamesBridge/);
  assert.match(main, /try \{\s+games\?\.start\(\)/);
  const bridge = read(`${KT}GamesBridge.kt`);
  assert.equal((bridge.match(/PlayGamesSdk\.initialize/g) || []).length, 1, 'initialised in one place, start()');
  for (const name of ['state', 'signInNow', 'showLeaderboards', 'submitScore', 'cloudSave', 'cloudLoad']) {
    assert.match(bridge, new RegExp(`@JavascriptInterface\\s+fun ${name}\\(`), `the page can call ${name}`);
  }
  // Only the Play bundle gets the app id: a sideloaded APK isn't signed with the key Play Games knows.
  const ci = read('.github/workflows/build.yml');
  const apk = ci.slice(ci.indexOf('- name: Build release APK'), ci.indexOf('- name: Unpack the upload key'));
  const bundle = ci.slice(ci.indexOf('- name: Build release bundle'), ci.indexOf('- name: Name the APK'));
  assert.doesNotMatch(apk, /PLAY_GAMES/);
  assert.match(bundle, /PLAY_GAMES_APP_ID: \$\{\{ secrets\.PLAY_GAMES_APP_ID/);
});
