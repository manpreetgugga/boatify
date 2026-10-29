// Keyboard, touch and mouse controls turned into one steering/trim input.
//
// Touch: put a thumb down anywhere and slide it sideways to steer (a ring
// appears under the thumb, so where it lands never turns the boat), tap the
// gust button to uncork a gust jar, and when trimming by hand steer on the
// helm side and drag on the other side to sheet in and out. The zoom button
// (or + / - and the mouse wheel) brings the view closer or pulls it back.

import { clamp, approach } from '../core/math.js';
import { inCircle, inRect } from '../render/layout.js';

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  sheetIn: ['ArrowUp', 'KeyW'],
  sheetOut: ['ArrowDown', 'KeyS'],
};

export function createInput(target, { getLayout, getSettings, onPause, onRestart, onMute, onToggleTrim, onZoom }) {
  const keys = new Set();
  const pointers = new Map();
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const state = {
    enabled: false,
    steer: 0,
    keySteer: 0,
    trimTarget: 0.5,
    boostQueued: false,
    controls: {
      touch: coarse,
      helm: { active: false, used: false, ax: 0, ay: 0, x: 0, y: 0 },
      sheet: { active: false },
      steer: 0,
      manual: false,
      trimTarget: 0.5,
    },
  };

  function settings() {
    return getSettings();
  }

  function onKeyDown(e) {
    if (!state.enabled) return;
    if (e.repeat && (e.code === 'Space' || e.code === 'KeyP')) return;
    keys.add(e.code);
    if (!pointers.size) state.controls.touch = false;
    if (e.code === 'Space') {
      state.boostQueued = true;
      e.preventDefault();
    } else if (e.code === 'KeyP') {
      onPause();
    } else if (e.code === 'KeyR') {
      onRestart();
    } else if (e.code === 'KeyM') {
      onMute();
    } else if (e.code === 'KeyT') {
      onToggleTrim();
    } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      onZoom(1);
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      onZoom(-1);
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function local(e) {
    const rect = target.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e) {
    if (!state.enabled) return;
    const [x, y] = local(e);
    if (e.pointerType === 'touch' || e.pointerType === 'pen') state.controls.touch = true;
    const L = getLayout();
    const manual = !settings().autoTrim;
    let role = null;
    if (inRect(x, y, L.pause, 8)) {
      onPause();
      return;
    }
    if (inRect(x, y, L.zoom, 6)) {
      onZoom(0);
      return;
    }
    if (state.controls.touch && inCircle(x, y, L.gust, 10)) {
      state.boostQueued = true;
      role = 'gust';
    } else if (manual && state.controls.touch && inRect(x, y, { x: L.sheet.x - 40, y: L.sheet.y - 20, w: 80, h: L.sheet.h + 40 })) {
      role = 'sheet';
    } else {
      const helmOnLeft = !L.lefty;
      const onHelmSide = helmOnLeft ? x < L.w * 0.5 : x > L.w * 0.5;
      if (onHelmSide || !manual || !state.controls.touch) role = 'helm';
      else role = 'sheetFree';
    }
    const p = { id: e.pointerId, role, sx: x, sy: y, x, y, trim0: state.trimTarget };
    pointers.set(e.pointerId, p);
    if (role === 'helm') {
      const h = state.controls.helm;
      h.active = true;
      h.used = true;
      // The ring is centred where the thumb lands: only sliding steers.
      h.ax = x;
      h.ay = y;
      h.x = x;
      h.y = y;
    } else if (role === 'sheet') {
      state.controls.sheet.active = true;
      setSheetFromY(L, y);
    } else if (role === 'sheetFree') {
      state.controls.sheet.active = true;
    }
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Not all pointers can be captured (e.g. synthetic events).
    }
    e.preventDefault();
  }

  function setSheetFromY(L, y) {
    const s = L.sheet;
    state.trimTarget = clamp((y - s.y - 8) / (s.h - 16), 0, 1);
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = local(e);
    p.x = x;
    p.y = y;
    const L = getLayout();
    if (p.role === 'helm') {
      state.controls.helm.x = x;
      state.controls.helm.y = y;
    } else if (p.role === 'sheet') {
      setSheetFromY(L, y);
    } else if (p.role === 'sheetFree') {
      state.trimTarget = clamp(p.trim0 + (y - p.sy) / 160, 0, 1);
    }
    e.preventDefault();
  }

  function onPointerUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.role === 'helm' && ![...pointers.values()].some((q) => q.role === 'helm')) state.controls.helm.active = false;
    if ((p.role === 'sheet' || p.role === 'sheetFree') && ![...pointers.values()].some((q) => q.role.startsWith('sheet'))) {
      state.controls.sheet.active = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  // A mouse wheel zooms a step at a time.
  let wheelAt = 0;
  target.addEventListener(
    'wheel',
    (e) => {
      if (!state.enabled) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt < 180 || !e.deltaY) return;
      wheelAt = now;
      onZoom(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );

  const any = (list) => list.some((k) => keys.has(k));

  return {
    state,
    setEnabled(on) {
      state.enabled = on;
      if (!on) {
        keys.clear();
        pointers.clear();
        state.controls.helm.active = false;
        state.controls.sheet.active = false;
        state.boostQueued = false;
      }
    },
    reset(trim = 0.5) {
      state.steer = 0;
      state.keySteer = 0;
      state.trimTarget = trim;
      state.boostQueued = false;
    },
    // Build this frame's input for the simulation.
    read(dt) {
      const L = getLayout();
      const s = settings();
      const manual = !s.autoTrim;
      let steer = 0;
      // Keyboard steering eases in so taps make small corrections.
      const keyDir = (any(KEYS.right) ? 1 : 0) - (any(KEYS.left) ? 1 : 0);
      state.keySteer = keyDir ? approach(state.keySteer, keyDir, 7, dt) : approach(state.keySteer, 0, 14, dt);
      steer = state.keySteer;
      const h = state.controls.helm;
      if (h.active) {
        const span = L.helm.r * 0.85;
        const dx = (h.x - h.ax) / span;
        const dead = 0.06;
        const v = Math.abs(dx) < dead ? 0 : (dx - Math.sign(dx) * dead) / (1 - dead);
        steer = clamp(v, -1, 1) * (s.steerSensitivity || 1);
        steer = clamp(steer, -1, 1);
      }
      if (manual) {
        const sheetDir = (any(KEYS.sheetOut) ? 1 : 0) - (any(KEYS.sheetIn) ? 1 : 0);
        if (sheetDir) state.trimTarget = clamp(state.trimTarget + sheetDir * 0.75 * dt, 0, 1);
      }
      state.steer = steer;
      state.controls.steer = steer;
      state.controls.manual = manual;
      state.controls.trimTarget = state.trimTarget;
      const boost = state.boostQueued;
      state.boostQueued = false;
      return { steer, trimTarget: state.trimTarget, autoTrim: !manual, boost };
    },
  };
}
