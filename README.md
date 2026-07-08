# infinite-ambient

> **Version:** 0.2.0

An infinite stream of ambient music, endlessly customizable — generated live in your browser.

**▶ Live: https://cportka.github.io/infinite-ambient/**

No accounts, no uploads, no audio files, no repeats. A **key** (any string) unlocks a piece: hashed,
it seeds the root, the intervals, and the whole evolution, so the same key recreates the same piece
note-for-note. Share the key, share the piece. A small Web Audio engine layers a microtonal drone,
evolving pads, a soft bass, an interval-leaping arpeggio, and sparse bells over a slow pulse.

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

- **Truly generative & deterministic** — every note is scheduled live from the key; nothing is
  pre-recorded, it never repeats, yet it's perfectly reproducible.
- **Five voices** — microtonal beating drone, pads, bass, an interval arpeggio, and bells.
- **Named keys** — Aurora, Deep Field, Tidewater, Glass Rain, Monolith, Petrichor — plus type-your-own
  and a randomiser.
- **Live controls** — Motion, Shimmer, Brightness, Space (reverb), Pace, Volume.
- **Reactive visuals** — an aurora canvas that breathes with the audio.
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
index.html            entry point
styles.css            interface styling
src/
  main.js             wires engine + visualizer + controls
  audio/
    engine.js         lookahead scheduler + voice synthesis
    piece.js          seed → deterministic microtonal piece (unit-tested)
    reverb.js         synthesised convolution impulse
    presets.js        curated named keys
  ui/
    controls.js       DOM <-> engine bindings
    visualizer.js     canvas aurora driven by the analyser
tests/                node --test suite + version sync
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
