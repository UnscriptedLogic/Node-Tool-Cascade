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
import * as mindsetConversion from "./legacy/core/mindset-conversion.ts";
import * as mindsetPresets from "./legacy/core/mindset-presets.ts";
import * as mindsetSchema from "./legacy/core/mindsets.ts";
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
	mindsetSchema,
	mindsetPresets,
	mindsetConversion,
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
	// Initialize side effects explicitly after module definitions have loaded.
	for (const module of modules) module.initialize();
}
