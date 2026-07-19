// explosions-visual.js — shockwaves for the big blasts (large slow rings + radial
// debris) and scattered flecks for the shrapnel trills (crinkly crackle bursts).
// Embers drift upward when it's quiet so it never goes dead. Warm hue.

const SHAPE = {
  kick: { life: 1.6, rad: 0.55, deb: 8, w: 2.6 },
  boom: { life: 2.8, rad: 0.72, deb: 12, w: 3.0 },
};

export function createExplosionsVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, emberAt = 0.8, idleRingAt = 1.0;
  const waves = [];
  const debris = [];
  const embers = [];

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    const strength = 0.5 + (n.velocity || 0.5) * 0.6;
    if (n.timbre === "shrapnel") {
      // A tight scatter of crackle flecks flying off from a point.
      const sx = w * (0.15 + Math.random() * 0.7);
      const sy = h * (0.25 + Math.random() * 0.5);
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        debris.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.5 + Math.random() * 0.4, small: true });
      }
      return;
    }
    const s = SHAPE[n.timbre] || SHAPE.boom;
    const x = w * (0.5 + (Math.random() * 2 - 1) * 0.24);
    const y = h * (0.5 + Math.random() * 0.18);
    waves.push({ x, y, age: 0, life: s.life, maxR: Math.min(w, h) * s.rad * strength, w: s.w, hueJ: (Math.random() * 2 - 1) * 12 });
    for (let i = 0; i < s.deb; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (40 + Math.random() * 180) * strength;
      debris.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, age: 0, life: s.life * 0.9 });
    }
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

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(12, 6, 4, 0.24)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Breathing smoulder core — a warm glow that swells like distant fires.
    const breath = 0.5 + 0.5 * Math.sin(t * 0.4);
    const gx = w * (0.5 + Math.sin(t * 0.5) * 0.16);
    const gy = h * (0.62 + Math.cos(t * 0.4) * 0.1);
    const gr = Math.min(w, h) * (0.3 + 0.16 * breath);
    const cgrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    cgrad.addColorStop(0, `hsla(${hue + 8}, 95%, 55%, ${0.05 + 0.06 * breath})`);
    cgrad.addColorStop(1, `hsla(${hue}, 95%, 55%, 0)`);
    ctx.fillStyle = cgrad;
    ctx.fillRect(0, 0, w, h);

    // Faint idle shockwaves — distant rumbles keep it moving during the quiet.
    if (t > idleRingAt) {
      waves.push({ x: w * (0.3 + Math.random() * 0.4), y: h * (0.45 + Math.random() * 0.25), age: 0, life: 2.2, maxR: Math.min(w, h) * 0.3, w: 1.3, hueJ: 0 });
      idleRingAt = t + 2.0 + Math.random() * 2.4;
    }

    // Idle embers rising, so the pane keeps moving in the quiet.
    if (t > emberAt) {
      embers.push({ x: Math.random() * w, y: h + 4, vy: -(8 + Math.random() * 22), age: 0, life: 3 + Math.random() * 3 });
      emberAt = t + 0.5 + Math.random();
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.age += step;
      e.y += e.vy * step;
      e.x += Math.sin(t + e.y * 0.05) * 6 * step;
      if (e.age > e.life) { embers.splice(i, 1); continue; }
      const a = (1 - e.age / e.life) * 0.4;
      ctx.fillStyle = `hsla(${hue + 15}, 100%, 62%, ${a})`;
      ctx.fillRect(e.x, e.y, 2, 2);
    }

    // Shockwave rings.
    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      wv.age += step;
      if (wv.age > wv.life) { waves.splice(i, 1); continue; }
      const f = wv.age / wv.life;
      const life = 1 - f;
      const radius = wv.maxR * (1 - Math.pow(1 - f, 2)); // fast then easing out
      ctx.strokeStyle = `hsla(${hue + wv.hueJ + f * 25}, 100%, ${60 + f * 15}%, ${life * 0.5})`;
      ctx.lineWidth = wv.w * life;
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      if (wv.age < 0.12) {
        const glow = 1 - wv.age / 0.12;
        const grad = ctx.createRadialGradient(wv.x, wv.y, 0, wv.x, wv.y, 30);
        grad.addColorStop(0, `hsla(${hue + 30}, 100%, 75%, ${0.7 * glow})`);
        grad.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Debris + shrapnel flecks.
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += step;
      if (d.age > d.life) { debris.splice(i, 1); continue; }
      d.vy += (d.small ? 40 : 120) * step; // shrapnel is lighter, floatier
      d.x += d.vx * step;
      d.y += d.vy * step;
      const a = (1 - d.age / d.life) * (d.small ? 0.85 : 0.7);
      ctx.fillStyle = `hsla(${hue + (d.small ? 45 : 20)}, 100%, ${d.small ? 82 : 68}%, ${a})`;
      ctx.fillRect(d.x, d.y, d.small ? 1.5 : 2, d.small ? 1.5 : 2);
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
