// visualizer.js — a slow, aurora-like canvas visual driven by the analyser.
//
// Deliberately calm: overlapping translucent bands whose height and hue drift
// with the audio's low/mid/high energy, layered over a subtle vertical gradient.
// It reads the engine's AnalyserNode; when nothing is playing it idles gently.

export class Visualizer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.engine = engine;
    this.raf = null;
    this.phase = 0;
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.raf) return;
    const loop = () => {
      this._draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // Average the analyser's magnitude over a frequency slice, normalised 0..1.
  _band(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += data[i];
    return sum / (to - from) / 255;
  }

  _draw() {
    const { ctx, w, h } = this;
    this.phase += 0.0015;

    let low = 0.04;
    let mid = 0.03;
    let high = 0.02;
    const analyser = this.engine.getAnalyser && this.engine.getAnalyser();
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const n = data.length;
      low = Math.max(low, this._band(data, 0, Math.floor(n * 0.08)));
      mid = Math.max(mid, this._band(data, Math.floor(n * 0.08), Math.floor(n * 0.35)));
      high = Math.max(high, this._band(data, Math.floor(n * 0.35), n));
    }

    // Fade the previous frame instead of clearing — leaves soft light trails.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(6, 8, 20, 0.14)";
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    const bands = [
      { energy: low, hueBase: 250, y: 0.72, amp: 0.22 },
      { energy: mid, hueBase: 190, y: 0.55, amp: 0.28 },
      { energy: high, hueBase: 300, y: 0.4, amp: 0.2 },
    ];

    bands.forEach((band, bi) => {
      const hue = band.hueBase + Math.sin(this.phase * 2 + bi) * 30;
      const alpha = 0.05 + band.energy * 0.35;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const baseline = h * band.y;
      const amplitude = h * band.amp * (0.4 + band.energy);
      const steps = 48;
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * w;
        const wave =
          Math.sin(s * 0.35 + this.phase * 6 + bi * 1.7) * 0.5 +
          Math.sin(s * 0.13 - this.phase * 4 + bi) * 0.5;
        const y = baseline - wave * amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

    // A drifting glow orb tracks overall energy — a focal point for the eye.
    const energy = (low + mid + high) / 3;
    const cx = w * (0.5 + Math.sin(this.phase * 3) * 0.28);
    const cy = h * (0.4 + Math.cos(this.phase * 2.3) * 0.18);
    const r = Math.min(w, h) * (0.12 + energy * 0.5);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${210 + energy * 80}, 90%, 70%, ${0.12 + energy * 0.35})`);
    grad.addColorStop(1, "hsla(210, 90%, 70%, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
