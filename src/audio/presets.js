// presets.js — mood presets. Each is a bundle of engine parameters that, taken
// together, define a recognisable atmosphere. Sliders stay live after a preset
// loads, so a preset is a starting point, not a lock.

export const PRESETS = {
  nebula: {
    label: "Nebula",
    key: 9, // A
    scaleName: "pentatonicMinor",
    density: 0.28,
    brightness: 0.32,
    space: 0.85,
    pace: 0.2,
  },
  sunrise: {
    label: "Sunrise",
    key: 2, // D
    scaleName: "lydian",
    density: 0.5,
    brightness: 0.72,
    space: 0.6,
    pace: 0.42,
  },
  undertow: {
    label: "Undertow",
    key: 4, // E
    scaleName: "dorian",
    density: 0.34,
    brightness: 0.4,
    space: 0.78,
    pace: 0.24,
  },
  glass: {
    label: "Glass",
    key: 7, // G
    scaleName: "pentatonicMajor",
    density: 0.66,
    brightness: 0.82,
    space: 0.8,
    pace: 0.5,
  },
  dusk: {
    label: "Dusk",
    key: 0, // C
    scaleName: "minor",
    density: 0.3,
    brightness: 0.46,
    space: 0.74,
    pace: 0.28,
  },
  reverie: {
    label: "Reverie",
    key: 5, // F
    scaleName: "mixolydian",
    density: 0.48,
    brightness: 0.6,
    space: 0.66,
    pace: 0.4,
  },
};

export const DEFAULT_PRESET = "nebula";
