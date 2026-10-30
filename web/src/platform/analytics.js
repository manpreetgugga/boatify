// Anonymous analytics and crash reports (Firebase), Android only and only once
// the Play build has a google-services.json (docs/PLAY_STORE.md): the shell
// adds window.BoatifyAnalytics then. Without it everything here does nothing.
//
// Only the events below go out, each with only its listed fields: numbers,
// and short ids made of letters, digits, '-' and '_'. No names, no free text,
// no advertising id. The player can turn it off in Settings; where consent
// law applies it starts off until they agree.

const bridge = () => (typeof window !== 'undefined' ? window.BoatifyAnalytics : undefined);

export const EVENTS = {
  voyage_start: ['level', 'world', 'mode'],
  voyage_complete: ['level', 'world', 'stars', 'time', 'bumps'],
  voyage_quit: ['level', 'world', 'mode', 'time'],
  world_reached: ['world'],
  open_sea_end: ['distance', 'gates'],
  regatta_finish: ['place', 'fleet'],
  cup_finish: ['place', 'fleet'],
  festival_voyage: ['festival'],
  rewarded_ad_watched: ['reward'],
  share: ['what'],
  backup_used: ['how'],
  language: ['lang'],
};

const MAX_ERRORS = 8; // non-fatal reports per session
let errorsSent = 0;
const errorsSeen = new Set();

function call(name, ...args) {
  try {
    const b = bridge();
    if (b && typeof b[name] === 'function') return b[name](...args);
  } catch {
    // Analytics never gets in the way of the game.
  }
  return undefined;
}

export function hasAnalytics() {
  return !!bridge();
}

// The params an event may carry, cleaned; null for an event not on the list.
export function cleanParams(name, params = {}) {
  const keys = EVENTS[name];
  if (!keys) return null;
  const out = {};
  for (const k of keys) {
    const v = params[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 10) / 10;
    else if (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v)) out[k] = v;
  }
  return out;
}

export function track(name, params) {
  const clean = cleanParams(name, params);
  if (!clean || !hasAnalytics()) return false;
  call('log', name, JSON.stringify(clean));
  return true;
}

// Is it on? The player's own choice wins; until they make one it follows
// the shell's answer for this phone (off where consent is needed and not given).
export function analyticsOn(settings) {
  if (!hasAnalytics()) return false;
  if (settings && typeof settings.analytics === 'boolean') return settings.analytics;
  return !!call('defaultOn');
}

export function applyAnalytics(settings) {
  if (!hasAnalytics()) return false;
  const on = analyticsOn(settings);
  call('setEnabled', on);
  return on;
}

// A script error, sent as a non-fatal crash report with the voyage it
// happened on. Each different message once, and only a few a session.
export function reportError(message, stack, voyage) {
  if (!hasAnalytics() || errorsSent >= MAX_ERRORS) return false;
  const msg = String(message || 'error').slice(0, 300);
  if (errorsSeen.has(msg)) return false;
  errorsSeen.add(msg);
  errorsSent += 1;
  call('error', msg, String(stack || '').slice(0, 2000), String(voyage || ''));
  return true;
}

export function installErrorReports(host, voyage) {
  if (!host || !host.addEventListener) return;
  host.addEventListener('error', (e) => {
    const err = e && e.error;
    reportError((err && err.message) || (e && e.message), err && err.stack, voyage());
  });
  host.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    reportError((r && r.message) || String(r), r && r.stack, voyage());
  });
}

// A new world counts as reached the first time one of its voyages is set
// out on before any of them is finished; once a session per world.
const reached = new Set();
export function worldReached(world, finishedInWorld) {
  if (!world || finishedInWorld || reached.has(world)) return false;
  reached.add(world);
  return track('world_reached', { world });
}

// For the tests.
export function resetAnalyticsSession() {
  errorsSent = 0;
  errorsSeen.clear();
  reached.clear();
}
