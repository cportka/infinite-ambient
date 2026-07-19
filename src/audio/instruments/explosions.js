// explosions.js — big BLASTS and SHRAPNEL. A blast is a broadband crack + a
// saturated lowpass-swept rumble body + a deep pitch-diving sub + a scattered
// debris tail — it thumps. Shrapnel is a rhythmic burst of tiny crackle grains
// (pieces cracking, crinkling, tittering, scattering), the little rhythmic part.
//
// One continuum via Scale: slow → huge ambient blasts; fast → a shrapnel-crackle
// drum machine. Blasts land on beats (melodic, from the gamut); shrapnel trills
// fill the offbeats/subdivisions. Plus a continuous breathing low rumble bed.

import { Instrument } from "../instrument.js";
import { stepRng, clamp, lerp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT = 0xb0053;

export const meta = {
  id: "explosions",
  name: "Explosions",
  role: "rhythm",
  hue: 20, // warm orange/red
  gain: 0.8,
  blurb: "Big booms and rhythmic shrapnel — slow ambient blasts to a crackle drum machine.",
  params: [
    { key: "scale", label: "Scale", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "pattern", label: "Pattern", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "pitch", label: "Pitch", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "boom", label: "Boom", min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.35 },
  ],
};

const VOICE = { kick: { dec: 0.55, peak: 0.9 }, boom: { dec: 1.0, peak: 0.85 } };

export class Explosions extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.center = 0;
    this.arp = 0;
    this._noise = noiseBuffer(this.ctx, 2.4, mulberryFromSeed(conductor.piece.seedInt ^ SALT));
    this._curve = tanhCurve(2.0 + 2.5 * this.params.boom);
  }

  onMount() {
    this.listen("harmony", (h) => { this.center = h.centerIndex; });
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() { return 4200; }

  onStart() { this._startBed(); }
  onStop() { this._stopBed(); }

  onParam(name, value) {
    if (name === "boom") {
      this._curve = tanhCurve(2.0 + 2.5 * value);
      if (this.bed) this.bed.g.gain.setTargetAtTime(0.035 * (0.4 + value), this.ctx.currentTime, 0.3);
    }
  }

  // Continuous smouldering low rumble.
  _startBed() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 120; lp.Q.value = 0.7;
    const g = ctx.createGain();
    const level = 0.035 * (0.4 + this.params.boom);
    g.gain.value = 0;
    g.gain.setTargetAtTime(level, t, 2.0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const depth = ctx.createGain(); depth.gain.value = level * 0.7;
    lfo.connect(depth); depth.connect(g.gain);
    const flfo = ctx.createOscillator(); flfo.frequency.value = 0.04;
    const fdepth = ctx.createGain(); fdepth.gain.value = 55;
    flfo.connect(fdepth); fdepth.connect(lp.frequency);
    src.connect(lp); lp.connect(g); g.connect(this.output);
    src.start(t); lfo.start(t); flfo.start(t);
    this.bed = { src, lp, g, lfo, flfo };
  }

  _stopBed() {
    if (!this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.g.gain.setTargetAtTime(0, t, 0.5);
    const stopAt = t + 2;
    for (const n of [this.bed.src, this.bed.lfo, this.bed.flfo]) { try { n.stop(stopAt); } catch (_) {} }
    this.bed = null;
  }

  _onPulse(p) {
    if (!this._active) return;
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT, p.index);
    const field = this.conductor.field;
    const scale = this.params.scale;
    const pattern = this.params.pattern;
    const groove = clamp(scale * 1.4, 0, 1);
    const subs = Math.max(1, Math.round(lerp(1, 8, scale)));
    const size = lerp(3.6, 0.09, scale);
    const period = this.conductor.piece.intervals.length;
    let dsum = 0;

    for (let k = 0; k < subs; k++) {
      const isBeat = k === 0;
      const beat = p.beatInBar;
      const when = p.when + (k / subs) * p.stepDur;

      if (isBeat) {
        let voice = null;
        if (beat % 2 === 0 && rng() < 0.55 + 0.4 * groove) voice = "kick";
        else if (beat % 2 === 1 && rng() < (0.3 + 0.6 * groove) * (0.4 + pattern)) voice = "boom";
        if (!voice && rng() < 0.22 * (1.2 - field.energy) * (0.4 + pattern)) voice = "boom";
        if (voice) {
          let idx;
          if (voice === "kick") idx = this.center - period;
          else {
            if (rng() < this.params.pitch) {
              const leap = [-2, -1, 1, 2, 3][Math.floor(rng() * 5)];
              this.arp = clamp(this.arp + leap, -period, 2 * period);
            }
            idx = this.center + this.arp;
          }
          const freq = this.conductor.freq(idx);
          const vel = 0.6 + rng() * 0.4;
          const swallow = size > 0.5 && rng() < 0.5 * (1 - groove);
          this._blast(when, freq, VOICE[voice], size, vel, swallow, rng);
          this.announce(freq, when, vel, voice, voice === "boom" ? idx : null);
          dsum += 0.2;
          continue;
        }
      }
      // Offbeats/subdivisions (and blast-less beats) → shrapnel trills.
      if (rng() < (isBeat ? 0.3 * pattern : (0.15 + 0.6 * groove) * (0.4 + pattern))) {
        const window = lerp(0.26, 0.11, scale);
        const count = Math.round(lerp(5, 12, pattern));
        this._shrapnel(when, window, count, 0.4 + 0.35 * pattern, rng);
        this.announce(3000 + rng() * 3000, when, 0.4, "shrapnel", null);
        dsum += 0.08;
      }
    }
    this.conductor.report(this.id, { density: clamp(dsum, 0, 1) });
  }

  // ---- a big blast -------------------------------------------------------

  _blast(when, freq, v, size, vel, swallow, rng) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const decay = Math.max(0.25, size * v.dec);
    const peak = v.peak * clamp(vel, 0.4, 1);
    const boom = this.params.boom;

    const out = ctx.createGain();
    out.gain.value = 1;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = (rng() * 2 - 1) * 0.4; out.connect(panner); panner.connect(this.output); }
    else out.connect(this.output);

    // 1. Broadband crack (snap).
    const crack = ctx.createBufferSource();
    crack.buffer = this._noise; crack.loop = true;
    const chp = ctx.createBiquadFilter();
    chp.type = "highpass"; chp.frequency.value = 1500; chp.Q.value = 0.7;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, when);
    cg.gain.linearRampToValueAtTime(peak * 0.9, when + 0.0006);
    cg.gain.exponentialRampToValueAtTime(0.0008, when + 0.035);
    crack.connect(chp); chp.connect(cg); cg.connect(out);
    crack.start(when, rng()); crack.stop(when + 0.06);
    this._cleanup(cg, when + 0.06);

    // 2. Saturated rumble body.
    const body = ctx.createBufferSource();
    body.buffer = this._noise; body.loop = true;
    const blp = ctx.createBiquadFilter();
    blp.type = "lowpass"; blp.Q.value = 1.0;
    blp.frequency.setValueAtTime(2000, when);
    blp.frequency.exponentialRampToValueAtTime(90, when + decay);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this._curve; shaper.oversample = "4x";
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, when);
    bg.gain.exponentialRampToValueAtTime(peak * 0.8, when + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    body.connect(blp); blp.connect(shaper); shaper.connect(bg); bg.connect(out);
    body.start(when, rng()); body.stop(when + decay + 0.05);
    this._cleanup(bg, when + decay + 0.05);

    // 3. Deep sub thump — the punch.
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(Math.max(70, freq), when);
    sub.frequency.exponentialRampToValueAtTime(lerp(45, 30, boom), when + Math.min(0.18, decay * 0.6));
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, when);
    sg.gain.exponentialRampToValueAtTime(peak * 0.95 * (0.5 + boom), when + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0008, when + decay * 1.15);
    sub.connect(sg); sg.connect(out);
    sub.start(when); sub.stop(when + decay * 1.15 + 0.06);
    this._cleanup(sg, when + decay * 1.15 + 0.06);

    // 4. Debris tail — falling rubble.
    this._shrapnel(when + 0.04, Math.min(0.9, decay * 0.9), Math.round(lerp(4, 14, size)), 0.35 * peak, rng, out);

    // 5. Reverse swallow before the big slow ones.
    if (swallow) {
      const pre = Math.min(0.28, decay * 0.6, when - now - 0.02);
      if (pre > 0.05) {
        const sw = ctx.createBufferSource();
        sw.buffer = this._noise; sw.loop = true;
        const sbp = ctx.createBiquadFilter();
        sbp.type = "bandpass";
        sbp.frequency.setValueAtTime(200, when - pre);
        sbp.frequency.exponentialRampToValueAtTime(2400, when);
        const swg = ctx.createGain();
        swg.gain.setValueAtTime(0.0001, when - pre);
        swg.gain.exponentialRampToValueAtTime(peak * 0.4, when);
        swg.gain.exponentialRampToValueAtTime(0.0008, when + 0.05);
        sw.connect(sbp); sbp.connect(swg); swg.connect(out);
        sw.start(when - pre); sw.stop(when + 0.08);
        this._cleanup(swg, when + 0.08);
      }
    }

    this._cleanup(out, when + decay * 1.3 + 0.1);
  }

  // ---- shrapnel: a rhythmic burst of tiny crackle grains ------------------

  _shrapnel(when, window, count, peak, rng, dest) {
    const ctx = this.ctx;
    let out = dest;
    let ownOut = false;
    if (!out) {
      out = ctx.createGain(); out.gain.value = 1;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = (rng() * 2 - 1) * 0.5; out.connect(panner); panner.connect(this.output); }
      else out.connect(this.output);
      ownOut = true;
    }
    for (let i = 0; i < count; i++) {
      const tg = when + (i / count) * window * (0.7 + 0.6 * rng());
      const amp = Math.pow(1 - i / count, 1.4) * (0.6 + 0.4 * rng());
      const src = ctx.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2500 + rng() * 4000;
      bp.Q.value = 3 + rng() * 6;
      const g = ctx.createGain();
      const gd = 0.002 + rng() * 0.006;
      g.gain.setValueAtTime(0.0001, tg);
      g.gain.linearRampToValueAtTime(peak * amp, tg + 0.0004);
      g.gain.exponentialRampToValueAtTime(0.0008, tg + gd);
      src.connect(bp); bp.connect(g); g.connect(out);
      src.start(tg, rng() * 1.5); src.stop(tg + 0.02);
      this._cleanup(g, tg + 0.02);
    }
    if (ownOut) this._cleanup(out, when + window + 0.1);
  }
}

function tanhCurve(k) {
  const N = 2048;
  const c = new Float32Array(N);
  const d = Math.tanh(k);
  for (let i = 0; i < N; i++) c[i] = Math.tanh(k * ((2 * i) / (N - 1) - 1)) / d;
  return c;
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
