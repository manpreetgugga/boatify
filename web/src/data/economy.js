// Coins and diamonds. Coins are earned by sailing: every voyage finished,
// star won, pearl picked up and castaway brought home pays a little, and
// medals pay more. Diamonds are rare: on some voyages one lies where the
// danger is (in a whirlpool's pull, over a kraken's lair, off a pirate's
// cove), and once it is brought home it is gone for good. Later they can be
// bought or earned by watching a video too (see platform/commerce.js).
//
// Coins buy gust jars and paints; diamonds unlock boats before the stars do
// and buy a second wind on the Open Sea.
//
// Everything here works on the save's `wallet` and leaves writing the save
// to the caller.

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

// A diamond traded for coins at the Shop.
export const TRADE_COINS = 150;

// Diamonds to unlock a boat before the stars do.
export const BOAT_PRICES = { skiff: 5, proa: 10, junk: 15, galleon: 25 };

// Diamonds for a second wind when an Open Sea run ends.
export const SECOND_WIND = 2;
export const SECOND_WIND_TIME = 30; // seconds back on the clock

export function blankWallet() {
  return {
    coins: 0,
    diamonds: 0,
    earned: 0, // coins earned over all time
    found: {}, // voyage id -> 1 once its diamond is home
    jars: 0, // gust jars in the hold
    owned: [], // boats and paints bought: 'boat:proa', 'gear:royal'
    orders: [], // store order ids already credited, so none is paid twice
    ads: { day: null, seen: {} }, // rewarded videos watched today, by placement
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
    diamonds: count(w.diamonds),
    earned: count(w.earned),
    found: isObj(w.found) ? w.found : {},
    jars: Math.min(JAR_HOLD, count(w.jars)),
    owned: Array.isArray(w.owned) ? w.owned.filter((s) => typeof s === 'string') : [],
    orders: Array.isArray(w.orders) ? w.orders.filter((s) => typeof s === 'string').slice(-200) : [],
    ads: isObj(w.ads) && isObj(w.ads.seen) ? { day: w.ads.day || null, seen: w.ads.seen } : base.ads,
  };
}

// --- Earning ----------------------------------------------------------------

const line = (label, coins) => ({ label, coins });

// What a finished voyage pays, line by line. `improved` is what the save's
// recordResult returned (with prevStars) and `streak` the daily run of days.
export function voyagePay(def, result, improved, streak = 0) {
  const lines = [line('Voyage', PAY.finish), line(`${result.stars} ★`, result.stars * PAY.star)];
  const fresh = result.stars - (improved.prevStars || 0);
  if (fresh > 0) lines.push(line(fresh === 1 ? 'New star' : 'New stars', fresh * PAY.newStar));
  if (result.pearls) lines.push(line('Pearls', result.pearls * PAY.pearl));
  const rescued = (result.rescued || []).length;
  if (rescued) lines.push(line('Rescued', rescued * PAY.rescue));
  if (improved.first && !def.daily) lines.push(line('First time home', PAY.first));
  if (def.daily && improved.first) {
    lines.push(line('Daily voyage', PAY.daily));
    if (streak > 1) lines.push(line(`${streak}-day streak`, Math.min(7, streak) * PAY.streak));
  }
  return withMedals(lines, improved.medals);
}

export function seaPay(result, improved) {
  const lines = [line('Distance', Math.floor(result.distance / PAY.seaPer))];
  if (result.gates) lines.push(line('Gates', result.gates * PAY.gate));
  if (result.pearls) lines.push(line('Pearls', result.pearls * PAY.pearl));
  return withMedals(lines, improved.medals);
}

export function racePay(result, improved) {
  const lines = [line('Place', PAY.place[result.place - 1] || PAY.place[PAY.place.length - 1])];
  if (!result.bumps) lines.push(line('Clean race', PAY.clean));
  return withMedals(lines, improved.medals);
}

function withMedals(lines, medals = []) {
  if (medals.length) lines.push(line(medals.length === 1 ? 'Medal' : 'Medals', medals.length * PAY.medal));
  return lines.filter((l) => l.coins > 0);
}

// Put a voyage's pay in the wallet. Diamonds found count only once per
// voyage (the daily voyage is its own voyage each day).
export function payOut(save, lines, { diamonds = 0, voyage = null } = {}) {
  const w = save.wallet;
  const coins = lines.reduce((a, l) => a + l.coins, 0);
  w.coins += coins;
  w.earned += coins;
  let gems = 0;
  if (diamonds > 0 && !(voyage && w.found[voyage])) {
    gems = diamonds;
    w.diamonds += gems;
    if (voyage) w.found[voyage] = 1;
  }
  return { coins, diamonds: gems, lines };
}

// Is this voyage's diamond still out there?
export function diamondWaiting(save, voyageId) {
  return !save.wallet.found[voyageId];
}

// --- Spending ---------------------------------------------------------------

// Take a price ({ coins } or { diamonds }) from the wallet if it covers it.
export function spend(save, price) {
  const w = save.wallet;
  const coins = price.coins || 0;
  const diamonds = price.diamonds || 0;
  if (w.coins < coins || w.diamonds < diamonds) return false;
  w.coins -= coins;
  w.diamonds -= diamonds;
  return true;
}

export function canAfford(save, price) {
  return save.wallet.coins >= (price.coins || 0) && save.wallet.diamonds >= (price.diamonds || 0);
}

// How much more of what a price needs, for "You need 40 more coins".
export function shortOf(save, price) {
  if (price.diamonds) return { diamonds: Math.max(0, price.diamonds - save.wallet.diamonds) };
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

export function tradeDiamond(save) {
  if (!spend(save, { diamonds: 1 })) return false;
  save.wallet.coins += TRADE_COINS;
  return true;
}

export function buyBoat(save, id) {
  const price = BOAT_PRICES[id];
  if (!price || owns(save, `boat:${id}`) || !spend(save, { diamonds: price })) return false;
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
