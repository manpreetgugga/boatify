// Coins and black pearls. Coins are earned by sailing: every voyage finished,
// star won, pearl picked up and castaway brought home pays a little, and
// medals pay more. Black pearls are rare: on some voyages one lies where the
// danger is (in a whirlpool's pull, over a kraken's lair, off a pirate's
// cove), and once it is brought home it is gone for good. Later one can be
// earned by watching a video too (see platform/ads.js). Nothing is for sale.
//
// Coins buy gust jars and paints; black pearls unlock boats before the stars do
// and buy a second wind on the Open Sea.
//
// Everything here works on the save's `wallet` and leaves writing the save
// to the caller.

import { N_ } from '../i18n/index.js';

export const PAY = {
  finish: 10, // any voyage brought home
  star: 5, // each star on this run
  newStar: 25, // each star won for the first time
  pearl: 2,
  rescue: 15,
  first: 20, // first time home on a voyage
  daily: 30, // first finish of the day's voyage
  streak: 5, // per day of the streak, up to a week
  medal: 50,
  seaPer: 100, // Open Sea: a coin for this many units east
  gate: 5,
  place: [60, 35, 20, 10], // regatta finishing places
  clean: 10, // a race without a bump
};

// Supplies stowed for the next voyage.
export const JAR_PRICE = 60;
export const JAR_HOLD = 3; // the most the hold takes, and the most a voyage carries

// A black pearl traded for coins at the Shop.
export const TRADE_COINS = 150;

// Black pearls to unlock a boat before the stars do.
export const BOAT_PRICES = { skiff: 5, proa: 10, junk: 15, galleon: 25 };

// Black pearls for a second wind when an Open Sea run ends.
export const SECOND_WIND = 2;
export const SECOND_WIND_TIME = 30; // seconds back on the clock

export function blankWallet() {
  return {
    coins: 0,
    blackPearls: 0,
    earned: 0, // coins earned over all time
    found: {}, // voyage id -> 1 once its black pearl is home
    jars: 0, // gust jars in the hold
    owned: [], // boats and paints bought: 'boat:proa', 'gear:royal'
    // Rewarded videos watched today, by placement; voyages finished since the
    // last ad between voyages; and when the last ad of any kind played.
    ads: { day: null, seen: {}, since: 0, last: 0 },
  };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => Math.max(0, Math.floor(Number(v) || 0));

// A wallet read back from storage, with anything missing or broken mended.
export function cleanWallet(w) {
  const base = blankWallet();
  if (!isObj(w)) return base;
  return {
    coins: count(w.coins),
    // Black pearls were called diamonds until 0.22.
    blackPearls: count(w.blackPearls ?? w.diamonds),
    earned: count(w.earned),
    found: isObj(w.found) ? w.found : {},
    jars: Math.min(JAR_HOLD, count(w.jars)),
    owned: Array.isArray(w.owned) ? w.owned.filter((s) => typeof s === 'string') : [],
    ads: isObj(w.ads) && isObj(w.ads.seen) ? { day: w.ads.day || null, seen: w.ads.seen, since: count(w.ads.since), last: count(w.ads.last) } : base.ads,
  };
}

// --- Earning ----------------------------------------------------------------

const line = (label, coins) => ({ label, coins });

// What a finished voyage pays, line by line. `improved` is what the save's
// recordResult returned (with prevStars) and `streak` the daily run of days.
export function voyagePay(def, result, improved, streak = 0) {
  const lines = [line(N_('Voyage'), PAY.finish), line(`${result.stars} ★`, result.stars * PAY.star)];
  const fresh = result.stars - (improved.prevStars || 0);
  if (fresh > 0) lines.push(line(fresh === 1 ? N_('New star') : N_('New stars'), fresh * PAY.newStar));
  if (result.pearls) lines.push(line(N_('Pearls'), result.pearls * PAY.pearl));
  const rescued = (result.rescued || []).length;
  if (rescued) lines.push(line(N_('Rescued'), rescued * PAY.rescue));
  if (improved.first && !def.daily) lines.push(line(N_('First time home'), PAY.first));
  if (def.daily && improved.first) {
    lines.push(line(N_('Daily voyage'), PAY.daily));
    if (streak > 1) lines.push(line(`${streak}-day streak`, Math.min(7, streak) * PAY.streak));
  }
  return withMedals(lines, improved.medals);
}

export function seaPay(result, improved) {
  const lines = [line(N_('Distance'), Math.floor(result.distance / PAY.seaPer))];
  if (result.gates) lines.push(line(N_('Gates'), result.gates * PAY.gate));
  if (result.pearls) lines.push(line(N_('Pearls'), result.pearls * PAY.pearl));
  return withMedals(lines, improved.medals);
}

export function racePay(result, improved) {
  const lines = [line(N_('Place'), PAY.place[result.place - 1] || PAY.place[PAY.place.length - 1])];
  if (!result.bumps) lines.push(line(N_('Clean race'), PAY.clean));
  return withMedals(lines, improved.medals);
}

function withMedals(lines, medals = []) {
  if (medals.length) lines.push(line(medals.length === 1 ? N_('Medal') : N_('Medals'), medals.length * PAY.medal));
  return lines.filter((l) => l.coins > 0);
}

// Put a voyage's pay in the wallet. Black pearls found count only once per
// voyage (the daily voyage is its own voyage each day).
export function payOut(save, lines, { blackPearls = 0, voyage = null } = {}) {
  const w = save.wallet;
  const coins = lines.reduce((a, l) => a + l.coins, 0);
  w.coins += coins;
  w.earned += coins;
  let gems = 0;
  if (blackPearls > 0 && !(voyage && w.found[voyage])) {
    gems = blackPearls;
    w.blackPearls += gems;
    if (voyage) w.found[voyage] = 1;
  }
  return { coins, blackPearls: gems, lines };
}

// Is this voyage's black pearl still out there?
// Medals, the harbourmaster's orders and the Regatta Cup's prize pay what
// they pay; a video doubles the rest.
const ONCE = new Set(['Medal', 'Medals', 'Orders', 'Cup prize']);

// What a video on the results would add: the voyage's own coins again.
export function doubleOf(pay) {
  if (!pay || pay.doubled) return 0;
  return pay.lines.reduce((a, l) => a + (ONCE.has(l.label) ? 0 : l.coins), 0);
}

// A video watched on the results pays that, once. Returns the coins added.
export function doublePay(save, pay) {
  const extra = doubleOf(pay);
  if (!(extra > 0)) return 0;
  save.wallet.coins += extra;
  save.wallet.earned += extra;
  pay.doubled = true;
  pay.coins += extra;
  pay.lines = [...pay.lines, { label: N_('Video'), coins: extra }];
  return extra;
}

export function blackPearlWaiting(save, voyageId) {
  return !save.wallet.found[voyageId];
}

// --- Spending ---------------------------------------------------------------

// Take a price ({ coins } or { black pearls }) from the wallet if it covers it.
export function spend(save, price) {
  const w = save.wallet;
  const coins = price.coins || 0;
  const blackPearls = price.blackPearls || 0;
  if (w.coins < coins || w.blackPearls < blackPearls) return false;
  w.coins -= coins;
  w.blackPearls -= blackPearls;
  return true;
}

export function canAfford(save, price) {
  return save.wallet.coins >= (price.coins || 0) && save.wallet.blackPearls >= (price.blackPearls || 0);
}

// How much more of what a price needs, for "You need 40 more coins".
export function shortOf(save, price) {
  if (price.blackPearls) return { blackPearls: Math.max(0, price.blackPearls - save.wallet.blackPearls) };
  return { coins: Math.max(0, (price.coins || 0) - save.wallet.coins) };
}

export function owns(save, key) {
  return save.wallet.owned.includes(key);
}

export function buyJar(save) {
  if (save.wallet.jars >= JAR_HOLD || !spend(save, { coins: JAR_PRICE })) return false;
  save.wallet.jars += 1;
  return true;
}

// The jars from the hold that go aboard at the start of a voyage. They stay
// in the hold's count until used, so a voyage cut short loses none.
export function jarsAboard(save) {
  return Math.min(JAR_HOLD, save.wallet.jars);
}

// After a voyage: `carried` went aboard and `left` jars were still aboard at
// the end (some may have been picked up on the way).
export function useJars(save, carried, left) {
  const used = Math.max(0, carried - Math.max(0, left));
  save.wallet.jars = Math.max(0, save.wallet.jars - used);
  return used;
}

export function tradeBlackPearl(save) {
  if (!spend(save, { blackPearls: 1 })) return false;
  save.wallet.coins += TRADE_COINS;
  return true;
}

export function buyBoat(save, id) {
  const price = BOAT_PRICES[id];
  if (!price || owns(save, `boat:${id}`) || !spend(save, { blackPearls: price })) return false;
  save.wallet.owned.push(`boat:${id}`);
  return true;
}

export function buyGear(save, item) {
  if (!item.price || owns(save, `gear:${item.id}`) || !spend(save, { coins: item.price })) return false;
  save.wallet.owned.push(`gear:${item.id}`);
  return true;
}

export function formatCoins(n) {
  return Math.round(n).toLocaleString('en-US');
}
