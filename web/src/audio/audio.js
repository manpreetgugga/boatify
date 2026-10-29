// All sound is synthesized with WebAudio: wind and water beds driven by the
// simulation, one-shot effects for events, and a gentle generative tune.
// Nothing is loaded from files, so the game stays a single small page.

import { clamp } from '../core/math.js';
import { boatSpeed } from '../physics/boat.js';

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const CHORDS = [
  [0, 7, 16],
  [-3, 4, 12],
  [-7, 0, 9],
  [-5, 2, 11],
];

export function createAudio() {
  let ac = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noise = null;
  const beds = {};
  const settings = { sound: true, music: true };
  let musicClock = 0;
  let beat = 0;
  let chordIndex = 0;
  let padVoices = [];

  // White noise, or brown (much softer, all rumble and no hiss).
  function makeNoise(brown = false) {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (!brown) d[i] = white;
      else {
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  function bed(type, freq, q, buffer = noise) {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = Math.random();
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start(0, Math.random() * 1.5);
    return { filter, gain };
  }

  function init() {
    if (ac) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ac = new Ctor();
    } catch {
      return false;
    }
    master = ac.createGain();
    master.gain.value = settings.sound ? 0.9 : 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = settings.music ? 0.16 : 0;
    const musicFilter = ac.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 2600;
    musicBus.connect(musicFilter).connect(master);
    noise = makeNoise();
    // Wind and water run on brown noise so a fast reach is a soft rush, not a hiss.
    const rumble = makeNoise(true);
    beds.wind = bed('bandpass', 400, 0.7, rumble);
    beds.water = bed('lowpass', 300, 0.5, rumble);
    beds.luff = bed('bandpass', 1100, 1.4);
    beds.rain = bed('highpass', 2800, 0.5);
    return true;
  }

  function unlock() {
    if (!init()) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }

  const set = (param, v, t = 0.15) => param.setTargetAtTime(v, ac.currentTime, t);

  function env(gainNode, peak, attack, decay, at = ac.currentTime) {
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  function tone(freq, { type = 'sine', peak = 0.3, attack = 0.005, decay = 0.4, at = 0, glide = 0, bus = sfxBus, detune = 0 } = {}) {
    if (!ac) return;
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t0 + attack + decay);
    const g = ac.createGain();
    env(g, peak, attack, decay, t0);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.05);
  }

  function hiss({ type = 'bandpass', freq = 1000, q = 1, peak = 0.3, attack = 0.01, decay = 0.3, at = 0, sweep = 0 } = {}) {
    if (!ac) return;
    const t0 = ac.currentTime + at;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t0 + attack + decay);
    f.Q.value = q;
    const g = ac.createGain();
    env(g, peak, attack, decay, t0);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + attack + decay + 0.05);
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  const sfx = {
    click() {
      tone(1400, { type: 'triangle', peak: 0.08, decay: 0.05 });
    },
    count(final = false) {
      tone(final ? 880 : 587, { type: 'sine', peak: 0.16, decay: final ? 0.6 : 0.18 });
      if (final) tone(1320, { type: 'sine', peak: 0.06, decay: 0.5, at: 0.02 });
    },
    tack(strength = 10) {
      // Boom swinging over and the sheet snapping taut.
      hiss({ freq: 700, q: 2, peak: clamp(strength / 40, 0.05, 0.25), attack: 0.05, decay: 0.35, sweep: 2.2 });
      tone(180, { type: 'sawtooth', peak: 0.05, attack: 0.02, decay: 0.25, glide: 0.8, at: 0.12 });
      tone(320, { type: 'square', peak: 0.04, decay: 0.08, at: 0.3 });
    },
    collide(impact = 5, material = 'rock') {
      const k = clamp(impact / 14, 0.15, 1);
      tone(material === 'sand' ? 90 : 70, { type: 'sine', peak: 0.5 * k, attack: 0.003, decay: 0.35, glide: 0.5 });
      hiss({ type: 'lowpass', freq: material === 'sand' ? 900 : 1800, peak: 0.35 * k, decay: material === 'sand' ? 0.35 : 0.2 });
      if (material !== 'sand') tone(140, { type: 'square', peak: 0.12 * k, decay: 0.12, glide: 0.6 });
      if (material === 'ice') {
        // A brittle crack and a tinkle of chips.
        hiss({ type: 'highpass', freq: 3200, peak: 0.18 * k, decay: 0.09 });
        [2350, 3100, 2700].forEach((f, i) => tone(f, { type: 'triangle', peak: 0.05 * k, decay: 0.18, at: 0.03 + i * 0.05, glide: 0.92 }));
      }
    },
    pickup(kind) {
      if (kind === 'pearl') {
        [76, 83, 88].forEach((n, i) => tone(midi(n), { type: 'sine', peak: 0.16, decay: 0.5, at: i * 0.07 }));
        tone(midi(100), { type: 'sine', peak: 0.05, decay: 0.4, at: 0.2 });
      } else if (kind === 'gust') {
        hiss({ freq: 400, q: 3, peak: 0.25, attack: 0.05, decay: 0.5, sweep: 6 });
        tone(midi(72), { type: 'triangle', peak: 0.1, decay: 0.3, at: 0.15 });
      } else if (kind === 'blackPearl') {
        // A low, rich arpeggio rising into a shimmer: rarer than a pearl.
        [72, 79, 84, 88, 91, 96].forEach((n, i) => tone(midi(n), { type: 'sine', peak: 0.12, decay: 0.7, at: i * 0.055 }));
        [103, 108].forEach((n, i) => tone(midi(n), { type: 'sine', peak: 0.05, decay: 0.9, at: 0.25 + i * 0.05 }));
        hiss({ type: 'highpass', freq: 6000, peak: 0.08, attack: 0.05, decay: 0.6, at: 0.1 });
      } else if (kind === 'repair') {
        [0, 0.14, 0.28].forEach((at) => {
          tone(260, { type: 'square', peak: 0.12, decay: 0.06, at });
          hiss({ type: 'highpass', freq: 2500, peak: 0.12, decay: 0.05, at });
        });
      } else {
        tone(midi(91), { type: 'sine', peak: 0.12, decay: 0.6 });
        tone(midi(98), { type: 'sine', peak: 0.08, decay: 0.7, at: 0.06 });
      }
    },
    checkpoint() {
      // A bell: inharmonic partials with a long ring.
      const f = 520;
      [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(f * m, { type: 'sine', peak: 0.16 / (i + 1), attack: 0.002, decay: 1.6 / (i * 0.5 + 1) }));
    },
    finish(stars = 1) {
      const notes = [72, 76, 79, 84, 88, 91];
      notes.slice(0, 3 + stars).forEach((n, i) => tone(midi(n), { type: 'triangle', peak: 0.16, decay: 0.6, at: i * 0.11 }));
      tone(midi(60), { type: 'sine', peak: 0.2, decay: 1.6, at: 0.1 });
    },
    capsize() {
      hiss({ type: 'lowpass', freq: 1200, peak: 0.45, attack: 0.02, decay: 1.1, sweep: 0.3 });
      tone(220, { type: 'triangle', peak: 0.15, decay: 0.8, glide: 0.4 });
    },
    righted() {
      tone(midi(67), { type: 'triangle', peak: 0.1, decay: 0.2 });
      tone(midi(72), { type: 'triangle', peak: 0.1, decay: 0.3, at: 0.12 });
    },
    sink() {
      hiss({ type: 'lowpass', freq: 800, peak: 0.4, attack: 0.1, decay: 2, sweep: 0.25 });
      [0, 0.3, 0.55, 0.8].forEach((at, i) => tone(500 - i * 60, { type: 'sine', peak: 0.08, decay: 0.12, at, glide: 1.6 }));
    },
    respawn() {
      tone(midi(64), { type: 'sine', peak: 0.12, decay: 0.4 });
      tone(midi(71), { type: 'sine', peak: 0.12, decay: 0.5, at: 0.1 });
    },
    boost() {
      hiss({ freq: 300, q: 1.5, peak: 0.45, attack: 0.08, decay: 1.4, sweep: 5 });
      tone(110, { type: 'sawtooth', peak: 0.06, attack: 0.05, decay: 0.8, glide: 2 });
    },
    heelWarning() {
      tone(150, { type: 'sawtooth', peak: 0.06, attack: 0.05, decay: 0.5, glide: 1.3 });
      hiss({ freq: 600, q: 6, peak: 0.08, attack: 0.1, decay: 0.4 });
    },
    thunder() {
      hiss({ type: 'lowpass', freq: 220, q: 0.7, peak: 0.7, attack: 0.03, decay: 2.6, at: 0.35, sweep: 0.5 });
      hiss({ type: 'lowpass', freq: 500, q: 0.7, peak: 0.25, attack: 0.01, decay: 0.4, at: 0.3 });
    },
    kraken(phase) {
      if (phase === 'warning') {
        tone(55, { type: 'sawtooth', peak: 0.12, attack: 0.4, decay: 1.4, glide: 0.8 });
        hiss({ type: 'lowpass', freq: 300, peak: 0.2, attack: 0.5, decay: 1.2 });
      } else {
        hiss({ type: 'lowpass', freq: 900, peak: 0.5, attack: 0.02, decay: 0.9, sweep: 0.4 });
        tone(45, { type: 'square', peak: 0.12, decay: 0.6, glide: 0.7 });
      }
    },
    note() {
      tone(midi(79), { type: 'sine', peak: 0.08, decay: 0.8 });
    },
    castaway(phase) {
      if (phase === 'sighted') {
        // A far-off shout: two falling whistles.
        tone(1500, { type: 'sine', peak: 0.05, attack: 0.04, decay: 0.3, glide: 0.75 });
        tone(1500, { type: 'sine', peak: 0.05, attack: 0.04, decay: 0.3, glide: 0.75, at: 0.4 });
      } else {
        // Hauled over the gunwale with a splash, then a bright rising arpeggio.
        hiss({ type: 'lowpass', freq: 1400, peak: 0.3, attack: 0.01, decay: 0.45, sweep: 0.4 });
        [67, 71, 74, 79].forEach((n, i) => tone(midi(n), { type: 'triangle', peak: 0.13, decay: 0.45, at: 0.15 + i * 0.09 }));
      }
    },
    dolphins() {
      // A burst of clicks, then two rising whistles.
      [0, 0.05, 0.09, 0.12].forEach((at) => tone(2600, { type: 'square', peak: 0.025, decay: 0.02, at }));
      tone(1800, { type: 'sine', peak: 0.07, attack: 0.03, decay: 0.35, glide: 2.1, at: 0.18 });
      tone(2600, { type: 'sine', peak: 0.05, attack: 0.02, decay: 0.25, glide: 0.6, at: 0.55 });
    },
    whale(phase, vol = 1) {
      if (phase === 'spout') {
        hiss({ freq: 1400, q: 0.8, peak: 0.12 * vol, attack: 0.05, decay: 0.7, sweep: 0.5 });
      } else if (phase === 'rising') {
        tone(140, { type: 'sine', peak: 0.12 * vol, attack: 0.3, decay: 1.4, glide: 1.6 });
        tone(210, { type: 'triangle', peak: 0.05 * vol, attack: 0.4, decay: 1.1, glide: 1.4, at: 0.2 });
      } else {
        hiss({ type: 'lowpass', freq: 1100, peak: 0.6 * vol, attack: 0.02, decay: 1.6, sweep: 0.35 });
        tone(60, { type: 'sine', peak: 0.4 * vol, attack: 0.005, decay: 0.7, glide: 0.6 });
      }
    },
    swell(strength = 1) {
      hiss({ type: 'lowpass', freq: 500, peak: 0.3 * strength, attack: 0.2, decay: 0.9, sweep: 1.8 });
    },
    pirates(phase) {
      if (phase === 'spotted') {
        // A ship's bell rung in alarm over a low minor drone.
        [0, 0.28, 0.56].forEach((at) => [1, 2.76].forEach((m, i) => tone(midi(81) * m, { type: 'sine', peak: 0.1 / (i + 1), attack: 0.002, decay: 0.5, at })));
        [45, 48, 52].forEach((n, i) => tone(midi(n), { type: 'sawtooth', peak: 0.035, attack: 0.15, decay: 1.4, at: 0.1 + i * 0.05 }));
      } else {
        // They give up: a falling horn.
        tone(midi(57), { type: 'triangle', peak: 0.1, attack: 0.05, decay: 0.9, glide: 0.75 });
        tone(midi(52), { type: 'triangle', peak: 0.07, attack: 0.05, decay: 0.9, glide: 0.75, at: 0.25 });
      }
    },
    cannon(phase, vol = 1) {
      if (phase === 'fire') {
        // A distant boom: a thump with a rumble behind it.
        tone(55, { type: 'sine', peak: 0.5 * vol, attack: 0.003, decay: 0.6, glide: 0.5 });
        hiss({ type: 'lowpass', freq: 700, peak: 0.45 * vol, attack: 0.003, decay: 0.9, sweep: 0.4 });
      } else if (phase === 'hit') {
        tone(80, { type: 'sine', peak: 0.55, attack: 0.002, decay: 0.4, glide: 0.5 });
        hiss({ type: 'bandpass', freq: 1600, q: 0.7, peak: 0.45, attack: 0.002, decay: 0.3 });
        tone(170, { type: 'square', peak: 0.12, decay: 0.15, glide: 0.5 });
      } else {
        // A splash.
        hiss({ type: 'bandpass', freq: 900, q: 0.6, peak: 0.32 * vol, attack: 0.01, decay: 0.5, sweep: 0.5 });
        tone(140, { type: 'sine', peak: 0.12 * vol, attack: 0.005, decay: 0.2, glide: 0.4 });
      }
    },
    oar(phase) {
      if (phase === 'stroke') {
        // The oarlock creaks, then the blade pulls through the water.
        tone(320, { type: 'triangle', peak: 0.035, attack: 0.02, decay: 0.12, glide: 0.8 });
        hiss({ freq: 700, q: 0.8, peak: 0.12, attack: 0.12, decay: 0.5, sweep: 0.6, at: 0.05 });
      } else if (phase === 'lost') {
        // Wood knocks on the gunwale, and away it goes.
        tone(210, { type: 'square', peak: 0.08, decay: 0.06 });
        tone(260, { type: 'square', peak: 0.06, decay: 0.05, at: 0.09 });
        hiss({ freq: 1800, q: 0.7, peak: 0.16, attack: 0.04, decay: 0.6, sweep: 0.4, at: 0.05 });
      } else {
        hiss({ type: 'bandpass', freq: 1000, q: 0.6, peak: 0.28, attack: 0.01, decay: 0.55, sweep: 0.45 });
        tone(170, { type: 'sine', peak: 0.08, attack: 0.005, decay: 0.18, glide: 0.4 });
      }
    },
    coins() {
      // Coins dropping into a purse.
      [0, 0.07, 0.15].forEach((at, i) => {
        tone(midi(88 + i * 3), { type: 'square', peak: 0.04, decay: 0.12, at });
        tone(midi(100 + i * 3), { type: 'sine', peak: 0.06, decay: 0.25, at });
      });
    },
    medal() {
      // A rising fanfare that ends on a ringing bell.
      [67, 72, 76, 79].forEach((n, i) => tone(midi(n), { type: 'triangle', peak: 0.13, decay: 0.35, at: i * 0.08 }));
      [1, 2.76, 5.4].forEach((m, i) => tone(midi(84) * m, { type: 'sine', peak: 0.12 / (i + 1), attack: 0.002, decay: 1.4, at: 0.32 }));
    },
  };

  function playPad() {
    for (const v of padVoices) {
      v.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.8);
      v.o.stop(ac.currentTime + 4);
    }
    padVoices = [];
    const chord = CHORDS[chordIndex % CHORDS.length];
    chordIndex += 1;
    for (const n of chord) {
      for (const det of [-6, 6]) {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = midi(52 + n);
        o.detune.value = det;
        const g = ac.createGain();
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.07, ac.currentTime, 1.2);
        o.connect(g).connect(musicBus);
        o.start();
        padVoices.push({ o, g });
      }
    }
  }

  function updateMusic(dt) {
    if (!settings.music || !ac || ac.state !== 'running') return;
    musicClock -= dt;
    if (musicClock > 0) return;
    musicClock = 0.42;
    if (beat % 16 === 0) playPad();
    const chord = CHORDS[(chordIndex + CHORDS.length - 1) % CHORDS.length];
    if (beat % 2 === 0 || Math.random() < 0.3) {
      if (Math.random() < 0.72) {
        const n = 64 + chord[0] + PENTATONIC[Math.floor(Math.random() * 7)];
        tone(midi(n), { type: 'triangle', peak: 0.09, attack: 0.004, decay: 0.7 + Math.random() * 0.5, bus: musicBus });
      }
    }
    beat += 1;
  }

  return {
    unlock,
    sfx: new Proxy(sfx, {
      get(target, name) {
        const fn = target[name];
        return (...args) => {
          if (!ac || !settings.sound || ac.state !== 'running') return;
          try {
            fn(...args);
          } catch {
            // Audio is a nicety; never let it break the game.
          }
        };
      },
    }),
    configure({ sound, music }) {
      if (sound !== undefined) settings.sound = sound;
      if (music !== undefined) settings.music = music;
      if (!ac) return;
      set(master.gain, settings.sound ? 0.9 : 0, 0.05);
      set(musicBus.gain, settings.music ? 0.16 : 0, 0.3);
    },
    suspend() {
      if (ac && ac.state === 'running') ac.suspend().catch(() => {});
    },
    resume() {
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    // Drive the ambient beds from the simulation (or silence them).
    update(game, dt, active) {
      if (!ac) return;
      updateMusic(dt);
      if (!game || !active) {
        for (const b of Object.values(beds)) set(b.gain.gain, 0, 0.3);
        return;
      }
      const aw = game.boat.apparentSpeed;
      const sp = boatSpeed(game.boat);
      set(beds.wind.gain.gain, clamp(0.05 + aw / 110, 0, 0.28), 0.5);
      set(beds.wind.filter.frequency, 260 + Math.min(aw, 40) * 12, 0.6);
      // The bow wave comes and goes with the swell rather than roaring steadily.
      const swell = 0.8 + 0.2 * Math.sin(game.time * 2.2);
      set(beds.water.gain.gain, clamp(0.04 + sp / 70, 0, 0.3) * swell, 0.35);
      set(beds.water.filter.frequency, 220 + Math.min(sp, 40) * 14, 0.4);
      const luff = game.boat.luffing && game.status === 'sailing' ? clamp(aw / 30, 0.05, 0.3) * (0.5 + 0.5 * Math.sin(game.time * 42)) : 0;
      set(beds.luff.gain.gain, luff, 0.02);
      let rain = game.level.weather.rain || 0;
      for (const s of game.level.storms) {
        const d = Math.hypot(game.boat.x - s.x, game.boat.y - s.y);
        if (d < s.r) rain = Math.max(rain, 1 - d / s.r);
      }
      set(beds.rain.gain.gain, rain * 0.16, 0.5);
    },
  };
}
