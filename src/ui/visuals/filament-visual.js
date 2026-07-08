// filament-visual.js — ripples in a puddle. Every pluck Filament announces drops
// into the pool and sends out expanding concentric rings that linger and drift,
// so the surface keeps moving and the echoes read visually the way Melt reads
// sonically. When it's silent the pool still breathes: faint idle drops and a
// slow caustic shimmer keep it alive. Tinted around the instrument's amber hue.

import { breathingField, analyserEnergy } from "./field.js";

const LIFE = 5.5; // seconds a ripple lives
const FMIN = Math.log2(50);
const FMAX = Math.log2(2400);

export function createFilamentVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, idleAt = 1.5;
  const ripples = [];
  const freq = new Uint8Array(instrument.getAnalyser().frequencyBinCount);

  function drop(xNorm, yNorm, strength) {
    ripples.push({ x: xNorm, y: yNorm, age: 0, strength });
    if (ripples.length > 60) ripples.shift();
  }

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    const norm = (Math.log2(Math.max(1, n.freq)) - FMIN) / (FMAX - FMIN);
    const x = 0.12 + 0.76 * Math.max(0, Math.min(1, norm)); // pitch → left-right
    const y = 0.38 + 0.3 * (0.5 + 0.5 * Math.sin(n.freq)); // stable-ish band
    drop(x, y, 0.6 + (n.velocity || 0.5) * 0.6);
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(dt) {
    if (!w || !h) resize();
    const step = dt || 0.016;
    t += step;

    // Idle life: when the pool is quiet, let a faint drop fall now and then so it
    // never goes fully still (periods of near-silence are fine, deadness isn't).
    if (t > idleAt && ripples.length < 3) {
      drop(0.2 + Math.random() * 0.6, 0.35 + Math.random() * 0.3, 0.18);
      idleAt = t + 1.8 + Math.random() * 2.4;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(8, 7, 14, 0.16)";
    ctx.fillRect(0, 0, w, h);

    // Always-breathing water sheen beneath the ripples.
    const energy = analyserEnergy(instrument.getAnalyser(), freq);
    breathingField(ctx, w, h, t, hue, { energy, bands: 2, speed: 0.5, intensity: 0.7, baseY: 0.52 });

    const maxR = Math.min(w, h) * 0.6;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.age += step;
      if (rp.age > LIFE) {
        ripples.splice(i, 1);
        continue;
      }
      const life = 1 - rp.age / LIFE;
      const cx = rp.x * w;
      const cy = rp.y * h;
      const lead = (rp.age / LIFE) * maxR * (0.6 + rp.strength);

      // A few concentric rings trailing the leading edge — a spreading ripple.
      for (let r = 0; r < 3; r++) {
        const radius = lead - r * 14;
        if (radius <= 0) continue;
        const a = life * rp.strength * (0.22 - r * 0.05);
        if (a <= 0) continue;
        ctx.strokeStyle = `hsla(${hue + r * 8}, 90%, 68%, ${a})`;
        ctx.lineWidth = 1.4 * life;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bright drop point at the moment of impact.
      if (rp.age < 0.4) {
        const glow = (1 - rp.age / 0.4) * rp.strength;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
        grad.addColorStop(0, `hsla(${hue + 30}, 100%, 82%, ${0.6 * glow})`);
        grad.addColorStop(1, `hsla(${hue}, 100%, 82%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
