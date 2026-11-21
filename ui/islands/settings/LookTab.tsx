import { useSnapshot } from "valtio";
import { PREFS } from "../../core/constants.ts";
import { LK } from "../../shell/look-editor.ts";
import { setPreference } from "../../shell/settings.ts";
import { Choice } from "../controls.tsx";
import LookEditor from "../LookEditor.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function LookTab() {
	const look = useSnapshot(LK, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	return (
		<SettingsPane value="look">
			<h3>{"Appearance"}</h3>
			<p className="lead">
				{
					"The theme, and the look of your blocks and wires. Changes show on the canvas as you make them."
				}
			</p>
			<div className="field">
				<span className="lbl">{"Theme"}</span>
				<Choice
					id="aTheme"
					label="Theme"
					items={[
						["system", "System"],
						["light", "Light"],
						["dark", "Dark"],
					]}
					value={prefs.theme}
					onChange={(value) =>
						setPreference("theme", value as typeof prefs.theme)
					}
				/>
			</div>
			<div id="lookRoot">{look.built && <LookEditor />}</div>
		</SettingsPane>
	);
}
