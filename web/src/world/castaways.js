// Castaways: sailors the squall left clinging to wreckage. Come alongside
// slowly (turn up into the wind and the boat stops) and they climb aboard;
// bring them home to the harbor and they count as rescued. Each one aboard
// sits out on the rail: a little less heel, a little more weight to push.

import { dist } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';

export const HAUL_R = 34; // how close alongside they can reach a line
export const HAUL_SPEED = 5; // units/s (7 kn): any faster and they can't hold on
export const HAUL_TIME = 1.4; // seconds alongside to haul them in
export const SIGHT_R = 520; // close enough to hear them shout

// Thank-yous for the sailors adrift on a daily voyage.
export const DRIFTERS = [
  { name: 'Ada', line: 'I waved at three ships before you. You are my favourite.' },
  { name: 'Bram', line: 'Lost the boat, kept the hat. Priorities.' },
  { name: 'Cass', line: 'I was beginning to think the gulls were my crew now.' },
  { name: 'Dov', line: 'Never thought I would be so glad to see a sail.' },
  { name: 'Esme', line: 'The plank and I were just getting to know each other.' },
  { name: 'Finn', line: 'Squall came out of nowhere. You came out of somewhere. Thank you.' },
  { name: 'Hana', line: 'I sang every sea shanty I know. Twice.' },
  { name: 'Ivo', line: 'Mind the bilge, I have brought half the sea with me.' },
];

export function prepareCastaways(def) {
  return (def.castaways || []).map((c, i) => ({ ...c, id: i, state: 'adrift', haul: 0, seen: false, fast: false }));
}

export function castawaysAboard(game) {
  return game.castaways.filter((c) => c.state === 'aboard');
}

export function updateCastaways(game, dt) {
  const { boat } = game;
  const sailing = game.status === 'sailing';
  const speed = boatSpeed(boat);
  for (const c of game.castaways) {
    if (c.state === 'aboard') continue;
    const d = dist(boat.x, boat.y, c.x, c.y);
    if (!c.seen && d < SIGHT_R) {
      c.seen = true;
      game.events.push({ type: 'castaway', phase: 'sighted', name: c.name, x: c.x, y: c.y });
    }
    const alongside = sailing && d < HAUL_R;
    if (alongside && speed < HAUL_SPEED) {
      c.haul += dt;
      if (c.haul >= HAUL_TIME) {
        c.state = 'aboard';
        c.haul = HAUL_TIME;
        boat.crew += 1;
        game.events.push({ type: 'castaway', phase: 'aboard', name: c.name, line: c.line, x: c.x, y: c.y });
      }
      continue;
    }
    c.haul = Math.max(0, c.haul - dt * 2);
    // Sweeping past too fast: they shout once a pass.
    if (alongside && !c.fast) {
      c.fast = true;
      game.events.push({ type: 'castaway', phase: 'fast', name: c.name, x: c.x, y: c.y });
    } else if (d > HAUL_R + 40) {
      c.fast = false;
    }
  }
}
