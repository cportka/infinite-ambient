// musicbox-visual.js — a music-box comb of tines. A struck note spawns a bright
// glint that shoots UP its pitch column, twinkling with a soft bloom while a
// vertical "tine" of light shimmers beneath it; long Ring keeps the glints alive
// longer. Horizontal position maps pitch (log2 freq → x), so higher answers sit
// to the right. When it's quiet a faint drifting shimmer field keeps the surface
// alive. Lavender (hue 285). Distinct from Filament's puddle ripples and Water's
// horizontal flow — this rises and twinkles. Trailing fade + "lighter" blend.

const FMIN = Math.log2(160);
const FMAX = Math.log2(5000);
const LIFE = 3.2; // base seconds a glint lives (scaled by Ring)

export function createMusicBoxVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, t = 0, idleAt = 0.8;
  const glints = [];
  // A faint drifting shimmer field — always in slow motion, even in silence.
  const motes = [];

  function xForFreq(freq) {
    const norm = (Math.log2(Math.max(1, freq)) - FMIN) / (FMAX - FMIN);
    return 0.08 + 0.84 * Math.max(0, Math.min(1, norm));
  }

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    const ring = instrument.params.ring ?? 0.5;
    const strength = 0.55 + (n.velocity || 0.5) * 0.7;
    glints.push({
      x: xForFreq(n.freq),
      y: 0.9,             // enters low, rises
      vy: 0.16 + strength * 0.12,
      age: 0,
      life: LIFE * (0.55 + ring * 1.1),
      strength,
      tw: 6 + Math.random() * 8, // twinkle rate
      phase: Math.random() * Math.PI * 2,
    });
    if (glints.length > 70) glints.shift();
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Seed the idle shimmer field to fill the pane.
    if (motes.length === 0) {
      for (let i = 0; i < 26; i++) {
        motes.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.4, drift: 0.2 + Math.random() * 0.5, ph: Math.random() * Math.PI * 2 });
      }
    }
  }

  function draw(dt) {
    if (!w || !h) resize();
    const step = dt || 0.016;
    t += step;

    // Trailing fade.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(9, 6, 16, 0.17)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Idle shimmer field: soft lavender motes drifting up, twinkling. Keeps the
    // pane breathing when no notes are sounding.
    for (const m of motes) {
      const yy = ((m.y - t * 0.012 * m.drift) % 1 + 1) % 1;
      const tw = 0.5 + 0.5 * Math.sin(t * m.drift * 2 + m.ph);
      const a = 0.05 + 0.05 * tw;
      const cx = m.x * w, cy = yy * h;
      ctx.fillStyle = `hsla(${hue + 8 * tw}, 70%, 74%, ${a})`;
      ctx.beginPath();
      ctx.arc(cx, cy, m.r * (0.7 + 0.6 * tw), 0, Math.PI * 2);
      ctx.fill();
    }

    // Struck glints: rise up their pitch column, twinkling, with a vertical tine
    // shimmer trailing below and a soft bloom at the head.
    for (let i = glints.length - 1; i >= 0; i--) {
      const g = glints[i];
      g.age += step;
      if (g.age > g.life) { glints.splice(i, 1); continue; }
      const life = 1 - g.age / g.life;
      g.y -= g.vy * step;
      const cx = g.x * w;
      const cy = Math.max(0, g.y) * h;
      const twinkle = 0.6 + 0.4 * Math.sin(t * g.tw + g.phase);
      const a = life * g.strength * twinkle;

      // Vertical tine shimmer: a soft gradient column beneath the head.
      const tineTop = cy;
      const tineBot = Math.min(h, cy + h * 0.32 * (0.5 + g.strength * 0.5));
      const grad = ctx.createLinearGradient(cx, tineTop, cx, tineBot);
      grad.addColorStop(0, `hsla(${hue}, 90%, 78%, ${0.22 * a})`);
      grad.addColorStop(1, `hsla(${hue + 14}, 90%, 70%, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4 + g.strength;
      ctx.beginPath();
      ctx.moveTo(cx, tineTop);
      ctx.lineTo(cx, tineBot);
      ctx.stroke();

      // Bloom at the head.
      const rad = 4 + g.strength * 12 * (0.4 + 0.6 * twinkle);
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      bloom.addColorStop(0, `hsla(${hue + 20}, 100%, 88%, ${Math.min(0.9, a * 1.3)})`);
      bloom.addColorStop(0.5, `hsla(${hue}, 95%, 76%, ${a * 0.5})`);
      bloom.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();

      // Tiny bright core spark.
      ctx.fillStyle = `hsla(${hue + 30}, 100%, 94%, ${Math.min(1, a * 1.5)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.1 + g.strength * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Occasional idle spark so the comb glints even in long silences.
    if (t > idleAt && glints.length < 3) {
      glints.push({
        x: 0.12 + Math.random() * 0.76,
        y: 0.86, vy: 0.1, age: 0,
        life: LIFE * 0.7, strength: 0.3,
        tw: 5 + Math.random() * 6, phase: Math.random() * Math.PI * 2,
      });
      idleAt = t + 1.6 + Math.random() * 2.4;
    }
  }

  resize();
  return { draw, resize, dispose() { unsub(); } };
}
