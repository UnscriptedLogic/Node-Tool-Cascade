import { PanelRightClose, PanelRightOpen, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { type Snapshot, useSnapshot } from "valtio";
import MatrixOrb from "@/components/matrix-orb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import Mindsets from "../../shared/mindsets.ts";
import { PREFS, TICKET_ASK, TICKET_LABEL } from "../core/constants.ts";
import { S, UI } from "../core/state.ts";
import {
	chartMap,
	closeSide,
	G,
	grillAction,
	mapAction,
	nextRound,
	openSide,
	PANEL,
	resetG,
	setDestination,
	setGrillAnswer,
	showStab,
	startGrill,
} from "../features/map.ts";
import { seedFromProject } from "../features/project.ts";
import { useFocus } from "../hooks/useFocus.ts";
import type { GrillCard } from "../model.ts";
import Ask from "./Ask.tsx";

interface CardProps {
	card: Snapshot<GrillCard>;
	hidden?: boolean;
}
function Card({ card, hidden }: CardProps) {
	const input = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => {
		if (card.focus) input.current?.focus();
	}, [card.focus]);
	const done = card.status !== "open";
	const tag = !card.grillable
		? "Talking probably won’t settle this. A prototype may be faster."
		: card.ticket !== "talk"
			? `${TICKET_LABEL[card.ticket]} ticket`
			: "";
	const action = (kind: string) => grillAction(card.id, kind);
	return (
		<div
			className={`gcard${done ? " done" : ""}`}
			data-cid={card.id}
			hidden={hidden}
		>
			<div className="gq">
				{`${card.mindset ? `${Mindsets.label(card.mindset)} — ` : ""}${card.text}`}
			</div>
			<div className="gwhy" hidden={!card.why}>
				{card.why}
			</div>
			<div className="gtag" hidden={!tag}>
				{tag}
			</div>
			<textarea
				ref={input}
				className="area gans"
				rows={3}
				placeholder={TICKET_ASK[card.ticket]}
				value={card.answer}
				disabled={done || card.busy}
				onChange={() => {}}
				onInput={(e) => setGrillAnswer(card.id, e.currentTarget.value)}
			/>
			<div className="gpush" hidden={done || !card.pushback}>
				{card.pushback}
			</div>
			<div className="gbtns" hidden={done}>
				<Button
					type="button"
					className="btn primary"
					data-gact="answer"
					disabled={card.busy}
					onClick={() => action("answer")}
				>
					{card.busy
						? card.busyLabel
						: card.checks > 0
							? "Answer again"
							: "Answer"}
				</Button>
				<Button
					type="button"
					className="btn"
					data-gact="standby"
					hidden={!card.pushback}
					disabled={card.busy}
					onClick={() => action("standby")}
				>
					Stand by it
				</Button>
				{[
					["idk", "I don’t know"],
					["proto", "Needs a prototype"],
					["out", "Out of scope"],
					["skip", "Skip"],
				].map(([kind, label]) => (
					<Button
						type="button"
						className="btn"
						key={kind}
						data-gact={kind}
						hidden={kind === "proto" && card.ticket === "prototype"}
						disabled={card.busy}
						onClick={() => action(kind)}
					>
						{label}
					</Button>
				))}
			</div>
			<div className="gstate" hidden={!done}>
				{card.message}
				{card.withPrototype && (
					<Button
						type="button"
						className="btn"
						data-gact="toproto"
						onClick={() => action("toproto")}
					>
						Make it a prototype
					</Button>
				)}
			</div>
		</div>
	);
}

const TITLES: Record<string, string> = {
	map: "Map",
	grill: "Grill",
	ask: "Ask",
};

const dismiss = () => closeSide();

function GrillThinking({ thinking }: { thinking: boolean }) {
	if (!thinking) return null;
	return (
		<span className="gthink">
			<MatrixOrb
				state="thinking"
				size={64}
				dots={11}
				color="#ffffff"
				className="[&>span]:sr-only"
				labels={{ thinking: "Thinking" }}
			/>
		</span>
	);
}

// Brings the panel back after it was closed, like the sidebar launcher.
export function SideLauncher() {
	return (
		<Button
			className="btn iconbtn"
			id="sideOpen"
			type="button"
			aria-label="Open panel"
			title="Open panel: Map, Grill and Ask"
			onPointerDown={(e) => e.stopPropagation()}
			onClick={() => openSide(PANEL.tab)}
		>
			<PanelRightOpen aria-hidden="true" />
		</Button>
	);
}
const panelHasFocus = () =>
	!!document.getElementById("side")?.contains(document.activeElement);

// One panel for Ask, Map and Grill: docked on the right on desktop, a bottom drawer on small screens.
function SidePanelShell({
	open,
	small,
	children,
}: {
	open: boolean;
	small: boolean;
	children: ReactNode;
}) {
	if (small)
		return (
			<Drawer
				direction="bottom"
				open={open}
				autoFocus
				onOpenChange={(next) => {
					if (!next) dismiss();
				}}
			>
				<DrawerContent
					id="side"
					className="cui"
					aria-describedby={undefined}
					// The backdrop takes the dismissing tap, so the canvas never sees it.
					overlayProps={{ id: "sideBack" }}
				>
					{children}
				</DrawerContent>
			</Drawer>
		);
	return (
		<DialogPrimitive.Root
			modal={false}
			open={open}
			onOpenChange={(next) => {
				// Escape belongs to the canvas unless focus is in the panel.
				if (!next && panelHasFocus()) dismiss();
			}}
		>
			<DialogPrimitive.Content
				asChild
				aria-describedby={undefined}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					// Focus left with the panel: hand it to the button that brings it back.
					if (document.activeElement === document.body)
						document.getElementById("sideOpen")?.focus();
				}}
				onInteractOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => {
					if (!panelHasFocus()) event.preventDefault();
				}}
			>
				<aside id="side">{children}</aside>
			</DialogPrimitive.Content>
		</DialogPrimitive.Root>
	);
}

export default function SidePanel() {
	const destination = useFocus<HTMLTextAreaElement>("mapDestination");
	const ui = useSnapshot(UI, { sync: true });
	const panel = useSnapshot(PANEL, { sync: true }),
		grill = useSnapshot(G, { sync: true }),
		state = useSnapshot(S, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true });
	const map = panel.map,
		total = map
			? map.settled.length + map.frontier.length + map.blocked.length
			: 0;
	const hint =
		panel.hint ||
		(!(prefs.goal || "").trim()
			? "Name the destination first. Everything on the map is measured against it."
			: map &&
					total &&
					!map.frontier.length &&
					!map.blocked.length &&
					!map.fog.length
				? "The map is clear. Nothing is left to decide before you build."
				: map && !total && !map.fog.length
					? "Chart the map to draft decision tickets, or grill the tree to find them."
					: map?.fog.length && !map.frontier.length && !map.blocked.length
						? "Only fog is left. Sharpen it into questions once you can phrase them."
						: "");
	const title = TITLES[panel.tab] || "Map";
	const selected =
		state.sel && state.nodes[String(state.sel)] ? String(state.sel) : null;
	const thinking = grill.busy || grill.cards.some((card) => card.busy);
	const scope = grill.scope && state.nodes[grill.scope],
		firstOpen = grill.cards.find((card) => card.status === "open");
	function section(
		title: string,
		ids: readonly string[] | undefined,
		kind: string,
	) {
		if (!ids?.length) return null;
		return (
			<div className="msec" key={title}>
				<h4>
					<div>{title}</div>
					<span>{ids.length}</span>
				</h4>
				{ids.slice(0, 14).map((id) => {
					const node = state.nodes[id];
					if (!node) return null;
					const waiting =
						kind === "blocked"
							? (map?.blockers?.[id] || [])
									.map((key) => state.nodes[key])
									.find((n) => n && n.state !== "settled" && n.state !== "out")
							: null;
					const answers =
						kind === "settled"
							? state.order
									.map((key) => state.nodes[key])
									.filter(
										(n) =>
											n && n.parent === id && n.type === "answer" && !n.ghost,
									)
							: [];
					const decision =
						(answers.find((n) => n.decided) || answers[0])?.text || "";
					const actions: Record<string, string[]> = {
						frontier: ["resolve", "Resolve"],
						settled: ["reopen", "Reopen"],
						fog: ["sharpen", "Sharpen"],
						out: ["restore", "Bring back"],
					};
					const action = actions[kind];
					return (
						<div className="mitem" data-id={id} key={id}>
							<button
								type="button"
								className="mitem-main"
								onClick={() => mapAction(id, undefined)}
							>
								<div>{node.text}</div>
								{decision && <div className="dec">{`→ ${decision}`}</div>}
							</button>
							<div className="mrow2">
								{["frontier", "blocked"].includes(kind) && (
									<span className="chip2">
										{TICKET_LABEL[node.ticket || "talk"]}
									</span>
								)}
								{kind === "blocked" && (
									<span className="chip2">
										{waiting
											? `after: ${waiting.text.slice(0, 32)}`
											: "waiting"}
									</span>
								)}
								{action && (
									<Button
										type="button"
										className="btn"
										data-act={action[0]}
										onClick={() => mapAction(id, action[0])}
									>
										{action[1]}
									</Button>
								)}
							</div>
						</div>
					);
				})}
				{ids.length > 14 && (
					<div className="small">and {ids.length - 14} more</div>
				)}
			</div>
		);
	}
	return (
		<SidePanelShell open={panel.open} small={ui.small}>
			<DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
			<header className="sidehead">
				<ButtonGroup id="sideTabs" className="bgroup" aria-label="Panel">
					{[
						["map", "Map"],
						["grill", "Grill"],
						["ask", "Ask"],
					].map(([key, label]) => (
						<Button
							className="btn"
							type="button"
							key={key}
							id={`st${label}`}
							aria-pressed={panel.tab === key}
							onClick={() => showStab(key)}
						>
							{label}
						</Button>
					))}
				</ButtonGroup>
				<Button
					className="btn iconbtn"
					id="sideClose"
					type="button"
					aria-label="Close panel"
					title="Close panel"
					onClick={() => closeSide()}
				>
					{ui.small ? (
						<XIcon aria-hidden="true" />
					) : (
						<PanelRightClose aria-hidden="true" />
					)}
				</Button>
			</header>
			<div className="sidebody">
				<section id="s-map" hidden={panel.tab !== "map"}>
					<div className="msec">
						<h4>Destination</h4>
						<textarea
							id="mDest"
							ref={destination}
							className="area"
							rows={2}
							maxLength={600}
							placeholder="What does the finished map look like?"
							value={prefs.goal}
							onChange={() => {}}
							onInput={(e) => setDestination(e.currentTarget.value)}
						/>
						<div className="mrow">
							<div className="prog">
								<i
									id="mProg"
									style={{
										width: `${
											total && map
												? Math.round((map.settled.length / total) * 100)
												: 0
										}%`,
									}}
								/>
							</div>
							<span id="mProgTxt" className="small">
								{total && map
									? `${map.settled.length} of ${total} settled`
									: "No decisions yet"}
							</span>
						</div>
						<div className="mrow">
							<Button
								className="btn primary"
								id="mChart"
								type="button"
								onClick={() => chartMap()}
							>
								Chart the map
							</Button>
							<Button
								className="btn"
								id="mGrillAll"
								type="button"
								onClick={() => startGrill(null)}
							>
								Grill me
							</Button>
							<Button
								className="btn"
								id="mSeed"
								type="button"
								hidden={!panel.canSeed}
								onClick={() => seedFromProject()}
							>
								Seed from project
							</Button>
						</div>
						<small id="mHint">{hint}</small>
					</div>
					<div id="mLists">
						{map && [
							section("Up next", map.frontier, "frontier"),
							section("Waiting", map.blocked, "blocked"),
							section("Decisions so far", map.settled, "settled"),
							section("Fog", map.fog, "fog"),
							section("Out of scope", map.out, "out"),
						]}
					</div>
				</section>
				<section id="s-grill" hidden={panel.tab !== "grill"}>
					<div id="gIdle" hidden={grill.active}>
						<p className="gintro">
							A grill is an interview. The AI asks, you decide, and it pushes
							back when an answer looks weak. It never writes an answer for you.
							Each question you settle lands on the canvas as a decision. “I
							don’t know” is a real answer, and if talking can’t settle
							something, make it a prototype.
						</p>
						<div className="mrow">
							<Button
								className="btn primary"
								id="gStartAll"
								type="button"
								onClick={() => startGrill(null)}
							>
								Grill the whole tree
							</Button>
							<Button
								className="btn"
								id="gStartSel"
								type="button"
								disabled={!selected}
								onClick={() => {
									if (selected) startGrill(selected);
								}}
							>
								Grill the selected node
							</Button>
						</div>
						<small id="gIdleMsg" className="gnote" hidden={!panel.idleMessage}>
							{panel.idleMessage}
						</small>
					</div>
					<div id="gSession" hidden={!grill.active}>
						<div className="ghead">
							<GrillThinking thinking={thinking} />
							<div className="gtitle">
								<span id="gScope">
									{grill.resolve
										? "Resolving one question"
										: scope
											? scope.text
											: "Whole tree"}
								</span>
								<span id="gRound" hidden={grill.resolve}>
									{`Round ${grill.round}`}
								</span>
							</div>
						</div>
						<div id="gCards">
							{grill.cards.map((card) => (
								<Card
									key={card.id}
									card={card}
									hidden={
										prefs.grillStyle === "single" &&
										!grill.resolve &&
										card.status === "open" &&
										card.id !== firstOpen?.id
									}
								/>
							))}
						</div>
						<small id="gNote" className="gnote" hidden={!panel.grillNote}>
							{panel.grillNote}
						</small>
						<div id="gDone" className="gdone" hidden={!panel.doneMessage}>
							{panel.doneMessage}
						</div>
						<div className="gfoot">
							<Button
								className="btn primary"
								id="gNext"
								type="button"
								hidden={grill.resolve || grill.done}
								disabled={grill.busy}
								onClick={() => nextRound()}
							>
								{grill.busy ? "Asking…" : "Next round"}
							</Button>
							<Button
								className="btn"
								id="gEnd"
								type="button"
								onClick={() => {
									resetG();
									PANEL.idleMessage = "";
								}}
							>
								End session
							</Button>
						</div>
					</div>
				</section>
				<section id="s-ask" hidden={panel.tab !== "ask"}>
					<div id="askRoot">
						<Ask />
					</div>
				</section>
			</div>
		</SidePanelShell>
	);
}
