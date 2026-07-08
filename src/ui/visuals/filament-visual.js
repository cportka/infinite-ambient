// filament-visual.js — the constellation. Each pluck Filament announces ignites a
// star at its pitch-height; consecutive plucks are threaded with a fading line,
// and the whole field drifts left and decays like the string's ring-out. Driven
// by the conductor's `note` events for this instrument, tinted around its hue.

const LIFETIME = 6; // seconds a star lives on screen
const FMIN = Math.log2(50);
const FMAX = Math.log2(2400);

export function createFilamentVisual(canvas, instrument, conductor) {
  const ctx = canvas.getContext("2d");
  const hue = instrument.meta.hue;
  let w = 0, h = 0, last = 0;
  const stars = [];
  let prev = null;

  const unsub = conductor.on("note", (n) => {
    if (n.instrument !== instrument.id) return;
    const norm = (Math.log2(Math.max(1, n.freq)) - FMIN) / (FMAX - FMIN);
    const y = 1 - Math.max(0, Math.min(1, norm));
    const star = { y, age: 0, vel: n.velocity || 0.5, link: prev };
    stars.push(star);
    prev = star;
    if (stars.length > 120) stars.shift();
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // x position from a star's age: born at the right, drifts left as it ages.
  const xOf = (age) => w * (1 - age / LIFETIME);

  function draw(dt) {
    if (!w || !h) resize();
    const step = dt || 0.016;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(8, 7, 14, 0.22)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.age += step;
      if (s.age > LIFETIME) {
        stars.splice(i, 1);
        continue;
      }
      const life = 1 - s.age / LIFETIME;
      const x = xOf(s.age);
      const y = s.y * h;

      // thread to the previous star
      if (s.link && s.link.age <= LIFETIME) {
        const lx = xOf(s.link.age);
        const ly = s.link.y * h;
        ctx.strokeStyle = `hsla(${hue}, 90%, 70%, ${0.12 * life})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      const r = (1.5 + s.vel * 5) * (0.4 + life);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      grad.addColorStop(0, `hsla(${hue + s.vel * 20}, 95%, 72%, ${0.5 * life})`);
      grad.addColorStop(1, `hsla(${hue}, 95%, 72%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${hue + 30}, 100%, 85%, ${0.7 * life})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.6, r * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    last = step;
  }

  resize();
  return {
    draw,
    resize,
    dispose() { unsub(); },
  };
}
