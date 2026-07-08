// electricity.js — states of electricity, morphable with four knobs:
//   HUM          — a mains-like buzz (sawtooth fundamental + harmonics) tuned to
//                  the shared root, with a slow tremolo flicker.
//   INTERFERENCE — band-swept noise ring-modulated by a low oscillator: radio
//                  static / signal interference, with crackle pops on the pulse.
//   STORM        — lightning cracks (bright resonant noise bursts with a downward
//                  filter sweep) and, on the big ones, a low thunder rumble.
//   JITTER       — sawtooth magnetism: a resonant saw whose detune/filter jump in
//                  stairsteps on every pulse, with occasional dropouts.
//
// Comm: cracks lock to the pulse (big ones favour energy peaks — thunder with the
// swell; small crackle fills the quiet), the hum tracks the shared root (pitch),
// and levels read the field (timbre). Cracks/jitter are seeded from the key.

import { Instrument } from "../instrument.js";
import { mulberry32, stepRng, clamp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT = 0xe1ec;

export const meta = {
  id: "electricity",
  name: "Electricity",
  role: "texture",
  hue: 190, // electric cyan
  gain: 0.55,
  blurb: "Thunder, hum, interference, and sawtooth magnetism.",
  params: [
    { key: "hum", label: "Hum", min: 0, max: 1, step: 0.01, default: 0.32 },
    { key: "interference", label: "Interference", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "storm", label: "Storm", min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: "jitter", label: "Jitter", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
};

export class Electricity extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.layers = null;
    this._noise = noiseBuffer(this.ctx, 4, mulberry32(this.conductor.piece.seedInt ^ SALT));
  }

  onMount() {
    this.listen("pulse", (p) => this._onPulse(p));
    this.listen("key", () => this._retuneHum());
  }

  onStart() {
    this._startLayers();
  }
  onStop() {
    this._stopLayers();
  }

  get tailMs() {
    return 2000; // layer gains fade (0.4s) + nodes stop (+1.6s) must ring out before disconnect
  }

  onParam(name, value) {
    if (!this.layers) return;
    const t = this.ctx.currentTime;
    if (name === "hum") this.layers.humGain.gain.setTargetAtTime(value * 0.11, t, 0.3);
    else if (name === "interference") this.layers.interGain.gain.setTargetAtTime(value * 0.09, t, 0.3);
    else if (name === "jitter") this.layers.jitGain.gain.setTargetAtTime(value * 0.06, t, 0.3);
  }

  _humFreq() {
    return clamp(this.conductor.piece.rootHz * 2, 50, 150);
  }

  // ---- continuous layers -------------------------------------------------

  _startLayers() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // HUM: sawtooth fundamental + two harmonics through a lowpass, with tremolo.
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    humGain.gain.setTargetAtTime(this.params.hum * 0.11, t, 1.2);
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 1400;
    humFilter.connect(humGain);
    humGain.connect(this.output);
    const f0 = this._humFreq();
    const humOscs = [];
    [[1, 0.6], [2, 0.3], [3, 0.16]].forEach(([mult, lvl]) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f0 * mult;
      const g = ctx.createGain();
      g.gain.value = lvl;
      osc.connect(g);
      g.connect(humFilter);
      osc.start(t);
      humOscs.push({ osc, mult });
    });
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.02;
    trem.connect(tremGain);
    tremGain.connect(humGain.gain);
    trem.start(t);

    // INTERFERENCE: looping noise → swept bandpass → ring modulation.
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._noise;
    noiseSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 4;
    const bpLfo = ctx.createOscillator();
    bpLfo.frequency.value = 0.18;
    const bpLfoGain = ctx.createGain();
    bpLfoGain.gain.value = 1200;
    bpLfo.connect(bpLfoGain);
    bpLfoGain.connect(bp.frequency);
    const ring = ctx.createGain();
    ring.gain.value = 0;
    const modOsc = ctx.createOscillator();
    modOsc.frequency.value = 110;
    const modDepth = ctx.createGain();
    modDepth.gain.value = 0.7;
    modOsc.connect(modDepth);
    modDepth.connect(ring.gain);
    const interGain = ctx.createGain();
    interGain.gain.value = this.params.interference * 0.09;
    noiseSrc.connect(bp);
    bp.connect(ring);
    ring.connect(interGain);
    interGain.connect(this.output);
    noiseSrc.start(t);
    bpLfo.start(t);
    modOsc.start(t);

    // JITTER: a resonant sawtooth (magnetism) restepped on the pulse.
    const jitSaw = ctx.createOscillator();
    jitSaw.type = "sawtooth";
    jitSaw.frequency.value = this.conductor.freq(2);
    const jitBp = ctx.createBiquadFilter();
    jitBp.type = "bandpass";
    jitBp.frequency.value = 800;
    jitBp.Q.value = 8;
    const jitGain = ctx.createGain();
    jitGain.gain.value = this.params.jitter * 0.06;
    jitSaw.connect(jitBp);
    jitBp.connect(jitGain);
    jitGain.connect(this.output);
    jitSaw.start(t);

    this.layers = {
      humGain, humFilter, humOscs, trem, tremGain,
      noiseSrc, bp, bpLfo, modOsc, interGain,
      jitSaw, jitBp, jitGain,
      nodes: [trem, bpLfo, modOsc, noiseSrc, jitSaw, ...humOscs.map((o) => o.osc)],
    };
  }

  _stopLayers() {
    if (!this.layers) return;
    const t = this.ctx.currentTime;
    const L = this.layers;
    for (const g of [L.humGain, L.interGain, L.jitGain]) g.gain.setTargetAtTime(0, t, 0.4);
    const stopAt = t + 1.6;
    for (const n of L.nodes) {
      try { n.stop(stopAt); } catch (_) {}
    }
    this.layers = null;
  }

  _retuneHum() {
    if (!this.layers) return;
    const f0 = this._humFreq();
    const t = this.ctx.currentTime;
    for (const { osc, mult } of this.layers.humOscs) osc.frequency.setTargetAtTime(f0 * mult, t, 1.2);
    this.layers.jitSaw.frequency.setTargetAtTime(this.conductor.freq(2), t, 1.2);
  }

  // ---- pulse: jitter step, crackle, cracks -------------------------------

  _onPulse(p) {
    if (!this._active) return;
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT, p.index);
    const field = this.conductor.field;

    if (this.layers) this._jitterStep(rng, p.when);

    // Interference crackle pops when interference is up.
    if (rng() < this.params.interference * 0.6) {
      this._crack(p.when + rng() * p.stepDur, false, rng, 0.6);
    }
    // Storm: big cracks favour energy peaks (thunder with the swell); small
    // crackle fills the quiet.
    const storm = this.params.storm;
    if (rng() < storm * 0.28 * (0.5 + field.energy)) {
      this._crack(p.when + rng() * p.stepDur * 0.5, true, rng, 1);
    }
    if (rng() < storm * 0.5 * (1.2 - field.energy)) {
      this._crack(p.when + rng() * p.stepDur, false, rng, 1);
    }
  }

  _jitterStep(rng, when) {
    const L = this.layers;
    const amt = this.params.jitter;
    L.jitSaw.detune.setValueAtTime((rng() * 2 - 1) * 1200 * amt, when);
    L.jitBp.frequency.setValueAtTime(300 + rng() * 3000 * (0.3 + amt), when);
    if (rng() < 0.25 * amt) {
      // brief magnetic dropout
      L.jitGain.gain.setValueAtTime(0, when);
      L.jitGain.gain.setTargetAtTime(this.params.jitter * 0.06, when + 0.04, 0.05);
    }
  }

  _crack(when, big, rng, scale) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = big ? 1.2 : 3;
    const g = ctx.createGain();
    const decay = (big ? 1.0 + rng() * 0.8 : 0.08 + rng() * 0.12) * scale;
    const peak = (big ? 0.5 : 0.16) * scale;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, when + decay);

    if (big) {
      // downward filter sweep — the crack tearing down into thunder
      bp.frequency.setValueAtTime(5000, when);
      bp.frequency.exponentialRampToValueAtTime(320, when + decay);
    } else {
      bp.frequency.setValueAtTime(2600 + rng() * 3500, when);
    }
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp);
    bp.connect(g);
    if (panner) {
      panner.pan.value = rng() * 1.4 - 0.7;
      g.connect(panner);
      panner.connect(this.output);
    } else {
      g.connect(this.output);
    }
    const stopAt = when + decay + 0.1;
    src.start(when);
    src.stop(stopAt);
    this._cleanup(g, stopAt);

    if (big) {
      this._thunder(when, rng);
      this.announce(this.conductor.piece.rootHz, when, 0.9, "thunder");
    } else {
      this.announce(1200 + rng() * 1600, when, 0.4, "crackle");
    }
  }

  _thunder(when, rng) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 130;
    lp.Q.value = 1;
    const g = ctx.createGain();
    const decay = 2.2 + rng() * 1.6;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.4, when + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.output);
    const stopAt = when + decay + 0.1;
    src.start(when);
    src.stop(stopAt);
    this._cleanup(g, stopAt);
  }
}
