import { clamp, drawerInsets } from "../core/constants.ts";
import { stage, world } from "../core/dom.ts";
import { state as coreStateState, R, S, save } from "../core/state.ts";
import {
	descendants,
	expandChain,
	rebuildKM,
	visibleIds,
} from "../core/tree.ts";
import { cullNodes, kickView } from "./edges.ts";
import { layout } from "./layout.ts";
import { effLook } from "./look.ts";
export const state = {
	vz: undefined,
	vgs: undefined,
	vflags: undefined,
	viewRaf: undefined,
};
export let gridEl: HTMLElement | null,
	screenToWorld = null;
export function applyView() {
	const v = S.view;
	world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
	// only the grid layer and (when zoomed far out) the world get variables, and only when they change
	let gs = effLook().canvas.gridSize * v.z;
	while (gs < 12) gs *= 2;
	if (gs !== state.vgs) {
		state.vgs = gs;
		gridEl.style.setProperty("--gs", `${gs}px`);
	}
	gridEl.style.transform = `translate3d(${v.x % gs}px,${v.y % gs}px,0)`;
	const far = S.mode === "detail" && v.z < 0.55,
		flags = `${far ? "f" : ""}${S.mode === "outer" ? "o" : ""}${S.layer ? "m" : ""}`;
	if (flags !== state.vflags) {
		state.vflags = flags;
		world.classList.toggle("far", far);
		world.classList.toggle("outer", S.mode === "outer");
		world.classList.toggle("maplayer", !!S.layer);
	}
	if (far && Math.abs(v.z - state.vz) > 0.01) {
		state.vz = v.z;
		world.style.setProperty("--z", v.z.toFixed(2));
	}
	cullNodes();
}
export function fitTo(ids, o) {
	o = Object.assign(
		{
			maxZ: 1,
			minZ: 0.2,
			pad: 48,
			instant: false,
		},
		o || {},
	);
	ids = ids.filter((id) => R[id]?.shown);
	if (!ids.length) return;
	let x0 = 1e9,
		y0 = 1e9,
		x1 = -1e9,
		y1 = -1e9;
	ids.forEach((id) => {
		const r = R[id];
		x0 = Math.min(x0, r.tgt.x);
		y0 = Math.min(y0, r.tgt.y);
		x1 = Math.max(x1, r.tgt.x + r.w);
		y1 = Math.max(y1, r.tgt.y + r.h);
	});
	const inset = drawerInsets(),
		sw = (stage.clientWidth || 900) - inset.right,
		sh = (stage.clientHeight || 600) - inset.bottom,
		bw = x1 - x0,
		bh = y1 - y0;
	const z = clamp(
		Math.min((sw - 2 * o.pad) / bw, (sh - 2 * o.pad) / bh),
		o.minZ,
		o.maxZ,
	);
	const t = {
		z,
		x: bw * z > sw - 2 * o.pad ? o.pad - x0 * z : sw / 2 - (x0 + bw / 2) * z,
		y:
			bh * z > sh - 2 * o.pad
				? o.pad + 40 - y0 * z
				: sh / 2 - (y0 + bh / 2) * z,
	};
	if (o.instant) {
		Object.assign(S.view, t);
		coreStateState.vAnim = null;
		applyView();
	} else {
		coreStateState.vAnim = t;
		kickView();
	}
}
export function ensureVisible(id: string) {
	const r = R[id];
	if (!r?.shown) return;
	const v = S.view,
		inset = drawerInsets(),
		sw = stage.clientWidth - inset.right,
		sh = stage.clientHeight - inset.bottom,
		m = 70;
	const x0 = r.tgt.x * v.z + v.x,
		y0 = r.tgt.y * v.z + v.y,
		x1 = x0 + r.w * v.z,
		y1 = y0 + r.h * v.z;
	if (x0 >= m && y0 >= m + 30 && x1 <= sw - m && y1 <= sh - m) return;
	const z = Math.max(v.z, 0.7);
	coreStateState.vAnim = {
		z,
		x: sw / 2 - (r.tgt.x + r.w / 2) * z,
		y: sh / 2 - (r.tgt.y + r.h / 2) * z,
	};
	kickView();
}
// touch and trackpads fire many events per frame: apply the camera once per frame
export function scheduleView() {
	if (!state.viewRaf)
		state.viewRaf = requestAnimationFrame(() => {
			state.viewRaf = 0;
			applyView();
		});
}
export function flushView() {
	if (state.viewRaf) {
		cancelAnimationFrame(state.viewRaf);
		state.viewRaf = 0;
		applyView();
	}
}
export function zoomAt(f: number, cx: number, cy: number, defer?: boolean) {
	coreStateState.vAnim = null;
	const v = S.view,
		nz = clamp(v.z * f, 0.18, 1.8),
		k = nz / v.z;
	v.x = cx - (cx - v.x) * k;
	v.y = cy - (cy - v.y) * k;
	v.z = nz;
	if (defer) scheduleView();
	else applyView();
	if (S.mode === "detail" && v.z < 0.3) setMode("outer");
	else if (S.mode === "outer" && v.z > 1.25) {
		const w = {
			x: (cx - v.x) / v.z,
			y: (cy - v.y) / v.z,
		};
		let best = null,
			bd = 1e12;
		for (const id in R) {
			const r = R[id];
			if (!r.shown) continue;
			const d = Math.hypot(r.tgt.x + r.w / 2 - w.x, r.tgt.y + r.h / 2 - w.y);
			if (d < bd) {
				bd = d;
				best = id;
			}
		}
		setMode("detail", {
			focus: best,
		});
	}
}
export function setMode(m, o?) {
	o = o || {};
	if (S.mode === m) {
		return;
	}
	S.mode = m;
	if (m === "detail" && o.focus) {
		expandChain(o.focus);
		S.nodes[o.focus].collapsed = false;
	}
	layout(false);
	if (m === "outer")
		fitTo(visibleIds(), {
			maxZ: 1,
			minZ: 0.3,
			pad: 56,
		});
	else if (o.focus) {
		rebuildKM();
		fitTo([o.focus, ...descendants(o.focus)], {
			maxZ: 1,
			minZ: 0.55,
		});
	} else
		fitTo(visibleIds(), {
			maxZ: 1,
			minZ: 0.5,
		});
	applyView();
	save();
}
export function startView() {
	gridEl = document.getElementById("grid");
	state.vz = 0;
	state.vgs = 0;
	state.vflags = "";
	screenToWorld = (cx: number, cy: number) => {
		const r = stage.getBoundingClientRect();
		return {
			x: (cx - r.left - S.view.x) / S.view.z,
			y: (cy - r.top - S.view.y) / S.view.z,
		};
	};
	state.viewRaf = 0;
}
