// controls.js — bind the DOM to the engine. The centrepiece is the Key: a string
// that unlocks a piece. Named-key chips, a text field, a randomiser, and a copy
// button all funnel through engine.setKey / engine.newKey. The sliders are live
// performance controls layered on top; they don't change the piece's identity.

import { NAMED_KEYS, DEFAULT_KEY } from "../audio/presets.js";

// The 0..1 sliders and the element ids they map to.
const SLIDERS = ["volume", "motion", "shimmer", "brightness", "space", "pace"];

export function setupControls(engine) {
  const $ = (id) => document.getElementById(id);

  // --- named-key chips ----------------------------------------------------
  const keysWrap = $("keys");
  const chips = {};
  for (const { label, key } of NAMED_KEYS) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = label;
    btn.dataset.key = key;
    btn.addEventListener("click", () => loadKey(key));
    keysWrap.appendChild(btn);
    chips[key] = btn;
  }
  function markActiveChip(key) {
    for (const [k, b] of Object.entries(chips)) b.classList.toggle("active", k === key);
  }

  // --- key field ----------------------------------------------------------
  const keyInput = $("keyInput");
  const applyBtn = $("keyApply");
  const newBtn = $("keyNew");
  const copyBtn = $("keyCopy");

  function loadKey(key, { fromField = false } = {}) {
    const k = String(key).trim();
    if (!k) return;
    engine.setKey(k);
    keyInput.value = engine.key;
    markActiveChip(engine.key);
    syncSliders();
    flash(fromField ? applyBtn : null);
  }

  applyBtn.addEventListener("click", () => loadKey(keyInput.value, { fromField: true }));
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadKey(keyInput.value, { fromField: true });
  });
  newBtn.addEventListener("click", () => {
    const k = engine.newKey();
    keyInput.value = k;
    markActiveChip(k);
    syncSliders();
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(engine.key);
      copyBtn.textContent = "copied";
      setTimeout(() => (copyBtn.textContent = "copy"), 1200);
    } catch (_) {
      keyInput.select();
    }
  });

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
  playBtn.addEventListener("click", () => reflectPlaying(engine.toggle()));
  function reflectPlaying(playing) {
    playBtn.classList.toggle("playing", playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.querySelector(".label").textContent = playing ? "Pause" : "Play";
    document.body.classList.toggle("is-playing", playing);
  }

  // --- keyboard: space toggles (unless typing in the key field) -----------
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      reflectPlaying(engine.toggle());
    }
  });

  // --- helpers ------------------------------------------------------------
  function syncSliders() {
    for (const name of SLIDERS) {
      const el = $(name);
      if (el) {
        el.value = String(engine.params[name]);
        updateReadout(name, engine.params[name]);
      }
    }
  }
  function updateReadout(name, value) {
    const out = document.querySelector(`[data-readout="${name}"]`);
    if (out) out.textContent = `${Math.round(value * 100)}%`;
  }
  function flash(el) {
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 300);
  }

  // Initial state.
  loadKey(DEFAULT_KEY);

  return { reflectPlaying };
}
