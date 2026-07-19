// rain-visual.js — falling rain: many short streaks raining top→bottom at varying
// speeds, a faint misty wash, and expanding impact rings splashing at the bottom
// when a drip rings out. Slate-blue. Distinct from every other pane (vertical
// falling streaks, not horizontal flow or radial fields). Always animating — rain
// never stops falling — reading its params live.

export function createRainVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  const FMIN = Math.log2(120), FMAX = Math.log2(4200);
  let w = 0, h = 0, t = 0;
  const streaks = [];
  const splashes = [];

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id || n.timbre !== "drop") return;
    const norm = (Math.log2(Math.max(1, n.freq)) - FMIN) / (FMAX - FMIN);
    splashes.push({
      x: 0.1 + 0.8 * Math.max(0, Math.min(1, norm)),
      age: 0,
      strength: 0.6 + (n.velocity || 0.5) * 0.6,
    });
    if (splashes.length > 40) splashes.shift();
  });

  function spawnStreak() {
    const speed = 0.7 + Math.random() * 1.6; // depth: faster = nearer
    streaks.push({
      x: Math.random(),
      y: -0.05 - Math.random() * 0.15,
      len: 0.04 + speed * 0.05,
      speed,
      drift: (Math.random() * 2 - 1) * 0.12, // slight diagonal slant
    });
  }

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
    const patter = instrument.params.patter ?? 0.55;
    const hiss = instrument.params.hiss ?? 0.4;

    // Trailing fade.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(6, 9, 16, 0.22)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Faint misty wash — a soft drifting band, brighter with hiss.
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.05 * Math.PI * 2);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `hsla(${hue}, 55%, 60%, ${(0.02 + 0.03 * breathe) * (0.4 + hiss)})`);
    grad.addColorStop(1, `hsla(${hue + 10}, 60%, 50%, ${(0.05 + 0.04 * breathe) * (0.4 + hiss)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Keep a population of streaks proportional to patter — rain always falls.
    const target = Math.round(20 + patter * 150);
    while (streaks.length < target) spawnStreak();
    let cull = streaks.length > target ? streaks.length - target : 0;

    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.y += s.speed * step * 1.15;
      s.x += s.drift * step;
      if (s.y - s.len > 1) {
        if (cull > 0) { streaks.splice(i, 1); cull--; }
        else { s.y = -s.len - Math.random() * 0.1; s.x = Math.random(); }
        continue;
      }
      const x0 = s.x * w, y0 = s.y * h;
      const x1 = x0 - s.drift * s.len * w * 0.5, y1 = (s.y - s.len) * h;
      ctx.strokeStyle = `hsla(${hue + 12}, 75%, 78%, ${0.1 + s.speed * 0.14})`;
      ctx.lineWidth = 0.6 + s.speed * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Impact rings — splashes at the bottom when a drip rings out.
    for (let i = splashes.length - 1; i >= 0; i--) {
      const sp = splashes[i];
      sp.age += step;
      const life = 1 - sp.age / 0.9;
      if (life <= 0) { splashes.splice(i, 1); continue; }
      const cx = sp.x * w, cy = h * 0.9;
      const rMax = Math.min(w, h) * 0.2 * sp.strength;
      for (let r = 0; r < 2; r++) {
        const rad = (1 - Math.pow(life, 2)) * rMax - r * 9;
        if (rad <= 0) continue;
        // Flattened ring — a splash spreading on a surface.
        ctx.strokeStyle = `hsla(${hue + 8}, 85%, 76%, ${life * (0.42 - r * 0.13)})`;
        ctx.lineWidth = 1.4 * life;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
