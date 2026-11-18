let saveTimer: ReturnType<typeof setTimeout> | undefined;

import { proxy, ref } from "valtio/vanilla";
import Mindsets from "../../shared/mindsets.ts";
import { record, type View } from "../../shared/types.ts";
import type {
	AiState,
	CascadeTree,
	Point,
	RenderedNode,
	SavedTree,
	UiState,
} from "../model.ts";
import { KEY, LOCAL } from "./constants.ts";
import { DOM } from "./profiles.ts";
import { decodeSavedTree } from "./saved-tree.ts";

const saveListeners = new Set<() => void>();
export function onTreeSaved(fn: () => void) {
	saveListeners.add(fn);
}

export const state = {
	KM: undefined,
	flashId: undefined,
	vAnim: undefined,
	linkFrom: undefined,
	MAP: undefined,
	THMAP: undefined,
	THR: undefined,
};
export let loaded: SavedTree | null,
	initialState: CascadeTree,
	S: CascadeTree,
	R: Record<string, RenderedNode>,
	spawnAt: Record<string, Point>,
	hist: { s: string; v: View | null }[] = null,
	snap: () => string,
	AI: AiState = null,
	UI: UiState = null;
/* ================= state ================= */
export function seed() {
	return DOM().sample();
}
export function load() {
	try {
		let value: unknown = window.__CASCADE_SAVED__;
		if (!value) {
			const raw = localStorage.getItem(KEY);
			if (!raw) return null;
			value = JSON.parse(raw);
		}
		const o = record(value);
		const parsed: unknown = JSON.parse(String(o.tree));
		const t = decodeSavedTree(parsed);
		if (!t) return null;
		// Keep the saved camera unchanged; startModel applies the existing fallback.
		t.view = o.view as View;
		return t;
	} catch {
		return null;
	}
}
export function save() {
	const payload = JSON.stringify({
		tree: snap(),
		view: S.view,
	});
	try {
		localStorage.setItem(KEY, payload);
	} catch {}
	for (const listener of saveListeners) listener();
	if (LOCAL) {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			fetch("/api/tree", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: payload,
			}).catch(() => {
				/* The local saved tree remains available if server saving fails. */
			});
		}, 400);
	}
}
export function pushHist(withView?: boolean) {
	hist.push({
		s: snap(),
		v: withView
			? {
					x: S.view.x,
					y: S.view.y,
					z: S.view.z,
				}
			: null,
	});
	if (hist.length > 40) hist.shift();
}
export function applySnap(s: string) {
	const o = JSON.parse(s);
	S.nodes = o.nodes;
	S.order = o.order;
	S.links = o.links;
	S.seq = o.seq;
	S.mindsets = Mindsets.collection(o.mindsets);
	if (!S.nodes[S.sel]) S.sel = null;
}
loaded = null;
initialState = Object.assign(
	{
		view: {
			x: 0,
			y: 0,
			z: 1,
		},
		mode: "detail",
		layer: false,
		sel: null,
		nodes: {},
		order: [],
		links: [],
		mindsets: [],
		seq: 0,
	},
	loaded || {},
);
initialState.view = ref(
	initialState.view && Number.isFinite(+initialState.view.z)
		? initialState.view
		: {
				x: 0,
				y: 0,
				z: 1,
			},
);
S = proxy(initialState);
S.mode = "detail";
S.sel = null;
try {
	S.mindsets = Mindsets.collection(S.mindsets);
} catch {
	S.mindsets = [];
}
R = {};
state.KM = {};
spawnAt = {};
hist = proxy([]);
state.flashId = null;
state.vAnim = null;
state.linkFrom = null;
state.MAP = {
	frontier: [],
	blocked: [],
	settled: [],
	fog: [],
	out: [],
	flag: {},
};
state.THMAP = {};
state.THR = [];
snap = () =>
	JSON.stringify({
		nodes: S.nodes,
		order: S.order,
		links: S.links,
		seq: S.seq,
		mindsets: S.mindsets,
	});
AI = proxy({
	checked: false,
	sample: null,
	off: false,
});
UI = proxy({
	bye: false,
	busy: null,
	stoppable: false,
	note: [],
	noteOpen: false,
	noteUndo: false,
	small: false,
	minimal: false,
	panel: null,
	ask: null,
	library: null,
	seed: false,
	providerLabels: {},
	settingsTitle: "Settings",
	moodColors: {},
	compose: {
		open: false,
		type: "question",
		text: "",
		x: 0,
		y: 0,
		w: 300,
		wpos: null,
		focus: 0,
	},
	menu: null,
});

export function startModel() {
	loaded = load();
	if (loaded) {
		const view = loaded.view;
		Object.assign(S, {
			...loaded,
			view: ref(view && Number.isFinite(+view.z) ? view : { x: 0, y: 0, z: 1 }),
		});
	}
	S.mode = "detail";
	S.sel = null;
	try {
		S.mindsets = Mindsets.collection(S.mindsets);
	} catch {
		S.mindsets = [];
	}
}
