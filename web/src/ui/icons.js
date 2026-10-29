// Line icons for the medals and menus, drawn on a 24-unit grid in the current text colour.

const PATHS = {
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M8 11h8M4 13a8 8 0 0 0 16 0"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
  pearl: '<path d="M3.5 12a8.5 8.5 0 0 1 17 0z"/><path d="M12 3.5V12M7.5 4.8L9.5 12M16.5 4.8L14.5 12"/><circle cx="12" cy="17.5" r="3.5"/>',
  shield: '<path d="M12 21.5s7.5-3.6 7.5-9.5V5.3L12 2.5 4.5 5.3V12c0 5.9 7.5 9.5 7.5 9.5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  wind: '<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2.5h4M18.5 5.5l1.5 1.5"/>',
  bolt: '<path d="M13 2.5L4.5 13.5h7l-1 8 8.5-11h-7z"/>',
  tentacle: '<path d="M7 21c0-5 4-6 4-10.5a3.5 3.5 0 0 1 7 0c0 2-1.5 3-3 3s-2-1.2-1-2.2"/><path d="M3 21c2-1 2-3 1.5-5"/><path d="M20.5 21c-1.5-1-1.8-2.5-1.3-4.5"/>',
  snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  map: '<path d="M2.5 6l6-3 7 3 6-3v15l-6 3-7-3-6 3z"/><path d="M8.5 3v15M15.5 6v15"/>',
  gem: '<path d="M6 3.5h12l3.5 5L12 21 2.5 8.5z"/><path d="M2.5 8.5h19M9 3.5l-1.5 5L12 21l4.5-12.5L15 3.5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 15.5h14"/>',
  bottle: '<path d="M10 2.5h4v4l2 3V20a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V9.5l2-3z"/><path d="M10.5 12.5h3M10.5 15.5h3"/>',
  hammer: '<path d="M13.5 7.5l-9 9a1.8 1.8 0 0 0 2.5 2.5l9-9"/><path d="M11.5 5.5l4-3 6 6-3 4-2.5-2.5-2-.5z"/>',
  fleet: '<path d="M3 17h18l-2.5 3.5h-13z"/><path d="M12 3v12M12 4l6 9h-6M12 6l-5 7h5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  flame: '<path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6-4-10-1.5 2-2 3.5-2 5-1-1-1.5-2-1.5-3.5C8.5 9 5.5 11.5 5.5 15a6.5 6.5 0 0 0 6.5 6.5z"/><path d="M12 21.5a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1.5-2.5 2.5-4 1 1.5 2.5 2.5 2.5 4a2.5 2.5 0 0 1-2.5 2.5z"/>',
  dolphin: '<path d="M2.5 14c2-.3 3.4-1.4 4.6-3C10 7.5 15.5 7 19 10.5l2.5-2-.5 4 1.5 3.5-3.5-1.5C15.5 11.5 11 11.5 8 14.5z"/><path d="M12 8l1.5-3.5 1.5 3.8"/><path d="M3 19.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/>',
  whale: '<path d="M2.5 13c0-3.5 3-5.5 7-5.5 4.5 0 7 2.5 8.5 4.5l3.5-3.5-.5 4 1 3-3.5-.5c-2 2.5-5.5 4-9 4-4.5 0-7-2.5-7-6z"/><path d="M3 15c3 1 6 1 8.5-.5"/><path d="M9.5 7.5V4.5M9.5 4.5C8.5 3 7 3 6 3.5M9.5 4.5c1-1.5 2.5-1.5 3.5-1"/>',
  skull: '<path d="M12 3c-4 0-7 2.6-7 6.2 0 2 .9 3.6 2.5 4.6V16h9v-2.2c1.6-1 2.5-2.6 2.5-4.6C19 5.6 16 3 12 3z"/><circle cx="9.3" cy="9.6" r="1.4"/><circle cx="14.7" cy="9.6" r="1.4"/><path d="M10.6 16v-1.7M13.4 16v-1.7M4.5 18l15 3.5M19.5 18l-15 3.5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 9v6M10.5 10.5h3"/>',
  blackPearl: '<circle cx="11" cy="13" r="7.5" fill="currentColor" fill-opacity="0.4"/><path d="M7.4 11.6a4 4 0 0 1 3.2-2.9"/><path d="M19.5 2.5v4.5M17.25 4.75h4.5"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z"/>',
  chest: '<path d="M3.5 10a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v9.5h-17z"/><path d="M3.5 12h17M10.5 12v3h3v-3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7.4 10.5M17 6h3v1.5a3 3 0 0 1-3.4 3"/><path d="M12 14v4M8 20.5h8M9.5 18h5"/>',
  horizon: '<path d="M2 16.5h20M5 20h14"/><path d="M6.5 16.5a5.5 5.5 0 0 1 11 0"/><path d="M12 4.5v3M5.3 7.8l2 2M18.7 7.8l-2 2"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="M15.8 8.2l-2 5.6-5.6 2 2-5.6z"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13c0 4.5-2.5 8-6.5 8-2.5 0-4-1.5-5.5-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19c3-4 6-7 10-10M9 15h4M11 11.5V9"/>',
  bone: '<path d="M8.5 15.5l7-7"/><path d="M8.5 15.5a2.5 2.5 0 1 1-3.5 3.5 2.5 2.5 0 1 1-1.5-4 2.5 2.5 0 1 1 5 .5zM15.5 8.5a2.5 2.5 0 1 1 3.5-3.5 2.5 2.5 0 1 1 1.5 4 2.5 2.5 0 1 1-5-.5z"/>',
  column: '<path d="M4 5h16M5 3h14M6 21h12M4 21h16M7 5v16M17 5v16M10.3 5v16M13.7 5v16"/>',
  duck: '<path d="M4 13c0 4 3 7 8 7s8-3 8-7c-2 1-4 1-6 0 2-1 3-3 3-5a4 4 0 0 0-8 0c0 2 1 3 2 4-3 0-5 0-7 1z"/><path d="M15 8h3M11 7.5h.01"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  lantern: '<path d="M9 3h6M12 3v2M7.5 8a4.5 1.5 0 0 1 9 0v8a4.5 1.5 0 0 1-9 0z"/><path d="M7.5 8h9M7.5 16h9M12 11c-1 1-1 2.5 0 3 1-.5 1-2 0-3zM10 21h4"/>',
};

export function icon(name, size = 24) {
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.star}</svg>`;
}

export const ICONS = Object.keys(PATHS);
