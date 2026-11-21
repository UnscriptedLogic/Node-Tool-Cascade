import { useSnapshot } from "valtio";
import { PREFS } from "../../core/constants.ts";
import { LK } from "../../shell/look-editor.ts";
import { SETTINGS, setPreference } from "../../shell/settings.ts";
import LookEditor from "../LookEditor.tsx";
export default function LookTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const look = useSnapshot(LK, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	return (
		<section
			className="spane"
			id="p-look"
			role="tabpanel"
			hidden={settings.tab !== "look"}
		>
			<h3>{"Appearance"}</h3>
			<p className="lead">
				{
					"The theme, and the look of your blocks and wires. Changes show on the canvas as you make them."
				}
			</p>
			<div className="field">
				<span className="lbl">{"Theme"}</span>
				{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented control DOM contract. */}
				<div className="seg big" id="aTheme" role="group" aria-label="Theme">
					{(
						[
							["system", "System"],
							["light", "Light"],
							["dark", "Dark"],
						] as const
					).map(([value, label]) => (
						<button
							type="button"
							key={value}
							data-val={value}
							aria-pressed={prefs.theme === value}
							onClick={() => setPreference("theme", value)}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			<div id="lookRoot">{look.built && <LookEditor />}</div>
		</section>
	);
}
