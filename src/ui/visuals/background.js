// background.js — the broader visual story. One full-window canvas behind every
// pane. It reads the master analyser for the ensemble's overall energy (a slow
// drifting glow field) and listens to EVERY instrument's `note` events, sending a
// ripple across the whole window in that instrument's hue. So each pane's local
// visual and this shared field are driven by the same events — the panes feed the
// story and the story frames the panes.

export function createBackground(canvas, audio, conductor, hueOf) {
  const ctx = canvas.getContext("2d");
  const analyser = audio.analyser;
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const ripples = [];
  let w = 0, h = 0, phase = 0, energy = 0;

  const roleY = { bed: 0.8, texture: 0.6, lead: 0.32, rhythm: 0.5, element: 0.55 };

  const unsub = conductor.on("note", (n) => {
    const hue = n.hue ?? hueOf(n.instrument);
    const fx = clamp01((Math.log2(Math.max(1, n.freq)) - 5.6) / 6); // ~48Hz..~2.7kHz
    const baseY = roleY[n.role] ?? 0.5;
    ripples.push({
      x: fx,
      y: clamp01(baseY + (Math.sin(n.freq) * 0.08)),
      age: 0,
      life: 2.4 + (n.velocity || 0.5) * 2,
      vel: n.velocity || 0.5,
      hue,
    });
    if (ripples.length > 80) ripples.shift();
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
    phase += step * 0.05;

    analyser.getByteFrequencyData(freq);
    let sum = 0;
    for (let i = 0; i < freq.length; i++) sum += freq[i];
    const e = sum / freq.length / 255;
    energy += (e * 3 - energy) * 0.05;

    // Deep base wash + slow trailing fade.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4, 5, 14, 0.30)";
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    // Two slow drifting field glows — the ensemble's ambient light.
    for (let i = 0; i < 2; i++) {
      const gx = w * (0.5 + Math.sin(phase * (1.3 + i) + i * 2) * 0.35);
      const gy = h * (0.5 + Math.cos(phase * (1.1 + i)) * 0.3);
      const r = Math.min(w, h) * (0.35 + energy * 0.5);
      const hue = 240 + i * 40 + Math.sin(phase) * 20;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      grad.addColorStop(0, `hsla(${hue}, 70%, 45%, ${0.05 + energy * 0.12})`);
      grad.addColorStop(1, `hsla(${hue}, 70%, 45%, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Note ripples — every instrument's activity, in its own hue.
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.age += step;
      if (rp.age > rp.life) {
        ripples.splice(i, 1);
        continue;
      }
      const t = rp.age / rp.life;
      const x = rp.x * w;
      const y = rp.y * h;
      const rad = (0.02 + t * 0.16) * Math.min(w, h);
      ctx.strokeStyle = `hsla(${rp.hue}, 90%, 65%, ${(1 - t) * 0.22 * (0.5 + rp.vel)})`;
      ctx.lineWidth = 1.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
