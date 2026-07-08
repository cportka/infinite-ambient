// index.js — the instrument registry. The UI (palette, panes) is driven entirely
// by this list; adding an instrument here is all it takes to make it available.

import { InfiniteDrone, meta as droneMeta } from "./infinite-drone.js";
import { createDroneVisual } from "../../ui/visuals/drone-visual.js";
import { Filament, meta as filamentMeta } from "./filament.js";
import { createFilamentVisual } from "../../ui/visuals/filament-visual.js";
import { Electricity, meta as electricityMeta } from "./electricity.js";
import { createElectricityVisual } from "../../ui/visuals/electricity-visual.js";
import { Explosions, meta as explosionsMeta } from "./explosions.js";
import { createExplosionsVisual } from "../../ui/visuals/explosions-visual.js";

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
  {
    meta: electricityMeta,
    create: (conductor, audio) => new Electricity(conductor, audio).mount(),
    createVisual: (canvas, instrument, conductor) => createElectricityVisual(canvas, instrument, conductor),
  },
  {
    meta: explosionsMeta,
    create: (conductor, audio) => new Explosions(conductor, audio).mount(),
    createVisual: (canvas, instrument, conductor) => createExplosionsVisual(canvas, instrument, conductor),
  },
];

export const byId = (id) => REGISTRY.find((r) => r.meta.id === id);
