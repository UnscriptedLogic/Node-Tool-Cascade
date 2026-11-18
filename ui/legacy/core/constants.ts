import { proxy } from "valtio/vanilla";
import { record } from "../../../shared/types.ts";
import type { ServerSettings } from "../../model.ts";
import type { Preferences } from "./prefs.ts";
import { UI } from "./state.ts";
export function loadPrefs(): Partial<Preferences> {
	try {
		const raw =
			LOCAL && window.__SETTINGS__?.prefs
				? null
				: localStorage.getItem("cascade-prefs-v1");
		const value: unknown =
			LOCAL && window.__SETTINGS__?.prefs
				? window.__SETTINGS__.prefs
				: raw
					? JSON.parse(raw)
					: {};
		const o = record(value);
		const prefs: Partial<Preferences> = {};
		if (
			o.domain === "general" ||
			o.domain === "product" ||
			o.domain === "research" ||
			o.domain === "game"
		)
			prefs.domain = o.domain;
		if (typeof o.goal === "string") prefs.goal = o.goal;
		if (typeof o.context === "string") prefs.context = o.context;
		if (typeof o.pillars === "string") prefs.pillars = o.pillars;
		if (typeof o.avoid === "string") prefs.avoid = o.avoid;
		if (o.steer === "light" || o.steer === "balanced" || o.steer === "strong")
			prefs.steer = o.steer;
		if (
			o.growSize === "small" ||
			o.growSize === "medium" ||
			o.growSize === "large"
		)
			prefs.growSize = o.growSize;
		if (typeof o.creativity === "number" && Number.isFinite(o.creativity))
			prefs.creativity = o.creativity;
		if (typeof o.autoGrow === "boolean") prefs.autoGrow = o.autoGrow;
		if (typeof o.autoTrace === "boolean") prefs.autoTrace = o.autoTrace;
		if (typeof o.pushback === "boolean") prefs.pushback = o.pushback;
		if (o.theme === "system" || o.theme === "light" || o.theme === "dark")
			prefs.theme = o.theme;
		if (o.mobileLayout === "standard" || o.mobileLayout === "minimal")
			prefs.mobileLayout = o.mobileLayout;
		if (o.grillStyle === "round" || o.grillStyle === "single")
			prefs.grillStyle = o.grillStyle;
		if (typeof o.quitOnClose === "boolean") prefs.quitOnClose = o.quitOnClose;
		if (typeof o.useProject === "boolean") prefs.useProject = o.useProject;
		if (typeof o.askFiles === "boolean") prefs.askFiles = o.askFiles;
		// Trees saved before domains existed were all game design.
		if (!o.domain && Object.keys(o).length) prefs.domain = "game";
		return prefs;
	} catch {
		return {};
	}
}
// trees saved before domains existed were all game design
export function loadWebAI() {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(WEBAI_KEY) || "{}");
		const o = record(value);
		return {
			provider: o.provider === "openrouter" ? "openrouter" : "demo",
			key: typeof o.key === "string" ? o.key : "",
			model: typeof o.model === "string" ? o.model : "",
		};
	} catch {
		return {
			provider: "demo",
			key: "",
			model: "",
		};
	}
}
export const TYPES = [
	"question",
	"answer",
	"emotion",
	"consequence",
	"decision",
];
export const BLOCKS = ["loop", ...TYPES, "fog"];
export const TICKETS = ["talk", "prototype", "research", "task"];
export const TICKET_LABEL = {
	talk: "Talk",
	prototype: "Prototype",
	research: "Research",
	task: "Task",
};
export const TICKET_ASK = {
	talk: "Your answer",
	prototype: "What did the prototype show, and what do you decide?",
	research: "What did you find, and what do you decide?",
	task: "What happened, and what do you decide?",
};
export const drawerW: () => number = () => {
	return UI.panel?.open && innerWidth > 760 ? 380 : 0;
};
export const LABEL: Record<string, string> = {
	question: "Question",
	answer: "Answer",
	emotion: "Emotion",
	consequence: "Consequence",
	decision: "Decision",
	loop: "Loop",
	fog: "Fog",
};
export const MOODS = {
	frustration: {
		bg: "#D94A2B",
		fg: "#FFFFFF",
	},
	boredom: {
		bg: "#A3AEBF",
		fg: "#142033",
	},
	curiosity: {
		bg: "#19877A",
		fg: "#FFFFFF",
	},
	delight: {
		bg: "#F2B33D",
		fg: "#2B1E00",
	},
	awe: {
		bg: "#7653B4",
		fg: "#FFFFFF",
	},
	confusion: {
		bg: "#E08AB0",
		fg: "#3A0F26",
	},
	tension: {
		bg: "#3566D1",
		fg: "#FFFFFF",
	},
};
export const MOOD_KEYS: string[] = Object.keys(MOODS);
export { ACT, ICONS, svg } from "./data.ts";
export const KEY: string = "cascade-tree-v1";
export const LOCAL: boolean = !!window.__LOCAL__;
export const WEB: boolean = !!window.__WEB__;
export const MODE: string = LOCAL ? "local" : WEB ? "web" : "artifact";
export const WEBAI_KEY: string = "cascade-web-ai-v1";
export const DEFAULT_PREFS: Preferences = {
	mobileLayout: "standard",
	domain: "general",
	goal: "",
	context: "",
	pillars: "",
	avoid: "",
	steer: "balanced",
	autoGrow: true,
	autoTrace: true,
	growSize: "medium",
	creativity: 0.7,
	theme: "system",
	pushback: true,
	grillStyle: "round",
	quitOnClose: false,
	useProject: true,
	askFiles: true,
};
export const PREFS = proxy(Object.assign({}, DEFAULT_PREFS, loadPrefs()));
export const CONNECTION: {
	cloud: boolean;
	server: ServerSettings | null;
	project: import("../../../shared/project-types.ts").ProjectInfo | null;
	web: { provider: string; key: string; model: string };
} = proxy({
	cloud: false,
	server: LOCAL ? window.__SETTINGS__ || null : null,
	project: LOCAL ? window.__SETTINGS__?.project || null : null,
	web: WEB
		? loadWebAI()
		: {
				provider: "demo",
				key: "",
				model: "",
			},
});
export let reduce: boolean;
export const clamp = (v: number, a: number, b: number) =>
	Math.max(a, Math.min(b, v));
export const sleep = (ms?: number) => new Promise((r) => setTimeout(r, ms));
export const $ = <T extends Element = HTMLElement>(s: string): T | null =>
	document.querySelector<T>(s);

export function startConstants() {
	reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!loadPrefs().domain && Object.keys(loadPrefs()).length)
		PREFS.domain = "game";
}
