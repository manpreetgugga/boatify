// Charts the worlds' voyages. For each one it tries courses until the
// autopilot brings one home in good shape, then writes that attempt, its
// star times and the course's signature to web/src/data/charts.js.
// Run it after changing a world's specs or the charter:
//   node scripts/chart-worlds.mjs            every world
//   node scripts/chart-worlds.mjs volcano    just these worlds (ids)

import { writeFileSync } from 'node:fs';
import { WORLDS } from '../web/src/data/worlds.js';
import { CHARTS } from '../web/src/data/charts.js';
import { charterVoyage } from '../web/src/world/charter.js';
import { createGame, stepGame, drainEvents } from '../web/src/world/game.js';
import { createAutopilot, autopilotInput } from '../web/src/world/autopilot.js';
import { levelSignature } from '../web/src/world/ghost.js';

const ATTEMPTS = 12;

// The autopilot's time, or null if it can't bring the boat home whole.
export function trial(def, limit) {
  const game = createGame(def);
  const ap = createAutopilot(game);
  const dt = 1 / 30;
  let sunk = 0;
  while (game.status !== 'finished' && game.time < limit) {
    stepGame(game, autopilotInput(ap, game, dt), dt);
    for (const e of drainEvents(game)) if (e.type === 'respawn') sunk += 1;
    if (sunk) return null;
  }
  return game.status === 'finished' && game.hull > 40 ? game.result.time : null;
}

const only = process.argv.slice(2);
const out = { ...CHARTS };
for (const world of WORLDS) {
  if (world.id === 'home' || (only.length && !only.includes(world.id))) continue;
  world.voyages.forEach((spec, index) => {
    const t0 = Date.now();
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const def = charterVoyage(world, index, attempt);
      if (!def) continue;
      const t = trial(def, spec.f && spec.f.long ? 320 : 260);
      if (t === null) continue;
      out[spec.id] = [attempt, Math.ceil((t * 1.05) / 5) * 5, Math.ceil((t * 1.4) / 5) * 5, levelSignature(def)];
      console.log(`${world.id} ${index + 1} ${spec.id}: attempt ${attempt}, ${t.toFixed(1)} s (${Date.now() - t0} ms)`);
      return;
    }
    console.log(`${world.id} ${index + 1} ${spec.id}: NOT CHARTED`);
    process.exitCode = 1;
  });
}

const ids = WORLDS.flatMap((w) => (w.id === 'home' ? [] : w.voyages.map((v) => v.id)));
const lines = ids.filter((id) => out[id]).map((id) => `  '${id}': [${out[id].map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ')}],`);
writeFileSync(
  new URL('../web/src/data/charts.js', import.meta.url),
  `// Written by scripts/chart-worlds.mjs: for each world voyage, the attempt the
// autopilot sailed home, its star times, and the course's signature.
export const CHARTS = {
${lines.join('\n')}
};
`,
);
