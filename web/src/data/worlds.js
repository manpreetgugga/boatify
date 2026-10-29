// The worlds beyond Home Waters. Each has its own islands, rocks, a monster
// that keeps a lair (kraken rules), drifters that swing on the tide (floe
// rules), weather and colours, and ten voyages that ramp up. Home Waters is
// the hand-made campaign in levels.js; the other worlds' courses are charted
// from these specs by world/charter.js, with star times from charts.js.
//
// The campaign runs on through the worlds: finish the last voyage of one and
// the first of the next opens.

import { LEVELS } from './levels.js';
import { CHARTS } from './charts.js';
import { charterVoyage } from '../world/charter.js';

const VOLCANO = {
  id: 'volcano',
  name: 'Volcano Isles',
  theme: 'volcano',
  accent: '#ff7a3d',
  blurb: 'Black rock, warm water and ash that falls like snow. The vents breathe, and now and then they blow.',
  kinds: [['cone', 1], ['basalt', 2]],
  big: 'basalt',
  wallKind: 'basalt',
  rocks: [['basalt', 1]],
  rockSize: { basalt: [5, 11] },
  lair: 'vent',
  drifter: { look: 'pumice', kind: 'pumice', shape: 'blob', size: [36, 52] },
  wind: [14, 18],
  weather: { ash: 0.35, dark: 0.1 },
  shadow: { cone: 1, basalt: 0.8 },
  tips: {
    start: 'Volcano Isles. Black rock and warm water, and the ash falls like snow. Keep clear of anything glowing.',
    lairs: 'A vent! When the water starts to boil it is about to blow. Stay out of the ring.',
    drift: 'Pumice rafts drift on the tide. They are light, but they still dent a hull.',
    wall: 'A lava flow runs right across the sea. Find the gap.',
    narrows: 'Two lava fields nearly meet. Thread the channel between them.',
    whirl: 'Hot springs below drive a whirlpool. Keep to its edge.',
    current: 'Warm water rises and runs: a current across your path.',
  },
  voyages: [
    {
      id: 'ash-landing',
      name: 'Ash Landing',
      blurb: 'Warm water and black sand. The isles smoke, but the wind is kind. Mind the vent.',
      teaser: 'The sea here is warm to the touch.',
      f: { islands: 4, reef: 1, lairs: 1 },
    },
    {
      id: 'cinder-sound',
      name: 'Cinder Sound',
      blurb: 'Cinder rocks litter the sound, and a vent breathes beside the channel.',
      teaser: 'The rocks here are still warm.',
      f: { islands: 4, reef: 3, lairs: 1, wind: 'beam' },
      castaway: { name: 'Pyra', line: 'I came to toast marshmallows on a volcano. Never again.' },
    },
    {
      id: 'pumice-drift',
      name: 'Pumice Drift',
      blurb: 'Rafts of pumice swing across the course on the tide.',
      teaser: 'Rocks that float. Who ever heard of that?',
      f: { islands: 3, drift: 2, lairs: 1 },
      note: 'Pumice floats because it is full of holes. My hull is not, and I mean to keep it that way.',
    },
    {
      id: 'lava-gate',
      name: 'Lava Gate',
      blurb: 'A fresh lava flow has walled off the sea. One gap is left.',
      teaser: 'Last month this was open water.',
      f: { wall: 1, islands: 3, lairs: 1 },
    },
    {
      id: 'hot-springs',
      name: 'Hot Springs',
      blurb: 'Springs boil up from the seabed and the water turns with them.',
      teaser: 'Steam rises in spirals here.',
      f: { islands: 4, whirl: 2, lairs: 1 },
      castaway: { name: 'Basil', line: 'My boat melted. Well, the paint did. Then it sank.' },
    },
    {
      id: 'smoke-run',
      name: 'Smoke Run',
      blurb: 'Smoke lies on the water. Run downwind and listen for the hiss.',
      teaser: 'You can smell this one before you see it.',
      f: { islands: 4, lairs: 2, fog: 0.5, wind: 'down' },
      note: 'The vents breathe in a rhythm. Watch the bubbles, count, then go.',
    },
    {
      id: 'caldera',
      name: 'The Caldera',
      blurb: 'Sail into the drowned crater, and out through its broken rim.',
      teaser: 'A whole mountain, sunk.',
      f: { narrows: true, islands: 3, lairs: 2, whirl: 1 },
    },
    {
      id: 'firefall',
      name: 'Firefall',
      blurb: 'Night, and the mountain glows. Lava lights the way, and the vents.',
      teaser: 'At night the cones light up like lanterns.',
      f: { islands: 4, lairs: 2, drift: 1, night: true },
      castaway: { name: 'Cole', line: 'The fish here come cooked. I ate well, at least.' },
    },
    {
      id: 'ember-beat',
      name: 'Ember Beat',
      blurb: 'Straight into the wind, with vents on both sides of the channel.',
      teaser: 'Upwind, through the embers.',
      f: { islands: 5, reef: 3, lairs: 2, wind: 'up' },
      note: 'Black sand is only black because it was fire once.',
    },
    {
      id: 'mount-ember',
      name: 'Mount Ember',
      blurb: 'The great volcano wakes. Ash, lava and vents: get past it all to the far harbor.',
      teaser: 'Nobody sails past Mount Ember. Nobody yet.',
      f: { big: 1, wall: 1, lairs: 3, drift: 2, squall: true, long: true },
    },
  ],
};

const HARBOR = {
  id: 'harbor',
  name: 'Harbor City',
  theme: 'harbor',
  accent: '#ffc857',
  blurb: 'The busiest port on the sea: quays stacked with containers, cranes, ferries and crowds on every dock.',
  kinds: [['quay', 3], ['sand', 1]],
  big: 'quay',
  wallKind: 'quay',
  rocks: [['piling', 2], ['container', 1]],
  rockSize: { piling: [3.5, 6], container: [8, 11] },
  lair: 'crane',
  drifter: { look: 'ferry', kind: 'steel', shape: 'hull', size: [130, 165], beam: 40 },
  wind: [14, 18],
  lighthouse: 0.3,
  shadow: { quay: 0.85 },
  tips: {
    start: 'Harbor City. Quays, cranes and ferries, and everyone on the docks is watching. Wave back!',
    lairs: 'A crane is swinging a container out over the water. When the ring turns red it drops. Keep clear!',
    drift: 'A ferry shuttles across the harbor. It does not stop for sailboats. Pass behind it.',
    wall: 'The breakwater keeps the swell out, and you in. Find the harbor mouth.',
    narrows: 'Two docks nearly meet: a narrow channel between them.',
    current: 'The river runs out through the harbor. Allow for the current.',
    pirates: 'Smugglers! That brig flies a black flag. Keep the wind on your beam.',
  },
  voyages: [
    {
      id: 'old-docks',
      name: 'Old Docks',
      blurb: 'Old pilings and quiet quays. The city is waking up as you sail in.',
      teaser: 'Lights on the shore, and voices.',
      f: { islands: 4, reef: 2 },
    },
    {
      id: 'container-yard',
      name: 'Container Yard',
      blurb: 'Cranes swing containers out over the water. Mind the drop zone.',
      teaser: 'Boxes stacked as high as hills.',
      f: { islands: 4, reef: 3, lairs: 1 },
      castaway: { name: 'Dot', line: 'A container nearly sank me. It was full of rubber ducks.' },
    },
    {
      id: 'ferry-crossing',
      name: 'Ferry Crossing',
      blurb: 'The city ferry runs back and forth across your course, right on time.',
      teaser: 'Every twenty minutes, they say.',
      f: { islands: 3, drift: 1, reef: 1 },
      note: 'A ferry goes back and forth on the same line. Watch it turn once and you know its timing.',
    },
    {
      id: 'harbor-mouth',
      name: 'Harbor Mouth',
      blurb: 'A breakwater guards the port. Find the mouth, and mind the ferry.',
      teaser: 'A wall in the sea, with a door.',
      f: { wall: 1, islands: 3, drift: 1 },
    },
    {
      id: 'river-tide',
      name: 'River Tide',
      blurb: 'The river runs out through the docks. The current is strong, and so are the cranes.',
      teaser: 'Fresh water meets salt here.',
      f: { islands: 4, current: 1, lairs: 1, drift: 1 },
      castaway: { name: 'Marco', line: 'I was fishing off the pier. The pier left without me.' },
    },
    {
      id: 'rush-hour',
      name: 'Rush Hour',
      blurb: 'Every ferry in the city is out at once.',
      teaser: 'Horns, horns, horns.',
      f: { islands: 3, drift: 3, reef: 2 },
      note: 'Containers float, mostly. The ones that don’t are under you.',
    },
    {
      id: 'fog-horn',
      name: 'Fog Horn',
      blurb: 'Fog over the docks. Listen for the horns and watch for the cranes.',
      teaser: 'You will hear it before you see it.',
      f: { islands: 4, lairs: 1, drift: 1, fog: 0.55 },
    },
    {
      id: 'city-lights',
      name: 'City Lights',
      blurb: 'Night in the harbor. The quays are lit; the ferries are not.',
      teaser: 'The city never sleeps. Neither do its ferries.',
      f: { islands: 5, drift: 2, lairs: 1, night: true },
      castaway: { name: 'Ines', line: 'I swam off the night ferry. Long story. I fell asleep.' },
    },
    {
      id: 'smugglers-wharf',
      name: "Smugglers' Wharf",
      blurb: 'A brig with no papers waits by the old wharf. Its crew are not dock workers.',
      teaser: 'Nobody unloads at the old wharf. Nobody honest.',
      f: { islands: 4, wall: 1, pirates: 1, wind: 'beam' },
      note: 'The crane drivers can’t see you from up there. Assume nobody can.',
    },
    {
      id: 'grand-harbor',
      name: 'Grand Harbor',
      blurb: 'The biggest port in the world: two breakwaters, cranes and ferries, all at once.',
      teaser: 'Only the best pilots work the Grand Harbor.',
      f: { wall: 2, drift: 2, lairs: 2, islands: 3, long: true },
    },
  ],
};

const ALIEN = {
  id: 'alien',
  name: 'Planet Zeta',
  theme: 'alien',
  accent: '#b48cff',
  blurb: 'A violet sea under two moons. Crystal isles, fungus forests, giant jellies, and beasts below.',
  kinds: [['crystal', 2], ['spore', 2]],
  big: 'spore',
  wallKind: 'crystal',
  rocks: [['shard', 1], ['pod', 1]],
  rockSize: { shard: [5, 10], pod: [6, 10] },
  lair: 'beast',
  drifter: { look: 'jelly', kind: 'jelly', shape: 'blob', size: [40, 56] },
  wind: [14, 18],
  shadow: { crystal: 0.7, spore: 0.9 },
  tips: {
    start: 'Planet Zeta. The sea is violet, but the wind is the same old wind. Something with a lot of eyes is watching.',
    lairs: 'Glowing rings on the water: a beast is rising. Get out before it surfaces!',
    drift: 'Giant jellies drift with the tide. Bouncy, but they sting a hull.',
    wall: 'A crystal reef grows right across the sea. There is a gap somewhere.',
    narrows: 'Two fungus forests nearly touch. Squeeze through between them.',
    whirl: 'A gravity well! The sea spirals down into it. Stay on the rim.',
    current: 'A glowing current flows across the course.',
    calms: 'A dead calm. The air here is too thin to fill a sail.',
  },
  voyages: [
    {
      id: 'first-contact',
      name: 'First Contact',
      blurb: 'A violet sea under two moons. The crystal isles chime when the wind blows.',
      teaser: 'Far beyond the last chart.',
      f: { islands: 4, reef: 2 },
    },
    {
      id: 'jelly-bloom',
      name: 'Jelly Bloom',
      blurb: 'Giant jellies drift across the course with the tide.',
      teaser: 'Jellies the size of islands.',
      f: { islands: 3, drift: 2 },
      castaway: { name: 'Zib', line: 'Zib thanks you! Zib’s saucer flies very well. Floats, not so much.' },
    },
    {
      id: 'the-watchers',
      name: 'The Watchers',
      blurb: 'Eyes on stalks follow you from the shore. And something follows from below.',
      teaser: 'You feel watched here. You are.',
      f: { islands: 4, lairs: 1, reef: 2 },
      note: 'The beasts rise inside rings, and the rings glow first. Trust the glow.',
    },
    {
      id: 'crystal-reef',
      name: 'Crystal Reef',
      blurb: 'A crystal reef runs right across the sea, with one way through.',
      teaser: 'It rings like a bell when you hit it.',
      f: { wall: 1, islands: 3, lairs: 1 },
    },
    {
      id: 'gravity-wells',
      name: 'Gravity Wells',
      blurb: 'The sea spirals down into wells. Keep to the rim, and watch for jellies.',
      teaser: 'Where does the water go?',
      f: { islands: 3, whirl: 2, drift: 1 },
      castaway: { name: 'Captain Nova', line: 'I came to plant a flag. A jelly ate the flag.' },
    },
    {
      id: 'thin-air',
      name: 'Thin Air',
      blurb: 'Patches of air here are too thin to fill a sail. Read the water.',
      teaser: 'Your sail goes limp for no reason at all.',
      f: { islands: 4, calms: 3, lairs: 1, wind: 'beam' },
      note: 'Jellies bounce you off, but every bounce stings. Count the stings.',
    },
    {
      id: 'spore-forest',
      name: 'Spore Forest',
      blurb: 'Spores hang over the water like fog. A channel runs through the fungus.',
      teaser: 'The mushrooms here are taller than masts.',
      f: { narrows: true, islands: 3, drift: 2, fog: 0.45 },
    },
    {
      id: 'glow-night',
      name: 'Glow Night',
      blurb: 'At night everything on Zeta glows. Everything.',
      teaser: 'Darkness, then a thousand lights.',
      f: { islands: 4, lairs: 2, drift: 2, night: true },
      castaway: { name: 'Blorp', line: 'Blorp! Blorp blorp. (That means thank you.)' },
    },
    {
      id: 'hive-current',
      name: 'Hive Current',
      blurb: 'Beat upwind across two glowing currents, past the hive.',
      teaser: 'Something hums under the water.',
      f: { islands: 4, current: 2, lairs: 2, wind: 'up' },
      note: 'Two moons, one wind. Some things are the same everywhere.',
    },
    {
      id: 'mother-beast',
      name: 'The Mother Beast',
      blurb: 'The biggest beast on the planet sleeps under the far sea. Do not wake her.',
      teaser: 'Even the jellies keep away from here.',
      f: { big: 1, wall: 1, lairs: 3, drift: 2, whirl: 1, long: true },
    },
  ],
};

const HOME = {
  id: 'home',
  name: 'Home Waters',
  theme: 'home',
  accent: '#8fd8ea',
  blurb: 'Where it all began: the islands and reefs you know, and a few things you would rather not.',
  voyages: LEVELS,
};

export const WORLDS = [HOME, VOLCANO, HARBOR, ALIEN];

// Every voyage in campaign order: a light entry for menus. The full course
// comes from voyageDef.
export const CAMPAIGN = WORLDS.flatMap((w) =>
  w.voyages.map((v, i) => ({ id: v.id, name: v.name, teaser: v.teaser, world: w.id, index: i, castaways: v.castaways || (v.castaway ? [v.castaway] : []) })),
);

const byId = new Map(CAMPAIGN.map((e, i) => [e.id, i]));
const worldById = new Map(WORLDS.map((w) => [w.id, w]));
const cache = new Map();

export function campaignIndex(id) {
  return byId.has(id) ? byId.get(id) : -1;
}

export function worldOf(id) {
  const e = CAMPAIGN[campaignIndex(id)];
  return e ? worldById.get(e.world) : null;
}

export function getWorld(id) {
  return worldById.get(id) || null;
}

// The charted course: the attempt that the autopilot finished, with star
// times from its run. A voyage not charted yet (while a world is being made)
// takes its first course and a guess at the times.
export function chartedVoyage(world, index) {
  const spec = world.voyages[index];
  const chart = CHARTS[spec.id];
  let def = null;
  if (chart) def = charterVoyage(world, index, chart[0]);
  for (let a = 0; !def && a < 10; a++) def = charterVoyage(world, index, a);
  if (!def) return null;
  if (chart) def.par = { gold: chart[1], silver: chart[2] };
  else {
    const t = Math.hypot(def.finish.x - def.start.x, def.finish.y - def.start.y) / 14;
    def.par = { gold: Math.ceil((t * 1.2) / 5) * 5, silver: Math.ceil((t * 1.6) / 5) * 5 };
  }
  return def;
}

// The full course for a campaign voyage, by id.
export function voyageDef(id) {
  if (cache.has(id)) return cache.get(id);
  const i = campaignIndex(id);
  if (i < 0) return null;
  const e = CAMPAIGN[i];
  const world = worldById.get(e.world);
  const def = world.id === 'home' ? world.voyages[e.index] : chartedVoyage(world, e.index);
  cache.set(id, def);
  return def;
}

// "Volcano Isles · 3", or "Voyage 3" at home.
export function voyageLabel(id) {
  const e = CAMPAIGN[campaignIndex(id)];
  if (!e) return '';
  return e.world === 'home' ? `Voyage ${e.index + 1}` : `${worldById.get(e.world).name} · ${e.index + 1}`;
}
