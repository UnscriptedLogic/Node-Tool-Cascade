import { state as aiQueue, growNode } from "./legacy/ai/prompts.ts";
import { layout, restyle } from "./legacy/canvas/layout.ts";
import { applyView, fitTo } from "./legacy/canvas/view.ts";
import { ANALYTICS } from "./legacy/core/analytics.ts";
import { MODE, PREFS } from "./legacy/core/constants.ts";
import {
	hist,
	loaded,
	pushHist,
	S,
	save,
	seed,
	snap,
	UI,
} from "./legacy/core/state.ts";
import { visibleIds } from "./legacy/core/tree.ts";
import { AN } from "./legacy/features/ask.ts";
import {
	LIB,
	libApply,
	libBlankData,
	libCreate,
	libData,
	libRefresh,
	libRemember,
} from "./legacy/features/library.ts";
import {
	chartMap,
	closeSide,
	G,
	openSide,
	startGrill,
	startResolve,
} from "./legacy/features/map.ts";
import {
	extractMindsetFile,
	extractMindsetPdf,
} from "./legacy/features/mindset-converter.ts";
import { applyMindset } from "./legacy/features/mindsets.ts";
import { briefPrompt, mapPrompt } from "./legacy/features/project.ts";
import {
	acceptGhost,
	clearGraph,
	initialView,
	resetTree,
	undo,
} from "./legacy/shell/actions.ts";
import { openCompose } from "./legacy/shell/compose.ts";
import { select } from "./legacy/shell/hud.ts";
import { applyResponsive } from "./legacy/shell/responsive.ts";
import { closeSettings, sanitizeTree } from "./legacy/shell/settings.ts";

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
