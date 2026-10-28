// The regatta fleet on the water: each rival's wake, the dirty air it trails
// downwind, and the boat itself in its racing colors.

import { createWake, updateWake, drawWake, drawBoat } from './boat.js';
import { DIRTY_REACH, shadowWidth } from '../world/regatta.js';

export function createFleetFx() {
  return { wakes: [] };
}

export function updateFleetFx(fx, game) {
  const race = game.race;
  if (!race) return;
  race.rivals.forEach((r, i) => {
    const wake = fx.wakes[i] || (fx.wakes[i] = createWake());
    updateWake(wake, r.boat, game.clock, r.capsized <= 0);
  });
}

export function drawFleetWakes(ctx, fx, game) {
  if (!game.race) return;
  for (const wake of fx.wakes) drawWake(ctx, wake, game.clock);
}

// A faint dark fan downwind of each sail: where its wind shadow falls.
export function drawDirtyAir(ctx, game, time) {
  const race = game.race;
  if (!race || game.status === 'finished') return;
  const dx = Math.cos(game.wind.angle);
  const dy = Math.sin(game.wind.angle);
  const w0 = shadowWidth(6);
  const w1 = shadowWidth(DIRTY_REACH);
  for (const r of race.rivals) {
    if (r.finished !== null || r.capsized > 0) continue;
    const { x, y } = r.boat;
    const g = ctx.createLinearGradient(x, y, x + dx * DIRTY_REACH, y + dy * DIRTY_REACH);
    // It breathes a little, so it reads as moving air rather than a stain.
    const a = 0.16 + 0.04 * Math.sin(time * 2 + x * 0.01);
    g.addColorStop(0, `rgba(6, 22, 34, ${a.toFixed(3)})`);
    g.addColorStop(1, 'rgba(6, 22, 34, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + dx * 6 - dy * w0, y + dy * 6 + dx * w0);
    ctx.lineTo(x + dx * DIRTY_REACH - dy * w1, y + dy * DIRTY_REACH + dx * w1);
    ctx.lineTo(x + dx * DIRTY_REACH + dy * w1, y + dy * DIRTY_REACH - dx * w1);
    ctx.lineTo(x + dx * 6 + dy * w0, y + dy * 6 - dx * w0);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawFleet(ctx, game, time) {
  if (!game.race) return;
  for (const r of game.race.rivals) {
    drawBoat(ctx, r.boat, time + r.name.length, {
      capsized: r.capsized > 0,
      pennant: [r.wind.wx - r.boat.vx, r.wind.wy - r.boat.vy],
      look: r.look,
    });
  }
}
