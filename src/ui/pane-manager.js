// pane-manager.js — owns the panes, the shared background compositor, and the one
// animation loop that draws them all. Instruments are created from the registry;
// the palette and every pane are generic over meta.

import { Pane } from "./pane.js";
import { REGISTRY, byId } from "../audio/instruments/index.js";
import { createBackground } from "./visuals/background.js";

export class PaneManager {
  constructor({ container, bgCanvas, audio, conductor }) {
    this.container = container;
    this.audio = audio;
    this.conductor = conductor;
    this.panes = [];

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

  addInstrument(id) {
    const entry = byId(id);
    if (!entry) return null;
    const instrument = entry.create(this.conductor, this.audio);
    // Unique per-instance id so duplicate instruments don't collide on their
    // note/report/visual routing (meta.id stays the type; instrument.id is the instance).
    instrument.id = `${id}-${++this._seq}`;
    const pane = new Pane(instrument, entry.createVisual, this.conductor, {
      onClose: (p) => this.removePane(p),
    });
    this.panes.push(pane);
    this.container.appendChild(pane.el);
    requestAnimationFrame(() => pane.resize());
    if (this.conductor.running) instrument.start();
    return pane;
  }

  removePane(pane) {
    pane.el.classList.add("closing");
    setTimeout(() => {
      this.panes = this.panes.filter((p) => p !== pane);
      pane.dispose();
    }, 260);
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
