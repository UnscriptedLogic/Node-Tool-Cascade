import { state as aiQueue, growNode } from "./ai/prompts.ts";
import { layout, restyle } from "./canvas/layout.ts";
import { applyView, fitTo } from "./canvas/view.ts";
import { ANALYTICS } from "./core/analytics.ts";
import { MODE, PREFS } from "./core/constants.ts";
import {
	hist,
	loaded,
	pushHist,
	S,
	save,
	seed,
	snap,
	UI,
} from "./core/state.ts";
import { visibleIds } from "./core/tree.ts";
import { AN } from "./features/ask.ts";
import {
	LIB,
	libApply,
	libBlankData,
	libCreate,
	libData,
	libRefresh,
	libRemember,
} from "./features/library.ts";
import {
	chartMap,
	closeSide,
	G,
	openSide,
	startGrill,
	startResolve,
} from "./features/map.ts";
import {
	extractMindsetFile,
	extractMindsetPdf,
} from "./features/mindset-converter.ts";
import { applyMindset } from "./features/mindsets.ts";
import { briefPrompt, mapPrompt } from "./features/project.ts";
import {
	acceptGhost,
	clearGraph,
	initialView,
	resetTree,
	undo,
} from "./shell/actions.ts";
import { openCompose } from "./shell/compose.ts";
import { select } from "./shell/hud.ts";
import { applyResponsive } from "./shell/responsive.ts";
import { closeSettings, sanitizeTree } from "./shell/settings.ts";

export const testApi = {
	get tree() {
		return S;
	},
	prefs: PREFS,
	get ui() {
		return UI;
	},
	library: LIB,
	ask: AN,
	grill: G,
	get analyticsEnabled() {
		return ANALYTICS.on;
	},
	get history() {
		return hist;
	},
	waitForAi: () => aiQueue.chain,
	mode: MODE,
	seedExample() {
		if (loaded) return;
		Object.assign(S, seed());
		layout(true);
		initialView(true);
	},
	layoutCanvas: layout,
	restyleNodes: restyle,
	applyView,
	fitTo,
	visibleNodeIds: visibleIds,
	selectNode: select,
	saveTree: save,
	serializeTree: () => snap(),
	pushHistory: pushHist,
	clearGraph,
	undo,
	resetTree,
	sanitizeTree,
	acceptGhost,
	applyMindset,
	applyResponsive,
	buildBriefPrompt: briefPrompt,
	buildMapPrompt: mapPrompt,
	chartMap,
	closeSettings,
	extractMindsetFile,
	extractMindsetPdf,
	growNode,
	applyLibraryData: libApply,
	blankLibraryData: libBlankData,
	readLibraryData: libData,
	refreshLibrary: libRefresh,
	libCreate,
	libRemember,
	openCompose,
	openSidePanel: openSide,
	closeSide,
	startGrill,
	startResolve,
};
