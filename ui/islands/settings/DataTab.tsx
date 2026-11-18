import { useRef } from "react";
import { useSnapshot } from "valtio";
import { Label } from "@/components/ui/label";
import { MODE, PREFS } from "../../legacy/core/constants.ts";
import { quitCascade } from "../../legacy/core/server.ts";
import {
	onDataAction,
	SETTINGS,
	setPreference,
} from "../../legacy/shell/settings.ts";
export default function DataTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	const fileInput = useRef<HTMLInputElement>(null),
		server = settings.server?.server;
	return (
		<section
			className="spane"
			id="p-data"
			role="tabpanel"
			hidden={settings.tab !== "data"}
		>
			<h3>{"Data"}</h3>
			<p className="lead" data-modes="local" hidden={!["local"].includes(MODE)}>
				{"Your tree and settings live in the folder next to "}
				<code>{"server.ts"}</code>
				{" as "}
				<code>{"tree.json"}</code>
				{" and "}
				<code>{"settings.json"}</code>
				{"."}
			</p>
			<p className="lead" data-modes="web" hidden={!["web"].includes(MODE)}>
				{
					"Your tree and settings are saved in this browser. Export the tree to keep a copy or move it somewhere else."
				}
			</p>
			<div className="field">
				<span className="lbl">{"Tree"}</span>
				<div className="frow">
					<button
						className="btn"
						id="dExport"
						type="button"
						onClick={() => onDataAction("export")}
					>
						{"Export tree"}
					</button>
					<button
						className="btn"
						id="dImport"
						type="button"
						onClick={() => fileInput.current?.click()}
					>
						{"Import tree"}
					</button>
					<input
						type="file"
						id="dFile"
						accept="application/json,.json"
						hidden={true}
						ref={fileInput}
						onChange={async (event) => {
							const input = event.currentTarget;
							await onDataAction("import", input.files?.[0]);
							input.value = "";
						}}
					/>
				</div>
				<small id="dMsg">{settings.dataMessage}</small>
			</div>
			<div className="field" id="dStats" hidden={!settings.analytics}>
				<span className="lbl">{"Anonymous usage counts"}</span>
				<Label className="check">
					<input
						type="checkbox"
						id="dStatsOn"
						checked={settings.statsOn}
						onChange={(e) => onDataAction("stats", e.currentTarget.checked)}
					/>
					<span>{"Count how this site is used"}</span>
				</Label>
				<small>
					{
						"Counts only, such as visits, blocks placed or kept, and which AI provider was used. No tree text, prompts, keys or names, and no cookies. Do Not Track turns it off automatically. The local app sends nothing."
					}
				</small>
			</div>
			<div
				className="field"
				data-modes="local"
				hidden={!["local"].includes(MODE)}
			>
				<span className="lbl">{"Server"}</span>
				<small id="sInfo">
					{server
						? `Listening on http://localhost:${server.port}` +
							(server.port !== server.preferred
								? ` (port ${server.preferred} was busy, so this one was chosen)`
								: "") +
							` · process ${server.pid}`
						: ""}
				</small>
				<Label className="check">
					<input
						type="checkbox"
						id="sQuitClose"
						checked={!!prefs.quitOnClose}
						onChange={(e) =>
							setPreference("quitOnClose", e.currentTarget.checked)
						}
					/>
					<span>{"Stop Cascade when I close this tab"}</span>
				</Label>
				<small>
					{
						"Off by default. When on, closing the last Cascade tab shuts the server down a few seconds later, so the port is freed without opening a terminal."
					}
				</small>
				<div className="frow">
					<button
						className="btn"
						id="sQuit"
						type="button"
						onClick={() => quitCascade()}
					>
						{"Quit Cascade now"}
					</button>
				</div>
			</div>
			<div className="field">
				<span className="lbl">{"Danger zone"}</span>
				<div className="frow">
					<button
						className="btn"
						id="dClear"
						type="button"
						onClick={() => onDataAction("clear")}
					>
						{"Clear graph"}
					</button>
					<button
						className="btn"
						id="dWipeKeys"
						type="button"
						data-modes="local"
						hidden={!["local"].includes(MODE)}
						onClick={() => onDataAction("wipeKeys")}
					>
						{"Remove all saved keys and sign-ins"}
					</button>
					<button
						className="btn"
						id="dForgetKey"
						type="button"
						data-modes="web"
						hidden={!["web"].includes(MODE)}
						onClick={() => onDataAction("forgetKey")}
					>
						{"Forget my OpenRouter key"}
					</button>
				</div>
				<small>
					{"Clearing the graph can be undone. Forgetting keys can’t."}
				</small>
			</div>
		</section>
	);
}
