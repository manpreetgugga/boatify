// Ads, and nothing for sale: rewarded videos for a black pearl, a second
// wind or a voyage's coins twice over, and the short ad between voyages. The Android app exposes AdMob to
// the page as `window.BoatifyAds` and answers through
// `window.BoatifyAdsReply` (docs/MONETIZATION.md has the contract), and
// `nativeAds` speaks to it. Anywhere else (the browser, the tests) the game
// runs on the 'none' provider: the Shop says "Coming soon" and no ad plays.

// Rewarded videos: where they are offered, what they give, and how many a
// day each one allows.
export const REWARDS = {
  blackPearl: { id: 'reward_black_pearl', blackPearls: 1, perDay: 3 },
  secondWind: { id: 'reward_second_wind', blackPearls: 0, perDay: 3 },
  doubleCoins: { id: 'reward_double_coins', blackPearls: 0, perDay: 5 },
};

// The short ad between voyages. It never interrupts sailing: it plays as the
// player moves on from a voyage's results (not on a retry), only once they
// have finished the first `hooked` voyages, then after every `every` voyages
// finished, and never within `gap` of the last ad of any kind.
export const BREAK = { id: 'break_voyage', every: 3, hooked: 10, gap: 4 * 60 * 1000 };

const REPLY_TIMEOUT = 120000; // a video can take a while

const NONE = {
  id: 'none',
  adsReady: () => false,
  breakReady: () => false,
  rewarded: async () => ({ ok: false, reason: 'unavailable' }),
  interstitial: async () => ({ ok: false, reason: 'unavailable' }),
  // Where consent law applies, Google's ad privacy form must be reachable
  // from Settings.
  privacyRequired: () => false,
  privacyOptions: async () => ({ ok: false, reason: 'unavailable' }),
};

let provider = NONE;

export function ads() {
  return provider;
}

export function setAdsProvider(p) {
  provider = p ? { ...NONE, ...p } : NONE;
  return provider;
}

// Speaks to the Android shell. `bridge` is its JavaScript interface:
//   request(id, method, arg)  starts a call; the reply comes back as
//   BoatifyAdsReply(id, json)
//   adsReady(), breakReady(), privacyRequired()  answer at once
export function nativeAds(bridge, host = globalThis) {
  let next = 1;
  const waiting = new Map();
  host.BoatifyAdsReply = (id, json) => {
    const done = waiting.get(Number(id));
    if (!done) return;
    let reply;
    try {
      reply = typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      reply = null;
    }
    done(reply && typeof reply === 'object' ? reply : { ok: false, reason: 'bad-reply' });
  };
  const ask = (method, arg = '') =>
    new Promise((resolve) => {
      const id = next++;
      const timer = setTimeout(() => settle({ ok: false, reason: 'timeout' }), REPLY_TIMEOUT);
      const settle = (reply) => {
        clearTimeout(timer);
        waiting.delete(id);
        resolve(reply);
      };
      waiting.set(id, settle);
      try {
        bridge.request(id, method, String(arg));
      } catch {
        settle({ ok: false, reason: 'bridge' });
      }
    });
  const flag = (name) => {
    try {
      return !!(bridge[name] && bridge[name]());
    } catch {
      return false;
    }
  };
  return {
    id: 'native',
    adsReady: () => flag('adsReady'),
    breakReady: () => flag('breakReady'),
    rewarded: (placement) => ask('rewarded', placement),
    interstitial: (placement) => ask('interstitial', placement),
    privacyRequired: () => flag('privacyRequired'),
    privacyOptions: () => ask('privacy'),
  };
}

// Use the shell's ads if it has them.
export function installAds(host = globalThis) {
  if (host.BoatifyAds && typeof host.BoatifyAds.request === 'function') setAdsProvider(nativeAds(host.BoatifyAds, host));
  return provider;
}

export function videosLeft(save, reward, today) {
  const seen = save.wallet.ads;
  const n = seen.day === today ? seen.seen[reward.id] || 0 : 0;
  return Math.max(0, reward.perDay - n);
}

// Play a rewarded video; the reward comes only for one watched to the end.
export async function watchVideo(save, reward, today, now = Date.now()) {
  if (!videosLeft(save, reward, today)) return { ok: false, reason: 'limit' };
  const r = await provider.rewarded(reward.id);
  if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
  const seen = save.wallet.ads;
  if (seen.day !== today) {
    seen.day = today;
    seen.seen = {};
  }
  seen.seen[reward.id] = (seen.seen[reward.id] || 0) + 1;
  seen.last = now;
  if (reward.blackPearls) save.wallet.blackPearls += reward.blackPearls;
  return { ok: true, blackPearls: reward.blackPearls };
}

// A voyage, run or race finished. Once the player is hooked (`finished`
// voyages home, counting this one) it counts towards the next ad break.
export function countVoyage(save, finished) {
  if (finished > BREAK.hooked) save.wallet.ads.since += 1;
}

// Is an ad between voyages due as the player moves on?
export function breakDue(save, finished, now = Date.now()) {
  const seen = save.wallet.ads;
  if (finished < BREAK.hooked || seen.since < BREAK.every) return false;
  const ago = now - seen.last;
  return !(ago >= 0 && ago < BREAK.gap);
}

// Play the ad between voyages. Once it has played the count starts again;
// if none would play, it's tried again after the next voyage.
export async function takeBreak(save, now = Date.now()) {
  if (!provider.breakReady()) return { ok: false, reason: 'unavailable' };
  let r;
  try {
    r = await provider.interstitial(BREAK.id);
  } catch {
    r = null;
  }
  if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
  save.wallet.ads.since = 0;
  save.wallet.ads.last = now;
  return { ok: true };
}
