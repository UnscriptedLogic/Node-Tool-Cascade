import { CircleHelp, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { nodeActions } from "../canvas/layout.ts";
import { setMode } from "../canvas/view.ts";
import { ACT, CONNECTION, LOCAL, PREFS, WEB } from "../core/constants.ts";
import { stage } from "../core/dom.ts";
import { AI, hist, S, UI } from "../core/state.ts";
import { isOuter } from "../core/tree.ts";
import { clearAskHighlight } from "../features/ask.ts";
import { seedFromProject } from "../features/project.ts";
import { dismissAll, keepAll, undo } from "../shell/actions.ts";
import { fitCanvas, stopCanvasAI, zoomCanvas } from "../shell/controls.ts";
import { RAIL } from "../shell/rail.ts";
import { runNodeAction, SHORT } from "../shell/responsive.ts";
import { openSettings } from "../shell/settings.ts";
import { RailLauncher } from "./Rail.tsx";
import { SideLauncher } from "./SidePanel.tsx";

export default function Hud() {
	const [tipOpen, setTipOpen] = useState(false);
	const rail = useSnapshot(RAIL, { sync: true });
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
	const providerLabel = ui.providerLabels[String(connection.server?.active)],
		effectiveModel =
			connection.server?.providers?.[String(connection.server.active)]
				?.effectiveModel;
	const panelOpen = !!ui.panel?.open;
	const ghosts = Object.values(state.nodes).filter((n) => n.ghost).length,
		ask = ui.ask;
	const highlighted = ask?.threads.some(
		(thread) => thread.on && thread.ids.some((id) => state.nodes[id]),
	);
	const node = state.nodes[String(state.sel)],
		showBar = !!(
			node &&
			ui.small &&
			!ui.minimal &&
			(state.mode !== "outer" || isOuter(node))
		);
	const hasKids =
		!!node && Object.values(state.nodes).some((n) => n.parent === node.id);
	// Bridge availability also depends on other nodes in the tree.
	const actions = useMemo(
		() => (showBar ? nodeActions(node, hasKids) : []),
		[
			showBar,
			state.mode,
			state.layer,
			state.mindsets.length,
			state.nodes,
			state.order,
			prefs.domain,
			node,
			hasKids,
		],
	);

	useLayoutEffect(() => {
		stage?.classList.toggle("nb", showBar);
	}, [showBar]);
	const barSignature = showBar
		? `${state.sel}|${actions.map((action) => `${action[0]}${action[1]}`).join()}`
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
			<div id="hudTL" className="hud">
				{!ui.small && !rail.desktop && <RailLauncher />}
				<div
					id="status"
					className={`pill${ui.busy ? " busy" : " idle"}`}
					role="status"
				>
					{ui.busy ? (
						<>
							<span className="dot" />
							<span id="stxt">{ui.busy}</span>
						</>
					) : (
						<Tooltip open={tipOpen} onOpenChange={setTipOpen}>
							<TooltipTrigger asChild>
								<button
									className="helpbtn"
									id="helpBtn"
									type="button"
									aria-label="How to use the canvas"
									onClick={(event) => {
										// A tap shows the tip too, so touch screens can read it.
										event.preventDefault();
										setTipOpen(true);
									}}
								>
									<CircleHelp aria-hidden="true" />
								</button>
							</TooltipTrigger>
							<TooltipContent
								id="helpTip"
								className="cui tip"
								side="bottom"
								align="start"
								sideOffset={6}
							>
								{idle}
							</TooltipContent>
						</Tooltip>
					)}
					<button
						className="linkbtn"
						id="setLink"
						type="button"
						hidden={
							!(
								(LOCAL || WEB) &&
								ai.checked &&
								!ui.busy &&
								(!available || demo)
							)
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
				<div
					id="provchip"
					className="pill"
					hidden={!((LOCAL || connection.cloud) && providerLabel)}
				>
					<span className="pt" title="Current AI provider">
						{`${providerLabel?.replace(/\s*\(.*\)$/, "")}${effectiveModel ? ` · ${effectiveModel}` : ""}`}
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
					className="pill"
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
			</div>
			<div id="ctrl" className="hud">
				<ButtonGroup id="historyGroup" className="bgroup" aria-label="History">
					<Button
						className="btn iconbtn"
						id="undoBtn"
						type="button"
						aria-label="Undo"
						title="Undo (Ctrl+Z)"
						aria-keyshortcuts="Control+Z Meta+Z"
						disabled={!history.length}
						onClick={() => undo()}
					>
						<Undo2 aria-hidden="true" />
					</Button>
					<Button
						className="btn iconbtn"
						id="redoBtn"
						type="button"
						aria-label="Redo"
						title="Redo"
						disabled
					>
						<Redo2 aria-hidden="true" />
					</Button>
				</ButtonGroup>
				<ButtonGroup id="zoomGroup" className="bgroup" aria-label="Zoom">
					<Button
						className="btn iconbtn"
						id="zOut"
						type="button"
						aria-label="Zoom out"
						title="Zoom out"
						onClick={() => zoomCanvas(0.8)}
					>
						<Minus aria-hidden="true" />
					</Button>
					<Button
						className="btn fitbtn"
						id="zFit"
						type="button"
						aria-label="Fit to screen"
						title="Fit to screen"
						onClick={() => fitCanvas()}
					>
						Fit
					</Button>
					<Button
						className="btn iconbtn"
						id="zIn"
						type="button"
						aria-label="Zoom in"
						title="Zoom in"
						onClick={() => zoomCanvas(1.25)}
					>
						<Plus aria-hidden="true" />
					</Button>
				</ButtonGroup>
				<ToggleGroup
					type="single"
					id="viewToggle"
					className="seg"
					aria-label="View"
					value={state.mode}
					onValueChange={(value) => {
						// Clicking the active view again keeps it selected.
						if (value === "detail" || value === "outer") setMode(value);
					}}
				>
					<ToggleGroupItem value="detail" id="mDetail">
						Detail
					</ToggleGroupItem>
					<ToggleGroupItem value="outer" id="mOuter">
						Loops
					</ToggleGroupItem>
				</ToggleGroup>
				{!panelOpen && <SideLauncher />}
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
