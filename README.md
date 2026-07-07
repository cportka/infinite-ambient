# infinite-ambient

> **Version:** 0.1.0

An infinite stream of ambient music, endlessly customizable — generated live in your browser.

**▶ Live: https://cportka.github.io/infinite-ambient/**

No accounts, no uploads, no audio files, no repeats. A small generative engine built on the Web
Audio API layers a drone, evolving chord pads, a soft bass, and sparse bell tones over a slow
pulse; the harmony drifts through the current scale — and occasionally the key or scale itself
shifts — so the stream never resolves and never loops.

## Features

- **Truly generative** — every note is scheduled live; nothing is pre-recorded, so it plays
  forever without repeating.
- **Six mood presets** — Nebula, Sunrise, Undertow, Glass, Dusk, Reverie.
- **Live controls** — Density, Brightness, Space (reverb), Pace, Volume, plus Key and Scale.
- **New atmosphere** — one click reshuffles key, scale, and texture.
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
    scales.js         pure music-theory helpers (unit-tested)
    reverb.js         synthesised convolution impulse
    presets.js        mood parameter bundles
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
