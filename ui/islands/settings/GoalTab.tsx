import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PREFS } from "../../core/constants.ts";
import { DOMAINS } from "../../core/profiles.ts";
import { useFocus } from "../../hooks/useFocus.ts";
import { SETTINGS, STEER_HELP, setPreference } from "../../shell/settings.ts";
import { Choice, Disclosure, SelectField } from "../controls.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function GoalTab() {
	const goal = useFocus<HTMLTextAreaElement>("goal");
	const settings = useSnapshot(SETTINGS, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	const domain = DOMAINS[prefs.domain] || DOMAINS.general;
	return (
		<SettingsPane value="goal">
			<h3>Goal &amp; steering</h3>
			<div className="field">
				<Label htmlFor="gDomain">What is this tree about?</Label>
				<SelectField
					id="gDomain"
					value={prefs.domain}
					options={Object.entries(DOMAINS).map(([key, value]) => [
						key,
						value.label,
					])}
					onChange={(value) => {
						if (
							value === "general" ||
							value === "game" ||
							value === "product" ||
							value === "research"
						)
							setPreference("domain", value);
					}}
				/>
				<small id="gDomainHelp">
					{`${domain.blurb} This sets the words the AI uses and the example tree. Your blocks stay as they are.`}
				</small>
			</div>
			<div className="field">
				<Label htmlFor="gGoal">Overarching goal</Label>
				<Textarea
					id="gGoal"
					ref={goal}
					rows={3}
					maxLength={600}
					placeholder={domain.goalPlaceholder || ""}
					value={prefs.goal || ""}
					onChange={(e) => setPreference("goal", e.currentTarget.value)}
				/>
				<div className="chips" id="gChips">
					{domain.goalChips.map((goal) => (
						<Button
							key={goal}
							type="button"
							variant="ghost"
							className="chip"
							onClick={() => setPreference("goal", goal)}
						>
							{goal}
						</Button>
					))}
				</div>
			</div>
			<div className="field">
				<span className="lbl">Steering</span>
				<Choice
					id="gSteer"
					label="Steering strength"
					items={[
						["light", "Light"],
						["balanced", "Balanced"],
						["strong", "Strong"],
					]}
					value={prefs.steer}
					onChange={(value) =>
						setPreference("steer", value as typeof prefs.steer)
					}
				/>
				<small id="steerHelp">{STEER_HELP[prefs.steer] || ""}</small>
			</div>
			<div className="field">
				<Label htmlFor="gContext">{domain.contextLabel || ""}</Label>
				<Textarea
					id="gContext"
					rows={3}
					maxLength={1200}
					placeholder={domain.contextPlaceholder || ""}
					value={prefs.context || ""}
					onChange={(e) => setPreference("context", e.currentTarget.value)}
				/>
				<small>{domain.contextHint || ""}</small>
			</div>
			<div className="field">
				<Label htmlFor="gPillars">{domain.pillarsLabel || ""}</Label>
				<Textarea
					id="gPillars"
					rows={3}
					maxLength={1200}
					placeholder={domain.pillarsPlaceholder || ""}
					value={prefs.pillars || ""}
					onChange={(e) => setPreference("pillars", e.currentTarget.value)}
				/>
				<small>{domain.pillarsHint || ""}</small>
			</div>
			<div className="field">
				<Label htmlFor="gAvoid">Avoid</Label>
				<Textarea
					id="gAvoid"
					rows={2}
					maxLength={800}
					placeholder={domain.avoidPlaceholder || ""}
					value={prefs.avoid || ""}
					onChange={(e) => setPreference("avoid", e.currentTarget.value)}
				/>
			</div>
			<Disclosure className="card" title="What the AI is told">
				<pre id="gPreview">{settings.preview}</pre>
			</Disclosure>
		</SettingsPane>
	);
}
