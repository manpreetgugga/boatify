// Boot and game loop: menus, the title-screen demo voyage, play, pause and
// results, wiring simulation events to sound, haptics, particles and toasts.

import { LEVELS } from './data/levels.js';
import { dailyVoyage, chartDaily, chartedDaily, dateKey, DAILY_VERSION } from './data/daily.js';
import { createGame, stepGame, drainEvents, speedOf } from './world/game.js';
import { BOAT_TYPES } from './physics/boat.js';
import { createAutopilot, autopilotInput } from './world/autopilot.js';
import { createRecorder, recordGhost, finishGhost, isValidGhost, ghostAt, ghostGap } from './world/ghost.js';
import { createRenderer, resize, resetView, renderFrame } from './render/renderer.js';
import { hudLayout } from './render/layout.js';
import { burst, ring, floatText } from './render/effects.js';
import { C, setColorblind } from './render/palette.js';
import { createInput } from './input/input.js';
import { createAudio } from './audio/audio.js';
import { createUI, TEXT_SIZES } from './ui/screens.js';
import { awardMedals } from './data/medals.js';
import { loadSave, writeSave, recordResult, resetProgress, loadGhost, storeGhost, markDaily, loadDailyCourse, storeDailyCourse, isDailyUnlocked, selectedBoat, unlockedBoats } from './platform/save.js';
import { installNativeHooks, vibrate, exitApp, isAndroidApp } from './platform/native.js';

const root = document.getElementById('boatify');
const canvas = document.getElementById('game');
const probe = document.getElementById('inset-probe');

const save = loadSave();
// Medals added in an update go straight to players who already earned them.
if (awardMedals(save, LEVELS).length) writeSave(save);
const renderer = createRenderer(canvas);
const audio = createAudio();

let mode = 'title'; // title | countdown | playing | paused | finishing | results
let game = null;
let levelIndex = 0; // campaign index, or 'daily'
let autopilot = null;
let botDriving = false;
let recorder = null;
let ghost = null; // best run of the current voyage, if any
let ghostView = null; // { pose, gap, type } for this frame
let demoTimer = 0;
let demoIndex = 0;
let finishTimer = 0;
let pending = null;
let cancelCountdown = null;
let timeScale = 1;
let insets = { top: 0, right: 0, bottom: 0, left: 0 };
let layout = null;
let clock = 0;
let last = performance.now();
let frames = 0;

function readInsets() {
  const cs = getComputedStyle(probe);
  insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  layout = null;
}

function getLayout() {
  if (!layout) layout = hudLayout(renderer.w, renderer.h, insets, save.settings);
  return layout;
}

// Reduced motion follows the phone until the player picks for themselves.
function motionReduced() {
  const s = save.settings.reduceMotion;
  if (s === true || s === false) return s;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function applySettings() {
  const s = save.settings;
  audio.configure({ sound: s.sound, music: s.music });
  const calm = motionReduced();
  renderer.cam.still = calm;
  renderer.fx.calm = calm;
  setColorblind(!!s.colorblind);
  const html = document.documentElement;
  html.dataset.palette = s.colorblind ? 'colorblind' : 'standard';
  html.dataset.motion = calm ? 'reduced' : 'full';
  html.style.setProperty('--text', String(TEXT_SIZES.includes(s.textSize) ? s.textSize : 1));
  const q = s.quality === 'low' ? 0.5 : 1;
  if (q !== renderer.quality) {
    renderer.quality = q;
    resize(renderer);
  }
  layout = null;
}

const input = createInput(canvas, {
  getLayout,
  getSettings: () => save.settings,
  onPause: () => pause(),
  onRestart: () => mode === 'playing' && startLevel(levelIndex),
  onMute: () => {
    save.settings.sound = !save.settings.sound;
    save.settings.music = save.settings.sound;
    applySettings();
    writeSave(save);
    ui.toast(save.settings.sound ? 'Sound on' : 'Sound off');
  },
  onToggleTrim: () => {
    save.settings.autoTrim = !save.settings.autoTrim;
    writeSave(save);
    layout = null;
    if (game) input.reset(game.boat.trim);
    ui.toast(save.settings.autoTrim ? 'Sail trims itself' : 'Manual trim: W / S to sheet in and out');
  },
});

// Today's course: charted once, then cached for the rest of the day.
function keepDaily(def) {
  const stored = loadDailyCourse();
  if (def && (!stored || stored.def !== def)) storeDailyCourse({ v: DAILY_VERSION, def });
  return def;
}

function dailyDef() {
  return keepDaily(dailyVoyage(dateKey(), loadDailyCourse()));
}

// Charts in small slices between frames so the screen keeps moving.
function chartToday(done = () => {}) {
  chartDaily(dateKey(), loadDailyCourse(), (def) => done(keepDaily(def)));
}

function dailyPeek() {
  return chartedDaily(dateKey(), loadDailyCourse());
}

const ui = createUI(root, LEVELS, {
  daily: dailyDef,
  dailyPeek,
  chartDaily: chartToday,
  onScreen: () => {},
  onClick: () => {
    audio.unlock();
    audio.sfx.click();
  },
  onPlay: (i) => startLevel(i),
  onResume: () => resume(),
  onRestart: () => startLevel(levelIndex),
  onQuit: () => {
    showTitle(false);
    ui.voyages(save);
  },
  onSettings: () => {
    applySettings();
    writeSave(save);
  },
  onReset: () => resetProgress(save),
  onSeenIntro: () => writeSave(save),
  onSeen: () => writeSave(save),
  motionReduced,
  onBoat: (id) => {
    save.settings.boat = id;
    writeSave(save);
  },
  onBackToTitle: () => showTitle(),
  onBackTo: (name) => {
    if (name === 'voyages') ui.voyages(save);
    else if (name === 'briefing') ui.briefing(ui.lastBriefing, save, 'restore');
    else showTitle();
  },
  onStar: (i) => {
    audio.sfx.checkpoint();
    if (save.settings.vibration) vibrate(20 + i * 15);
  },
  onMedal: () => {
    audio.sfx.medal();
    if (save.settings.vibration) vibrate(40);
  },
  onCount: (i, n) => audio.sfx.count(i === n - 1),
});

// --- Voyages ---------------------------------------------------------------

function startDemo() {
  // The title screen shows the autopilot sailing one of the unlocked voyages.
  const unlocked = LEVELS.filter((l, i) => i === 0 || save.levels[LEVELS[i - 1].id]);
  const def = unlocked[demoIndex % unlocked.length];
  demoIndex += 1;
  game = createGame(def, { seed: demoIndex * 7, boat: selectedBoat(save) });
  game.tipsShown = new Set(def.tips.map((t, i) => i));
  autopilot = createAutopilot(game);
  demoTimer = 70;
  resetView(renderer, game);
}

function showTitle(withMenu = true) {
  if (cancelCountdown) cancelCountdown();
  cancelCountdown = null;
  mode = 'title';
  input.setEnabled(false);
  ui.clearToasts();
  startDemo();
  if (withMenu) ui.title(save);
  // Chart today's course in the background so the daily voyage opens at once.
  if (isDailyUnlocked(save, LEVELS) && !dailyPeek()) setTimeout(() => chartToday(), 2500);
}

function startLevel(ref) {
  const def = ref === 'daily' ? dailyDef() : LEVELS[ref];
  if (!def) return;
  if (cancelCountdown) cancelCountdown();
  levelIndex = ref;
  game = createGame(def, { boat: selectedBoat(save) });
  autopilot = botDriving ? createAutopilot(game) : null;
  recorder = createRecorder(game);
  const g = loadGhost(def.id);
  ghost = isValidGhost(g, def) ? g : null;
  resetView(renderer, game);
  ui.hide();
  ui.clearToasts();
  input.setEnabled(false);
  input.reset(game.boat.trim);
  layout = null;
  mode = 'countdown';
  audio.unlock();
  cancelCountdown = ui.countdown(() => {
    cancelCountdown = null;
    mode = 'playing';
    input.setEnabled(true);
  });
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  input.setEnabled(false);
  ui.pause(game, save);
}

function resume() {
  if (mode !== 'paused') return;
  ui.hide();
  mode = 'playing';
  input.reset(game.boat.trim);
  input.setEnabled(true);
}

function finishVoyage(result) {
  mode = 'finishing';
  finishTimer = 1.8;
  input.setEnabled(false);
  const hadGhost = !!ghost;
  const daily = game.def.daily;
  if (daily) markDaily(save, daily);
  const boatsBefore = unlockedBoats(save).length;
  const improved = recordResult(save, game.def.id, result, game.notes, daily ? 'daily' : 'levels');
  improved.newBoats = unlockedBoats(save).slice(boatsBefore).map((id) => BOAT_TYPES[id].name);
  improved.medals = awardMedals(save, LEVELS, { def: game.def, result, improved });
  if (improved.medals.length) writeSave(save);
  // Keep the fastest run as the ghost (or the first one we see for a voyage).
  if (recorder && (improved.time || !hadGhost || result.time < ghost.score)) {
    storeGhost(game.def.id, { ...finishGhost(recorder, game.time), score: result.time });
  }
  pending = { improved, result };
}

// --- Simulation events -> feedback -----------------------------------------

function buzz(ms) {
  if (save.settings.vibration) vibrate(ms);
}

// A one-time tip the first time the player meets a kind of sea life.
function firstSight(kind, text) {
  if (save.sightings[kind]) return;
  save.sightings[kind] = true;
  writeSave(save);
  ui.toast(text, 'tip', 6000, true);
}

function handleEvents(events, live) {
  const fx = renderer.fx;
  const cam = renderer.cam;
  for (const e of events) {
    switch (e.type) {
      case 'tip':
        if (live) ui.toast(e.text, 'tip', 5200);
        break;
      case 'pickup': {
        const colors = { pearl: '#fbf6ee', gust: '#bff3ff', repair: C.ok, bottle: '#c9e8b8' };
        burst(fx, e.x, e.y, { count: 16, speed: 30, color: colors[e.kind] || C.foam, size: 2.2 });
        ring(fx, e.x, e.y, colors[e.kind] || C.foam, 22, 0.6);
        if (!live) break;
        audio.sfx.pickup(e.kind);
        buzz(18);
        if (e.kind === 'pearl') floatText(fx, e.x, e.y - 10, `◆ ${game.pearls}/${game.pearlsTotal}`, '#fbf6ee');
        else if (e.kind === 'gust') floatText(fx, e.x, e.y - 10, 'GUST JAR', '#bff3ff');
        else if (e.kind === 'repair') floatText(fx, e.x, e.y - 10, 'HULL +35', C.ok);
        else if (e.kind === 'bottle') {
          audio.sfx.note();
          ui.toast(`“${e.note}”`, 'note', 7000);
        }
        break;
      }
      case 'checkpoint': {
        const c = game.level.checkpoints[e.index];
        ring(fx, c.x, c.y, C.warn, 50, 1);
        if (!live) break;
        audio.sfx.checkpoint();
        buzz(25);
        ui.toast('Buoy reached. If you sink, you restart here.', 'good', 2600);
        break;
      }
      case 'collide': {
        const sand = e.material === 'sand';
        burst(fx, e.x, e.y, {
          count: Math.round(6 + e.impact * 1.5),
          speed: 18 + e.impact * 3,
          color: sand ? '#e8d6a8' : e.material === 'coral' ? '#ff8a7a' : e.material === 'ice' ? C.ice : C.foam,
          size: 2,
        });
        cam.shake = Math.min(1, cam.shake + e.impact / 14);
        if (!live) break;
        audio.sfx.collide(e.impact, e.material);
        buzz(Math.min(120, 20 + e.impact * 8));
        break;
      }
      case 'boost':
        ring(fx, game.boat.x, game.boat.y, '#bff3ff', 40, 0.7);
        if (!live) break;
        audio.sfx.boost();
        buzz(40);
        break;
      case 'tack':
      case 'gybe':
        if (e.type === 'gybe' && e.strength > 22) cam.shake = Math.min(1, cam.shake + 0.35);
        if (!live) break;
        audio.sfx.tack(e.strength);
        if (e.type === 'gybe' && e.strength > 22) buzz(35);
        break;
      case 'heelWarning':
        if (!live) break;
        audio.sfx.heelWarning();
        buzz(30);
        break;
      case 'capsize':
        burst(fx, game.boat.x, game.boat.y, { count: 30, speed: 40, size: 2.5 });
        cam.shake = 0.8;
        if (!live) break;
        audio.sfx.capsize();
        buzz(220);
        break;
      case 'righted':
        if (live) audio.sfx.righted();
        break;
      case 'sink':
        if (!live) break;
        audio.sfx.sink();
        buzz(400);
        break;
      case 'respawn':
        if (!live) break;
        audio.sfx.respawn();
        ui.toast('The hull gave out. Back to the last buoy (+15 s).', '', 3600);
        break;
      case 'kraken':
        if (!live) break;
        audio.sfx.kraken(e.phase);
        if (e.phase === 'warning') ui.toast('The water is boiling! Get out of the ring!', 'alert', 2200);
        else buzz(160);
        cam.shake = Math.min(1, cam.shake + (e.phase === 'strike' ? 0.7 : 0.1));
        break;
      case 'lightning':
        if (!live) break;
        setTimeout(() => audio.sfx.thunder(), 250 + Math.random() * 900);
        break;
      case 'dolphins':
        if (!live) break;
        if (e.phase === 'join') {
          audio.sfx.dolphins();
          buzz(20);
          floatText(fx, game.boat.x, game.boat.y - 14, 'BOW RIDERS!', '#bfefff');
          firstSight('dolphins', 'Dolphins! Keep your speed up and they ride your bow wave, pushing you along.');
        } else if (e.reason === 'slow') {
          floatText(fx, game.boat.x, game.boat.y - 14, 'Too slow for the dolphins', '#bfefff');
        }
        break;
      case 'whale': {
        if (e.phase === 'breach') {
          burst(fx, e.x, e.y, { count: 46, speed: 70, color: C.foam, size: 3 });
          ring(fx, e.x, e.y, C.foam, 70, 1.3);
          if (e.near) cam.shake = Math.min(1, cam.shake + 0.4);
        }
        if (!live) break;
        const d = Math.hypot(e.x - game.boat.x, e.y - game.boat.y);
        audio.sfx.whale(e.phase, Math.min(1, Math.max(0.15, 1 - d / 600)));
        if (e.phase === 'spout') firstSight('whale', 'A whale! When a ring of bubbles rises, it is about to breach. Give it room.');
        else if (e.phase === 'rising' && d < 160) ui.toast('Bubbles rising! The whale is coming up. Steer clear!', 'alert', 2000);
        else if (e.phase === 'breach' && d < 200) buzz(80);
        break;
      }
      case 'swell':
        cam.shake = Math.min(1, cam.shake + 0.25 * e.strength);
        if (!live) break;
        audio.sfx.swell(e.strength);
        buzz(Math.round(30 + 50 * e.strength));
        break;
      case 'finish':
        burst(fx, game.boat.x, game.boat.y, { count: 40, speed: 50, color: C.warn, size: 2.6 });
        ring(fx, game.level.finish.x, game.level.finish.y, C.signal, game.level.finish.r + 30, 1.2);
        if (!live) break;
        audio.sfx.finish(e.stars);
        buzz(60);
        finishVoyage(e);
        break;
      default:
        break;
    }
  }
}

// --- Frame loop ------------------------------------------------------------

function frame(now) {
  const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  clock += raw;
  frames += 1;
  const dt = raw;

  if (mode === 'title') {
    // Demo voyage under autopilot behind the menus.
    for (let k = 0; k < timeScale; k++) {
      const cmd = autopilotInput(autopilot, game, dt);
      stepGame(game, cmd, dt);
    }
    handleEvents(drainEvents(game), false);
    demoTimer -= dt;
    if (game.status === 'finished' && demoTimer > 3) demoTimer = 3;
    if (demoTimer <= 0) startDemo();
  } else if (mode === 'playing') {
    for (let k = 0; k < timeScale; k++) {
      const cmd = input.read(dt);
      if (autopilot) {
        const ap = autopilotInput(autopilot, game, dt);
        cmd.steer = ap.steer;
        cmd.autoTrim = true;
        if (ap.boost) cmd.boost = true;
      }
      stepGame(game, cmd, dt);
      if (recorder) recordGhost(recorder, game);
      handleEvents(drainEvents(game), true);
      if (mode !== 'playing') break;
    }
  } else if (mode === 'finishing') {
    // Let the boat coast into the harbor before the results card.
    stepGame(game, { steer: 0, trimTarget: 1, autoTrim: true, boost: false }, dt);
    drainEvents(game);
    finishTimer -= dt;
    if (finishTimer <= 0) {
      mode = 'results';
      ui.results(levelIndex, pending.result, pending.improved, save);
    }
  }

  const showHud = mode === 'playing' || mode === 'countdown' || mode === 'paused';
  if (mode === 'countdown' || mode === 'paused') input.read(0);
  ghostView = null;
  if (ghost && mode !== 'title' && save.settings.ghost) {
    const gap = game.status === 'finished' ? null : ghostGap(ghost, game.boat.x, game.boat.y, game.time);
    ghostView = { pose: ghostAt(ghost, game.time), gap, type: BOAT_TYPES[ghost.boat] || game.boat.type };
  }
  renderFrame(renderer, game, dt, clock, {
    ghost: ghostView,
    hud: showHud,
    layout: getLayout(),
    controls: input.state.controls,
  });
  audio.update(game, dt, mode === 'playing' || mode === 'finishing');
  requestAnimationFrame(frame);
}

// --- Platform --------------------------------------------------------------

function onBack() {
  if (mode === 'playing') {
    pause();
    return true;
  }
  if (mode === 'paused') {
    resume();
    return true;
  }
  if (mode === 'countdown') {
    showTitle(false);
    ui.voyages(save);
    return true;
  }
  if (mode === 'results' || mode === 'finishing') {
    showTitle(false);
    ui.voyages(save);
    return true;
  }
  return ui.back();
}

installNativeHooks({
  back: onBack,
  pause: () => {
    pause();
    audio.suspend();
  },
  resume: () => audio.resume(),
  insets: ({ top, right, bottom, left }) => {
    const s = document.documentElement.style;
    s.setProperty('--native-inset-top', `${top}px`);
    s.setProperty('--native-inset-right', `${right}px`);
    s.setProperty('--native-inset-bottom', `${bottom}px`);
    s.setProperty('--native-inset-left', `${left}px`);
    readInsets();
  },
});

window.addEventListener('resize', () => {
  resize(renderer);
  readInsets();
});

// Browsers only start audio after a user gesture.
const unlockAudio = () => {
  audio.unlock();
  applySettings();
};
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

// Escape works like the Android back button.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') onBack();
});

// Hooks for automated playtests.
window.__boatify = {
  levels: LEVELS,
  daily: dailyDef,
  startLevel,
  showTitle,
  setAutopilot(on) {
    botDriving = !!on;
    if (mode !== 'title' && game) autopilot = on ? createAutopilot(game) : null;
  },
  setTimeScale(n) {
    timeScale = Math.max(1, Math.round(n));
  },
  state() {
    return {
      mode,
      screen: ui.current,
      level: game && game.def.id,
      boat: game && game.boat.type.id,
      status: game && game.status,
      time: game && game.time,
      x: game && game.boat.x,
      y: game && game.boat.y,
      speed: game && speedOf(game),
      hull: game && game.hull,
      pearls: game && game.pearls,
      result: game && game.result,
      frames,
    };
  },
  save,
  applySettings,
  isAndroidApp,
  exitApp,
};

readInsets();
applySettings();
try {
  // Follow the phone if its reduce-motion setting changes while we are open.
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);
} catch {
  // Older WebViews: the setting is read again next launch.
}
showTitle();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
