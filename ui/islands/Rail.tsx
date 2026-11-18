import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import {
	ICONS,
	LABEL,
	MOOD_KEYS,
	MOODS,
	PREFS,
} from "../legacy/core/constants.ts";
import { stage } from "../legacy/core/dom.ts";
import { DOMAINS } from "../legacy/core/profiles.ts";
import { UI } from "../legacy/core/state.ts";
import { clearGraph, resetTree } from "../legacy/ui/actions.ts";
import { openCompose, startTileDrag } from "../legacy/ui/compose.ts";
import { openMoreMenu } from "../legacy/ui/responsive.ts";
import { openSettings } from "../legacy/ui/settings.ts";

export default function Rail() {
	const ui = useSnapshot(UI, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true });
	const moods: Record<string, { bg: string; fg: string }> = MOODS;
	const library = ui.library,
		signedIn = library && (library.kind === "local" || library.user),
		current = library?.cascades.find((c) => c.id === library.currentId),
		folder = current?.folderId
			? library?.folders.find((f) => f.id === current.folderId)
			: null;
	return (
		<aside id="rail">
			<h1 className="brand">
				Cascade
				<small>
					Drag a block onto the tree. It finds its place, then grows.
				</small>
			</h1>
			<button
				id="openName"
				className={`openname${current ? "" : " unsaved"}`}
				type="button"
				hidden={!library?.kind || !signedIn}
				title={
					current
						? (folder ? `${folder.name} / ` : "") +
							current.name +
							". Open the library."
						: "This tree is not saved in your library. Open the library to save it."
				}
				onClick={() => openSettings("library")}
			>
				<span className="cf">{folder ? `${folder.name} / ` : ""}</span>
				<span className="cn">
					{current ? current.name : "Not in your library yet"}
				</span>
			</button>
			<div className="tiles" id="tiles">
				{[
					"loop",
					"question",
					"answer",
					"emotion",
					"consequence",
					"decision",
					"fog",
				].map((type) => (
					<button
						className={`tile blk t-${type}`}
						data-type={type}
						type="button"
						key={type}
						onClick={(e) => {
							if (e.detail === 0) {
								const sr = stage.getBoundingClientRect();
								openCompose(
									type,
									sr.left + sr.width / 2,
									sr.top + sr.height / 2,
								);
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
			<div className="rail-foot">
				<Button
					className="btn"
					id="railLib"
					type="button"
					hidden={!library?.kind}
					onClick={() => openSettings("library")}
				>
					Library
				</Button>
				<Button
					className="btn"
					id="resetBtn"
					type="button"
					onClick={() => resetTree()}
				>
					Load example
				</Button>
				<Button
					className="btn"
					id="clearBtn"
					type="button"
					onClick={() => clearGraph()}
				>
					Clear graph
				</Button>
			</div>
		</aside>
	);
}
