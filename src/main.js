// main.js — boot the rack: shared audio system, conductor, pane manager (with the
// background compositor), global controls, and the two default instruments.

import { createAudioSystem } from "./audio/context.js";
import { Conductor } from "./audio/conductor.js";
import { PaneManager } from "./ui/pane-manager.js";
import { setupGlobalControls } from "./ui/global-controls.js";
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

// Open with the full ensemble shown, but only the Infinite Drone sounding — the
// rest start muted so the first impression is calm; unmute any pane to bring it in.
paneManager.addInstrument("infinite-drone");
paneManager.addInstrument("surpeti", { muted: true });
paneManager.addInstrument("filament", { muted: true });
paneManager.addInstrument("water", { muted: true });
paneManager.addInstrument("fire", { muted: true });
paneManager.addInstrument("electricity", { muted: true });
paneManager.addInstrument("explosions", { muted: true });

// Visuals animate continuously (they idle gently when paused).
paneManager.startLoop();

// Auto-play on load. If the browser blocks audio until a gesture, the context
// stays suspended and the resume-on-first-gesture safety kicks it in.
controls.setPlaying(true);

// Expose for console tinkering / debugging.
window.__ambient = { audio, conductor, paneManager };
