# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

## [0.6.0] - 2026-07-19

### Added
- **Wind** — a new element: howling gusts from swept resonant-bandpass noise over
  an airy hiss, breathing on a slow gust LFO, with sparse swelling gusts and faint
  pitched whistles through the gaps. Blown-streak visual (seafoam).
- **Music Box** — a new lead: delicate struck bell/celeste plinks (inharmonic sine
  partials with a long shimmering ring and a tiny mechanical tick), answering the
  harmonic centre a register up and laying back when the mix is busy. Rising-twinkle
  visual (lavender).
- **Rain** — a new texture: a bright broadband hiss/wash, a myriad of tiny pattering
  drop ticks, and occasional pitched drips from the gamut. Falling-streak + splash
  visual (slate).
- **The key now captures the whole configuration.** A key is `seed~config`: the seed
  still seeds the generative piece, and the config encodes master volume, pace, and
  every open instrument (its type, mute, level, and all params). The key field updates
  **live** on any change to the rack, syncs to a shareable `#k=…` URL, and pasting a
  key (or opening a link) restores the exact soundscape. Typing a bare word re-seeds
  the sound but keeps the current rack. The encoding is versioned and references
  instruments by a permanent 2-char code, so it stays backwards-compatible as new
  instruments and params are added (`src/audio/session.js`, capped at 12 instruments).
- **Per-instrument dice.** Every pane has a 🎲 that re-rolls just that instrument's
  params, with a roll animation; the global 🎲 (Random) gets the same animation.

### Changed
- **On load, six instruments open** — always the Infinite Drone (the only one
  sounding) plus five random others (muted), so the opening is calm but a little
  different each visit. Add or close any from the instrument menu (max 12).

## [0.5.0] - 2026-07-08

### Added
- **Surpeti** — a new drone instrument: an Indian shruti-box / reed drone. Paired
  free-reed tones (Sa/Pa/Sa'/Ma) tuned to the shared root via the piece's own
  intervals, a soft-clip + formant reed timbre, characteristic beating, gentle
  vibrato, and a slow bellows breath. Breathing-mandala visual (rose).
- **Fire** — a new element: a breathing filtered-noise roar bed, constant warm
  crackle grains, and occasional flares licking up. Flame-tongue visual (red-orange).
- **Water** — a new element: a flowing brook bed, rising "bloop" bubbles, and
  pitched drips drawn from the gamut (they ring in tune and are announced for
  call-and-response). Flowing-ripple + droplet-ring visual (blue).

### Changed
- **Explosions reworked.** Big hits are now proper **blasts** — a broadband crack,
  a lowpass-swept saturated (waveshaper) rumble body, a deep pitch-diving sub, and
  a scattered debris tail — they actually boom. The little hits are now **shrapnel**:
  rhythmic bursts of tiny crackle grains (crinkle/titter/scatter) instead of drum
  snare/hat. The Scale continuum now runs slow ambient blasts ↔ a fast shrapnel-
  crackle drum machine.
- **On load:** all instruments open but only **Infinite Drone** sounds (the rest
  start muted), playback **auto-starts**, and the initial **volume is 50%**.
- **Key UI redesigned** for clarity: a labelled "Key" with a one-line explanation,
  a self-explanatory input (type + Enter, or blur), clearer **🎲 Random** / **Copy**
  buttons (no more cryptic "unlock"), and a "Starters" row of preset chips.

## [0.4.2] - 2026-07-08

### Fixed
- **Mix balance / audibility.** The three newer instruments were ~10× quieter than
  the drone (near-inaudible in the mix). Rebalanced levels (drone down a touch;
  Filament, Electricity, Explosions up substantially), softened the master limiter,
  nudged master volume up, and sped up the drone's fade-in so the ensemble is
  clearly audible the moment you press Play.
- **AudioContext resume** now also fires on the first user gesture anywhere (not
  just the Play button), as a safety for browsers that leave a page-load context
  suspended.

### Changed
- **All four instruments now open on load** (was drone + Filament only).
- **Distinct visuals again.** The shared "breathing field" base introduced in
  0.4.1 made every pane look alike; removed it. Each visual now has its own
  continuous motion: Filament back to puddle ripples, Electricity a breathing
  plasma core with constant crackle + bolts, Explosions a smouldering core with
  embers + shockwaves, drone keeps its aurora.

## [0.4.1] - 2026-07-08

### Fixed
- Electricity and Explosions now **pulse and breathe** like the drone. Electricity
  routes its continuous layers (hum/interference/jitter) through a slow breath LFO
  with a slow filter sweep on the hum; Explosions gains a continuous, slowly
  breathing low **rumble bed** beneath the hits.
- Their **visuals no longer go dead**: a shared always-animating "breathing field"
  base (a generalised aurora — flowing bands + a drifting, pulsing glow, tinted per
  instrument) now underlies Electricity, Explosions, and Filament, so every pane
  keeps moving and breathing even at rest, with the event-driven bolts / shockwaves
  / ripples layered on top.

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
