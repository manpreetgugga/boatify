// Buying black pearls, watching videos for them, and the short ad between
// voyages. None of it is switched on yet: the game runs on the 'none'
// provider, which offers nothing, so the Shop says "Coming soon" and no ad
// ever plays. When the Android shell gains Google Play Billing and a
// rewarded-video SDK it exposes them to the page as `window.BoatifyStore`
// and answers through `window.BoatifyStoreReply` (docs/MONETIZATION.md has
// the contract), and `nativeProvider` speaks to it. Whatever the provider,
// the wallet is credited only here, and only once per order.

import { blankWallet } from '../data/economy.js';

// Black pearl packs. Prices come from the store, in the player's own currency.
export const PACKS = [
  { id: 'black_pearls_10', name: 'Handful of black pearls', blackPearls: 10, bonus: 0 },
  { id: 'black_pearls_35', name: 'Pouch of black pearls', blackPearls: 30, bonus: 5 },
  { id: 'black_pearls_90', name: 'Chest of black pearls', blackPearls: 70, bonus: 20 },
];

// Bought once, kept for good: no more ads between voyages. Videos for black
// pearls stay, since those are only ever played when asked for.
export const NO_ADS = { id: 'no_ads', name: 'No ads' };

const PRODUCTS = [...PACKS, NO_ADS];

// Rewarded videos: where they are offered, what they give, and how many a
// day each one allows.
export const REWARDS = {
  blackPearl: { id: 'reward_black_pearl', blackPearls: 1, perDay: 3 },
  secondWind: { id: 'reward_second_wind', blackPearls: 0, perDay: 3 },
};

// The short ad between voyages. It never interrupts sailing: it plays as the
// player moves on from a voyage's results (not on a retry), only once they
// have finished the first `hooked` voyages, then after every `every` voyages
// finished, and never within `gap` of the last ad of any kind. Anyone who
// has bought anything never sees it.
export const BREAK = { id: 'break_voyage', every: 3, hooked: 10, gap: 4 * 60 * 1000 };

const REPLY_TIMEOUT = 120000; // a video or a payment sheet can take a while

const NONE = {
  id: 'none',
  storeReady: () => false,
  adsReady: () => false,
  breakReady: () => false,
  prices: async () => ({}),
  purchase: async () => ({ ok: false, reason: 'unavailable' }),
  rewarded: async () => ({ ok: false, reason: 'unavailable' }),
  interstitial: async () => ({ ok: false, reason: 'unavailable' }),
  pending: async () => [], // orders paid for but not yet credited
  finish: async () => ({ ok: true }), // tell the store an order is in the wallet
};

let provider = NONE;

export function commerce() {
  return provider;
}

export function setCommerceProvider(p) {
  provider = p ? { ...NONE, ...p } : NONE;
  return provider;
}

// Speaks to the Android shell. `bridge` is its JavaScript interface:
//   request(id, method, arg)  starts a call; the reply comes back as
//   BoatifyStoreReply(id, json)
//   storeReady(), adsReady(), breakReady()  answer at once
export function nativeProvider(bridge, host = globalThis) {
  let next = 1;
  const waiting = new Map();
  host.BoatifyStoreReply = (id, json) => {
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
    storeReady: () => flag('storeReady'),
    adsReady: () => flag('adsReady'),
    breakReady: () => flag('breakReady'),
    prices: async () => {
      const r = await ask('prices', PRODUCTS.map((p) => p.id).join(','));
      return r.ok && r.prices && typeof r.prices === 'object' ? r.prices : {};
    },
    purchase: (productId) => ask('purchase', productId),
    rewarded: (placement) => ask('rewarded', placement),
    interstitial: (placement) => ask('interstitial', placement),
    pending: async () => {
      const r = await ask('pending');
      return r.ok && Array.isArray(r.orders) ? r.orders : [];
    },
    finish: (orderId) => ask('finish', orderId),
  };
}

// Use the shell's store if it has one.
export function installCommerce(host = globalThis) {
  if (host.BoatifyStore && typeof host.BoatifyStore.request === 'function') setCommerceProvider(nativeProvider(host.BoatifyStore, host));
  return provider;
}

// Put a paid order in the wallet, once. Any order at all also ends the ads
// between voyages: someone who has paid shouldn't sit through them.
export function creditOrder(save, order) {
  const product = order && PRODUCTS.find((p) => p.id === order.product);
  if (!product || !order.id) return { ok: false, reason: 'bad-order' };
  const w = save.wallet || (save.wallet = blankWallet());
  w.noAds = true;
  if (w.orders.includes(order.id)) return { ok: true, blackPearls: 0, repeat: true };
  w.orders.push(order.id);
  const blackPearls = product === NO_ADS ? 0 : product.blackPearls + product.bonus;
  w.blackPearls += blackPearls;
  return { ok: true, blackPearls };
}

// Buy a pack (or no ads): the store takes the payment, the wallet gets what
// was bought, `persist` writes the save, and only then is the order marked
// done, so a crash in between leaves it to `restoreOrders` next time.
export async function buyPack(save, packId, persist = () => {}) {
  const pack = PRODUCTS.find((p) => p.id === packId);
  if (!pack) return { ok: false, reason: 'unknown' };
  const r = await provider.purchase(pack.id);
  if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
  const credit = creditOrder(save, { product: pack.id, ...(r.order || {}) });
  if (!credit.ok) return credit;
  persist();
  await provider.finish(r.order.id);
  return credit;
}

// Orders paid for but never credited (say the app was closed mid-purchase).
export async function restoreOrders(save, persist = () => {}) {
  const orders = await provider.pending();
  let blackPearls = 0;
  for (const order of orders) {
    const r = creditOrder(save, order);
    if (!r.ok) continue;
    blackPearls += r.blackPearls;
    persist();
    await provider.finish(order.id);
  }
  return blackPearls;
}

export function videosLeft(save, reward, today) {
  const ads = save.wallet.ads;
  const seen = ads.day === today ? ads.seen[reward.id] || 0 : 0;
  return Math.max(0, reward.perDay - seen);
}

// Play a rewarded video; the reward comes only for one watched to the end.
export async function watchVideo(save, reward, today, now = Date.now()) {
  if (!videosLeft(save, reward, today)) return { ok: false, reason: 'limit' };
  const r = await provider.rewarded(reward.id);
  if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
  const ads = save.wallet.ads;
  if (ads.day !== today) {
    ads.day = today;
    ads.seen = {};
  }
  ads.seen[reward.id] = (ads.seen[reward.id] || 0) + 1;
  ads.last = now;
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
  const w = save.wallet;
  if (w.noAds || finished < BREAK.hooked || w.ads.since < BREAK.every) return false;
  const ago = now - w.ads.last;
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
