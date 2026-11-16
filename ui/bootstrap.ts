import MindsetConversion from "../shared/mindset-conversion.ts";
import MINDSET_PRESETS from "../shared/mindset-presets.ts";
import Mindsets from "../shared/mindsets.ts";
import { connect } from "./bridge.ts";
import * as prompts from "./legacy/ai/prompts.ts";
import * as transport from "./legacy/ai/transport.ts";
import * as boot from "./legacy/boot.ts";
import * as edges from "./legacy/canvas/edges.ts";
import * as interaction from "./legacy/canvas/interaction.ts";
import * as layout from "./legacy/canvas/layout.ts";
import * as look from "./legacy/canvas/look.ts";
import * as view from "./legacy/canvas/view.ts";
import * as analytics from "./legacy/core/analytics.ts";
import * as constants from "./legacy/core/constants.ts";
import * as dom from "./legacy/core/dom.ts";
import * as profiles from "./legacy/core/profiles.ts";
import * as server from "./legacy/core/server.ts";
import * as model from "./legacy/core/state.ts";
import * as tree from "./legacy/core/tree.ts";
import * as ask from "./legacy/features/ask.ts";
import * as chatExchange from "./legacy/features/chat-exchange.ts";
import * as library from "./legacy/features/library.ts";
import * as map from "./legacy/features/map.ts";
import * as converter from "./legacy/features/mindset-converter.ts";
import * as mindsets from "./legacy/features/mindsets.ts";
import * as project from "./legacy/features/project.ts";
import * as actions from "./legacy/ui/actions.ts";
import * as compose from "./legacy/ui/compose.ts";
import * as controls from "./legacy/ui/controls.ts";
import * as hud from "./legacy/ui/hud.ts";
import * as lookEditor from "./legacy/ui/look-editor.ts";
import * as responsive from "./legacy/ui/responsive.ts";
import * as settings from "./legacy/ui/settings.ts";
import type { LegacyActions } from "./legacy-types.ts";

const modules = [
	constants,
	analytics,
	profiles,
	{ Mindsets },
	{ MINDSET_PRESETS },
	{ MindsetConversion },
	model,
	dom,
	tree,
	look,
	view,
	layout,
	edges,
	hud,
	actions,
	prompts,
	compose,
	interaction,
	controls,
	transport,
	server,
	settings,
	chatExchange,
	responsive,
	map,
	ask,
	lookEditor,
	project,
	library,
	mindsets,
	converter,
	boot,
];
// Live bindings connect the islands and the jsdom harness without app globals.
export const legacy = {} as LegacyActions;
for (const entry of modules) {
	const module = entry as unknown as Record<string, unknown> & {
		state?: Record<string, unknown>;
	};
	for (const name of Object.keys(module)) {
		if (name === "initialize" || name === "state") continue;
		Object.defineProperty(legacy, name, {
			enumerable: true,
			get: () => module[name],
		});
	}
	const moduleState = module.state || {};
	for (const name of Object.keys(moduleState)) {
		Object.defineProperty(legacy, name, {
			enumerable: true,
			get: () => moduleState[name],
			set: (value) => {
				moduleState[name] = value;
			},
		});
	}
}

export function initialize() {
	connect({ actions: legacy });
	// Read browser preferences before creating stores.
	constants.startConstants();
	// Create the stores before mounting UI.
	model.startModel();
	// Resolve canvas elements and mount the shell after stores exist.
	dom.startDom();
	// Initialize tree bookkeeping before layout.
	tree.startTree();
	// Load the saved look before canvas rendering.
	look.startLook();
	// Resolve grid elements before view updates.
	view.startView();
	// Initialize layout before dependent startup calls.
	layout.startLayout();
	// Prepare edge rendering before interaction starts.
	edges.startEdges();
	// Attach palette actions after the shell mounts.
	compose.startCompose();
	// Attach canvas interaction after DOM and stores exist.
	interaction.startInteraction();
	// Attach resize controls after canvas setup.
	controls.startControls();
	// Mount settings before its nested panels.
	settings.startSettings();
	// Mount chat inside the settings panel.
	chatExchange.startChatExchange();
	// Apply responsive layout after settings and shell mounts.
	responsive.startResponsive();
	// Mount the side panel before its ask panel.
	map.startMap();
	// Mount ask inside the side panel.
	ask.startAsk();
	// Create look editor state before it can be opened.
	lookEditor.startLookEditor();
	// Mount project and source panels after settings.
	project.startProject();
	// Create the library before its dependent panels.
	library.startLibrary();
	// Mount mindsets before its converter.
	mindsets.startMindsets();
	// Mount the converter inside mindsets.
	converter.startConverter();
	// Render the initial canvas and begin loading the library last.
	boot.startBoot();
	// Detect the provider after every store and panel is ready.
	void prompts.detectProvider();
}
