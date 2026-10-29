// Where the on-screen controls and instruments sit. Shared by the HUD
// renderer and the touch input so drawing and hit-testing always agree.

import { clamp } from '../core/math.js';

export function hudLayout(w, h, insets = {}, settings = {}) {
  const l = insets.left || 0;
  const r = insets.right || 0;
  const t = insets.top || 0;
  const b = insets.bottom || 0;
  const compact = h < 420 || w < 700;
  const pad = compact ? 10 : 16;
  const lefty = settings.leftHanded;

  const panelW = clamp(w * 0.34, 280, 350);
  const panelH = compact ? 70 : 82;
  const panel = { x: (w - panelW) / 2, y: h - b - panelH - pad * 0.6, w: panelW, h: panelH };

  const mapW = clamp(w * 0.19, 112, 200);
  const minimap = { x: w - r - pad - mapW, y: t + pad, w: mapW, h: mapW * 0.62 };

  const gustR = compact ? 30 : 36;
  const helmR = compact ? 50 : 60;
  const sideX = (onRight, inset) => (onRight ? w - r - inset : l + inset);
  const gust = { x: sideX(!lefty, pad + gustR + 6), y: h - b - pad - gustR - 6, r: gustR };
  const helm = { x: sideX(!!lefty, pad + helmR + 26), y: h - b - pad - helmR - 22, r: helmR };
  const sheet = {
    x: sideX(!lefty, pad + gustR * 2 + 40),
    y: h - b - pad - (compact ? 150 : 190),
    w: 26,
    h: compact ? 140 : 180,
  };
  const pause = { x: l + pad, y: t + pad, w: 44, h: 44 };
  const timer = { x: l + pad + 56, y: t + pad };
  return { w, h, pad, compact, panel, minimap, gust, helm, sheet, pause, timer, lefty, insets: { l, r, t, b } };
}

export function inCircle(px, py, c, extra = 0) {
  return Math.hypot(px - c.x, py - c.y) <= c.r + extra;
}

export function inRect(px, py, rect, extra = 0) {
  return px >= rect.x - extra && px <= rect.x + rect.w + extra && py >= rect.y - extra && py <= rect.y + rect.h + extra;
}
