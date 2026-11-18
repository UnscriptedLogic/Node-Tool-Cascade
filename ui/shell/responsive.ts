let lastSmall: boolean | null = null;
let lastChoice: string | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
let menuSpec = null;

import { flushSync } from "react-dom";
import { ref } from "valtio/vanilla";
import { bridgeTo, growNode, traceBack } from "../ai/prompts.ts";
import { beginEdit } from "../canvas/interaction.ts";
import { nodeActions } from "../canvas/layout.ts";
import { fitTo, setMode } from "../canvas/view.ts";
import { ICONS, LABEL, PREFS } from "../core/constants.ts";
import { ACT, svg } from "../core/data.ts";
import { state as coreStateState, hist, S, UI } from "../core/state.ts";
import { visibleIds } from "../core/tree.ts";
import { clearAskHighlight } from "../features/ask.ts";
import { LIB, libCurrent, libSignedIn } from "../features/library.ts";
import {
	cycleTicket,
	reopenQ,
	startBlock,
	startGrill,
	startResolve,
	toggleAsk,
	toggleMap,
	toggleOut,
} from "../features/map.ts";
import { openNodeSrc } from "../features/project.ts";
import {
	acceptGhost,
	deleteNode,
	dismissAll,
	dismissGhost,
	keepAll,
	openLoop,
	toggleCollapse,
	undo,
} from "./actions.ts";
import { openCompose } from "./compose.ts";
import { fitCanvas } from "./controls.ts";
import { select, showNote } from "./hud.ts";
import { openSettings, setPreference } from "./settings.ts";
export const state = {
	tapSuppressed: undefined as boolean | undefined,
};
export function layoutChoice() {
	const q = new URLSearchParams(location.search).get("layout");
	return q === "minimal" || q === "standard"
		? q
		: PREFS.mobileLayout === "minimal"
			? "minimal"
			: "standard";
}
export function applyResponsive(force: boolean) {
	const small = isSmall(),
		choice = layoutChoice(),
		first = lastSmall === null;
	if (!force && small === lastSmall && choice === lastChoice) return;
	lastSmall = small;
	lastChoice = choice;
	const cl = document.body.classList;
	cl.toggle("m", small);
	cl.toggle("m-standard", small && choice === "standard");
	cl.toggle("m-minimal", small && choice === "minimal");
	closeMenu();
	UI.small = small;
	UI.minimal = small && choice === "minimal";
	if (small && choice === "minimal") hintMinimal();
	if (!first)
		try {
			fitIfNeeded();
		} catch {
			/* Keep the current view if fitting is temporarily unavailable. */
		} // the first call is start-up: the saved view stays
}
// the stage changes size when the dock or bars appear: keep the tree in view
export function fitIfNeeded() {
	if (S.order.length)
		requestAnimationFrame(() =>
			fitTo(visibleIds(), {
				maxZ: 1,
				minZ: 0.6,
				pad: 24,
				instant: true,
			}),
		);
}
export function hintMinimal() {
	try {
		if (localStorage.getItem("cascade-minimal-hint")) return;
		localStorage.setItem("cascade-minimal-hint", "1");
	} catch {}
	setTimeout(
		() =>
			showNote(
				["Tap empty space for a menu, or tap a block for its actions."],
				false,
			),
		600,
	);
}
// keep sheets above the on-screen keyboard
export function updateKeyboard() {
	const vv = window.visualViewport;
	if (!vv) return;
	document.documentElement.style.setProperty(
		"--kb",
		`${Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`,
	);
}
/* ---------- running a block's action, from the desktop bar, the strip, or a menu ---------- */
// built when used, because the functions live in files that load after this one
export function runNodeAction(act: string, id) {
	if (act === "mindset") {
		select(id);
		openSettings("mindsets");
		return;
	}
	const run = {
		accept: acceptGhost,
		dismiss: dismissGhost,
		grow: growNode,
		back: traceBack,
		bridge: bridgeTo,
		collapse: toggleCollapse,
		del: (i) => deleteNode(i, false),
		delb: (i) => deleteNode(i, true),
		open: openLoop,
		resolve: startResolve,
		reopen: reopenQ,
		grill: startGrill,
		ticket: cycleTicket,
		block: startBlock,
		out: toggleOut,
		sharpen: (i) =>
			beginEdit(i, {
				graduate: true,
			}),
		src: openNodeSrc,
	}[act];
	if (run && S.nodes[id]) run(id);
}

/* ---------- standard layout: the strip of actions for the selected block ---------- */
/* ---------- context menu: popover at a point (minimal) or bottom sheet (standard's "more") ---------- */
export function closeMenu() {
	UI.menu = null;
	menuSpec = null;
}
export function openMenu(spec, at) {
	at = at ||
		menuSpec?.at || {
			x: innerWidth / 2,
			y: innerHeight / 2,
		};
	const hadMenu = !!UI.menu;
	menuSpec = {
		spec,
		at,
		focus: !hadMenu,
	};
	// The next menu click needs the rendered items (test/mobile.test.ts:144).
	flushSync(() => {
		UI.menu = ref(menuSpec);
	});
}
export function chooseMenuItem(index) {
	const { spec, at } = menuSpec,
		item = spec.items[index];
	if (item.sub)
		openMenu(
			{
				...item.sub,
				back: spec,
				title: item.sub.title || item.label,
			},
			at,
		);
	else {
		closeMenu();
		setTimeout(() => item.run?.(), 0);
	}
}
export function backMenu() {
	if (menuSpec?.spec.back) openMenu(menuSpec.spec.back, menuSpec.at);
}
export function openMoreMenu() {
	openMenu(canvasMenuSpec(innerWidth / 2, innerHeight / 2), {
		sheet: true,
	});
}
export function addBlockSpec(x, y) {
	return {
		title: "Add a block",
		items: TYPE_ORDER.map((t) => ({
			label: LABEL[t],
			icon: ICONS[t],
			run: () => openCompose(t, x, y),
		})),
	};
}
// everything the desktop screen offers as buttons, as one menu
export function canvasMenuSpec(x: number, y: number) {
	const ghosts = Object.values(S.nodes).filter((n) => n.ghost).length,
		items = [];
	items.push({
		label: "Add a block",
		icon: ICONS.question,
		sub: addBlockSpec(x, y),
	});
	if (ghosts && S.mode === "detail")
		items.push(
			{
				label: `Keep all ${ghosts} suggestion${ghosts === 1 ? "" : "s"}`,
				icon: ACT.accept,
				run: keepAll,
			},
			{
				label: "Dismiss all suggestions",
				icon: ACT.dismiss,
				run: dismissAll,
			},
		);
	items.push({
		sep: true,
	});
	items.push(
		{
			label: "Ask the graph",
			icon: MI.ask,
			run: toggleAsk,
		},
		{
			label: "Map and grill",
			icon: MI.map,
			run: toggleMap,
		},
	);
	if (
		UI.ask?.threads.some(
			(thread) => thread.on && thread.ids.some((id) => S.nodes[id]),
		)
	)
		items.push({
			label: "Clear highlight",
			icon: ACT.dismiss,
			run: clearAskHighlight,
		});
	items.push({
		sep: true,
	});
	items.push(
		{
			label: "Undo",
			icon: MI.undo,
			disabled: !hist.length,
			run: undo,
		},
		{
			label: "Fit to screen",
			icon: MI.fit,
			run: fitCanvas,
		},
		{
			label: S.mode === "outer" ? "Back to detail view" : "Loops overview",
			icon: ICONS.loop,
			run: () => setMode(S.mode === "outer" ? "detail" : "outer"),
		},
	);
	items.push({
		sep: true,
	});
	items.push({
		label: "Goal and steering",
		icon: MI.goal,
		run: () => openSettings("goal"),
	});
	if (LIB?.kind && libSignedIn())
		items.push({
			label: (() => {
				const c = libCurrent();
				return c ? `Library: ${c.name}` : "Library";
			})(),
			icon: MI.folder,
			run: () => openSettings("library"),
		});
	items.push({
		label: "Settings",
		icon: MI.settings,
		run: () => openSettings(),
	});
	items.push({
		label: isMinimal()
			? "Switch to standard layout"
			: "Switch to minimal layout",
		icon: MI.layout,
		run: () => setMobileLayout(isMinimal() ? "standard" : "minimal"),
	});
	return {
		title: "",
		items,
	};
}
export function nodeMenuSpec(id) {
	const n = S.nodes[id],
		hasKids = !!coreStateState.KM[id]?.length,
		items = [];
	if (!n.ghost)
		items.push({
			label: "Edit text",
			icon: ICONS[n.type] || ICONS.question,
			run: () => beginEdit(id),
		});
	const WORDS = {
		del: hasKids ? "Delete (its children move up)" : "Delete",
		delb: "Delete with everything below",
		bridge: "Bridge to this feeling",
		collapse: n.collapsed ? "Expand" : "Collapse",
	};
	nodeActions(n, hasKids).forEach(([act, title]) => {
		items.push({
			label: WORDS[act] || title.replace(/\. Click to change$/, ""),
			icon: ACT[act],
			danger: act === "del" || act === "delb",
			run: () => runNodeAction(act, id),
		});
	});
	const ghosts = Object.values(S.nodes).filter((x) => x.ghost).length;
	if (ghosts > 1 && n.ghost)
		items.push(
			{
				sep: true,
			},
			{
				label: `Keep all ${ghosts} suggestions`,
				icon: ACT.accept,
				run: keepAll,
			},
			{
				label: "Dismiss all suggestions",
				icon: ACT.dismiss,
				run: dismissAll,
			},
		);
	return {
		title: n.text.length > 46 ? `${n.text.slice(0, 45)}…` : n.text,
		items,
	};
}
export function openCanvasMenu(x, y) {
	openMenu(canvasMenuSpec(x, y), {
		x,
		y,
	});
}
export function openNodeMenu(id, x, y) {
	if (S.nodes[id])
		openMenu(nodeMenuSpec(id), {
			x,
			y,
		});
}
export function setMobileLayout(v: string) {
	setPreference("mobileLayout", v === "minimal" ? "minimal" : "standard");
}
export const SHORT: Record<string, string> = {
	accept: "Keep",
	dismiss: "Dismiss",
	grow: "Grow",
	back: "Trace",
	bridge: "Bridge",
	collapse: "Fold",
	del: "Delete",
	delb: "Delete all",
	open: "Open",
	resolve: "Resolve",
	reopen: "Reopen",
	ticket: "Ticket",
	block: "Block by",
	out: "Scope",
	sharpen: "Sharpen",
	src: "Source",
	grill: "Grill",
};
export const isSmall = () =>
	innerWidth <= 760 ||
	(innerHeight <= 520 && matchMedia && matchMedia("(pointer: coarse)").matches);
export const isMobile = () => document.body.classList.contains("m");
export const isMinimal = () => document.body.classList.contains("m-minimal");
export const onResize = () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => applyResponsive(false), 120);
	updateKeyboard();
};
export const MI = {
	ask: ACT.grill,
	undo: svg(
		'<path d="M3.5 6.5h6a3 3 0 0 1 0 6H6"/><path d="M6 4 3.5 6.5 6 9"/>',
	),
	fit: svg('<path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3"/>'),
	map: svg(
		'<path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5z"/><path d="M6 2.5v10M10 4v10"/>',
	),
	goal: svg('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/>'),
	folder: svg('<path d="M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z"/>'),
	settings: svg(
		'<path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.6"/><circle cx="10" cy="11" r="1.6"/>',
	),
	layout: svg(
		'<rect x="3" y="3" width="10" height="10" rx="2"/><path d="M3 10h10"/>',
	),
};
export const TYPE_ORDER = [
	"question",
	"answer",
	"emotion",
	"consequence",
	"decision",
	"loop",
	"fog",
];

export function startResponsive() {
	state.tapSuppressed = false;
	applyResponsive(true);
}

export function cancelViewportUpdate() {
	clearTimeout(resizeTimer);
}
