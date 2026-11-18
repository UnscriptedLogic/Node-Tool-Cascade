import { detectProvider } from "./legacy/ai/prompts.ts";
import { startBoot } from "./legacy/boot.ts";
import { startEdges } from "./legacy/canvas/edges.ts";
import { startInteraction } from "./legacy/canvas/interaction.ts";
import { startLayout } from "./legacy/canvas/layout.ts";
import { startLook } from "./legacy/canvas/look.ts";
import { startView } from "./legacy/canvas/view.ts";
import { startConstants } from "./legacy/core/constants.ts";
import { startDom } from "./legacy/core/dom.ts";
import { startModel } from "./legacy/core/state.ts";
import { startTree } from "./legacy/core/tree.ts";
import { startAsk } from "./legacy/features/ask.ts";
import { startChatExchange } from "./legacy/features/chat-exchange.ts";
import { startLibrary } from "./legacy/features/library.ts";
import { startMap } from "./legacy/features/map.ts";
import { startConverter } from "./legacy/features/mindset-converter.ts";
import { startMindsets } from "./legacy/features/mindsets.ts";
import { startProject } from "./legacy/features/project.ts";
import { startLookEditor } from "./legacy/ui/look-editor.ts";
import { startResponsive } from "./legacy/ui/responsive.ts";
import { startSettings } from "./legacy/ui/settings.ts";

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
