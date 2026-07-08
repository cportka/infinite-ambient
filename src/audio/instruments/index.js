// index.js — the instrument registry. The UI (palette, panes) is driven entirely
// by this list; adding an instrument here is all it takes to make it available.

import { InfiniteDrone, meta as droneMeta } from "./infinite-drone.js";
import { createDroneVisual } from "../../ui/visuals/drone-visual.js";
import { Filament, meta as filamentMeta } from "./filament.js";
import { createFilamentVisual } from "../../ui/visuals/filament-visual.js";

export const REGISTRY = [
  {
    meta: droneMeta,
    create: (conductor, audio) => new InfiniteDrone(conductor, audio).mount(),
    createVisual: (canvas, instrument, conductor) => createDroneVisual(canvas, instrument, conductor),
  },
  {
    meta: filamentMeta,
    create: (conductor, audio) => new Filament(conductor, audio).mount(),
    createVisual: (canvas, instrument, conductor) => createFilamentVisual(canvas, instrument, conductor),
  },
];

export const byId = (id) => REGISTRY.find((r) => r.meta.id === id);
