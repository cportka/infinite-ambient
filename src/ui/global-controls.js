// global-controls.js — the top bar. The Key now captures the WHOLE configuration:
// it reads `seed~<config>` where the seed still seeds the generative piece and the
// config encodes master volume, pace, and every open instrument (mute/mix/params).
// The field updates live on any change to the rack, so copying it saves/shares the
// exact soundscape and pasting one restores it. Typing a bare word re-seeds the
// music but keeps the current rack. The add-instrument menu is registry-driven.

import { NAMED_KEYS, DEFAULT_KEY } from "../audio/presets.js";
import { buildKey, parseKey } from "../audio/session.js";

export function setupGlobalControls({ audio, conductor, paneManager }) {
  const $ = (id) => document.getElementById(id);

  // Safety net: some browsers need the AudioContext resumed inside a user gesture
  // and can leave a page-load context suspended. Resume on the very first gesture
  // anywhere (in addition to the Play handler), then detach.
  const kick = () => {
    audio.resume();
    window.removeEventListener("pointerdown", kick, true);
    window.removeEventListener("keydown", kick, true);
  };
  window.addEventListener("pointerdown", kick, true);
  window.addEventListener("keydown", kick, true);

  const keyInput = $("keyInput");
  const chipsWrap = $("keyChips");
  const volume = $("volume");
  const pace = $("pace");

  // roll animation shared by every dice button
  const roll = (btn) => {
    btn.classList.remove("rolling");
    void btn.offsetWidth;
    btn.classList.add("rolling");
    btn.addEventListener("animationend", () => btn.classList.remove("rolling"), { once: true });
  };

  // --- the live key -------------------------------------------------------
  function currentState() {
    return {
      volume: Number(volume.value),
      pace: Number(pace.value),
      instruments: paneManager.snapshot(),
    };
  }
  let editing = false; // don't clobber the field while the user is typing in it
  function refreshKey() {
    const full = buildKey(conductor.key, currentState());
    if (!editing) keyInput.value = full;
    markChip(conductor.key);
    try { history.replaceState(null, "", "#k=" + encodeURIComponent(full)); } catch (_) {}
  }
  let pending = false;
  function refreshKeySoon() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; refreshKey(); });
  }

  // Apply a key. Full key (has `~config`) → restore the whole rack; bare word →
  // re-seed the music but keep the current rack.
  function loadKey(text) {
    const { seed, config } = parseKey(text);
    if (!seed && !config) return;
    if (seed) conductor.setKey(seed);
    // Only restore a rack from a config that actually decoded to instruments, so a
    // garbled paste (valid prefix, no readable instruments) can't wipe the rack.
    if (config && config.instruments.length) {
      volume.value = config.volume;
      audio.setMasterVolume(config.volume);
      pace.value = config.pace;
      conductor.setPace(config.pace);
      paneManager.applySession(config.instruments);
    }
    refreshKey();
  }

  // --- key field + starters ----------------------------------------------
  const chips = {};
  for (const { label, key } of NAMED_KEYS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => loadKey(key)); // a starter is a bare seed
    chipsWrap.appendChild(b);
    chips[key] = b;
  }
  function markChip(key) {
    for (const [k, b] of Object.entries(chips)) b.classList.toggle("active", k === key);
  }

  keyInput.addEventListener("focus", () => { editing = true; });
  keyInput.addEventListener("blur", () => {
    editing = false;
    if (keyInput.value.trim()) loadKey(keyInput.value);
    else refreshKey();
  });
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { loadKey(keyInput.value); keyInput.blur(); }
  });

  $("keyNew").addEventListener("click", () => {
    roll($("keyNew"));
    import("../audio/piece.js").then(({ randomKey }) => loadKey(randomKey()));
  });
  $("keyCopy").addEventListener("click", async () => {
    const btn = $("keyCopy");
    try {
      await navigator.clipboard.writeText(keyInput.value);
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = "Copy"), 1200);
    } catch (_) {
      keyInput.select();
    }
  });

  // --- transport ----------------------------------------------------------
  const playBtn = $("playAll");
  let playing = false;
  let busy = false; // re-entrancy guard (audio.resume() genuinely awaits first gesture)
  function paintTransport() {
    playBtn.classList.toggle("playing", playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.querySelector(".label").textContent = playing ? "Pause" : "Play";
    document.body.classList.toggle("is-playing", playing);
  }
  async function setPlaying(next) {
    if (busy || next === playing) return;
    busy = true;
    try {
      if (next) {
        await audio.resume();
        paneManager.startAll();
        conductor.start();
      } else {
        conductor.stop();
        paneManager.stopAll();
      }
      playing = next;
      paintTransport();
    } finally {
      busy = false;
    }
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
  pace.value = conductor.pace;
  pace.addEventListener("input", () => { conductor.setPace(Number(pace.value)); refreshKeySoon(); });
  volume.addEventListener("input", () => { audio.setMasterVolume(Number(volume.value)); refreshKeySoon(); });

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
  function reflectCap() {
    addBtn.disabled = paneManager.full;
    addBtn.title = paneManager.full ? "Maximum 12 instruments" : "Add an instrument";
  }
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (paneManager.full) return;
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));

  // Keep the key (and the add-cap) live as the rack changes.
  paneManager.onConfigChange(() => { refreshKeySoon(); reflectCap(); });

  keyInput.value = conductor.key || DEFAULT_KEY;
  reflectCap();

  return { setPlaying, refreshKey, loadKey };
}
