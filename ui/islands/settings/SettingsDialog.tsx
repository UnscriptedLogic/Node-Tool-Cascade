import { Dialog as DialogPrimitive } from "radix-ui";
import { type RefObject, useLayoutEffect } from "react";
import { useSnapshot } from "valtio";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { version } from "../../../package.json";
import { MODE } from "../../core/constants.ts";
import { UI } from "../../core/state.ts";
import { SV } from "../../features/project.ts";
import { useFocus } from "../../hooks/useFocus.ts";
import {
	closeSettings,
	restoreSettingsFocus,
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
	const close = useFocus<HTMLButtonElement>("settingsClose");
	const settings = useSnapshot(SETTINGS, { sync: true }),
		shell = useSnapshot(UI, { sync: true });
	// Only the stopped-app screen blocks the app outside a dialog.
	useLayoutEffect(() => {
		const app = appElement.current;
		if (!app) return;
		app.inert = !!shell.bye;
		return () => {
			app.inert = false;
		};
	}, [appElement, shell.bye]);
	return (
		<>
			<Dialog
				open={settings.open}
				onOpenChange={(open) => {
					if (!open) closeSettings();
				}}
			>
				<DialogContent
					id="settings"
					className="cui"
					showCloseButton={false}
					aria-labelledby="sTitle"
					aria-describedby={undefined}
					overlayProps={{ id: "settingsBack" }}
					onOpenAutoFocus={(event) => {
						// The opener asked for a field (the goal) or the close button.
						event.preventDefault();
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						restoreSettingsFocus();
					}}
					onEscapeKeyDown={(event) => {
						// The source viewer closes on its own first.
						if (SV.open) event.preventDefault();
					}}
				>
					<div className="sshell">
						<header className="shead">
							<DialogPrimitive.Title asChild>
								<h2 id="sTitle">
									{"Settings "}
									<small id="appVersion">{`v${version}`}</small>
								</h2>
							</DialogPrimitive.Title>
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
				</DialogContent>
			</Dialog>
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
