import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWind, sampleWind, shadowSources } from '../web/src/world/wind.js';
import { prepareIsland, blob } from '../web/src/world/shapes.js';
import { circlePolygon, circleCircle } from '../web/src/world/collision.js';
import { polygonArea } from '../web/src/core/math.js';

test('islands cast a wind shadow downwind, not upwind', () => {
  const isl = prepareIsland(blob(500, 500, 60, 3, 0.2), 'rock', 1);
  // Wind from the west (270) blows toward +x.
  const wind = createWind({ from: 270, speed: 16, gust: 0, shift: 0, period: 40 }, 1, [isl]);
  const lee = sampleWind(wind, 590, 500, {});
  const farLee = sampleWind(wind, 760, 500, {});
  const windward = sampleWind(wind, 360, 500, {});
  const open = sampleWind(wind, 590, 800, {});
  assert.ok(lee.speed < open.speed * 0.6, `lee ${lee.speed} vs open ${open.speed}`);
  assert.ok(windward.speed > open.speed * 0.9);
  assert.ok(lee.shade > 0.5 && open.shade < 0.05);
  assert.ok(farLee.speed > lee.speed, 'the shadow fades with distance');
});

test('long ridges shade with several circles', () => {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([500 + Math.cos(a) * 40, 500 + Math.sin(a) * 300]);
  }
  const isl = prepareIsland(pts, 'sand', 1);
  assert.ok(polygonArea(pts) > 30000);
  assert.ok(shadowSources(isl).length > 3);
});

test('calm zones take the wind away', () => {
  const wind = createWind({ from: 0, speed: 16, gust: 0, shift: 0, period: 40 }, 1, [], { calms: [{ x: 300, y: 300, r: 80 }] });
  assert.ok(sampleWind(wind, 300, 300, {}).speed < sampleWind(wind, 600, 600, {}).speed * 0.5);
});

test('circle vs polygon contact has an outward normal', () => {
  const sq = prepareIsland(
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    'rock',
    1,
  );
  assert.equal(circlePolygon(200, 50, 10, sq), null);
  const hit = circlePolygon(105, 50, 10, sq);
  assert.ok(hit && hit.nx > 0.9 && hit.depth > 0);
  const deep = circlePolygon(90, 50, 10, sq);
  assert.ok(deep && deep.nx > 0.9);
  assert.ok(circleCircle(0, 0, 5, { x: 8, y: 0, r: 5 }));
  assert.equal(circleCircle(0, 0, 5, { x: 20, y: 0, r: 5 }), null);
});
