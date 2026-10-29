// Buying diamonds and watching videos for them. Neither is switched on yet:
// the game runs on the 'none' provider, which offers nothing, so the Shop
// says "Coming soon". When the Android shell gains Google Play Billing and a
// rewarded-video SDK it exposes them to the page as `window.BoatifyStore`
// and answers through `window.BoatifyStoreReply` (docs/MONETIZATION.md has
// the contract), and `nativeProvider` speaks to it. Whatever the provider,
// the wallet is credited only here, and only once per order.

import { blankWallet } from '../data/economy.js';

// Diamond packs. Prices come from the store, in the player's own currency.
export const PACKS = [
  { id: 'diamonds_10', name: 'Handful of diamonds', diamonds: 10, bonus: 0 },
  { id: 'diamonds_35', name: 'Pouch of diamonds', diamonds: 30, bonus: 5 },
  { id: 'diamonds_90', name: 'Chest of diamonds', diamonds: 70, bonus: 20 },
];

// Rewarded videos: where they are offered, what they give, and how many a
// day each one allows.
export const REWARDS = {
  diamond: { id: 'reward_diamond', diamonds: 1, perDay: 3 },
  secondWind: { id: 'reward_second_wind', diamonds: 0, perDay: 3 },
};

const REPLY_TIMEOUT = 120000; // a video or a payment sheet can take a while

const NONE = {
  id: 'none',
  storeReady: () => false,
  adsReady: () => false,
  prices: async () => ({}),
  purchase: async () => ({ ok: false, reason: 'unavailable' }),
  rewarded: async () => ({ ok: false, reason: 'unavailable' }),
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
//   storeReady(), adsReady()  answer at once
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
    prices: async () => {
      const r = await ask('prices', PACKS.map((p) => p.id).join(','));
      return r.ok && r.prices && typeof r.prices === 'object' ? r.prices : {};
    },
    purchase: (productId) => ask('purchase', productId),
    rewarded: (placement) => ask('rewarded', placement),
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

// Put a paid order's diamonds in the wallet, once.
export function creditOrder(save, order) {
  const pack = order && PACKS.find((p) => p.id === order.product);
  if (!pack || !order.id) return { ok: false, reason: 'bad-order' };
  const w = save.wallet || (save.wallet = blankWallet());
  if (w.orders.includes(order.id)) return { ok: true, diamonds: 0, repeat: true };
  w.orders.push(order.id);
  const diamonds = pack.diamonds + pack.bonus;
  w.diamonds += diamonds;
  return { ok: true, diamonds };
}

// Buy a pack: the store takes the payment, the wallet gets the diamonds,
// `persist` writes the save, and only then is the order marked done, so a
// crash in between leaves it to `restoreOrders` next time.
export async function buyPack(save, packId, persist = () => {}) {
  const pack = PACKS.find((p) => p.id === packId);
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
  let diamonds = 0;
  for (const order of orders) {
    const r = creditOrder(save, order);
    if (!r.ok) continue;
    diamonds += r.diamonds;
    persist();
    await provider.finish(order.id);
  }
  return diamonds;
}

export function videosLeft(save, reward, today) {
  const ads = save.wallet.ads;
  const seen = ads.day === today ? ads.seen[reward.id] || 0 : 0;
  return Math.max(0, reward.perDay - seen);
}

// Play a rewarded video; the reward comes only for one watched to the end.
export async function watchVideo(save, reward, today) {
  if (!videosLeft(save, reward, today)) return { ok: false, reason: 'limit' };
  const r = await provider.rewarded(reward.id);
  if (!r || !r.ok) return r || { ok: false, reason: 'unavailable' };
  const ads = save.wallet.ads;
  if (ads.day !== today) {
    ads.day = today;
    ads.seen = {};
  }
  ads.seen[reward.id] = (ads.seen[reward.id] || 0) + 1;
  if (reward.diamonds) save.wallet.diamonds += reward.diamonds;
  return { ok: true, diamonds: reward.diamonds };
}
