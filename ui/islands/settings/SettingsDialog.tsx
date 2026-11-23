import { Dialog as DialogPrimitive, Tabs } from "radix-ui";
import { type RefObject, useLayoutEffect } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
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
import Project from "../Project.tsx";
import AiTab from "./AiTab.tsx";
import BehaviorTab from "./BehaviorTab.tsx";
import DataTab from "./DataTab.tsx";
import GoalTab from "./GoalTab.tsx";
import LibraryTab from "./LibraryTab.tsx";
import LookTab from "./LookTab.tsx";
import MindsetsTab from "./MindsetsTab.tsx";
import SettingsPane, { tabId } from "./SettingsPane.tsx";

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
					className="cui top-1/2 left-1/2 z-80 flex h-[min(780px,calc(100dvh-2rem))] w-[min(1040px,calc(100vw-2rem))] max-w-none -translate-1/2 flex-col gap-0 overflow-hidden rounded-[14px] border-line bg-(--bg) p-0 text-ink shadow-[0_24px_60px_rgb(0_0_0/0.3)] outline-none! sm:max-w-none"
					showCloseButton={false}
					aria-labelledby="sTitle"
					aria-describedby={undefined}
					overlayProps={{
						id: "settingsBack",
						className: "z-79 bg-[#080e1a]/35 backdrop-blur-[6px]",
					}}
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
					<div className="flex size-full min-h-0 flex-col">
						<header className="flex items-center justify-between border-b border-line px-6.5 py-4.5 settings-narrow:px-4 settings-narrow:pb-3 settings-narrow:pt-[calc(0.75rem+env(safe-area-inset-top))]">
							<DialogPrimitive.Title asChild>
								<h2
									id="sTitle"
									className="m-0 text-[23px] font-extrabold tracking-[-0.03em]"
								>
									Settings&#32;
									<small id="appVersion">{`v${version}`}</small>
								</h2>
							</DialogPrimitive.Title>
							<Button
								className="btn primary"
								id="sClose"
								ref={close}
								type="button"
								onClick={() => closeSettings()}
							>
								Done
							</Button>
						</header>
						<Tabs.Root
							className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] settings-narrow:grid-cols-1 settings-narrow:grid-rows-[auto_minmax(0,1fr)]"
							orientation="vertical"
							value={settings.tab}
							onValueChange={(value) => showTab(value)}
						>
							<Tabs.List
								className="stabs flex flex-col items-stretch justify-start gap-1 border-r border-line bg-(--paper2) px-3 py-4 settings-narrow:flex-row settings-narrow:overflow-x-auto settings-narrow:border-r-0 settings-narrow:border-b settings-narrow:p-2.5 settings-narrow:[scrollbar-width:none]"
								aria-label="Settings sections"
							>
								{tabs.map((tab) => (
									<Tabs.Trigger
										key={tab.value}
										value={tab.value}
										data-tab={tab.value}
										className="inline-flex h-(--control-h) flex-none items-center justify-start rounded-[9px] border-0 bg-transparent px-3 py-2.25 text-left text-sm! text-ink2! aria-[selected=false]:hover:bg-paper aria-[selected=false]:hover:text-ink! aria-selected:bg-ink aria-selected:text-(--bg)! settings-narrow:whitespace-nowrap"
										id={tabId(tab.value)}
										aria-controls={`p-${tab.value}`}
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
										// Radix switches on pointer down; a plain click does too.
										onClick={() => showTab(tab.value)}
									>
										{tab.label}
									</Tabs.Trigger>
								))}
							</Tabs.List>
							<div className="overflow-y-auto px-7.5 pt-6.5 pb-17.5 settings-narrow:px-4 settings-narrow:pt-5 settings-narrow:pb-[calc(4.375rem+env(safe-area-inset-bottom))]">
								<MindsetsTab />
								<AiTab />
								<GoalTab />
								<LibraryTab />
								<BehaviorTab />
								<LookTab />
								<SettingsPane value="project">
									<div id="projectRoot">
										<Project />
									</div>
								</SettingsPane>
								<DataTab />
							</div>
						</Tabs.Root>
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
