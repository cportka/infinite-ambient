// session.js — the "key" as a whole-configuration snapshot.
//
// A key is `<seed>` or `<seed>~<config>`. The seed is the human word that seeds
// the generative piece (root/intervals/evolution) — unchanged, still shareable on
// its own. The optional `<config>` after the `~` encodes the ENTIRE rack: master
// volume, pace, and every open instrument (its type, mute, mix, and all params),
// so copying the key hands someone your exact soundscape and pasting one restores
// it. Typing a bare word re-seeds the music but keeps the current rack.
//
// The encoding is designed to be extensible WITHOUT breaking old keys:
//   - a leading version token (`1`) lets the whole format change later;
//   - instruments are referenced by a permanent 2-char `code` (never an index),
//     so adding instrument types never shifts anything and unknown codes are
//     skipped by old readers;
//   - each instrument's numbers are fixed-width 2-char base-36 fields in the
//     instrument's own param order, so adding a param to an instrument later just
//     appends a field — old keys (with fewer fields) fall back to that param's
//     default, and newer keys read by older code ignore the extra field.
//
// Everything is [0-9a-z.~-] — URL-safe, so the key doubles as a shareable link.

import { REGISTRY, byCode } from "./instruments/index.js";

export const MAX_INSTRUMENTS = 12;
const VERSION = "1";
const SEP = "."; // between top-level segments and between instrument tokens
const Q = 1295; // 2 base-36 digits: 0..1295
const MIX_MAX = 2; // mix (Level) is stored over [0,2] so instrument gains >1 (e.g.
// Electricity's 1.1 loudness trim) round-trip exactly, even though the Level slider
// only lets a user reach 1.

// ---- scalar quantisation ------------------------------------------------

function enc(v, min, max) {
  const span = max - min || 1;
  let n = Math.round(((Number(v) - min) / span) * Q);
  if (!Number.isFinite(n)) n = 0;
  n = Math.min(Q, Math.max(0, n));
  return n.toString(36).padStart(2, "0");
}

function dec(s, min, max, step) {
  let n = parseInt(s, 36);
  if (!Number.isFinite(n)) n = 0;
  n = Math.min(Q, Math.max(0, n));
  let v = min + (n / Q) * (max - min);
  if (step) v = Math.round(v / step) * step;
  return Math.min(max, Math.max(min, v));
}

// ---- one instrument -----------------------------------------------------

// inst: { code, muted, mix, params:{key:value} }  (code must be a known type)
function encodeInstrument(inst) {
  const entry = byCode(inst.code);
  if (!entry) return null;
  const flags = ((inst.muted ? 1 : 0) & 0xff).toString(36); // 1 char, bit0 = muted
  let vals = enc(inst.mix ?? entry.meta.gain ?? 0.85, 0, MIX_MAX);
  for (const p of entry.meta.params) {
    vals += enc(inst.params?.[p.key] ?? p.default, p.min, p.max);
  }
  return inst.code + flags + vals;
}

function decodeInstrument(tok) {
  if (!tok || tok.length < 3) return null;
  const code = tok.slice(0, 2);
  const entry = byCode(code);
  if (!entry) return null; // unknown type (e.g. from a newer app) — skip it
  const flags = parseInt(tok[2], 36) || 0;
  const rest = tok.slice(3);
  const pairs = [];
  for (let i = 0; i + 2 <= rest.length; i += 2) pairs.push(rest.slice(i, i + 2));
  const mix = pairs.length ? dec(pairs[0], 0, MIX_MAX, 0.01) : (entry.meta.gain ?? 0.85);
  const params = {};
  entry.meta.params.forEach((p, idx) => {
    const pair = pairs[idx + 1]; // pairs[0] is mix; params start at pairs[1]
    params[p.key] = pair !== undefined ? dec(pair, p.min, p.max, p.step) : p.default;
  });
  return { code, id: entry.meta.id, muted: !!(flags & 1), mix, params };
}

// ---- whole session ------------------------------------------------------

// state: { volume, pace, instruments:[{code,muted,mix,params}] }
export function encodeConfig(state) {
  const globals = enc(state.volume ?? 0.5, 0, 1) + enc(state.pace ?? 0.5, 0, 1);
  const toks = (state.instruments || [])
    .slice(0, MAX_INSTRUMENTS)
    .map(encodeInstrument)
    .filter(Boolean);
  return [VERSION, globals, ...toks].join(SEP);
}

export function decodeConfig(cfg) {
  if (!cfg) return null;
  const parts = String(cfg).split(SEP);
  if (parts[0] !== VERSION) return null; // unknown version → caller falls back
  const g = parts[1] || "";
  const volume = dec(g.slice(0, 2) || "00", 0, 1, 0.01);
  const pace = dec(g.slice(2, 4) || "00", 0, 1, 0.01);
  const instruments = [];
  for (const tok of parts.slice(2)) {
    const inst = decodeInstrument(tok);
    if (inst) instruments.push(inst);
    if (instruments.length >= MAX_INSTRUMENTS) break;
  }
  return { volume, pace, instruments };
}

// ---- the full key string ------------------------------------------------

// A seed may not contain the `~` separator; sanitise defensively.
export function cleanSeed(seed) {
  return String(seed || "").trim().replace(/~.*$/, "").trim();
}

// Build the full key from a seed + live state.
export function buildKey(seed, state) {
  return `${cleanSeed(seed)}~${encodeConfig(state)}`;
}

// Parse a full key into { seed, config|null }. A bare word (no `~`) → config null.
export function parseKey(fullKey) {
  const raw = String(fullKey || "").trim();
  const i = raw.indexOf("~");
  if (i < 0) return { seed: cleanSeed(raw), config: null };
  return { seed: cleanSeed(raw.slice(0, i)), config: decodeConfig(raw.slice(i + 1)) };
}
