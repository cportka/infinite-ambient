// filament.js — the second instrument. Karplus-Strong plucked strings: a short
// noise burst run through a damped delay line (synthesised into a buffer — no
// worklet, no deps), giving bright, transient, decaying filaments — timbrally
// the opposite of the drone's sustained saws. Role: lead.
//
// It demonstrates all three conductor channels:
//   TIMING  — ignores the fast pulse; locks to bar (`harmony`) events and
//             subdivides each bar into 2/3/5 plucks, sample-accurate off `when`.
//   PITCH   — call & response: it answers the shared harmonic centre a register
//             up, with consonant interval offsets drawn from the gamut, and
//             echoes recently-announced notes. All pitches are gamut indices, so
//             it's always consonant with the drone.
//   TIMBRE  — it reads the shared energy field: loud mix → it lays back (fewer,
//             quieter plucks); sparse mix → it fills the gaps and sparkles.
//
// Deterministic: pluck count, pitches, and the noise seed all come from
// stepRng(seed ^ SALT, barIndex), so a key recreates Filament's part too.

import { Instrument } from "../instrument.js";
import { mulberry32, clamp, lerp } from "../piece.js";

const SALT = 0xf11a;

export const meta = {
  id: "filament",
  name: "Filament",
  role: "lead",
  hue: 38, // amber/gold — deliberate contrast to the drone's violet
  gain: 0.95,
  blurb: "Plucked microtonal strings that answer the drone, echo, and melt into the bed.",
  params: [
    { key: "presence", label: "Presence", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "tone", label: "Tone", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "sustain", label: "Sustain", min: 0, max: 1, step: 0.01, default: 0.62 },
    { key: "melt", label: "Melt", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "space", label: "Space", min: 0, max: 1, step: 0.01, default: 0.55 },
  ],
};

export class Filament extends Instrument {
  constructor(conductor, audio) {
    super(conductor, audio, meta);
    this.center = 0;
    this.lastAnnounced = null; // most recent note from another instrument
    this.recent = []; // this instrument's recent pitch indices (avoid doubling)
  }

  onMount() {
    const ctx = this.ctx;
    // A gentle highpass keeps the plucks bright and above the drone's low bed.
    this.hp = ctx.createBiquadFilter();
    this.hp.type = "highpass";
    this.hp.frequency.value = 160;
    this.hp.connect(this.output); // dry

    // Melt: a filtered feedback delay so each pluck echoes and smears into the
    // soundscape instead of stopping dead. hp → delay → (lowpass) → output, with
    // the lowpass feeding back into the delay for a decaying, darkening tail.
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.34;
    this.fbFilter = ctx.createBiquadFilter();
    this.fbFilter.type = "lowpass";
    this.fbFilter.frequency.value = 2600;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.3 + this.params.melt * 0.45; // ~0.3 … 0.75
    this.hp.connect(this.delay);
    this.delay.connect(this.fbFilter);
    this.fbFilter.connect(this.output); // wet
    this.fbFilter.connect(this.fb);
    this.fb.connect(this.delay); // feedback loop

    this.listen("harmony", (h) => this._onBar(h));
    // Remember the most recent melodic note another instrument announced (one that
    // carries a gamut index), so we can answer it — real call-and-response.
    this.listen("note", (n) => {
      if (n.instrument !== this.id && n.index != null) this.lastAnnounced = n;
    });
  }

  onParam(name, value) {
    // Melt controls the echo tail's feedback (how long it smears).
    if (name === "melt") this.fb.gain.setTargetAtTime(0.3 + value * 0.45, this.ctx.currentTime, 0.1);
  }

  _onBar(h) {
    if (!this._active) return;
    this.center = h.centerIndex;
    const piece = this.conductor.piece;
    const rng = mulberry32((piece.seedInt ^ SALT ^ (h.barIndex * 2654435761)) >>> 0);
    const field = this.conductor.field;

    // TIMBRE: how much to play this bar — fill gaps, lay back when loud.
    const fill = clamp(this.params.presence * (1.2 - field.energy), 0, 1.1);
    const subdivisions = [2, 3, 5][Math.floor(rng() * 3)];
    const count = Math.round(subdivisions * fill);
    if (count <= 0) return; // rest — leave space
    this.conductor.report(this.id, { density: 0.2 + 0.5 * fill });

    const barDur = this.conductor.stepDur * 4;
    const period = piece.intervals.length;

    // PITCH: answer the centre a register up, with a consonant offset. Optionally
    // lean toward a recently-announced note (an echo of the drone).
    // Answer: half the time echo the drone's last melodic note a register up,
    // otherwise sit a register above the shared harmonic centre.
    const register = period;
    const anchor = this.lastAnnounced && rng() < 0.5
      ? this.lastAnnounced.index + register
      : this.center + register;
    let idx = anchor + [-2, -1, 0, 1, 2, 3][Math.floor(rng() * 6)];

    // TIMBRE: brighter plucks when the field is dark, and vice-versa; plus tone knob.
    const brightness = clamp(this.params.tone * 0.6 + (1 - field.brightness) * 0.4, 0, 1);
    const velScale = 0.6 + 0.4 * (1 - field.energy);

    const leaps = [1, 2, -1, 3, -2, 4];
    for (let k = 0; k < count; k++) {
      if (k > 0) idx += leaps[Math.floor(rng() * leaps.length)];
      if (this.recent.includes(idx)) idx += 1; // avoid immediate doubling
      const freq = this.conductor.freq(idx);
      const when = h.when + (k / count) * barDur + rng() * 0.02;
      const velocity = (0.5 + rng() * 0.4) * velScale;
      const seed = (piece.seedInt ^ SALT ^ (h.barIndex * 131 + k * 977)) >>> 0;
      this._pluck(freq, when, brightness, velocity, seed);
      this.announce(freq, when, velocity, "string");
      this.recent.push(idx);
      if (this.recent.length > 6) this.recent.shift();
    }
  }

  // One Karplus-Strong pluck, synthesised into a buffer and played.
  _pluck(freq, when, brightness, velocity, seed) {
    const ctx = this.ctx;
    const sustain = this.params.sustain;
    const seconds = 1.2 + sustain * 3.6; // longer strings — melt into the bed
    const blend = 0.5 + brightness * 0.45; // higher → brighter / longer sustain
    const decayFactor = lerp(0.993, 0.9997, sustain);
    const buffer = ksBuffer(ctx, freq, seconds, blend, decayFactor, mulberry32(seed));

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    const peak = 0.32 * clamp(velocity, 0, 1);
    // Tiny attack removes the click of starting mid-noise-burst.
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.004);
    g.gain.setValueAtTime(peak, when + seconds - 0.05);
    g.gain.linearRampToValueAtTime(0, when + seconds);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(g);
    if (panner) {
      panner.pan.value = (this.recent.length % 2 ? 1 : -1) * (0.2 + Math.abs(velocity - 0.7));
      g.connect(panner);
      panner.connect(this.hp);
    } else {
      g.connect(this.hp);
    }
    const stopAt = when + seconds + 0.05;
    src.start(when);
    src.stop(stopAt);
    this._cleanup(g, stopAt);
  }
}

// Karplus-Strong string synthesis into a mono AudioBuffer.
// A noise burst fills the delay line; each sample averages neighbours (a lowpass
// that darkens the tail) with a per-sample decay factor. Robust for any pitch
// because it's computed offline, unlike a native feedback DelayNode (which can't
// hold delays under one render quantum in a cycle).
function ksBuffer(ctx, freq, seconds, blend, decayFactor, rand) {
  const sr = ctx.sampleRate;
  const N = Math.max(2, Math.round(sr / freq));
  const len = Math.max(N + 1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = rand() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const nxt = line[(idx + 1) % N];
    out[i] = cur;
    line[idx] = (blend * cur + (1 - blend) * nxt) * decayFactor;
    idx = (idx + 1) % N;
  }
  // Short fade at the very end so truncation never clicks.
  const fade = Math.min(len, Math.floor(sr * 0.01));
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return buf;
}
