// scales.js — pure music-theory helpers for the generative engine.
//
// No Web Audio, no DOM: everything here is a pure function of numbers, so the
// core note math can be unit-tested under `node --test`.

// Twelve pitch classes, indexed 0..11 starting at C.
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Curated scales that sit well under slow, overlapping pads. Each is a set of
// semitone offsets from the root, spanning one octave.
export const SCALES = {
  pentatonicMinor: { label: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
  pentatonicMajor: { label: "Pentatonic Major", intervals: [0, 2, 4, 7, 9] },
  minor: { label: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { label: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  lydian: { label: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { label: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  phrygian: { label: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  major: { label: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
};

// Standard equal-temperament conversion. MIDI 69 = A4 = 440 Hz.
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// The MIDI note for a pitch class in a given octave (C4 = MIDI 60).
export function noteToMidi(pitchClass, octave) {
  return (octave + 1) * 12 + pitchClass;
}

// Build the ascending MIDI notes of a scale across `octaves`, starting at the
// root pitch class in `baseOctave`. Returns a flat, sorted array.
export function scaleNotes(rootPitchClass, scaleName, baseOctave = 3, octaves = 3) {
  const scale = SCALES[scaleName] || SCALES.pentatonicMinor;
  const notes = [];
  for (let o = 0; o < octaves; o++) {
    for (const step of scale.intervals) {
      notes.push(noteToMidi(rootPitchClass, baseOctave + o) + step);
    }
  }
  return notes;
}

// Stack a triad-ish chord from a scale degree by taking every other scale tone
// (root, third, fifth) and wrapping into higher octaves as needed. `size` lets
// callers ask for richer stacks (add-9, etc.). Returns MIDI notes.
export function chordFromDegree(rootPitchClass, scaleName, degree, baseOctave = 3, size = 3) {
  const scale = SCALES[scaleName] || SCALES.pentatonicMinor;
  const len = scale.intervals.length;
  const notes = [];
  for (let i = 0; i < size; i++) {
    const idx = degree + i * 2;
    const octaveShift = Math.floor(idx / len);
    const interval = scale.intervals[((idx % len) + len) % len];
    notes.push(noteToMidi(rootPitchClass, baseOctave + octaveShift) + interval);
  }
  return notes;
}

// Clamp helper used across the UI → param mapping.
export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// Linear interpolation, used to map 0..1 UI sliders onto engine ranges.
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}
