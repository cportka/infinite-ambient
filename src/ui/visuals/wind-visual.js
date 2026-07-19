// wind-visual.js — wind-blown streak lines streaming left→right across the pane
// at varying heights and speeds. Gusts (announced 'gust' notes) surge the overall
// brightness and spawn a wave of streaks; whistles ('whistle' notes) fire bright,
// fast, thin streaks. Self-animates continuously even when idle. Seafoam hue.
// Distinct from every other pane (horizontal streaming, not radial fields, water
// bands, or flame tongues).

export function createWindVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, gustGlow = 0;
  const streaks = [];
  const whistles = [];

  function newStreak(boost, fast) {
    const speed = (80 + Math.random() * 160) * (fast ? 2.4 : 1);
    return {
      x: -0.1 * (w || 300),
      y: (0.08 + Math.random() * 0.84),
      vx: speed,
      len: (fast ? 0.14 : 0.06) + Math.random() * (fast ? 0.18 : 0.14),
      wobA: (0.5 + Math.random() * 2) * (fast ? 0.4 : 1),
      wobF: 0.8 + Math.random() * 2.2,
      phase: Math.random() * 6.28,
      life: 0,
      bright: (fast ? 0.9 : 0.4) + Math.random() * 0.3 + boost * 0.4,
      thin: fast,
    };
  }

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    if (n.timbre === "gust") {
      gustGlow = Math.min(1.4, gustGlow + 0.8);
      for (let i = 0; i < 5; i++) streaks.push(newStreak(1, false));
    } else if (n.timbre === "whistle") {
      const s = newStreak(1, true);
      s.y = 0.12 + Math.random() * 0.5; // whistles streak higher
      whistles.push(s);
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

  function drawStreak(s, step, extraBright) {
    s.life += step;
    s.x += s.vx * step;
    const yBase = s.y * h + Math.sin(t * s.wobF + s.phase) * s.wobA * h * 0.03;
    const len = s.len * w;
    const grd = ctx.createLinearGradient(s.x - len, yBase, s.x, yBase);
    const a = s.bright * extraBright;
    grd.addColorStop(0, `hsla(${hue}, 80%, 70%, 0)`);
    grd.addColorStop(1, `hsla(${hue + 15}, 90%, ${s.thin ? 88 : 72}%, ${a})`);
    ctx.strokeStyle = grd;
    ctx.lineWidth = s.thin ? 1 : 1.4 + s.bright;
    ctx.beginPath();
    ctx.moveTo(s.x - len, yBase);
    ctx.lineTo(s.x, yBase);
    ctx.stroke();
  }

  function draw(dt) {
    if (!w || !h) resize();
    const step = dt || 0.016;
    t += step;
    const gust = instrument.params.gust ?? 0.55;
    const howl = instrument.params.howl ?? 0.5;
    const whistle = instrument.params.whistle ?? 0.3;

    gustGlow = Math.max(0, gustGlow - step * 0.9);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4, 14, 12, 0.2)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Ambient seafoam haze that breathes and brightens on gusts.
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.08 * Math.PI * 2);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const ha = (0.03 + 0.05 * breathe) * (0.5 + howl) + gustGlow * 0.05;
    grad.addColorStop(0, `hsla(${hue}, 70%, 45%, 0)`);
    grad.addColorStop(0.5, `hsla(${hue + 10}, 80%, 55%, ${ha})`);
    grad.addColorStop(1, `hsla(${hue}, 70%, 45%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Self-animating stream: keep a population of streaks proportional to howl.
    const target = Math.round(10 + howl * 26 + gust * 10);
    while (streaks.length < target) streaks.push(newStreak(0, false));

    const extra = 1 + gustGlow * 0.6;
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      // wind speed scales with gust knob and momentary gust glow
      s.x += s.vx * step * (0.4 + gust) * (1 + gustGlow * 0.5);
      s.life += step;
      const yBase = s.y * h + Math.sin(t * s.wobF + s.phase) * s.wobA * h * 0.03;
      const len = s.len * w;
      const grd = ctx.createLinearGradient(s.x - len, yBase, s.x, yBase);
      grd.addColorStop(0, `hsla(${hue}, 80%, 68%, 0)`);
      grd.addColorStop(1, `hsla(${hue + 12}, 85%, 68%, ${s.bright * 0.5 * extra})`);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.2 + s.bright;
      ctx.beginPath();
      ctx.moveTo(s.x - len, yBase);
      ctx.lineTo(s.x, yBase);
      ctx.stroke();
      if (s.x - len > w) { streaks.splice(i, 1); }
    }

    // Whistle streaks — bright, fast, thin, on top.
    for (let i = whistles.length - 1; i >= 0; i--) {
      const s = whistles[i];
      drawStreak(s, step * (1 + whistle), 1);
      if (s.x - s.len * w > w) whistles.splice(i, 1);
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
