// Castaways adrift: a sailor on a broken plank, waving, with a pulse of
// ripples so they can be spotted across the water. Close by, a ring shows how
// near you must come and fills as they are hauled in.

import { boatSpeed } from '../physics/boat.js';
import { HAUL_R, HAUL_SPEED, HAUL_TIME } from '../world/castaways.js';
import { viewBounds } from './camera.js';
import { C, font } from './palette.js';
import { t } from '../i18n/index.js';

const SHIRTS = ['#e0503a', '#3a7bd5', '#f2b33d', '#47a86b', '#b45ad1', '#ef8a3a'];
const SKIN = ['#e8b48c', '#c68a5e', '#8d5a3b', '#f1c9a5'];

const pick = (list, c) => list[(c.name.length * 7 + c.name.charCodeAt(0)) % list.length];
export const shirtOf = (c) => pick(SHIRTS, c);
export const skinOf = (c) => pick(SKIN, { name: `${c.name}~` });

export function drawCastaways(ctx, game, cam, time) {
  const v = viewBounds(cam, 70);
  const { boat } = game;
  const speed = boatSpeed(boat);
  for (const c of game.castaways) {
    if (c.state === 'aboard') continue;
    if (c.x < v.minX || c.x > v.maxX || c.y < v.minY || c.y > v.maxY) continue;
    const d = Math.hypot(boat.x - c.x, boat.y - c.y);
    const near = d < 260;
    ctx.save();
    ctx.translate(c.x, c.y);

    // Ripples pulse out from the splashing, quicker once you are close.
    const period = near ? 1.4 : 2.4;
    for (let k = 0; k < 2; k++) {
      const p = ((time + c.id * 0.7) / period + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(232, 244, 242, ${(0.5 * (1 - p)).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + p * 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The haul ring: how close to come, and how far the hauling has got.
    if (d < 200 && game.status === 'sailing') {
      const fast = speed >= HAUL_SPEED;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -time * 8;
      ctx.strokeStyle = fast && d < HAUL_R + 30 ? 'rgba(255, 200, 87, 0.85)' : 'rgba(232, 244, 242, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, HAUL_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (c.haul > 0) {
        ctx.strokeStyle = C.ok;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, HAUL_R, -Math.PI / 2, -Math.PI / 2 + (c.haul / HAUL_TIME) * Math.PI * 2);
        ctx.stroke();
      }
      if (fast && d < HAUL_R + 30) {
        ctx.font = font(11, 800);
        ctx.textAlign = 'center';
        ctx.fillStyle = C.warn;
        ctx.fillText(t('SLOW DOWN'), 0, -HAUL_R - 8);
      }
    }

    // Wreckage: a plank and a splintered spar, rocking on the swell.
    const rock = Math.sin(time * 1.7 + c.id) * 0.18;
    ctx.save();
    ctx.rotate(0.5 + rock);
    ctx.fillStyle = 'rgba(0, 10, 18, 0.3)';
    ctx.fillRect(-12, -2, 25, 7);
    ctx.fillStyle = '#9b6a43';
    ctx.fillRect(-13, -3.5, 25, 7);
    ctx.strokeStyle = '#5e3b25';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-13, -3.5, 25, 7);
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(12, 0.6);
    ctx.stroke();
    ctx.fillStyle = '#c9a777';
    ctx.fillRect(6, -9, 3, 9);
    ctx.restore();

    // The sailor, sat on the plank, waving with one arm, harder when you are near.
    const wave = Math.sin(time * (near ? 9 : 5) + c.id) * (near ? 0.9 : 0.6);
    ctx.fillStyle = shirtOf(c);
    ctx.beginPath();
    ctx.ellipse(-2, 0, 3.6, 4.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skinOf(c);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, -3);
    ctx.lineTo(-1 + Math.sin(-0.4 + wave) * 8, -3 - Math.cos(-0.4 + wave) * 8);
    ctx.stroke();
    ctx.fillStyle = skinOf(c);
    ctx.beginPath();
    ctx.arc(-2.4, 0.4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
