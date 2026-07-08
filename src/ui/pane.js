// pane.js — one instrument's pane: a full-bleed visual with a translucent glass
// control overlay. Controls are generated from the instrument's meta.params, so a
// pane knows nothing instrument-specific.

export class Pane {
  constructor(instrument, createVisual, conductor, { onClose }) {
    this.instrument = instrument;
    this.conductor = conductor;
    this.onClose = onClose;
    const hue = instrument.meta.hue;

    const el = document.createElement("section");
    el.className = "pane opening";
    el.style.setProperty("--hue", hue);

    const canvas = document.createElement("canvas");
    canvas.className = "pane-viz";
    canvas.setAttribute("aria-hidden", "true");
    el.appendChild(canvas);

    const body = document.createElement("div");
    body.className = "pane-body";
    body.innerHTML = `
      <header class="pane-head">
        <span class="dot"></span>
        <span class="pane-name">${escapeHtml(instrument.meta.name)}</span>
        <span class="pane-role">${escapeHtml(instrument.meta.role)}</span>
        <span class="pane-head-actions">
          <button class="icon-btn mute" title="Mute" aria-pressed="false">mute</button>
          <button class="icon-btn close" title="Close instrument" aria-label="Close">✕</button>
        </span>
      </header>
      <p class="pane-blurb">${escapeHtml(instrument.meta.blurb || "")}</p>
      <div class="pane-controls"></div>
    `;
    el.appendChild(body);
    this.el = el;
    this.canvas = canvas;

    // Level (mix) + a slider per param.
    const controls = body.querySelector(".pane-controls");
    controls.appendChild(this._slider("Level", 0, 1, 0.01, instrument._mix, (v) => instrument.setMix(v)));
    for (const p of instrument.meta.params) {
      controls.appendChild(
        this._slider(p.label, p.min, p.max, p.step, instrument.params[p.key], (v) => instrument.setParam(p.key, v)),
      );
    }

    const muteBtn = body.querySelector(".mute");
    muteBtn.addEventListener("click", () => {
      const muted = !instrument.muted;
      instrument.setMuted(muted);
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.classList.toggle("active", muted);
      muteBtn.textContent = muted ? "muted" : "mute";
    });
    body.querySelector(".close").addEventListener("click", () => this.onClose(this));

    this.visual = createVisual(canvas, instrument, conductor);
    requestAnimationFrame(() => el.classList.remove("opening"));
  }

  _slider(label, min, max, step, value, onInput) {
    const wrap = document.createElement("label");
    wrap.className = "pane-control";
    const id = `c-${Math.round(min * 1000)}-${label}-${this.instrument.id}`.replace(/\s+/g, "");
    wrap.innerHTML = `<span class="cl">${escapeHtml(label)} <span class="cv"></span></span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.id = id;
    const readout = wrap.querySelector(".cv");
    const fmt = () => (readout.textContent = `${Math.round((input.value - min) / (max - min) * 100)}%`);
    fmt();
    input.addEventListener("input", () => {
      onInput(Number(input.value));
      fmt();
    });
    wrap.prepend(input);
    return wrap;
  }

  resize() {
    this.visual.resize();
  }
  draw(dt) {
    this.visual.draw(dt);
  }

  dispose() {
    this.visual.dispose();
    this.instrument.dispose();
    this.el.remove();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
