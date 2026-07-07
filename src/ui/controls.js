// controls.js — bind the DOM controls to the engine, and build the dynamic bits
// (preset chips, key/scale option lists) from the audio modules so the two never
// drift apart.

import { PRESETS, DEFAULT_PRESET } from "../audio/presets.js";
import { SCALES, NOTE_NAMES } from "../audio/scales.js";

// The 0..1 slider params and the element ids they map to.
const SLIDERS = ["volume", "density", "brightness", "space", "pace"];

export function setupControls(engine) {
  const $ = (id) => document.getElementById(id);

  // --- preset chips -------------------------------------------------------
  const presetWrap = $("presets");
  const chips = {};
  for (const [name, preset] of Object.entries(PRESETS)) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = preset.label;
    btn.dataset.preset = name;
    btn.addEventListener("click", () => {
      engine.applyPreset(name);
      syncFromEngine();
      markActivePreset(name);
    });
    presetWrap.appendChild(btn);
    chips[name] = btn;
  }
  function markActivePreset(name) {
    for (const [n, b] of Object.entries(chips)) b.classList.toggle("active", n === name);
  }

  // --- key + scale selects ------------------------------------------------
  const keySel = $("key");
  NOTE_NAMES.forEach((note, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = note;
    keySel.appendChild(opt);
  });
  keySel.addEventListener("change", () => engine.setKey(Number(keySel.value)));

  const scaleSel = $("scale");
  for (const [name, scale] of Object.entries(SCALES)) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = scale.label;
    scaleSel.appendChild(opt);
  }
  scaleSel.addEventListener("change", () => engine.setScale(scaleSel.value));

  // --- sliders ------------------------------------------------------------
  for (const name of SLIDERS) {
    const el = $(name);
    if (!el) continue;
    el.addEventListener("input", () => {
      engine.setParam(name, Number(el.value));
      updateReadout(name, Number(el.value));
    });
  }

  // --- transport ----------------------------------------------------------
  const playBtn = $("playBtn");
  playBtn.addEventListener("click", () => {
    const playing = engine.toggle();
    reflectPlaying(playing);
  });

  function reflectPlaying(playing) {
    playBtn.classList.toggle("playing", playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.querySelector(".label").textContent = playing ? "Pause" : "Play";
    document.body.classList.toggle("is-playing", playing);
  }

  // --- randomize ----------------------------------------------------------
  $("randomBtn").addEventListener("click", () => {
    engine.randomize();
    syncFromEngine();
    markActivePreset(null);
  });

  // --- keyboard: space toggles transport ----------------------------------
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      reflectPlaying(engine.toggle());
    }
  });

  // Push the engine's current params back into every control.
  function syncFromEngine() {
    const p = engine.params;
    for (const name of SLIDERS) {
      const el = $(name);
      if (el) {
        el.value = String(p[name]);
        updateReadout(name, p[name]);
      }
    }
    keySel.value = String(p.key);
    scaleSel.value = p.scaleName;
  }

  function updateReadout(name, value) {
    const out = document.querySelector(`[data-readout="${name}"]`);
    if (out) out.textContent = `${Math.round(value * 100)}%`;
  }

  // Initial state.
  engine.applyPreset(DEFAULT_PRESET);
  syncFromEngine();
  markActivePreset(DEFAULT_PRESET);

  return { syncFromEngine, reflectPlaying };
}
