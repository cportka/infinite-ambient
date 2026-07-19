// rain.js — a texture. Steady rainfall: a continuous bright broadband hiss/wash
// bed (rain on a surface), a myriad of tiny drop TICKS pattering on the pulse, and
// occasional larger resonant drips that ring a pitch from the gamut. Distinct from
// Water's low flowing brook — this is airy, high, and diffuse. Continuous bed in
// onStart; patter/drips scheduled on the pulse, all seeded from the key.

import { Instrument } from "../instrument.js";
import { stepRng, clamp, lerp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT_PATTER = 0x7a1f;
const SALT_DRIP = 0x2d09;
const SALT_NOISE = 0x5e6c;

export const meta = {
  id: "rain",
  code: "rn",
  name: "Rain",
  role: "texture",
  hue: 225, // slate-blue
  gain: 0.5, // a texture wash — kept well under the beds so it never dominates
  blurb: "Soft patter and hiss over a room.",
  params: [
    { key: "patter", label: "Patter", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "hiss", label: "Hiss", min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: "drips", label: "Drips", min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
};

// Gamut offsets the pitched drips reach for — a register or two above the centre.
const DRIP_STEPS = [-1, 0, 2, 3, 5, 7];

export class Rain extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.center = 0;
    this.bed = null;
    this._noise = noiseBuffer(this.ctx, 4, mulberryFromSeed(this.conductor.piece.seedInt ^ SALT_NOISE), 2);
  }

  onMount() {
    this.listen("harmony", (h) => { this.center = h.centerIndex; });
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() { return 2200; }

  // The level the hiss/wash bed rides at for a given `hiss` param.
  _hissLevel(hiss) { return 0.12 + 0.42 * hiss; }

  // ---- continuous hiss/wash bed -----------------------------------------

  onStart() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const hiss = this.params.hiss;

    // One breathing bus the whole rainfall rides on.
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.0001;
    hissGain.gain.linearRampToValueAtTime(this._hissLevel(hiss), t + 2.0);
    hissGain.connect(this.output);

    const srcs = [];
    const lfos = [];

    // Bright wash: looping noise → highpass with a slow filter breath, panned
    // wide. This is the sheeting hiss of rain on a surface — airy and broadband.
    const wash = (offset, cut, sweep, rate, pan) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = cut; hp.Q.value = 0.6;
      const flfo = ctx.createOscillator(); flfo.frequency.value = rate;
      const flfoG = ctx.createGain(); flfoG.gain.value = sweep;
      flfo.connect(flfoG); flfoG.connect(hp.frequency); flfo.start(t);
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(hp); hp.connect(g);
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; g.connect(panner); panner.connect(hissGain); }
      else g.connect(hissGain);
      src.start(t, offset);
      srcs.push(src); lfos.push(flfo);
    };
    wash(0, 1400, 550, 0.07, -0.4);
    wash(1.9, 1700, 650, 0.05, 0.4);

    // Parallel gentler broadband layer — a softer body under the bright hiss so
    // the wash has weight without turning into Water's low brook.
    const body = ctx.createBufferSource();
    body.buffer = this._noise; body.loop = true;
    const bhp = ctx.createBiquadFilter();
    bhp.type = "highpass"; bhp.frequency.value = 800; bhp.Q.value = 0.5;
    const blp = ctx.createBiquadFilter();
    blp.type = "lowpass"; blp.frequency.value = 5200; blp.Q.value = 0.5;
    const bodyGain = ctx.createGain(); bodyGain.gain.value = 0.34;
    body.connect(bhp); bhp.connect(blp); blp.connect(bodyGain); bodyGain.connect(hissGain);
    body.start(t, 0.6); srcs.push(body);

    // Slow master breath (~0.05 Hz) — the rainfall swells and eases.
    const breath = ctx.createOscillator(); breath.frequency.value = 0.05;
    const breathG = ctx.createGain(); breathG.gain.value = 0.1;
    breath.connect(breathG); breathG.connect(hissGain.gain); breath.start(t);
    lfos.push(breath);

    this.bed = { hissGain, srcs, lfos };
  }

  onStop() {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.hissGain.gain.cancelScheduledValues(t);
    this.bed.hissGain.gain.setTargetAtTime(0.0001, t, 0.5);
    const stopAt = t + 1.8;
    for (const s of this.bed.srcs) { try { s.stop(stopAt); } catch (_) {} }
    for (const l of this.bed.lfos) { try { l.stop(stopAt); } catch (_) {} }
    this.bed = null;
  }

  onParam(name, value) {
    if (name === "hiss" && this.bed) {
      this.bed.hissGain.gain.setTargetAtTime(this._hissLevel(value), this.ctx.currentTime, 0.3);
    }
  }

  // ---- pulse: patter ticks + occasional pitched drips --------------------

  _onPulse(p) {
    if (!this._active) return;
    const field = this.conductor.field;

    // Patter — many tiny drop ticks, rain always pattering.
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT_PATTER, p.index);
    const n = clamp(Math.floor(lerp(2, 18, this.params.patter) * (0.5 + 0.8 * field.density)), 0, 22);
    for (let i = 0; i < n; i++) this._tick(p.when + rng() * p.stepDur, rng);
    this.conductor.report(this.id, { density: 0.15 + this.params.patter * 0.5 });

    // Drips — occasional larger resonant plinks, pitched from the gamut.
    const rngD = stepRng(this.conductor.piece.seedInt ^ SALT_DRIP, p.index);
    if (rngD() < this.params.drips * 0.4) {
      const idx = this.center + DRIP_STEPS[Math.floor(rngD() * DRIP_STEPS.length)];
      const f = this.conductor.freq(idx) * (rngD() < 0.5 ? 2 : 4);
      this._drip(p.when + rngD() * p.stepDur, f, idx, rngD);
    }
  }

  // A tiny, very short drop tick — resonant noise burst high up.
  _tick(when, rng) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.loop = true;
    src.playbackRate.value = 0.9 + rng() * 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = lerp(1500, 6000, rng());
    bp.Q.value = 6 + rng() * 8;
    const g = ctx.createGain();
    const decay = 0.002 + rng() * 0.006;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.008 + rng() * 0.018, when + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = rng() * 2 - 1; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + 0.03;
    src.start(when, rng() * 2); src.stop(stopAt);
    this._cleanup(g, stopAt);
  }

  // A larger resonant drip — a short pitched plink with a quick pitch drop.
  _drip(when, f, idx, rng) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f * 1.22, when);
    osc.frequency.exponentialRampToValueAtTime(f, when + 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 11;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.09, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.2);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = (rng() * 2 - 1) * 0.5; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + 0.26;
    osc.start(when); osc.stop(stopAt);
    this._cleanup(g, stopAt);
    this.announce(f, when, 0.7, "drop", idx);
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
