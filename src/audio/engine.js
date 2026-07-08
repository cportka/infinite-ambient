// engine.js — the generative ambient engine, driven by a seeded piece.
//
// A "key" (any string) is hashed into a deterministic piece: a microtonal root,
// an interval set, and a per-step evolution. The scheduler draws every choice
// from a positional, seeded RNG (`stepRng`), so the same key always plays the
// same piece from the same starting point — it can be shared and recreated.
//
// Voice layers over a slow pulse:
//   • drone     — the microtonal root, several oscillators beating a few cents
//                 apart, plus interval partials; the shimmer knob widens it
//   • pad       — soft chords drawn from the interval gamut around a walking centre
//   • bass      — the root, an octave/period down, on each chord change
//   • arpeggio  — interval leaps through the gamut; the motion knob sets density
//   • bells     — sparse, reverb-drenched single tones from the gamut

import { buildPiece, stepRng, freqAt, gamutFreqs, clamp, lerp, randomKey } from "./piece.js";
import { createReverbImpulse } from "./reverb.js";
import { DEFAULT_KEY } from "./presets.js";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.3;

export class AmbientEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.timer = null;

    this.key = DEFAULT_KEY;
    this.piece = buildPiece(this.key);

    // Live controls. Non-slider values start from the piece's character.
    this.params = { volume: 0.8, ...this.piece.character };

    this.stepDur = 3;
    this.nextStepTime = 0;
    this.stepIndex = 0;
    this.chordSteps = 4;
    this.centerIndex = 0; // walks the gamut; where pads/arps sit

    this.drone = null;
    this.analyser = null;
  }

  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.params.volume;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.005;
    this.limiter.release.value = 0.25;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.5;
    this.toneFilter.frequency.value = brightnessToHz(this.params.brightness);

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createReverbImpulse(ctx, 4.5, 3);
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this._applySpace();

    this.toneBus = ctx.createGain(); // pads, bass, drone, arps (tone-shaped)
    this.toneFilter.connect(this.toneBus);
    this.toneBus.connect(this.dryGain);
    this.toneBus.connect(this.convolver);

    this.bellBus = ctx.createGain(); // bells (shimmery, reverb-heavy)
    this.bellBus.connect(this.dryGain);
    this.bellBus.connect(this.convolver);

    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.master);
    this.dryGain.connect(this.master);
  }

  start() {
    this._ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this._startDrone();
    this.nextStepTime = this.ctx.currentTime + 0.15;
    this.timer = setInterval(() => this._scheduler(), LOOKAHEAD_MS);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this._stopDrone();
  }

  toggle() {
    this.playing ? this.stop() : this.start();
    return this.playing;
  }

  // ---- the key ------------------------------------------------------------

  // Unlock a piece from a key. Rebuilds the piece, resets the timeline to step 0
  // (so the same key recreates the same sequence), and re-derives control
  // defaults. If already playing, retunes smoothly and keeps going.
  setKey(key, { keepParams = false } = {}) {
    this.key = String(key);
    this.piece = buildPiece(this.key);
    this.stepIndex = 0;
    this.centerIndex = 0;
    if (!keepParams) {
      const vol = this.params.volume;
      this.params = { volume: vol, ...this.piece.character };
      if (this.ctx) {
        this.setParam("brightness", this.params.brightness);
        this.setParam("space", this.params.space);
      }
    }
    if (this.ctx && this.playing) {
      this.nextStepTime = Math.max(this.nextStepTime, this.ctx.currentTime + 0.1);
      this._retuneDrone();
    } else if (this.ctx) {
      this._retuneDrone();
    }
    return this.key;
  }

  // A fresh, unpredictable key → a brand-new piece.
  newKey() {
    return this.setKey(randomKey());
  }

  // ---- parameters ---------------------------------------------------------

  setParam(name, value) {
    this.params[name] = value;
    if (!this.ctx) return;
    switch (name) {
      case "volume":
        this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
        break;
      case "brightness":
        this.toneFilter.frequency.setTargetAtTime(brightnessToHz(value), this.ctx.currentTime, 0.1);
        break;
      case "space":
        this._applySpace();
        break;
      case "shimmer":
        this._applyShimmer();
        break;
      // motion, pace are read live by the scheduler.
    }
  }

  getAnalyser() {
    return this.analyser;
  }

  _applySpace() {
    if (!this.ctx) return;
    const wet = clamp(this.params.space, 0, 1);
    this.wetGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.1);
    this.dryGain.gain.setTargetAtTime(1 - 0.4 * wet, this.ctx.currentTime, 0.1);
  }

  // ---- scheduler ----------------------------------------------------------

  _scheduler() {
    const ctx = this.ctx;
    this.stepDur = lerp(6.0, 1.8, this.params.pace);
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this._scheduleStep(this.stepIndex, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.stepIndex++;
    }
  }

  _scheduleStep(index, time) {
    const rng = stepRng(this.piece.seedInt, index);

    if (index % this.chordSteps === 0) {
      this._advanceChord(rng, time, this.stepDur * this.chordSteps);
    }

    // Arpeggio: interval leaps through the gamut, count set by the motion knob.
    const notes = Math.round(lerp(0, 7, this.params.motion));
    for (let i = 0; i < notes; i++) {
      const leap = [-3, -2, -1, 1, 1, 2, 3, 4][Math.floor(rng() * 8)];
      const idx = this.centerIndex + 2 + i * leap;
      const t = time + (i / Math.max(1, notes)) * this.stepDur + rng() * 0.04;
      this._playArp(freqAt(this.piece, idx), t);
    }

    // Bells: sparse, biased by the piece's motion character too.
    const bellP = 0.1 + this.params.motion * 0.3;
    if (rng() < bellP) {
      const pool = gamutFreqs(this.piece, 1, 3);
      this._playBell(pool[Math.floor(rng() * pool.length)], time + rng() * this.stepDur);
    }
  }

  _advanceChord(rng, time, duration) {
    // Walk the centre through the gamut: gentle steps, occasional leaps.
    const move = rng() < 0.7 ? [-2, -1, 1, 2][Math.floor(rng() * 4)] : [-4, 3, 4, 5][Math.floor(rng() * 4)];
    this.centerIndex += move;

    // A chord: a few stacked gamut tones around the centre.
    const n = this.piece.intervals.length;
    const spread = 2 + Math.floor(rng() * 2);
    const chord = [];
    for (let i = 0; i < spread; i++) {
      chord.push(freqAt(this.piece, this.centerIndex + i * (1 + Math.floor(rng() * 2)) + n));
    }
    this._playPad(chord, time, duration);
    if (rng() < 0.85) this._playBass(freqAt(this.piece, this.centerIndex - n), time, duration);
  }

  // ---- voices -------------------------------------------------------------

  _playPad(freqs, time, duration) {
    const ctx = this.ctx;
    const attack = Math.min(duration * 0.6, 3.5);
    const release = 3.0;
    const peak = 0.16 / Math.sqrt(freqs.length);
    const cents = this.params.shimmer * 9; // microtonal beating widens with shimmer

    const group = ctx.createGain();
    group.gain.value = 0;
    group.connect(this.toneFilter);
    group.gain.setValueAtTime(0, time);
    group.gain.linearRampToValueAtTime(peak, time + attack);
    group.gain.setValueAtTime(peak, time + duration);
    group.gain.linearRampToValueAtTime(0, time + duration + release);

    const stopAt = time + duration + release + 0.1;
    for (const freq of freqs) {
      for (const [type, det, level] of [["sawtooth", -cents, 0.5], ["triangle", cents, 0.7]]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        g.connect(group);
        osc.start(time);
        osc.stop(stopAt);
      }
    }
    cleanup(group, stopAt, ctx);
  }

  _playBass(freq, time, duration) {
    const ctx = this.ctx;
    const f = Math.max(24, freq);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = f / 2;
    const g = ctx.createGain();
    const attack = 1.2, release = 2.5;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.12, time + attack);
    g.gain.setValueAtTime(0.12, time + duration);
    g.gain.linearRampToValueAtTime(0, time + duration + release);
    osc.connect(g);
    sub.connect(g);
    g.connect(this.toneFilter);
    const stopAt = time + duration + release + 0.1;
    osc.start(time);
    sub.start(time);
    osc.stop(stopAt);
    sub.stop(stopAt);
    cleanup(g, stopAt, ctx);
  }

  _playArp(freq, time) {
    const ctx = this.ctx;
    const decay = 0.4 + Math.random() * 0.6;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.07, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, time + decay);
    osc.connect(g);
    g.connect(this.toneFilter);
    const stopAt = time + decay + 0.05;
    osc.start(time);
    osc.stop(stopAt);
    cleanup(g, stopAt, ctx);
  }

  _playBell(freq, time) {
    const ctx = this.ctx;
    const decay = 2 + Math.random() * 3;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.value = freq * 2.01; // slightly inharmonic shimmer
    const otGain = ctx.createGain();
    otGain.gain.value = 0.18;
    const g = ctx.createGain();
    const peak = 0.09 + Math.random() * 0.05;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, time + decay);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(g);
    overtone.connect(otGain);
    otGain.connect(g);
    if (panner) {
      panner.pan.value = Math.random() * 1.6 - 0.8;
      g.connect(panner);
      panner.connect(this.bellBus);
    } else {
      g.connect(this.bellBus);
    }
    const stopAt = time + decay + 0.1;
    osc.start(time);
    overtone.start(time);
    osc.stop(stopAt);
    overtone.stop(stopAt);
    cleanup(g, stopAt, ctx);
  }

  // ---- drone (microtonal, beating) ---------------------------------------

  _startDrone() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.12, ctx.currentTime, 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 2;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Partials: the root plus a couple of interval tones from the piece, each
    // doubled with a few-cent beat. Rebuilt on retune / shimmer change.
    const oscillators = [];
    filter.connect(gain);
    gain.connect(this.toneBus);
    lfo.start();

    this.drone = { oscillators, filter, gain, lfo, lfoGain };
    this._buildDroneVoices();
  }

  _droneFreqs() {
    const p = this.piece;
    // root, a low interval colour, and the period above the root
    const colour = p.intervals[Math.min(1, p.intervals.length - 1)] || 1;
    return [p.rootHz, p.rootHz * colour, p.rootHz * p.period];
  }

  _buildDroneVoices() {
    if (!this.drone) return;
    const ctx = this.ctx;
    for (const o of this.drone.oscillators) {
      try { o.stop(ctx.currentTime + 0.05); } catch (_) {}
    }
    const cents = 2 + this.params.shimmer * 12;
    const freqs = this._droneFreqs();
    const oscillators = [];
    freqs.forEach((f, i) => {
      const detunes = i === 0 ? [-cents, 0, cents] : [-cents, cents];
      for (const det of detunes) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.28;
        osc.connect(g);
        g.connect(this.drone.filter);
        osc.start(ctx.currentTime);
        oscillators.push(osc);
      }
    });
    this.drone.oscillators = oscillators;
  }

  _applyShimmer() {
    if (this.drone) this._buildDroneVoices();
  }

  _retuneDrone() {
    if (!this.drone || !this.ctx) return;
    // Rebuild the drone voices to the new root/intervals (cheap; short crossfade
    // via each voice's own start). Glide would require tracking per-osc targets;
    // a rebuild reads cleaner and the filter/LFO/gain envelope carries over.
    this._buildDroneVoices();
  }

  _stopDrone() {
    if (!this.drone) return;
    const ctx = this.ctx;
    const { oscillators, gain, lfo } = this.drone;
    const t = ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.6);
    const stopAt = t + 3;
    for (const osc of oscillators) {
      try { osc.stop(stopAt); } catch (_) {}
    }
    lfo.stop(stopAt);
    this.drone = null;
  }
}

function brightnessToHz(value) {
  return 220 * Math.pow(2, lerp(0, 6, value)); // ~220 Hz … ~14 kHz
}

function cleanup(node, stopAt, ctx) {
  const ms = Math.max(0, (stopAt - ctx.currentTime) * 1000) + 200;
  setTimeout(() => {
    try { node.disconnect(); } catch (_) {}
  }, ms);
}
