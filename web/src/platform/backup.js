// Backup codes: the whole save as one line of text, to copy on one phone and
// paste on another. "NP1." then the save's JSON deflated and in base64url,
// then a check so a code cut short or mistyped is caught before it's used.
// Where the browser can't deflate, "NP0." carries the JSON as it is.
// Ghost runs stay behind: they are big, and the next run records a new one.

import { cleanSave, totalStars } from './save.js';

const ZIPPED = 'NP1';
const PLAIN = 'NP0';

export async function backupCode(save) {
  const json = JSON.stringify(save);
  let bytes = new TextEncoder().encode(json);
  let kind = PLAIN;
  if (typeof CompressionStream === 'function') {
    try {
      bytes = await squeeze(bytes, new CompressionStream('deflate'));
      kind = ZIPPED;
    } catch {
      bytes = new TextEncoder().encode(json);
    }
  }
  const body = toBase64Url(bytes);
  return `${kind}.${body}.${check(kind + body)}`;
}

// Read a pasted code. Resolves to { ok: true, save, summary } or
// { ok: false, reason } with reason 'empty', 'not-a-code', 'damaged' or
// 'unsupported' (a zipped code where the browser can't unzip).
export async function readBackup(text) {
  const code = String(text || '').replace(/\s+/g, '');
  if (!code) return { ok: false, reason: 'empty' };
  const parts = code.split('.');
  if (parts.length !== 3 || (parts[0] !== ZIPPED && parts[0] !== PLAIN)) return { ok: false, reason: 'not-a-code' };
  const [kind, body, sum] = parts;
  if (check(kind + body) !== sum) return { ok: false, reason: 'damaged' };
  if (kind === ZIPPED && typeof DecompressionStream !== 'function') return { ok: false, reason: 'unsupported' };
  let data;
  try {
    let bytes = fromBase64Url(body);
    if (kind === ZIPPED) bytes = await squeeze(bytes, new DecompressionStream('deflate'));
    const json = new TextDecoder().decode(bytes);
    // A real save never has markup in it; refuse a code that does.
    if (/[<>]/.test(json)) return { ok: false, reason: 'damaged' };
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'damaged' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.levels !== 'object') return { ok: false, reason: 'damaged' };
  const save = cleanSave(data);
  for (const k of Object.keys(save.stats)) save.stats[k] = Number(save.stats[k]) || 0;
  return { ok: true, save, summary: summarize(save) };
}

// What a code holds, for the "replace this phone's progress?" question.
export function summarize(save) {
  return {
    stars: totalStars(save),
    voyages: Object.values(save.levels).filter((l) => l && l.best !== null).length,
    coins: Math.floor(Number(save.wallet.coins) || 0),
    blackPearls: Math.floor(Number(save.wallet.blackPearls) || 0),
    medals: Object.keys(save.medals).length,
  };
}

async function squeeze(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// FNV-1a, as eight hex digits.
function check(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
