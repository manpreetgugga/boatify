// Each world's colours: the sea, the shallows around its islands, its
// currents and whirlpools, how its islands and rocks show on the minimap, and
// a faint tint over the whole view. Home Waters keeps the original chart.

import { C } from './palette.js';

export const THEMES = {
  home: {
    sea: C.sea,
    edge: 'rgba(4, 16, 26, 0.55)',
    mapSea: 'rgba(15, 76, 92, 0.9)',
    shallow: '63, 167, 160',
    shallowHi: '70, 180, 170',
    flow: '90, 200, 215',
    flowLine: '200, 240, 245',
    whirl: '3, 20, 32',
    whirlCore: '1, 8, 14',
    tint: null,
  },
  volcano: {
    sea: '#1d3d44',
    edge: 'rgba(10, 8, 8, 0.6)',
    mapSea: 'rgba(32, 58, 64, 0.92)',
    shallow: '110, 120, 112',
    shallowHi: '150, 128, 100',
    flow: '230, 140, 90',
    flowLine: '255, 214, 180',
    whirl: '30, 12, 8',
    whirlCore: '60, 14, 4',
    tint: 'rgba(90, 30, 10, 0.07)',
  },
  harbor: {
    sea: '#1e4a52',
    edge: 'rgba(6, 14, 20, 0.6)',
    mapSea: 'rgba(30, 74, 82, 0.92)',
    shallow: '90, 140, 140',
    shallowHi: '120, 160, 150',
    flow: '120, 190, 200',
    flowLine: '210, 236, 240',
    whirl: '6, 18, 24',
    whirlCore: '2, 8, 12',
    tint: null,
  },
  alien: {
    sea: '#34265e',
    edge: 'rgba(10, 4, 24, 0.6)',
    mapSea: 'rgba(52, 38, 94, 0.92)',
    shallow: '150, 110, 230',
    shallowHi: '120, 230, 200',
    flow: '120, 240, 200',
    flowLine: '210, 255, 240',
    whirl: '16, 6, 36',
    whirlCore: '40, 10, 70',
    tint: 'rgba(80, 30, 120, 0.08)',
  },
};

export function themeOf(level) {
  return THEMES[level.theme] || THEMES.home;
}

// Minimap colours by island kind and rock material.
export const MAP_ISLAND = {
  sand: C.sand,
  rock: '#8d867c',
  ice: C.ice,
  cone: '#7a5546',
  basalt: '#5a5960',
  quay: '#a7aeb2',
  crystal: '#b796ff',
  spore: '#6fd3b0',
};

export const MAP_ROCK = {
  rock: '#cfc7bb',
  coral: C.coral,
  basalt: '#8a8790',
  piling: '#b08a5c',
  container: '#e0703a',
  shard: '#d4b8ff',
  pod: '#8ff0cc',
};

export const MAP_FLOE = {
  ice: C.ice,
  pumice: '#a9a299',
  ferry: '#f2f2ee',
  jelly: '#ff9fd8',
};

// Burst colours when the boat hits something.
export const HIT_COLOR = {
  basalt: '#9a96a0',
  cone: '#ff8a4a',
  pumice: '#cfc8bd',
  quay: '#c9cfd2',
  piling: '#b08a5c',
  container: '#ff9a5a',
  steel: '#f2f2ee',
  crystal: '#d9c4ff',
  shard: '#d9c4ff',
  spore: '#9ff5d6',
  pod: '#9ff5d6',
  jelly: '#ffb0e4',
};
