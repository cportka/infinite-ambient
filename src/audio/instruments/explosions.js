// explosions.js — a synthesised explosion is a noise burst (filter swept downward)
// plus a pitch-diving thump and a sub boom; optionally a short reverse "swallow"
// sucks in before it blasts. One continuum runs the whole instrument:
//
//   SCALE 0  → huge, slow, stretched booms placed at opportune moments — ambient.
//   SCALE 1  → tight hits on a fast grid — a Maestro Rhythm-King-style drum machine
//              (kick on even beats, snare on the backbeat, hats on the offbeats).
//
// In between it's the usual view: an explosive, melodic **arpeggiating beat** whose
// pitched booms walk the shared gamut. Density follows `pattern` and the field
// (it fills the gaps); pitches come from the gamut (melodic + consonant). Seeded
// from the key, so the beat is reproducible.

import { Instrument } from "../instrument.js";
import { stepRng, clamp, lerp } from "../piece.js";
import { noiseBuffer } from "../noise.js";

const SALT = 0xb0053;

export const meta = {
  id: "explosions",
  name: "Explosions",
  role: "rhythm",
  hue: 20, // warm orange/red
  gain: 0.7,
  blurb: "Explosive arpeggiating beats — slow to ambient booms, fast to a drum machine.",
  params: [
    { key: "scale", label: "Scale", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "pattern", label: "Pattern", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "pitch", label: "Pitch", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "boom", label: "Boom", min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.35 },
  ],
};

// Per-voice character. `dec` scales the (scale-derived) size; the swept lowpass
// goes lpFrom → lpTo across the decay.
const VOICE = {
  kick: { lpFrom: 1400, lpTo: 55, noise: 0.5, thump: 1.0, ratio: 4, sub: 1.0, dec: 0.55, peak: 0.6 },
  snare: { lpFrom: 6500, lpTo: 1100, noise: 1.0, thump: 0.3, ratio: 3, sub: 0.12, dec: 0.34, peak: 0.42, bp: true },
  hat: { lpFrom: 14000, lpTo: 6500, noise: 0.85, thump: 0, ratio: 1, sub: 0, dec: 0.16, peak: 0.26, hp: true },
  boom: { lpFrom: 3200, lpTo: 110, noise: 0.7, thump: 0.85, ratio: 3, sub: 1.0, dec: 1.0, peak: 0.58 },
};

export class Explosions extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.center = 0;
    this.arp = 0; // melodic offset from the centre, walks the gamut
    this._noise = noiseBuffer(this.ctx, 2.2, mulberryFromSeed(conductor.piece.seedInt ^ SALT));
  }

  onMount() {
    this.listen("harmony", (h) => { this.center = h.centerIndex; });
    this.listen("pulse", (p) => this._onPulse(p));
  }

  get tailMs() {
    return 4200; // a slow ambient boom can ring ~3.6s — let it finish before disconnect
  }

  _onPulse(p) {
    if (!this._active) return;
    const rng = stepRng(this.conductor.piece.seedInt ^ SALT, p.index);
    const field = this.conductor.field;
    const scale = this.params.scale;
    const density = this.params.pattern;
    const groove = clamp(scale * 1.4, 0, 1); // how "drum-machine" we are
    const subs = Math.max(1, Math.round(lerp(1, 8, scale)));
    const size = lerp(3.6, 0.09, scale); // slow → long booms; fast → tight hits
    const period = this.conductor.piece.intervals.length;

    let density_sum = 0;
    for (let k = 0; k < subs; k++) {
      const isBeat = k === 0;
      const beat = p.beatInBar;
      let voice = null;
      if (isBeat && beat % 2 === 0 && rng() < 0.55 + 0.4 * groove) voice = "kick";
      else if (isBeat && beat % 2 === 1 && rng() < (0.3 + 0.6 * groove) * (0.4 + density)) voice = "snare";
      else if (!isBeat && rng() < (0.12 + 0.6 * groove) * density) voice = "hat";
      // Opportune ambient boom: fill a quiet gap on a beat.
      if (!voice && isBeat && rng() < 0.22 * (1.2 - field.energy) * (0.4 + density)) voice = "boom";
      if (!voice) continue;

      const when = p.when + (k / subs) * p.stepDur;
      // Pitch: kick low, hat high, snare mid, boom melodic; the melodic arp walks.
      let idx;
      if (voice === "kick") idx = this.center - period;
      else if (voice === "hat") idx = this.center + 2 * period + Math.floor(rng() * period);
      else if (voice === "snare") idx = this.center + Math.floor(rng() * 2);
      else {
        if (rng() < this.params.pitch) {
          const leap = [-2, -1, 1, 2, 3][Math.floor(rng() * 5)];
          this.arp = clamp(this.arp + leap, -period, 2 * period);
        }
        idx = this.center + this.arp;
      }
      const freq = this.conductor.freq(idx);
      const vel = 0.5 + rng() * 0.5;
      // Swallow: a short reverse suck into the blast — mostly on the slow, big hits.
      const swallow = size > 0.5 && (voice === "boom" || voice === "kick") && rng() < 0.5 * (1 - groove);
      this._explode(when, freq, VOICE[voice], size, vel, swallow);
      this.announce(freq, when, vel, voice, voice === "boom" ? idx : null);
      density_sum += 0.15;
    }
    this.conductor.report(this.id, { density: clamp(density_sum, 0, 1) });
  }

  _explode(when, freq, v, size, vel, swallow) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const decay = Math.max(0.03, size * v.dec);

    const out = ctx.createGain();
    const peak = v.peak * clamp(vel, 0, 1);
    out.gain.value = 1;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() * 2 - 1) * 0.5;
      out.connect(panner);
      panner.connect(this.output);
    } else {
      out.connect(this.output);
    }

    // Noise body with a swept filter: src → filter → envelope → out.
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = v.hp ? "highpass" : v.bp ? "bandpass" : "lowpass";
    filt.frequency.setValueAtTime(v.lpFrom, when);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, v.lpTo), when + decay);
    if (v.bp) filt.Q.value = 1.2;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, when);
    nGain.gain.exponentialRampToValueAtTime(peak * v.noise, when + 0.003);
    nGain.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    src.connect(filt);
    filt.connect(nGain);
    nGain.connect(out);
    src.start(when);
    src.stop(when + decay + 0.05);
    this._cleanup(nGain, when + decay + 0.05);

    // Pitch-diving thump.
    if (v.thump > 0) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * v.ratio, when);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), when + Math.min(0.16, decay * 0.5));
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.0001, when);
      tg.gain.exponentialRampToValueAtTime(peak * v.thump, when + 0.003);
      tg.gain.exponentialRampToValueAtTime(0.0008, when + decay);
      osc.connect(tg);
      tg.connect(out);
      osc.start(when);
      osc.stop(when + decay + 0.05);
      this._cleanup(tg, when + decay + 0.05);
    }

    // Sub boom (scaled by the Boom knob).
    if (v.sub > 0 && this.params.boom > 0) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(Math.max(28, freq / 2), when);
      const sg = ctx.createGain();
      const sPeak = peak * v.sub * this.params.boom;
      sg.gain.setValueAtTime(0.0001, when);
      sg.gain.exponentialRampToValueAtTime(sPeak, when + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0008, when + decay * 1.1);
      sub.connect(sg);
      sg.connect(out);
      sub.start(when);
      sub.stop(when + decay * 1.1 + 0.05);
      this._cleanup(sg, when + decay * 1.1 + 0.05);
    }

    // Swallow: a short rising suck landing exactly on the blast. Limited by the
    // scheduler lookahead — starts as early as it can, else skipped.
    if (swallow) {
      const pre = Math.min(0.28, decay * 0.6, when - now - 0.02);
      if (pre > 0.05) {
        const sw = ctx.createBufferSource();
        sw.buffer = this._noise;
        sw.loop = true;
        const sbp = ctx.createBiquadFilter();
        sbp.type = "bandpass";
        sbp.frequency.setValueAtTime(200, when - pre);
        sbp.frequency.exponentialRampToValueAtTime(2400, when);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.0001, when - pre);
        sg.gain.exponentialRampToValueAtTime(peak * 0.4, when);
        sg.gain.exponentialRampToValueAtTime(0.0008, when + 0.05);
        sw.connect(sbp);
        sbp.connect(sg);
        sg.connect(out);
        sw.start(when - pre);
        sw.stop(when + 0.08);
        this._cleanup(sg, when + 0.08);
      }
    }

    this._cleanup(out, when + Math.max(decay * 1.2, 0.1) + 0.1);
  }
}

// Small local PRNG (avoids importing mulberry32's name collision concerns).
function mulberryFromSeed(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
