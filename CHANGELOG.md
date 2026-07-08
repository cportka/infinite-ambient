# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

## [0.4.0] - 2026-07-08

### Added
- **New instrument — Electricity** (texture, cyan): a mains-like **hum** tuned to
  the shared root, ring-modulated noise **interference** with crackle, a **storm**
  of lightning cracks (big ones favour energy peaks and drop into a thunder rumble),
  and **sawtooth jitter** magnetism that re-steps on every pulse. Lightning-bolt
  visual with an idle electric field.
- **New instrument — Explosions** (rhythm, amber-red): synthesised explosions
  (noise burst + pitch-diving thump + sub boom, with an optional reverse "swallow").
  One **Scale** knob morphs super-slow ambient booms ↔ a fast Maestro Rhythm-King-
  style drum machine (kick / backbeat snare / offbeat hats); in between it's a
  melodic **arpeggiating explosive beat** across the gamut. Shockwave-ring visual.
- **Version badge** shown next to the header (`src/version.js`, kept in sync with
  package.json by a test).
- Shared seeded noise-buffer helper (`src/audio/noise.js`).

### Changed
- **Filament** now melts into the soundscape: a filtered **feedback delay** (new
  **Melt** control) and longer sustain, so plucks echo and blur into the bed. Its
  visual is now **ripples in a puddle** — expanding rings that linger and drift,
  with idle drops and a caustic shimmer so it keeps moving during near-silence.

## [0.3.1] - 2026-07-08

### Fixed
- Transport race: toggling play/pause during the first `audio.resume()` (the
  AudioContext starts suspended, so it genuinely awaits) could leave audio playing
  while the button/aria/`is-playing` all read paused. `setPlaying` now has a
  re-entrancy guard and commits state only after the work, painting the UI from
  it — so a double-click or held spacebar can't desync audio and controls.

## [0.3.0] - 2026-07-08

### Added
- **A rack of instruments.** The engine is now packaged as one instrument,
  **Infinite Drone** (v1), among many. Instruments play simultaneously through a
  shared audio system, each in its own **pane** with its own visual and controls;
  panes open, close, and change.
- **The Conductor** — a communication system so instruments listen to each other
  across three channels: **timing** (one shared lookahead clock broadcasting
  `pulse`/`harmony` events with sample-accurate `when` times), **pitch** (one
  shared tonal field — the key seeds a piece and a drifting harmonic centre every
  instrument reads and answers; instruments `announce` notes for call-and-response),
  and **timbre** (a shared energy/brightness/density field so an instrument can
  duck when the mix is loud or fill the gaps when it's sparse).
- **New instrument: Filament** — Karplus-Strong plucked microtonal strings (role:
  lead, amber). It ignores the fast pulse and locks to bars, answers the harmonic
  centre a register up with consonant offsets, and reads the shared field to lay
  back or fill gaps. Distinct constellation visual.
- **Shared visual story.** A background compositor renders the whole ensemble
  (master analyser + every instrument's note events, tinted by each instrument's
  hue); each pane's local visual is driven by the same events, so panes feed the
  broader field and the field frames the panes.
- Global controls: shared **Key** (seeds the ensemble), transport, pace, master
  volume, and an **add-instrument** menu generated from the registry.
- Deterministic conductor test suite (`tests/conductor.test.mjs`).

### Changed
- The Key is now shared by the whole ensemble; each instrument retunes to it.
- Reorganised `src/` into `audio/` (context, conductor, instrument base,
  `instruments/`) and `ui/` (panes, global controls, `visuals/`).

### Removed
- `src/audio/engine.js`, `src/ui/visualizer.js`, `src/ui/controls.js` — folded
  into the instrument/pane/conductor architecture.

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
