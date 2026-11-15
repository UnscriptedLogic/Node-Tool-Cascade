import { applyLook } from "./canvas/look.js";
import { layout } from "./canvas/layout.js";
import { applyView } from "./canvas/view.js";
import { S, loaded } from "./core/state.js";
import { initialView } from "./ui/actions.js";
import { setBusy } from "./ui/hud.js";
import { libInit } from "./features/library.js";
import { finishOpenRouterLogin } from "./ai/transport.js";
import { CONNECTION, LOCAL } from "./core/constants.js";
import { openSettings } from "./ui/settings.js";
import * as CascadeUI from "../runtime.jsx";
import { pruneThreads } from "./features/ask.js";
import { PANEL, renderMap } from "./features/map.js";
export let libReady;
export function initialize() {
  /* ================= boot ================= */
  applyLook({
    noSave: true
  });
  layout(true);
  applyView();
  if (loaded && loaded.view && isFinite(loaded.view.z)) {
    Object.assign(S.view, loaded.view);
    applyView();
  } else initialView(true);
  setBusy(null);
  libReady = libInit().catch(() => {});
  // finds the library (and, signed in on the cloud, the account's AI) this page can use
  if (new URLSearchParams(location.search).has('code')) libReady.then(() => finishOpenRouterLogin());else if (LOCAL && CONNECTION.server && CONNECTION.server.active === 'demo') {
    try {
      if (!localStorage.getItem('cascade-seen-settings')) {
        localStorage.setItem('cascade-seen-settings', '1');
        setTimeout(() => openSettings('ai'), 500);
      }
    } catch (e) {}
  }
  CascadeUI.subscribe(S, () => {
    pruneThreads();
    if (PANEL.open && PANEL.tab === 'map') renderMap();
  });
}
