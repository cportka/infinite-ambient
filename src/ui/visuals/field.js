// field.js — a shared "breathing field" any pane visual can lay down as its base
// so every pane stays alive like the drone's aurora, even at rest. Slow flowing
// bands + a drifting, pulsing glow, tinted to the instrument's hue. The breath
// term keeps a visible baseline when the audio is silent; `energy` (0..1, from the
// instrument's analyser) makes it surge when it plays.

export function breathingField(ctx, w, h, t, hue, opts = {}) {
  const { energy = 0, bands = 2, speed = 1, intensity = 1, baseY = 0.5 } = opts;
  const breath = 0.5 + 0.5 * Math.sin(t * 0.26 * speed);
  ctx.globalCompositeOperation = "lighter";

  const steps = 40;
  for (let bi = 0; bi < bands; bi++) {
    const hh = hue + (bi - (bands - 1) / 2) * 26;
    const line = h * (baseY + bi * 0.16) + Math.sin(t * 0.5 * speed + bi) * h * 0.05;
    const amp = h * (0.1 + 0.08 * breath) * (0.6 + energy) * intensity;
    const alpha = (0.045 + 0.05 * breath + energy * 0.22) * intensity;
    ctx.fillStyle = `hsla(${hh}, 78%, 60%, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * w;
      const wave =
        Math.sin(s * 0.35 + t * 1.4 * speed + bi * 1.7) * 0.5 +
        Math.sin(s * 0.13 - t * 0.9 * speed + bi) * 0.5;
      ctx.lineTo(x, line - wave * amp);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // A drifting, breathing glow — the focal point.
  const cx = w * (0.5 + Math.sin(t * 0.31 * speed) * 0.26);
  const cy = h * (baseY - 0.05 + Math.cos(t * 0.24 * speed) * 0.16);
  const r = Math.min(w, h) * (0.14 + 0.12 * breath + energy * 0.4) * intensity;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `hsla(${hue}, 90%, 68%, ${(0.08 + 0.09 * breath + energy * 0.3) * intensity})`);
  grad.addColorStop(1, `hsla(${hue}, 90%, 68%, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// Average magnitude of an analyser as a 0..1 energy value (small helper so each
// visual can surge with its own instrument without repeating the boilerplate).
export function analyserEnergy(analyser, buf) {
  analyser.getByteFrequencyData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i];
  return Math.min(1, s / buf.length / 255 * 3);
}
