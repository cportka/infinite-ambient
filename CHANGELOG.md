# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

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
