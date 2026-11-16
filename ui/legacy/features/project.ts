import { flushSync } from "react-dom";
import { proxy } from "valtio/vanilla";
import type { ApiReply } from "../../../shared/settings-types.ts";
import { connect } from "../../bridge.ts";
import { mount } from "../../runtime.tsx";
import {
	activeProvider,
	aiAvailable,
	aiNeed,
	state as aiPromptsState,
	callAI,
	enqueue,
	guideBlock,
	handleAIError,
	treeText,
} from "../ai/prompts.ts";
import { layout } from "../canvas/layout.ts";
import { setMode } from "../canvas/view.ts";
import {
	$,
	CONNECTION,
	LOCAL,
	PREFS,
	sleep,
	TICKETS,
} from "../core/constants.ts";
import { DOM } from "../core/profiles.ts";
import { AI, pushHist, S, save, UI } from "../core/state.ts";
import { addNode } from "../core/tree.ts";
import { focusControl, setBusy, showNote } from "../ui/hud.ts";
import { openSettings, postJSON, updatePreview } from "../ui/settings.ts";
import { AN } from "./ask.ts";
import { PANEL } from "./map.ts";
export const state = {
	projDepth: undefined,
	PGROUPS: undefined,
	PFIND: undefined,
	projBusy: undefined,
	projCtl: undefined,
	prevBrief: undefined,
	scanBusy: undefined,
	briefTimer: undefined,
};
export let PROJECTUI = undefined,
	SV = undefined;
export async function fetchJSON(url: string | URL | Request) {
	const r = await fetch(url);
	let j: ApiReply = {};
	try {
		j = await r.json();
	} catch {}
	if (!r.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);
	return j;
}
export function citeText(text, refs) {
	return refs
		? String(text).replace(/\[(f\d+)\]/g, (m, id) =>
				refs[id] ? `(${citeName(refs[id])})` : m,
			)
		: text;
}

/* --- evidence: the few excerpts that matter for one question, found locally --- */
export async function projectEvidence(q: string, k: number) {
	if (
		!LOCAL ||
		!PREFS.askFiles ||
		!projectReady() ||
		activeProvider() === "demo"
	)
		return null;
	try {
		const r = await postJSON("/api/project/search", {
			q: String(q).slice(0, 500),
			k: k || 6,
		});
		const hits = r.results || [];
		if (!hits.length) return null;
		const refs = {};
		let block =
			"PROJECT EXCERPTS (what the project’s notes and code actually say right now; cite them by id like [f1]):\n";
		hits.forEach((h, i) => {
			const id = `f${i + 1}`;
			refs[id] = {
				f: h.file,
				l: h.start,
				e: h.end,
			};
			block += `[${id}] ${h.file} lines ${h.start}-${h.end}\n${String(h.text).slice(0, 1100)}\n\n`;
		});
		return {
			block: block.trim(),
			refs,
		};
	} catch {
		return null;
	}
}

/* --- source viewer --- */
export function closeSrcView() {
	flushSync(() => {
		SV.open = false;
		SV.request++;
	});
}
export async function showSrc() {
	const s0 = SV.list[SV.i];
	if (!s0) return;
	const request = ++SV.request,
		hi = s0.e || s0.l;
	SV.loading = true;
	SV.lines = [];
	SV.error = "";
	try {
		const r = await fetchJSON(
			`/api/project/file?path=${encodeURIComponent(s0.f)}&start=${Math.max(1, s0.l - 8)}&end=${hi + 18}`,
		);
		if (request !== SV.request) return;
		SV.lines = r.text.split("\n").map((text, k) => ({
			number: r.start + k,
			text,
			hit: r.start + k >= s0.l && r.start + k <= hi,
		}));
	} catch (e) {
		if (request === SV.request)
			SV.error = `${e.message} Rescan the project in Settings to refresh it.`;
	} finally {
		if (request === SV.request) SV.loading = false;
	}
}
export function openSrcView(list, i) {
	if (!list.length) return;
	flushSync(() => {
		SV.list = list;
		SV.i = i || 0;
		SV.open = true;
	});
	showSrc();
	focusControl("svClose");
}
export function stepSource(direction) {
	SV.i = (SV.i + SV.list.length + direction) % SV.list.length;
	showSrc();
}
export function openNodeSrc(id) {
	const n = S.nodes[id];
	if (n?.src?.length)
		openSrcView(
			n.src.map((x) => ({
				f: x.f,
				l: x.l,
				note: x.t || n.text,
			})),
			0,
		);
}
export async function copySource() {
	const source = SV.list[SV.i];
	try {
		await navigator.clipboard.writeText(`${source.f}:${source.l}`);
		SV.copyText = "Copied";
		setTimeout(() => {
			SV.copyText = "Copy path";
		}, 1400);
	} catch {}
}
export function updateAskFiles() {
	AN.projectReady = LOCAL && projectReady();
}

/* --- streaming helper: one JSON object per line --- */
export async function streamLines(prompt, o) {
	let done = 0;
	const parse = (text: string, final: boolean) => {
		const lines = text.split("\n"),
			upto = final ? lines.length : lines.length - 1;
		for (; done < upto; done++) {
			const ln = lines[done]
				.trim()
				.replace(/^```(json)?/, "")
				.replace(/```$/, "")
				.replace(/,$/, "")
				.trim();
			if (!ln.startsWith("{")) continue;
			let v: ReturnType<typeof JSON.parse>;
			try {
				v = JSON.parse(ln);
			} catch {
				continue;
			}
			o.onObj(v);
		}
	};
	const out = await callAI(prompt, {
		cache: false,
		signal: o.signal,
		temperature: o.temperature,
		onText: ({ text }) => parse(text, false),
	});
	parse(out.text, true);
	return out.text;
}

/* --- the prompts --- */
export function mapPrompt(g, engine) {
	return `You are reading part of a ${DOM().projectNoun}${engine && engine !== "a generic project" ? ` (${engine})` : ""} so its ${DOM().person} can see what the notes and code already decide.

FOLDER: ${g.label}

PER-FILE DIGESTS (symbols, tuning values and open comments, with line numbers):
${g.digest}${g.excerpts ? `\nRAW EXCERPTS:\n${g.excerpts}` : ""}
Write one JSON object per line (NDJSON). No markdown, no commentary. Each line is one finding:
{"kind":"mechanic|parameter|state|decision|open|constraint|system","text":"<one plain sentence, at most 28 words>","file":"<a path from above>","line":<line number>}

Rules:
- Describe what the ${DOM().subject} does or has decided, in plain language, not how the files or code are organised.
- mechanic: a rule or process by which something works.
- parameter: a value that shapes the outcome, with the value ("The trial lasts 14 days and renewals are 20% cheaper").
- state: a mode or state machine the ${DOM().subject} has ("An order moves through Draft, Review and Approved").
- decision: a choice the notes or code clearly make.
- open: a TODO, FIXME, TBD or visibly unfinished piece, and what is unsettled.
- constraint: a rule, cap or restriction.
- system: a major system and the role it plays.
- Use only what is above. Never invent anything. Give the best file and line for each finding.
- At most 12 findings, the most design-relevant first. Skip rendering, networking and other plumbing.`;
}
export function briefPrompt(findings, engine) {
	const body = findings
		.map((f) => `${f.kind}: ${f.text} [${f.refs[0]?.file || ""}]`)
		.join("\n");
	return `You are writing a brief about a ${DOM().projectNoun}${engine && engine !== "a generic project" ? ` (${engine})` : ""} for a ${DOM().personFull}'s tool. Below are findings from reading the project's notes and code, in no particular order. Write the brief that the tool reads before every task.

FINDINGS:
${body}

Write plain prose under these headings, each heading on its own line followed by a short paragraph: What it is. How it plays. Systems. Values that matter. Unfinished or undecided. Rules and limits.
Rules: at most 4500 characters in total. Use only the findings and quote values exactly. No bullet points and no markdown symbols. Where findings seem to disagree, say so plainly. Leave out a heading when the findings say nothing about it.`;
}
export function seedPrompt(findings) {
	const order = [
		"decision",
		"open",
		"constraint",
		"state",
		"mechanic",
		"parameter",
		"system",
	];
	const list = [...findings]
		.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
		.slice(0, 90);
	const f = list
		.map(
			(x) =>
				`${x.id} | ${x.kind} | ${x.text} | ${x.refs[0] ? `${x.refs[0].file}:${x.refs[0].line}` : ""}`,
		)
		.join("\n");
	const size =
		{
			small: 10,
			medium: 16,
			large: 24,
		}[PREFS.growSize] || 16;
	return `You are turning what a ${DOM().projectNoun} already contains into a decision tree for its ${DOM().person}. Every node must come from the findings below. You add no facts of your own.

${guideBlock()}TREE (id | type | text | parent):
${S.order.length ? treeText() : "(empty)"}

FINDINGS FROM THE PROJECT (id | kind | text | file:line):
${f}

Write one JSON object per line (NDJSON). No markdown, no commentary. Each line:
{"id":"s1","parent":"<an existing id, an earlier sN, or null for a first node>","type":"loop|decision|question|consequence|fog","text":"<at most 16 words>","ticket":"talk|prototype|research|task","from":["f3","f7"]}

Rules:
- decision: something the project has already settled, in design language ("Walking is slow on purpose: base speed 6.5"). Use it for mechanics, parameters, states and constraints.
- question: something the project leaves open (TODOs, FIXMEs, TBDs), or where the project seems to conflict with the goal, the pillars or something already in the tree. ticket applies to questions only.
- fog: an area the project hints at but has not defined yet.
- consequence: only an effect that follows directly from a value or rule in a finding, such as what a stamina limit does to travel.
- loop: one of the ${DOM().loopDesc}, only when the findings clearly show one. If the tree is empty, start with loop nodes and hang the rest beneath them.
- Do not write emotion nodes unless a finding states how ${DOM().audience} feel.
- from lists the finding ids that support the node, at least one. Never cite a finding that does not support it.
- Put each node under the existing node it belongs with. Do not repeat anything already in the tree.
- At most ${size} lines, the most important first.`;
}

/* --- scanning --- */
export function lockProject(on: boolean) {
	PROJECTUI.busy = on;
}
export async function refreshProject() {
	CONNECTION.project = await fetchJSON("/api/project");
	renderProject();
	syncProjectButtons();
	updatePreview();
}
export async function loadProjectData() {
	if (!LOCAL) return;
	if (!projectReady()) {
		state.PGROUPS = null;
		state.PFIND = null;
		renderProject();
		return;
	}
	try {
		const [g, f] = await Promise.all([
			fetchJSON(`/api/project/groups?chars=${DEPTHS[state.projDepth].chars}`),
			fetchJSON("/api/project/findings"),
		]);
		state.PGROUPS = g.groups;
		state.PFIND = f;
	} catch {
		state.PGROUPS = null;
		state.PFIND = null;
	}
	renderProject();
}
export async function projectPick() {
	pMsg("");
	try {
		const r = await postJSON("/api/project/pick", {});
		if (r.path) {
			PROJECTUI.path = r.path;
			pMsg("Folder chosen. Press Scan.");
		}
	} catch (e) {
		pMsg(e.message, "bad");
	}
}
export async function projectScan() {
	if (state.scanBusy) return;
	const folder = PROJECTUI.path.trim();
	if (!folder) {
		pMsg("Choose or paste a folder first.", "bad");
		return;
	}
	state.scanBusy = true;
	PROJECTUI.scanBusy = true;
	pMsg("Scanning…");
	try {
		await postJSON("/api/project/scan", {
			path: folder,
			ignore: PROJECTUI.ignore,
			include: PROJECTUI.include,
		});
		for (;;) {
			await sleep(window.__POLL_MS || 400);
			const st = await fetchJSON("/api/project/status");
			if (st.running) {
				pMsg(`Scanning… ${st.files} files in ${st.dirs} folders`);
				continue;
			}
			if (st.error) {
				pMsg(st.error, "bad");
			} else {
				CONNECTION.project = st.info;
				pMsg("Scan finished.", "ok");
			}
			break;
		}
		await loadProjectData();
		syncProjectButtons();
		updatePreview();
	} catch (e) {
		pMsg(e.message, "bad");
	} finally {
		state.scanBusy = false;
		PROJECTUI.scanBusy = false;
	}
}
export function renderProject() {
	if (!LOCAL) return;
	const P = CONNECTION.project || {
			has: false,
		},
		has = !!P.has;
	PROJECTUI.project = P;
	if (!PROJECTUI.path) PROJECTUI.path = P.root || "";
	if (!state.projBusy) PROJECTUI.brief = P.brief || "";
	PROJECTUI.canRestore = !!state.prevBrief;
	if (!has) return;
	const c = P.counts || {},
		sk = P.skipped || {};
	const bits = [];
	if ((P.topDirs || []).length)
		bits.push(
			"Biggest folders: " +
				P.topDirs
					.slice(0, 4)
					.map((x) => `${x.dir} (${x.kb} KB)`)
					.join(", ") +
				".",
		);
	const why: string[] = [];
	["ignored", "binary", "tooBig", "generated", "secret"].forEach((k) => {
		if (sk[k])
			why.push(
				`${sk[k]} ${
					{
						ignored: "ignored",
						binary: "binary",
						tooBig: "too big",
						generated: "generated",
						secret: "private",
					}[k]
				}`,
			);
	});
	if (why.length) bits.push(`Skipped: ${why.join(", ")}.`);
	if (P.redactions)
		bits.push(
			`${P.redactions} possible secret${P.redactions === 1 ? "" : "s"} were redacted from what Cascade reads.`,
		);
	if (c.indexTruncated)
		bits.push(
			"The project is large, so search covers the most relevant files only.",
		);
	PROJECTUI.detail = bits.join(" ");
	// brief controls
	const hasBrief = !!briefText();
	let est = "",
		label = "Build brief";
	if (state.PGROUPS && state.PFIND) {
		const sel = state.PGROUPS.slice(0, DEPTHS[state.projDepth].groups),
			have = state.PFIND.groupFindings || {},
			stale = sel.filter((g) => have[g.id] !== g.fingerprint);
		const mode = !hasBrief ? "build" : stale.length ? "update" : "rebuild",
			work = mode === "update" ? stale : sel;
		label =
			mode === "build"
				? "Build brief"
				: mode === "update"
					? `Update brief (${stale.length} changed)`
					: "Rebuild brief";
		const tok = Math.round(work.reduce((a, g) => a + g.chars, 0) / 4) + 1500;
		est = `${DEPTHS[state.projDepth].groups < state.PGROUPS.length ? `Reads the ${sel.length} most design-relevant of ${state.PGROUPS.length} folders. ` : `Reads all ${sel.length} folders. `}${mode === "update" ? "Only the changed ones this time: " : ""}about ${fmtN(tok)} tokens across ${work.length} call${work.length === 1 ? "" : "s"}, plus one to write the brief.`;
	}
	PROJECTUI.buildLabel = label;
	PROJECTUI.estimate = est;
	PROJECTUI.canRestore = !!state.prevBrief;
}
export function syncProjectButtons() {
	if (!LOCAL) return;
	const show = projectReady() && CONNECTION.project.findingCount > 0;
	PANEL.canSeed = show;
	UI.seed = show;
	updateAskFiles();
}

/* --- the brief --- */
export async function readGroup(g, engine, signal) {
	const out = [],
		files = new Set(g.files);
	await streamLines(mapPrompt(g, engine), {
		signal,
		temperature: 0.2,
		onObj: (o) => {
			if (!o || typeof o.text !== "string" || !o.text.trim()) return;
			const kind = KINDS.includes(o.kind) ? o.kind : "system";
			let file = typeof o.file === "string" ? o.file : "";
			if (!files.has(file)) {
				const base = file.split("/").pop();
				file =
					g.files.find((f: string) => f.split("/").pop() === base) ||
					g.files[0] ||
					"";
			}
			out.push({
				kind,
				text: o.text.trim().slice(0, 260),
				group: g.label,
				refs: file
					? [
							{
								file,
								line: Math.max(1, Math.floor(+o.line) || 1),
							},
						]
					: [],
			});
		},
	});
	return out.slice(0, 14);
}
export async function buildBrief() {
	if (state.projBusy) return;
	if (!projectReady()) {
		pMsg("Scan a folder first.", "bad");
		return;
	}
	if (activeProvider() === "demo" || !aiAvailable()) {
		pMsg(
			"Reading a project needs a real AI. Connect one under Settings > AI model first.",
			"bad",
		);
		return;
	}
	if (!state.PGROUPS || !state.PFIND) await loadProjectData();
	if (!state.PGROUPS || !state.PFIND) {
		pMsg("Couldn’t load the scan. Try scanning again.", "bad");
		return;
	}
	const sel = state.PGROUPS.slice(0, DEPTHS[state.projDepth].groups),
		have = state.PFIND.groupFindings || {},
		stale = sel.filter((g) => have[g.id] !== g.fingerprint);
	const mode = !briefText() ? "build" : stale.length ? "update" : "rebuild",
		work = mode === "update" ? stale : sel;
	const kept =
		mode === "update"
			? state.PFIND.findings.filter((f) =>
					sel.some((g) => g.label === f.group && have[g.id] === g.fingerprint),
				)
			: [];
	state.projBusy = true;
	state.projCtl = new AbortController();
	lockProject(true);
	pMsg("");
	const engine = CONNECTION.project?.engineLabel || "",
		fresh = [];
	let nDone = 0,
		failed = 0;
	try {
		const queue = work.slice();
		const worker = async () => {
			for (;;) {
				const g = queue.shift();
				if (!g || state.projCtl.signal.aborted) return;
				pProg(`Reading ${g.label} (${nDone + 1} of ${work.length})…`);
				try {
					fresh.push(...(await readGroup(g, engine, state.projCtl.signal)));
				} catch (e) {
					if (e && e.code === "cancelled") return;
					failed++;
					handleAIError(e);
					if (AI.off) {
						queue.length = 0;
						return;
					}
				}
				nDone++;
			}
		};
		await Promise.all([worker(), worker()]);
		if (state.projCtl.signal.aborted) {
			pMsg("Stopped. Nothing was changed.");
			return;
		}
		if (!fresh.length && !kept.length) {
			pMsg(
				"The AI didn’t find anything design-relevant to report. Try Thorough, or check the folder.",
				"bad",
			);
			return;
		}
		const all = kept.concat(fresh).map((f, i) => ({
			...f,
			id: `f${i + 1}`,
		}));
		pProg(`Writing the brief from ${all.length} findings…`);
		const out = await callAI(briefPrompt(all, engine), {
			cache: false,
			signal: state.projCtl.signal,
			temperature: 0.3,
			onText: ({ text }) => {
				PROJECTUI.brief = text;
			},
		});
		const brief = out.text.trim().slice(0, 6000);
		if (!brief) {
			pMsg("The AI returned an empty brief.", "bad");
			return;
		}
		state.prevBrief = briefText() || null;
		const gf =
			mode === "update"
				? {
						...have,
					}
				: {};
		work.forEach((g) => {
			gf[g.id] = g.fingerprint;
		});
		const model =
			(CONNECTION.server?.providers?.[CONNECTION.server.active] &&
				CONNECTION.server.providers[CONNECTION.server.active].effectiveModel) ||
			"";
		CONNECTION.project = await postJSON("/api/project/brief", {
			brief,
			briefMeta: {
				model,
				groups: sel.length,
				edited: false,
			},
			findings: all,
			groupFindings: gf,
		});
		await loadProjectData();
		syncProjectButtons();
		updatePreview();
		pMsg(
			`Brief written from ${all.length} findings across ${sel.length} folder${sel.length === 1 ? "" : "s"}.${failed ? ` ${failed} could not be read.` : ""}`,
			"ok",
		);
	} catch (e) {
		if (e && e.code === "cancelled") pMsg("Stopped. Nothing was changed.");
		else {
			handleAIError(e);
			pMsg("The brief couldn’t be written.", "bad");
		}
	} finally {
		state.projBusy = false;
		state.projCtl = null;
		lockProject(false);
		pProg("");
		PROJECTUI.brief = CONNECTION.project?.brief || "";
		renderProject();
	}
}
export function setProjectField(key, value) {
	PROJECTUI[key] = value;
}
export function setProjectDepth(value?: undefined) {
	state.projDepth = value;
	PROJECTUI.depth = value;
	loadProjectData();
}
export function editProjectBrief(value) {
	PROJECTUI.brief = value;
	clearTimeout(state.briefTimer);
	state.briefTimer = setTimeout(async () => {
		try {
			CONNECTION.project = await postJSON("/api/project/brief", {
				brief: PROJECTUI.brief,
				briefMeta: {
					...(CONNECTION.project?.briefMeta || {}),
					edited: true,
				},
			});
			PROJECTUI.project = CONNECTION.project;
			updatePreview();
		} catch {}
	}, 600);
}
export async function restoreProjectBrief() {
	if (!state.prevBrief) return;
	const brief = state.prevBrief;
	state.prevBrief = null;
	PROJECTUI.brief = brief;
	try {
		CONNECTION.project = await postJSON("/api/project/brief", {
			brief,
			briefMeta: {
				...(CONNECTION.project?.briefMeta || {}),
				edited: true,
			},
		});
		updatePreview();
	} catch {}
	renderProject();
}
export async function forgetProject() {
	try {
		const r = await postJSON("/api/project/forget", {});
		CONNECTION.project = r.project;
		state.PGROUPS = null;
		state.PFIND = null;
		state.prevBrief = null;
		PROJECTUI.path = "";
		PROJECTUI.brief = "";
		pMsg("This project was forgotten.");
		renderProject();
		syncProjectButtons();
		updatePreview();
	} catch (e) {
		pMsg(e.message, "bad");
	}
}
export function stopProject() {
	if (state.projCtl) state.projCtl.abort();
}
export function cancelProjectScan() {
	postJSON("/api/project/cancel", {}).catch(() => {});
}
export function initProject() {
	if (CONNECTION.project?.has) loadProjectData();
	renderProject();
	syncProjectButtons();
}

/* --- seeding the graph --- */
export async function seedFromProject() {
	if (!projectReady()) {
		showNote(["Scan a project folder first, in Settings > Project."], false);
		return;
	}
	if (activeProvider() === "demo" || !aiAvailable()) {
		showNote([aiNeed("Seeding from a project")], false);
		return;
	}
	let findings = [];
	try {
		findings = (await fetchJSON("/api/project/findings")).findings || [];
	} catch {}
	if (!findings.length) {
		showNote(
			["Build the project brief first. Seeding works from what it finds."],
			false,
		);
		openSettings("project");
		return;
	}
	enqueue(async () => {
		const c = new AbortController();
		aiPromptsState.ctl = c;
		pushHist();
		try {
			await runSeed(findings, c.signal);
		} finally {
			aiPromptsState.ctl = null;
		}
	});
}
export async function runSeed(findings, signal) {
	aiPromptsState.stopReveal = false;
	setBusy("Seeding from the project…", true);
	if (S.mode === "outer") setMode("detail");
	const byId = Object.fromEntries(findings.map((x) => [x.id, x])),
		TT = ["loop", "decision", "question", "consequence", "fog"];
	const gmap = Object.create(null),
		queue = [],
		max =
			{
				small: 10,
				medium: 16,
				large: 24,
			}[PREFS.growSize] || 16;
	let count = 0,
		streaming = true;
	const apply = (o) => {
		if (
			count >= max ||
			!o ||
			typeof o.text !== "string" ||
			!o.text.trim() ||
			!TT.includes(o.type)
		)
			return false;
		const refs = [];
		(Array.isArray(o.from) ? o.from : []).forEach((fid) => {
			const fi = byId[fid];
			if (fi?.refs?.[0] && refs.length < 3)
				refs.push({
					f: fi.refs[0].file,
					l: fi.refs[0].line,
					t: String(fi.text).slice(0, 200),
				});
		});
		if (!refs.length) return false; // a node with no real source is not allowed in
		const root = S.order.find(
			(id) => S.nodes[id] && !S.nodes[id].parent && !S.nodes[id].ghost,
		);
		let pid =
			String(o.parent) in gmap
				? gmap[String(o.parent)]
				: S.nodes[o.parent]
					? o.parent
					: null;
		if (!pid && root) pid = root;
		const id = addNode({
			type: o.type,
			text: o.text.trim().slice(0, 140),
			parent: pid,
			ghost: true,
		});
		const n = S.nodes[id];
		n.src = refs;
		if (o.type === "question")
			n.ticket = TICKETS.includes(o.ticket) ? o.ticket : "talk";
		gmap[String(o.id)] = id;
		count++;
		layout(false);
		save();
		return true;
	};
	const reveal = (async () => {
		while (streaming || queue.length) {
			if (aiPromptsState.stopReveal) {
				queue.length = 0;
				break;
			}
			if (!queue.length) {
				await sleep(60);
				continue;
			}
			if (apply(queue.shift())) await sleep(window.__DEMO_FAST__ ? 0 : 260);
		}
	})();
	try {
		await streamLines(seedPrompt(findings), {
			signal,
			temperature: PREFS.creativity,
			onObj: (o) => queue.push(o),
		});
	} catch (e) {
		if (e && e.code === "cancelled") aiPromptsState.stopReveal = true;
		else handleAIError(e);
	} finally {
		streaming = false;
	}
	await reveal;
	setBusy(null);
	if (count)
		showNote(
			[
				`Seeded ${count} suggestion${count === 1 ? "" : "s"} from the project. Each one shows where it came from.`,
			],
			true,
		);
	else if (!aiPromptsState.stopReveal)
		showNote(["Nothing in the findings could be turned into nodes."], false);
}
export const DEPTHS = {
	quick: {
		groups: 6,
		chars: 16000,
	},
	standard: {
		groups: 12,
		chars: 22000,
	},
	thorough: {
		groups: 24,
		chars: 26000,
	},
};
export const KINDS = [
	"mechanic",
	"parameter",
	"state",
	"decision",
	"open",
	"constraint",
	"system",
];
export const projectReady = () => !!CONNECTION.project?.has;
export const briefText = () => (CONNECTION.project?.brief || "").trim();
export const projectBriefOn = () =>
	LOCAL && PREFS.useProject && projectReady() && !!briefText();
export const fmtN = (n: number) =>
	n >= 10000
		? `${Math.round(n / 1000)}k`
		: n >= 1000
			? `${(n / 1000).toFixed(1)}k`
			: String(n);
export const pMsg: (arg0: string, arg1?: string) => void = (
	t: string,
	cls: string,
) => {
	PROJECTUI.message = t || "";
	PROJECTUI.messageClass = cls || "";
};
export const pProg = (t: string, cls?: string) => {
	PROJECTUI.progress = t || "";
	PROJECTUI.progressClass = cls || "";
};
export const citeName = (r) => `${r.f.split("/").pop()}:${r.l}`;

export function initialize() {
	state.projDepth = "standard";
	state.PGROUPS = null;
	state.PFIND = null;
	state.projBusy = false;
	state.projCtl = null;
	state.prevBrief = null;
	state.scanBusy = false;
	PROJECTUI = proxy({
		project: CONNECTION.project || {
			has: false,
		},
		path: CONNECTION.project?.root || "",
		ignore: "",
		include: "",
		brief: CONNECTION.project?.brief || "",
		depth: "standard",
		busy: false,
		scanBusy: false,
		message: "",
		messageClass: "",
		progress: "",
		progressClass: "",
		detail: "",
		estimate: "",
		buildLabel: "Build brief",
		canRestore: false,
	});
	connect({
		PROJECTUI,
		DEPTHS,
	});
	mount("project", $("#projectRoot"));
	SV = proxy({
		list: [],
		i: 0,
		open: false,
		loading: false,
		lines: [],
		error: "",
		copyText: "Copy path",
		request: 0,
	});
	connect({
		SV,
	});
	mount("source", $("#sourceRoot"));
	addEventListener(
		"keydown",
		(e) => {
			if (e.key === "Escape" && SV.open) {
				e.stopImmediatePropagation();
				closeSrcView();
			}
		},
		true,
	);
	state.briefTimer = 0;
	if (LOCAL) initProject();
}
