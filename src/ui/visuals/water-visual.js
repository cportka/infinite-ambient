// water-visual.js — a flowing stream: horizontal ripple bands drifting at
// different speeds, self-rising bubbles, and expanding droplet rings when a drip
// rings out. Cool blue. Distinct from every other pane (horizontal flow, not
// radial fields or bursts).

export function createWaterVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  const FMIN = Math.log2(120), FMAX = Math.log2(4200);
  let w = 0, h = 0, t = 0, bubbleAt = 0.4;
  const drops = [];
  const bubbles = [];

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id || n.timbre !== "drip") return;
    const norm = (Math.log2(Math.max(1, n.freq)) - FMIN) / (FMAX - FMIN);
    drops.push({ x: 0.1 + 0.8 * Math.max(0, Math.min(1, norm)), y: 0.35 + Math.random() * 0.3, age: 0, strength: 0.6 + (n.velocity || 0.5) * 0.6 });
    if (drops.length > 40) drops.shift();
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
    const flow = instrument.params.flow ?? 0.55;
    const bub = instrument.params.bubbles ?? 0.4;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4, 9, 16, 0.18)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Flowing ripple bands.
    const breathe = 0.6 + 0.4 * Math.sin(t * 0.03 * Math.PI * 2);
    const bands = 8;
    for (let b = 0; b < bands; b++) {
      const yBase = h * (0.12 + (b / bands) * 0.8);
      const speed = (0.4 + (b % 3) * 0.5) * (0.5 + flow);
      const amp = h * 0.02 * (1 + (b % 2));
      const k = 0.02 + (b % 4) * 0.006;
      ctx.strokeStyle = `hsla(${hue + b * 3}, 80%, 62%, ${(0.05 + 0.05 * breathe) * (0.6 + flow)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = yBase + Math.sin(x * k + t * speed + b) * amp + Math.sin(x * k * 0.4 - t * speed * 0.6) * amp * 0.5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Self-rising bubbles (density from the bubbles knob).
    if (t > bubbleAt) {
      bubbles.push({ x: Math.random() * w, y: h * (0.6 + Math.random() * 0.35), age: 0, r: 1 + Math.random() * 2 });
      bubbleAt = t + 0.06 + (1 - bub) * 0.4 * Math.random();
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bu = bubbles[i];
      bu.age += step;
      bu.y -= (18 + bu.r * 6) * step;
      if (bu.age > 1.4 || bu.y < h * 0.1) { bubbles.splice(i, 1); continue; }
      ctx.strokeStyle = `hsla(${hue + 20}, 90%, 78%, ${(1 - bu.age / 1.4) * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bu.x + Math.sin(t * 4 + bu.y) * 3, bu.y, bu.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Droplet impact rings.
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += step;
      const life = 1 - d.age / 0.9;
      if (life <= 0) { drops.splice(i, 1); continue; }
      const cx = d.x * w, cy = d.y * h;
      const rMax = Math.min(w, h) * 0.22 * d.strength;
      for (let r = 0; r < 2; r++) {
        const rad = (1 - Math.pow(life, 2)) * rMax - r * 10;
        if (rad <= 0) continue;
        ctx.strokeStyle = `hsla(${hue + 10}, 90%, 72%, ${life * (0.4 - r * 0.12)})`;
        ctx.lineWidth = 1.4 * life;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
