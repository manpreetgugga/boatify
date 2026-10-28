// Dolphin guides: a hint you can guess without reading a word. Sit stuck head
// to wind, or sail off away from where you need to go, and a few dolphins
// surface off the bow and swim the way to go. Follow them up to speed and they
// ride your bow wave. The way comes from the autopilot's chart of the voyage.

import { DEG, angleDiff, dist } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';
import { createAutopilot, autopilotInput } from './autopilot.js';
import { addGuidePod } from './wildlife.js';
import { courseGoal } from './level.js';

export const GUIDE = {
  irons: 2.5, // seconds stuck head to wind before they come
  astray: 8, // seconds sailing away from the way to go
  slow: 3, // slower than this with the sail flapping is stuck
  cooldown: 20, // seconds between guides
  check: 1, // how often to look at the chart, in seconds
  near: 130, // stopping head to wind next to a castaway is on purpose
  away: 100 * DEG, // a course this far off the way to go is astray
};

export function createGuide(on = false) {
  return { on, irons: 0, astray: 0, check: 0, cooldown: 4, nav: null };
}

// The heading the chart says to steer from here: tacks upwind, gybes
// downwind, and around whatever is in the way.
export function wayToGo(game) {
  const g = game.guide;
  if (!g.nav) g.nav = createAutopilot(game);
  g.nav.replan = 0;
  autopilotInput(g.nav, game, 0);
  return g.nav;
}

export function updateGuide(game, dt) {
  const g = game.guide;
  if (!g || !g.on || game.status !== 'sailing') return;
  g.cooldown -= dt;
  if (game.life.pods.some((p) => p.state === 'guide')) return; // one pod at a time
  const { boat } = game;
  const speed = boatSpeed(boat);
  const heaveTo = game.castaways.some((c) => c.state === 'adrift' && dist(boat.x, boat.y, c.x, c.y) < GUIDE.near);
  // In a strong wind a boat in irons drifts backwards: what counts is headway.
  const headway = boat.vx * Math.cos(boat.heading) + boat.vy * Math.sin(boat.heading);
  g.irons = boat.luffing && headway < GUIDE.slow && !heaveTo ? g.irons + dt : 0;
  g.check -= dt;
  if (g.check <= 0) {
    g.check = GUIDE.check;
    // Sailing away from B is only a worry if the chart agrees: a reef or an
    // island can make the way round a long one.
    const course = Math.atan2(boat.vy, boat.vx);
    const goal = courseGoal(game);
    const off = (x, y) => Math.abs(angleDiff(course, Math.atan2(y - boat.y, x - boat.x))) > GUIDE.away;
    // Nor is it when there's a good reason: fetching a castaway, or running
    // from a pirate.
    const errand = game.castaways.some((c) => c.state === 'adrift' && !off(c.x, c.y)) || (game.pirates && game.pirates.ships.some((p) => p.state === 'chase'));
    let astray = speed > GUIDE.slow && !errand && off(goal.x, goal.y);
    if (astray) {
      const nav = wayToGo(game);
      astray = !!nav.target && off(nav.target[0], nav.target[1]);
    }
    g.astray = astray ? g.astray + GUIDE.check : 0;
  }
  if (g.cooldown > 0) return;
  if (g.irons >= GUIDE.irons) summonGuide(game, 'irons');
  else if (g.astray >= GUIDE.astray) summonGuide(game, 'astray');
}

export function summonGuide(game, reason, way = wayToGo(game).desired) {
  const g = game.guide;
  const pod = addGuidePod(game.life, game.boat, way);
  if (g) {
    g.cooldown = GUIDE.cooldown;
    g.irons = 0;
    g.astray = 0;
  }
  game.events.push({ type: 'guide', reason, x: pod.x, y: pod.y });
  return pod;
}
