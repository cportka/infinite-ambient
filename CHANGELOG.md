# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

## [0.2.0] - 2026-07-08

### Added
- **The Key.** A piece is now unlocked by a *key* — any string. Hashed, it seeds
  the root, the intervals, and the entire evolution, so the same key recreates
  the same piece note-for-note. Type one, roll a new one, or share yours.
- **Interval-first, microtonal engine.** Western scales and key/note selection are
  gone. Pitch material is built from frequency *ratios* — either an equal division
  of a period (often non-12: 5, 7, 13, 17… EDO) with a coprime generator stacked
  into a moment-of-symmetry scale, or a just-intonation subset reaching into the
  7- and 11-limit. Roots are continuous (off the A440 grid) and periods can be
  stretched octaves or the 3/1 tritave.
- **Arpeggio voice** that leaps by interval through the gamut, with a **Motion**
  control for density.
- **Shimmer** control widening the microtonal beating of the drone and pads.
- Deterministic, positional per-step scheduling (`stepRng`) so evolution is
  reproducible from the key.

### Changed
- Replaced the Key/Scale dropdowns with a Key field + named-key chips.
- Renamed Density → Motion; music-theory terminology removed from the UI.

### Removed
- `src/audio/scales.js` (Western scales/note-name model) and its test.

## [0.1.0] - 2026-07-07

### Added
- Generative ambient engine (Web Audio): a lookahead scheduler driving four voice layers — drone,
  evolving chord pads, soft bass, and sparse bell tones — over a slow pulse, with harmony that
  drifts through the current scale and occasional key/scale shifts so the stream never repeats.
- Pure, unit-tested music-theory helpers (scales, chords, MIDI/frequency conversion).
- Six mood presets (Nebula, Sunrise, Undertow, Glass, Dusk, Reverie) and live controls for
  Density, Brightness, Space, Pace, Volume, Key, and Scale, plus a "New atmosphere" randomizer.
- Reactive aurora visualizer driven by an AnalyserNode; glassy, responsive UI.
- Portka standard scaffold via repo-bootstrap: branch-per-change workflow (`.claude/CLAUDE.md`),
  an enforced SemVer version sync (`tests/run-tests.sh` + `node --test`), and CI.
- GitHub Pages deployment from `main` (`.github/workflows/pages.yml`).
