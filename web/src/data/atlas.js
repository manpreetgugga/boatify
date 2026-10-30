// The Sea Atlas: a book of the creatures and sights met at sea. An entry is
// filled in the first time the boat sails near the thing (or sails in the
// weather), and filling a whole page brings a reward.
//
// What's been met lives in the wallet's `owned` list as 'atlas:<entry>', and a
// page's reward as 'atlaspage:<page>', so both travel with backup codes.

// How near the boat has to come, past the edge of the thing, to meet it.
export const SIGHT = 280;

export const PAGE_REWARD = { coins: 300, blackPearls: 1 };

// match.type says what to look for in a game:
//   lair     a lair (kraken ring) with that look
//   floe     a drifting floe with that look
//   isle     an island of that kind
//   rock     a rock of that material
//   whirlpool, pirates, pod (dolphins), whale, storm, calm, current
//   weather  the voyage's weather has that key set (fog, night, aurora)
export const PAGES = [
  {
    id: 'home',
    name: 'Home Waters',
    color: '#5fb3c8',
    entries: [
      { id: 'dolphins', name: 'Dolphins', icon: 'dolphin', match: { type: 'pod' }, text: 'Keep your speed up and they ride your bow wave, pushing you along.' },
      { id: 'whale', name: 'Humpback whale', icon: 'whale', match: { type: 'whale' }, text: 'A ring of bubbles means it is about to breach. Give it room.' },
      { id: 'kraken', name: 'The kraken', icon: 'tentacle', match: { type: 'lair', look: 'kraken' }, text: 'It sleeps under a ring of boiling water. Never linger in the ring.' },
      { id: 'whirlpool', name: 'Whirlpool', icon: 'spiral', match: { type: 'whirlpool' }, text: 'It drags you round and wears at the hull. Cross the edge, never the eye.' },
      { id: 'pirates', name: 'Pirate brig', icon: 'skull', match: { type: 'pirates' }, text: 'Fast downwind, slow upwind. Keep the wind on your beam to get away.' },
      { id: 'ice', name: 'Ice floe', icon: 'snow', match: { type: 'floe', look: 'ice' }, text: 'Drifting ice. It moves, so watch where it is going, not where it is.' },
    ],
  },
  {
    id: 'volcano',
    name: 'Volcano Isles',
    color: '#e0703a',
    entries: [
      { id: 'vent', name: 'Steam vent', icon: 'flame', match: { type: 'lair', look: 'vent' }, text: 'The sea glows, then the vent blows. Out of the ring before it does.' },
      { id: 'pumice', name: 'Pumice raft', icon: 'rock', match: { type: 'floe', look: 'pumice' }, text: 'Stone so full of air it floats, drifting in rafts on the swell.' },
      { id: 'cone', name: 'Fire mountain', icon: 'peak', match: { type: 'isle', look: 'cone' }, text: 'A young volcano, still smoking. The rocks round it are warm.' },
      { id: 'basalt', name: 'Basalt isle', icon: 'column', match: { type: 'isle', look: 'basalt' }, text: 'Old lava, cooled into black columns and ledges.' },
    ],
  },
  {
    id: 'harbor',
    name: 'Harbor City',
    color: '#8c9aa8',
    entries: [
      { id: 'crane', name: 'Dockside crane', icon: 'hammer', match: { type: 'lair', look: 'crane' }, text: 'When its shadow stops over you, a container is coming down.' },
      { id: 'ferry', name: 'Island ferry', icon: 'fleet', match: { type: 'floe', look: 'ferry' }, text: 'She keeps her timetable, not to the rules of the road. Give way.' },
      { id: 'quay', name: 'Stone quay', icon: 'anchor', match: { type: 'isle', look: 'quay' }, text: 'Wharves and warehouses, with the city lights behind.' },
      { id: 'container', name: 'Lost container', icon: 'chest', match: { type: 'rock', look: 'container' }, text: 'Fallen off a ship. Some are full of rubber ducks.' },
    ],
  },
  {
    id: 'alien',
    name: 'Planet Zeta',
    color: '#9a7ae0',
    entries: [
      { id: 'beast', name: 'The deep beast', icon: 'tentacle', match: { type: 'lair', look: 'beast' }, text: 'Nobody has seen all of it. Nobody wants to.' },
      { id: 'jelly', name: 'Moon jelly', icon: 'jelly', match: { type: 'floe', look: 'jelly' }, text: 'Big as a boat and soft as a cushion. It bounces you off.' },
      { id: 'crystal', name: 'Crystal reef', icon: 'gem', match: { type: 'isle', look: 'crystal' }, text: 'It hums when the wind blows through it.' },
      { id: 'spore', name: 'Spore isle', icon: 'leaf', match: { type: 'isle', look: 'spore' }, text: 'Giant mushrooms that glow after dark.' },
    ],
  },
  {
    id: 'jungle',
    name: 'Jungle Delta',
    color: '#5aa35a',
    entries: [
      { id: 'croc', name: 'River crocodile', icon: 'eye', match: { type: 'lair', look: 'croc' }, text: 'Two eyes and a ripple. Then a snap.' },
      { id: 'hippo', name: 'Hippo', icon: 'rock', match: { type: 'floe', look: 'hippo' }, text: 'It looks like a rock until it yawns.' },
      { id: 'jungle', name: 'Jungle isle', icon: 'leaf', match: { type: 'isle', look: 'jungle' }, text: 'Palms and vines, and parrots shouting at you.' },
      { id: 'mangrove', name: 'Mangroves', icon: 'wave', match: { type: 'isle', look: 'mangrove' }, text: 'Trees standing on their roots in the water.' },
    ],
  },
  {
    id: 'dino',
    name: 'Dino Lagoon',
    color: '#b59a52',
    entries: [
      { id: 'plesio', name: 'Plesiosaur', icon: 'dolphin', match: { type: 'lair', look: 'plesio' }, text: 'A long neck, then a longer one. It strikes from below.' },
      { id: 'turtle', name: 'Giant turtle', icon: 'shield', match: { type: 'floe', look: 'turtle' }, text: 'Older than the islands, and in no hurry at all.' },
      { id: 'fern', name: 'Fern isle', icon: 'leaf', match: { type: 'isle', look: 'fern' }, text: 'Ferns as tall as houses, and footprints bigger than your boat.' },
      { id: 'bones', name: 'Old bones', icon: 'bone', match: { type: 'rock', look: 'bones' }, text: 'Ribs and skulls in the shallows. Something was bigger once.' },
    ],
  },
  {
    id: 'sunken',
    name: 'Sunken City',
    color: '#4fb0a0',
    entries: [
      { id: 'eel', name: 'Moray eel', icon: 'wave', match: { type: 'lair', look: 'eel' }, text: 'It lives in the old drains and lunges at anything that passes.' },
      { id: 'galley', name: 'Ghost galley', icon: 'fleet', match: { type: 'floe', look: 'galley' }, text: 'A rowing ship of the old city, still drifting round its streets.' },
      { id: 'ruin', name: 'Drowned street', icon: 'column', match: { type: 'isle', look: 'ruin' }, text: 'Roofs and arches just above the water.' },
      { id: 'tower', name: 'Old tower', icon: 'lantern', match: { type: 'isle', look: 'tower' }, text: 'Its lamp went out long ago. Mostly.' },
    ],
  },
  {
    id: 'ghost',
    name: 'Ghost Sea',
    color: '#8fb8b0',
    entries: [
      { id: 'wraith', name: 'Sea wraith', icon: 'skull', match: { type: 'lair', look: 'wraith' }, text: 'Cold air, a green light, and a face in the fog.' },
      { id: 'ghostship', name: 'Ghost ship', icon: 'fleet', match: { type: 'floe', look: 'ghostship' }, text: 'Her crew are long gone. She sails on anyway.' },
      { id: 'grave', name: 'Graveyard isle', icon: 'moon', match: { type: 'isle', look: 'grave' }, text: 'Crooked stones for sailors who never came home.' },
      { id: 'hulk', name: 'Old hulk', icon: 'anchor', match: { type: 'isle', look: 'hulk' }, text: 'A wreck run aground, with grass growing on deck.' },
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora Ice',
    color: '#7fd0e8',
    entries: [
      { id: 'orca', name: 'Orca', icon: 'whale', match: { type: 'lair', look: 'orca' }, text: 'Black and white and very clever. It hunts in rings.' },
      { id: 'berg', name: 'Iceberg', icon: 'snow', match: { type: 'floe', look: 'berg' }, text: 'Most of it is under the water. Give it more room than you think.' },
      { id: 'glacier', name: 'Glacier', icon: 'peak', match: { type: 'isle', look: 'glacier' }, text: 'A river of ice, creaking down to the sea.' },
      { id: 'tundra', name: 'Tundra', icon: 'horizon', match: { type: 'isle', look: 'tundra' }, text: 'Moss and snow, and the odd penguin.' },
    ],
  },
  {
    id: 'toy',
    name: 'Toy Bay',
    color: '#e86a8a',
    entries: [
      { id: 'jack', name: 'Jack in the box', icon: 'chest', match: { type: 'lair', look: 'jack' }, text: 'Wind, wind, wind... POP.' },
      { id: 'duck', name: 'Rubber duck', icon: 'duck', match: { type: 'floe', look: 'duck' }, text: 'Squeaks when you bump it. Everyone bumps it.' },
      { id: 'blocks', name: 'Block isle', icon: 'home', match: { type: 'isle', look: 'blocks' }, text: 'Building blocks, stacked by a very big child.' },
      { id: 'sandcastle', name: 'Sandcastle', icon: 'crown', match: { type: 'isle', look: 'sandcastle' }, text: 'Towers and a moat, until the tide comes in.' },
    ],
  },
  {
    id: 'sky',
    name: 'Sky Sea',
    color: '#9fb4f0',
    entries: [
      { id: 'thunderhead', name: 'Thunderhead', icon: 'bolt', match: { type: 'lair', look: 'storm' }, text: 'A cloud that grumbles, darkens, then strikes.' },
      { id: 'airship', name: 'Airship', icon: 'wind', match: { type: 'floe', look: 'airship' }, text: 'It drifts where the wind goes, propellers turning.' },
      { id: 'cloudisle', name: 'Cloud isle', icon: 'cloud', match: { type: 'isle', look: 'cloud' }, text: 'Soft to look at, hard to sail through.' },
      { id: 'floater', name: 'Floating rock', icon: 'sun', match: { type: 'isle', look: 'floater' }, text: 'An island held up by nothing at all.' },
    ],
  },
  {
    id: 'weather',
    name: 'Wind and weather',
    color: '#c9b46a',
    entries: [
      { id: 'squall', name: 'Thunder squall', icon: 'bolt', match: { type: 'storm' }, text: 'Hard gusts and lightning. Ease the sail before it hits.' },
      { id: 'calm', name: 'Flat calm', icon: 'horizon', match: { type: 'calm' }, text: 'Glassy water where the wind dies. Go round, not through.' },
      { id: 'current', name: 'Sea current', icon: 'wave', match: { type: 'current' }, text: 'A river in the sea. Ride it with you, cross it against you.' },
      { id: 'fog', name: 'Sea fog', icon: 'fog', match: { type: 'weather', look: 'fog' }, text: 'You hear the bell buoys before you see them.' },
      { id: 'night', name: 'Night sailing', icon: 'moon', match: { type: 'weather', look: 'night' }, text: 'Lighthouses and lamps, and stars to steer by.' },
      { id: 'aurora', name: 'Northern lights', icon: 'star', match: { type: 'weather', look: 'aurora' }, text: 'Green curtains across the sky, all night long.' },
    ],
  },
];

export const ENTRIES = PAGES.flatMap((p) => p.entries.map((e) => ({ ...e, page: p.id })));
export const ATLAS_TOTAL = ENTRIES.length;

const entryKey = (id) => `atlas:${id}`;
const pageKey = (id) => `atlaspage:${id}`;

export function entryById(id) {
  return ENTRIES.find((e) => e.id === id) || null;
}

export function pageById(id) {
  return PAGES.find((p) => p.id === id) || null;
}

export function hasMet(save, id) {
  return save.wallet.owned.includes(entryKey(id));
}

export function atlasCount(save, page) {
  const list = page ? pageById(page).entries : ENTRIES;
  return list.filter((e) => hasMet(save, e.id)).length;
}

export function pageDone(save, page) {
  return pageById(page).entries.every((e) => hasMet(save, e.id));
}

export function pageRewarded(save, page) {
  return save.wallet.owned.includes(pageKey(page));
}

// Write an entry into the atlas. Returns null if it was already there, else
// { entry, page } with page set when this filled its page (the reward is
// paid then, once).
export function recordSighting(save, id) {
  const entry = entryById(id);
  if (!entry || hasMet(save, id)) return null;
  save.wallet.owned.push(entryKey(id));
  let page = null;
  if (pageDone(save, entry.page) && !pageRewarded(save, entry.page)) {
    save.wallet.owned.push(pageKey(entry.page));
    save.wallet.coins += PAGE_REWARD.coins;
    save.wallet.blackPearls += PAGE_REWARD.blackPearls;
    page = pageById(entry.page);
  }
  return { entry, page };
}

// --- What the boat can see now ---------------------------------------------

const near = (bx, by, x, y, r = 0) => (x - bx) ** 2 + (y - by) ** 2 < (SIGHT + r) ** 2;

function inView(game, m) {
  const { x, y } = game.boat;
  const level = game.level;
  switch (m.type) {
    case 'lair':
      return level.krakens.some((k) => (k.look || 'kraken') === m.look && near(x, y, k.x, k.y, k.r || 0));
    case 'floe':
      return level.floes.some((f) => f.look === m.look && near(x, y, f.cx + f.ox, f.cy + f.oy, f.radius));
    case 'isle':
      return level.islands.some((i) => i.kind === m.look && near(x, y, i.cx, i.cy, i.radius));
    case 'rock':
      return level.rocks.some((r) => r.material === m.look && near(x, y, r.x, r.y, r.r || 0));
    case 'whirlpool':
      return level.whirlpools.some((w) => near(x, y, w.x, w.y, w.r));
    case 'storm':
      return level.storms.some((s) => near(x, y, s.x, s.y, s.r * 0.5));
    case 'calm':
      return level.calms.some((c) => near(x, y, c.x, c.y, c.r * 0.5));
    case 'current':
      return level.currents.some((c) => {
        const dx = x - c.x;
        const dy = y - c.y;
        const along = dx * c.dirX + dy * c.dirY;
        const across = -dx * c.dirY + dy * c.dirX;
        return Math.abs(along) < c.halfL + SIGHT * 0.3 && Math.abs(across) < c.halfW + SIGHT * 0.3;
      });
    case 'pirates':
      return !!game.pirates && game.pirates.ships.some((s) => near(x, y, s.x, s.y));
    case 'pod':
      return !!game.life && game.life.pods.some((p) => near(x, y, p.x, p.y));
    case 'whale':
      return !!game.life && game.life.whales.some((w) => near(x, y, w.x, w.y));
    case 'weather': {
      const v = level.weather && level.weather[m.look];
      return m.look === 'fog' ? v >= 0.4 : !!v;
    }
    default:
      return false;
  }
}

// Entries the boat can see right now that the atlas doesn't have yet.
export function atlasInView(game, save) {
  if (!game || !game.boat || !game.level) return [];
  return ENTRIES.filter((e) => !hasMet(save, e.id) && inView(game, e.match)).map((e) => e.id);
}
