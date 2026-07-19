// wind.js — an element. Howling gusts whistling through the gaps. A continuous
// bed of two sweeping resonant "howl" layers over an airy hiss, breathing on a
// slow gust LFO (built in onStart); stronger swelling gusts and faint pitched
// whistles scheduled on the pulse.

import { Instrument } from "../instrument.js";
import { stepRng, clamp, lerp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT_GUST = 0x9057;
const SALT_WHISTLE = 0x3115;
const SALT_NOISE = 0xa1d0;

export const meta = {
  id: "wind",
  code: "wi",
  name: "Wind",
  role: "element",
  hue: 160, // seafoam
  gain: 1.1, // a howling element — lifted so it sits with Fire/Water in the mix
  blurb: "Howling gusts, whistling through the gaps.",
  params: [
    { key: "gust", label: "Gust", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "howl", label: "Howl", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "whistle", label: "Whistle", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
};

const WHISTLE_STEPS = [0, 2, 3, 5, 7];

export class Wind extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this._noise = noiseBuffer(this.ctx, 4, mulberryFromSeed(conductor.piece.seedInt ^ SALT_NOISE), 2);
    this.center = 0;
    this.bed = null;
  }

  onMount() {
    this.listen("harmony", (h) => { this.center = h.centerIndex; });
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() { return 2500; }

  // The level gustGain rides at, and the breathing depth around it, for a `gust`.
  _gustBase(gust) { return 0.4 + 0.28 * gust; }
  _gustDepth(gust) { return 0.12 + 0.22 * gust; }

  onStart() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const gust = this.params.gust;
    const howl = this.params.howl;

    // One breathing bus the whole howl rides on.
    const gustGain = ctx.createGain();
    gustGain.gain.value = 0.0001;
    gustGain.gain.linearRampToValueAtTime(this._gustBase(gust), t + 2.2);
    gustGain.connect(this.output);

    const srcs = [];
    const lfos = [];
    const layerGains = [];

    // Two decorrelated howl layers: looping noise through a resonant bandpass
    // whose centre frequency slowly sweeps via an LFO between ~300 and ~1500 Hz
    // (different rates/ranges per layer), panned apart for width.
    const howlLayer = (offset, base, span, rate, pan) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = base; bp.Q.value = 3 + 3 * howl;
      const swp = ctx.createOscillator(); swp.frequency.value = rate;
      const swpG = ctx.createGain(); swpG.gain.value = span;
      swp.connect(swpG); swpG.connect(bp.frequency); swp.start(t);
      const g = ctx.createGain(); g.gain.value = 0.32 + 0.4 * howl;
      src.connect(bp); bp.connect(g);
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; g.connect(panner); panner.connect(gustGain); }
      else g.connect(gustGain);
      src.start(t, offset);
      srcs.push(src); lfos.push(swp); layerGains.push(g);
    };
    howlLayer(0, 620, 320, 0.09, -0.4);
    howlLayer(1.7, 780, 460, 0.13, 0.4);

    // Broadband air — noise through a highpass so an airy hiss sits under the
    // howl at a gentle, steady level.
    const air = ctx.createBufferSource();
    air.buffer = this._noise; air.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 600; hp.Q.value = 0.6;
    const airGain = ctx.createGain(); airGain.gain.value = 0.14;
    air.connect(hp); hp.connect(airGain); airGain.connect(gustGain);
    air.start(t, 0.5); srcs.push(air);

    // Slow gust breath — two LFOs modulating the bus around its base level.
    const b1 = ctx.createOscillator(); b1.frequency.value = 0.08;
    const b1g = ctx.createGain(); b1g.gain.value = this._gustDepth(gust);
    const b2 = ctx.createOscillator(); b2.frequency.value = 0.11;
    const b2g = ctx.createGain(); b2g.gain.value = this._gustDepth(gust) * 0.55;
    b1.connect(b1g); b2.connect(b2g);
    b1g.connect(gustGain.gain); b2g.connect(gustGain.gain);
    b1.start(t); b2.start(t);
    lfos.push(b1, b2);

    this.bed = { gustGain, srcs, lfos, layerGains, breathG: [b1g, b2g] };
  }

  onStop() {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.gustGain.gain.cancelScheduledValues(t);
    this.bed.gustGain.gain.setTargetAtTime(0.0001, t, 0.6);
    const stopAt = t + 2.0;
    for (const s of this.bed.srcs) { try { s.stop(stopAt); } catch (_) {} }
    for (const l of this.bed.lfos) { try { l.stop(stopAt); } catch (_) {} }
    this.bed = null;
  }

  onParam(name, value) {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    if (name === "gust") {
      this.bed.gustGain.gain.setTargetAtTime(this._gustBase(value), t, 0.4);
      const depth = this._gustDepth(value);
      this.bed.breathG[0].gain.setTargetAtTime(depth, t, 0.4);
      this.bed.breathG[1].gain.setTargetAtTime(depth * 0.55, t, 0.4);
    } else if (name === "howl") {
      for (const g of this.bed.layerGains) g.gain.setTargetAtTime(0.32 + 0.4 * value, t, 0.4);
    }
  }

  _onPulse(p) {
    if (!this._active) return;
    const field = this.conductor.field;

    // Gusts — sparse, seeded, favouring the calm (low field.energy).
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT_GUST, p.index);
    const chance = lerp(0.06, 0.34, this.params.gust) * (1 - 0.55 * field.energy);
    if (rng() < chance) {
      const when = p.when + rng() * p.stepDur;
      this._gust(when, rng);
      // During some gusts, a faint whistle streaks through the gaps.
      if (this.params.whistle > 0 && rng() < 0.35 + 0.4 * this.params.whistle) {
        const rngW = stepRng(this.conductor.piece.seedInt ^ SALT_WHISTLE, p.index);
        const idx = this.center + WHISTLE_STEPS[Math.floor(rngW() * WHISTLE_STEPS.length)];
        const mul = rngW() < 0.5 ? 2 : 4;
        this._whistle(when + rngW() * 0.2, this.conductor.freq(idx) * mul, idx, rngW);
      }
    }
    this.conductor.report(this.id, { density: 0.15 + this.params.gust * 0.4 });
  }

  // A stronger gust — a swelling bandpass sweep up in frequency with a level
  // bump, then easing back down over ~1-2.5s.
  _gust(when, rng) {
    const ctx = this.ctx;
    const dur = 1.0 + rng() * 1.5;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 2.5 + rng() * 2.5;
    const lo = 320 + rng() * 200;
    const hi = 1100 + rng() * 700;
    bp.frequency.setValueAtTime(lo, when);
    bp.frequency.exponentialRampToValueAtTime(hi, when + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(lo, when + dur);
    const peak = 0.1 + 0.12 * this.params.gust + rng() * 0.05;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + dur * 0.45);
    g.gain.setValueAtTime(peak, when + dur * 0.55);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(g);
    if (pan) {
      pan.pan.setValueAtTime((rng() * 2 - 1) * 0.5, when);
      pan.pan.linearRampToValueAtTime((rng() * 2 - 1) * 0.5, when + dur);
      g.connect(pan); pan.connect(this.output);
    } else g.connect(this.output);
    const stopAt = when + dur + 0.1;
    src.start(when, rng() * 2);
    src.stop(stopAt);
    this._cleanup(g, stopAt);
    this.announce(lerp(200, 600, rng()), when, 0.7, "gust", null);
  }

  // A faint pitched whistle a couple registers up, fading in and out.
  _whistle(when, f, idx, rng) {
    const ctx = this.ctx;
    const dur = 0.6 + rng() * 0.9;
    const osc = ctx.createOscillator();
    osc.type = rng() < 0.5 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(f * (0.985 + rng() * 0.03), when);
    osc.frequency.linearRampToValueAtTime(f * (0.99 + rng() * 0.03), when + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 8;
    const peak = (0.02 + 0.05 * this.params.whistle) * (0.6 + rng() * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = (rng() * 2 - 1) * 0.6; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + dur + 0.1;
    osc.start(when); osc.stop(stopAt);
    this._cleanup(g, stopAt);
    this.announce(f, when, 0.4, "whistle", idx);
  }
}

function mulberryFromSeed(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
