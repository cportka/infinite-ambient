// main.js — boot the rack: shared audio system, conductor, pane manager (with the
// background compositor), global controls, and the opening configuration.

import { createAudioSystem } from "./audio/context.js";
import { Conductor } from "./audio/conductor.js";
import { PaneManager } from "./ui/pane-manager.js";
import { setupGlobalControls } from "./ui/global-controls.js";
import { parseKey } from "./audio/session.js";
import { VERSION } from "./version.js";

// Stamp the version next to the title.
const versionEl = document.getElementById("version");
if (versionEl) versionEl.textContent = `v${VERSION}`;

const audio = createAudioSystem();
const conductor = new Conductor(audio);

const paneManager = new PaneManager({
  container: document.getElementById("panes"),
  bgCanvas: document.getElementById("bg"),
  audio,
  conductor,
});

const controls = setupGlobalControls({ audio, conductor, paneManager });

// A shared link can carry the whole configuration in the URL (#k=<key>).
function incomingKey() {
  try {
    const k = new URLSearchParams(location.hash.replace(/^#/, "")).get("k");
    return k || null;
  } catch (_) {
    return null;
  }
}

// Six random other instruments' ids (excluding the drone), for the default rack.
function randomOthers(n) {
  const ids = paneManager.availableInstruments().map((i) => i.id).filter((id) => id !== "infinite-drone");
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, n);
}

const raw = incomingKey();
const incoming = raw ? parseKey(raw) : null;

if (incoming && incoming.config && incoming.config.instruments.length) {
  // Restore a shared soundscape exactly as it was captured.
  controls.loadKey(raw);
} else {
  // Fresh start: show 6 instruments — always the Infinite Drone (the only one
  // sounding) plus 5 random others, muted, so the first impression is calm and
  // a little different every visit. Add or remove any from the instrument menu.
  if (incoming && incoming.seed) conductor.setKey(incoming.seed);
  paneManager.addInstrument("infinite-drone", { silent: true });
  for (const id of randomOthers(5)) paneManager.addInstrument(id, { muted: true, silent: true });
}

// Visuals animate continuously (they idle gently when paused).
paneManager.startLoop();

// Auto-play on load. If the browser blocks audio until a gesture, the context
// stays suspended and the resume-on-first-gesture safety kicks it in.
controls.setPlaying(true);

// Build the live key from the opening state.
controls.refreshKey();

// Expose for console tinkering / debugging.
window.__ambient = { audio, conductor, paneManager, controls };
