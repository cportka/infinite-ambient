// drone-visual.js — the aurora. The signature visual paired with Infinite Drone
// since v1: overlapping translucent wave bands and a drifting glow orb, driven by
// the instrument's own analyser and tinted around its hue. No RAF of its own —
// the pane manager calls draw() from one shared loop.

export function createDroneVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let phase = 0;
  let w = 0, h = 0;
  const freq = new Uint8Array(instrument.getAnalyser().frequencyBinCount);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function band(data, from, to) {
    let s = 0;
    for (let i = from; i < to; i++) s += data[i];
    return s / Math.max(1, to - from) / 255;
  }

  function draw() {
    if (!w || !h) resize();
    phase += 0.0016;
    const a = instrument.getAnalyser();
    a.getByteFrequencyData(freq);
    const n = freq.length;
    const low = Math.max(0.04, band(freq, 0, Math.floor(n * 0.08)));
    const mid = Math.max(0.03, band(freq, Math.floor(n * 0.08), Math.floor(n * 0.35)));
    const high = Math.max(0.02, band(freq, Math.floor(n * 0.35), n));

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(6, 8, 20, 0.16)";
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    const bands = [
      { energy: low, hue: hue - 15, y: 0.74, amp: 0.22 },
      { energy: mid, hue: hue - 60, y: 0.56, amp: 0.28 },
      { energy: high, hue: hue + 35, y: 0.42, amp: 0.2 },
    ];
    bands.forEach((b, bi) => {
      const alpha = 0.05 + b.energy * 0.38;
      ctx.fillStyle = `hsla(${b.hue}, 80%, 62%, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const baseline = h * b.y;
      const amplitude = h * b.amp * (0.4 + b.energy);
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * w;
        const wave =
          Math.sin(s * 0.35 + phase * 6 + bi * 1.7) * 0.5 +
          Math.sin(s * 0.13 - phase * 4 + bi) * 0.5;
        ctx.lineTo(x, baseline - wave * amplitude);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

    const energy = (low + mid + high) / 3;
    const cx = w * (0.5 + Math.sin(phase * 3) * 0.28);
    const cy = h * (0.42 + Math.cos(phase * 2.3) * 0.18);
    const r = Math.min(w, h) * (0.12 + energy * 0.5);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${hue - 20}, 90%, 72%, ${0.12 + energy * 0.35})`);
    grad.addColorStop(1, `hsla(${hue - 20}, 90%, 72%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  resize();
  return { draw, resize, dispose() {} };
}
