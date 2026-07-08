// conductor.test.mjs — the Conductor coordinates instruments but its harmonic
// frame is pure and deterministic from the key. We exercise that here with a tiny
// audio stub (no Web Audio in Node); the audio graph itself is covered by the
// in-browser verification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Conductor } from "../src/audio/conductor.js";

// Minimal stand-in for the shared audio system the Conductor reads at construction.
function stubAudio() {
  return {
    ctx: { currentTime: 0 },
    analyser: { frequencyBinCount: 512, getByteFrequencyData() {} },
  };
}

// The deterministic harmonic-centre walk for a key over n bars.
function walk(key, n) {
  const c = new Conductor(stubAudio());
  c.setKey(key);
  const seq = [];
  for (let i = 0; i < n; i++) {
    c._advanceHarmony(0, i);
    seq.push(c.centerIndex);
  }
  return seq;
}

test("setKey rebuilds a deterministic shared piece", () => {
  const a = new Conductor(stubAudio());
  const b = new Conductor(stubAudio());
  a.setKey("aurora");
  b.setKey("aurora");
  assert.equal(a.piece.seedInt, b.piece.seedInt);
  assert.equal(a.piece.rootHz, b.piece.rootHz);
  assert.deepEqual(a.piece.intervals, b.piece.intervals);
});

test("the harmonic-centre walk is reproducible from the key", () => {
  assert.deepEqual(walk("aurora", 24), walk("aurora", 24));
  assert.deepEqual(walk("monolith", 24), walk("monolith", 24));
});

test("different keys generally walk differently", () => {
  assert.notDeepEqual(walk("aurora", 24), walk("monolith", 24));
});

test("the first bar does not move the centre (it establishes it)", () => {
  const c = new Conductor(stubAudio());
  c.setKey("tidewater");
  c._advanceHarmony(0, 0);
  assert.equal(c.centerIndex, 0);
});

test("freq / gamut / chord return sane, ordered pitches", () => {
  const c = new Conductor(stubAudio());
  c.setKey("glassrain");
  assert.ok(c.freq(0) > 0);
  assert.ok(c.freq(5) > c.freq(0)); // ascending
  const g = c.gamut(0, 3);
  assert.equal(g.length, c.piece.intervals.length * 3);
  for (let i = 1; i < g.length; i++) assert.ok(g[i] >= g[i - 1]);
  const chord = c.chord(3, 1);
  assert.equal(chord.length, 3);
  assert.ok(chord.every((f) => f > 0));
});

test("pub/sub delivers events and a bad handler can't break others", () => {
  const c = new Conductor(stubAudio());
  let got = null;
  c.on("key", () => { throw new Error("boom"); }); // must be swallowed
  c.on("key", (p) => { got = p.key; });
  c.setKey("petrichor");
  assert.equal(got, "petrichor");
});
