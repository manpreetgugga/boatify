// Films real No Paddle gameplay for the launch Reels: each scene is the game
// itself, run in Chromium with the autopilot at the helm, stepped one video
// frame at a time (so the footage is smooth however slow the machine is) and
// cropped to a 9:16 strip that follows the boat. Writes out/clips/<scene>.mp4
// (1080x1920, 30 fps); make_launch_reels.py cuts them into Reels.
//
//   npm run build                                  # dist/index.html, the game
//   node marketing/reels/film_gameplay.cjs [scene ...]
//
// Needs Playwright (like the smoke test) and ffmpeg.

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const gamePage = `file://${path.join(root, 'dist', 'index.html')}`;
const outDir = path.join(__dirname, 'out', 'clips');
const FPS = 30;

// At these sizes the camera sits at its closest base scale (3.4 px a metre,
// what a big phone gets), and the view settings bring the boat in from there.
// The page is taller than the Reel's 9:16 window (506x900) so the window can
// follow the action up and down as well as sideways. LANDSCAPE is the whole
// screen at a phone's shape, controls and all.
const VIEW = { width: 1600, height: 1300 };
const LANDSCAPE = { width: 1600, height: 900 };
const WIN = { width: 506, height: 900 };

// A sailor three voyages in, with the hints on, on a view setting the game
// offers (Closer by default: 1.55).
function seedSave(zoom) {
  const levels = {};
  ['lost-oar', 'beam-reach', 'into-the-wind'].forEach((id, i) => (levels[id] = { best: 80 + i * 10, stars: 3, pearls: 6, pearlsTotal: 9, runs: 2 }));
  const save = {
    levels,
    stats: { voyages: 3, distance: 3000, capsizes: 0, pearls: 0, rescued: 0 },
    seenIntro: true,
    seenFilm: true,
    sailed: ['sloop'],
    sightings: { dolphins: true, whale: true },
    settings: { zoom },
  };
  localStorage.setItem('boatify.save.v1', JSON.stringify(save));
}

// The game draws on requestAnimationFrame and times its frames from the
// timestamp it's given. Once __rec.manual is set, frames run only when the
// recorder steps them, each a 30th of a second apart.
function manualClock() {
  const realRAF = window.requestAnimationFrame.bind(window);
  const R = (window.__rec = { manual: false, t: 0, q: [] });
  window.requestAnimationFrame = (cb) => {
    if (R.manual) {
      R.q.push(cb);
      return 0;
    }
    return realRAF((t) => {
      if (R.manual) R.q.push(cb);
      else {
        R.t = t;
        cb(t);
      }
    });
  };
  R.step = (ms) => {
    R.t += ms;
    const q = R.q;
    R.q = [];
    q.forEach((cb) => cb(R.t));
  };
}

// Messages, the film's letterbox and its captions: the Reels say it themselves.
const QUIET = '#toasts, .film-bar { visibility: hidden !important; }';

async function sailTo(tab, level, time) {
  await tab.evaluate((i) => {
    window.__boatify.setAutopilot(true);
    window.__boatify.startLevel(i);
  }, level);
  await tab.waitForFunction(() => window.__boatify.state().mode === 'playing', null, { timeout: 10000 });
  if (time > 0) {
    await tab.evaluate(() => window.__boatify.setTimeScale(8));
    await tab.waitForFunction((t) => window.__boatify.state().time >= t, time, { timeout: 180000 });
    await tab.evaluate(() => window.__boatify.setTimeScale(1));
  }
  await tab.waitForTimeout(300);
}

// Each scene: how to set it up, how long to film, and what the window keeps
// in view: `follow` is how far it leans from the camera's own centre (0)
// toward the boat (1), `monster` how far from there toward the lair lookAt
// found. The point sits `low` of the way down the window, leaving sea above
// for the Reel's words. `at` runs things in the page at a second of the clip.
// A world's monster (a volcano's vent, a harbor crane, a beast from below...)
// beside the boat, hove to, from a little before it stirs until it strikes.
// The first of the world's voyages that has one.
const MONSTER = (first) => ({
  seconds: 3.6,
  follow: 1,
  monster: 0.55,
  low: 0.6,
  zoom: 1,
  setUp: async (tab) => {
    for (let v = 0; v < 10; v++) {
      await sailTo(tab, first + v, 0);
      await tab.evaluate(() => window.__boatify.setAutopilot(false));
      if (await tab.evaluate(() => (window.__lair = window.__boatify.lookAt('lair', 12, -1.2)))) return;
    }
    throw new Error(`no monster in the world from voyage ${first}`);
  },
});

const SCENES = {
  // The prologue: the squall hits and the sea takes the oar.
  squall: {
    seconds: 9.5,
    low: 0.5,
    setUp: async (tab) => {
      await tab.evaluate(() => window.__boatify.playFilm());
      await tab.evaluate(() => window.__boatify.filmSeek(14.2));
    },
  },
  // Head to wind on the first voyage, the sail flapping, until the dolphins
  // come to show the way; then she bears away after them and flies.
  irons: {
    seconds: 11,
    follow: 0.9,
    setUp: async (tab) => {
      await sailTo(tab, 0, 0);
      await tab.waitForTimeout(2500);
      await tab.evaluate(() => {
        window.__boatify.setAutopilot(false);
        window.__boatify.inIrons();
      });
    },
    at: {
      5.2: (tab) => tab.evaluate(() => window.__boatify.setAutopilot(true)),
    },
  },
  // Into the Wind: home is dead upwind, so the autopilot zig-zags.
  tack: { seconds: 16, follow: 0.8, setUp: (tab) => sailTo(tab, 2, 6) },
  // Pirate Waters: the brig on your tail, cannonballs landing in red rings.
  pirates: { seconds: 11, follow: 0.45, setUp: (tab) => sailTo(tab, 9, 52) },
  // Storm Front: rain, squalls and a lightning strike.
  storm: { seconds: 4, follow: 0.8, setUp: (tab) => sailTo(tab, 6, 40) },
  // Kraken Fog: hove to right over the lair as the water boils.
  kraken: {
    seconds: 4,
    follow: 1,
    monster: 0.5,
    low: 0.6,
    zoom: 1,
    setUp: async (tab) => {
      await sailTo(tab, 7, 0);
      await tab.evaluate(() => {
        window.__boatify.setAutopilot(false);
        window.__lair = window.__boatify.lookAt('lair', -30, -1.2);
      });
    },
  },
  // Drift Ice: on past the floes until the penguins dive in.
  ice: {
    seconds: 4,
    follow: 0.8,
    setUp: async (tab) => {
      await sailTo(tab, 8, 40);
      await tab.evaluate(() => window.__boatify.setTimeScale(4));
      await tab.waitForFunction(() => window.__boatify.penguins().swimming >= 3, null, { timeout: 120000 });
      await tab.evaluate(() => window.__boatify.setTimeScale(1));
    },
  },
  // The monster of each of the ten worlds after Home Waters.
  volcano: MONSTER(10),
  harbor: MONSTER(20),
  alien: MONSTER(30),
  jungle: MONSTER(40),
  dino: MONSTER(50),
  sunken: MONSTER(60),
  ghost: MONSTER(70),
  aurora: MONSTER(80),
  toy: MONSTER(90),
  sky: MONSTER(100),
  // The whole screen, controls and all, for the phone on the end card.
  hud: { seconds: 4, landscape: true, setUp: (tab) => sailTo(tab, 1, 14) },
};

function encoder(file, landscape) {
  const scale = landscape ? 'scale=1280:720:flags=lanczos' : 'scale=1080:1920:flags=lanczos';
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-vf', scale, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
  return { ff, done };
}

async function film(browser, name, scene) {
  const view = scene.landscape ? LANDSCAPE : VIEW;
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.addInitScript(seedSave, scene.zoom || 1.55);
  await tab.addInitScript(manualClock);
  await tab.goto(gamePage);
  await tab.waitForFunction(() => window.__boatify && window.__boatify.state().frames > 20);
  await tab.addStyleTag({ content: QUIET });
  await scene.setUp(tab);
  if (!scene.landscape) await tab.evaluate(() => window.__boatify.setHud(false));
  await tab.evaluate(() => (window.__rec.manual = true));

  const file = path.join(outDir, `${name}.mp4`);
  const { ff, done } = encoder(file, scene.landscape);
  const frames = Math.round(scene.seconds * FPS);
  const pending = Object.entries(scene.at || {}).map(([s, fn]) => [Math.round(Number(s) * FPS), fn]);
  const low = scene.low ?? 0.55;
  let cx = null;
  let cy = null;
  for (let i = 0; i < frames; i++) {
    for (const [f, fn] of pending) if (f === i) await fn(tab);
    const seen = await tab.evaluate((ms) => {
      window.__rec.step(ms);
      const b = window.__boatify;
      if (b.state().mode === 'film') return {};
      const l = window.__lair;
      return { boat: b.boatOnScreen(), lair: l ? b.toScreen(l.x, l.y) : null };
    }, 1000 / FPS);
    let clip = { x: 0, y: 0, ...view };
    if (!scene.landscape) {
      let x = view.width / 2;
      let y = view.height / 2;
      if (seen.boat) {
        const f = scene.follow ?? 1;
        x += (seen.boat.x - x) * f;
        y += (seen.boat.y - y) * f;
      }
      if (seen.lair && scene.monster) {
        x += (seen.lair.x - x) * scene.monster;
        y += (seen.lair.y - y) * scene.monster;
      }
      // Ease after it, like a camera operator, rather than locking on.
      cx = cx == null ? x : cx + (x - cx) * 0.08;
      cy = cy == null ? y : cy + (y - cy) * 0.08;
      clip = {
        x: Math.round(Math.min(view.width - WIN.width, Math.max(0, cx - WIN.width / 2))),
        y: Math.round(Math.min(view.height - WIN.height, Math.max(0, cy - WIN.height * low))),
        ...WIN,
      };
    }
    const jpg = await tab.screenshot({ type: 'jpeg', quality: 92, clip });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await ctx.close();
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  console.log(`- clips/${name}.mp4 (${frames} frames)`);
}

(async () => {
  const wanted = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, scene] of Object.entries(SCENES)) if (!wanted.length || wanted.includes(name)) await film(browser, name, scene);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
