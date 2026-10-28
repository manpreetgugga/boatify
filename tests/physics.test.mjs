import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoat, stepBoat, boatSpeed, CAPSIZE_ANGLE } from '../web/src/physics/boat.js';
import { beaufort, toKnots, optimalTrim } from '../web/src/physics/sailing.js';
import { DEG } from '../web/src/core/math.js';

// Steady speed with the heading held fixed and wind from the west.
function steadySpeed(twaDeg, wind = 16, seconds = 50) {
  const heading = Math.PI - twaDeg * DEG;
  const b = createBoat(0, 0, heading);
  for (let i = 0; i < 120 * seconds; i++) {
    b.heading = heading;
    b.yawRate = 0;
    stepBoat(b, { steer: 0, trimTarget: 0.5, autoTrim: true }, { wx: wind, wy: 0, cx: 0, cy: 0 }, 1 / 120);
  }
  return { speed: boatSpeed(b), boat: b };
}

// Speed along the bow (negative when blown backwards).
const headway = ({ boat }) => boat.vx * Math.cos(boat.heading) + boat.vy * Math.sin(boat.heading);

test('a boat cannot sail straight into the wind', () => {
  assert.ok(headway(steadySpeed(0)) < 0.5, 'head to wind it drifts backwards');
  assert.ok(headway(steadySpeed(20)) < 1.5);
});

test('the beam reach is faster than close-hauled and a dead run', () => {
  const close = steadySpeed(50).speed;
  const beam = steadySpeed(95).speed;
  const run = steadySpeed(180).speed;
  assert.ok(close > 4, `close-hauled should still move (${close})`);
  assert.ok(beam > close, `beam ${beam} > close ${close}`);
  assert.ok(beam > run, `beam ${beam} > run ${run}`);
});

test('sailing upwind still makes ground to windward when tacking', () => {
  const { boat } = steadySpeed(45);
  // Wind from the west: upwind progress is toward -x.
  assert.ok(-boat.vx > 2, `VMG upwind ${-boat.vx}`);
});

test('more wind means more speed and more heel', () => {
  const light = steadySpeed(90, 10);
  const strong = steadySpeed(90, 24);
  assert.ok(strong.speed > light.speed);
  assert.ok(Math.abs(strong.boat.heel) > Math.abs(light.boat.heel));
  assert.ok(Math.abs(light.boat.heel) < CAPSIZE_ANGLE);
});

test('optimal trim eases out as the wind moves aft', () => {
  assert.ok(optimalTrim(45 * DEG).trim < optimalTrim(90 * DEG).trim);
  assert.ok(optimalTrim(90 * DEG).trim < optimalTrim(170 * DEG).trim);
});

test('Beaufort and knots conversions', () => {
  assert.equal(beaufort(0.5).force, 0);
  assert.equal(beaufort(10).force, 3);
  assert.equal(beaufort(30).force, 7);
  assert.ok(Math.abs(toKnots(10) - 6) < 1e-9);
});
