// pane.js — one instrument's pane: a full-bleed visual with a translucent glass
// control overlay. Controls are generated from the instrument's meta.params, so a
// pane knows nothing instrument-specific. A per-instrument dice re-rolls just this
// instrument's params (with a roll animation); every edit notifies `onChange` so
// the shared key can track the whole configuration live.

export class Pane {
  constructor(instrument, createVisual, conductor, { onClose, onChange }) {
    this.instrument = instrument;
    this.conductor = conductor;
    this.onClose = onClose;
    this.onChange = onChange;
    this._paramInputs = {};
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
          <button class="icon-btn dice" title="Randomize this instrument" aria-label="Randomize this instrument">🎲</button>
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
    controls.appendChild(this._slider("Level", 0, 1, 0.01, instrument._mix, (v) => {
      instrument.setMix(v);
      this._changed();
    }));
    for (const p of instrument.meta.params) {
      const ref = this._slider(p.label, p.min, p.max, p.step, instrument.params[p.key], (v) => {
        instrument.setParam(p.key, v);
        this._changed();
      }, true);
      this._paramInputs[p.key] = { ...ref, p };
      controls.appendChild(ref.wrap);
    }

    const muteBtn = body.querySelector(".mute");
    const reflectMute = () => {
      muteBtn.setAttribute("aria-pressed", String(instrument.muted));
      muteBtn.classList.toggle("active", instrument.muted);
      muteBtn.textContent = instrument.muted ? "muted" : "mute";
    };
    muteBtn.addEventListener("click", () => {
      instrument.setMuted(!instrument.muted);
      reflectMute();
      this._changed();
    });
    reflectMute(); // reflect any initial muted state (e.g. muted-on-load)

    // Dice — re-roll just this instrument's params, with a roll animation.
    const diceBtn = body.querySelector(".dice");
    diceBtn.addEventListener("click", () => {
      this._roll(diceBtn);
      this.randomize();
    });

    body.querySelector(".close").addEventListener("click", () => this.onClose(this));

    this.visual = createVisual(canvas, instrument, conductor);
    requestAnimationFrame(() => el.classList.remove("opening"));
  }

  // Randomize every param of this instrument and reflect it in the sliders.
  randomize() {
    for (const p of this.instrument.meta.params) {
      let v = p.min + Math.random() * (p.max - p.min);
      v = Math.round(v / p.step) * p.step;
      v = Math.min(p.max, Math.max(p.min, v));
      this.instrument.setParam(p.key, v);
      const ref = this._paramInputs[p.key];
      if (ref) { ref.input.value = v; ref.fmt(); }
    }
    this._changed();
  }

  _roll(btn) {
    btn.classList.remove("rolling");
    // force reflow so the animation restarts on every click
    void btn.offsetWidth;
    btn.classList.add("rolling");
    btn.addEventListener("animationend", () => btn.classList.remove("rolling"), { once: true });
  }

  _changed() {
    this.onChange?.();
  }

  // Returns { wrap, input, fmt } so callers (dice) can push new values back in.
  _slider(label, min, max, step, value, onInput, wantRef) {
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
    return wantRef ? { wrap, input, fmt } : wrap;
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
