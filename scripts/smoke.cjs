// Browser smoke test of the bundled game: menus, a voyage sailed by the
// autopilot at high speed, the results card and today's daily voyage. Fails on
// any page error.
//
//   node scripts/smoke.cjs [--shots <dir>] [--level <index>] [--size 915x412]

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const shots = opt('shots', null);
const levelIndex = Number(opt('level', 0));
const [vw, vh] = opt('size', '915x412').split('x').map(Number);
const page = path.resolve(__dirname, '..', 'dist', 'index.html');

(async () => {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  tab.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const snap = async (name) => shots && tab.screenshot({ path: path.join(shots, `${name}.png`) });
  const step = (msg) => console.log(`- ${msg}`);

  await tab.goto(`file://${page}`);
  await tab.waitForFunction(() => window.__boatify && window.__boatify.state().frames > 20);
  step('title screen with demo voyage');
  await tab.waitForTimeout(1500);
  await snap('01-title');

  await tab.getByRole('button', { name: 'Start voyage' }).click();
  await tab.waitForSelector('section[aria-label="How to sail"].open');
  step('how to sail');
  await snap('02-howto');
  for (let i = 0; i < 2; i++) await tab.getByRole('button', { name: 'Next' }).click();
  await snap('03-howto-tacking');
  await tab.getByRole('button', { name: 'Skip' }).click();

  await tab.waitForSelector('section[aria-label="Voyage briefing"].open');
  step('briefing');
  await snap('04-briefing');
  await tab.locator('section[aria-label="Voyage briefing"]').getByRole('button', { name: 'Set sail' }).click();
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  step('sailing by hand');
  // Hold the helm to starboard for a moment with a touch drag.
  const box = { x: 170, y: vh - 120 };
  await tab.mouse.move(box.x, box.y);
  await tab.mouse.down();
  await tab.mouse.move(box.x + 30, box.y, { steps: 4 });
  await tab.waitForTimeout(1200);
  await snap('05-sailing');
  await tab.mouse.up();

  if (levelIndex !== 0) {
    await tab.evaluate((i) => window.__boatify.startLevel(i), levelIndex);
    await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 8000 });
  }
  step(`autopilot sails voyage ${levelIndex + 1}`);
  await tab.evaluate(() => {
    window.__boatify.setAutopilot(true);
    window.__boatify.setTimeScale(10);
  });
  await tab.waitForTimeout(1500);
  await snap('06-autopilot');
  await tab.waitForFunction(() => window.__boatify.state().mode === 'results', null, { timeout: 90000 });
  await tab.waitForTimeout(1600);
  const st = await tab.evaluate(() => window.__boatify.state());
  step(`finished in ${st.result.time.toFixed(1)} s with ${st.result.stars} stars, ${st.result.pearls}/${st.result.pearlsTotal} pearls`);
  await snap('07-results');

  await tab.getByRole('button', { name: 'Voyages' }).click();
  await tab.waitForSelector('section[aria-label="Voyages"].open');
  await snap('08-voyages');

  step('daily voyage: locked card, then charted and sailed');
  await tab.locator('.voyage.daily.locked').waitFor();
  await tab.evaluate(() => window.__boatify.startLevel('daily'));
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 15000 });
  const daily = await tab.evaluate(() => window.__boatify.state().level);
  if (!/^daily-\d{4}-\d\d-\d\d$/.test(daily)) throw new Error(`unexpected daily id ${daily}`);
  await tab.waitForTimeout(1000);
  await snap('09-daily');

  step('shipyard: four boats, the sloop is sailing');
  await tab.evaluate(() => window.__boatify.showTitle());
  await tab.getByRole('button', { name: 'Shipyard' }).click();
  await tab.waitForSelector('section[aria-label="Shipyard"].open');
  const cards = await tab.locator('.boat-card').count();
  const picked = await tab.locator('.boat-card.picked h3').textContent();
  if (cards !== 4 || picked !== 'Driftwood Sloop') throw new Error(`shipyard shows ${cards} boats, picked ${picked}`);
  await tab.waitForTimeout(300);
  await snap('10-shipyard');

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('Smoke test passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
