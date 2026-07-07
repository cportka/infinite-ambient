// scales.test.mjs — unit tests for the pure music-theory helpers. These have no
// Web Audio / DOM dependency, so they run under `node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  midiToFreq,
  noteToMidi,
  scaleNotes,
  chordFromDegree,
  clamp,
  lerp,
  SCALES,
} from "../src/audio/scales.js";

test("A4 (MIDI 69) is 440 Hz", () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9);
});

test("an octave up doubles the frequency", () => {
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9);
});

test("C4 is MIDI 60", () => {
  assert.equal(noteToMidi(0, 4), 60);
});

test("scaleNotes spans the requested octaves and is strictly ascending", () => {
  const notes = scaleNotes(9, "pentatonicMinor", 3, 3); // A pentatonic minor, 3 octaves
  assert.equal(notes.length, SCALES.pentatonicMinor.intervals.length * 3);
  for (let i = 1; i < notes.length; i++) {
    assert.ok(notes[i] > notes[i - 1], `note ${i} should be higher than the previous`);
  }
});

test("scaleNotes starts on the root pitch class", () => {
  const notes = scaleNotes(9, "minor", 3, 1); // A minor
  assert.equal(notes[0] % 12, 9); // pitch class A
});

test("chordFromDegree stacks the requested number of tones, ascending", () => {
  const chord = chordFromDegree(0, "major", 0, 3, 3); // C major triad-ish
  assert.equal(chord.length, 3);
  assert.ok(chord[1] > chord[0] && chord[2] > chord[1]);
  assert.equal(chord[0] % 12, 0); // root is C
});

test("an unknown scale falls back instead of throwing", () => {
  const notes = scaleNotes(0, "does-not-exist", 3, 1);
  assert.equal(notes.length, SCALES.pentatonicMinor.intervals.length);
});

test("clamp bounds its input", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test("lerp interpolates and clamps t", () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(lerp(0, 10, 2), 10); // t clamped to 1
});
