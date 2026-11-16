import type { MindsetMetadata } from "../../../shared/mindsets.ts";
import type { Point, TreeMap, TreeNode } from "../../model.ts";
import { state as coreStateState, S, spawnAt } from "./state.ts";
export const state = {
	hasLoop: undefined,
};
export function renameNode(id, text: string) {
	const node = S.nodes[id];
	if (node) node.text = text.trim().slice(0, 220);
}
export function rebuildKM() {
	coreStateState.KM = {};
	for (const id of S.order) {
		const n = S.nodes[id];
		if (n) {
			const parent = n.parent || "";
			coreStateState.KM[parent] ||= [];
			coreStateState.KM[parent].push(id);
		}
	}
	state.hasLoop = S.order.some(
		(id) => S.nodes[id] && S.nodes[id].type === "loop",
	);
}
export function computeMap() {
	const m: TreeMap = {
			frontier: [],
			blocked: [],
			settled: [],
			fog: [],
			out: [],
			flag: {},
		},
		blockers = {};
	for (const L of S.links)
		if (L.kind === "block" && S.nodes[L.a] && S.nodes[L.b]) {
			blockers[L.b] ||= [];
			blockers[L.b].push(L.a);
		}
	for (const id of S.order) {
		const n = S.nodes[id];
		if (!n || n.ghost) continue;
		if (n.type === "fog") {
			if (n.state === "out") {
				m.out.push(id);
				m.flag[id] = "out";
			} else {
				m.fog.push(id);
				m.flag[id] = "fog";
			}
			continue;
		}
		if (n.type !== "question") continue;
		if (n.state === "out") {
			m.out.push(id);
			m.flag[id] = "out";
			continue;
		}
		if (n.state === "settled") {
			m.settled.push(id);
			m.flag[id] = "settled";
			continue;
		}
		const waiting = (blockers[id] || []).filter((b) => {
			const bn = S.nodes[b];
			return bn && bn.state !== "settled" && bn.state !== "out";
		});
		if (waiting.length) {
			m.blocked.push(id);
			m.flag[id] = "blocked";
		} else {
			m.frontier.push(id);
			m.flag[id] = "frontier";
		}
	}
	m.blockers = blockers;
	return m;
}
export function blockCycle(blocker, blocked) {
	const seen = new Set(),
		st = [blocked];
	while (st.length) {
		const x = st.pop();
		if (x === blocker) return true;
		if (seen.has(x)) continue;
		seen.add(x);
		for (const l of S.links) if (l.kind === "block" && l.a === x) st.push(l.b);
	}
	return false;
}
export function descendants(id) {
	const out = [],
		st = [id];
	while (st.length) {
		const x = st.pop();
		(coreStateState.KM[x] || []).forEach((c) => {
			out.push(c);
			st.push(c);
		});
	}
	return out;
}
export function effParent(id: string) {
	let p = S.nodes[id].parent;
	if (S.mode === "outer") {
		while (p && !isOuter(S.nodes[p])) p = S.nodes[p].parent;
	}
	return p;
}
export function visibleIds() {
	const out = [];
	for (const id of S.order) {
		const n = S.nodes[id];
		if (!n) continue;
		if (S.mode === "outer") {
			if (isOuter(n)) out.push(id);
			continue;
		}
		let p = n.parent,
			ok = true;
		while (p) {
			const pn = S.nodes[p];
			if (!pn || pn.collapsed) {
				ok = false;
				break;
			}
			p = pn.parent;
		} // a missing parent (removed while suggestions were still arriving) hides the orphan
		if (ok) out.push(id);
	}
	return out;
}
export function removeSubtree(id) {
	rebuildKM();
	[id, ...descendants(id)].forEach((x) => {
		delete S.nodes[x];
	});
	S.order = S.order.filter((x) => S.nodes[x]);
	S.links = S.links.filter((l) => S.nodes[l.a] && S.nodes[l.b]);
	if (S.sel && !S.nodes[S.sel]) S.sel = null;
}
export function acceptChain(id) {
	let n = S.nodes[id];
	while (n) {
		n.ghost = false;
		n = n.parent && S.nodes[n.parent];
	}
}
export function expandChain(id) {
	let n = S.nodes[id];
	while (n) {
		n.collapsed = false;
		n = n.parent && S.nodes[n.parent];
	}
}
export function addNode({
	type,
	text,
	parent,
	rel,
	mood,
	ghost,
	spawn,
	mindset,
}: {
	type: string;
	text: string;
	parent?: string;
	rel?: string;
	mood?: string;
	ghost?: boolean;
	spawn?: Point;
	mindset?: MindsetMetadata;
}) {
	const id = `n${++S.seq}`;
	const n: TreeNode = {
		id,
		type,
		text,
		parent,
		ghost: !!ghost,
	};
	if (rel) n.rel = rel;
	if (type === "emotion") n.mood = mood || "curiosity";
	if (type === "question" && mindset) n.mindset = mindset;
	S.nodes[id] = n;
	S.order.push(id);
	if (!ghost) acceptChain(parent);
	expandChain(parent);
	if (spawn) spawnAt[id] = spawn;
	return id;
}
export const isOuter = (n) =>
	n.type === "loop" || (!state.hasLoop && !n.parent);

export function startTree() {
	state.hasLoop = false;
}
