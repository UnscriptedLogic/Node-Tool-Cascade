import { detectProvider } from "./ai/prompts.ts";
import { startBoot } from "./boot.ts";
import { startEdges } from "./canvas/edges.ts";
import { startInteraction } from "./canvas/interaction.ts";
import { startLayout } from "./canvas/layout.ts";
import { startLook } from "./canvas/look.ts";
import { startView } from "./canvas/view.ts";
import { startConstants } from "./core/constants.ts";
import { startDom } from "./core/dom.ts";
import { startModel } from "./core/state.ts";
import { startTree } from "./core/tree.ts";
import { startAsk } from "./features/ask.ts";
import { startChatExchange } from "./features/chat-exchange.ts";
import { startLibrary } from "./features/library.ts";
import { startMap } from "./features/map.ts";
import { startConverter } from "./features/mindset-converter.ts";
import { startMindsets } from "./features/mindsets.ts";
import { startProject } from "./features/project.ts";
import { startLookEditor } from "./shell/look-editor.ts";
import { startResponsive } from "./shell/responsive.ts";
import { startSettings } from "./shell/settings.ts";

export function start() {
	// Apply browser preferences before startup wiring.
	startConstants();
	// Load the saved tree into the existing stores.
	startModel();
	// Resolve canvas elements after React renders the shell.
	startDom();
	// Initialize tree bookkeeping before layout.
	startTree();
	// Load the saved look before canvas rendering.
	startLook();
	// Resolve grid elements before view updates.
	startView();
	// Initialize layout before dependent startup calls.
	startLayout();
	// Prepare edge rendering before interaction starts.
	startEdges();
	// Attach canvas interaction after DOM and stores exist.
	startInteraction();
	// Start settings after canvas setup.
	startSettings();
	// Prepare chat actions for the settings panel.
	startChatExchange();
	// Apply responsive layout after settings and shell mounts.
	startResponsive();
	// Connect the side panel to the shell.
	startMap();
	// Connect ask state to the shell.
	startAsk();
	// Start the look editor before it can be opened.
	startLookEditor();
	// Start project and source wiring after settings.
	startProject();
	// Connect the library to the shell.
	startLibrary();
	// Start mindset features before the converter.
	startMindsets();
	// Start the mindset converter.
	startConverter();
	// Render the initial canvas and begin loading the library last.
	startBoot();
	// Detect the provider after every store and panel is ready.
	void detectProvider();
}
