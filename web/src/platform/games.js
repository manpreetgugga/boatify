// Google Play Games: sign-in, leaderboards and a copy of the progress in the
// cloud. Android only, and only once the app is built with a Play Games app
// id (docs/PLAY_STORE.md): the shell adds window.BoatifyGames then, and
// without it everything here is off and Settings shows none of it. The shell
// answers through window.BoatifyNative.onGames(event), passed to gamesEvent.
//
// The cloud copy is a backup code (platform/backup.js). A phone only writes
// it once it has looked at what is already there, so a new phone never
// writes its empty save over the progress made on another.

import { totalStars } from './save.js';
import { toMeters } from '../physics/sailing.js';

const bridge = () => (typeof window !== 'undefined' ? window.BoatifyGames : undefined);

export function hasGames() {
  return !!bridge();
}

let state = { signedIn: false, name: '' };
const listeners = new Set();
const waiting = { saved: [], loaded: [] };
// How long an answer from Play Games may take before it counts as none.
const PATIENCE = 30000;

function call(name, ...args) {
  try {
    const b = bridge();
    if (b && b[name]) return b[name](...args);
  } catch {
    // Play Games is optional.
  }
  return undefined;
}

// { signedIn, name }, read from the shell the first time.
export function gamesState() {
  if (!hasGames()) return { signedIn: false, name: '' };
  if (!state.read) {
    try {
      const s = JSON.parse(call('state') || '{}');
      state = { signedIn: !!s.signedIn, name: String(s.name || ''), read: true };
    } catch {
      state = { ...state, read: true };
    }
  }
  return state;
}

// fn(state) whenever signing in changes.
export function onGamesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// An answer from the shell: { kind: 'signin', ok, name }, { kind: 'saved', ok }
// or { kind: 'loaded', ok, code }.
export function gamesEvent(e) {
  if (!e || typeof e !== 'object') return;
  if (e.kind === 'signin') {
    state = { signedIn: !!e.ok, name: e.ok ? String(e.name || '') : '', read: true };
    for (const fn of listeners) fn(state);
  } else if (e.kind === 'saved' || e.kind === 'loaded') {
    const list = waiting[e.kind].splice(0);
    const answer = e.kind === 'saved' ? !!e.ok : { ok: !!e.ok, code: e.ok ? String(e.code || '') : '' };
    for (const done of list) done(answer);
  }
}

function ask(kind, start, none) {
  return new Promise((resolve) => {
    const done = (answer) => {
      clearTimeout(timer);
      resolve(answer);
    };
    const timer = setTimeout(() => {
      const i = waiting[kind].indexOf(done);
      if (i >= 0) waiting[kind].splice(i, 1);
      resolve(none);
    }, PATIENCE);
    waiting[kind].push(done);
    if (waiting[kind].length === 1) start();
  });
}

export function signIn() {
  call('signInNow');
}

export function showLeaderboards() {
  call('showLeaderboards');
}

export function submitScore(board, score) {
  call('submitScore', board, score);
}

// Resolves to true once Play Games has the code.
export function cloudSave(code, about) {
  if (!gamesState().signedIn) return Promise.resolve(false);
  return ask('saved', () => call('cloudSave', code, about), false);
}

// Resolves to { ok, code }: ok false when Play Games couldn't be asked (or
// only had an out-of-date list), code '' when there's nothing in the cloud.
export function cloudLoad() {
  if (!gamesState().signedIn) return Promise.resolve({ ok: false, code: '' });
  return ask('loaded', () => call('cloudLoad'), { ok: false, code: '' });
}

// --- What goes up -----------------------------------------------------------

// The leaderboards, by the names the shell knows them by.
export const BOARDS = ['stars', 'sea', 'streak', 'wins'];

export function gameScores(save) {
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  return {
    stars: totalStars(save),
    sea: n(toMeters(Number(save.openSea.best) || 0)), // metres east on the Open Sea
    streak: n(save.streak.best), // days in a row on the daily voyage
    wins: n(save.regatta.wins),
  };
}

// The scores worth sending: some, and better than the ones sent before.
export function newScores(scores, sent) {
  return BOARDS.filter((b) => scores[b] > 0 && scores[b] > (sent[b] || 0)).map((b) => [b, scores[b]]);
}

// After signing in on this phone, what to do with the progress found in the
// cloud: 'none' when there's none (or it can't be read), 'keep' when it has
// no more than this phone, 'ask' when it has more of something.
export function cloudChoice(cloud, here) {
  if (!cloud) return 'none';
  const more = ['stars', 'voyages', 'medals'].some((k) => (cloud[k] || 0) > (here[k] || 0));
  return more ? 'ask' : 'keep';
}

// The phone's own note of the cloud copy, kept apart from the save so a
// backup code never carries it: whether it has looked at the cloud yet, when
// it last wrote there and the check of the code it wrote.
const MEMO_KEY = 'boatify.cloud.v1';
// Copies after a voyage are this far apart at the least; leaving the app or
// tapping Save writes one at once.
export const CLOUD_GAP = 3 * 60 * 1000;

export function loadCloudMemo() {
  try {
    const m = JSON.parse(window.localStorage.getItem(MEMO_KEY) || 'null');
    if (m && typeof m === 'object') return { checked: !!m.checked, last: Number(m.last) || 0, sum: String(m.sum || '') };
  } catch {
    // A fresh note, then.
  }
  return { checked: false, last: 0, sum: '' };
}

export function storeCloudMemo(memo) {
  try {
    window.localStorage.setItem(MEMO_KEY, JSON.stringify(memo));
  } catch {
    // Kept in memory for this run.
  }
}

export function cloudDue(memo, now, force = false) {
  return memo.checked && (force || now - memo.last >= CLOUD_GAP);
}
