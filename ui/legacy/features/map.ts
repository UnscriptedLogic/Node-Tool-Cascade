import { proxy, ref } from "valtio/vanilla";
import { isRecord } from "../../../shared/types.ts";
import type { GrillCard, TreeMap } from "../../model.ts";
import {
	aiAvailable,
	aiNeed,
	callAI,
	enqueue,
	expandFrom,
	guideBlock,
	handleAIError,
	parseObj,
	setController,
	treeText,
} from "../ai/prompts.ts";
import { beginEdit } from "../canvas/interaction.ts";
import { layout, restyle } from "../canvas/layout.ts";
import { applyView, ensureVisible, setMode } from "../canvas/view.ts";
import { track } from "../core/analytics.ts";
import { drawerW, PREFS, TICKETS } from "../core/constants.ts";
import { stage } from "../core/dom.ts";
import { DOM } from "../core/profiles.ts";
import { state as coreStateState, pushHist, S, UI } from "../core/state.ts";
import { addNode, blockCycle, computeMap, expandChain } from "../core/tree.ts";
import { commit, requestFocus, select, showNote } from "../shell/hud.ts";
import { setPreference } from "../shell/settings.ts";
import { mindsetBlock, mindsetCandidates, mindsetResult } from "./mindsets.ts";
import { citeText, projectEvidence } from "./project.ts";
export const PANEL = proxy({
	open: false,
	tab: "map",
	map: null as TreeMap | null,
	hint: "",
	grillNote: "",
	idleMessage: "",
	doneMessage: "",
	canSeed: false,
});
export const G = proxy({
	active: false,
	scope: null as string | null,
	focus: "",
	cards: [] as GrillCard[],
	round: 0,
	history: [] as { q: string; a?: string; s: string }[],
	busy: false,
	done: false,
	failed: false,
	summary: "",
	resolve: false,
	yes: 0,
	ctl: null as AbortController | null,
	seq: 0,
});
export function showStab(t: string) {
	PANEL.tab = t;
	S.layer = t !== "ask";
	layout(false);
	applyView();
	if (t === "map") renderMap();
}
export function openSide(tab: string) {
	PANEL.open = true;
	(stage as HTMLElement).style.setProperty("--drawer", `${drawerW()}px`);
	showStab(tab || PANEL.tab);
}
export function closeSide() {
	PANEL.open = false;
	S.layer = false;
	coreStateState.linkFrom = null;
	(stage as HTMLElement).style.setProperty("--drawer", "0px");
	layout(false);
	applyView();
}
export function focusNode(id) {
	if (!S.nodes[id]) return;
	if (S.mode === "outer") setMode("detail");
	expandChain(S.nodes[id].parent);
	layout(false);
	select(id);
	ensureVisible(id);
}

/* ---- ticket + map actions on nodes ---- */
export function cycleTicket(id) {
	const n = S.nodes[id];
	if (!n) return;
	pushHist();
	n.ticket =
		TICKETS[(TICKETS.indexOf(n.ticket || "talk") + 1) % TICKETS.length];
	commit();
}
export function toggleOut(id) {
	const n = S.nodes[id];
	if (!n) return;
	pushHist();
	if (n.state === "out") {
		n.state = n.was || "open";
		delete n.was;
	} else {
		n.was = n.state || "open";
		n.state = "out";
	}
	commit();
}
export function reopenQ(id) {
	const n = S.nodes[id];
	if (!n) return;
	pushHist();
	n.state = "open";
	commit();
}
export function startBlock(id?: undefined) {
	coreStateState.linkFrom = id;
	restyle();
	showNote(
		["Click the question that must be settled first. Esc cancels."],
		false,
	);
}
export function finishBlock(blockerId?) {
	const blocked = coreStateState.linkFrom;
	coreStateState.linkFrom = null;
	restyle();
	const a = S.nodes[blockerId],
		b = S.nodes[blocked];
	if (!a || !b || blockerId === blocked) return;
	if (a.type !== "question" || b.type !== "question") {
		showNote(["Blocking works between two questions."], false);
		return;
	}
	const i = S.links.findIndex(
		(l) => l.kind === "block" && l.a === blockerId && l.b === blocked,
	);
	if (i >= 0) {
		pushHist();
		S.links.splice(i, 1);
		commit();
		showNote(["Removed the block."], true);
		return;
	}
	if (blockCycle(blockerId, blocked)) {
		showNote(["That would make two questions wait on each other."], false);
		return;
	}
	pushHist();
	S.links.push({
		a: blockerId,
		b: blocked,
		kind: "block",
	});
	commit();
	showNote(
		[
			{
				b: `“${b.text}”`,
			},
			" now waits for ",
			{
				b: `“${a.text}”`,
			},
			".",
		],
		true,
	);
}

/* ---- map tab ---- */
export function renderMap() {
	PANEL.hint = "";
	coreStateState.MAP = computeMap();
	PANEL.map = coreStateState.MAP;
}
export function mapAction(id, action) {
	if (!action) focusNode(id);
	else if (action === "resolve") startResolve(id);
	else if (action === "reopen") reopenQ(id);
	else if (action === "restore") toggleOut(id);
	else if (action === "sharpen") {
		focusNode(id);
		beginEdit(id, {
			graduate: true,
		});
	}
}
export function setDestination(value) {
	PANEL.hint = "";
	setPreference("goal", value);
}
export function chartMap() {
	if (!(PREFS.goal || "").trim()) {
		PANEL.hint =
			"Name the destination first. Everything on the map is measured against it.";
		requestFocus("mapDestination");
		return;
	}
	if (!aiAvailable()) {
		showNote([aiNeed("Charting")], false);
		return;
	}
	const root = S.order.find(
		(id) => S.nodes[id] && !S.nodes[id].parent && !S.nodes[id].ghost,
	);
	if (!root) {
		PANEL.hint = "Plant at least one node first, then chart the map around it.";
		return;
	}
	if (S.mode === "outer") setMode("detail");
	enqueue(async () => {
		const c = new AbortController();
		setController(c);
		pushHist();
		try {
			await expandFrom(root, c.signal, "chart");
		} finally {
			setController(null);
		}
	});
}

/* ---- grill ---- */
export function resetG() {
	if (G.ctl) G.ctl.abort();
	Object.assign(G, {
		active: false,
		scope: null,
		focus: "",
		cards: [],
		round: 0,
		history: [],
		busy: false,
		done: false,
		failed: false,
		summary: "",
		resolve: false,
		yes: 0,
		ctl: null,
		seq: 0,
	});
	PANEL.grillNote = "";
	PANEL.doneMessage = "";
}
export function gNoteShow(text: string) {
	PANEL.grillNote = text;
}
export function startGrill(scopeId: string | null, focus?: string) {
	track("grill");
	openSide("grill");
	if (!aiAvailable()) {
		resetG();
		PANEL.idleMessage = aiNeed("Grilling");
		return;
	}
	PANEL.idleMessage = "";
	resetG();
	G.active = true;
	G.scope = scopeId || null;
	G.focus = typeof focus === "string" ? focus : "";
	nextRound();
}
export function startResolve(id) {
	const n = S.nodes[id];
	if (n?.type !== "question") return;
	openSide("grill");
	PANEL.idleMessage = "";
	resetG();
	G.active = true;
	G.resolve = true;
	G.scope = id;
	G.round = 1;
	addCard({
		nodeId: id,
		text: n.text,
		why: n.why || "",
		ticket: n.ticket || "talk",
		parent: n.parent,
		grillable: true,
		mindset: n.mindset,
	});
}
export function addCard(spec) {
	const card = {
		id: `c${++G.seq}`,
		nodeId: spec.nodeId || null,
		text: spec.text,
		why: spec.why || "",
		ticket: spec.ticket || "talk",
		parent: spec.parent || null,
		grillable: spec.grillable !== false,
		status: "open",
		checks: 0,
		mindset: spec.mindset || null,
		answer: "",
		pushback: "",
		message: "",
		withPrototype: false,
		busy: false,
		busyLabel: "",
		focus: 0,
	};
	G.cards.push(card);
	return G.cards[G.cards.length - 1];
}
export function setCardBusy(card, on, label?) {
	card.busy = on;
	card.busyLabel = label || "";
}
export function finishCard(card, status, message, withPrototype?) {
	card.status = status;
	card.message = message;
	card.pushback = "";
	card.withPrototype = !!withPrototype;
	checkRoundEnd();
}
export function grillAction(id, action) {
	const card = G.cards.find((c) => c.id === id);
	if (card) return cardAction(card, action);
}
export function setGrillAnswer(id, text) {
	const card = G.cards.find((c) => c.id === id);
	if (card) card.answer = text;
}
export function ensureQuestion(card) {
	if (card.nodeId && S.nodes[card.nodeId]) return S.nodes[card.nodeId];
	const parent = card.parent && S.nodes[card.parent] ? card.parent : null;
	const id = addNode({
		type: "question",
		text: card.text,
		parent,
		mindset: card.mindset,
	});
	const q = S.nodes[id];
	q.ticket = card.ticket;
	q.state = "open";
	if (card.why) q.why = card.why;
	card.nodeId = id;
	return q;
}
export function commitAnswer(card, text) {
	pushHist();
	const q = ensureQuestion(card);
	q.state = "settled";
	delete q.unknown;
	const aid = addNode({
		type: "answer",
		text: text.length > 220 ? `${text.slice(0, 217)}…` : text,
		parent: card.nodeId,
	});
	const a = S.nodes[aid];
	a.decided = true;
	if (text.length > 220) a.note = text.slice(0, 1000);
	G.history.push({
		q: card.text,
		a: text,
		s: "settled",
	});
	commit();
	ensureVisible(card.nodeId);
	finishCard(card, "settled", "Settled. It’s on the canvas as a decision.");
}
export function trackYes(text: string) {
	const quick =
		/^(yes|yep|yeah|ok|okay|agreed?|sure|fine|sounds good|right|correct|true|makes sense)[\s.!]*$/i.test(
			text.trim(),
		);
	G.yes = quick ? G.yes + 1 : 0;
	if (G.yes >= 3)
		gNoteShow(
			`That’s ${G.yes} quick agreements in a row. Push back on one before moving on. A session where you never disagree is one you didn’t need.`,
		);
	else if (G.yes === 0 && PANEL.grillNote.startsWith("That’s")) gNoteShow("");
}
export async function askPushback(card, text) {
	const ev = await projectEvidence(`${card.text} ${text}`, 4);
	const prompt = `You are a sharp but fair design interviewer. A ${DOM().personFull} just answered a question. Decide whether the answer needs pushback and, if it does, give it. You never answer for the ${DOM().person}, never suggest an alternative decision and never offer options to pick from.

${guideBlock()}TREE (id | type | text | parent):
${treeText()}

QUESTION: ${card.text}
WHY IT WAS ASKED: ${card.why || "not stated"}
THE ${DOM().person.toUpperCase()}'S ANSWER: ${text}
${ev ? `\n${ev.block}\n` : ""}
Push back only when you see a real problem: a hidden assumption, a conflict with something already in the tree or with the destination, an unexamined consequence, or an answer too vague to act on. If the answer holds up, say so.
${ev ? "If the answer conflicts with what the excerpts show, say so and cite the excerpt id like [f2].\n" : ""}Reply with ONLY a JSON object, no markdown:
{"verdict":"solid or challenge","text":"if challenge: one or two sentences phrased as a pointed question. If solid: empty."}`;
	const c = new AbortController();
	G.ctl = ref(c);
	try {
		const out = await callAI(prompt, {
			signal: c.signal,
			temperature: 0.3,
		});
		const r0 = parseObj(out.text);
		r0.refs = ev ? ev.refs : null;
		return r0;
	} finally {
		if (G.ctl === c) G.ctl = null;
	}
}
export async function submitAnswer(card) {
	const text = card.answer.trim();
	if (!text) {
		card.focus++;
		return;
	}
	trackYes(text);
	if (PREFS.pushback && aiAvailable() && card.checks < 2) {
		card.checks++;
		setCardBusy(card, true, "Thinking…");
		let r = null;
		try {
			r = await askPushback(card, text);
		} catch (e) {
			if (e && e.code === "cancelled") {
				setCardBusy(card, false);
				return;
			}
		}
		setCardBusy(card, false);
		if (
			r &&
			r.verdict === "challenge" &&
			typeof r.text === "string" &&
			r.text.trim()
		) {
			card.pushback = citeText(r.text.trim(), r.refs).slice(0, 420);
			card.focus++;
			return;
		}
	}
	commitAnswer(card, text);
}
export function cardAction(card, act) {
	if (card.status !== "open" && act !== "toproto") return;
	if (act === "answer") return submitAnswer(card);
	if (act === "standby") {
		const t = card.answer.trim();
		if (t) commitAnswer(card, t);
		return;
	}
	if (act === "skip") {
		card.status = "skipped";
		G.cards = G.cards.filter((c) => c.id !== card.id);
		checkRoundEnd();
		return;
	}
	if (act === "toproto") {
		const q = card.nodeId && S.nodes[card.nodeId];
		if (q) {
			pushHist();
			q.ticket = "prototype";
			commit();
			card.message = "Now a prototype ticket. It stays open on the map.";
		}
		return;
	}
	pushHist();
	const q = ensureQuestion(card);
	if (act === "idk") {
		q.unknown = true;
		G.history.push({
			q: card.text,
			s: `the ${DOM().person} did not know`,
		});
		commit();
		finishCard(
			card,
			"unknown",
			"Left open on the map. If talking won’t get you there, try a prototype.",
			card.ticket !== "prototype",
		);
	} else if (act === "proto") {
		q.ticket = "prototype";
		G.history.push({
			q: card.text,
			s: "needs a prototype",
		});
		commit();
		finishCard(
			card,
			"proto",
			"Now a prototype ticket. It stays open on the map.",
		);
	} else if (act === "out") {
		q.was = q.state || "open";
		q.state = "out";
		G.history.push({
			q: card.text,
			s: "out of scope",
		});
		commit();
		finishCard(card, "out", "Parked as out of scope.");
	}
}
export function checkRoundEnd() {
	if (G.resolve || G.yes >= 3) return; // keep the passivity nudge on screen
	const open = G.cards.filter((c) => c.status === "open").length;
	if (!open && !G.busy && G.cards.length)
		gNoteShow(
			G.round >= 5
				? "That’s a long session. Consider ending it and grilling a smaller branch."
				: "Round complete. Ask for the next one when you’re ready.",
		);
}
export function roundPrompt(ev, candidates) {
	const sc = G.scope && S.nodes[G.scope];
	const fog = S.order
		.filter(
			(id) =>
				S.nodes[id] &&
				S.nodes[id].type === "fog" &&
				S.nodes[id].state !== "out" &&
				!S.nodes[id].ghost,
		)
		.map((id) => `- ${S.nodes[id].text}`)
		.join("\n");
	const hist = G.history
		.map((h) =>
			h.s === "settled" ? `Q: ${h.q}\nA: ${h.a}` : `Q: ${h.q}\n(${h.s})`,
		)
		.join("\n\n");
	return `You are interviewing a ${DOM().personFull} so they can commit to decisions. You ask, they decide. You are working in rounds: a round is every question whose prerequisites the ${DOM().person} has already settled. Never ask a question that depends on an answer you have not heard yet.

${guideBlock()}TREE (id | type | text | parent):
${S.order.length ? treeText() : "(empty)"}${ev ? `\n\n${ev.block}` : ""}
${sc ? `\nSCOPE: stay inside this part of the tree: ${sc.text} (${G.scope})\n` : ""}${G.focus ? `\nGAP TO CLOSE: the ${DOM().person} wants the tree to lead to a feeling they named, and the two ends do not meet yet. ${G.focus}\nAsk the questions whose answers would let the existing nodes connect to that feeling.\n` : ""}${fog ? `\nFOG (decisions coming that the ${DOM().person} cannot phrase yet):\n${fog}\n` : ""}${hist ? `\nSESSION SO FAR:\n${hist}\n` : ""}
Write one JSON object per line (NDJSON). No markdown, no commentary. Each line:
{"id":"q1","parent":"<id of the existing node this question comes out of>","text":"<question, at most 18 words>","why":"<at most 20 words on what answering it unlocks>","ticket":"talk|prototype|research|task","grillable":true}

Rules:
- Ask 3 to 6 questions this round, all independent of each other.
- Never answer a question yourself, never offer options to pick from, and never hint at the answer.
- Prefer questions that expose decisions the ${DOM().person} is making without noticing, and that test the destination or the goal.
- Be specific to this ${DOM().subject} and this tree. Do not repeat anything already settled or already asked.
- Set grillable to false and ticket to prototype when the question cannot be settled by talking because the ${DOM().person} needs something to react to. Use research when a fact from outside the tree is needed and task when manual preparation blocks a decision.
${ev ? "- The excerpts show what the project already does. Where it has already made a decision, ask whether it is intended instead of asking as if the question were open. Where it conflicts with the tree or the goal, ask about the conflict.\n" : ""}- If nothing is left to ask, write exactly one line instead: {"done":true,"summary":"<at most 25 words on what is now settled>"}${mindsetBlock(candidates || mindsetCandidates(G.scope), false)}`;
}
export async function nextRound() {
	if (G.busy || G.resolve) return;
	if (!aiAvailable()) {
		gNoteShow(aiNeed("Grilling"));
		return;
	}
	G.busy = true;
	G.failed = false;
	G.round++;
	G.cards = [];
	PANEL.doneMessage = "";
	gNoteShow("");
	const sc0 = G.scope && S.nodes[G.scope];
	const ev = await projectEvidence(
		(
			(sc0 ? `${sc0.text} ` : "") +
			(PREFS.goal || "") +
			" " +
			(PREFS.context || "")
		).trim() || `${DOM().subject} ${DOM().treeName}`,
		5,
	);
	const c = new AbortController();
	G.ctl = ref(c);
	const candidates = mindsetCandidates(G.scope);
	let done = 0,
		got = 0,
		mindsetCount = 0,
		cancelled = false;
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
			let o: unknown;
			try {
				o = JSON.parse(ln);
			} catch {
				continue;
			}
			if (!isRecord(o)) continue;
			if (o.done) {
				G.done = true;
				G.summary =
					typeof o.summary === "string" ? o.summary.slice(0, 220) : "";
				continue;
			}
			if (typeof o.text !== "string" || !o.text.trim() || got >= 6) continue;
			const parent =
				typeof o.parent === "string" && S.nodes[o.parent]
					? o.parent
					: G.scope && S.nodes[G.scope]
						? G.scope
						: null;
			const m = mindsetResult(o, candidates, parent);
			if (!m.ok || (m.value && mindsetCount >= 2)) continue;
			if (m.value) mindsetCount++;
			addCard({
				text: o.text.trim().slice(0, 200),
				why: typeof o.why === "string" ? o.why.slice(0, 160) : "",
				ticket:
					typeof o.ticket === "string" && TICKETS.includes(o.ticket)
						? o.ticket
						: "talk",
				parent,
				grillable: o.grillable !== false,
				mindset: m.value,
			});
			got++;
		}
	};
	try {
		const out = await callAI(roundPrompt(ev, candidates), {
			cache: false,
			signal: c.signal,
			temperature: PREFS.creativity,
			onText: ({ text }) => parse(text, false),
		});
		parse(out.text, true);
	} catch (e) {
		if (e && e.code === "cancelled") cancelled = true;
		else {
			G.failed = true;
			handleAIError(e);
		}
	}
	G.ctl = null;
	G.busy = false;
	if (!got && !G.done && !G.failed && !cancelled) G.done = true;
	if (G.failed) gNoteShow("That round didn’t come back. Try again.");
	if (G.done && !got) {
		const n = G.history.filter((h) => h.s === "settled").length;
		PANEL.doneMessage =
			(G.summary ? `${G.summary} ` : "") +
			`Nothing is left unspoken for now. ${n} ${n === 1 ? "decision is" : "decisions are"} settled this session.`;
	}
	checkRoundEnd();
}
export function toggleMap() {
	if (!PANEL.open || PANEL.tab === "ask")
		openSide(PANEL.tab === "ask" ? "map" : PANEL.tab);
	else closeSide();
}
export function toggleAsk() {
	if (!PANEL.open || PANEL.tab !== "ask") openSide("ask");
	else closeSide();
}
export function startMap() {
	UI.panel = PANEL;
}
