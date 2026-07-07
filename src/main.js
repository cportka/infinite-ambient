// main.js — wire the engine, visualizer, and controls together.

import { AmbientEngine } from "./audio/engine.js";
import { Visualizer } from "./ui/visualizer.js";
import { setupControls } from "./ui/controls.js";

const engine = new AmbientEngine();
const visualizer = new Visualizer(document.getElementById("viz"), engine);
setupControls(engine);

// The visual runs continuously (it idles gently when silent); the audio only
// starts on a user gesture, handled inside the controls.
visualizer.start();

// Expose for quick console tinkering / debugging.
window.__ambient = { engine, visualizer };
