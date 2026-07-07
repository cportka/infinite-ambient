// engine.js — the generative ambient engine.
//
// A lookahead scheduler drives four voice layers over a slow pulse:
//   • drone  — a continuous, detuned root that glides on key changes
//   • pad    — evolving chords with long attack/release that overlap
//   • bass   — a soft low root on each chord change
//   • bells  — sparse, reverb-drenched sine tones sprinkled by the density knob
//
// The chord root drifts through the current scale and, occasionally, the key or
// scale itself shifts — so the stream never resolves and never repeats.

import { midiToFreq, scaleNotes, chordFromDegree, clamp, lerp, SCALES } from "./scales.js";
import { createReverbImpulse } from "./reverb.js";
import { PRESETS, DEFAULT_PRESET } from "./presets.js";

const LOOKAHEAD_MS = 25; // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.3; // seconds of audio scheduled beyond `now`

export class AmbientEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.timer = null;

    // Live parameters (0..1 unless noted). Seeded from the default preset.
    this.params = {
      volume: 0.8,
      density: 0.3,
      brightness: 0.4,
      space: 0.8,
      pace: 0.25,
      key: 9, // pitch class 0..11
      scaleName: "pentatonicMinor",
    };
    Object.assign(this.params, presetParams(DEFAULT_PRESET));

    // Scheduler state.
    this.stepDur = 3;
    this.nextStepTime = 0;
    this.stepIndex = 0;
    this.chordSteps = 4; // steps between chord changes
    this.currentDegree = 0;

    this.drone = null; // { oscillators, filter, gain }
    this.analyser = null;
  }

  // Lazily build the audio graph on first play (autoplay policy needs a gesture).
  _ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    const ctx = this.ctx;
    // Master chain: voiceBus → (dry + reverb) → master → limiter → analyser → out
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

    // Tonal shaping filter that pads + bass pass through (the "brightness" knob).
    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.5;
    this.toneFilter.frequency.value = brightnessToHz(this.params.brightness);

    // Reverb (wet) vs dry split.
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createReverbImpulse(ctx, 4.5, 3);
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this._applySpace();

    // Pads/bass go through the tone filter; both dry and wet.
    this.toneBus = ctx.createGain();
    this.toneFilter.connect(this.toneBus);
    this.toneBus.connect(this.dryGain);
    this.toneBus.connect(this.convolver);

    // Bells bypass the tone filter (kept shimmery) but are reverb-heavy.
    this.bellBus = ctx.createGain();
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
    // Kick the scheduler slightly ahead so the first chord has room to swell in.
    this.nextStepTime = this.ctx.currentTime + 0.15;
    this.stepIndex = 0;
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

  // ---- parameter setters -------------------------------------------------

  setParam(name, value) {
    this.params[name] = value;
    if (!this.ctx) return;
    switch (name) {
      case "volume":
        this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
        break;
      case "brightness":
        this.toneFilter.frequency.setTargetAtTime(
          brightnessToHz(value),
          this.ctx.currentTime,
          0.1,
        );
        break;
      case "space":
        this._applySpace();
        break;
      // density, pace, key, scaleName are read live by the scheduler.
    }
  }

  setKey(pitchClass) {
    this.params.key = pitchClass;
    this._retuneDrone();
  }

  setScale(scaleName) {
    if (SCALES[scaleName]) this.params.scaleName = scaleName;
  }

  applyPreset(name) {
    const p = presetParams(name);
    if (!p) return;
    Object.assign(this.params, p);
    if (this.ctx) {
      this.setParam("brightness", this.params.brightness);
      this.setParam("space", this.params.space);
      this._retuneDrone();
    }
  }

  // Nudge the atmosphere: pick a fresh key, scale, and slider spread.
  randomize() {
    const keys = 12;
    const scaleNames = Object.keys(SCALES);
    this.params.key = Math.floor(Math.random() * keys);
    this.params.scaleName = scaleNames[Math.floor(Math.random() * scaleNames.length)];
    this.params.density = 0.2 + Math.random() * 0.5;
    this.params.brightness = 0.3 + Math.random() * 0.55;
    this.params.space = 0.55 + Math.random() * 0.4;
    this.params.pace = 0.18 + Math.random() * 0.4;
    if (this.ctx) {
      this.setParam("brightness", this.params.brightness);
      this.setParam("space", this.params.space);
      this._retuneDrone();
    }
    return { ...this.params };
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

  // ---- scheduler ---------------------------------------------------------

  _scheduler() {
    const ctx = this.ctx;
    // pace maps to the pulse length: slower pace → longer, more spacious steps.
    this.stepDur = lerp(5.5, 1.6, this.params.pace);

    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this._scheduleStep(this.stepIndex, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.stepIndex++;
    }
  }

  _scheduleStep(index, time) {
    const chordLen = this.chordSteps;
    if (index % chordLen === 0) {
      this._advanceChord(time, this.stepDur * chordLen);
    }

    // Bells: probability rises with density; two chances per step for texture.
    const p = 0.12 + this.params.density * 0.6;
    for (let i = 0; i < 2; i++) {
      if (Math.random() < p * 0.5) {
        const offset = Math.random() * this.stepDur;
        this._playBell(time + offset);
      }
    }
  }

  _advanceChord(time, duration) {
    const scale = SCALES[this.params.scaleName] || SCALES.pentatonicMinor;
    const degrees = scale.intervals.length;

    // Drift the chord root: mostly gentle steps, occasionally a leap.
    const move = Math.random() < 0.7 ? [-1, 1, 2, -2][Math.floor(Math.random() * 4)]
                                     : [3, -3, 4][Math.floor(Math.random() * 3)];
    this.currentDegree = ((this.currentDegree + move) % degrees + degrees) % degrees;

    // Rare key/scale drift keeps the stream evolving over long listens.
    if (Math.random() < 0.08) {
      this.params.key = (this.params.key + (Math.random() < 0.5 ? 5 : 7)) % 12;
      this._retuneDrone();
    }

    const size = Math.random() < 0.4 ? 4 : 3; // sometimes an added colour tone
    const chord = chordFromDegree(this.params.key, this.params.scaleName, this.currentDegree, 3, size);
    this._playPad(chord, time, duration);

    if (Math.random() < 0.85) {
      this._playBass(chord[0] - 12, time, duration);
    }
  }

  // ---- voices ------------------------------------------------------------

  _playPad(midiNotes, time, duration) {
    const ctx = this.ctx;
    const attack = Math.min(duration * 0.6, 3.5);
    const release = 3.0;
    const peak = 0.16 / Math.sqrt(midiNotes.length);

    const group = ctx.createGain();
    group.gain.value = 0;
    group.connect(this.toneFilter);
    group.gain.setValueAtTime(0, time);
    group.gain.linearRampToValueAtTime(peak, time + attack);
    group.gain.setValueAtTime(peak, time + duration);
    group.gain.linearRampToValueAtTime(0, time + duration + release);

    const stopAt = time + duration + release + 0.1;
    for (const midi of midiNotes) {
      const freq = midiToFreq(midi);
      // Two slightly detuned oscillators per note give a warm chorus.
      for (const [type, detune, level] of [["sawtooth", -5, 0.5], ["triangle", 6, 0.7]]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
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

  _playBass(midi, time, duration) {
    const ctx = this.ctx;
    const freq = midiToFreq(Math.max(24, midi));
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq / 2;

    const g = ctx.createGain();
    const attack = 1.2;
    const release = 2.5;
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

  _playBell(time) {
    const ctx = this.ctx;
    const notes = scaleNotes(this.params.key, this.params.scaleName, 4, 3);
    const midi = notes[Math.floor(Math.random() * notes.length)];
    const freq = midiToFreq(midi);
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

  // ---- drone -------------------------------------------------------------

  _startDrone() {
    const ctx = this.ctx;
    const rootFreq = midiToFreq(this.params.key + 24); // low root
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.1, ctx.currentTime, 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    filter.Q.value = 2;

    // A slow LFO opens and closes the drone's filter for gentle movement.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const oscillators = [];
    for (const detune of [-7, 0, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = rootFreq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
      oscillators.push(osc);
    }
    filter.connect(gain);
    gain.connect(this.toneBus);
    lfo.start();

    this.drone = { oscillators, filter, gain, lfo, lfoGain };
  }

  _retuneDrone() {
    if (!this.drone || !this.ctx) return;
    const rootFreq = midiToFreq(this.params.key + 24);
    const t = this.ctx.currentTime;
    for (const osc of this.drone.oscillators) {
      osc.frequency.setTargetAtTime(rootFreq, t, 1.5); // glide, don't jump
    }
  }

  _stopDrone() {
    if (!this.drone) return;
    const ctx = this.ctx;
    const { oscillators, gain, lfo } = this.drone;
    const t = ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.6);
    const stopAt = t + 3;
    for (const osc of oscillators) osc.stop(stopAt);
    lfo.stop(stopAt);
    this.drone = null;
  }
}

// Copy a preset's params (without the label) or null if unknown.
function presetParams(name) {
  const preset = PRESETS[name];
  if (!preset) return null;
  const { label, ...params } = preset;
  return { ...params };
}

// Map the 0..1 brightness knob onto a musically useful lowpass range (Hz),
// exponentially so the low end has resolution where it matters.
function brightnessToHz(value) {
  return 220 * Math.pow(2, lerp(0, 6, value)); // ~220 Hz … ~14 kHz
}

// Disconnect a node after it can no longer be producing sound, so long sessions
// don't leak graph nodes.
function cleanup(node, stopAt, ctx) {
  const ms = Math.max(0, (stopAt - ctx.currentTime) * 1000) + 200;
  setTimeout(() => {
    try {
      node.disconnect();
    } catch (_) {
      /* already gone */
    }
  }, ms);
}
