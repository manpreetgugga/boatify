// Google Play store art, made from the game itself: the 512 px icon (drawn
// from the launcher icon's vector drawables), the 1024x500 feature graphic and
// screenshots for phones and 7" and 10" tablets. Writes them into
// fastlane/metadata/android/en-US/images/. Needs Playwright, like the smoke
// test, and a fresh bundle: `npm run store-art` builds it first.
//
//   node scripts/store-art.cjs [icon] [feature] [phone] [seven] [ten]

const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const images = path.join(root, 'fastlane', 'metadata', 'android', 'en-US', 'images');
const page = `file://${path.join(root, 'dist', 'index.html')}`;
const drawables = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable');

// Landscape at 2x: 1920x1080, 2048x1200 and 2560x1600.
const DEVICES = {
  phone: { dir: 'phoneScreenshots', width: 960, height: 540 },
  seven: { dir: 'sevenInchScreenshots', width: 1024, height: 600 },
  ten: { dir: 'tenInchScreenshots', width: 1280, height: 800 },
};

// A sailor three voyages in: the daily voyage, Open Sea and regattas are open.
function seedSave() {
  const levels = {};
  ['lost-oar', 'beam-reach', 'into-the-wind'].forEach((id, i) => (levels[id] = { best: 80 + i * 10, stars: 3, pearls: 6, pearlsTotal: 9, runs: 2 }));
  const save = { levels, stats: { voyages: 3, distance: 3000, capsizes: 0, pearls: 0, rescued: 0 }, seenIntro: true, seenFilm: true, sailed: ['sloop'], sightings: { dolphins: true, whale: true } };
  localStorage.setItem('boatify.save.v1', JSON.stringify(save));
}

async function open(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.addInitScript(seedSave);
  await tab.goto(page);
  await tab.waitForFunction(() => window.__boatify && window.__boatify.state().frames > 20);
  tab.errors = errors;
  return tab;
}

// Tips and messages come and go; the store shots leave them out.
const quiet = (tab) => tab.addStyleTag({ content: '#toasts { visibility: hidden !important; }' });

// Sail a voyage with the autopilot, fast, up to a moment.
async function sailTo(tab, level, time) {
  await tab.evaluate((i) => {
    window.__boatify.setAutopilot(true);
    window.__boatify.startLevel(i);
  }, level);
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 10000 });
  await tab.evaluate(() => window.__boatify.setTimeScale(8));
  await tab.waitForFunction((t) => window.__boatify.state().time >= t, time, { timeout: 120000 });
  await tab.evaluate(() => window.__boatify.setTimeScale(1));
  await tab.waitForTimeout(600);
}

const SHOTS = [
  ['1-title', async (tab) => tab.waitForTimeout(2500)],
  [
    '2-prologue',
    async (tab) => {
      await tab.evaluate(() => window.__boatify.playFilm());
      await tab.evaluate(() => window.__boatify.filmSeek(33.5));
      await tab.waitForTimeout(700);
    },
  ],
  [
    '3-dolphins',
    async (tab) => {
      await quiet(tab);
      await tab.evaluate(() => window.__boatify.startLevel(0));
      await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 10000 });
      await tab.waitForTimeout(2500);
      await tab.evaluate(() => window.__boatify.inIrons());
      await tab.waitForFunction(() => window.__boatify.guidePod(), null, { timeout: 10000 });
      await tab.waitForTimeout(2300);
    },
  ],
  ['4-pirates', async (tab) => (await quiet(tab), sailTo(tab, 9, 61.6))],
  ['5-kraken', async (tab) => (await quiet(tab), sailTo(tab, 7, 40))],
  ['6-storm', async (tab) => (await quiet(tab), sailTo(tab, 6, 44))],
  [
    '7-ice',
    async (tab) => {
      // Sail on until the penguins dive in beside the boat.
      await quiet(tab);
      await sailTo(tab, 8, 40);
      await tab.evaluate(() => window.__boatify.setTimeScale(4));
      await tab.waitForFunction(() => window.__boatify.penguins().swimming >= 3, null, { timeout: 120000 });
      await tab.evaluate(() => window.__boatify.setTimeScale(1));
      await tab.waitForTimeout(2600);
    },
  ],
  [
    '8-voyages',
    async (tab) => {
      await tab.getByRole('button', { name: 'Voyages' }).click();
      await tab.waitForSelector('section[aria-label="Voyages"].open');
      await tab.waitForTimeout(600);
    },
  ],
];

async function screenshots(browser, device) {
  const { dir, width, height } = DEVICES[device];
  const out = path.join(images, dir);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const [name, setUp] of SHOTS) {
    const tab = await open(browser, width, height);
    await setUp(tab);
    await tab.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 82 });
    if (tab.errors.length) throw new Error(`${device} ${name}: ${tab.errors.join('; ')}`);
    await tab.context().close();
    console.log(`- ${dir}/${name}.jpg`);
  }
}

// The launcher icon's layers, as SVG paths.
function vectorPaths(file) {
  const xml = fs.readFileSync(path.join(drawables, file), 'utf8');
  return [...xml.matchAll(/<path\b([\s\S]*?)\/>/g)]
    .map(([, attrs]) => {
      const a = Object.fromEntries([...attrs.matchAll(/android:(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      return `<path d="${a.pathData}" fill="${a.fillColor || 'none'}" stroke="${a.strokeColor || 'none'}" stroke-width="${a.strokeWidth || 0}" stroke-linecap="${a.strokeLineCap || 'butt'}"/>`;
    })
    .join('');
}

// Full bleed: Play rounds the corners itself. The crop is the 108dp adaptive
// icon's middle, centred on the boat.
async function icon(browser) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 16 80 80" width="512" height="512">${vectorPaths('ic_launcher_background.xml')}${vectorPaths('ic_launcher_foreground.xml')}</svg>`;
  const tab = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await tab.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await tab.screenshot({ path: path.join(images, 'icon.png') });
  await tab.close();
  console.log('- icon.png');
}

// The sea without the controls, dolphins riding the bow wave on the first
// voyage, and the logo over the darker water on the left.
async function feature(browser) {
  const tab = await open(browser, 1600, 700);
  await quiet(tab);
  await tab.evaluate(() => window.__boatify.setHud(false));
  await sailTo(tab, 0, 22);
  const boat = await tab.evaluate(() => window.__boatify.boatOnScreen());
  // 1024x500 at five eighths: drawn at 1.25x and scaled up, close in on the boat.
  const w = 640;
  const h = 312;
  const x = Math.round(Math.min(1600 - w, Math.max(0, boat.x - w * 0.7)));
  const y = Math.round(Math.min(700 - h, Math.max(0, boat.y - h * 0.55)));
  await tab.evaluate(
    ({ x, y, w, h }) => {
      const card = document.createElement('div');
      card.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:99;pointer-events:none;box-sizing:border-box;padding:0 0 0 30px;display:flex;flex-direction:column;justify-content:center;gap:8px;background:linear-gradient(90deg,rgba(6,22,34,0.82) 0%,rgba(6,22,34,0.55) 32%,rgba(6,22,34,0) 58%)`;
      card.innerHTML = `
        <div style="font-family:var(--display);font-weight:700;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--brass)">A sailing voyage</div>
        <div style="font-family:var(--display);font-style:italic;font-weight:800;font-size:64px;line-height:0.85;color:var(--foam);text-shadow:0 3px 0 rgba(0,0,0,0.3)">NO <span style="color:var(--signal)">PADDLE</span></div>
        <div style="font-family:var(--body, 'Barlow');font-size:16px;line-height:1.35;color:var(--foam);text-shadow:0 1px 2px rgba(0,0,0,0.5)">Your oar is gone.<br>Sail by the wind.</div>`;
      document.body.appendChild(card);
    },
    { x, y, w, h },
  );
  await tab.waitForTimeout(200);
  const art = await tab.screenshot({ clip: { x, y, width: w, height: h } });
  if (tab.errors.length) throw new Error(`feature: ${tab.errors.join('; ')}`);
  await tab.context().close();

  const frame = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await frame.setContent(`<style>html,body{margin:0}img{display:block;width:1024px;height:500px}</style><img src="data:image/png;base64,${art.toString('base64')}">`);
  await frame.waitForFunction(() => document.querySelector('img').complete);
  // JPEG: Play wants no alpha channel here.
  await frame.screenshot({ path: path.join(images, 'featureGraphic.jpg'), type: 'jpeg', quality: 90 });
  await frame.close();
  console.log('- featureGraphic.jpg');
}

(async () => {
  const wanted = process.argv.slice(2);
  const want = (name) => !wanted.length || wanted.includes(name);
  fs.mkdirSync(images, { recursive: true });
  const browser = await chromium.launch();
  if (want('icon')) await icon(browser);
  if (want('feature')) await feature(browser);
  for (const device of Object.keys(DEVICES)) if (want(device)) await screenshots(browser, device);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
