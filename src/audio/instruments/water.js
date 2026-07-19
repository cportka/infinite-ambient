// water.js — an element. A flowing brook (filtered-noise bed), rising "bloop"
// bubbles, and pitched drips drawn from the shared gamut so they ring in tune and
// invite call-and-response. Continuous bed in onStart; bubbles/drips on the pulse.

import { Instrument } from "../instrument.js";
import { stepRng, clamp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT_BUB = 0x6b10;
const SALT_DRIP = 0x9c3f;

export const meta = {
  id: "water",
  code: "wa",
  name: "Water",
  role: "element",
  hue: 205, // blue
  gain: 0.9,
  blurb: "A brook — bubbles rise and drips ring in the gamut.",
  params: [
    { key: "flow", label: "Flow", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "bubbles", label: "Bubbles", min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: "drips", label: "Drips", min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
};

const DRIP_STEPS = [-2, 0, 3, 5, 7];

export class Water extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this._noise = noiseBuffer(this.ctx, 4, Math.random, 2);
    this.center = 0;
    this.bed = null;
  }

  onMount() {
    this.listen("harmony", (h) => { this.center = h.centerIndex; });
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() { return 2200; }

  onStart() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const flow = this.params.flow;

    const flowGain = ctx.createGain();
    flowGain.gain.value = 0.0001;
    flowGain.gain.linearRampToValueAtTime(0.35 + 0.5 * flow, t + 2.0);
    flowGain.connect(this.output);

    const lfos = [];
    // Two decorrelated brook layers (mid babble).
    const brook = (offset, detune, pan) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 1400 + detune; bp.Q.value = 1.2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
      const lfoG = ctx.createGain(); lfoG.gain.value = 650;
      lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start(t);
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(bp); bp.connect(g);
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; g.connect(panner); panner.connect(flowGain); }
      else g.connect(flowGain);
      src.start(t, offset);
      lfos.push(lfo);
      return { src, bp, lfoG };
    };
    const b1 = brook(0, 0, -0.4);
    const b2 = brook(1.7, 180, 0.4);

    // Low water rush.
    const rush = ctx.createBufferSource();
    rush.buffer = this._noise; rush.loop = true;
    const rlp = ctx.createBiquadFilter();
    rlp.type = "lowpass"; rlp.frequency.value = 380; rlp.Q.value = 0.7;
    const rlfo = ctx.createOscillator(); rlfo.frequency.value = 0.05;
    const rlfoG = ctx.createGain(); rlfoG.gain.value = 120;
    rlfo.connect(rlfoG); rlfoG.connect(rlp.frequency); rlfo.start(t);
    const rushGain = ctx.createGain(); rushGain.gain.value = 0.28;
    rush.connect(rlp); rlp.connect(rushGain); rushGain.connect(flowGain);
    rush.start(t, 0.5);
    lfos.push(rlfo);

    // Slow master breath.
    const breath = ctx.createOscillator(); breath.frequency.value = 0.03;
    const breathG = ctx.createGain(); breathG.gain.value = 0.12;
    breath.connect(breathG); breathG.connect(flowGain.gain); breath.start(t);
    lfos.push(breath);

    this.bed = { flowGain, b1, srcs: [b1.src, b2.src, rush], lfos };
  }

  onStop() {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.flowGain.gain.cancelScheduledValues(t);
    this.bed.flowGain.gain.setTargetAtTime(0.0001, t, 0.5);
    const stopAt = t + 1.8;
    for (const s of this.bed.srcs) { try { s.stop(stopAt); } catch (_) {} }
    for (const l of this.bed.lfos) { try { l.stop(stopAt); } catch (_) {} }
    this.bed = null;
  }

  onParam(name, value) {
    if (name === "flow" && this.bed) {
      const t = this.ctx.currentTime;
      this.bed.flowGain.gain.setTargetAtTime(0.35 + 0.5 * value, t, 0.3);
      this.bed.b1.lfoG.gain.setTargetAtTime(650 * (0.4 + 0.6 * value), t, 0.3);
    }
  }

  _onPulse(p) {
    if (!this._active) return;
    const field = this.conductor.field;

    // Bubbles.
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT_BUB, p.index);
    let count = Math.floor(this.params.bubbles * 3.2 + rng() * 1.5);
    if (field.density < 0.4) count += 1; // fill gaps
    for (let i = 0; i < count; i++) this._bubble(p.when + rng() * p.stepDur, rng);
    this.conductor.report(this.id, { density: this.params.bubbles * 0.5 + this.params.flow * 0.4 });

    // Drips — pitched, from the gamut.
    const rngD = stepRng(this.conductor.piece.seedInt ^ SALT_DRIP, p.index);
    if (rngD() < this.params.drips * 0.5) {
      const idx = this.center + DRIP_STEPS[Math.floor(rngD() * DRIP_STEPS.length)];
      const f = this.conductor.freq(idx) * (rngD() < 0.5 ? 4 : 8);
      this._drip(p.when + rngD() * p.stepDur, f, idx, rngD);
    }
  }

  _bubble(when, rng) {
    const ctx = this.ctx;
    const f0 = 260 + rng() * 900;
    const rise = 2.2 + rng() * 2.0;
    const dur = 0.05 + rng() * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, when);
    osc.frequency.exponentialRampToValueAtTime(f0 * rise, when + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f0 * 1.6; bp.Q.value = 5 + rng() * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.05 + rng() * 0.04, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = (rng() * 2 - 1) * 0.7; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + dur + 0.05;
    osc.start(when); osc.stop(stopAt);
    this._cleanup(g, stopAt);
  }

  _drip(when, f, idx, rng) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f * 1.18, when);
    osc.frequency.exponentialRampToValueAtTime(f, when + 0.028);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.11, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.18);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = (rng() * 2 - 1) * 0.5; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + 0.24;
    osc.start(when); osc.stop(stopAt);
    this._cleanup(g, stopAt);
    this.announce(f, when, 0.7, "drip", idx);
  }
}
