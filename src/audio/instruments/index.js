// index.js — the instrument registry. The UI (palette, panes) is driven entirely
// by this list; adding an instrument here is all it takes to make it available.

import { InfiniteDrone, meta as droneMeta } from "./infinite-drone.js";
import { createDroneVisual } from "../../ui/visuals/drone-visual.js";
import { Surpeti, meta as surpetiMeta } from "./surpeti.js";
import { createSurpetiVisual } from "../../ui/visuals/surpeti-visual.js";
import { Filament, meta as filamentMeta } from "./filament.js";
import { createFilamentVisual } from "../../ui/visuals/filament-visual.js";
import { MusicBox, meta as musicboxMeta } from "./musicbox.js";
import { createMusicBoxVisual } from "../../ui/visuals/musicbox-visual.js";
import { Water, meta as waterMeta } from "./water.js";
import { createWaterVisual } from "../../ui/visuals/water-visual.js";
import { Fire, meta as fireMeta } from "./fire.js";
import { createFireVisual } from "../../ui/visuals/fire-visual.js";
import { Wind, meta as windMeta } from "./wind.js";
import { createWindVisual } from "../../ui/visuals/wind-visual.js";
import { Electricity, meta as electricityMeta } from "./electricity.js";
import { createElectricityVisual } from "../../ui/visuals/electricity-visual.js";
import { Rain, meta as rainMeta } from "./rain.js";
import { createRainVisual } from "../../ui/visuals/rain-visual.js";
import { Explosions, meta as explosionsMeta } from "./explosions.js";
import { createExplosionsVisual } from "../../ui/visuals/explosions-visual.js";

const entry = (meta, Class, createVisual) => ({
  meta,
  create: (conductor, audio) => new Class(conductor, audio).mount(),
  createVisual,
});

export const REGISTRY = [
  entry(droneMeta, InfiniteDrone, createDroneVisual),
  entry(surpetiMeta, Surpeti, createSurpetiVisual),
  entry(filamentMeta, Filament, createFilamentVisual),
  entry(musicboxMeta, MusicBox, createMusicBoxVisual),
  entry(waterMeta, Water, createWaterVisual),
  entry(fireMeta, Fire, createFireVisual),
  entry(windMeta, Wind, createWindVisual),
  entry(electricityMeta, Electricity, createElectricityVisual),
  entry(rainMeta, Rain, createRainVisual),
  entry(explosionsMeta, Explosions, createExplosionsVisual),
];

export const byId = (id) => REGISTRY.find((r) => r.meta.id === id);

// Stable 2-char code → registry entry, for the shareable config key. Codes are
// permanent per instrument type and never reused, so keys stay decodable forever.
export const byCode = (code) => REGISTRY.find((r) => r.meta.code === code);
