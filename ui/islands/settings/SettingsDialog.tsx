import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { version } from "../../../package.json";
import { MODE } from "../../core/constants.ts";
import { UI } from "../../core/state.ts";
import { useFocus } from "../../hooks/useFocus.ts";
import { useFocusTrap } from "../../hooks/useFocusTrap.ts";
import {
	closeSettings,
	onSettingsKeyDown,
	SETTINGS,
	showTab,
} from "../../shell/settings.ts";
import Mindsets from "../Mindsets.tsx";
import Project from "../Project.tsx";
import AiTab from "./AiTab.tsx";
import BehaviorTab from "./BehaviorTab.tsx";
import DataTab from "./DataTab.tsx";
import GoalTab from "./GoalTab.tsx";
import LibraryTab from "./LibraryTab.tsx";
import LookTab from "./LookTab.tsx";

const tabs: readonly { value: string; label: string; modes?: string }[] = [
	{ value: "ai", label: "AI model" },
	{ value: "goal", label: "Goal & steering" },
	{ value: "behavior", label: "Behavior" },
	{ value: "mindsets", label: "Mindsets" },
	{ value: "look", label: "Appearance" },
	{ value: "library", label: "Library" },
	{ value: "project", label: "Project", modes: "local" },
	{ value: "data", label: "Data", modes: "local web" },
];
export default function SettingsDialog({
	appElement,
}: {
	appElement: RefObject<HTMLDivElement | null>;
}) {
	useEffect(() => {
		window.addEventListener("keydown", onSettingsKeyDown, true);
		return () => window.removeEventListener("keydown", onSettingsKeyDown, true);
	}, []);

	const dialog = useRef<HTMLDivElement>(null);
	const close = useFocus<HTMLButtonElement>("settingsClose");
	const settings = useSnapshot(SETTINGS, { sync: true }),
		shell = useSnapshot(UI, { sync: true });
	useLayoutEffect(() => {
		const app = appElement.current;
		if (!app) return;
		app.inert = !!shell.bye || (settings.open && settings.tab !== "look");
		return () => {
			app.inert = false;
		};
	}, [appElement, shell.bye, settings.open, settings.tab]);
	useFocusTrap(dialog, settings.open && settings.tab !== "look");
	return (
		<>
			<div
				id="settings"
				ref={dialog}
				role="dialog"
				aria-modal="true"
				aria-labelledby="sTitle"
				hidden={!settings.open}
				className={settings.tab === "look" ? "sheet" : ""}
			>
				<div className="sshell">
					<header className="shead">
						<h2 id="sTitle">
							{"Settings "}
							<small id="appVersion">{`v${version}`}</small>
						</h2>
						<button
							className="btn primary"
							id="sClose"
							ref={close}
							type="button"
							onClick={() => closeSettings()}
						>
							{"Done"}
						</button>
					</header>
					<div className="sbody">
						<nav
							className="stabs"
							// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: Preserve the settings tab DOM contract until plan 005.
							role="tablist"
							aria-label="Settings sections"
						>
							{tabs.map((tab) => (
								<button
									key={tab.value}
									type="button"
									role="tab"
									data-tab={tab.value}
									id={tab.value === "library" ? "libTab" : undefined}
									data-modes={tab.modes}
									hidden={
										tab.value === "library"
											? !settings.library
											: tab.value === "project"
												? MODE !== "local"
												: tab.value === "data"
													? !["local", "web"].includes(MODE)
													: false
									}
									aria-selected={settings.tab === tab.value}
									onClick={() => showTab(tab.value)}
								>
									{tab.label}
								</button>
							))}
						</nav>
						<div className="spanes">
							<section
								className="spane"
								id="p-mindsets"
								role="tabpanel"
								hidden={settings.tab !== "mindsets"}
							>
								<div id="mindsetsRoot">
									<Mindsets />
								</div>
							</section>
							<AiTab />
							<GoalTab />
							<LibraryTab />
							<BehaviorTab />
							<LookTab />
							<section
								className="spane"
								id="p-project"
								role="tabpanel"
								hidden={settings.tab !== "project"}
							>
								<div id="projectRoot">
									<Project />
								</div>
							</section>
							<DataTab />
						</div>
					</div>
				</div>
			</div>
			<div id="bye" hidden={!shell.bye}>
				<div className="card">
					<b>Cascade has stopped.</b>
					<p>
						The port is free again. You can close this tab. Run the start script
						to open it again.
					</p>
				</div>
			</div>
		</>
	);
}
