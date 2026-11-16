import Mindsets from "../../../shared/mindsets.ts";
import { hasBridgeGround } from "../ai/prompts.ts";
import { ACT, ICONS, reduce, TICKET_LABEL } from "../core/constants.ts";
import { world } from "../core/dom.ts";
import { DOM } from "../core/profiles.ts";
import { state as coreStateState, R, S, spawnAt } from "../core/state.ts";
import {
	computeMap,
	descendants,
	effParent,
	isOuter,
	rebuildKM,
	visibleIds,
} from "../core/tree.ts";
import { kick } from "./edges.ts";
import {
	state as canvasLookState,
	decorate,
	effLook,
	moodColor,
	nodeW,
} from "./look.ts";
export let clsFor = null;
export /* ================= layout ================= */
function syncDom(vis) {
	for (const id in R) {
		if (!S.nodes[id]) {
			R[id].el.remove();
			delete R[id];
		}
	}
	for (const id of S.order) {
		const n = S.nodes[id];
		if (!n) continue;
		if (!R[id]) {
			const el = document.createElement("div");
			el.dataset.id = id;
			el.tabIndex = 0;
			el.style.display = "none";
			el.innerHTML =
				'<div class="in blk"><button type="button" class="mindset-label" hidden></button><span class="ico"></span><span class="txt"></span><span class="srcmark" role="button" aria-label="Where this came from"></span><span class="badge"></span><span class="mbadge"></span></div><div class="bar"></div>';
			world.appendChild(el);
			R[id] = {
				el,
				cur: {
					x: 0,
					y: 0,
				},
				tgt: {
					x: 0,
					y: 0,
				},
				w: nodeW(n.type),
				h: 56,
				shown: false,
				fresh: true,
			};
		}
	}
	for (const id in R) {
		const r = R[id],
			show = vis.has(id);
		if (show && !r.shown) {
			r.el.style.display = "";
			r.shown = true;
			r.fresh = true;
		}
		if (!show && r.shown) {
			r.el.style.display = "none";
			r.shown = false;
		}
		if (show) paint(S.nodes[id]);
	}
}
export function stepAttr(el, id) {
	const t = coreStateState.THMAP[id];
	if (t) {
		el.dataset.step = t.step;
		el.style.setProperty("--tc", t.color);
	} else if (el.dataset.step) {
		delete el.dataset.step;
		el.style.removeProperty("--tc");
	}
}
export function restyle() {
	coreStateState.MAP = computeMap();
	for (const id in R) {
		const n = S.nodes[id];
		if (n) {
			const c = clsFor(n, R[id]);
			if (R[id].el.className !== c) R[id].el.className = c;
			stepAttr(R[id].el, id);
		}
	}
}
export function paint(n) {
	const r = R[n.id],
		el = r.el,
		blk = el.firstElementChild as HTMLElement;
	el.className = clsFor(n, r);
	stepAttr(el, n.id);
	const hasKids = !!(coreStateState.KM[n.id] && coreStateState.KM[n.id].length);
	const desc = n.collapsed || S.mode === "outer" ? descendants(n.id) : [];
	const dots = desc
		.filter((x) => S.nodes[x].type === "emotion")
		.map((x) => S.nodes[x].mood || "curiosity");
	const sig = [
		n.type,
		n.text,
		JSON.stringify(n.mindset || null),
		n.ghost ? 1 : 0,
		n.mood || "",
		n.collapsed ? 1 : 0,
		S.mode,
		hasKids ? 1 : 0,
		desc.length,
		dots.join(","),
		n.parent ? 1 : 0,
		S.layer ? 1 : 0,
		coreStateState.MAP.flag[n.id] || "",
		n.ticket || "",
		n.state || "",
		n.src?.length || 0,
		canvasLookState.LOOKVER,
	].join("|");
	const actionSig = S.mindsets.length ? "mindsets" : "";
	if (sig === r.sig && actionSig === r.actionSig) return;
	r.sig = sig;
	r.actionSig = actionSig;
	blk.className = `in blk t-${n.type}`;
	el.style.width = `${decorate(blk as HTMLElement, n.type, n).width}px`;
	const ml = blk.querySelector(".mindset-label"),
		mindset = Mindsets.metadata(n.mindset);
	(ml as HTMLElement).hidden = !mindset;
	ml.textContent = mindset ? Mindsets.label(mindset, false) : "";
	(ml as HTMLElement).title = mindset
		? [
				mindset.packName,
				mindset.source.title,
				mindset.source.edition,
				mindset.source.url,
				mindset.source.coverage,
				...mindset.references.map((r) => `${r.source} — ${r.location}`),
				mindset.why,
			]
				.filter(Boolean)
				.join("\n")
		: "";
	if (mindset)
		ml.setAttribute(
			"aria-label",
			`${Mindsets.label(mindset, false)}. Show source and relevance`,
		);
	const ico = blk.querySelector(".ico");
	if (mindset) ico.textContent = mindset.icon;
	else ico.innerHTML = ICONS[n.type];
	{
		const sm = blk.querySelector(".srcmark");
		sm.innerHTML = ICONS.file;
		(sm as HTMLElement).title = n.src?.length
			? "From " +
				n.src[0].f +
				":" +
				n.src[0].l +
				(n.src.length > 1 ? ` (+${n.src.length - 1} more)` : "")
			: "";
	}
	if (!r.editing) blk.querySelector(".txt").textContent = n.text;
	const badge = blk.querySelector(".badge");
	badge.textContent = "";
	const notes = desc.filter((x) => !isOuter(S.nodes[x])).length;
	if (desc.length && !(S.mode === "outer" && notes === 0)) {
		const sp = document.createElement("span");
		sp.textContent =
			S.mode === "outer"
				? `${notes} ${notes === 1 ? "note" : "notes"}`
				: `${desc.length} hidden`;
		badge.appendChild(sp);
		const d = document.createElement("span");
		d.className = "dots";
		dots.slice(0, 14).forEach((m) => {
			const i = document.createElement("i");
			i.style.setProperty("--c", moodColor(m));
			d.appendChild(i);
		});
		badge.appendChild(d);
	}
	const mb = blk.querySelector(".mbadge");
	mb.textContent = "";
	if (S.layer && (n.type === "question" || n.type === "fog")) {
		const add = (t: string | null, c?: string) => {
			const sp = document.createElement("span");
			sp.className = `mchip${c ? ` ${c}` : ""}`;
			sp.textContent = t;
			mb.appendChild(sp);
		};
		const f = coreStateState.MAP.flag[n.id];
		if (n.type === "question") add(TICKET_LABEL[n.ticket || "talk"]);
		if (n.type === "fog")
			add(n.state === "out" ? "Out of scope" : "Fog", "fogc");
		else if (f && !n.ghost)
			add(
				{
					settled: "Settled",
					frontier: "Up next",
					blocked: "Waiting",
					out: "Out of scope",
				}[f],
				f,
			);
	}
	const btns = nodeActions(n, hasKids);
	el.querySelector(".bar").innerHTML = btns
		.map(
			([a, t]) =>
				`<button type="button" data-act="${a}" title="${t}" aria-label="${t}">${ACT[a]}</button>`,
		)
		.join("");
}
// what can be done to a block: [action, description] pairs, in order. Used by the desktop bar, the phone action strip and the menus.
export function nodeActions(n, hasKids) {
	const btns = [];
	if (S.mode === "outer") {
		if (isOuter(n)) btns.push(["open", "Open in detail view"]);
	} else if (n.ghost) {
		btns.push(["accept", "Keep this suggestion"], ["dismiss", "Dismiss"]);
	} else if (n.type === "fog") {
		btns.push(
			["sharpen", "Sharpen into a question"],
			[
				"out",
				n.state === "out" ? "Bring back into scope" : "Mark out of scope",
			],
			["del", "Delete"],
		);
	} else {
		if (S.layer && n.type === "question") {
			btns.push(
				n.state === "settled"
					? ["reopen", "Reopen this question"]
					: ["resolve", "Resolve this question"],
			);
			btns.push(
				[
					"ticket",
					"Ticket type: " +
						TICKET_LABEL[n.ticket || "talk"] +
						". Click to change",
				],
				["block", "Blocked by…"],
				[
					"out",
					n.state === "out" ? "Bring back into scope" : "Mark out of scope",
				],
			);
		}
		btns.push(["grill", "Grill me on this"]);
		if (n.src?.length) btns.push(["src", "Where this came from"]);
		btns.push(["grow", "Grow branches from here"]);
		if (S.mindsets.length) btns.push(["mindset", "Apply a mindset"]);
		if (n.type === "emotion") {
			if (hasBridgeGround(n.id))
				btns.push([
					"bridge",
					"Bridge: connect the existing tree to this feeling, from both ends",
				]);
			btns.push(["back", DOM().traceTip]);
		}
		if (hasKids) btns.push(["collapse", n.collapsed ? "Expand" : "Collapse"]);
		btns.push([
			"del",
			hasKids ? "Delete node (its children move up)" : "Delete",
		]);
		if (hasKids) btns.push(["delb", "Delete node and everything below it"]);
	}
	return btns;
}
export function layout(initial: boolean) {
	rebuildKM();
	coreStateState.MAP = computeMap();
	const vis = new Set(visibleIds());
	syncDom(vis);
	const ids = [...vis];
	for (const id of ids) {
		const r = R[id];
		r.w = nodeW(S.nodes[id].type);
		r.h = r.el.offsetHeight || 56;
	}
	const kidsOf = {},
		roots = [];
	for (const id of ids) {
		const p = effParent(id);
		if (p && vis.has(p)) {
			kidsOf[p] ||= [];
			kidsOf[p].push(id);
		} else roots.push(id);
	}
	const GY = effLook().layout.rowGap,
		gapX = effLook().layout.colGap,
		colW = [],
		colX = [0];
	const walk = (id, d: number) => {
		colW[d] = Math.max(colW[d] || 0, R[id].w);
		(kidsOf[id] || []).forEach((c) => {
			walk(c, d + 1);
		});
	};
	roots.forEach((id) => {
		walk(id, 0);
	});
	for (let d = 1; d < colW.length; d++)
		colX[d] = colX[d - 1] + colW[d - 1] + gapX;
	const sub = (id) => {
		let hs = 0;
		const k = kidsOf[id] || [];
		k.forEach((c, i) => {
			hs += sub(c) + (i ? GY : 0);
		});
		R[id].kh = hs;
		R[id].sh = Math.max(R[id].h, hs);
		return R[id].sh;
	};
	const put = (id, d: number, top: number) => {
		const r = R[id],
			k = kidsOf[id] || [];
		r.tgt.x = colX[d];
		if (!k.length) {
			r.tgt.y = top + (r.sh - r.h) / 2;
			return;
		}
		let cy = top + (r.sh - r.kh) / 2;
		k.forEach((c) => {
			put(c, d + 1, cy);
			cy += R[c].sh + GY;
		});
		const a = R[k[0]],
			b = R[k[k.length - 1]];
		r.tgt.y = (a.tgt.y + b.tgt.y + b.h) / 2 - r.h / 2;
	};
	let y = 0;
	roots.forEach((id) => {
		sub(id);
		put(id, 0, y);
		y += R[id].sh + 40;
	});
	for (const id of ids) {
		const r = R[id];
		if (initial) {
			r.cur.x = r.tgt.x;
			r.cur.y = r.tgt.y;
			r.fresh = false;
			continue;
		}
		if (r.fresh) {
			r.fresh = false;
			const sp = spawnAt[id];
			delete spawnAt[id];
			const p = effParent(id),
				pr = p && R[p]?.shown ? R[p] : null;
			if (sp) {
				r.cur.x = sp.x - r.w / 2;
				r.cur.y = sp.y - r.h / 2;
			} else if (pr) {
				const f = pr.fresh ? pr.tgt : pr.cur;
				r.cur.x = f.x;
				r.cur.y = f.y;
			} else {
				r.cur.x = r.tgt.x;
				r.cur.y = r.tgt.y;
			}
			if (!reduce) {
				r.enter = true;
				r.el.className = clsFor(S.nodes[id], r);
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						r.enter = false;
						if (S.nodes[id]) r.el.className = clsFor(S.nodes[id], r);
					}),
				);
			}
		}
	}
	kick();
}
export function startLayout() {
	clsFor = (n, r) =>
		[
			"node",
			n.type,
			r.culled && "culled",
			n.ghost && "ghost",
			S.sel === n.id && "sel",
			r.enter && "enter",
			r.hot && "hot",
			r.growing && "growing",
			r.drag && "drag",
			r.drop && "drop",
			r.settle && "settle",
			n.src?.length && "has-src",
			n.collapsed && "collapsed",
			S.layer &&
				coreStateState.MAP.flag[n.id] &&
				`m-${coreStateState.MAP.flag[n.id]}`,
			S.layer && n.decided && "decided",
			coreStateState.linkFrom === n.id && "linking",
			coreStateState.THMAP[n.id] && "in-thread",
		]
			.filter(Boolean)
			.join(" ");
}
