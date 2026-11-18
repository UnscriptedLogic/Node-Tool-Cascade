import { useSnapshot } from "valtio";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocus } from "../../hooks/useFocus.ts";
import { PREFS } from "../../legacy/core/constants.ts";
import { DOMAINS } from "../../legacy/core/profiles.ts";
import {
	SETTINGS,
	STEER_HELP,
	setPreference,
} from "../../legacy/ui/settings.ts";
export default function GoalTab() {
	const goal = useFocus<HTMLTextAreaElement>("goal");
	const settings = useSnapshot(SETTINGS, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	const domain = DOMAINS[prefs.domain] || DOMAINS.general;
	return (
		<section
			className="spane"
			id="p-goal"
			role="tabpanel"
			hidden={settings.tab !== "goal"}
		>
			<h3>{"Goal & steering"}</h3>
			<div className="field">
				<Label htmlFor="gDomain">{"What is this tree about?"}</Label>
				<select
					id="gDomain"
					value={prefs.domain}
					onChange={(e) => {
						const value = e.currentTarget.value;
						if (
							value === "general" ||
							value === "game" ||
							value === "product" ||
							value === "research"
						)
							setPreference("domain", value);
					}}
				>
					{Object.entries(DOMAINS).map(([key, value]) => (
						<option key={key} value={key}>
							{value.label}
						</option>
					))}
				</select>
				<small id="gDomainHelp">
					{domain.blurb +
						" This sets the words the AI uses and the example tree. Your blocks stay as they are."}
				</small>
			</div>
			<p className="lead">
				{
					"Say what this tree is for. Every placement, branch and trace-back is written with it in mind, so the questions lean toward your goal instead of wandering."
				}
			</p>
			<div className="field">
				<Label htmlFor="gGoal">{"Overarching goal"}</Label>
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
						<button
							key={goal}
							type="button"
							className="chip"
							onClick={() => setPreference("goal", goal)}
						>
							{goal}
						</button>
					))}
				</div>
			</div>
			<div className="field">
				<span className="lbl">{"Steering"}</span>
				{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented control DOM contract. */}
				<div
					className="seg big"
					id="gSteer"
					role="group"
					aria-label="Steering strength"
				>
					{(
						[
							["light", "Light"],
							["balanced", "Balanced"],
							["strong", "Strong"],
						] as const
					).map(([value, label]) => (
						<button
							type="button"
							key={value}
							data-val={value}
							aria-pressed={prefs.steer === value}
							onClick={() => setPreference("steer", value)}
						>
							{label}
						</button>
					))}
				</div>
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
				<Label htmlFor="gAvoid">{"Avoid"}</Label>
				<Textarea
					id="gAvoid"
					rows={2}
					maxLength={800}
					placeholder={domain.avoidPlaceholder || ""}
					value={prefs.avoid || ""}
					onChange={(e) => setPreference("avoid", e.currentTarget.value)}
				/>
			</div>
			<details className="card">
				<summary>{"What the AI is told"}</summary>
				<pre id="gPreview">{settings.preview}</pre>
			</details>
		</section>
	);
}
