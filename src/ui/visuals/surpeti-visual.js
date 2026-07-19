// surpeti-visual.js — a slow breathing mandala. One concentric petal ring per
// active drone voice, rose-hued, inhaling/exhaling on the bellows rate and gently
// counter-rotating, with a soft central bindu. Each harmony bar-start blooms the
// rings outward. Distinct from every other pane (radial, meditative, symmetric).

export function createSurpetiVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, bloom = 0;

  const unsub = conductor.on("note", (n) => {
    if (n.instrument === instrument.id) bloom = 1;
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
    bloom = Math.max(0, bloom - step * 1.6);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(14, 6, 12, 0.2)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    const cx = w / 2, cy = h / 2;
    const breathe = 0.92 + 0.08 * Math.sin(t * 0.28 * Math.PI * 2); // ~0.28 Hz bellows
    const base = Math.min(w, h) * 0.42;
    const rings = Math.max(1, Math.round(instrument.params.voices));
    const reed = instrument.params.reed;
    const beat = instrument.params.beating / 18;

    for (let r = 0; r < rings; r++) {
      const radius = base * (0.32 + r * 0.2) * breathe * (1 + bloom * 0.12);
      const petals = 6 + r * 4;
      const rot = t * (0.06 + r * 0.02) * (r % 2 ? -1 : 1);
      const alpha = (0.1 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.9 + r))) * (0.6 + 0.5 * reed) + bloom * 0.2;
      for (let pass = 0; pass < 2; pass++) {
        const off = pass === 0 ? 0 : beat * 0.06; // paired-reed beating shimmer
        ctx.strokeStyle = `hsla(${hue + r * 6 + pass * 20}, 80%, ${62 + r * 4}%, ${alpha * (pass ? 0.5 : 1)})`;
        ctx.lineWidth = 1.4;
        for (let pI = 0; pI < petals; pI++) {
          const a = rot + off + (pI / petals) * Math.PI * 2;
          const px = cx + Math.cos(a) * radius;
          const py = cy + Math.sin(a) * radius;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 0.12, radius * 0.05, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Central bindu.
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * (0.18 + 0.1 * breathe));
    bg.addColorStop(0, `hsla(${hue + 20}, 90%, 78%, ${0.22 + bloom * 0.3})`);
    bg.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, base * (0.2 + 0.1 * breathe), 0, Math.PI * 2);
    ctx.fill();
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
