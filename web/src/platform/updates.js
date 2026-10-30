// Google Play in-app updates. Only a copy installed by Google Play has the
// BoatifyUpdates bridge (UpdateBridge.kt): the GitHub APK and the browser never
// hear of updates. The shell asks Play and answers through
// window.BoatifyNative.onUpdate(info); this side decides what to do with it.
//
// - A normal update downloads in the background (Play's "flexible" flow),
//   asked for at most once a day. Once it is down, the title offers
//   "Restart to update".
// - An urgent one (Play priority 5, or Remote Config's min_version_code above
//   this version) opens Play's full-screen "immediate" flow, once a launch;
//   turned down, the title says the version is out of date.
// - Nothing is ever asked mid-voyage: only on the title screen.

export const ASK_EVERY = 24 * 3600 * 1000;
export const URGENT_PRIORITY = 5;
const ASKED_KEY = 'boatify.updateAsked';

const bridge = () => (typeof window !== 'undefined' ? window.BoatifyUpdates : undefined);

export function hasUpdates() {
  const b = bridge();
  return !!(b && b.check);
}

// Is this update one the player shouldn't skip?
export function isUrgent(info) {
  if (!info) return false;
  return (info.priority || 0) >= URGENT_PRIORITY || (info.minVersion > 0 && info.current > 0 && info.current < info.minVersion);
}

// What to do with Play's answer: 'restart' (downloaded and waiting),
// 'immediate', 'flexible', or null (nothing, or not yet).
export function updatePlan(info, { lastAsked = 0, now = Date.now(), urgentAsked = false } = {}) {
  if (!info) return null;
  if (info.downloaded) return 'restart';
  if (!info.available || info.downloading) return null;
  if (isUrgent(info)) {
    if (info.immediate && !urgentAsked) return 'immediate';
    if (info.flexible && !urgentAsked) return 'flexible';
    return null;
  }
  if (info.flexible && now - lastAsked >= ASK_EVERY) return 'flexible';
  return null;
}

// What the title should say: 'restart', 'outdated' or null.
export function titleNotice(info, urgentAsked) {
  if (!info) return null;
  if (info.downloaded) return 'restart';
  if (urgentAsked && info.available && !info.downloading && isUrgent(info) && (info.immediate || info.flexible)) return 'outdated';
  return null;
}

function readAsked() {
  try {
    return Number(localStorage.getItem(ASKED_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeAsked(when) {
  try {
    localStorage.setItem(ASKED_KEY, String(when));
  } catch {
    // Then it may ask again tomorrow-ish anyway.
  }
}

let latest = null;
let urgentAsked = false;
let hooks = { canAsk: () => false, notice: () => {} };

// canAsk(): true while the title screen is up. notice(state): show or clear the
// title's update line ('restart', 'outdated' or null).
export function installUpdates(h) {
  hooks = { ...hooks, ...h };
  checkForUpdate();
}

export function checkForUpdate() {
  const b = bridge();
  try {
    if (b && b.check) b.check();
  } catch {
    // No answer, no update.
  }
}

// The shell's answer. info: { available, downloading, downloaded, immediate,
// flexible, priority, staleDays, version, current, minVersion }.
export function onUpdateInfo(info) {
  latest = info && typeof info === 'object' ? info : null;
  considerUpdate();
}

// Act on the latest answer, if the title screen is up. main.js calls this
// again whenever the title comes back.
export function considerUpdate(now = Date.now()) {
  if (!latest) return null;
  if (!hooks.canAsk()) return null;
  const plan = updatePlan(latest, { lastAsked: readAsked(), now, urgentAsked });
  const b = bridge();
  if ((plan === 'immediate' || plan === 'flexible') && b && b.start) {
    if (isUrgent(latest)) urgentAsked = true;
    else writeAsked(now);
    try {
      b.start(plan === 'immediate');
    } catch {
      // Play couldn't show it; try again another day.
    }
  }
  hooks.notice(titleNotice(latest, urgentAsked));
  return plan;
}

// The title's button: restart into the downloaded version, or ask again.
export function applyUpdate() {
  const b = bridge();
  if (!b || !latest) return false;
  try {
    if (latest.downloaded) b.restart();
    else b.start(!!latest.immediate);
    return true;
  } catch {
    return false;
  }
}

export function updateNotice() {
  return titleNotice(latest, urgentAsked);
}

// For tests.
export function resetUpdates() {
  latest = null;
  urgentAsked = false;
  hooks = { canAsk: () => false, notice: () => {} };
}
