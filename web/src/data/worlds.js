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

const JUNGLE = {
  id: 'jungle',
  name: 'Jungle Delta',
  theme: 'jungle',
  accent: '#5fd068',
  blurb: 'A great river spills into the sea through a thousand islands of rainforest. Hippos wallow, crocodiles wait, macaws shout.',
  kinds: [['jungle', 2], ['mangrove', 1]],
  big: 'jungle',
  wallKind: 'mangrove',
  rocks: [['snag', 1]],
  rockSize: { snag: [6, 10] },
  lair: 'croc',
  drifter: { look: 'hippo', kind: 'hippo', shape: 'blob', size: [34, 46] },
  wind: [14, 18],
  lighthouse: 0.2,
  weather: { rain: 0.08, motes: 0.25, moteColor: '230, 255, 120' },
  shadow: { jungle: 1, mangrove: 0.7 },
  tips: {
    start: 'Jungle Delta. Brown water, green walls, and something calling in the trees. Steer clear of logs.',
    lairs: 'Two eyes on the water, then two more. When the ring turns red the croc snaps. Keep out!',
    drift: 'Hippos drift about the delta. They look sleepy. They are not.',
    wall: 'A mangrove bank runs right across the river. Find the creek through it.',
    narrows: 'Two banks of jungle nearly meet. Paddle through the gap, quietly.',
    whirl: 'The river turns on itself here: an eddy. Keep to its edge.',
    current: 'The river runs strong across your path. Allow for it.',
  },
  voyages: [
    {
      id: 'river-mouth',
      name: 'River Mouth',
      blurb: 'The great river meets the sea. The water goes brown and the trees come down to the shore.',
      teaser: 'Green shores, and a smell of rain.',
      f: { islands: 4, reef: 1 },
    },
    {
      id: 'mangrove-maze',
      name: 'Mangrove Maze',
      blurb: 'Mangroves stand on their roots in the water. One of the logs has eyes.',
      teaser: 'Trees that walk on stilts.',
      f: { islands: 5, reef: 2, lairs: 1 },
      castaway: { name: 'Tomas', line: 'I came to count the herons. They counted me first.' },
    },
    {
      id: 'hippo-pool',
      name: 'Hippo Pool',
      blurb: 'The hippos are out in the pool, drifting this way and that.',
      teaser: 'Something big yawns in the shallows.',
      f: { islands: 3, drift: 2, reef: 1 },
      note: 'Hippos drift on the tide like anything else. Watch one turn and you know where it goes.',
    },
    {
      id: 'log-jam',
      name: 'Log Jam',
      blurb: 'A mangrove bank blocks the river and the floods have left logs everywhere.',
      teaser: 'Snags and roots and one way through.',
      f: { wall: 1, islands: 3, reef: 2 },
    },
    {
      id: 'monsoon',
      name: 'Monsoon',
      blurb: 'The rains come in all at once. Thunder over the trees, and the crocs like it.',
      teaser: 'The sky turns the colour of the river.',
      f: { islands: 4, lairs: 1, squall: true },
      castaway: { name: 'Amara', line: 'My canoe filled with rain and sank. In the rain. Typical.' },
    },
    {
      id: 'croc-creek',
      name: 'Croc Creek',
      blurb: 'A narrow creek through the jungle, and the crocodiles know it is the only way.',
      teaser: 'Nobody swims in Croc Creek.',
      f: { narrows: true, islands: 3, lairs: 2 },
      note: 'A croc shows its eyes long before it snaps. Look for the eyes.',
    },
    {
      id: 'backwater',
      name: 'Backwater',
      blurb: 'The river runs one way across the course and the hippos drift the other.',
      teaser: 'Slow water, lazy hippos.',
      f: { islands: 4, current: 1, drift: 1, wind: 'beam' },
    },
    {
      id: 'firefly-night',
      name: 'Firefly Night',
      blurb: 'Night on the delta. A million fireflies, and a few eyes that are not fireflies.',
      teaser: 'The trees light up after dark.',
      f: { islands: 4, lairs: 1, drift: 1, night: true },
      castaway: { name: 'Professor Lim', line: 'I was studying fireflies. They led me further than I meant to go.' },
    },
    {
      id: 'eddies',
      name: 'The Eddies',
      blurb: 'Beat upriver past two eddies where the water turns back on itself.',
      teaser: 'Here the river runs in circles.',
      f: { islands: 4, whirl: 2, lairs: 1, wind: 'up' },
      note: 'Rivers are older than maps. They go where they like.',
    },
    {
      id: 'great-delta',
      name: 'The Great Delta',
      blurb: 'The whole delta at once: mangroves, hippos and the biggest crocs on the river.',
      teaser: 'A thousand channels. One way home.',
      f: { big: 1, wall: 1, lairs: 3, drift: 2, islands: 3, long: true },
    },
  ],
};

const DINO = {
  id: 'dino',
  name: 'Dino Lagoon',
  theme: 'dino',
  accent: '#e8a03c',
  blurb: 'A lagoon the world forgot. Ferns as tall as trees, long-necks grazing, pterosaurs over the cliffs and something huge in the deep.',
  kinds: [['fern', 2], ['cliff', 1]],
  big: 'fern',
  wallKind: 'cliff',
  rocks: [['bones', 2], ['rock', 1]],
  rockSize: { bones: [7, 11] },
  lair: 'plesio',
  drifter: { look: 'turtle', kind: 'shell', shape: 'blob', size: [34, 46] },
  wind: [14, 18],
  lighthouse: 0.3,
  shadow: { fern: 0.8, cliff: 1 },
  tips: {
    start: 'Dino Lagoon. Look, on the island: a long-neck! Something else lives in the water. Keep your distance.',
    lairs: 'A long shadow circles below. When the ring turns red, a neck comes up. Out of the ring!',
    drift: 'Giant turtles paddle about the lagoon. Their shells are as hard as rock.',
    wall: 'Red cliffs run right across the lagoon. There is a gap.',
    narrows: 'The cliffs nearly meet: a narrow pass with pterosaurs overhead.',
    whirl: 'The lagoon drains into a sinkhole here. Stay on the edge.',
    current: 'Water from the hot springs runs across the course.',
    calms: 'Dead calm over the tar. The air is thick and still here.',
  },
  voyages: [
    {
      id: 'egg-beach',
      name: 'Egg Beach',
      blurb: 'Nests on every beach. Mind the old bones in the water.',
      teaser: 'Eggs the size of footballs.',
      f: { islands: 4, reef: 2 },
    },
    {
      id: 'fern-shallows',
      name: 'Fern Shallows',
      blurb: 'Ferns hang over the shallows, and the bones of old giants lie under the water.',
      teaser: 'Old bones, older than old.',
      f: { islands: 4, reef: 3, drift: 1 },
      castaway: { name: 'Rex', line: 'I am not THAT Rex. Everyone asks. Thank you for the lift.' },
    },
    {
      id: 'turtle-run',
      name: 'Turtle Run',
      blurb: 'The giant turtles are on the move. Something under the water follows them.',
      teaser: 'Turtles as big as boats.',
      f: { islands: 3, drift: 2, lairs: 1 },
      note: 'A turtle is slow, but it does not stop for you. Pass behind it.',
    },
    {
      id: 'bone-yard',
      name: 'Bone Yard',
      blurb: 'Ribs stick up out of the water everywhere. A fossil hunter’s dream; a sailor’s nightmare.',
      teaser: 'Where the giants came to rest.',
      f: { islands: 3, reef: 4, lairs: 1 },
    },
    {
      id: 'red-cliffs',
      name: 'Red Cliffs',
      blurb: 'Red cliffs cut the lagoon in two. Find the gap, and keep an eye on the water.',
      teaser: 'Pterosaurs nest on the cliffs.',
      f: { wall: 1, islands: 3, lairs: 1 },
      castaway: { name: 'Dr. Petra Stone', line: 'I found a fossil! Then my raft found a rock.' },
    },
    {
      id: 'tar-pits',
      name: 'Tar Pits',
      blurb: 'Tar seeps into the lagoon and the air goes dead above it. Read the water.',
      teaser: 'The water is black and still.',
      f: { islands: 4, calms: 2, lairs: 1, wind: 'beam' },
      note: 'Where the water goes glassy, the wind has gone. Sail round it.',
    },
    {
      id: 'pterosaur-pass',
      name: 'Pterosaur Pass',
      blurb: 'A narrow pass between the cliffs. The turtles use it too.',
      teaser: 'Wings overhead, shells below.',
      f: { narrows: true, islands: 3, drift: 2 },
    },
    {
      id: 'night-lagoon',
      name: 'Night Lagoon',
      blurb: 'Night in the lagoon. Things splash out there in the dark.',
      teaser: 'The long-necks sleep standing up.',
      f: { islands: 4, lairs: 2, night: true },
      castaway: { name: 'Ugg', line: 'Ugg go fishing. Fish bigger than Ugg. Ugg go home now, please.' },
    },
    {
      id: 'sinkholes',
      name: 'Sinkholes',
      blurb: 'Beat upwind past a sinkhole, with two of the deep ones circling.',
      teaser: 'The lagoon drains away into the dark.',
      f: { islands: 4, whirl: 1, lairs: 2, wind: 'up' },
    },
    {
      id: 'deep-lagoon',
      name: 'The Deep Lagoon',
      blurb: 'The far side of the lagoon, where the biggest of them all lives.',
      teaser: 'Even the long-necks keep to the shore here.',
      f: { big: 1, wall: 1, lairs: 3, drift: 2, whirl: 1, long: true },
    },
  ],
};

const SUNKEN = {
  id: 'sunken',
  name: 'Sunken City',
  theme: 'sunken',
  accent: '#5fe0d0',
  blurb: 'An old city drowned long ago. Its marble streets shine under clear water and its towers still stand above the waves.',
  kinds: [['ruin', 2], ['tower', 1]],
  big: 'ruin',
  wallKind: 'ruin',
  rocks: [['column', 2], ['statue', 1]],
  rockSize: { column: [5, 9], statue: [8, 11] },
  lair: 'eel',
  drifter: { look: 'galley', kind: 'wood', shape: 'hull', size: [110, 140], beam: 34 },
  wind: [14, 18],
  lighthouse: 0.5,
  shadow: { ruin: 0.6, tower: 0.9 },
  tips: {
    start: 'The Sunken City. You can see the streets under the water. Broken columns stand right up to the surface.',
    lairs: 'Eyes in a dark doorway: a giant eel. When the ring turns red it lunges. Keep clear!',
    drift: 'Old galleys row up and down the city. They have right of way, and a lot of oars.',
    wall: 'The old city wall still stands. Find the gate.',
    narrows: 'Two blocks of ruins nearly meet: an old street to sail down.',
    whirl: 'The sea pours down an old drain here. Stay on the rim.',
    current: 'The tide runs through the old streets: a current across your path.',
    pirates: 'Pirates have found the city’s gold. Their brig guards the old harbor. Keep the wind on your beam.',
  },
  voyages: [
    {
      id: 'marble-shallows',
      name: 'Marble Shallows',
      blurb: 'Clear water over marble streets. Broken columns reach up to the surface.',
      teaser: 'A city under the sea.',
      f: { islands: 4, reef: 2 },
    },
    {
      id: 'column-row',
      name: 'Column Row',
      blurb: 'The great avenue: rows and rows of broken columns. Steer down the middle.',
      teaser: 'They held up a roof, once.',
      f: { islands: 4, reef: 4 },
      castaway: { name: 'Marina', line: 'I dived for treasure and came up under my own boat. Ouch.' },
    },
    {
      id: 'galley-lane',
      name: 'Galley Lane',
      blurb: 'Galleys row up and down the lane, right across your course.',
      teaser: 'Oars, oars and more oars.',
      f: { islands: 3, drift: 2, reef: 1 },
      note: 'A galley rows back and forth on the same line. Count its oars, then go behind.',
    },
    {
      id: 'city-wall',
      name: 'City Wall',
      blurb: 'The old wall still rings the city. Something lives in the gate.',
      teaser: 'The gates were never closed.',
      f: { wall: 1, islands: 3, lairs: 1 },
    },
    {
      id: 'temple-tide',
      name: 'Temple Tide',
      blurb: 'The tide runs out past the temple steps. Mind the doorways.',
      teaser: 'The temple steps go down into the sea.',
      f: { islands: 4, current: 1, lairs: 1 },
      castaway: { name: 'Old Theo', line: 'I am the last guide to the city. Business has been slow.' },
    },
    {
      id: 'moray-gate',
      name: 'Moray Gate',
      blurb: 'One street runs through the old quarter, and the eels live in its doors.',
      teaser: 'Every doorway has a pair of eyes.',
      f: { narrows: true, islands: 3, lairs: 2 },
      note: 'An eel’s eyes glow brighter just before it lunges.',
    },
    {
      id: 'forum-drain',
      name: 'Forum Drain',
      blurb: 'The sea pours down the drains of the old forum. The galleys keep well away.',
      teaser: 'Where does all the water go?',
      f: { islands: 4, whirl: 2, drift: 1 },
    },
    {
      id: 'moonlit-ruins',
      name: 'Moonlit Ruins',
      blurb: 'The ruins by moonlight. The towers are lit, and so are the eels’ eyes.',
      teaser: 'Lamps in the towers, though nobody lives there.',
      f: { islands: 4, lairs: 2, drift: 1, night: true },
      castaway: { name: 'Nerissa', line: 'I sang to the eels. They did not like my singing.' },
    },
    {
      id: 'harbor-of-kings',
      name: 'Harbor of Kings',
      blurb: 'The old royal harbor, behind its wall. A pirate brig waits there for the galleys.',
      teaser: 'Gold sank here, and pirates came for it.',
      f: { wall: 1, islands: 3, drift: 2, pirates: 1, wind: 'beam' },
      note: 'Pirates fire across the wind. Galleys make good cover.',
    },
    {
      id: 'lost-capital',
      name: 'The Lost Capital',
      blurb: 'The heart of the city: two walls, the great temple, and the oldest eels of all.',
      teaser: 'The city the songs are about.',
      f: { big: 1, wall: 2, lairs: 3, drift: 2, islands: 2, long: true },
    },
  ],
};

const GHOST = {
  id: 'ghost',
  name: 'Ghost Sea',
  theme: 'ghost',
  accent: '#8affc1',
  blurb: 'Grey water, green lanterns and mist that never lifts. Wrecks lie on every bar and ghost ships sail without a crew.',
  kinds: [['grave', 2], ['hulk', 1]],
  big: 'grave',
  wallKind: 'grave',
  rocks: [['mast', 1], ['rock', 1]],
  rockSize: { mast: [5, 8] },
  lair: 'wraith',
  drifter: { look: 'ghostship', kind: 'ghost', shape: 'hull', size: [120, 150], beam: 36 },
  wind: [14, 18],
  lighthouse: 0.6,
  weather: { fog: 0.3, dark: 0.2, motes: 0.35, moteColor: '170, 255, 200' },
  shadow: { grave: 0.8, hulk: 0.7 },
  tips: {
    start: 'The Ghost Sea. Grey water, green lanterns. Do not be scared. Well, be a little scared.',
    lairs: 'Wisps gather on the water. When the ring turns red a wraith bursts out. Get away!',
    drift: 'A ghost ship sails with no crew and no care for you. Go behind it.',
    wall: 'A bank of graves runs right across the sea. Find the way through.',
    narrows: 'Two graveyards nearly meet. Slip through between them.',
    whirl: 'A whirlpool wails as it turns. Keep to its edge.',
    current: 'A cold current runs across your path.',
    calms: 'Dead calm. Of course it is dead calm. This is the Ghost Sea.',
    pirates: 'A pirate brig, and it is not a ghost. Its cannons are real. Keep the wind on your beam.',
  },
  voyages: [
    {
      id: 'grey-water',
      name: 'Grey Water',
      blurb: 'The mist comes down and the water goes grey. Green lights glow on the islands.',
      teaser: 'The sea where lost ships go.',
      f: { islands: 4, reef: 2 },
    },
    {
      id: 'graveyard-isles',
      name: 'Graveyard Isles',
      blurb: 'Every island is a graveyard, and something stirs on the water between them.',
      teaser: 'Tombstones on every shore.',
      f: { islands: 5, reef: 2, lairs: 1 },
      castaway: { name: 'Wilhelmina', line: 'I came for the spooky views. I am leaving for the same reason.' },
    },
    {
      id: 'ghost-ships',
      name: 'Ghost Ships',
      blurb: 'Ships with no crew sail back and forth through the mist.',
      teaser: 'Sails like rags, lanterns burning green.',
      f: { islands: 3, drift: 2, reef: 1 },
      note: 'Ghost ships are see-through. Their hulls still hurt.',
    },
    {
      id: 'wreck-reef',
      name: 'Wreck Reef',
      blurb: 'A bank of graves across the sea, and the masts of the ships that hit it.',
      teaser: 'So many masts, and no ships under them.',
      f: { wall: 1, islands: 3, reef: 2 },
    },
    {
      id: 'wailing-whirl',
      name: 'Wailing Whirl',
      blurb: 'Two whirlpools wail in the mist, and the wraiths circle them.',
      teaser: 'You hear it long before you see it.',
      f: { islands: 3, whirl: 2, lairs: 1 },
      castaway: { name: 'Captain Bones', line: 'Bones is just my name. I am perfectly alive, thank you.' },
    },
    {
      id: 'dead-calm',
      name: 'Dead Calm',
      blurb: 'The wind dies in patches here. Glassy water, and wisps on it.',
      teaser: 'Not a breath of wind. Not one.',
      f: { islands: 4, calms: 3, lairs: 1, wind: 'beam' },
      note: 'Glassy water means no wind. Do not sail into it.',
    },
    {
      id: 'mist-channel',
      name: 'Mist Channel',
      blurb: 'One channel through the graves, deep in the mist. A ghost ship uses it too.',
      teaser: 'You cannot see the bow from the stern.',
      f: { narrows: true, islands: 3, drift: 1, fog: 0.6 },
    },
    {
      id: 'witching-hour',
      name: 'Witching Hour',
      blurb: 'Midnight on the Ghost Sea. The wraiths are out, and so are the ships.',
      teaser: 'The lanterns burn brighter at midnight.',
      f: { islands: 4, lairs: 2, drift: 2, night: true },
      castaway: { name: 'Lantern Lou', line: 'I keep the lanterns lit. Somebody has to. Thanks for the lift.' },
    },
    {
      id: 'phantom-brig',
      name: 'Phantom Brig',
      blurb: 'A brig lies in wait in the mist. It is not a ghost, but it would like to make one.',
      teaser: 'Cannon fire in the fog.',
      f: { islands: 4, pirates: 1, lairs: 1, wind: 'beam' },
    },
    {
      id: 'last-lantern',
      name: 'The Last Lantern',
      blurb: 'A storm on the Ghost Sea. Graves, wraiths, ghost ships, and one lantern at the end.',
      teaser: 'Follow the last lantern home.',
      f: { big: 1, wall: 1, lairs: 3, drift: 2, islands: 3, squall: true, long: true },
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

export const WORLDS = [HOME, VOLCANO, HARBOR, ALIEN, JUNGLE, DINO, SUNKEN, GHOST];

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
