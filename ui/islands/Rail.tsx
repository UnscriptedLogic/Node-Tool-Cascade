import {
	ChevronUp,
	FolderOpen,
	LayoutTemplate,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Trash2,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ICONS, LABEL, MOOD_KEYS, MOODS, PREFS } from "../core/constants.ts";
import { stage } from "../core/dom.ts";
import { DOMAINS } from "../core/profiles.ts";
import { UI } from "../core/state.ts";
import { useFocus } from "../hooks/useFocus.ts";
import { openCompose, startTileDrag } from "../shell/compose.ts";
import {
	acceptConfirm,
	askConfirm,
	CONFIRM,
	cancelConfirm,
	confirmReturnTarget,
} from "../shell/confirm.ts";
import { RAIL, setRailOpen } from "../shell/rail.ts";
import { openMoreMenu } from "../shell/responsive.ts";
import { openSettings, setPreference } from "../shell/settings.ts";

const TILE_TYPES = [
	"loop",
	"question",
	"answer",
	"emotion",
	"consequence",
	"decision",
	"fog",
];

function Tiles() {
	return (
		<div className="tiles" id="tiles" data-vaul-no-drag="">
			{TILE_TYPES.map((type) => (
				<button
					className={`tile blk t-${type}`}
					data-type={type}
					type="button"
					key={type}
					onClick={(e) => {
						if (e.detail === 0) {
							const sr = stage.getBoundingClientRect();
							openCompose(type, sr.left + sr.width / 2, sr.top + sr.height / 2);
						}
					}}
					onPointerDown={(e) => startTileDrag(e, type)}
				>
					<span
						className="ico"
						dangerouslySetInnerHTML={{ __html: ICONS[type] }}
					/>
					<span className="txt">{LABEL[type]}</span>
				</button>
			))}
		</div>
	);
}

// The open Cascade's name. It only shows where you are; the icon beside it opens the Library.
function LibraryTitle() {
	const { library } = useSnapshot(UI, { sync: true });
	if (!library?.kind) return null;
	const signedIn = library.kind === "local" || !!library.user,
		current = signedIn
			? library.cascades.find((c) => c.id === library.currentId)
			: null,
		folder = current?.folderId
			? library.folders.find((f) => f.id === current.folderId)
			: null,
		prefix = folder ? `${folder.name} / ` : "",
		name = current
			? current.name
			: signedIn
				? "Not in your library yet"
				: "Sign in to use your library";
	return (
		<div className="librow">
			<span
				id="openName"
				className={`openname${current ? "" : " unsaved"}`}
				title={prefix + name}
			>
				<span className="cf">{prefix}</span>
				<span className="cn">{name}</span>
			</span>
			<Button
				className="btn iconbtn"
				id="libOpen"
				type="button"
				size="icon-sm"
				aria-label="Open library"
				title="Open library"
				onClick={() => openSettings("library")}
			>
				<FolderOpen aria-hidden="true" />
			</Button>
		</div>
	);
}

// The goal shows in the sidebar and is edited in its own small dialog.
function GoalField() {
	const prefs = useSnapshot(PREFS, { sync: true });
	const [open, setOpen] = useState(false),
		[draft, setDraft] = useState("");
	const goal = (prefs.goal || "").trim();
	const save = () => {
		setPreference("goal", draft.trim());
		setOpen(false);
	};
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) setDraft(PREFS.goal || "");
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<button
					id="goalchip"
					className={`goalentry${goal ? "" : " unset"}`}
					type="button"
					title={goal || "Set a goal to steer the questions"}
				>
					<span className="gl">Goal & steering</span>
					<span className="gt">{goal || "No goal set"}</span>
				</button>
			</DialogTrigger>
			<DialogContent
				id="goalDialog"
				className="cui"
				overlayProps={{ id: "goalBack" }}
			>
				<DialogHeader>
					<DialogTitle>Goal</DialogTitle>
					<DialogDescription>
						What should this tree get you to? The AI measures every question
						against it.
					</DialogDescription>
				</DialogHeader>
				<textarea
					id="goalInput"
					className="area"
					rows={4}
					maxLength={600}
					placeholder="For example: decide whether the game needs a glide ability"
					value={draft}
					onChange={(e) => setDraft(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							save();
						}
					}}
				/>
				<DialogFooter className="goalfoot">
					<button
						className="linkbtn"
						id="goalMore"
						type="button"
						onClick={() => {
							setOpen(false);
							openSettings("goal");
						}}
					>
						More steering in Settings
					</button>
					<DialogClose asChild>
						<Button className="btn" id="goalCancel" type="button">
							Cancel
						</Button>
					</DialogClose>
					<Button
						className="btn primary"
						id="goalSave"
						type="button"
						onClick={save}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RailBody({ tiles }: { tiles: boolean }) {
	const settingsButton = useFocus<HTMLButtonElement>("settingsButton");
	const ui = useSnapshot(UI, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true });
	const moods: Record<string, { bg: string; fg: string }> = MOODS;
	return (
		<>
			<div className="railhead">
				<div className="brandrow">
					<DialogPrimitive.Title asChild>
						<h1 className="brand">Cascade</h1>
					</DialogPrimitive.Title>
					<Button
						className="btn iconbtn"
						id="railClose"
						type="button"
						size="icon-sm"
						aria-label="Close sidebar"
						title="Close sidebar"
						onClick={() => setRailOpen(false)}
					>
						<PanelLeftClose aria-hidden="true" />
					</Button>
				</div>
				<LibraryTitle />
				<GoalField />
			</div>
			{tiles && (
				<section className="blocksec" aria-labelledby="blocksHead">
					<h2 id="blocksHead">Blocks</h2>
					<Tiles />
				</section>
			)}
			<div className="legend">
				<h2 data-dom-text="feeling">
					{(DOMAINS[prefs.domain] || DOMAINS.general).feeling}
				</h2>
				<ul id="legend">
					{MOOD_KEYS.map((key) => (
						<li key={key}>
							<i style={{ "--c": ui.moodColors[key] || moods[key].bg }} />
							{key[0].toUpperCase() + key.slice(1)}
						</li>
					))}
				</ul>
			</div>
			<div className="rail-foot">
				<Button
					className="btn iconbtn"
					id="setBtn"
					ref={settingsButton}
					type="button"
					size="icon-sm"
					aria-label="Settings"
					title={ui.settingsTitle}
					onClick={() => openSettings()}
				>
					<Settings aria-hidden="true" />
				</Button>
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button className="btn" id="railActions" type="button">
							Actions
							<ChevronUp aria-hidden="true" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						id="railActionsMenu"
						className="cui"
						side="top"
						align="start"
					>
						<DropdownMenuItem
							id="resetBtn"
							onSelect={() =>
								askConfirm("load-example", undefined, "railActions")
							}
						>
							<LayoutTemplate aria-hidden="true" />
							Load example
						</DropdownMenuItem>
						<DropdownMenuItem
							id="clearBtn"
							variant="destructive"
							onSelect={() =>
								askConfirm("clear-graph", undefined, "railActions")
							}
						>
							<Trash2 aria-hidden="true" />
							Clear graph
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	);
}

// Closing the sidebar moves focus to the control that brings it back.
function focusLauncher(event: Event) {
	event.preventDefault();
	requestAnimationFrame(() => document.getElementById("railOpen")?.focus());
}

function DesktopRail({ open }: { open: boolean }) {
	return (
		<DialogPrimitive.Root
			modal={false}
			open={open}
			// Only the sidebar's own close button closes it on desktop.
			onOpenChange={(next) => {
				if (next) setRailOpen(true);
			}}
		>
			<DialogPrimitive.Content
				asChild
				aria-describedby={undefined}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={focusLauncher}
				onInteractOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => event.preventDefault()}
			>
				<aside id="rail" data-slot="drawer-content">
					<RailBody tiles />
				</aside>
			</DialogPrimitive.Content>
		</DialogPrimitive.Root>
	);
}

function MobileRail({ open }: { open: boolean }) {
	return (
		<Drawer
			direction="left"
			open={open}
			onOpenChange={(next) => setRailOpen(next)}
		>
			<DrawerContent
				id="rail"
				className="cui"
				aria-describedby={undefined}
				onCloseAutoFocus={focusLauncher}
			>
				<RailBody tiles={false} />
			</DrawerContent>
		</Drawer>
	);
}

export function RailLauncher({ children }: { children?: ReactNode }) {
	return (
		<Button
			className="btn"
			id="railOpen"
			type="button"
			aria-label="Open sidebar"
			title="Open sidebar"
			onPointerDown={(e) => e.stopPropagation()}
			onClick={() => setRailOpen(true)}
		>
			<PanelLeftOpen aria-hidden="true" />
			{children}
		</Button>
	);
}

// Small screens in the standard layout keep a dock of blocks along the bottom.
function Dock() {
	return (
		<nav id="dock" aria-label="Blocks">
			<RailLauncher>
				<span>Sidebar</span>
			</RailLauncher>
			<Tiles />
			<button
				id="moreBtn"
				className="more"
				type="button"
				aria-label="More: menu"
				onPointerDown={(e) => e.stopPropagation()}
				onClick={() => openMoreMenu()}
			>
				<svg
					viewBox="0 0 16 16"
					width="18"
					height="18"
					fill="currentColor"
					aria-hidden="true"
				>
					<circle cx="3" cy="8" r="1.4" />
					<circle cx="8" cy="8" r="1.4" />
					<circle cx="13" cy="8" r="1.4" />
				</svg>
				<span>More</span>
			</button>
		</nav>
	);
}

export function GraphConfirm() {
	const { pending } = useSnapshot(CONFIRM, { sync: true });
	// Keep the wording of the last action while the dialog fades out.
	const shown = useRef(pending);
	if (pending) shown.current = pending;
	const example = shown.current === "load-example";
	return (
		<AlertDialog
			open={!!pending}
			onOpenChange={(open) => {
				if (!open) cancelConfirm();
			}}
		>
			<AlertDialogContent
				id="confirm"
				className="cui"
				onCloseAutoFocus={(event) => {
					const target = confirmReturnTarget();
					const el = target && document.getElementById(target);
					if (!el) return;
					event.preventDefault();
					el.focus();
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{example ? "Load the example?" : "Clear the graph?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{example
							? "This replaces the current graph with the example tree. You can undo it."
							: "This removes every block and link from the current graph. You can undo it."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="btn" id="confirmCancel">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						className="btn primary"
						id="confirmAction"
						onClick={() => acceptConfirm()}
					>
						{example ? "Load example" : "Clear graph"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export default function Rail() {
	const ui = useSnapshot(UI, { sync: true }),
		rail = useSnapshot(RAIL, { sync: true });
	if (!ui.small) return <DesktopRail open={rail.desktop} />;
	return (
		<>
			{!ui.minimal && <Dock />}
			<MobileRail open={rail.mobile} />
		</>
	);
}
