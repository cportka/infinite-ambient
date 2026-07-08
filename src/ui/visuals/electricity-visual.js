// electricity-visual.js — a distinctly electric field: a breathing plasma core,
// constant faint crackle (idle micro-arcs), drifting sparks and hum scanlines,
// with full lightning bolts + a screen flash on the big cracks. Its own look —
// not the shared aurora. Tinted around the instrument's electric-cyan hue.

export function createElectricityVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, flash = 0, sparkAt = 1, arcAt = 0.6;
  const bolts = [];
  const sparks = [];

  function makeBolt(big) {
    const x0 = w * (0.1 + Math.random() * 0.8);
    const pts = [{ x: x0, y: 0 }];
    const segs = big ? 9 : 5;
    const spread = big ? w * 0.16 : w * 0.06;
    const endY = big ? h * (0.7 + Math.random() * 0.3) : h * (0.25 + Math.random() * 0.4);
    for (let i = 1; i <= segs; i++) {
      const f = i / segs;
      pts.push({ x: x0 + (Math.random() * 2 - 1) * spread * (1 - f * 0.3), y: endY * f });
    }
    bolts.push({ pts, age: 0, life: big ? 0.55 : 0.28, big });
    if (big) flash = 1;
  }

  // A short idle arc — a little jagged spark somewhere in the pane.
  function microArc() {
    const x0 = w * Math.random();
    const y0 = h * (0.2 + Math.random() * 0.6);
    const pts = [{ x: x0, y: y0 }];
    const segs = 3 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= segs; i++) {
      pts.push({ x: x0 + (Math.random() * 2 - 1) * w * 0.08, y: y0 + (Math.random() * 2 - 1) * h * 0.1 });
    }
    bolts.push({ pts, age: 0, life: 0.2, big: false });
  }

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    if (n.timbre === "thunder") makeBolt(true);
    else if (n.timbre === "crackle") makeBolt(false);
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
    ctx.fillStyle = "rgba(4, 8, 14, 0.28)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Breathing plasma core — an electric glow that swells and recedes.
    const breath = 0.5 + 0.5 * Math.sin(t * 0.5);
    const cx = w * (0.5 + Math.sin(t * 0.6) * 0.18);
    const cy = h * (0.5 + Math.cos(t * 0.47) * 0.14);
    const r = Math.min(w, h) * (0.26 + 0.14 * breath);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${hue}, 85%, 60%, ${0.05 + 0.06 * breath})`);
    grad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Hum scanlines drifting.
    for (let i = 0; i < 2; i++) {
      const y = ((t * (14 + i * 8)) % (h + 40)) - 20;
      ctx.fillStyle = `hsla(${hue}, 80%, 62%, ${0.035 + 0.02 * Math.sin(t * 30 + i)})`;
      ctx.fillRect(0, y, w, 2);
    }

    // Constant faint crackle so it's always alive.
    if (t > arcAt) { microArc(); arcAt = t + 0.35 + Math.random() * 0.7; }

    // Drifting sparks.
    if (t > sparkAt) {
      sparks.push({ x: Math.random() * w, y: Math.random() * h, age: 0, vx: (Math.random() * 2 - 1) * 24, vy: (Math.random() * 2 - 1) * 24 });
      sparkAt = t + 0.18 + Math.random() * 0.4;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += step;
      if (s.age > 0.7) { sparks.splice(i, 1); continue; }
      s.x += s.vx * step; s.y += s.vy * step;
      ctx.fillStyle = `hsla(${hue + 20}, 100%, 82%, ${(1 - s.age / 0.7) * 0.55})`;
      ctx.fillRect(s.x, s.y, 1.6, 1.6);
    }

    if (flash > 0.001) {
      ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${flash * 0.16})`;
      ctx.fillRect(0, 0, w, h);
      flash *= Math.pow(0.02, step);
    }

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.age += step;
      if (b.age > b.life) { bolts.splice(i, 1); continue; }
      const life = 1 - b.age / b.life;
      ctx.strokeStyle = `hsla(${hue + 30}, 100%, 86%, ${life})`;
      ctx.lineWidth = (b.big ? 2.4 : 1.1) * life;
      ctx.shadowColor = `hsla(${hue}, 100%, 70%, ${life})`;
      ctx.shadowBlur = b.big ? 16 : 6;
      ctx.beginPath();
      ctx.moveTo(b.pts[0].x, b.pts[0].y);
      for (let j = 1; j < b.pts.length; j++) ctx.lineTo(b.pts[j].x, b.pts[j].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
