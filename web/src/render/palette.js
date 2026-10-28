// Shared colors and fonts. The look is a marine chart at dusk: deep teal
// water, warm sand, brass instruments and a signal-orange accent.

export const C = {
  seaDeep: '#0b2a3c',
  sea: '#0f4c5c',
  seaLight: '#1a6b78',
  shallow: '#3fa7a0',
  foam: '#e8f4f2',
  sand: '#e6cf98',
  sandDark: '#c4a66b',
  grass: '#5b9653',
  grassDark: '#3d7040',
  rock: '#706a63',
  rockDark: '#47433f',
  rockLight: '#9d968c',
  coral: '#ef7d6d',
  ice: '#eaf6f8',
  iceShade: '#b5dbe5',
  iceDeep: '#6fbfd1',
  coralDark: '#b9524f',
  hull: '#8b5a3a',
  hullDark: '#5e3b25',
  deck: '#d1a574',
  sail: '#f5f0e4',
  sailShade: '#d9d2c2',
  signal: '#ff6b35',
  brass: '#d9a441',
  chart: '#d63ea9',
  ok: '#3ddc97',
  warn: '#ffc857',
  danger: '#ff4d4d',
  ink: '#06141d',
  panel: 'rgba(6, 20, 29, 0.72)',
  panelEdge: 'rgba(232, 244, 242, 0.14)',
  text: '#e8f4f2',
  textDim: 'rgba(232, 244, 242, 0.62)',
};

export const FONT = {
  display: "'Barlow Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif",
  body: "'Barlow', 'Roboto', system-ui, sans-serif",
};

export function font(size, weight = 600, family = FONT.display, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}
