// global-controls.js — the top bar. The Key is shared by the whole ensemble
// (it seeds the conductor's tonal field); transport, pace, and volume are global.
// The add-instrument menu is generated from the registry.

import { NAMED_KEYS, DEFAULT_KEY } from "../audio/presets.js";

export function setupGlobalControls({ audio, conductor, paneManager }) {
  const $ = (id) => document.getElementById(id);

  // --- key ----------------------------------------------------------------
  const keyInput = $("keyInput");
  const chipsWrap = $("keyChips");
  const chips = {};
  for (const { label, key } of NAMED_KEYS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => loadKey(key));
    chipsWrap.appendChild(b);
    chips[key] = b;
  }
  function markChip(key) {
    for (const [k, b] of Object.entries(chips)) b.classList.toggle("active", k === key);
  }
  function loadKey(key) {
    const k = String(key).trim();
    if (!k) return;
    conductor.setKey(k);
    keyInput.value = conductor.key;
    markChip(conductor.key);
  }
  $("keyApply").addEventListener("click", () => loadKey(keyInput.value));
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadKey(keyInput.value);
  });
  $("keyNew").addEventListener("click", () => {
    import("../audio/piece.js").then(({ randomKey }) => loadKey(randomKey()));
  });
  $("keyCopy").addEventListener("click", async () => {
    const btn = $("keyCopy");
    try {
      await navigator.clipboard.writeText(conductor.key);
      btn.textContent = "copied";
      setTimeout(() => (btn.textContent = "copy"), 1200);
    } catch (_) {
      keyInput.select();
    }
  });

  // --- transport ----------------------------------------------------------
  const playBtn = $("playAll");
  let playing = false;
  async function setPlaying(next) {
    playing = next;
    if (playing) {
      await audio.resume();
      paneManager.startAll();
      conductor.start();
    } else {
      conductor.stop();
      paneManager.stopAll();
    }
    playBtn.classList.toggle("playing", playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.querySelector(".label").textContent = playing ? "Pause" : "Play";
    document.body.classList.toggle("is-playing", playing);
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));
  window.addEventListener("keydown", (e) => {
    const typing = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
    if (e.code === "Space" && !typing) {
      e.preventDefault();
      setPlaying(!playing);
    }
  });

  // --- pace + volume ------------------------------------------------------
  const pace = $("pace");
  pace.value = conductor.pace;
  pace.addEventListener("input", () => conductor.setPace(Number(pace.value)));
  const volume = $("volume");
  volume.addEventListener("input", () => audio.setMasterVolume(Number(volume.value)));

  // --- add instrument -----------------------------------------------------
  const addBtn = $("addBtn");
  const menu = $("addMenu");
  for (const inst of paneManager.availableInstruments()) {
    const item = document.createElement("button");
    item.className = "add-item";
    item.style.setProperty("--hue", inst.hue);
    item.innerHTML = `<span class="dot"></span> ${inst.name} <em>${inst.role}</em>`;
    item.addEventListener("click", () => {
      paneManager.addInstrument(inst.id);
      menu.classList.remove("open");
    });
    menu.appendChild(item);
  }
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));

  // initial key state (conductor already built with DEFAULT_KEY)
  keyInput.value = conductor.key || DEFAULT_KEY;
  markChip(conductor.key);

  return { setPlaying };
}
