// Turns a voyage definition into the runtime level used by the simulation
// and the renderer.

import { prepareIsland } from './shapes.js';
import { prepareCurrents, prepareWhirlpools } from './water.js';
import { prepareFloes, moveFloes } from './floes.js';
import { fromBearing } from '../core/math.js';

export function buildLevel(def) {
  const [width, height] = def.size;
  const islands = (def.islands || []).map((isl, i) => ({ ...prepareIsland(isl.pts, isl.kind, i + 1), shadow: isl.shadow }));
  const rocks = (def.rocks || []).map((r) => ({ material: 'rock', ...r }));
  let pickupId = 0;
  const pickups = (def.pickups || []).map((p) => ({ ...p, id: pickupId++, taken: false, bob: Math.random() * 6 }));
  const checkpoints = (def.checkpoints || []).map((c, i) => ({ ...c, r: c.r || 40, index: i, reached: false }));
  const level = {
    id: def.id,
    name: def.name,
    theme: def.theme || 'home',
    festival: def.festival || null,
    width,
    height,
    islands,
    rocks,
    pickups,
    checkpoints,
    currents: prepareCurrents(def.currents),
    whirlpools: prepareWhirlpools(def.whirlpools),
    floes: prepareFloes(def.floes),
    calms: def.calms || [],
    storms: def.storms || [],
    krakens: (def.krakens || []).map((k) => ({ look: 'kraken', ...k, phase: 'idle', phaseTime: 0, hit: false })),
    start: { x: def.start.x, y: def.start.y, heading: fromBearing(def.start.heading) },
    finish: { ...def.finish },
    weather: { rain: 0, snow: 0, fog: 0, night: false, lightning: false, dark: 0, ...(def.weather || {}) },
    par: def.par,
    tips: def.tips || [],
    endless: !!def.endless,
    race: !!def.race,
  };
  moveFloes(level, 0);
  return level;
}

export function pearlCount(level) {
  return level.pickups.filter((p) => p.kind === 'pearl').length;
}

// Where the boat is headed: B, on the open sea the next gate, and in a
// regatta the next mark until they are all rounded.
export function courseGoal(game) {
  const { level } = game;
  if (level.race) return level.checkpoints[game.nextCheckpoint] || level.finish;
  if (!level.endless) return level.finish;
  return level.checkpoints[game.nextCheckpoint] || { x: game.boat.x + 600, y: level.height / 2 };
}
