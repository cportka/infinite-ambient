// musicbox.js — a delicate bell/celeste lead. Each note is a struck tine: three
// or four pure sine partials at inharmonic, bell-ish ratios, each with a fast
// attack and its own exponential decay (the fundamental rings longest), plus a
// tiny filtered-noise "tick" for the mechanical pluck. Long shimmering ring.
// Role: lead — timbrally the opposite of Filament's plucked Karplus strings.
//
// It uses two conductor channels the way Filament does:
//   TIMING  — ignores the fast pulse; locks to the bar (`harmony`) and, when
//             `motion` is high, subdivides the bar into a few plinks scheduled
//             sample-accurately off `when`.
//   PITCH   — call & response: it answers the shared harmonic centre a register
//             (or two) UP, walking an internal `arp` through the gamut with small
//             consonant leaps. Every pitch is a gamut index, so it stays in tune.
//   TIMBRE  — it reads the shared field: loud/busy mix → it lays back and rests
//             more; sparse mix → it fills the gaps and sparkles.
//
// Deterministic: whether-to-play, note count, the melodic walk, pans and the tick
// noise all come from stepRng(seedInt ^ SALT, barIndex), so a key recreates it.

import { Instrument } from "../instrument.js";
import { stepRng, mulberry32, clamp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT = 0xb0c5; // "box" — unique phrasing/voice stream
const SALT_NOISE = 0x7c1e; // deterministic tick-noise buffer

// Inharmonic bell partial ratios; the top two shift with `tone`.
const BASE_RATIOS = [1.0, 2.0, 3.01, 4.17];
const PARTIAL_GAIN = [1.0, 0.5, 0.28, 0.16];
// Small consonant gamut leaps for the internal arp walk.
const LEAPS = [2, 3, 4, -2, 1, -3, 5];
const STARTS = [0, 2, 4, 3];

export const meta = {
  id: "musicbox",
  name: "Music Box",
  role: "lead",
  hue: 285,
  gain: 0.95,
  code: "mb",
  blurb: "Delicate bell plinks with a long shimmer.",
  params: [
    { key: "motion", label: "Motion", min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: "ring", label: "Ring", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "tone", label: "Tone", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.45 },
  ],
};

export class MusicBox extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.center = 0;
    this.arp = null; // absolute gamut index we're walking
    this.recent = []; // recent indices (avoid immediate doubling)
    this._noise = null;
  }

  onMount() {
    // A deterministic short noise buffer for the mechanical "tick" transient.
    this._noise = noiseBuffer(this.ctx, 0.5, mulberry32(this.conductor.piece.seedInt ^ SALT_NOISE), 1);
    this.listen("harmony", (h) => this._onBar(h));
  }

  // Purely event-driven: no continuous layer to tear down (cf. Filament).
  onStart() {}
  onStop() {}

  get tailMs() { return 2600; } // long ring-out before the graph is torn down

  _onBar(h) {
    if (!this._active) return;
    this.center = h.centerIndex;
    const piece = this.conductor.piece;
    const field = this.conductor.field;
    const rng = stepRng(piece.seedInt ^ SALT, h.barIndex);
    const motion = this.params.motion;

    // TIMBRE: fill gaps, lay back when the mix is loud/dense. Rest often — the
    // box should feel sparse and answering, not busy.
    const fill = clamp(1.15 - field.density * 0.7 - field.energy * 0.4, 0, 1.15);
    const playProb = clamp(0.4 + motion * 0.5, 0, 1) * (0.62 + 0.4 * fill);
    if (rng() > playProb) return; // rest — leave space

    // How many plinks this bar: 1, plus a couple more only when motion is high.
    const count = 1 + Math.floor(motion * 2.4 * fill * (0.6 + rng() * 0.6));
    this.conductor.report(this.id, { density: 0.12 + 0.24 * motion * fill });

    const period = piece.intervals.length;
    const barDur = this.conductor.stepDur * 4;

    // PITCH: answer the centre a register (sometimes two) up, then walk the arp.
    const register = period + (rng() < 0.32 ? period : 0);
    const anchor = this.center + register;
    if (this.arp == null || Math.abs(this.arp - anchor) > period) {
      this.arp = anchor + STARTS[Math.floor(rng() * STARTS.length)];
    }

    // TIMBRE: brighter body/velocity when the field is dark; laid back when loud.
    const velScale = 0.62 + 0.38 * (1 - field.energy);
    const bright = clamp(this.params.tone * 0.6 + (1 - field.brightness) * 0.4, 0, 1);

    for (let k = 0; k < count; k++) {
      if (k > 0) this.arp += LEAPS[Math.floor(rng() * LEAPS.length)];
      // Keep the walk within a couple registers of the answer point.
      if (this.arp > anchor + period + 2) this.arp -= period;
      if (this.arp < anchor - 2) this.arp += period;
      if (this.recent.includes(this.arp)) this.arp += 1; // avoid doubling
      const idx = this.arp;
      const freq = this.conductor.freq(idx);
      const when = h.when + (k / count) * barDur + rng() * 0.03;
      const velocity = (0.55 + rng() * 0.4) * velScale;
      const seed = (piece.seedInt ^ SALT ^ (h.barIndex * 131 + k * 977)) >>> 0;
      this._strike(freq, when, velocity, bright, seed);
      this.announce(freq, when, velocity, "box", idx);
      this.recent.push(idx);
      if (this.recent.length > 6) this.recent.shift();
    }
  }

  // One struck bell/tine: inharmonic sine partials + a tiny mechanical tick,
  // summed through a gentle lowpass "body" and a seeded stereo pan.
  _strike(freq, when, velocity, bright, seed) {
    const ctx = this.ctx;
    const rng = mulberry32(seed);
    const tone = this.params.tone;
    const ring = this.params.ring;
    const vel = clamp(velocity, 0, 1);

    // Body: a gentle lowpass so the higher partials sit softly under the fundamental.
    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = clamp(freq * 6 + 1200 + bright * 4200, 400, 14000);
    body.Q.value = 0.4;

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (rng() * 2 - 1) * 0.55;
      body.connect(panner);
      panner.connect(this.output);
    } else {
      body.connect(this.output);
    }
    const sink = panner || body; // node to _cleanup (last before output)

    // Top two partials drift inharmonically with `tone` for a glassier bell.
    const ratios = [
      BASE_RATIOS[0],
      BASE_RATIOS[1],
      BASE_RATIOS[2] + tone * 0.7,
      BASE_RATIOS[3] + tone * 1.3,
    ];
    // Fundamental rings longest; upper partials decay quicker. Scaled by `ring`.
    const decays = [
      1.2 + ring * 2.3,
      0.85 + ring * 1.5,
      0.5 + ring * 0.8,
      0.3 + ring * 0.5,
    ];
    const nPartials = 3 + (tone > 0.5 ? 1 : 0); // 4th partial only when tone is bright
    const base = 0.15 * vel; // modest — leads are boosted at the mix

    let maxEnd = when;
    for (let i = 0; i < nPartials; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratios[i] * (1 + (rng() - 0.5) * 0.001); // faint detune
      const g = ctx.createGain();
      const peak = base * PARTIAL_GAIN[i];
      const attack = 0.003 + rng() * 0.003;
      const decay = decays[i];
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + attack);
      // Exponential decay — never to 0: settle to a tiny floor, then it's cut.
      g.gain.exponentialRampToValueAtTime(0.0008, when + attack + decay);
      osc.connect(g);
      g.connect(body);
      const stopAt = when + attack + decay + 0.05;
      osc.start(when);
      osc.stop(stopAt);
      if (stopAt > maxEnd) maxEnd = stopAt;
      this._cleanup(g, stopAt);
    }

    // Mechanical "tick": a very short high-passed noise click, quiet.
    if (this._noise) {
      const tick = ctx.createBufferSource();
      tick.buffer = this._noise;
      tick.loop = false;
      const off = rng() * 0.4;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3600 + bright * 3000;
      const tg = ctx.createGain();
      const tPeak = 0.03 * vel;
      const tDur = 0.008;
      tg.gain.setValueAtTime(0, when);
      tg.gain.linearRampToValueAtTime(tPeak, when + 0.001);
      tg.gain.linearRampToValueAtTime(0, when + tDur); // linear-to-0 is fine
      tick.connect(hp);
      hp.connect(tg);
      tg.connect(body);
      const tStop = when + tDur + 0.02;
      tick.start(when, off, tDur + 0.01);
      tick.stop(tStop);
      this._cleanup(tg, tStop);
    }

    this._cleanup(sink, maxEnd);
  }
}
