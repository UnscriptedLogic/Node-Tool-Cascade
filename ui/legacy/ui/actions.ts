import { ref } from "valtio/vanilla";
import { cancelAI } from "../ai/prompts.ts";
import { layout, restyle } from "../canvas/layout.ts";
import { applyView, fitTo, setMode } from "../canvas/view.ts";
import { trackGhosts } from "../core/analytics.ts";
import {
	applySnap,
	state as coreStateState,
	hist,
	pushHist,
	R,
	S,
	save,
	seed,
	UI,
} from "../core/state.ts";
import {
	acceptChain,
	descendants,
	rebuildKM,
	removeSubtree,
	visibleIds,
} from "../core/tree.ts";
import { commit, showNote } from "./hud.ts";
import { isMobile } from "./responsive.ts";
export /* ================= actions ================= */
function acceptGhost(id) {
	pushHist();
	{
		const chain = [];
		let n = S.nodes[id];
		while (n) {
			chain.push(n.id);
			n = n.parent && S.nodes[n.parent];
		}
		trackGhosts("block_approved", chain);
	}
	acceptChain(id);
	const r = R[id];
	if (r) {
		r.settle = true;
		setTimeout(() => {
			r.settle = false;
			restyle();
		}, 600);
	}
	commit();
}
export function dismissGhost(id) {
	pushHist();
	trackGhosts("block_dismissed", [id, ...descendants(id)]);
	removeSubtree(id);
	commit();
}
export function keepAll() {
	pushHist();
	trackGhosts("block_approved", Object.keys(S.nodes));
	for (const id in S.nodes) S.nodes[id].ghost = false;
	commit();
}
export function dismissAll() {
	pushHist();
	trackGhosts("block_dismissed", Object.keys(S.nodes));
	Object.values(S.nodes)
		.filter((n) => n.ghost)
		.forEach((n) => {
			removeSubtree(n.id);
		});
	commit();
}
export function deleteNode(id, branch: boolean) {
	const n = S.nodes[id];
	if (!n) return;
	if (n.ghost) return dismissGhost(id);
	rebuildKM();
	const kids = (coreStateState.KM[id] || []).slice();
	pushHist();
	if (branch || !kids.length) {
		const below = descendants(id).length;
		removeSubtree(id);
		commit();
		showNote(
			[
				"Deleted ",
				{
					b: `“${n.text}”`,
				},
				below
					? ` and ${below} ${below === 1 ? "node" : "nodes"} below it.`
					: ".",
			],
			true,
		);
	} else {
		kids.forEach((k) => {
			S.nodes[k].parent = n.parent;
		});
		delete S.nodes[id];
		S.order = S.order.filter((x) => x !== id);
		S.links = S.links.filter((l) => l.a !== id && l.b !== id);
		if (S.sel === id) S.sel = null;
		commit();
		showNote(
			[
				"Deleted ",
				{
					b: `“${n.text}”`,
				},
				`. Its ${kids.length} ${kids.length === 1 ? "child moved" : "children moved"} up a level.`,
			],
			true,
		);
	}
}
export function clearGraph() {
	if (!S.order.length) return;
	cancelAI();
	pushHist(true);
	S.nodes = {};
	S.order = [];
	S.links = [];
	S.sel = null;
	coreStateState.flashId = null;
	S.mode = "detail";
	coreStateState.vAnim = null;
	S.view = ref({
		x: 140,
		y: 200,
		z: 1,
	});
	layout(false);
	applyView();
	save();
	showNote(["Graph cleared."], true);
}
export function toggleCollapse(id) {
	pushHist();
	S.nodes[id].collapsed = !S.nodes[id].collapsed;
	commit();
}
export function openLoop(id) {
	setMode("detail", {
		focus: id,
	});
}
export function undo() {
	cancelAI();
	const h = hist.pop();
	if (!h) return;
	applySnap(h.s);
	if (h.v) {
		coreStateState.vAnim = null;
		Object.assign(S.view, h.v);
		applyView();
	}
	layout(false);
	save();
	UI.noteOpen = false;
}
export function resetTree() {
	cancelAI();
	pushHist();
	const t = seed();
	S.nodes = t.nodes;
	S.order = t.order;
	S.links = t.links;
	S.seq = t.seq;
	S.sel = null;
	S.mode = "detail";
	layout(false);
	initialView();
	save();
}
export function initialView(instant?: boolean) {
	const ex = S.order.find(
		(id) =>
			S.nodes[id] &&
			S.nodes[id].type === "loop" &&
			S.nodes[id].text === "Explore",
	);
	if (ex) {
		rebuildKM();
		const core = S.nodes[ex].parent;
		fitTo([core, ex, ...descendants(ex)].filter(Boolean), {
			maxZ: 1,
			minZ: 0.7,
			pad: 40,
			instant: !!instant,
		});
	} else
		fitTo(visibleIds(), {
			maxZ: 1,
			minZ: isMobile() ? 0.6 : 0.5,
			instant: !!instant,
		});
}
export function initialize() {}
