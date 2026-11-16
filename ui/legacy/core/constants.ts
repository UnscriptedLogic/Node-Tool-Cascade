import { proxy } from "valtio/vanilla";
import type { ServerSettings } from "../../model.ts";
import { UI } from "./state.ts";
export function loadPrefs() {
	try {
		if (LOCAL && window.__SETTINGS__?.prefs) return window.__SETTINGS__.prefs;
		const raw = localStorage.getItem("cascade-prefs-v1");
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}
export // trees saved before domains existed were all game design
function loadWebAI() {
	try {
		const o = JSON.parse(localStorage.getItem(WEBAI_KEY) || "{}");
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
export const LABEL = {
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
export const DEFAULT_PREFS = {
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
export const $ = (s) => document.querySelector(s);

export function startConstants() {
	reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!loadPrefs().domain && Object.keys(loadPrefs()).length)
		PREFS.domain = "game";
}
