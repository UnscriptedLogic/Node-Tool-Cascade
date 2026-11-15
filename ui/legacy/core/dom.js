import { $, ACT, CONNECTION, ICONS, LABEL, LOCAL, MOODS, MOOD_KEYS, PREFS, WEB } from "./constants.js";
import * as CascadeUI from "../../runtime.jsx";
import { AI, S, UI, hist } from "./state.js";
import { DOMAINS } from "./profiles.js";
export let stage, world, gEdges, gTh, elabel;
export function initialize() {
  stage = $('#stage');
  world = $('#world');
  gEdges = $('#eg');
  gTh = $('#th');
  elabel = $('#elabel');
  CascadeUI.connect({
    S,
    PREFS,
    UI,
    AI,
    CONNECTION,
    hist,
    ICONS,
    ACT,
    LABEL,
    DOMAINS,
    MOODS,
    MOOD_KEYS,
    LOCAL,
    WEB
  });
  CascadeUI.mount('rail', $('#railRoot'));
  CascadeUI.mount('hud', $('#hudRoot'));
  CascadeUI.mount('compose', $('#composeRoot'));
  CascadeUI.mount('menu', $('#menuRoot'));
}
