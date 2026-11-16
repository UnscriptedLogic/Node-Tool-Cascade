import { useLayoutEffect, useMemo } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { nodeActions } from "../legacy/canvas/layout.ts";
import { setMode } from "../legacy/canvas/view.ts";
import {
	ACT,
	CONNECTION,
	LOCAL,
	PREFS,
	WEB,
} from "../legacy/core/constants.ts";
import { AI, hist, S, UI } from "../legacy/core/state.ts";
import { isOuter } from "../legacy/core/tree.ts";
import { clearAskHighlight } from "../legacy/features/ask.ts";
import { toggleAsk, toggleMap } from "../legacy/features/map.ts";
import { seedFromProject } from "../legacy/features/project.ts";
import { dismissAll, keepAll, undo } from "../legacy/ui/actions.ts";
import { fitCanvas, stopCanvasAI, zoomCanvas } from "../legacy/ui/controls.ts";
import { runNodeAction, SHORT } from "../legacy/ui/responsive.ts";
import { openSettings } from "../legacy/ui/settings.ts";

export default function Hud() {
	const state = useSnapshot(S, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true }),
		ui = useSnapshot(UI, { sync: true }),
		ai = useSnapshot(AI, { sync: true }),
		connection = useSnapshot(CONNECTION, { sync: true }),
		history = useSnapshot(hist, { sync: true });
	const provider = connection.cloud
		? connection.server?.active || "demo"
		: WEB
			? connection.web.provider
			: LOCAL
				? connection.server?.active || "demo"
				: "claude";
	const demo = (LOCAL || WEB) && provider === "demo",
		available =
			!ai.off &&
			(demo ||
				(connection.cloud || LOCAL
					? connection.server?.ready
					: WEB
						? connection.web.key && connection.web.model
						: ai.sample));
	const idle =
		ai.checked && demo
			? "Demo mode: the AI is scripted. Drag a block onto the canvas to try it."
			: ai.checked && !available
				? LOCAL || WEB
					? "No AI connected, so blocks place by keyword"
					: "Claude isn’t available here, so blocks place by keyword"
				: "Drag a block onto the canvas, then type your idea";
	const providerLabel = ui.providerLabels[connection.server?.active],
		effectiveModel =
			connection.server?.providers?.[connection.server.active]?.effectiveModel;
	const goal = (prefs.goal || "").trim(),
		ghosts = Object.values(state.nodes).filter((n) => n.ghost).length,
		ask = ui.ask;
	const highlighted = ask?.threads.some(
		(thread) => thread.on && thread.ids.some((id) => state.nodes[id]),
	);
	const node = state.nodes[state.sel],
		showBar = !!(
			node &&
			ui.small &&
			!ui.minimal &&
			(state.mode !== "outer" || isOuter(node))
		);
	const hasKids =
		!!node && Object.values(state.nodes).some((n) => n.parent === node.id);
	const actions = useMemo(
		() => (showBar ? nodeActions(node, hasKids) : []),
		[
			showBar,
			state.mode,
			state.layer,
			state.mindsets.length,
			prefs.domain,
			node,
			hasKids,
		],
	);
	useLayoutEffect(() => {
		if (ui.focus) {
			const element = document.getElementById(ui.focus.id);
			element?.focus();
			if (ui.focus.select) (element as HTMLInputElement)?.select();
		}
	}, [ui.focus]);
	useLayoutEffect(() => {
		document.getElementById("stage").classList.toggle("nb", showBar);
	}, [showBar]);
	const barSignature = showBar
		? `${state.sel}|${actions.map((action) => action[0] + action[1]).join()}`
		: "";
	return (
		<>
			<div id="empty" hidden={state.order.length > 0}>
				<p>
					<b>An empty tree</b>
					<span className="dh">
						Drag a block onto the canvas to plant the first node.
					</span>
					<span className="msh">
						Tap a block below to plant the first node.
					</span>
					<span className="mmh">Tap anywhere, then Add a block.</span>
					<Button
						className="btn"
						id="eSeed"
						type="button"
						hidden={!ui.seed}
						style={{ pointerEvents: "auto", marginTop: 14 }}
						onClick={() => seedFromProject()}
					>
						Seed from your project
					</Button>
				</p>
			</div>
			<div id="status" className={`hud pill${ui.busy ? " busy" : ""}`}>
				<span className="dot" />
				<span id="stxt">{ui.busy || idle}</span>
				<button
					className="linkbtn"
					id="setLink"
					type="button"
					hidden={
						!((LOCAL || WEB) && ai.checked && !ui.busy && (!available || demo))
					}
					onClick={() => openSettings("ai")}
				>
					{demo ? "Use your chat or connect AI" : "Open settings"}
				</button>
				<button
					className="linkbtn"
					id="stopBtn"
					type="button"
					hidden={!(ui.busy && ui.stoppable)}
					onClick={() => stopCanvasAI()}
				>
					Stop
				</button>
			</div>
			<button
				id="goalchip"
				className={`hud pill${goal ? "" : " unset"}`}
				type="button"
				title={goal || "Set an overarching goal to steer the questions"}
				onClick={() => {
					openSettings("goal");
					setTimeout(() => document.getElementById("gGoal").focus(), 30);
				}}
			>
				<span className="gl">{goal ? "Goal" : "No goal set"}</span>
				<span className="gt">{goal}</span>
			</button>
			<div
				id="provchip"
				className="hud pill"
				hidden={!((LOCAL || connection.cloud) && providerLabel)}
			>
				<span className="pt" title="Current AI provider">
					{providerLabel?.replace(/\s*\(.*\)$/, "") +
						(effectiveModel ? ` · ${effectiveModel}` : "")}
				</span>
				<button
					className="linkbtn"
					id="provBtn"
					type="button"
					title="Open Settings > AI model"
					onClick={() => openSettings("ai")}
				>
					Change
				</button>
			</div>
			<button
				id="hlchip"
				className="hud pill"
				type="button"
				hidden={!highlighted}
				title="Clear the highlight"
				onClick={() => clearAskHighlight()}
			>
				<span className="hl">
					{ask?.q ? `Highlighting: ${ask.q.slice(0, 56)}` : ""}
				</span>
				<span className="linkbtn">Clear</span>
			</button>
			<div id="ctrl" className="hud">
				<div className="seg" role="group" aria-label="View">
					<button
						type="button"
						id="mDetail"
						aria-pressed={Boolean(state.mode === "detail")}
						onClick={() => setMode("detail")}
					>
						Detail
					</button>
					<button
						type="button"
						id="mOuter"
						aria-pressed={Boolean(state.mode === "outer")}
						onClick={() => setMode("outer")}
					>
						Loops
					</button>
				</div>
				<div className="seg" role="group" aria-label="Zoom">
					<button
						type="button"
						id="zOut"
						aria-label="Zoom out"
						onClick={() => zoomCanvas(0.8)}
					>
						−
					</button>
					<button
						type="button"
						id="zFit"
						aria-label="Fit to screen"
						onClick={() => fitCanvas()}
					>
						Fit
					</button>
					<button
						type="button"
						id="zIn"
						aria-label="Zoom in"
						onClick={() => zoomCanvas(1.25)}
					>
						+
					</button>
				</div>
				<Button
					className="btn"
					id="askBtn"
					type="button"
					aria-pressed={Boolean(!!ui.panel?.open && ui.panel.tab === "ask")}
					onClick={() => toggleAsk()}
				>
					Ask
				</Button>
				<Button
					className="btn"
					id="mapBtn"
					type="button"
					aria-pressed={Boolean(!!ui.panel?.open && ui.panel.tab !== "ask")}
					onClick={() => toggleMap()}
				>
					Map
				</Button>
				<Button
					className="btn"
					id="undoBtn"
					type="button"
					disabled={!history.length}
					onClick={() => undo()}
				>
					Undo
				</Button>
				<Button
					className="btn iconbtn"
					id="setBtn"
					type="button"
					aria-label="Settings"
					title={ui.settingsTitle}
					onClick={() => openSettings()}
				>
					<svg
						viewBox="0 0 16 16"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M2 5h7M12 5h2M2 11h2M7 11h7" />
						<circle cx="10.5" cy="5" r="1.5" />
						<circle cx="5.5" cy="11" r="1.5" />
					</svg>
				</Button>
			</div>
			<div
				id="nodebar"
				className="hud"
				hidden={!showBar}
				data-for={barSignature}
				role="toolbar"
				aria-label="Block actions"
			>
				{actions.map(([action, title]) => (
					<button
						type="button"
						key={action}
						data-act={action}
						aria-label={title}
						title={title}
						onClick={() => runNodeAction(action, state.sel)}
					>
						<span
							className="ic"
							dangerouslySetInnerHTML={{ __html: ACT[action] }}
						/>
						<span>{SHORT[action] || action}</span>
					</button>
				))}
			</div>
			<div id="note" className="hud" hidden={!ui.noteOpen}>
				<span id="ntxt">
					{ui.note.map((part, i) =>
						typeof part === "string" ? part : <b key={i}>{part.b}</b>,
					)}
				</span>
				<button
					className="linkbtn"
					id="noteUndo"
					type="button"
					hidden={!ui.noteUndo}
					onClick={() => undo()}
				>
					Undo
				</button>
			</div>
			<div
				id="ghostbar"
				className="hud"
				hidden={!(ghosts > 0 && state.mode === "detail")}
			>
				<span id="gcount">{`${ghosts} suggested ${ghosts === 1 ? "node" : "nodes"}`}</span>
				<Button
					className="btn primary"
					id="keepAll"
					type="button"
					onClick={() => keepAll()}
				>
					Keep all
				</Button>
				<Button
					className="btn"
					id="dismissAll"
					type="button"
					onClick={() => dismissAll()}
				>
					Dismiss all
				</Button>
			</div>
		</>
	);
}
