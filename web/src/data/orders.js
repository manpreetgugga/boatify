// The harbourmaster's orders: three small jobs a day, the same three all day
// and new ones at midnight. One is easy, one asks for good sailing, and one
// sends you somewhere: an Open Sea run, a regatta, a castaway. Each pays
// coins the moment it's done, and the third one done opens the harbourmaster's
// chest, with a black pearl inside. One order a day can be swapped for
// another of its kind.
//
// Everything here works on the save's `orders` and leaves paying and writing
// the save to the caller.

import { hashString } from '../core/rng.js';

// Black pearls in the chest for all three orders done in a day.
export const CHEST = 1;

// `count(result, kind, improved)` is how far one finished voyage takes the
// order; `kind` is 'voyage', 'daily', 'sea' or 'race'.
const sailed = (kind) => kind === 'voyage' || kind === 'daily';
export const ORDERS = [
  { id: 'voyages', slot: 0, goal: 3, pay: 50, icon: 'compass', text: 'Set sail 3 times', note: 'Any voyage, Open Sea run or regatta.', count: () => 1 },
  { id: 'pearls', slot: 0, goal: 15, pay: 50, icon: 'pearl', text: 'Collect 15 pearls', note: 'On any voyage or run.', count: (r) => r.pearls || 0 },
  { id: 'daily', slot: 0, goal: 1, pay: 50, icon: 'sun', text: "Sail today's daily voyage", note: 'Bring it home, any time today.', count: (r, kind) => (kind === 'daily' ? 1 : 0) },
  { id: 'gold', slot: 1, goal: 2, pay: 80, icon: 'star', text: 'Win three stars twice', note: 'On any two voyages, or the same one twice.', count: (r, kind) => (sailed(kind) && r.stars === 3 ? 1 : 0) },
  { id: 'clean', slot: 1, goal: 2, pay: 80, icon: 'shield', text: 'Bring 2 voyages home without a bump', note: 'Not a rock, a drifter or a boat touched.', count: (r, kind) => (sailed(kind) && !r.collisions ? 1 : 0) },
  { id: 'record', slot: 1, goal: 1, pay: 80, icon: 'clock', text: 'Beat your best time on a voyage', note: "One you've brought home before.", count: (r, kind, improved) => (kind === 'voyage' && improved && improved.time && !improved.first ? 1 : 0) },
  { id: 'rescue', slot: 2, goal: 1, pay: 100, icon: 'lifebuoy', text: 'Bring a castaway home', note: 'Heave to alongside and haul them aboard.', count: (r) => (r.rescued ? r.rescued.length : 0) },
  { id: 'gates', slot: 2, goal: 8, pay: 100, icon: 'horizon', text: 'Sail through 8 gates on the Open Sea', note: 'Over one run or several.', count: (r, kind) => (kind === 'sea' ? r.gates || 0 : 0) },
  { id: 'podium', slot: 2, goal: 1, pay: 100, icon: 'trophy', text: 'Finish a regatta in the top three', note: 'First, second or third over the line.', count: (r, kind) => (kind === 'race' && r.place <= 3 ? 1 : 0) },
  { id: 'dolphins', slot: 2, goal: 5, pay: 100, icon: 'dolphin', text: 'Ride with the dolphins for 5 seconds', note: "Sail in a pod's bow wave.", count: (r) => r.escort || 0 },
];

const byId = (id) => ORDERS.find((o) => o.id === id);
const inSlot = (slot) => ORDERS.filter((o) => o.slot === slot);

// The day's three, the same for everyone.
export function pickOrders(today) {
  return [0, 1, 2].map((slot) => {
    const list = inSlot(slot);
    return list[hashString(`orders:${today}:${slot}`) % list.length].id;
  });
}

function fresh(today) {
  return { day: today, picks: pickOrders(today), progress: {}, done: [], chest: false, swapped: false, seen: false };
}

// The day's orders, starting a new day's when the date has moved on.
export function dayOrders(save, today) {
  if (!save.orders || save.orders.day !== today) save.orders = fresh(today);
  return save.orders;
}

// Today's orders as the board shows them.
export function todaysOrders(save, today) {
  const o = dayOrders(save, today);
  return o.picks.map((id) => {
    const order = byId(id);
    const progress = Math.min(order.goal, o.progress[id] || 0);
    return { ...order, progress, done: o.done.includes(id) };
  });
}

export function ordersLeft(save, today) {
  const o = dayOrders(save, today);
  return o.picks.filter((id) => !o.done.includes(id)).length;
}

// A finished voyage, run or race moves today's orders on. Returns the orders
// it finished, the ones it moved along (with their progress), how many are
// left, the coins they pay and the chest's black pearls, if it opened.
export function tallyOrders(save, today, kind, result, improved = null) {
  const o = dayOrders(save, today);
  const done = [];
  const moved = [];
  for (const id of o.picks) {
    if (o.done.includes(id)) continue;
    const order = byId(id);
    const step = Number(order.count(result, kind, improved)) || 0;
    if (step <= 0) continue;
    o.progress[id] = Math.min(order.goal, (o.progress[id] || 0) + step);
    if (o.progress[id] >= order.goal) {
      o.done.push(id);
      done.push(order);
    } else moved.push({ ...order, progress: o.progress[id] });
  }
  const coins = done.reduce((a, d) => a + d.pay, 0);
  let blackPearls = 0;
  if (!o.chest && o.done.length === o.picks.length) {
    o.chest = true;
    blackPearls = CHEST;
  }
  return { done, moved, left: o.picks.length - o.done.length, coins, blackPearls };
}

// Trade an order not yet done for the next one of its kind, once a day.
export function swapOrder(save, today, id) {
  const o = dayOrders(save, today);
  const at = o.picks.indexOf(id);
  if (o.swapped || at < 0 || o.done.includes(id)) return null;
  const list = inSlot(byId(id).slot);
  const next = list[(list.findIndex((d) => d.id === id) + 1) % list.length];
  if (next.id === id) return null;
  o.picks[at] = next.id;
  delete o.progress[id];
  o.swapped = true;
  return next;
}

// Today's orders read back from storage, or null to start the day afresh.
export function cleanOrders(o) {
  if (!o || typeof o !== 'object' || typeof o.day !== 'string') return null;
  const picks = Array.isArray(o.picks) ? o.picks : [];
  if (picks.length !== 3 || picks.some((id, i) => !byId(id) || byId(id).slot !== i)) return null;
  const progress = {};
  for (const id of picks) progress[id] = Math.max(0, Math.min(byId(id).goal, Number(o.progress && o.progress[id]) || 0));
  return {
    day: o.day,
    picks: [...picks],
    progress,
    done: Array.isArray(o.done) ? picks.filter((id) => o.done.includes(id)) : [],
    chest: o.chest === true,
    swapped: o.swapped === true,
    seen: o.seen === true,
  };
}
