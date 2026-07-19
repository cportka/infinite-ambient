# infinite-ambient

> **Version:** 0.6.0

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
- **Surpeti** *(bed, rose)* — an Indian shruti-box reed drone: paired free-reed tones (Sa/Pa/Sa'/Ma)
  tuned to the root, harmonium buzz, beating, and a slow bellows breath. Visual: a breathing mandala.
- **Filament** *(lead, amber)* — Karplus-Strong plucked microtonal strings that answer the drone,
  echo (a **Melt** feedback delay), and melt into the bed. Visual: ripples in a puddle.
- **Music Box** *(lead, lavender)* — delicate struck-bell/celeste plinks: inharmonic sine partials
  with a long shimmering ring, answering the harmonic centre a register up. Visual: rising twinkles.
- **Water** *(element, blue)* — a flowing brook (filtered-noise bed), rising "bloop" bubbles, and
  pitched drips drawn from the gamut (they ring in tune and invite answers). Visual: flowing ripples
  + droplet rings.
- **Fire** *(element, red-orange)* — a breathing roar, constant warm crackle, and flames flaring up.
  Visual: bottom-rooted flame tongues + rising embers.
- **Wind** *(element, seafoam)* — howling gusts: swept resonant-bandpass noise over an airy hiss,
  breathing on a slow gust LFO, with faint pitched whistles through the gaps. Visual: blown streaks.
- **Electricity** *(texture, cyan)* — mains **hum**, ring-modulated **interference**, a **storm** of
  lightning + thunder, and **sawtooth jitter** magnetism. Visual: lightning bolts over a plasma field.
- **Rain** *(texture, slate)* — steady rainfall: a bright broadband hiss/wash, a myriad of tiny
  pattering drop ticks, and occasional pitched drips from the gamut. Visual: falling streaks + splashes.
- **Explosions** *(rhythm, amber-red)* — big saturated **blasts** (crack + swept rumble + deep sub +
  debris) and **shrapnel** trills (bursts of tiny crackle grains). Scale morphs slow ambient blasts ↔
  a fast shrapnel-crackle drum machine. Visual: shockwaves + scatter.

## The key

The **key** is a snapshot of your whole soundscape. At its simplest it's just a word — `aurora`,
`tidewater`, a random `vel-drin-42`, or anything you type — which deterministically seeds the
ensemble, so the same word always plays the same music from the same start.

But the key also **captures the entire configuration** — master volume, pace, and every open
instrument with its mute, level, and all its params — as a compact `seed~config` string that updates
**live** as you tweak the rack. Copy it (or the `#k=…` link) to save or share your exact setup;
paste one back to restore it note-for-note. Type a bare word and it just re-seeds the sound while
keeping your current rack. The encoding is versioned and references instruments by a permanent code,
so it stays **backwards-compatible** as new instruments and params are added (up to 12 instruments).

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
- **The key is your whole setup** — a live `seed~config` string (also a `#k=…` link) that captures
  volume, pace, and every instrument's mute/level/params; copy to save or share, paste to restore.
  Versioned and forwards-compatible (max 12 instruments).
- **Roll the dice** — each instrument has a 🎲 to re-roll just its own params (with a roll animation);
  the global 🎲 rolls a fresh seed. A fresh visit opens the drone plus a random handful of instruments.
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
    session.js                the key ⇄ whole-config encode/decode (versioned)
    noise.js                  shared seeded noise-buffer helper
    instruments/
      index.js                the instrument registry (drives the UI)
      infinite-drone.js       drone / bed — the aurora
      surpeti.js              shruti-box reed drone / bed
      filament.js             Karplus-Strong plucked strings — lead
      musicbox.js             struck bell/celeste plinks — lead
      water.js                brook / bubbles / drips — element
      fire.js                 roar / crackle / flares — element
      wind.js                 howling swept-noise gusts — element
      electricity.js          hum / interference / storm / jitter — texture
      rain.js                 hiss / patter / drips — texture
      explosions.js           blasts + shrapnel — rhythm
  version.js                  app version shown in the header
  ui/
    global-controls.js        shared key / transport / pace / volume / add
    pane.js                   one instrument's pane (visual + generic controls)
    pane-manager.js           panes + shared RAF + background compositor
    visuals/                  one <id>-visual.js per instrument + background.js
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
