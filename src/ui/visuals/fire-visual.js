// fire-visual.js — a bottom-rooted flame field (never a burst): licking flame
// tongues, rising embers, tiny crackle flecks, and a warm breathing glow. Flares
// (announced 'flare' notes) surge the nearest tongue. Distinct from Explosions'
// radial shockwaves. Warm red-orange hue.

export function createFireVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, crackAt = 0;
  const embers = [];
  const flecks = [];
  const tongues = Array.from({ length: 6 }, (_, i) => ({
    x: 0.12 + (i / 5) * 0.76,
    phase: Math.random() * 6,
    surge: 0,
  }));

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id || n.timbre !== "flare") return;
    // surge the tongue nearest a random x
    const x = 0.2 + Math.random() * 0.6;
    let best = tongues[0];
    for (const tg of tongues) if (Math.abs(tg.x - x) < Math.abs(best.x - x)) best = tg;
    best.surge = 1;
    for (let i = 0; i < 8; i++) embers.push(newEmber(best.x * w, h * 0.7, 1));
  });

  function newEmber(x, y, boost) {
    return { x, y, vy: -(20 + Math.random() * 50) * boost, vx: (Math.random() * 2 - 1) * 14, age: 0, life: 1.6 + Math.random() * 1.6 };
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
    const roar = instrument.params.roar ?? 0.6;
    const crackle = instrument.params.crackle ?? 0.5;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(14, 6, 3, 0.22)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Warm breathing glow rooted at the base.
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.15 * Math.PI * 2);
    const gy = h * 0.95;
    const gr = Math.min(w, h) * (0.5 + 0.25 * breathe) * (0.6 + roar);
    const grad = ctx.createRadialGradient(w / 2, gy, 0, w / 2, gy, gr);
    grad.addColorStop(0, `hsla(${hue + 20}, 100%, 55%, ${0.09 + 0.06 * breathe})`);
    grad.addColorStop(1, `hsla(${hue}, 100%, 45%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Flame tongues — filled shapes licking up from the bottom.
    for (const tg of tongues) {
      tg.surge = Math.max(0, tg.surge - step * 1.2);
      const baseX = tg.x * w;
      const flame = 0.5 + 0.5 * Math.sin(t * 3 + tg.phase) * Math.sin(t * 1.7 + tg.phase * 2);
      const height = h * (0.28 + 0.22 * flame) * (0.7 + roar) * (1 + tg.surge * 1.1);
      const sway = Math.sin(t * 2.3 + tg.phase) * w * 0.03;
      const wobble = Math.sin(t * 5 + tg.phase) * w * 0.015;
      const grd = ctx.createLinearGradient(0, h, 0, h - height);
      grd.addColorStop(0, `hsla(${hue + 40}, 100%, ${70 + tg.surge * 20}%, ${0.28 + tg.surge * 0.3})`);
      grd.addColorStop(0.5, `hsla(${hue + 15}, 100%, 55%, 0.18)`);
      grd.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(baseX - w * 0.05, h);
      ctx.quadraticCurveTo(baseX - w * 0.04 + wobble, h - height * 0.5, baseX + sway, h - height);
      ctx.quadraticCurveTo(baseX + w * 0.04 + wobble, h - height * 0.5, baseX + w * 0.05, h);
      ctx.closePath();
      ctx.fill();
      // occasional ember at the tip
      if (Math.random() < 0.08 * (0.4 + roar)) embers.push(newEmber(baseX + sway, h - height, 0.7));
    }

    // Crackle flecks — tiny bright pops, rate from the crackle knob.
    if (t > crackAt) {
      const tg = tongues[Math.floor(Math.random() * tongues.length)];
      flecks.push({ x: tg.x * w + (Math.random() * 2 - 1) * w * 0.06, y: h * (0.5 + Math.random() * 0.4), age: 0 });
      crackAt = t + 0.04 + (1 - crackle) * 0.25 * Math.random();
    }
    for (let i = flecks.length - 1; i >= 0; i--) {
      const f = flecks[i];
      f.age += step;
      if (f.age > 0.14) { flecks.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${hue + 45}, 100%, 88%, ${(1 - f.age / 0.14) * 0.9})`;
      ctx.fillRect(f.x, f.y, 2, 2);
    }

    // Embers rising.
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.age += step;
      if (e.age > e.life) { embers.splice(i, 1); continue; }
      e.vy += -6 * step; // buoyancy
      e.x += e.vx * step + Math.sin(t * 3 + e.y) * 4 * step;
      e.y += e.vy * step;
      const life = 1 - e.age / e.life;
      ctx.fillStyle = `hsla(${hue + 20 * life}, 100%, ${55 + life * 25}%, ${life * 0.7})`;
      ctx.fillRect(e.x, e.y, 2, 2);
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
