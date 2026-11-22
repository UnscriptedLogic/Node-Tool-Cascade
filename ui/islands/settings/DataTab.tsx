import { useRef } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODE, PREFS } from "../../core/constants.ts";
import { quitCascade } from "../../core/server.ts";
import { onDataAction, SETTINGS, setPreference } from "../../shell/settings.ts";
import { CheckRow } from "../controls.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function DataTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	const fileInput = useRef<HTMLInputElement>(null),
		server = settings.server?.server;
	return (
		<SettingsPane value="data">
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
					<Button
						className="btn"
						id="dExport"
						type="button"
						onClick={() => onDataAction("export")}
					>
						{"Export tree"}
					</Button>
					<Button
						className="btn"
						id="dImport"
						type="button"
						onClick={() => fileInput.current?.click()}
					>
						{"Import tree"}
					</Button>
					<Input
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
				<CheckRow
					id="dStatsOn"
					checked={settings.statsOn}
					onChange={(checked) => onDataAction("stats", checked)}
				>
					<span>{"Count how this site is used"}</span>
				</CheckRow>
				<small>
					{
						"This sends counts only, such as visits, blocks placed or kept, and which AI provider ran. It never sends tree text, prompts, keys or names, and sets no cookies. Do Not Track turns it off. The local app sends nothing."
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
						? `Listening on http://localhost:${server.port}${
								server.port !== server.preferred
									? ` (port ${server.preferred} was busy, so this one was chosen)`
									: ""
							} · process ${server.pid}`
						: ""}
				</small>
				<CheckRow
					id="sQuitClose"
					checked={!!prefs.quitOnClose}
					onChange={(checked) => setPreference("quitOnClose", checked)}
				>
					<span>{"Stop Cascade when I close this tab"}</span>
				</CheckRow>
				<small>
					{
						"Off by default. When on, closing the last Cascade tab stops the server a few seconds later and frees the port, with no terminal needed."
					}
				</small>
				<div className="frow">
					<Button
						className="btn"
						id="sQuit"
						type="button"
						onClick={() => quitCascade()}
					>
						{"Quit Cascade now"}
					</Button>
				</div>
			</div>
			<div className="field">
				<span className="lbl">{"Danger zone"}</span>
				<div className="frow">
					<Button
						className="btn"
						id="dClear"
						type="button"
						onClick={() => onDataAction("clear")}
					>
						{"Clear graph"}
					</Button>
					<Button
						className="btn"
						id="dWipeKeys"
						type="button"
						data-modes="local"
						hidden={!["local"].includes(MODE)}
						onClick={() => onDataAction("wipeKeys")}
					>
						{"Remove all saved keys and sign-ins"}
					</Button>
					<Button
						className="btn"
						id="dForgetKey"
						type="button"
						data-modes="web"
						hidden={!["web"].includes(MODE)}
						onClick={() => onDataAction("forgetKey")}
					>
						{"Forget my OpenRouter key"}
					</Button>
				</div>
				<small>
					{"Clearing the graph can be undone. Forgetting keys can’t."}
				</small>
			</div>
		</SettingsPane>
	);
}
