// pane-manager.js — owns the panes, the shared background compositor, and the one
// animation loop that draws them all. Instruments are created from the registry;
// the palette and every pane are generic over meta. It also exposes a snapshot /
// restore of the whole rack (for the shareable config key) and notifies listeners
// whenever the configuration changes, so the key can update live.

import { Pane } from "./pane.js";
import { REGISTRY, byId } from "../audio/instruments/index.js";
import { createBackground } from "./visuals/background.js";
import { MAX_INSTRUMENTS } from "../audio/session.js";

export class PaneManager {
  constructor({ container, bgCanvas, audio, conductor }) {
    this.container = container;
    this.audio = audio;
    this.conductor = conductor;
    this.panes = [];
    this._changeCbs = [];

    const hueOf = (id) => byId(id)?.meta.hue ?? 220;
    this.background = createBackground(bgCanvas, audio, conductor, hueOf);

    this._raf = null;
    this._last = 0;
    this._seq = 0;
    window.addEventListener("resize", () => this._resizeAll());
  }

  get instruments() {
    return this.panes.map((p) => p.instrument);
  }

  get count() {
    return this.panes.length;
  }
  get full() {
    return this.panes.length >= MAX_INSTRUMENTS;
  }

  // Register a listener fired whenever the rack changes (add/close/mute/mix/param/
  // dice). Used to keep the live key in sync.
  onConfigChange(cb) {
    this._changeCbs.push(cb);
    return () => {
      this._changeCbs = this._changeCbs.filter((c) => c !== cb);
    };
  }
  _notifyChange() {
    for (const cb of this._changeCbs) {
      try { cb(); } catch (_) {}
    }
  }

  // opts: { muted, mix, params, silent }. `silent` suppresses the change notify so
  // bulk loads (default rack / restore) can fire a single notify at the end.
  addInstrument(id, opts = {}) {
    if (this.full) return null;
    const entry = byId(id);
    if (!entry) return null;
    const instrument = entry.create(this.conductor, this.audio);
    // Unique per-instance id so duplicate instruments don't collide on their
    // note/report/visual routing (meta.id stays the type; instrument.id is the instance).
    instrument.id = `${id}-${++this._seq}`;
    if (opts.params) for (const [k, v] of Object.entries(opts.params)) instrument.setParam(k, v);
    if (opts.mix != null) instrument.setMix(opts.mix);
    if (opts.muted) instrument.setMuted(true); // before the pane so its button reflects it
    const pane = new Pane(instrument, entry.createVisual, this.conductor, {
      onClose: (p) => this.removePane(p),
      onChange: () => this._notifyChange(),
    });
    this.panes.push(pane);
    this.container.appendChild(pane.el);
    requestAnimationFrame(() => pane.resize());
    if (this.conductor.running) instrument.start();
    if (!opts.silent) this._notifyChange();
    return pane;
  }

  removePane(pane) {
    pane.el.classList.add("closing");
    setTimeout(() => {
      this.panes = this.panes.filter((p) => p !== pane);
      pane.dispose();
    }, 260);
    this._notifyChange();
  }

  // A snapshot of the whole rack for the config key.
  snapshot() {
    return this.panes.map((p) => {
      const i = p.instrument;
      return { code: i.meta.code, id: i.meta.id, muted: i.muted, mix: i._mix, params: { ...i.params } };
    });
  }

  // Replace the whole rack with the given instrument configs (from a pasted key).
  applySession(instruments) {
    for (const p of this.panes) p.dispose();
    this.panes = [];
    this.container.innerHTML = "";
    for (const inst of (instruments || []).slice(0, MAX_INSTRUMENTS)) {
      this.addInstrument(inst.id, { muted: inst.muted, mix: inst.mix, params: inst.params, silent: true });
    }
    this._notifyChange();
  }

  startAll() {
    for (const p of this.panes) p.instrument.start();
  }
  stopAll() {
    for (const p of this.panes) p.instrument.stop();
  }

  _resizeAll() {
    this.background.resize();
    for (const p of this.panes) p.resize();
  }

  // One shared RAF drives the background and every pane visual. Runs always so
  // visuals idle gently even when the audio is paused.
  startLoop() {
    if (this._raf) return;
    const loop = (t) => {
      const dt = this._last ? Math.min(0.05, (t - this._last) / 1000) : 0.016;
      this._last = t;
      this.background.draw(dt);
      for (const p of this.panes) p.draw(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  availableInstruments() {
    return REGISTRY.map((r) => ({ id: r.meta.id, name: r.meta.name, hue: r.meta.hue, role: r.meta.role }));
  }
}
