import * as CascadeUI from "../../runtime.tsx";
import {
	activeProvider,
	aiAvailable,
	callAI,
	parseObj,
} from "../ai/prompts.ts";
import {
	applyLook,
	applyWire,
	state as canvasLookState,
	decorate,
	deepMerge,
	effLook,
	isObj,
	KIND_LABEL,
	moodColor,
	NAMED,
	NODE_TYPES,
	rgbOf,
	SHAPES,
	SVGNS,
	sanitizeLook,
	saveLook,
	WIRE_KINDS,
	WIRE_STYLES,
	wirePath,
} from "../canvas/look.ts";
import { $, ICONS, LABEL, MOOD_KEYS } from "../core/constants.ts";
import { DOM } from "../core/profiles.ts";
export let PRESETS = undefined,
	mixHex = undefined,
	TYPE_PHRASE = undefined,
	LK = undefined,
	lkStyle = undefined,
	countLeaves = undefined;
export function lookFromText(desc) {
	const t =
		" " +
		String(desc || "")
			.toLowerCase()
			.replace(/[,.;:!?()]/g, " ")
			.replace(/\s+/g, " ") +
		" ";
	const patch = {};
	let reset = false;
	const put = (path: string, val: string | number | boolean) => {
		const ks = path.split(".");
		let o = patch;
		ks.slice(0, -1).forEach((k) => {
			o = o[k] = o[k] || {};
		});
		o[ks[ks.length - 1]] = val;
	};
	const pre = PRESETS.find((pr) => pr.words.some((w) => t.includes(` ${w}`)));
	if (pre) {
		if (pre.id === "default") reset = true;
		else Object.assign(patch, JSON.parse(JSON.stringify(pre.patch)));
	}
	if (/ straight |direct lines?|plain lines?/.test(t))
		put("wires.style", "straight");
	if (/manhattan|orthogonal|right[- ]?angle|circuit|stepped|elbow/.test(t))
		put("wires.style", "manhattan");
	if (/curv|smooth|swoop|organic|bezier|flowing|loopy/.test(t)) {
		put("wires.style", "bezier");
		put(
			"wires.curvature",
			/very|extra|super|really|swoop|loopy|dramatic/.test(t)
				? 0.9
				: /gentle|slight|subtle|tight/.test(t)
					? 0.3
					: 0.7,
		);
	}
	if (
		/thick (wires?|lines?|connections?|edges?)|heavy (wires?|lines?)|bold (wires?|lines?)/.test(
			t,
		)
	)
		put("wires.width", 3.5);
	if (
		/thin (wires?|lines?|connections?|edges?)|hairline|delicate (wires?|lines?)/.test(
			t,
		)
	)
		put("wires.width", 1);
	if (/dashed (wires?|lines?|connections?)/.test(t))
		put("wires.dash", "dashed");
	else if (/dotted (wires?|lines?|connections?)/.test(t))
		put("wires.dash", "dotted");
	if (/arrows?|arrowheads?|directional/.test(t)) put("wires.arrows", "end");
	if (
		/colou?r[- ]?coded (wires?|lines?)|colou?red (wires?|lines?)|wires? (match|use|take) (the )?(block|node)? ?colou?rs?/.test(
			t,
		)
	)
		put("wires.colorBy", "child");
	if (
		/no grid|without (a )?grid|plain background|blank (canvas|background)/.test(
			t,
		)
	)
		put("canvas.grid", "none");
	else if (/graph paper|grid lines|squared paper|lined grid/.test(t))
		put("canvas.grid", "lines");
	else if (/dot grid|dotted (grid|background)/.test(t))
		put("canvas.grid", "dots");
	if (!pre && /\b(dark|night|midnight)\b/.test(t)) {
		put("canvas.bg", "#0f1a2b");
		put("canvas.gridColor", "#22334d");
		put("nodes.base.fill", "#18273d");
		put("nodes.base.stroke", "#3b5273");
		put("nodes.base.text", "#e8eef7");
		put("nodes.base.iconColor", "#9db0c8");
		put("wires.color", "#566b88");
	} else if (
		!pre &&
		/\b(light|bright|airy white)\b/.test(t) &&
		!/lightweight|light blue|light green/.test(t)
	) {
		put("canvas.bg", "#f7f9fb");
		put("nodes.base.fill", "#ffffff");
		put("nodes.base.text", "#16233a");
	}
	if (
		/spacious|airy|roomy|loose|spread out|more space|breathing room/.test(t)
	) {
		put("layout.colGap", 96);
		put("layout.rowGap", 30);
	} else if (
		/\btight\b|compact|dense|cramped|close together|less space/.test(t) &&
		!/tight curv/.test(t)
	) {
		put("layout.colGap", 22);
		put("layout.rowGap", 6);
	}
	if (/\bglow(ing)?\b/.test(t)) put("nodes.base.shadow", "glow");
	else if (/shadows?|drop shadow|raised|floating|elevated/.test(t))
		put("nodes.base.shadow", "soft");
	else if (/\bflat\b/.test(t)) put("nodes.base.shadow", "none");
	const cur = (k: string) => effLook().nodes[k === "base" ? "answer" : k];
	let colourUsed = false;
	for (const k of ["base", ...NODE_TYPES]) {
		const m = t.match(
			new RegExp(`((?:[a-z-]+ ){0,4})(?:${TYPE_PHRASE[k]})(?= |$)`),
		);
		if (!m) continue;
		const words = m[1].trim().split(" ").filter(Boolean);
		let scale = 1,
			tint = 0;
		words.forEach((w, _i) => {
			if (w === "dark" || w === "deep" || w === "darker") {
				tint = -1;
				return;
			}
			if (w === "light" || w === "pale" || w === "lighter") {
				tint = 1;
				return;
			}
			const nm =
				/^(diamond|hexagon|hexagonal|round|rounded|square|boxy|rectangular|sharp|pill|capsule|oval|ellipse|elliptical|circular|circle|tag|arrow|slanted|parallelogram)$/.exec(
					w,
				);
			if (nm) {
				const v = nm[1];
				put(
					`nodes.${k}.shape`,
					/diamond/.test(v)
						? "diamond"
						: /hex/.test(v)
							? "hexagon"
							: /^(round|rounded)$/.test(v)
								? "rounded"
								: /square|boxy|rect|sharp/.test(v)
									? "rect"
									: /pill|capsule/.test(v)
										? "pill"
										: /oval|ellip|circ/.test(v)
											? "ellipse"
											: /tag|arrow/.test(v)
												? "tag"
												: "parallelogram",
				);
				if (v === "round") put(`nodes.${k}.radius`, 20);
				return;
			}
			if (/^(huge|giant|enormous|massive)$/.test(w)) scale = 1.5;
			else if (/^(big|large|bigger|larger)$/.test(w)) scale = 1.3;
			else if (/^(small|tiny|little|smaller|compact)$/.test(w)) scale = 0.78;
			else if (/^(bold|heavy)$/.test(w)) put(`nodes.${k}.fontWeight`, 800);
			else if (w === "italic") put(`nodes.${k}.italic`, true);
			else if (/^(dashed|dotted)$/.test(w)) put(`nodes.${k}.strokeStyle`, w);
			else if (/^(outlined|hollow|transparent|empty)$/.test(w)) {
				put(`nodes.${k}.fill`, "transparent");
				put(`nodes.${k}.text`, "var(--ink)");
			} else if (NAMED[w]) {
				let hex = NAMED[w];
				if (tint < 0) hex = mixHex(hex, "#000000", 0.38);
				else if (tint > 0) hex = mixHex(hex, "#ffffff", 0.5);
				put(`nodes.${k}.fill`, hex);
				put(`nodes.${k}.text`, "auto");
				colourUsed = true;
			}
		});
		if (scale !== 1) {
			const c = cur(k);
			put(`nodes.${k}.width`, Math.round((c.width * scale) / 2) * 2);
			put(
				`nodes.${k}.fontSize`,
				Math.max(
					10,
					Math.min(
						26,
						Math.round(
							(c.fontSize + (scale > 1 ? 2.5 * scale - 1.5 : -2)) * 2,
						) / 2,
					),
				),
			);
			put(`nodes.${k}.padY`, Math.round(c.padY * (scale > 1 ? 1.25 : 0.8)));
		}
	}
	if (!colourUsed && !pre) {
		const cw = Object.keys(NAMED).find(
			(w) =>
				new RegExp(
					` ${w} (theme|look|palette|style|scheme|colou?rs?|vibe)`,
				).test(t) ||
				new RegExp(`(theme|palette|colou?rs?) (of |in )?${w} `).test(t),
		);
		if (cw) {
			const hex = NAMED[cw];
			put("canvas.bg", mixHex(hex, "#ffffff", 0.93));
			put("nodes.base.fill", mixHex(hex, "#ffffff", 0.84));
			put("nodes.base.stroke", hex);
			put("nodes.base.text", "#16233a");
			put("nodes.decision.fill", hex);
			put("nodes.decision.stroke", hex);
			put("nodes.decision.text", "auto");
			put("wires.color", hex);
		}
	}
	return {
		patch,
		reset,
	};
}
export function describePatch(p) {
	const out = [],
		bits = (o, names) =>
			names
				.filter(([k]) => o[k] !== undefined)
				.map(([k, l]) => `${l} ${typeof o[k] === "object" ? "changed" : o[k]}`);
	if (p.nodes)
		for (const k in p.nodes) {
			const n = p.nodes[k],
				b = bits(n, [
					["shape", "shape"],
					["fill", "fill"],
					["stroke", "outline"],
					["strokeWidth", "outline width"],
					["width", "width"],
					["fontSize", "text size"],
					["radius", "corners"],
					["shadow", "shadow"],
					["pattern", "pattern"],
				]);
			if (b.length)
				out.push(
					`${k === "base" ? "All blocks" : `${LABEL[k] || k} blocks`}: ${b.join(", ")}`,
				);
		}
	if (p.wires) {
		const b = bits(p.wires, [
			["style", "style"],
			["curvature", "curve"],
			["elbow", "elbow"],
			["radius", "corner radius"],
			["width", "width"],
			["color", "colour"],
			["dash", "dash"],
			["arrows", "arrows"],
			["colorBy", "coloured by"],
		]);
		if (p.wires.kinds) b.push("per-link colours changed");
		if (b.length) out.push(`Wires: ${b.join(", ")}`);
	}
	if (p.canvas) {
		const b = bits(p.canvas, [
			["bg", "background"],
			["grid", "grid"],
			["gridColor", "grid colour"],
			["gridSize", "grid size"],
		]);
		if (b.length) out.push(`Canvas: ${b.join(", ")}`);
	}
	if (p.layout) {
		const b = bits(p.layout, [
			["colGap", "column gap"],
			["rowGap", "row gap"],
		]);
		if (b.length) out.push(`Spacing: ${b.join(", ")}`);
	}
	if (p.moods) out.push(`Mood colours: ${Object.keys(p.moods).join(", ")}`);
	return out;
}
export function lookPrompt(desc) {
	return `You are the visual designer for a node-graph app. Turn the description into a JSON style patch.

CURRENT OVERRIDES (JSON, may be empty): ${JSON.stringify(canvasLookState.LOOK)}

STYLE FIELDS (include only what you want to change):
{
 "nodes": { "base": N, "question": N, "answer": N, "emotion": N, "consequence": N, "decision": N, "loop": N, "fog": N },
 "wires": { "style": "default|bezier|straight|manhattan", "curvature": 0-1, "elbow": 0.1-0.9, "radius": 0-30, "width": 0.5-8, "color": C, "opacity": 0.1-1, "dash": "solid|dashed|dotted", "arrows": "none|end", "colorBy": "none|child|parent", "kinds": { "tree|related|flow|block|back": { "color": C, "width": n, "dash": "solid|dashed|dotted" } } },
 "canvas": { "bg": C, "grid": "dots|lines|none", "gridColor": C, "gridSize": 10-80 },
 "layout": { "colGap": 16-200, "rowGap": 2-80 },
 "moods": { "frustration|boredom|curiosity|delight|awe|confusion|tension": C }
}
N (a block style) = { "shape": "rounded|rect|pill|ellipse|diamond|hexagon|parallelogram|tag", "radius": 0-60, "fill": C or "mood", "stroke": C, "strokeWidth": 0-10, "strokeStyle": "solid|dashed|dotted|double|none", "text": C or "auto", "fontSize": 9-30, "fontWeight": 400|500|600|700|800, "italic": true|false, "width": 100-480, "padX": 0-60, "padY": 0-40, "shadow": "none|soft|hard|glow", "pattern": "none|hatch|dots", "opacity": 0.3-1, "icon": true|false, "bar": {"width": 0-14, "color": C} or null, "ring": {"width": 0-6, "color": C, "offset": 0-12} or null }
C is a hex colour such as "#3566D1".
"base" applies to every block type, and a type's own entry wins. Emotion blocks normally take their colour from the mood, so leave the emotion fill alone unless the description asks for it.

DESCRIPTION: ${desc}

Rules: reply with ONLY a JSON object, no markdown. Keep text readable with strong contrast against its fill. Prefer a few well-chosen changes over changing everything. Do not invent fields.`;
}

/* the editor */
export function lkCheckpoint() {
	const j = JSON.stringify(canvasLookState.LOOK);
	if (LK.hist[LK.hist.length - 1] !== j) {
		LK.hist.push(j);
		if (LK.hist.length > 40) LK.hist.shift();
	}
	lkRefreshBar();
}
export function lkUndo() {
	const cur = JSON.stringify(canvasLookState.LOOK);
	let prev: string | undefined;
	while (LK.hist.length) {
		prev = LK.hist.pop();
		if (prev !== cur) break;
		prev = undefined;
	}
	if (prev !== undefined) {
		LK.pend = null;
		canvasLookState.LOOK = JSON.parse(prev);
		applyLook();
		lkRefresh();
	}
	lkRefreshBar();
}
export function lkReset() {
	lkCommitPending();
	lkCheckpoint();
	canvasLookState.LOOK = {};
	applyLook();
	lkRefresh();
}
export function lookChanged() {
	applyLook();
	lkRefresh();
}
export function lkSetNode(field, val?: undefined) {
	const t = LK.type;
	canvasLookState.LOOK.nodes = canvasLookState.LOOK.nodes || {};
	canvasLookState.LOOK.nodes[t] = canvasLookState.LOOK.nodes[t] || {};
	const o = canvasLookState.LOOK.nodes[t];
	if (val === undefined) delete o[field];
	else o[field] = val;
	if (!Object.keys(o).length) delete canvasLookState.LOOK.nodes[t];
	if (!Object.keys(canvasLookState.LOOK.nodes).length)
		delete canvasLookState.LOOK.nodes;
	lookChanged();
}
export function lkSetGroup(group, field, val?: undefined) {
	canvasLookState.LOOK[group] = canvasLookState.LOOK[group] || {};
	if (val === undefined) delete canvasLookState.LOOK[group][field];
	else canvasLookState.LOOK[group][field] = val;
	if (!Object.keys(canvasLookState.LOOK[group]).length)
		delete canvasLookState.LOOK[group];
	lookChanged();
}
export function lkSetKind(kind, field, val?: undefined) {
	canvasLookState.LOOK.wires = canvasLookState.LOOK.wires || {};
	canvasLookState.LOOK.wires.kinds = canvasLookState.LOOK.wires.kinds || {};
	canvasLookState.LOOK.wires.kinds[kind] =
		canvasLookState.LOOK.wires.kinds[kind] || {};
	const o = canvasLookState.LOOK.wires.kinds[kind];
	if (val === undefined) delete o[field];
	else o[field] = val;
	if (!Object.keys(o).length) delete canvasLookState.LOOK.wires.kinds[kind];
	if (!Object.keys(canvasLookState.LOOK.wires.kinds).length)
		delete canvasLookState.LOOK.wires.kinds;
	if (!Object.keys(canvasLookState.LOOK.wires).length)
		delete canvasLookState.LOOK.wires;
	lookChanged();
}
export function toHex(c: string) {
	const rgb = rgbOf(c);
	if (rgb)
		return `#${rgb.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
	try {
		const pr = document.createElement("span");
		pr.style.color = c;
		pr.style.display = "none";
		document.body.appendChild(pr);
		const cs = getComputedStyle(pr).color;
		pr.remove();
		const m = cs.match(/\d+/g);
		if (m)
			return (
				"#" +
				m
					.slice(0, 3)
					.map((x) => (+x).toString(16).padStart(2, "0"))
					.join("")
			);
	} catch {}
	return "#808080";
}
export function wirePreview() {
	const svg = $("#lkWpv");
	if (!svg) return;
	svg.textContent = "";
	const W = effLook().wires,
		mkr = (x, y, w, h) => {
			const r = document.createElementNS(SVGNS, "rect");
			r.setAttribute("x", String(x));
			r.setAttribute("y", String(y));
			r.setAttribute("width", String(w));
			r.setAttribute("height", String(h));
			r.setAttribute("rx", String(5));
			return r;
		};
	const kids = [
		{
			y: 10,
			type: "question",
		},
		{
			y: 50,
			type: "emotion",
		},
		{
			y: 92,
			type: "decision",
		},
	];
	svg.appendChild(mkr(14, 48, 86, 34));
	kids.forEach((k) => {
		svg.appendChild(mkr(220, k.y, 86, 30));
	});
	kids.forEach((k) => {
		const pth = document.createElementNS(SVGNS, "path");
		pth.setAttribute("d", wirePath(100, 65, 220, k.y + 15, 1, 1, W, 36));
		applyWire(
			pth,
			"tree",
			{
				type: k.type,
				mood: "curiosity",
			},
			{
				type: "question",
			},
			false,
		);
		svg.insertBefore(pth, svg.firstChild);
	});
}
export function lkCommitPending() {
	if (LK.pend) {
		LK.pend = null;
		saveLook();
		LK.resultOpen = false;
	}
}
export function lkPreviewPatch(patch, reset, note) {
	lkCheckpoint();
	LK.pend = {
		before: JSON.stringify(canvasLookState.LOOK),
	};
	canvasLookState.LOOK = reset
		? sanitizeLook(patch)
		: sanitizeLook(deepMerge(canvasLookState.LOOK, patch));
	applyLook({
		noSave: true,
	});
	lkRefresh();
	LK.changes = describePatch(patch);
	if (reset) LK.changes.unshift("Back to the default look");
	if (!LK.changes.length) LK.changes = ["Nothing visible changed."];
	LK.note = note || "";
	LK.resultOpen = true;
}
export async function lkGenerate() {
	const desc = LK.desc.trim();
	if (!desc || LK.busy) return;
	lkCommitPending();
	LK.busy = true;
	LK.status = "Designing…";
	let patch = null,
		reset = false,
		note = "";
	const real = aiAvailable() && activeProvider() !== "demo";
	if (real) {
		try {
			patch = sanitizeLook(
				parseObj(
					(
						await callAI(lookPrompt(desc), {
							temperature: 0.6,
						})
					).text,
				),
			);
			if (!Object.keys(patch).length) {
				patch = null;
				note =
					"The AI didn’t return anything usable, so the built-in interpreter handled it.";
			}
		} catch {
			patch = null;
			note =
				"The AI’s reply couldn’t be used, so the built-in interpreter handled it.";
		}
	} else
		note =
			"Interpreted by the built-in keyword engine. Connect an AI for freer descriptions.";
	if (!patch) {
		const r = lookFromText(desc);
		patch = sanitizeLook(r.patch);
		reset = r.reset;
	}
	LK.busy = false;
	LK.status = "";
	if (!Object.keys(patch).length && !reset) {
		LK.status =
			"I couldn’t find anything to change. Try words like “blueprint”, “straight wires”, “huge diamond decisions”, “pastel” or “dark”.";
		return;
	}
	lkPreviewPatch(patch, reset, note);
}
export function lkPreset(id) {
	const preset = PRESETS.find((p) => p.id === id);
	if (!preset) return;
	lkCommitPending();
	lkCheckpoint();
	canvasLookState.LOOK = sanitizeLook(JSON.parse(JSON.stringify(preset.patch)));
	applyLook();
	lkRefresh();
}
export function lkSetMood(mood, value?: string) {
	canvasLookState.LOOK.moods = canvasLookState.LOOK.moods || {};
	if (value === undefined) delete canvasLookState.LOOK.moods[mood];
	else canvasLookState.LOOK.moods[mood] = value;
	if (!Object.keys(canvasLookState.LOOK.moods).length)
		delete canvasLookState.LOOK.moods;
	lookChanged();
}
export function lkResetType() {
	lkCheckpoint();
	if (canvasLookState.LOOK.nodes) {
		delete canvasLookState.LOOK.nodes[LK.type];
		if (!Object.keys(canvasLookState.LOOK.nodes).length)
			delete canvasLookState.LOOK.nodes;
	}
	lookChanged();
}
export function lkRevert() {
	if (!LK.pend) return;
	canvasLookState.LOOK = JSON.parse(LK.pend.before);
	LK.pend = null;
	LK.resultOpen = false;
	applyLook();
	lkRefresh();
}
export function lkApply(text) {
	let obj: ReturnType<typeof JSON.parse>;
	try {
		obj = JSON.parse(text || "{}");
	} catch (e) {
		LK.textOk = false;
		LK.textError = `That isn’t valid JSON: ${e.message}`;
		return;
	}
	if (!isObj(obj)) {
		LK.textOk = false;
		LK.textError =
			'The look must be a JSON object, like { "wires": { "style": "straight" } }.';
		return;
	}
	const clean = sanitizeLook(obj),
		dropped = countLeaves(obj) - countLeaves(clean);
	lkCommitPending();
	lkCheckpoint();
	canvasLookState.LOOK = clean;
	applyLook();
	lkRefresh();
	LK.textOk = true;
	LK.textError =
		dropped > 0
			? `Applied. ${dropped} value${dropped === 1 ? " was" : "s were"} ignored because they were unknown or out of range.`
			: "Applied.";
}
export function lkFormat() {
	LK.text = JSON.stringify(canvasLookState.LOOK, null, 2);
	LK.textError = "";
}
export async function lkCopy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		LK.textOk = true;
		LK.textError = "Copied.";
	} catch {
		LK.textOk = false;
		LK.textError = "Select the text and copy it.";
	}
}
export function lkRefreshBar() {
	LK.revision++;
}
export function lkRefresh() {
	CascadeUI.sync(() => {
		LK.revision++;
		if (!LK.textFocused)
			LK.text = JSON.stringify(canvasLookState.LOOK, null, 2);
	});
}
export function lkShowTab(tab) {
	CascadeUI.sync(() => {
		LK.tab = tab;
	});
	lkRefresh();
}
export function ensureLookUI() {
	LK.built = true;
	const lookSheet = `nodes.base | question | answer | emotion | consequence | decision | loop | fog:
  shape: ${SHAPES.join(" | ")}
  radius 0-60 (or four numbers)   fill, stroke, text, iconColor: "#rrggbb"
  fill "mood" and text "auto" follow the mood and contrast
  strokeWidth 0-10   strokeStyle: solid | dashed | dotted | double | none
  fontSize 9-30   fontWeight 400-900   italic   icon
  width 100-480   padX 0-60   padY 0-40
  shadow: none | soft | hard | glow   pattern: none | hatch | dots   opacity 0.3-1
  bar: { width, color } or null   ring: { width, color, offset } or null
wires: style ${WIRE_STYLES.join(" | ")}, curvature 0-1, elbow 0.1-0.9, radius 0-30,
  width, color, opacity, dash, arrows none | end, colorBy none | child | parent,
  kinds.${WIRE_KINDS.join(" | ")}: { color, width, dash }
canvas: bg, grid dots | lines | none, gridColor, gridSize 10-80
layout: colGap 16-200, rowGap 2-80
moods: ${MOOD_KEYS.join(" | ")}: "#rrggbb"`;
	CascadeUI.connect({
		LK,
		PRESETS,
		SHAPES,
		NODE_TYPES,
		LABEL,
		MOOD_KEYS,
		WIRE_KINDS,
		KIND_LABEL,
		WIRE_STYLES,
		ICONS,
		DOM,
		effLook,
		moodColor,
		toHex,
		decorate,
		lkStyle,
		lookSheet,
		getLook: () => canvasLookState.LOOK,
	});
	CascadeUI.mount("look", $("#lookRoot"));
	lkRefresh();
}
export function initialize() {
	PRESETS = [
		{
			id: "default",
			name: "Default",
			desc: "The original Cascade look.",
			words: ["default", "original", "reset", "factory"],
			sw: ["#e4eaef", "#ffffff", "#16233a", "#16233a", "#7c8da3"],
			patch: {},
		},
		{
			id: "blueprint",
			name: "Blueprint",
			desc: "Technical drawing: right-angle wires on a blue grid.",
			words: ["blueprint", "technical", "schematic", "engineering", "drafting"],
			sw: ["#0b2545", "#13315c", "#8da9c4", "#eef4ed", "#8da9c4"],
			patch: {
				canvas: {
					bg: "#0b2545",
					grid: "lines",
					gridColor: "#16365f",
					gridSize: 28,
				},
				nodes: {
					base: {
						shape: "rect",
						fill: "#13315c",
						stroke: "#8da9c4",
						strokeWidth: 1.5,
						text: "#eef4ed",
						iconColor: "#8da9c4",
					},
					question: {
						fill: "#0b2545",
						stroke: "#eef4ed",
						strokeWidth: 2,
					},
					emotion: {
						shape: "pill",
					},
					consequence: {
						fill: "#0f2d52",
						bar: {
							width: 4,
							color: "#8da9c4",
						},
					},
					decision: {
						shape: "diamond",
						fill: "#eef4ed",
						stroke: "#eef4ed",
						text: "#0b2545",
						width: 240,
					},
					loop: {
						shape: "rect",
						fill: "#0b2545",
						stroke: "#eef4ed",
						ring: null,
						width: 200,
					},
					fog: {
						fill: "#0b2545",
						stroke: "#8da9c4",
						strokeStyle: "dashed",
						text: "#8da9c4",
						pattern: "none",
					},
				},
				wires: {
					style: "manhattan",
					radius: 0,
					width: 1.5,
					color: "#8da9c4",
					arrows: "end",
				},
				layout: {
					colGap: 56,
					rowGap: 14,
				},
			},
		},
		{
			id: "paper",
			name: "Paper sketch",
			desc: "Warm paper, ink outlines, loose curved wires.",
			words: [
				"paper",
				"sketch",
				"notebook",
				"hand-drawn",
				"handdrawn",
				"ink",
				"whiteboard",
			],
			sw: ["#fbf7ef", "#fffdf8", "#3a3a3a", "#2b2b2b", "#3a3a3a"],
			patch: {
				canvas: {
					bg: "#fbf7ef",
					grid: "none",
				},
				nodes: {
					base: {
						fill: "#fffdf8",
						stroke: "#3a3a3a",
						strokeWidth: 1.5,
						text: "#2b2b2b",
						radius: 6,
						iconColor: "#6b6b6b",
					},
					question: {
						radius: [2, 12, 2, 12],
						strokeWidth: 2,
					},
					consequence: {
						fill: "#f6efe0",
						bar: {
							width: 4,
							color: "#3a3a3a",
						},
					},
					decision: {
						fill: "#2b2b2b",
						stroke: "#2b2b2b",
						text: "#fffdf8",
						shadow: "hard",
					},
					loop: {
						ring: null,
						stroke: "#2b2b2b",
						strokeWidth: 2.5,
						radius: 8,
					},
					fog: {
						fill: "#f6efe0",
						stroke: "#6b6b6b",
						text: "#6b6b6b",
					},
				},
				wires: {
					style: "bezier",
					curvature: 0.75,
					width: 1.4,
					color: "#3a3a3a",
				},
				layout: {
					colGap: 52,
					rowGap: 16,
				},
			},
		},
		{
			id: "neon",
			name: "Neon night",
			desc: "Dark canvas, glowing outlines, colour-coded wires.",
			words: [
				"neon",
				"cyber",
				"synthwave",
				"glowing",
				"cyberpunk",
				"vaporwave",
			],
			sw: ["#0a0a12", "#12121f", "#00f5d4", "#f15bb5", "#7b7bff"],
			patch: {
				canvas: {
					bg: "#0a0a12",
					grid: "dots",
					gridColor: "#1c1c30",
				},
				nodes: {
					base: {
						fill: "#12121f",
						stroke: "#7b7bff",
						strokeWidth: 1.5,
						text: "#f2f2ff",
						radius: 8,
						shadow: "glow",
						iconColor: "#7b7bff",
					},
					question: {
						stroke: "#00f5d4",
						strokeWidth: 2,
					},
					answer: {
						stroke: "#9b5de5",
					},
					emotion: {
						shadow: "glow",
					},
					consequence: {
						stroke: "#fee440",
						bar: null,
						fill: "#12121f",
					},
					decision: {
						fill: "#f15bb5",
						stroke: "#f15bb5",
						text: "#12121f",
					},
					loop: {
						fill: "#0a0a12",
						stroke: "#00bbf9",
						ring: null,
					},
					fog: {
						fill: "#12121f",
						stroke: "#7b7bff",
						strokeStyle: "dashed",
						text: "#c9c9ff",
						pattern: "none",
					},
				},
				wires: {
					style: "straight",
					width: 1.6,
					color: "#7b7bff",
					opacity: 0.85,
					arrows: "end",
					colorBy: "child",
				},
			},
		},
		{
			id: "mono",
			name: "Minimal mono",
			desc: "Square, grey and quiet. Thin straight wires.",
			words: [
				"minimal",
				"monochrome",
				"mono",
				"clean",
				"simple",
				"greyscale",
				"grayscale",
			],
			sw: ["#ffffff", "#ffffff", "#888888", "#222222", "#999999"],
			patch: {
				canvas: {
					bg: "#ffffff",
					grid: "none",
				},
				nodes: {
					base: {
						shape: "rect",
						fill: "#ffffff",
						stroke: "#888888",
						strokeWidth: 1,
						text: "#222222",
						radius: 0,
						fontSize: 13,
						iconColor: "#888888",
					},
					question: {
						stroke: "#222222",
						strokeWidth: 1.5,
					},
					emotion: {
						shape: "pill",
					},
					consequence: {
						bar: null,
						fill: "#f4f4f4",
					},
					decision: {
						fill: "#222222",
						stroke: "#222222",
						text: "#ffffff",
					},
					loop: {
						ring: null,
						stroke: "#222222",
						strokeWidth: 2,
						fontWeight: 700,
					},
					fog: {
						fill: "#ffffff",
						stroke: "#aaaaaa",
						text: "#777777",
						pattern: "none",
						strokeStyle: "dashed",
					},
				},
				wires: {
					style: "straight",
					width: 1,
					color: "#999999",
				},
				layout: {
					colGap: 40,
					rowGap: 10,
				},
			},
		},
		{
			id: "pastel",
			name: "Soft pastel",
			desc: "Rounded, borderless and gentle.",
			words: [
				"pastel",
				"soft",
				"cute",
				"candy",
				"gentle",
				"friendly",
				"playful",
			],
			sw: ["#f7f4ff", "#dcebff", "#e6f7ec", "#ffd9e6", "#b8b8d1"],
			patch: {
				canvas: {
					bg: "#f7f4ff",
					grid: "dots",
					gridColor: "#e1daf5",
				},
				nodes: {
					base: {
						radius: 18,
						strokeStyle: "none",
						text: "#3b3358",
						fill: "#ffffff",
						shadow: "soft",
						iconColor: "#8a7fb5",
					},
					question: {
						fill: "#dcebff",
					},
					answer: {
						fill: "#e6f7ec",
					},
					consequence: {
						fill: "#fff1d6",
						bar: null,
					},
					decision: {
						fill: "#ffd9e6",
						text: "#5a1f3a",
					},
					loop: {
						fill: "#e9e1ff",
						ring: null,
						radius: 20,
					},
					fog: {
						fill: "#f0f0f6",
						stroke: "#b8b8d1",
						strokeStyle: "dotted",
						strokeWidth: 1.5,
						text: "#6d6d8a",
						pattern: "none",
						shadow: "none",
					},
				},
				wires: {
					style: "bezier",
					curvature: 0.55,
					width: 2.5,
					color: "#b8b8d1",
				},
				layout: {
					colGap: 54,
					rowGap: 18,
				},
			},
		},
		{
			id: "shapes",
			name: "Shape sampler",
			desc: "A different shape for every kind of block.",
			words: ["shapes", "geometric", "varied shapes", "different shapes"],
			sw: ["#e4eaef", "#ffffff", "#16233a", "#16233a", "#3566d1"],
			patch: {
				nodes: {
					question: {
						shape: "hexagon",
						width: 236,
					},
					consequence: {
						shape: "tag",
						bar: null,
					},
					decision: {
						shape: "diamond",
						width: 250,
					},
					loop: {
						shape: "ellipse",
						width: 210,
					},
					fog: {
						shape: "parallelogram",
					},
				},
				wires: {
					style: "manhattan",
					radius: 12,
					colorBy: "child",
				},
			},
		},
	];
	mixHex = (a, b, t) => {
		const x = rgbOf(a),
			y = rgbOf(b);
		if (!x || !y) return a;
		return (
			"#" +
			x
				.map((v, i) =>
					Math.round(v + (y[i] - v) * t)
						.toString(16)
						.padStart(2, "0"),
				)
				.join("")
		);
	};
	TYPE_PHRASE = {
		question: "questions?",
		answer: "answers?",
		emotion: "emotions?|feelings?|moods?",
		consequence: "consequences?",
		decision: "decisions?",
		loop: "loops?|stages?",
		fog: "fog|clouds?",
		base: "nodes?|blocks?|boxes|cards?|everything|all",
	};
	LK = CascadeUI.proxy({
		tab: "presets",
		type: "base",
		pend: null,
		hist: [],
		built: false,
		busy: false,
		revision: 0,
		desc: "",
		text: "",
		textFocused: false,
		status: "",
		note: "",
		changes: [],
		resultOpen: false,
		textError: "",
		textOk: false,
	});
	lkStyle = () => effLook().nodes[LK.type === "base" ? "answer" : LK.type];
	countLeaves = (o) =>
		isObj(o) || Array.isArray(o)
			? Object.values(o).reduce((a, v) => a + countLeaves(v), 0)
			: 1;
}
