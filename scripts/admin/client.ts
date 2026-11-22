/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const ONLINE =
	location.pathname === "/admin" || location.pathname === "/admin/";
const API = ONLINE ? "/api/admin" : "/api";
const NS = "http://www.w3.org/2000/svg";
function h(tag, attrs, ...kids) {
	const e = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (k === "text") e.textContent = v;
		else if (k === "on")
			for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
		else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
	}
	kids.flat().forEach((c) => {
		if (c != null) e.append(c);
	});
	return e;
}
function s(tag, attrs, ...kids) {
	const e = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (k === "text") e.textContent = v;
		else if (k === "on")
			for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
		else if (v !== false && v != null) e.setAttribute(k, v);
	}
	kids.flat().forEach((c) => {
		if (c != null) e.append(c);
	});
	return e;
}
const css = (n) =>
	getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// whole numbers in full under 10,000, compact above
const fmt = (n) => {
	n = Math.round(n);
	return Math.abs(n) < 10000
		? n.toLocaleString()
		: Intl.NumberFormat("en", {
				notation: "compact",
				maximumFractionDigits: 1,
			}).format(n);
};
const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const dayLabel = (d) =>
	new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
function niceMax(v) {
	if (v <= 0) return 4;
	const p = 10 ** Math.floor(Math.log10(v)),
		f = v / p;
	const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
	return m * p;
}
function ticks(max) {
	const m = niceMax(max);
	return [0, 0.25, 0.5, 0.75, 1]
		.map((t) => m * t)
		.filter((v, i) => i === 0 || Number.isInteger(v * 4) || m >= 4);
}

/* ---------- tooltip: one, shared; text only ---------- */
const tip = $("#tip");
function showTip(ev, title, rows) {
	tip.textContent = "";
	if (title) tip.append(h("div", { class: "tt", text: title }));
	rows.forEach((r) => {
		tip.append(
			h(
				"div",
				{ class: "row" },
				r.color ? h("i", { style: `background:${r.color}` }) : null,
				h("span", { text: r.name }),
				h("b", { text: r.value }),
			),
		);
	});
	tip.style.display = "block";
	const pad = 14,
		w = tip.offsetWidth,
		hh = tip.offsetHeight;
	let x = ev.clientX + pad,
		y = ev.clientY + pad;
	if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
	if (y + hh > innerHeight - 8) y = ev.clientY - hh - pad;
	tip.style.left = `${Math.max(8, x)}px`;
	tip.style.top = `${Math.max(8, y)}px`;
}
const hideTip = () => {
	tip.style.display = "none";
};
function focusTip(el, title, rows) {
	const r = el.getBoundingClientRect();
	showTip({ clientX: r.left + r.width / 2, clientY: r.top }, title, rows);
}

/* ---------- chart pieces ---------- */
function legend(items, kind) {
	return h(
		"div",
		{ class: "legend" },
		items.map((i) =>
			h(
				"span",
				{},
				h("i", { class: kind, style: `background:${i.color}` }),
				i.name,
			),
		),
	);
}
const frame = (w, hgt, label) =>
	s("svg", {
		viewBox: `0 0 ${w} ${hgt}`,
		width: w,
		height: hgt,
		role: "img",
		"aria-label": label,
	});
function yAxis(svg, m, plot, max) {
	ticks(max).forEach((v) => {
		const y = m.t + plot.h - (v / niceMax(max)) * plot.h;
		svg.append(
			s("line", {
				x1: m.l,
				x2: m.l + plot.w,
				y1: y,
				y2: y,
				class: v === 0 ? "axis-line" : "grid-line",
			}),
			s("text", { x: m.l - 8, y: y + 4, "text-anchor": "end", text: fmt(v) }),
		);
	});
}
function xLabels(svg, m, plot, labels, band) {
	const every = Math.max(
		1,
		Math.ceil(labels.length / Math.max(2, Math.floor(plot.w / 70))),
	);
	labels.forEach((l, i) => {
		if (
			i % every === 0 ||
			(i === labels.length - 1 && (labels.length - 1) % every > every / 2)
		)
			svg.append(
				s("text", {
					x: m.l + band * (i + 0.5),
					y: m.t + plot.h + 18,
					"text-anchor": "middle",
					text: l,
				}),
			);
	});
}

// line chart with a crosshair that snaps to the nearest day, and one tooltip listing every series
function lineChart(box, { labels, series, aria }) {
	const w = Math.max(320, box.clientWidth || 640),
		H = 220,
		m = { l: 46, r: 60, t: 10, b: 26 },
		plot = { w: w - m.l - m.r, h: H - m.t - m.b };
	const max = Math.max(1, ...series.flatMap((x) => x.values)),
		top = niceMax(max),
		band = plot.w / labels.length;
	const svg = frame(w, H, aria);
	yAxis(svg, m, plot, max);
	const xAt = (i) => m.l + band * (i + 0.5),
		yAt = (v) => m.t + plot.h - (v / top) * plot.h;
	xLabels(svg, m, plot, labels.map(dayLabel), band);
	series.forEach((x, si) => {
		const pts = x.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
		if (si === 0)
			svg.append(
				s("polygon", {
					points: `${xAt(0)},${yAt(0)} ${pts} ${xAt(labels.length - 1)},${yAt(0)}`,
					fill: x.color,
					"fill-opacity": 0.1,
				}),
			);
		svg.append(
			s("polyline", {
				points: pts,
				fill: "none",
				stroke: x.color,
				"stroke-width": 2,
				"stroke-linejoin": "round",
				"stroke-linecap": "round",
			}),
		);
		const i = labels.length - 1; // end dot with a surface ring, and the value at the end
		svg.append(
			s("circle", {
				cx: xAt(i),
				cy: yAt(x.values[i]),
				r: 5,
				fill: x.color,
				stroke: css("--surface"),
				"stroke-width": 2,
			}),
		);
		if (si === 0)
			svg.append(
				s("text", {
					x: xAt(i) + 11,
					y: yAt(x.values[i]) + 4,
					class: "tv",
					text: fmt(x.values[i]),
				}),
			);
	});
	const cross = s("line", {
			y1: m.t,
			y2: m.t + plot.h,
			stroke: css("--axis"),
			"stroke-width": 1,
			visibility: "hidden",
		}),
		dots = series.map((x) =>
			s("circle", {
				r: 4.5,
				fill: x.color,
				stroke: css("--surface"),
				"stroke-width": 2,
				visibility: "hidden",
			}),
		);
	svg.append(cross, ...dots);
	const hit = s("rect", {
		x: m.l,
		y: m.t,
		width: plot.w,
		height: plot.h,
		fill: "transparent",
		tabindex: 0,
		class: "mark",
		"aria-label": `${aria}. Use the table view for exact values.`,
	});
	const at = (ev) => {
		const r = svg.getBoundingClientRect(),
			i = Math.max(
				0,
				Math.min(
					labels.length - 1,
					Math.floor(((ev.clientX - r.left) * (w / r.width) - m.l) / band),
				),
			);
		return i;
	};
	const show = (i, ev) => {
		cross.setAttribute("x1", xAt(i));
		cross.setAttribute("x2", xAt(i));
		cross.setAttribute("visibility", "visible");
		dots.forEach((d, k) => {
			d.setAttribute("cx", xAt(i));
			d.setAttribute("cy", yAt(series[k].values[i]));
			d.setAttribute("visibility", "visible");
		});
		showTip(
			ev,
			dayLabel(labels[i]),
			series.map((x) => ({
				name: x.name,
				value: fmt(x.values[i]),
				color: x.color,
			})),
		);
	};
	hit.addEventListener("pointermove", (ev) => show(at(ev), ev));
	hit.addEventListener("pointerleave", () => {
		cross.setAttribute("visibility", "hidden");
		dots.forEach((d) => {
			d.setAttribute("visibility", "hidden");
		});
		hideTip();
	});
	hit.addEventListener("focus", () => {
		const i = labels.length - 1;
		show(i, {
			clientX: hit.getBoundingClientRect().right - 20,
			clientY: hit.getBoundingClientRect().top,
		});
	});
	hit.addEventListener("blur", () => {
		hideTip();
	});
	svg.append(hit);
	box.textContent = "";
	box.append(svg);
}

// stacked columns per day: up to 24px wide, 4px rounded at the top of the stack, square on the baseline, a 2px surface gap between segments
function columnChart(box, { labels, series, aria }) {
	const w = Math.max(320, box.clientWidth || 640),
		H = 230,
		m = { l: 46, r: 10, t: 10, b: 26 },
		plot = { w: w - m.l - m.r, h: H - m.t - m.b };
	const totals = labels.map((_, i) =>
			series.reduce((a, x) => a + x.values[i], 0),
		),
		max = Math.max(1, ...totals),
		top = niceMax(max),
		band = plot.w / labels.length,
		bw = Math.min(24, Math.max(2, band - 3));
	const svg = frame(w, H, aria);
	yAxis(svg, m, plot, max);
	xLabels(svg, m, plot, labels.map(dayLabel), band);
	labels.forEach((l, i) => {
		const g = s("g", {
			class: "mark",
			tabindex: 0,
			"aria-label": `${dayLabel(l)}: ${series.map((x) => `${x.name} ${fmt(x.values[i])}`).join(", ")}`,
		});
		let y = m.t + plot.h;
		const x0 = m.l + band * i + (band - bw) / 2,
			parts = series
				.map((x, k) => ({ x, k, v: x.values[i] }))
				.filter((p) => p.v > 0);
		parts.forEach((p, pi) => {
			const hgt = (p.v / top) * plot.h,
				seg = Math.max(0, hgt - (pi < parts.length - 1 ? 2 : 0)),
				isTop = pi === parts.length - 1,
				r = Math.min(4, bw / 2, seg);
			const yy = y - hgt;
			const d =
				isTop && seg > 1
					? `M${x0},${yy + seg} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + bw - r} Q${x0 + bw},${yy} ${x0 + bw},${yy + r} V${yy + seg} Z`
					: `M${x0},${yy + seg} V${yy} H${x0 + bw} V${yy + seg} Z`;
			g.append(s("path", { d, fill: p.x.color }));
			y = yy;
		});
		g.append(
			s("rect", {
				x: m.l + band * i,
				y: m.t,
				width: band,
				height: plot.h,
				fill: "transparent",
			}),
		);
		const rows = () =>
			series.map((x) => ({
				name: x.name,
				value: fmt(x.values[i]),
				color: x.color,
			}));
		g.addEventListener("pointermove", (ev) => showTip(ev, dayLabel(l), rows()));
		g.addEventListener("pointerleave", hideTip);
		g.addEventListener("focus", () => focusTip(g, dayLabel(l), rows()));
		g.addEventListener("blur", hideTip);
		svg.append(g);
	});
	box.textContent = "";
	box.append(svg);
}

// ranked horizontal bars: label, bar (<= 20px), value at the tip. Items may be stacked (segments) for the by-type chart.
function rankedBars(
	box,
	{ items, color = undefined, segments = undefined, aria },
) {
	const rowH = 30,
		labW = Math.min(
			190,
			Math.max(90, Math.round((box.clientWidth || 520) * 0.34)),
		),
		w = Math.max(300, box.clientWidth || 520),
		m = { l: labW, r: 56, t: 4, b: 4 },
		H = items.length * rowH + m.t + m.b;
	const total = (it) =>
			segments ? segments.reduce((a, sg) => a + it[sg.key], 0) : it.value,
		max = Math.max(1, ...items.map(total)),
		plotW = w - m.l - m.r,
		bh = 18;
	const svg = frame(w, H, aria);
	items.forEach((it, i) => {
		const y = m.t + i * rowH + (rowH - bh) / 2,
			g = s("g", {
				class: "mark",
				tabindex: 0,
				"aria-label": `${it.label}: ${segments ? segments.map((sg) => `${sg.name} ${fmt(it[sg.key])}`).join(", ") : fmt(it.value)}`,
			});
		g.append(
			s("text", {
				x: m.l - 10,
				y: y + bh / 2 + 4,
				"text-anchor": "end",
				class: "t2",
				text: it.label,
			}),
		);
		let x = m.l;
		const parts = (segments || [{ key: "value", color }])
			.map((sg) => ({ sg, v: it[sg.key] }))
			.filter((p) => p.v > 0);
		parts.forEach((p, pi) => {
			const len = (p.v / max) * plotW,
				seg = Math.max(0, len - (pi < parts.length - 1 ? 2 : 0)),
				last = pi === parts.length - 1,
				r = Math.min(4, bh / 2, seg);
			const d =
				last && seg > 1
					? `M${x},${y} H${x + seg - r} Q${x + seg},${y} ${x + seg},${y + r} V${y + bh - r} Q${x + seg},${y + bh} ${x + seg - r},${y + bh} H${x} Z`
					: `M${x},${y} h${seg} v${bh} h${-seg} Z`;
			g.append(s("path", { d, fill: p.sg.color }));
			x += len;
		});
		g.append(
			s("text", {
				x: x + 8,
				y: y + bh / 2 + 4,
				class: "tv",
				text: fmt(total(it)),
			}),
			s("rect", {
				x: 0,
				y: m.t + i * rowH,
				width: w,
				height: rowH,
				fill: "transparent",
			}),
		);
		const rows = () =>
			segments
				? segments.map((sg) => ({
						name: sg.name,
						value: fmt(it[sg.key]),
						color: sg.color,
					}))
				: [{ name: it.tipName || "Count", value: fmt(it.value), color }];
		g.addEventListener("pointermove", (ev) => showTip(ev, it.label, rows()));
		g.addEventListener("pointerleave", hideTip);
		g.addEventListener("focus", () => focusTip(g, it.label, rows()));
		g.addEventListener("blur", hideTip);
		svg.append(g);
	});
	box.textContent = "";
	box.append(svg);
}

/* ---------- cards: a title, a Chart / Table switch, and the same data both ways ---------- */
const views = {};
function card(id, { title, note, legendEl = undefined, draw, table }) {
	const root = $(`#${id}`),
		mode = views[id] || "chart";
	root.textContent = "";
	const box = h("div", { class: "chart" }),
		tbl = h("div", { hidden: true });
	const setMode = (m) => {
		views[id] = m;
		box.hidden = m !== "chart";
		tbl.hidden = m !== "table";
		sw.querySelectorAll("button").forEach((b) => {
			b.setAttribute("aria-pressed", String(b.dataset.m === m));
		});
		if (m === "chart") draw(box);
	};
	const sw = h(
		"div",
		{ class: "view", role: "group", "aria-label": "View" },
		h("button", {
			type: "button",
			"data-m": "chart",
			text: "Chart",
			on: { click: () => setMode("chart") },
		}),
		h("button", {
			type: "button",
			"data-m": "table",
			text: "Table",
			on: { click: () => setMode("table") },
		}),
	);
	root.append(
		h(
			"div",
			{ class: "chead" },
			h(
				"div",
				{},
				h("h2", { text: title }),
				h("div", { class: "note", text: note || "" }),
			),
			sw,
		),
		...(legendEl ? [legendEl] : []),
		box,
		tbl,
	);
	const t = table();
	tbl.append(t);
	setMode(mode);
	root._redraw = () => {
		if ((views[id] || "chart") === "chart") draw(box);
	};
}
function makeTable(cols, rows) {
	return h(
		"table",
		{},
		h(
			"thead",
			{},
			h(
				"tr",
				{},
				cols.map((c) => h("th", { class: c.num ? "num" : "", text: c.name })),
			),
		),
		h(
			"tbody",
			{},
			rows.map((r) =>
				h(
					"tr",
					{},
					cols.map((c) =>
						h("td", { class: c.num ? "num" : "", text: c.get(r) }),
					),
				),
			),
		),
	);
}
const allZero = (a) => a.every((v) => !v);

/* ---------- render ---------- */
let data = null;
function render(d) {
	data = d;
	const c1 = css("--s1"),
		c2 = css("--s2"),
		c3 = css("--s3"),
		T = d.totals;
	$("#demoBadge").hidden = !d.demo;
	$("#heroV").textContent = fmt(T.visits);
	$("#heroSub").textContent =
		`${fmt(T.visitors)} unique visitors (summed daily) in the last ${d.days} day${d.days === 1 ? "" : "s"}`;
	const tile = (label, value, sub) =>
		h(
			"section",
			{ class: "card tile" },
			h("div", { class: "label", text: label }),
			h("div", { class: "value", text: value }),
			h("div", { class: "sub", text: sub || "" }),
		);
	const tiles = $("#tiles");
	tiles.textContent = "";
	tiles.append(
		tile("Blocks created by people", fmt(T.created), "placed on the canvas"),
		tile(
			"AI suggestions kept",
			pct(T.keptRate),
			`${fmt(T.approved)} kept, ${fmt(T.dismissed)} dismissed`,
		),
		tile(
			"AI calls",
			fmt(T.aiCalls),
			T.aiCalls ? `${pct(T.aiErrorRate)} failed` : "signed-in users only",
		),
		tile("Signed-in users", fmt(T.activeUsers), "active in the period"),
		tile("Sign-ins", fmt(T.signins), `${fmt(T.newSignins)} new accounts`),
	);
	const S = d.series;
	card("c-visits", {
		title: "Visits per day",
		note: "Page loads of the web app, and the unique visitors among them (anonymous daily hash).",
		legendEl: legend(
			[
				{ name: "Visits", color: c1 },
				{ name: "Visitors", color: c2 },
			],
			"line",
		),
		draw: (box) =>
			allZero(S.visits)
				? box.append(
						h("div", {
							class: "empty",
							text: "No visits recorded in this period yet.",
						}),
					)
				: lineChart(box, {
						labels: d.dates,
						series: [
							{ name: "Visits", color: c1, values: S.visits },
							{ name: "Visitors", color: c2, values: S.visitors },
						],
						aria: "Line chart of visits and visitors per day",
					}),
		table: () =>
			makeTable(
				[
					{ name: "Day", get: (r) => r.d },
					{ name: "Visits", num: 1, get: (r) => fmt(r.v) },
					{ name: "Visitors", num: 1, get: (r) => fmt(r.u) },
				],
				d.dates
					.map((x, i) => ({ d: x, v: S.visits[i], u: S.visitors[i] }))
					.reverse(),
			),
	});
	card("c-blocks", {
		title: "Blocks per day",
		note: "Created by people, and AI suggestions people kept or dismissed.",
		legendEl: legend(
			[
				{ name: "Created by people", color: c1 },
				{ name: "Kept", color: c2 },
				{ name: "Dismissed", color: c3 },
			],
			"bar",
		),
		draw: (box) =>
			allZero([...S.created, ...S.approved, ...S.dismissed])
				? box.append(
						h("div", {
							class: "empty",
							text: "No blocks recorded in this period yet.",
						}),
					)
				: columnChart(box, {
						labels: d.dates,
						series: [
							{ name: "Created by people", color: c1, values: S.created },
							{ name: "Kept", color: c2, values: S.approved },
							{ name: "Dismissed", color: c3, values: S.dismissed },
						],
						aria: "Stacked columns of blocks per day",
					}),
		table: () =>
			makeTable(
				[
					{ name: "Day", get: (r) => r.d },
					{ name: "Created", num: 1, get: (r) => fmt(r.c) },
					{ name: "Kept", num: 1, get: (r) => fmt(r.a) },
					{ name: "Dismissed", num: 1, get: (r) => fmt(r.x) },
				],
				d.dates
					.map((x, i) => ({
						d: x,
						c: S.created[i],
						a: S.approved[i],
						x: S.dismissed[i],
					}))
					.reverse(),
			),
	});
	const ai = d.ai.filter((a) => a.calls > 0);
	card("c-ai", {
		title: "AI calls by provider",
		note: "Claude is Anthropic. OpenAI covers GPT and ChatGPT models.",
		draw: (box) =>
			ai.length
				? rankedBars(box, {
						items: ai.map((a) => ({
							label: a.label,
							value: a.calls,
							tipName: "Calls",
						})),
						color: c1,
						aria: "Bars of AI calls by provider",
					})
				: box.append(
						h("div", {
							class: "empty",
							text: "No AI calls yet. They are counted for signed-in users.",
						}),
					),
		table: () =>
			makeTable(
				[
					{ name: "Provider", get: (r) => r.label },
					{ name: "Calls", num: 1, get: (r) => fmt(r.calls) },
					{ name: "Failed", num: 1, get: (r) => fmt(r.errors) },
					{ name: "People", num: 1, get: (r) => fmt(r.users) },
					{
						name: "Avg time",
						num: 1,
						get: (r) => `${(r.avgMs / 1000).toFixed(1)} s`,
					},
				],
				d.ai,
			),
	});
	const users = d.ai.filter((a) => a.users > 0);
	card("c-users", {
		title: "People using each provider",
		note: "Distinct signed-in people who made an AI call.",
		draw: (box) =>
			users.length
				? rankedBars(box, {
						items: users
							.map((a) => ({
								label: a.label,
								value: a.users,
								tipName: "People",
							}))
							.sort((x, y) => y.value - x.value),
						color: c1,
						aria: "Bars of people per AI provider",
					})
				: box.append(
						h("div", {
							class: "empty",
							text: "No one has used an AI provider yet.",
						}),
					),
		table: () =>
			makeTable(
				[
					{ name: "Provider", get: (r) => r.label },
					{ name: "Made a call", num: 1, get: (r) => fmt(r.users) },
					{
						name: "Saved a key",
						num: 1,
						get: (r) =>
							fmt(d.keys.find((k) => k.provider === r.provider)?.users || 0),
					},
				],
				d.ai,
			),
	});
	const types = d.blocksByType;
	card("c-types", {
		title: "Blocks by type",
		note: "Created by people, kept and dismissed suggestions.",
		legendEl: legend(
			[
				{ name: "Created", color: c1 },
				{ name: "Kept", color: c2 },
				{ name: "Dismissed", color: c3 },
			],
			"bar",
		),
		draw: (box) =>
			types.length
				? rankedBars(box, {
						items: types.map((t) => ({
							label: `${t.type[0].toUpperCase()}${t.type.slice(1)}`,
							...t,
						})),
						segments: [
							{ key: "created", name: "Created", color: c1 },
							{ key: "approved", name: "Kept", color: c2 },
							{ key: "dismissed", name: "Dismissed", color: c3 },
						],
						aria: "Stacked bars of blocks by type",
					})
				: box.append(
						h("div", { class: "empty", text: "No blocks recorded yet." }),
					),
		table: () =>
			makeTable(
				[
					{ name: "Type", get: (r) => r.type },
					{ name: "Created", num: 1, get: (r) => fmt(r.created) },
					{ name: "Kept", num: 1, get: (r) => fmt(r.approved) },
					{ name: "Dismissed", num: 1, get: (r) => fmt(r.dismissed) },
				],
				types,
			),
	});
	card("c-features", {
		title: "Features used",
		note: "How often each feature was used.",
		draw: (box) =>
			d.features.length
				? rankedBars(box, {
						items: d.features.slice(0, 10).map((f) => ({
							label: f.label,
							value: f.times,
							tipName: "Times",
						})),
						color: c1,
						aria: "Bars of feature use",
					})
				: box.append(
						h("div", { class: "empty", text: "No feature use recorded yet." }),
					),
		table: () =>
			makeTable(
				[
					{ name: "Feature", get: (r) => r.label },
					{ name: "Times", num: 1, get: (r) => fmt(r.times) },
				],
				d.features,
			),
	});
	card("c-countries", {
		title: "Visits by country",
		note: "Where visits came from (Cloudflare country code).",
		draw: (box) =>
			d.countries.length
				? rankedBars(box, {
						items: d.countries.map((c) => ({
							label: c.country,
							value: c.visits,
							tipName: "Visits",
						})),
						color: c1,
						aria: "Bars of visits by country",
					})
				: box.append(
						h("div", { class: "empty", text: "No visits recorded yet." }),
					),
		table: () =>
			makeTable(
				[
					{ name: "Country", get: (r) => r.country },
					{ name: "Visits", num: 1, get: (r) => fmt(r.visits) },
				],
				d.countries,
			),
	});
	$("#foot").textContent =
		`Counts come from Cloudflare Workers Analytics Engine (${d.env === "dev" ? "cascade_events_dev" : "cascade_events"}) and are corrected for sampling. Unique visitors use a hash that changes daily, so they are summed per day, not across days. Page views from Cloudflare Web Analytics are in the Cloudflare dashboard.`;
	$("#updated").textContent =
		`Updated ${new Date(d.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/* ---------- loading, filters, theme ---------- */
const state = { env: "prod", days: 7 };
function pick(seg, key, conv) {
	$(seg).addEventListener("click", (e) => {
		const b = e.target.closest("button[data-v]");
		if (!b) return;
		state[key] = conv(b.dataset.v);
		$(seg)
			.querySelectorAll("button")
			.forEach((x) => {
				x.setAttribute("aria-pressed", String(x === b));
			});
		load();
	});
}
pick("#envSeg", "env", (v) => v);
pick("#daySeg", "days", (v) => +v);
async function load(fresh?) {
	const main = $("#main");
	main.classList.add("loading");
	$("#error").hidden = true;
	try {
		const r = await fetch(
				`${API}/stats?env=${state.env}&days=${state.days}${fresh ? "&fresh=1" : ""}`,
			),
			j = await r.json();
		if (!r.ok) {
			if (ONLINE && (r.status === 401 || r.status === 403)) {
				main.hidden = true;
				return start();
			} // the session ended, or this account is not allowed
			if (j.error === "no_credentials" || j.error === "bad_credentials")
				$("#setup").hidden = false;
			throw new Error(j.detail || j.error);
		}
		$("#setup").hidden = true;
		main.hidden = false;
		render(j);
	} catch (e) {
		$("#error").hidden = false;
		$("#error").replaceChildren(
			h("b", { text: "Could not load the numbers. " }),
			document.createTextNode(e.message),
		);
	} finally {
		main.classList.remove("loading");
	}
}
$("#refresh").addEventListener("click", () => load(true));
$("#setupForm").addEventListener("submit", async (e) => {
	e.preventDefault();
	const msg = $("#setupMsg");
	msg.textContent = "Connecting…";
	try {
		const r = await fetch("/api/credentials", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					account: $("#acct").value,
					token: $("#tok").value,
					save: $("#save").checked,
				}),
			}),
			j = await r.json();
		if (!r.ok) throw new Error(j.error || "Could not save.");
		$("#tok").value = "";
		msg.textContent = "";
		load(true);
	} catch (err) {
		msg.textContent = err.message;
	}
});
function applyTheme(t) {
	if (t) document.documentElement.setAttribute("data-theme", t);
}
$("#theme").addEventListener("click", () => {
	const dark = matchMedia("(prefers-color-scheme: dark)").matches,
		cur =
			document.documentElement.getAttribute("data-theme") ||
			(dark ? "dark" : "light");
	const next = cur === "dark" ? "light" : "dark";
	applyTheme(next);
	try {
		localStorage.setItem("admin-theme", next);
	} catch {}
	if (data) render(data);
});
try {
	applyTheme(localStorage.getItem("admin-theme"));
} catch {}
let resizeT: ReturnType<typeof setTimeout> | 0 = 0;
addEventListener("resize", () => {
	clearTimeout(resizeT);
	resizeT = setTimeout(() => {
		if (data)
			document.querySelectorAll(".card").forEach((c) => {
				(c as HTMLElement & { _redraw?: () => void })._redraw?.();
			});
	}, 150);
});
// ---------- online: Google sign-in, allowlist, sign out ----------
function loadGsi(clientId) {
	if (!clientId) {
		$("#gmsg").textContent = "Google sign-in is not set up on this server.";
		return;
	}
	const draw = () => {
		google.accounts.id.initialize({
			client_id: clientId,
			callback: async (resp) => {
				$("#gmsg").textContent = "Signing in…";
				try {
					const r = await fetch("/api/auth/google", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ credential: resp.credential }),
					});
					if (!r.ok) throw new Error("Google sign-in was not accepted.");
					start();
				} catch (e) {
					$("#gmsg").textContent = e.message;
				}
			},
			ux_mode: "popup",
		});
		$("#gbtn").textContent = "";
		google.accounts.id.renderButton($("#gbtn"), {
			theme: "outline",
			size: "large",
			text: "signin_with",
		});
	};
	if (window.google && google.accounts) return draw();
	const sc = document.createElement("script");
	sc.src = "https://accounts.google.com/gsi/client";
	sc.async = true;
	sc.onload = draw;
	sc.onerror = () => {
		$("#gmsg").textContent =
			"Could not load Google sign-in. Check your connection.";
	};
	document.head.append(sc);
}
async function signOut() {
	try {
		await fetch("/api/auth/logout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
	} catch {}
	start();
}
$("#signout").addEventListener("click", signOut);
$("#deniedOut").addEventListener("click", signOut);
function show(which) {
	for (const id of ["signin", "denied", "unconfigured"])
		$(`#${id}`).hidden = id !== which;
	$("#filters").hidden = which !== null;
	$("#main").hidden = true;
	$("#signout").hidden = which !== null;
}
async function start() {
	try {
		const st = await (await fetch(`${API}/status`)).json();
		$("#demoBadge").hidden = !st.demo;
		if (ONLINE) {
			$("#setup").hidden = true;
			if (!st.configured) {
				show("unconfigured");
				$("#unconfMsg").textContent =
					`The server is missing: ${st.missing.join(", ")}. They are set as secrets on the Worker.`;
				return;
			}
			if (!st.signedIn) {
				show("signin");
				$("#signout").hidden = true;
				loadGsi(st.googleClientId);
				return;
			}
			if (!st.allowed) {
				show("denied");
				$("#deniedMsg").textContent =
					`${st.email} is not on the admin list, so no numbers are shown.`;
				return;
			}
			show(null);
			$("#signout").hidden = false;
			load();
			return;
		}
		if (!st.hasCredentials) {
			$("#setup").hidden = false;
			$("#filters").hidden = false;
		} else load();
	} catch {
		if (ONLINE) {
			show("unconfigured");
			$("#unconfMsg").textContent = "Could not reach the server.";
		} else load();
	}
}
start();
