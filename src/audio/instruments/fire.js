// fire.js — an element. A breathing bed of roar, constant warm crackle, and the
// occasional flame licking up. Continuous roar layer (built in onStart) + crackle
// grains and sparse flares scheduled on the pulse.

import { Instrument } from "../instrument.js";
import { stepRng, clamp, lerp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT_CRACK = 0x0c0ffee;
const SALT_FLARE = 0xf1a5e;

export const meta = {
  id: "fire",
  code: "fr",
  name: "Fire",
  role: "element",
  hue: 15, // red-orange
  gain: 0.9,
  blurb: "A breathing bed of roar, constant crackle, and flames licking up.",
  params: [
    { key: "roar", label: "Roar", min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: "crackle", label: "Crackle", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "flare", label: "Flare", min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
};

export class Fire extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this._noise = noiseBuffer(this.ctx, 4);
    this.bed = null;
  }

  onMount() {
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() { return 2200; }

  // The roar level the bed rides at for a given `roar` param.
  _roarLevel(roar) { return 0.5 + 0.55 * roar; }

  onStart() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const roar = this.params.roar;

    // One breathing bus the whole roar rides on.
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.0001;
    roarGain.gain.linearRampToValueAtTime(this._roarLevel(roar), t + 2.0);
    roarGain.connect(this.output);

    const srcs = [];
    const lfos = [];

    // Two decorrelated roar layers: broadband low-mid hiss shaped by a lowpass
    // (this is where the body of the roar lives), each brightening as it breathes,
    // panned apart for width.
    const layer = (offset, cut, pan) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = cut; lp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.5;
      const flfo = ctx.createOscillator(); flfo.frequency.value = 0.17 + offset * 0.03;
      const flfoG = ctx.createGain(); flfoG.gain.value = cut * 0.3;
      flfo.connect(flfoG); flfoG.connect(lp.frequency); flfo.start(t);
      src.connect(lp); lp.connect(g);
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; g.connect(panner); panner.connect(roarGain); }
      else g.connect(roarGain);
      src.start(t, offset);
      srcs.push(src); lfos.push(flfo);
    };
    layer(0, 700, -0.35);
    layer(1.3, 520, 0.35);

    // Deep chest body — a sub rumble under the hiss.
    const body = ctx.createBufferSource();
    body.buffer = this._noise; body.loop = true;
    const lpBody = ctx.createBiquadFilter();
    lpBody.type = "lowpass"; lpBody.frequency.value = 130; lpBody.Q.value = 0.5;
    const bodyGain = ctx.createGain(); bodyGain.gain.value = 0.7;
    body.connect(lpBody); lpBody.connect(bodyGain); bodyGain.connect(roarGain);
    body.start(t, 0.5); srcs.push(body);

    // Irregular breath (two LFOs) around the base level.
    const b1 = ctx.createOscillator(); b1.frequency.value = 0.15;
    const b1g = ctx.createGain(); b1g.gain.value = 0.28 * roar;
    const b2 = ctx.createOscillator(); b2.frequency.value = 0.37;
    const b2g = ctx.createGain(); b2g.gain.value = 0.15 * roar;
    b1.connect(b1g); b2.connect(b2g);
    b1g.connect(roarGain.gain); b2g.connect(roarGain.gain);
    b1.start(t); b2.start(t);
    lfos.push(b1, b2);

    this.bed = { roarGain, srcs, lfos };
  }

  onStop() {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.roarGain.gain.cancelScheduledValues(t);
    this.bed.roarGain.gain.setTargetAtTime(0.0001, t, 0.5);
    const stopAt = t + 1.8;
    for (const s of this.bed.srcs) { try { s.stop(stopAt); } catch (_) {} }
    for (const l of this.bed.lfos) { try { l.stop(stopAt); } catch (_) {} }
    this.bed = null;
  }

  onParam(name, value) {
    if (name === "roar" && this.bed) {
      const t = this.ctx.currentTime;
      this.bed.roarGain.gain.setTargetAtTime(this._roarLevel(value), t, 0.4);
    }
  }

  _onPulse(p) {
    if (!this._active) return;
    const field = this.conductor.field;

    // Crackle — many tiny warm pops, fire crackles constantly.
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT_CRACK, p.index);
    const n = clamp(Math.floor(lerp(2, 14, this.params.crackle) * (0.6 + 0.8 * field.density)), 0, 20);
    for (let i = 0; i < n; i++) {
      this._pop(p.when + rng() * p.stepDur, rng);
    }
    this.conductor.report(this.id, { density: 0.2 + this.params.crackle * 0.4 });

    // Flare — a rising whoosh, sparse, favouring the gaps.
    const rng2 = stepRng(this.conductor.piece.seedInt ^ SALT_FLARE, p.barIndex);
    const check = p.isBarStart || p.beatInBar === 2;
    if (check && rng2() < lerp(0.04, 0.5, this.params.flare) * (1 - 0.5 * field.energy)) {
      this._flare(p.when + rng2() * p.stepDur, rng2);
    }
  }

  _pop(when, rng) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + rng() * 0.8;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rng() < 0.12 ? 2400 + rng() * 600 : lerp(600, 1800, rng());
    bp.Q.value = 4 + rng() * 4;
    const g = ctx.createGain();
    const decay = 0.02 + rng() * 0.03;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.02 + rng() * 0.03, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = rng() * 2 - 1; g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + 0.09;
    src.start(when, rng() * 2);
    src.stop(stopAt);
    this._cleanup(g, stopAt);
  }

  _flare(when, rng) {
    const ctx = this.ctx;
    const dur = 1.2 + rng() * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(200, when);
    bp.frequency.exponentialRampToValueAtTime(1200, when + dur * 0.65);
    bp.frequency.exponentialRampToValueAtTime(300, when + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(400, when);
    lp.frequency.exponentialRampToValueAtTime(2500, when + dur * 0.65);
    lp.frequency.exponentialRampToValueAtTime(600, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.11, when + 0.4);
    g.gain.setValueAtTime(0.11, when + dur * 0.5);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(lp); lp.connect(g);
    if (pan) { pan.pan.setValueAtTime(-0.3, when); pan.pan.linearRampToValueAtTime(0.3, when + dur); g.connect(pan); pan.connect(this.output); }
    else g.connect(this.output);
    const stopAt = when + dur + 0.1;
    src.start(when);
    src.stop(stopAt);
    this._cleanup(g, stopAt);
    this.announce(lerp(180, 520, rng()), when, 0.8, "flare", null);
  }
}
