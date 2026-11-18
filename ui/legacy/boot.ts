import { subscribe } from "valtio/vanilla";
import { finishOpenRouterLogin } from "./ai/transport.ts";
import { layout } from "./canvas/layout.ts";
import { applyLook } from "./canvas/look.ts";
import { applyView } from "./canvas/view.ts";
import { CONNECTION, LOCAL } from "./core/constants.ts";
import { loaded, S } from "./core/state.ts";
import { pruneThreads } from "./features/ask.ts";
import { libInit } from "./features/library.ts";
import { PANEL, renderMap } from "./features/map.ts";
import { initialView } from "./shell/actions.ts";
import { setBusy } from "./shell/hud.ts";
import { openSettings } from "./shell/settings.ts";
export let libReady = null;
export function startBoot() {
	/* ================= boot ================= */
	applyLook({
		noSave: true,
	});
	layout(true);
	applyView();
	if (loaded?.view && Number.isFinite(+loaded.view.z)) {
		Object.assign(S.view, loaded.view);
		applyView();
	} else initialView(true);
	setBusy(null);
	libReady = libInit().catch(() => {
		/* The canvas remains usable if the library cannot be loaded. */
	});
	// finds the library (and, signed in on the cloud, the account's AI) this page can use
	if (new URLSearchParams(location.search).has("code"))
		libReady.then(() => finishOpenRouterLogin());
	else if (LOCAL && CONNECTION.server && CONNECTION.server.active === "demo") {
		try {
			if (!localStorage.getItem("cascade-seen-settings")) {
				localStorage.setItem("cascade-seen-settings", "1");
				setTimeout(() => openSettings("ai"), 500);
			}
		} catch {}
	}
	subscribe(S, () => {
		pruneThreads();
		if (PANEL.open && PANEL.tab === "map") renderMap();
	});
}
