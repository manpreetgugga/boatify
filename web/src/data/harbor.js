// Your harbor: a bare island that coins build up, piece by piece, into a
// harbor with a lighthouse, docks, houses and boats. It's drawn on the title
// screen (render/harbor.js), growing as you build. Each row finished brings
// the harbor folk round with a black pearl.
//
// What's built lives in the wallet's `owned` list as 'harbor:<id>', so it
// travels with the save and with backup codes.

export const ROWS = [
  { id: 'lighthouse', name: 'Lighthouse', icon: 'lantern' },
  { id: 'docks', name: 'Docks', icon: 'anchor' },
  { id: 'houses', name: 'Houses', icon: 'home' },
  { id: 'boats', name: 'Boats', icon: 'fleet' },
];

// In the order each row is built. `needs` must be built first.
export const PIECES = [
  { id: 'tower', row: 'lighthouse', name: 'Lighthouse tower', price: 250, text: 'Red and white, on the point.' },
  { id: 'lamp', row: 'lighthouse', name: 'Lighthouse lamp', price: 500, needs: ['tower'], text: 'A beam that sweeps the sea.' },
  { id: 'keeper', row: 'lighthouse', name: "Keeper's cottage", price: 700, needs: ['lamp', 'hut'], text: 'Someone to keep the lamp lit.' },
  { id: 'jetty', row: 'docks', name: 'Wooden jetty', price: 120, text: 'Planks out into the water.' },
  { id: 'quay', row: 'docks', name: 'Stone quay', price: 450, needs: ['jetty'], text: 'A proper wall to tie up to.' },
  { id: 'breakwater', row: 'docks', name: 'Breakwater', price: 900, needs: ['quay'], text: 'A rock arm that keeps the swell out.' },
  { id: 'hut', row: 'houses', name: "Fisher's hut", price: 180, needs: ['jetty'], text: 'Nets drying by the door.' },
  { id: 'cottages', row: 'houses', name: 'Cottages', price: 500, needs: ['hut'], text: 'Neighbors, and smoke from the chimneys.' },
  { id: 'inn', row: 'houses', name: 'Harbor inn', price: 800, needs: ['cottages', 'quay'], text: 'Where sailors swap stories.' },
  { id: 'market', row: 'houses', name: 'Fish market', price: 1100, needs: ['inn'], text: 'Striped awnings and the morning catch.' },
  { id: 'dinghy', row: 'boats', name: 'Rowing boat', price: 150, needs: ['jetty'], text: 'Oars and all. Someone has to have them.' },
  { id: 'smack', row: 'boats', name: 'Fishing smack', price: 450, needs: ['dinghy'], text: 'Rust-red sails, out at dawn.' },
  { id: 'junk', row: 'boats', name: 'Trading junk', price: 900, needs: ['smack', 'quay'], text: 'Cargo from over the horizon.' },
  { id: 'ship', row: 'boats', name: 'Tall ship', price: 1500, needs: ['junk', 'breakwater'], text: 'Three masts, the pride of the harbor.' },
];

export const HARBOR_TOTAL = PIECES.length;
export const HARBOR_COST = PIECES.reduce((sum, p) => sum + p.price, 0);
export const ROW_PEARLS = 1; // black pearls for each row finished

const key = (id) => `harbor:${id}`;

export function pieceById(id) {
  return PIECES.find((p) => p.id === id) || null;
}

export function isBuilt(save, id) {
  return save.wallet.owned.includes(key(id));
}

// Ids of what's built, in the order of PIECES.
export function harborBuilt(save) {
  return PIECES.filter((p) => isBuilt(save, p.id)).map((p) => p.id);
}

// What a piece still waits on, as pieces, or [] when it can be built.
export function waitingOn(save, piece) {
  return (piece.needs || []).filter((id) => !isBuilt(save, id)).map(pieceById);
}

export function canBuild(save, piece) {
  return !isBuilt(save, piece.id) && !waitingOn(save, piece).length;
}

export function rowDone(save, row) {
  return PIECES.filter((p) => p.row === row).every((p) => isBuilt(save, p.id));
}

// Build a piece if it's next in line and the coins cover it. Returns null when
// it can't be built, else { piece, row } with `row` set when that finished
// the row (and paid its black pearl).
export function buildPiece(save, id) {
  const piece = pieceById(id);
  if (!piece || !canBuild(save, piece) || save.wallet.coins < piece.price) return null;
  save.wallet.coins -= piece.price;
  save.wallet.owned.push(key(id));
  const finished = rowDone(save, piece.row);
  if (finished) save.wallet.blackPearls += ROW_PEARLS;
  return { piece, row: finished ? ROWS.find((r) => r.id === piece.row) : null };
}

// The cheapest piece that can be built now, for the title's nudge.
export function nextPiece(save) {
  return PIECES.filter((p) => canBuild(save, p)).sort((a, b) => a.price - b.price)[0] || null;
}
