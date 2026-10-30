// Boot and game loop: menus, the title-screen demo voyage, play, pause and
// results, wiring simulation events to sound, haptics, particles and toasts.

import { LEVELS } from './data/levels.js';
import { CAMPAIGN, voyageDef } from './data/worlds.js';
import { dailyVoyage, chartDaily, chartedDaily, dateKey, DAILY_VERSION } from './data/daily.js';
import { festivalOn, awardFestivalSail } from './data/festivals.js';
import { createGame, stepGame, drainEvents, speedOf, PACE } from './world/game.js';
import { openSeaDef, reviveRun } from './world/opensea.js';
import { regattaDef, fleetFor, ordinal } from './world/regatta.js';
import { compassPoint } from './core/math.js';
import { BOAT_TYPES } from './physics/boat.js';
import { createAutopilot, autopilotInput } from './world/autopilot.js';
import { createRecorder, recordGhost, finishGhost, isValidGhost, ghostAt, ghostGap } from './world/ghost.js';
import { createFilm, stepFilm, drainFilmEvents } from './world/prologue.js';
import { createRenderer, resize, resetView, resetFilmView, renderFrame } from './render/renderer.js';
import { SKIPPER, snapFilmCamera } from './render/film.js';
import { VISUAL } from './render/boat.js';
import { hudLayout } from './render/layout.js';
import { burst, ring, floatText } from './render/effects.js';
import { C, setColorblind } from './render/palette.js';
import { islandAnimals, placeIslandLife } from './render/islandlife.js';
import { HIT_COLOR } from './render/themes.js';
import { createInput } from './input/input.js';
import { createAudio } from './audio/audio.js';
import { createUI, TEXT_SIZES } from './ui/screens.js';
import { awardMedals } from './data/medals.js';
import { boatLook, fittedGear } from './data/locker.js';
import { loadSave, writeSave, recordResult, recordSeaRun, recordRace, resetProgress, restoreSave, loadGhost, storeGhost, markDaily, currentStreak, loadDailyCourse, storeDailyCourse, isDailyUnlocked, selectedBoat, unlockedBoats, nextZoom, nearestZoom, zoomName } from './platform/save.js';
import { installNativeHooks, vibrate, exitApp, isAndroidApp, canRemind, setReminders, remindersAllowed, askReminders, share, canReview, askReview, copyText, canPaste, pasteText } from './platform/native.js';
import { reviewDue, markReview } from './platform/social.js';
import { REMINDER_TIMES, remindersFor, reminderTimes } from './data/reminders.js';
import { voyagePay, seaPay, racePay, payOut, doubleOf, doublePay, blackPearlWaiting, jarsAboard, useJars, spend, canAfford, SECOND_WIND, SECOND_WIND_TIME } from './data/economy.js';
import { tallyOrders } from './data/orders.js';
import { upgradeLevels } from './data/upgrades.js';
import { atlasInView, recordSighting, PAGE_REWARD } from './data/atlas.js';
import { ads, installAds, watchVideo, videosLeft, countVoyage, breakDue, takeBreak, REWARDS } from './platform/ads.js';

// Things that thud rather than crack when you hit them.
const SOFT = new Set(['sand', 'spore', 'pod', 'jelly', 'pumice', 'jungle', 'mangrove', 'fern', 'hippo', 'ghost', 'sandcastle', 'ball', 'rubber', 'cloud', 'puff', 'balloon']);

// What a lair's ring means, in each world.
const LAIR_WARNINGS = {
  kraken: 'The water is boiling! Get out of the ring!',
  vent: 'The vent is about to blow! Get out of the ring!',
  crane: 'A container is coming down! Get out of the ring!',
  beast: 'Something is rising! Get out of the ring!',
  croc: 'Crocodile! Get out of the ring!',
  plesio: 'Something huge is rising! Get out of the ring!',
  eel: 'The eel is about to lunge! Get out of the ring!',
  wraith: 'The wraith is coming! Get out of the ring!',
  orca: 'Orca! Get out of the ring!',
  jack: 'Pop goes the box! Get out of the ring!',
  storm: 'Lightning is about to strike! Get out of the ring!',
};

const root = document.getElementById('boatify');
const canvas = document.getElementById('game');
const probe = document.getElementById('inset-probe');

const save = loadSave();
// The ads, if the app has them.
installAds();
// Medals added in an update go straight to players who already earned them.
if (awardMedals(save, LEVELS).length) writeSave(save);
const renderer = createRenderer(canvas);
const audio = createAudio();

let mode = 'title'; // title | film | countdown | playing | paused | finishing | offer | results
let game = null;
let levelIndex = 0; // campaign index, 'daily', 'sea' or 'regatta'
let autopilot = null;
let botDriving = false;
let recorder = null;
let ghost = null; // best run of the current voyage, if any
let ghostView = null; // { pose, gap, type } for this frame
let film = null; // the prologue, while it plays
let filmScreen = null; // its captions and title card
let demoTimer = 0;
let demoIndex = 0;
let finishTimer = 0;
let pending = null;
let carried = 0; // gust jars brought from the hold this voyage
let windTaken = false; // a second wind already used this Open Sea run
let onBreak = false; // the ad between voyages is playing
let guideTold = {}; // which dolphin hints this voyage has explained
let atlasTimer = 0; // till the next look round for Sea Atlas entries
let cancelCountdown = null;
let timeScale = 1;
let hudOff = false; // the store art's clean frames
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
  if (!layout) {
    layout = hudLayout(renderer.w, renderer.h, insets, save.settings);
    // Tips sit in the band between the zoom button and the minimap.
    const s = document.documentElement.style;
    s.setProperty('--band-left', `${layout.zoom.x + layout.zoom.w + 10}px`);
    s.setProperty('--band-right', `${layout.w - layout.minimap.x + 10}px`);
  }
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
  if (game && mode !== 'title' && mode !== 'film') game.guide.on = guideOn();
  layout = null;
}

// The phone's reminders follow the setting and the voyage to sail next.
function syncReminders() {
  if (!canRemind) return;
  setReminders({ on: save.settings.reminders !== false, times: REMINDER_TIMES, messages: remindersFor(save, CAMPAIGN) });
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
  onZoom: (dir) => {
    const z = nextZoom(save.settings.zoom, dir);
    if (z === save.settings.zoom) return;
    save.settings.zoom = z;
    writeSave(save);
    ui.toast(`View: ${zoomName(z)}`);
  },
  onPinchEnd: (zoom) => {
    const z = nearestZoom(zoom);
    if (z === save.settings.zoom) return;
    save.settings.zoom = z;
    writeSave(save);
    ui.toast(`View: ${zoomName(z)}`);
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

const ui = createUI(root, CAMPAIGN, {
  daily: dailyDef,
  dailyPeek,
  chartDaily: chartToday,
  onScreen: () => {},
  onClick: () => {
    audio.unlock();
    audio.sfx.click();
  },
  onPlay: (i) => moveOn(() => startLevel(i)),
  onResume: () => resume(),
  onRestart: () => startLevel(levelIndex),
  onQuit: () =>
    moveOn(() => {
      showTitle(false);
      ui.voyages(save);
    }),
  onSettings: (s, key) => {
    applySettings();
    writeSave(save);
    if (key === 'reminders') {
      if (save.settings.reminders && !remindersAllowed()) askReminders(true);
      syncReminders();
    }
  },
  canRemind,
  remindersAllowed,
  // A video on the results pays the voyage's own coins again, once.
  doubleOf: (pay) => (ads().adsReady() && videosLeft(save, REWARDS.doubleCoins, dateKey()) > 0 ? doubleOf(pay) : 0),
  onDouble: async (pay) => {
    const r = await watchVideo(save, REWARDS.doubleCoins, dateKey());
    if (!r.ok || !doublePay(save, pay)) return false;
    writeSave(save);
    audio.sfx.coins();
    return true;
  },
  onShare: (text) => share(text),
  onReset: () => resetProgress(save),
  // Backup codes: copied out, pasted in, and a restored save starts the game afresh.
  onCopy: (text) => copyText(text),
  canPaste,
  onPaste: () => pasteText(),
  onRestore: (restored) => {
    restoreSave(save, restored);
    window.location.reload();
  },
  onSeenIntro: () => writeSave(save),
  onSeen: () => writeSave(save),
  motionReduced,
  onBoat: (id) => {
    save.settings.boat = id;
    writeSave(save);
  },
  onGear: (kind, id) => {
    save.settings[kind] = id;
    writeSave(save);
  },
  onWallet: () => {
    writeSave(save);
    audio.sfx.coins();
  },
  onBackToTitle: () => showTitle(),
  onFilm: () => playFilm(),
  onFilmDone: (helm) => finishFilm(helm),
  onBackTo: (name) => {
    if (name === 'voyages') ui.voyages(save);
    else if (name === 'shipyard') ui.shipyard(save, true);
    else if (name === 'shop') ui.shop(save, true);
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
  const unlocked = CAMPAIGN.filter((l, i) => i === 0 || save.levels[CAMPAIGN[i - 1].id]);
  const plain = voyageDef(unlocked[demoIndex % unlocked.length].id);
  // In a festival week the title's sea is dressed for it too.
  const fest = festivalOn(dateKey());
  const def = fest ? { ...plain, festival: fest.id, weather: { ...plain.weather, ...fest.weather } } : plain;
  demoIndex += 1;
  game = createGame(def, { seed: demoIndex * 7, boat: selectedBoat(save), upgrades: upgradeLevels(save, selectedBoat(save)) });
  game.tipsShown = new Set(def.tips.map((t, i) => i));
  autopilot = createAutopilot(game);
  demoTimer = 70;
  resetView(renderer, game);
}

function showTitle(withMenu = true) {
  if (cancelCountdown) cancelCountdown();
  cancelCountdown = null;
  settleJars();
  film = null;
  mode = 'title';
  input.setEnabled(false);
  ui.clearToasts();
  startDemo();
  if (withMenu) ui.title(save);
  syncReminders();
  // Chart today's course in the background so the daily voyage opens at once.
  if (isDailyUnlocked(save, CAMPAIGN) && !dailyPeek()) setTimeout(() => chartToday(), 2500);
}

function startLevel(ref) {
  // Every Open Sea run is a fresh stretch of sea, and every regatta a fresh
  // course, raced against the fleet your wins have earned.
  const seed = (Date.now() % 1e9) + 1;
  const def = ref === 'sea' ? openSeaDef(seed) : ref === 'regatta' ? regattaDef(seed, fleetFor(save.regatta.wins)) : ref === 'daily' ? dailyDef() : CAMPAIGN[ref] && voyageDef(CAMPAIGN[ref].id);
  if (!def) return;
  if (cancelCountdown) cancelCountdown();
  settleJars();
  film = null;
  levelIndex = ref;
  // Jars from the hold go aboard (not in a regatta: the fleet has none), and
  // the voyage's black pearl is out if it hasn't been brought home yet.
  carried = def.race ? 0 : jarsAboard(save);
  windTaken = false;
  pending = null;
  const blackPearl = !def.race && (def.endless || blackPearlWaiting(save, def.id));
  game = createGame(def, { boat: selectedBoat(save), upgrades: upgradeLevels(save, selectedBoat(save)), guide: guideOn(), startJars: carried, blackPearl });
  autopilot = botDriving ? createAutopilot(game) : null;
  guideTold = {};
  // No ghost on the open sea or in a regatta: no two runs share a course.
  const fresh = def.endless || def.race;
  recorder = fresh ? null : createRecorder(game);
  const g = fresh ? null : loadGhost(def.id);
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
  if (carried) setTimeout(() => mode === 'playing' || mode === 'countdown' ? ui.toast(`${carried} gust ${carried === 1 ? 'jar' : 'jars'} from the hold aboard. Tap the wind button for a burst.`, 'good', 3200) : null, 2700);
}

// The hold's jars that went aboard and were used are gone; the rest stay.
function settleJars(left = game ? game.gustJars : 0) {
  if (!carried) return;
  useJars(save, carried, left);
  carried = 0;
  writeSave(save);
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
  // An Open Sea run can go on for a few black pearls (or a video), once.
  if (game.sea && !windTaken && !botDriving && windOnOffer()) {
    pending = { offer: true, result };
    return;
  }
  pending = settleVoyage(result);
}

function windOnOffer() {
  return canAfford(save, { blackPearls: SECOND_WIND }) || (ads().adsReady() && videosLeft(save, REWARDS.secondWind, dateKey()) > 0);
}

// Record the voyage, award medals and pay out. Returns what the results show.
function settleVoyage(result) {
  settleJars(result.jarsLeft || 0);
  // Orders open with the daily voyage; the voyage that opens them doesn't count.
  const ordersOpen = isDailyUnlocked(save, LEVELS);
  let improved;
  if (game.sea) {
    improved = recordSeaRun(save, result);
    improved.medals = awardMedals(save, LEVELS, { def: game.def, result, improved });
    improved.pay = payOut(save, seaPay(result, improved), { blackPearls: result.blackPearls });
  } else if (game.race) {
    improved = recordRace(save, result);
    improved.medals = awardMedals(save, LEVELS, { def: game.def, result, improved });
    improved.pay = payOut(save, racePay(result, improved));
  } else {
    const hadGhost = !!ghost;
    const daily = game.def.daily;
    if (daily) markDaily(save, daily);
    const boatsBefore = unlockedBoats(save).length;
    improved = recordResult(save, game.def.id, result, game.notes, daily ? 'daily' : 'levels');
    improved.newBoats = unlockedBoats(save).slice(boatsBefore).map((id) => BOAT_TYPES[id].name);
    improved.medals = awardMedals(save, LEVELS, { def: game.def, result, improved });
    improved.festivalSail = awardFestivalSail(save, game.def, dateKey());
    const streak = daily ? currentStreak(save, daily) : 0;
    improved.pay = payOut(save, voyagePay(game.def, result, improved, streak), { blackPearls: result.blackPearls, voyage: game.def.id });
    // Keep the fastest run as the ghost (or the first one we see for a voyage).
    if (recorder && (improved.time || !hadGhost || result.time < ghost.score)) {
      storeGhost(game.def.id, { ...finishGhost(recorder, game.time), score: result.time });
    }
  }
  if (ordersOpen) payOrders(improved, result);
  countVoyage(save, voyagesHome());
  writeSave(save);
  return { improved, result };
}

// Today's orders done on this voyage go on its bill, the chest's black pearl too.
function payOrders(improved, result) {
  const kind = game.sea ? 'sea' : game.race ? 'race' : game.def.daily ? 'daily' : 'voyage';
  const r = tallyOrders(save, dateKey(), kind, result, improved);
  improved.orders = r;
  if (!r.coins && !r.blackPearls) return;
  const extra = payOut(save, r.coins ? [{ label: 'Orders', coins: r.coins }] : []);
  save.wallet.blackPearls += r.blackPearls;
  const pay = improved.pay;
  improved.pay = { coins: pay.coins + extra.coins, blackPearls: pay.blackPearls + r.blackPearls, lines: [...pay.lines, ...extra.lines] };
}

function showResults() {
  mode = 'results';
  if (game.sea) ui.seaResults(pending.result, pending.improved, save);
  else if (game.race) ui.raceResults(pending.result, pending.improved, save);
  else ui.results(levelIndex, pending.result, pending.improved, save);
  if (pending.improved.pay.coins || pending.improved.pay.blackPearls) setTimeout(() => mode === 'results' && audio.sfx.coins(), 900);
  // After the first voyage home, ask once whether the phone may send reminders.
  if (canRemind && !save.remindersAsked && voyagesHome() > 0) {
    save.remindersAsked = true;
    writeSave(save);
    if (save.settings.reminders && !remindersAllowed()) setTimeout(() => askReminders(), 1500);
  } else if (canReview && !game.sea && !game.race && reviewDue(save, { stars: pending.result.stars, finished: voyagesHome() })) {
    // A three-star finish is a good moment to ask for a rating: once the stars have landed.
    markReview(save);
    writeSave(save);
    setTimeout(() => mode === 'results' && askReview(), 2400);
  }
}

function voyagesHome() {
  return Object.values(save.levels).filter((l) => l && l.best !== null).length;
}

// Moving on from the results. When an ad between voyages is due it plays
// first; taps while it plays are ignored. Retrying never waits for one.
function moveOn(go) {
  if (mode !== 'results') return go();
  if (onBreak) return;
  if (!breakDue(save, voyagesHome()) || !ads().breakReady()) return go();
  onBreak = true;
  takeBreak(save).then((r) => {
    onBreak = false;
    if (r.ok) writeSave(save);
    if (mode === 'results') go();
  });
}

// The run ended: sail on for black pearls or a video, or call it a day.
function offerSecondWind() {
  mode = 'offer';
  const { result } = pending;
  const takeWind = () => {
    if (mode !== 'offer') return;
    windTaken = true;
    pending = null;
    reviveRun(game, SECOND_WIND_TIME);
    ui.hide();
    input.reset(game.boat.trim);
    mode = 'countdown';
    cancelCountdown = ui.countdown(() => {
      cancelCountdown = null;
      mode = 'playing';
      input.setEnabled(true);
    });
  };
  ui.secondWind(result, save, {
    onTake: () => {
      if (!spend(save, { blackPearls: SECOND_WIND })) return;
      writeSave(save);
      audio.sfx.coins();
      takeWind();
    },
    onVideo: async () => {
      const r = await watchVideo(save, REWARDS.secondWind, dateKey());
      if (!r.ok) return false;
      writeSave(save);
      takeWind();
      return true;
    },
    onEnd: () => endOffer(),
  });
}

function endOffer() {
  if (mode !== 'offer') return;
  pending = settleVoyage(pending.result);
  showResults();
}

// --- The prologue ----------------------------------------------------------

function playFilm() {
  if (cancelCountdown) cancelCountdown();
  cancelCountdown = null;
  film = createFilm();
  game = film.game;
  autopilot = null;
  recorder = null;
  ghost = null;
  resetFilmView(renderer, film);
  ui.clearToasts();
  input.setEnabled(false);
  mode = 'film';
  audio.unlock();
  filmScreen = ui.film();
  filmScreen.caption(film.shot.caption);
}

// Skipped, sat through, or the helm taken from the title card. Either way it
// has been seen and won't play by itself again.
function finishFilm(helm) {
  if (mode !== 'film') return;
  if (!save.seenFilm) {
    save.seenFilm = true;
    writeSave(save);
  }
  filmScreen = null;
  showTitle(!helm);
  if (helm) ui.begin(save);
}

function filmEvents(events) {
  const fx = renderer.fx;
  for (const e of events) {
    if (mode !== 'film') return;
    switch (e.type) {
      case 'shot':
        filmScreen.caption(e.caption);
        if (e.id === 'title') filmScreen.card();
        break;
      case 'thunder':
        buzz(25);
        setTimeout(() => audio.sfx.thunder(), 250);
        break;
      case 'stroke':
        audio.sfx.oar('stroke');
        break;
      case 'oar':
        audio.sfx.oar('lost');
        buzz(30);
        break;
      case 'guide':
        audio.sfx.dolphins();
        floatText(fx, e.x, e.y - 12, 'This way!', '#bfefff');
        break;
      case 'dolphins':
        audio.sfx.dolphins();
        floatText(fx, film.game.boat.x, film.game.boat.y - 14, 'BOW RIDERS!', '#bfefff');
        break;
      case 'splash':
        burst(fx, e.x, e.y, { count: 18, speed: 28, color: C.foam, size: 2.2 });
        ring(fx, e.x, e.y, C.foam, 16, 0.8);
        audio.sfx.oar('splash');
        break;
      case 'end':
        finishFilm(false);
        break;
    }
  }
}

// --- Simulation events -> feedback -----------------------------------------

function buzz(ms) {
  if (save.settings.vibration) vibrate(ms);
}

// Dolphins show a stuck or lost sailor the way, unless hints are off or the
// autopilot has the helm.
function guideOn() {
  return save.settings.hints !== false && !botDriving;
}

// A one-time tip the first time the player meets a kind of sea life.
function firstSight(kind, text) {
  if (save.sightings[kind]) return;
  save.sightings[kind] = true;
  writeSave(save);
  ui.toast(text, 'tip', 6000, true);
}

// Fill in the Sea Atlas with whatever the boat is near that it hasn't met.
function lookRound() {
  const ids = atlasInView(game, save);
  if (!ids.length) return;
  const met = [];
  const filled = [];
  for (const id of ids) {
    const r = recordSighting(save, id);
    if (!r) continue;
    met.push(r.entry.name);
    if (r.page) filled.push(r.page.name);
  }
  if (!met.length) return;
  writeSave(save);
  // A filled page says it all; otherwise name what's new.
  if (filled.length) {
    audio.sfx.pickup('blackPearl');
    for (const name of filled) ui.toast(`Page filled: ${name}! +${PAGE_REWARD.coins} coins, +${PAGE_REWARD.blackPearls} black pearl`, 'atlas good', 5200);
  } else {
    ui.toast(`New in the Sea Atlas: ${met.join(', ')}`, 'atlas', 3400);
  }
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
        const colors = { pearl: '#fbf6ee', gust: '#bff3ff', repair: C.ok, bottle: '#c9e8b8', blackPearl: '#cdb8ff' };
        burst(fx, e.x, e.y, { count: 16, speed: 30, color: colors[e.kind] || C.foam, size: 2.2 });
        ring(fx, e.x, e.y, colors[e.kind] || C.foam, 22, 0.6);
        if (!live) break;
        audio.sfx.pickup(e.kind);
        buzz(18);
        if (e.kind === 'pearl') floatText(fx, e.x, e.y - 10, game.sea ? `PEARL +${e.bonus} s` : `PEARL ${game.pearls}/${game.pearlsTotal}`, '#fbf6ee');
        else if (e.kind === 'gust') floatText(fx, e.x, e.y - 10, 'GUST JAR', '#bff3ff');
        else if (e.kind === 'repair') floatText(fx, e.x, e.y - 10, 'HULL +35', C.ok);
        else if (e.kind === 'blackPearl') {
          floatText(fx, e.x, e.y - 12, 'BLACK PEARL!', '#cdb8ff');
          ring(fx, e.x, e.y, '#ffffff', 40, 1);
          buzz(60);
          firstSight('blackPearl', 'A black pearl! They are rare. Bring it home: finish the voyage to keep it.');
        }
        else if (e.kind === 'bottle') {
          audio.sfx.note();
          ui.toast(`“${e.note}”`, 'note', 7000);
        }
        break;
      }
      case 'castaway': {
        if (e.phase === 'aboard') {
          burst(fx, e.x, e.y, { count: 22, speed: 34, color: C.foam, size: 2.4 });
          ring(fx, e.x, e.y, C.ok, 30, 0.7);
        }
        if (!live) break;
        if (e.phase === 'sighted') {
          audio.sfx.castaway('sighted');
          firstSight('castaway', 'A castaway! Turn into the wind to slow right down, then drift alongside to haul them aboard.');
        } else if (e.phase === 'fast') {
          ui.toast(`Too fast for ${e.name} to grab the line. Turn into the wind to stop.`, 'tip', 3600);
        } else {
          audio.sfx.castaway('aboard');
          buzz(30);
          floatText(fx, e.x, e.y - 14, `${e.name.toUpperCase()} ABOARD`, C.ok);
          ui.toast(`${e.name}: “${e.line}” Now get them home.`, 'note rescue', 6500);
        }
        break;
      }
      case 'checkpoint': {
        const c = game.level.checkpoints[e.index];
        ring(fx, c.x, c.y, game.sea ? C.ok : C.warn, 50, 1);
        if (!live) break;
        audio.sfx.checkpoint();
        buzz(25);
        if (game.sea) floatText(fx, c.x, c.y - 18, `+${e.bonus} s`, C.ok);
        else if (game.race) {
          floatText(fx, c.x, c.y - 18, `MARK ${c.label} ✓`, C.ok);
          const next = game.level.checkpoints[e.index + 1];
          ui.toast(next ? `Mark ${c.label} rounded. On to mark ${next.label}!` : 'Last mark rounded. Race for the harbor!', 'good', 2600);
        } else ui.toast('Buoy reached. If you sink, you restart here.', 'good', 2600);
        break;
      }
      case 'early':
        if (live) ui.toast(`Round mark ${e.mark + 1} first! The marks count only in order.`, 'alert', 3000);
        break;
      case 'place':
        if (!live) break;
        floatText(fx, game.boat.x, game.boat.y - 16, e.gained ? `▲ ${ordinal(e.place)}` : `▼ ${ordinal(e.place)}`, e.gained ? C.ok : C.danger);
        if (e.gained) buzz(15);
        break;
      case 'rival':
        if (live && e.phase === 'finish') ui.toast(`${e.name} finishes ${ordinal(e.place)}.`, '', 2200);
        break;
      case 'bump':
        burst(fx, e.x, e.y, { count: Math.round(5 + e.impact * 1.5), speed: 14 + e.impact * 3, color: C.foam, size: 2 });
        cam.shake = Math.min(1, cam.shake + e.impact / 20);
        if (!live) break;
        audio.sfx.collide(e.impact * 0.7, 'sand');
        buzz(Math.min(80, 15 + e.impact * 6));
        firstSight('bump', 'Bump! Boats that touch lose their way. Give the fleet room.');
        break;
      case 'gate':
        if (!live) break;
        floatText(fx, game.boat.x, game.boat.y - 14, 'GATE MISSED', C.danger);
        buzz(30);
        break;
      case 'windshift':
        if (live) ui.toast(`Wind shift! It blows from the ${compassPoint(e.from)} now.`, '', 2600);
        break;
      case 'clock':
        if (!live) break;
        audio.sfx.count(false);
        if (e.left <= 3) buzz(15);
        break;
      case 'collide': {
        const sand = e.material === 'sand';
        burst(fx, e.x, e.y, {
          count: Math.round(6 + e.impact * 1.5),
          speed: 18 + e.impact * 3,
          color: sand ? '#e8d6a8' : e.material === 'coral' ? '#ff8a7a' : e.material === 'ice' ? C.ice : HIT_COLOR[e.material] || C.foam,
          size: 2,
        });
        cam.shake = Math.min(1, cam.shake + e.impact / 14);
        if (!live) break;
        audio.sfx.collide(e.impact, SOFT.has(e.material) ? 'sand' : e.material);
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
        ui.toast(game.race ? 'The hull gave out. Back to the last mark.' : 'The hull gave out. Back to the last buoy.', '', 3600);
        break;
      case 'kraken':
        if (!live) break;
        audio.sfx.kraken(e.phase);
        if (e.phase === 'warning') ui.toast(LAIR_WARNINGS[e.look] || LAIR_WARNINGS.kraken, 'alert', 2200);
        else buzz(160);
        cam.shake = Math.min(1, cam.shake + (e.phase === 'strike' ? 0.7 : 0.1));
        break;
      case 'lightning':
        if (!live) break;
        setTimeout(() => audio.sfx.thunder(), 250 + Math.random() * 900);
        break;
      case 'guide':
        if (!live) break;
        audio.sfx.dolphins();
        floatText(fx, e.x, e.y - 12, 'This way!', '#bfefff');
        // Said once a voyage; after that the dolphins speak for themselves.
        if (!guideTold[e.reason]) {
          guideTold[e.reason] = true;
          ui.toast(e.reason === 'irons' ? 'Stuck head to wind! Follow the dolphins: turn across the wind.' : "B isn't that way! Follow the dolphins.", '', 4200);
        }
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
      case 'pirate':
        if (e.phase === 'spotted') floatText(fx, e.x, e.y - 26, '!', C.danger);
        if (!live) break;
        audio.sfx.pirates(e.phase);
        if (e.phase === 'spotted') {
          buzz(60);
          ui.toast(
            save.sightings.pirates
              ? 'The pirates are after you again!'
              : "Pirates! Their brig is fast downwind but can't sail close to the wind. Keep the wind on your beam, or slip through the reef!",
            'alert',
            save.sightings.pirates ? 2600 : 6500,
            true,
          );
          save.sightings.pirates = true;
          writeSave(save);
        } else if (e.reason === 'reef') {
          ui.toast("The brig can't follow you through the reef!", 'good', 3000, true);
        } else if (e.reason === 'outran' || e.reason === 'harbor') {
          ui.toast(e.reason === 'outran' ? 'You outran the pirates!' : 'The pirates turn back from the harbor guns!', 'good', 3000, true);
        }
        break;
      case 'cannon': {
        const d = Math.hypot(e.x - game.boat.x, e.y - game.boat.y);
        if (e.phase === 'fire') {
          const w = game.windHere;
          burst(fx, e.x, e.y, { count: 10, speed: 10, color: 'rgba(200, 204, 210, 0.75)', size: 5, life: 1.6, vx: w.wx * 0.5, vy: w.wy * 0.5 });
        } else if (e.phase === 'hit') {
          burst(fx, e.x, e.y, { count: 22, speed: 45, color: '#a87a52', size: 2.2 });
          burst(fx, e.x, e.y, { count: 14, speed: 30, color: C.foam, size: 2.4 });
          cam.shake = Math.min(1, cam.shake + 0.6);
        } else {
          burst(fx, e.x, e.y, { count: 16, speed: 32, color: C.foam, size: 2.4 });
          ring(fx, e.x, e.y, C.foam, 22, 0.9);
          if (e.near) cam.shake = Math.min(1, cam.shake + 0.12);
        }
        if (!live) break;
        audio.sfx.cannon(e.phase, Math.min(1, Math.max(0.2, 1 - d / 500)));
        if (e.phase === 'hit') {
          buzz(140);
          floatText(fx, game.boat.x, game.boat.y - 14, 'HIT!', C.danger);
        } else if (e.phase === 'splash' && e.near) {
          buzz(25);
        }
        break;
      }
      case 'revive':
        ring(fx, e.x, e.y, '#bff3ff', 60, 1);
        burst(fx, e.x, e.y, { count: 24, speed: 40, color: '#bff3ff', size: 2.4 });
        if (!live) break;
        audio.sfx.boost();
        buzz(50);
        ui.toast(`Second wind! ${SECOND_WIND_TIME} more seconds. Sail on!`, 'good', 2600);
        break;
      case 'finish':
        if (game.sea) {
          // The run is over: out of time, or sunk.
          if (live && e.reason === 'time') audio.sfx.count(true);
        } else {
          burst(fx, game.boat.x, game.boat.y, { count: 40, speed: 50, color: C.warn, size: 2.6 });
          ring(fx, game.level.finish.x, game.level.finish.y, C.signal, game.level.finish.r + 30, 1.2);
          if (live) audio.sfx.finish(e.stars);
        }
        if (!live) break;
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
  // The sea runs ahead of the wall clock; the prologue film keeps real time.
  const sea = dt * PACE;

  if (mode === 'title') {
    // Demo voyage under autopilot behind the menus.
    for (let k = 0; k < timeScale; k++) {
      const cmd = autopilotInput(autopilot, game, sea);
      stepGame(game, cmd, sea);
    }
    handleEvents(drainEvents(game), false);
    demoTimer -= dt;
    if (game.status === 'finished' && demoTimer > 3) demoTimer = 3;
    if (demoTimer <= 0) startDemo();
  } else if (mode === 'film') {
    for (let k = 0; k < timeScale && mode === 'film'; k++) {
      stepFilm(film, dt, VISUAL);
      filmEvents(drainFilmEvents(film));
    }
  } else if (mode === 'playing') {
    for (let k = 0; k < timeScale; k++) {
      const cmd = input.read(dt);
      if (autopilot) {
        const ap = autopilotInput(autopilot, game, sea);
        cmd.steer = ap.steer;
        cmd.autoTrim = true;
        if (ap.boost) cmd.boost = true;
      }
      stepGame(game, cmd, sea);
      if (recorder) recordGhost(recorder, game);
      handleEvents(drainEvents(game), true);
      if (mode !== 'playing') break;
    }
    atlasTimer -= dt;
    if (mode === 'playing' && atlasTimer <= 0) {
      atlasTimer = 0.5;
      lookRound();
    }
  } else if (mode === 'finishing') {
    // Let the boat coast into the harbor before the results card.
    stepGame(game, { steer: 0, trimTarget: 1, autoTrim: true, boost: false }, sea);
    drainEvents(game);
    finishTimer -= dt;
    if (finishTimer <= 0) {
      if (pending.offer) offerSecondWind();
      else showResults();
    }
  } else if (mode === 'offer') {
    stepGame(game, { steer: 0, trimTarget: 1, autoTrim: true, boost: false }, sea);
    drainEvents(game);
  }

  const showHud = !hudOff && (mode === 'playing' || mode === 'countdown' || mode === 'paused');
  if (mode === 'countdown' || mode === 'paused') input.read(0);
  ghostView = null;
  if (ghost && mode !== 'title' && save.settings.ghost) {
    const gap = game.status === 'finished' ? null : ghostGap(ghost, game.boat.x, game.boat.y, game.time);
    ghostView = { pose: ghostAt(ghost, game.time), gap, type: BOAT_TYPES[ghost.boat] || game.boat.type };
  }
  renderFrame(renderer, game, dt, clock, {
    look: boatLook(game.boat.type, fittedGear(save)),
    ghost: ghostView,
    hud: showHud,
    film,
    crew: film && SKIPPER,
    layout: getLayout(),
    controls: input.state.controls,
    zoom: input.state.pinchZoom ?? save.settings.zoom,
    pinching: input.state.pinchZoom !== null,
  });
  if (mode === 'playing' && renderer.life.colonies && renderer.life.colonies.near) {
    firstSight('penguins', 'Penguins! Sail close and they dive in for a swim.');
  }
  const isles = renderer.life.isles;
  if (mode === 'playing' && isles && isles.near === 'turtle') {
    firstSight('turtles', 'Sea turtles on the beach! Sail close and they slip into the sea.');
  } else if (mode === 'playing' && isles && isles.near === 'seal') {
    firstSight('seals', 'Seals on the rocks! Sail close and they flop in for a swim.');
  }
  audio.update(game, dt, mode === 'playing' || mode === 'finishing' || mode === 'film');
  requestAnimationFrame(frame);
}

// --- Platform --------------------------------------------------------------

function onBack() {
  if (mode === 'film') {
    finishFilm(false);
    return true;
  }
  if (mode === 'playing') {
    pause();
    return true;
  }
  if (ui.closeConfirm()) return true;
  if (mode === 'paused') {
    resume();
    return true;
  }
  if (mode === 'offer') {
    endOffer();
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
    // Leaving the game: the reminders name the voyage to sail next.
    syncReminders();
  },
  resume: () => {
    audio.resume();
    // Back from the phone's settings, perhaps with notifications turned on or off.
    if (canRemind) ui.setToggle('reminders', !!save.settings.reminders && remindersAllowed());
  },
  // The phone's answer to askReminders.
  reminders: (allowed) => {
    save.settings.reminders = allowed;
    writeSave(save);
    syncReminders();
    ui.setToggle('reminders', allowed);
    ui.toast(allowed ? `Reminders on, at ${reminderTimes()}.` : 'No reminders, then. Settings can turn them on.');
  },
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
  campaign: CAMPAIGN,
  voyageDef,
  daily: dailyDef,
  startLevel,
  showTitle,
  playFilm,
  skipFilm: () => finishFilm(false),
  // Run the prologue on to a moment, as fast as it will go, and frame it.
  filmSeek(t) {
    while (film && mode === 'film' && film.t < t) {
      stepFilm(film, 1 / 60, VISUAL);
      filmEvents(drainFilmEvents(film));
    }
    if (film) snapFilmCamera(renderer.cam, film, renderer.w, renderer.h);
  },
  setAutopilot(on) {
    botDriving = !!on;
    if (mode !== 'title' && game) {
      autopilot = on ? createAutopilot(game) : null;
      game.guide.on = guideOn();
    }
  },
  setTimeScale(n) {
    timeScale = Math.max(1, Math.round(n));
  },
  // The store's feature graphic shows the sea without the controls.
  setHud(on) {
    hudOff = !on;
  },
  // Where the controls sit, in CSS pixels.
  layout: () => getLayout(),
  // Where the boat is drawn, in CSS pixels, to frame it.
  boatOnScreen() {
    const c = renderer.cam;
    if (!game) return null;
    return { x: c.w / 2 + c.ox + (game.boat.x - c.x) * c.scale, y: c.h / 2 + c.oy + (game.boat.y - c.y) * c.scale, scale: c.scale };
  },
  // Where a point of the sea is drawn, in CSS pixels.
  toScreen(x, y) {
    const c = renderer.cam;
    return { x: c.w / 2 + c.ox + (x - c.x) * c.scale, y: c.h / 2 + c.oy + (y - c.y) * c.scale, scale: c.scale };
  },
  // Fill the purse for a test.
  give({ coins = 0, blackPearls = 0 } = {}) {
    save.wallet.coins += coins;
    save.wallet.blackPearls += blackPearls;
    writeSave(save);
  },
  // Wind the Open Sea clock down to see a run end.
  setSeaClock(s) {
    if (game && game.sea) game.sea.clock = s;
  },
  // Put her bow to the wind, dead in the water, with the dolphins ready.
  inIrons() {
    if (!game) return;
    Object.assign(game.boat, { vx: 0, vy: 0, heading: game.wind.angle + Math.PI, yawRate: 0 });
    game.guide.cooldown = 0;
  },
  guidePod() {
    const pod = game && game.life.pods.find((p) => p.state === 'guide');
    return pod && { x: pod.x, y: pod.y, way: pod.way };
  },
  // Heave to just upwind of the first castaway still adrift, bow to the
  // wind, and let the drift carry the boat alongside. Returns their name.
  heaveTo() {
    const c = game && game.castaways.find((k) => k.state !== 'aboard');
    if (!c) return null;
    const into = game.wind.angle + Math.PI;
    Object.assign(game.boat, { x: c.x + Math.cos(into) * 10, y: c.y + Math.sin(into) * 10, vx: 0, vy: 0, heading: into, yawRate: 0 });
    return c.name;
  },
  // Heave to off the shore where an island's turtles (sand) or seals (rock)
  // are basking, or sail past along it at `speed`. Returns where they are.
  offIsland(kind = 'sand', off = 60, speed = 0) {
    const which = kind === 'rock' ? 'seals' : 'turtles';
    const isl = game && game.level.islands.find((i) => i.kind === kind && placeIslandLife(i)[which].length);
    if (!isl) return null;
    const { x, y, edge: e } = placeIslandLife(isl)[which][0];
    const heading = speed ? Math.atan2(e.ty, e.tx) : game.wind.angle + Math.PI;
    const vx = Math.cos(heading) * speed;
    const vy = Math.sin(heading) * speed;
    Object.assign(game.boat, { x: e.x + e.nx * off - vx * 2, y: e.y + e.ny * off - vy * 2, vx, vy, heading, yawRate: 0 });
    return { x, y };
  },
  // Heave to beside the first drifter ('floe'), lair ('lair'), rock
  // ('rock'), island of a kind or rock of a material, `off` past its edge.
  // Returns where it is. For a lair, `warned` winds the clock to that many
  // seconds into its warning.
  lookAt(what, off = 40, warned = null) {
    if (!game) return null;
    const l = game.level;
    const f = l.floes[0];
    const isl = l.islands.find((i) => i.kind === what);
    const spot =
      what === 'floe' ? f && { x: f.cx + f.ox, y: f.cy + f.oy, r: f.radius } : what === 'lair' ? l.krakens[0] : what === 'rock' ? l.rocks[0] : (isl && { x: isl.cx, y: isl.cy, r: isl.radius }) || l.rocks.find((r) => r.material === what);
    if (!spot) return null;
    Object.assign(game.boat, { x: spot.x, y: spot.y + spot.r + off, vx: 0, vy: 0, heading: game.wind.angle + Math.PI, yawRate: 0 });
    if (what === 'lair' && warned !== null) game.time += (((spot.period - 3.4 + warned - spot.offset - game.time) % spot.period) + spot.period) % spot.period;
    resetView(renderer, game);
    return { x: spot.x, y: spot.y, r: spot.r };
  },
  // What the skipper is up to on deck.
  skipper() {
    const s = renderer.skipper;
    return { doing: s.doing, goal: s.goal, walking: s.path.length > 0, cheer: s.cheer > 0, fish: s.fish > 0 };
  },
  // Animals on the islands near the boat, and how many are in the water.
  islandLife() {
    const all = islandAnimals(renderer.life, game);
    const wet = (list) => list.filter((a) => a.state !== 'rest').length;
    return {
      crabs: all.crabs.length,
      turtles: all.turtles.length,
      seals: all.seals.length,
      goats: all.goats.length,
      parrots: all.parrots.length,
      swimming: wet(all.turtles) + wet(all.seals),
      flying: all.parrots.filter((p) => p.state === 'fly').length,
    };
  },
  // Penguins on the ice: how many, and how many have gone for a swim.
  penguins() {
    const c = renderer.life.colonies;
    if (!c || c.level !== (game && game.level)) return null;
    const all = c.huddles.flatMap((h) => h.penguins);
    return { huddles: c.huddles.length, penguins: all.length, swimming: all.filter((p) => p.s !== 'stand').length };
  },
  state() {
    return {
      mode,
      screen: ui.current,
      level: game && game.def.id,
      boat: game && game.boat.type.id,
      upgrades: game && (game.boat.type.upgrades || null),
      status: game && game.status,
      time: game && game.time,
      x: game && game.boat.x,
      y: game && game.boat.y,
      speed: game && speedOf(game),
      hull: game && game.hull,
      pearls: game && game.pearls,
      aboard: game && game.boat.crew,
      sea: game && game.sea && { clock: game.sea.clock, gates: game.sea.gates, missed: game.sea.missed, best: game.sea.best },
      race: game && game.race && { place: game.race.place, mark: game.nextCheckpoint, dirty: game.race.dirty, bumps: game.race.bumps, rivals: game.race.rivals.map((r) => ({ name: r.name, x: r.boat.x, y: r.boat.y, next: r.next, finished: r.finished })) },
      result: game && game.result,
      wallet: { ...save.wallet },
      blackPearls: game && game.blackPearls,
      zoom: save.settings.zoom,
      pinch: input.state.pinchZoom,
      film: film && { t: film.t, shot: film.shot.id, oar: film.oar.state, route: !!film.route },
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
// A first launch opens on the prologue; after that, on the title.
if (!save.seenFilm && !save.stats.voyages) playFilm();
else showTitle();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
