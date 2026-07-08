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

setupGlobalControls({ audio, conductor, paneManager });

// Open with the full ensemble — all instruments shown from the start.
paneManager.addInstrument("infinite-drone");
paneManager.addInstrument("filament");
paneManager.addInstrument("electricity");
paneManager.addInstrument("explosions");

// Visuals animate continuously (they idle gently when paused); audio waits for
// the first gesture via the transport.
paneManager.startLoop();

// Expose for console tinkering / debugging.
window.__ambient = { audio, conductor, paneManager };
