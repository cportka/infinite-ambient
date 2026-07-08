# infinite-ambient

> **Version:** 0.4.0

An infinite generative ambient **rack** — a set of instruments that play together and listen to
each other — generated live in your browser.

**▶ Live: https://cportka.github.io/infinite-ambient/**

No accounts, no uploads, no audio files, no repeats. A **key** (any string) seeds the whole
ensemble: hashed, it builds a shared microtonal piece — root, intervals, and a drifting harmonic
centre — that every instrument reads. Share the key, share the ensemble.

## The rack & the Conductor

Each instrument lives in its own **pane** with its own visual and controls; panes open, close, and
change, and instruments play at the same time. They never talk to each other directly — they talk
to the **Conductor**, which coordinates them across three channels:

- **Timing** — one shared lookahead clock broadcasts `pulse` and `harmony` events with
  sample-accurate times, so everyone locks to the same grid (some follow every pulse, some ride
  whole bars).
- **Pitch** — one shared tonal field: the key builds the piece and a harmonic centre drifts through
  it; instruments draw pitches from the shared gamut (so they're always consonant) and `announce`
  the notes they play, so others can **answer** or make room.
- **Timbre** — a shared energy/brightness/density field read from the master mix, so an instrument
  can duck when the mix is loud, brighten when it's dark, or **fill the gaps** when it's sparse.

A background compositor renders the whole ensemble (master analyser + every instrument's notes,
tinted by each instrument's hue); each pane's local visual is driven by the same events — the panes
feed the broader field and the field frames the panes.

## The instruments

- **Infinite Drone** *(bed, violet)* — the original engine: a microtonal beating pedal drone,
  evolving pads, soft bass, an interval-leaping arpeggio, and bells. Signature visual: the aurora.
- **Filament** *(lead, amber)* — Karplus-Strong plucked microtonal strings, timbrally the opposite
  of the drone. Locks to bars, answers the harmonic centre a register up, and reads the shared field
  to lay back or fill the gaps. A **Melt** control (filtered feedback delay) lets the plucks echo
  and blur into the bed. Visual: ripples in a puddle.
- **Electricity** *(texture, cyan)* — states of electricity: a mains **hum** tuned to the root,
  ring-modulated **interference**, a **storm** of lightning cracks + thunder, and **sawtooth jitter**
  magnetism. Visual: lightning bolts over an electric field.
- **Explosions** *(rhythm, amber-red)* — synthesised explosions on a continuum: super-slow **ambient
  booms** ↔ a fast **Rhythm-King-style drum machine**, with a melodic **arpeggiating explosive beat**
  in between (and a reverse "swallow" that sucks in before the blast). Visual: expanding shockwaves.

## The key

The **key** is just a string — `aurora`, `tidewater`, a random `vel-drin-42`, or anything you type.
It deterministically seeds the ensemble, so the same key always plays the same music from the same
start, a new key is a whole new ensemble, and copying your key hands someone exactly what you heard.

## Not Western scales

There are no note names, no C-major keys, no 12-tone grid. Pitch is built from frequency **ratios** —
intervals matter more than notes:

- an **equal division of a period** (often non-12: 5, 7, 13, 17… EDO) with a coprime generator
  stacked into a moment-of-symmetry scale, **or** a **just-intonation** subset reaching into the
  7- and 11-limit;
- **continuous roots** that float off the A440 grid, and periods that can be **stretched octaves**
  or the **3/1 tritave** (no octaves at all) — the source of the drone's microtonal shimmer.

## The key

The centrepiece is a single **key**. It's just a string — `aurora`, `tidewater`, a random
`vel-drin-42`, or anything you type. It deterministically seeds the entire piece, so:

- the same key always plays the same piece, from the same starting point;
- a new key is a whole new piece;
- copy your key and hand it to someone — they hear exactly what you heard.

## Not Western scales

There are no note names, no C-major keys, no 12-tone grid. Pitch is built from frequency **ratios** —
intervals matter more than notes:

- an **equal division of a period** (often non-12: 5, 7, 13, 17… EDO) with a coprime generator
  stacked into a moment-of-symmetry scale, **or** a **just-intonation** subset reaching into the
  7- and 11-limit;
- **continuous roots** that float off the A440 grid, and periods that can be **stretched octaves**
  or the **3/1 tritave** (no octaves at all) — the source of the drone's microtonal shimmer.

## Features

- **A rack, not a track** — multiple instruments play together, each in its own pane; add or close
  them live from the instrument menu.
- **Instruments that listen** — timing/pitch/timbre communication via the Conductor (call-and-response,
  gap-filling, shared harmonic motion).
- **Truly generative & deterministic** — every note is scheduled live from the shared key; nothing is
  pre-recorded, it never repeats, yet the harmonic frame is perfectly reproducible.
- **Named keys** — Aurora, Deep Field, Tidewater, Glass Rain, Monolith, Petrichor — plus type-your-own
  and a randomiser.
- **Zero dependencies, zero build** — plain ES modules + Web Audio. Static files, hostable
  anywhere. Works offline once loaded.

## Run locally

It's a static site — serve the folder over HTTP (ES modules don't load from `file://`):

```
npm start            # python3 -m http.server 8080
# then open http://localhost:8080
```

Press **space** (or the Play button) to start; audio begins on that first gesture, per the
browser autoplay policy.

## Project layout

```
index.html                    entry point
styles.css                    interface styling
src/
  main.js                     boots audio, conductor, panes, controls
  audio/
    context.js                shared AudioContext + master bus + reverb send
    conductor.js              shared clock + tonal field + note/timbre bus
    instrument.js             base Instrument (submix, params, lifecycle)
    piece.js                  seed → deterministic microtonal piece (unit-tested)
    reverb.js                 synthesised convolution impulse
    presets.js                curated named keys
    noise.js                  shared seeded noise-buffer helper
    instruments/
      index.js                the instrument registry (drives the UI)
      infinite-drone.js       instrument v1 — the bed
      filament.js             Karplus-Strong plucked strings — the lead
      electricity.js          hum / interference / storm / jitter — texture
      explosions.js           ambient booms ↔ drum machine — rhythm
  version.js                  app version shown in the header
  ui/
    global-controls.js        shared key / transport / pace / volume / add
    pane.js                   one instrument's pane (visual + generic controls)
    pane-manager.js           panes + shared RAF + background compositor
    visuals/
      background.js           whole-ensemble compositor
      drone-visual.js         the aurora
      filament-visual.js      the puddle ripples
      electricity-visual.js   lightning bolts
      explosions-visual.js    shockwaves
tests/                        node --test suite + version sync
```

## Development

This repo follows the **Portka standard workflow** (see `.claude/CLAUDE.md`): every change goes on
a branch, updates tests + CI, and merges on green. The version follows [SemVer](https://semver.org)
and stays in sync across `package.json`, `CHANGELOG.md`, and the `**Version:**` line above —
enforced by:

```
bash tests/run-tests.sh   # SemVer + CHANGELOG/README sync
npm test                  # node --test (unit tests + version sync)
```

## Deployment

Pushed to `main`, the site publishes to GitHub Pages automatically via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## License

MIT © Chris Portka
