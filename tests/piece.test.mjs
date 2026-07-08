// piece.test.mjs — unit tests for the deterministic, microtonal piece core.
// Pure module (no Web Audio / DOM), so it runs under `node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashSeed,
  mulberry32,
  makeRng,
  stepRng,
  buildPiece,
  freqAt,
  gamutFreqs,
  randomKey,
  clamp,
  lerp,
} from "../src/audio/piece.js";

test("hashSeed is stable and distinguishes strings", () => {
  assert.equal(hashSeed("aurora"), hashSeed("aurora"));
  assert.notEqual(hashSeed("aurora"), hashSeed("aurora ")); // whitespace matters
  assert.notEqual(hashSeed("aurora"), hashSeed("monolith"));
  assert.ok(Number.isInteger(hashSeed("x")) && hashSeed("x") >= 0);
});

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const seq = [mulberry32(1)(), mulberry32(1)()];
  assert.equal(seq[0], seq[1]); // fresh generators, same seed → same first draw
});

test("stepRng is positional and reproducible", () => {
  const s = hashSeed("tidewater");
  assert.equal(stepRng(s, 7)(), stepRng(s, 7)());
  assert.notEqual(stepRng(s, 7)(), stepRng(s, 8)());
});

test("buildPiece is fully deterministic from its key", () => {
  const a = buildPiece("deepfield");
  const b = buildPiece("deepfield");
  assert.equal(a.seedInt, b.seedInt);
  assert.equal(a.rootHz, b.rootHz);
  assert.equal(a.period, b.period);
  assert.deepEqual(a.intervals, b.intervals);
});

test("different keys usually yield different pieces", () => {
  const keys = ["aurora", "deepfield", "tidewater", "glassrain", "monolith", "petrichor"];
  const roots = new Set(keys.map((k) => buildPiece(k).rootHz.toFixed(4)));
  assert.ok(roots.size >= 5, "expected variety of roots across named keys");
});

test("intervals: start at unison, ascending, inside one period, at least four", () => {
  for (const k of ["aurora", "deepfield", "tidewater", "glassrain", "monolith", "petrichor", "x", "42"]) {
    const p = buildPiece(k);
    assert.ok(Math.abs(p.intervals[0] - 1) < 1e-9, `${k}: first interval is unison`);
    assert.ok(p.intervals.length >= 4, `${k}: at least four intervals`);
    for (let i = 1; i < p.intervals.length; i++) {
      assert.ok(p.intervals[i] > p.intervals[i - 1], `${k}: strictly ascending`);
    }
    assert.ok(p.intervals[p.intervals.length - 1] < p.period, `${k}: top interval below the period`);
  }
});

test("root frequency stays in a sane low, audible range", () => {
  for (const k of ["aurora", "deepfield", "tidewater", "glassrain", "monolith", "petrichor"]) {
    const { rootHz } = buildPiece(k);
    assert.ok(rootHz >= 40 && rootHz <= 85, `${k}: root ${rootHz} in range`);
  }
});

test("freqAt is strictly increasing and periodic", () => {
  const p = buildPiece("aurora");
  const n = p.intervals.length;
  for (let i = -n; i < 2 * n; i++) {
    assert.ok(freqAt(p, i + 1) > freqAt(p, i), `index ${i} increasing`);
  }
  // Advancing by one full period multiplies frequency by the period ratio.
  assert.ok(Math.abs(freqAt(p, n) - freqAt(p, 0) * p.period) < 1e-6);
});

test("gamutFreqs spans the requested periods, ascending", () => {
  const p = buildPiece("monolith");
  const g = gamutFreqs(p, 0, 3);
  assert.equal(g.length, p.intervals.length * 3);
  for (let i = 1; i < g.length; i++) assert.ok(g[i] >= g[i - 1]);
});

test("a random key builds a valid piece", () => {
  // Seeded rand so the test itself is deterministic.
  const rand = mulberry32(999);
  const key = randomKey(rand);
  assert.match(key, /^[a-z]+-[a-z]+-\d{2}$/);
  const p = buildPiece(key);
  assert.ok(p.intervals.length >= 4 && p.rootHz > 0);
});

test("clamp and lerp", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(lerp(0, 10, 2), 10);
  assert.equal(makeRng("k")(), makeRng("k")());
});
