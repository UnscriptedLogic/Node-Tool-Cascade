import { useSnapshot } from "valtio";
import { Label } from "@/components/ui/label";
import { MODE, PREFS } from "../../legacy/core/constants.ts";
import { SETTINGS, setPreference } from "../../legacy/shell/settings.ts";
export default function BehaviorTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const prefs = useSnapshot(PREFS, { sync: true });
	return (
		<section
			className="spane"
			id="p-behavior"
			role="tabpanel"
			hidden={settings.tab !== "behavior"}
		>
			<h3>{"Behavior"}</h3>
			<p className="lead">{"How eagerly the tree grows on its own."}</p>
			<div className="field">
				<span className="lbl">{"Layout on small screens"}</span>
				{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented control DOM contract. */}
				<div
					className="seg big"
					id="bLayout"
					role="group"
					aria-label="Layout on small screens"
				>
					{(
						[
							["standard", "Standard"],
							["minimal", "Minimal"],
						] as const
					).map(([value, label]) => (
						<button
							type="button"
							key={value}
							data-val={value}
							aria-pressed={prefs.mobileLayout === value}
							onClick={() => setPreference("mobileLayout", value)}
						>
							{label}
						</button>
					))}
				</div>
				<small id="bLayoutHelp">
					{
						"Standard has a top bar, a block dock and an action strip. Minimal is only the canvas: tap empty space for a menu, or tap a block for its actions. Applies when the screen is narrow."
					}
				</small>
			</div>
			<div className="field">
				<Label className="check">
					<input
						type="checkbox"
						id="bAutoGrow"
						checked={!!prefs.autoGrow}
						onChange={(e) => setPreference("autoGrow", e.currentTarget.checked)}
					/>
					<span>{"Grow branches after I place a block"}</span>
				</Label>
				<small>
					{
						"Off means blocks are only placed. The sparkle button on any node grows it on demand."
					}
				</small>
			</div>
			<div className="field">
				<Label className="check">
					<input
						type="checkbox"
						id="bAutoTrace"
						checked={!!prefs.autoTrace}
						onChange={(e) =>
							setPreference("autoTrace", e.currentTarget.checked)
						}
					/>
					<span>{"Bridge or trace back when I drop an emotion block"}</span>
				</Label>
				<small>
					{
						"Works from the existing tree toward the feeling and back from the feeling to its causes, and starts a grill if the two cannot meet. With little in the tree yet, it only traces back."
					}
				</small>
			</div>
			<div className="field">
				<span className="lbl">{"Growth size"}</span>
				{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented control DOM contract. */}
				<div
					className="seg big"
					id="bSize"
					role="group"
					aria-label="Growth size"
				>
					{(
						[
							["small", "Small"],
							["medium", "Medium"],
							["large", "Large"],
						] as const
					).map(([value, label]) => (
						<button
							type="button"
							key={value}
							data-val={value}
							aria-pressed={prefs.growSize === value}
							onClick={() => setPreference("growSize", value)}
						>
							{label}
						</button>
					))}
				</div>
				<small>{"Roughly 6, 9 or 13 suggested nodes each time."}</small>
			</div>
			<div className="field">
				<Label className="check">
					<input
						type="checkbox"
						id="bPushback"
						checked={!!prefs.pushback}
						onChange={(e) => setPreference("pushback", e.currentTarget.checked)}
					/>
					<span>{"Push back on my answers in a grill"}</span>
				</Label>
				<small>
					{
						"The AI challenges weak or risky answers instead of nodding along. It never writes an answer for you."
					}
				</small>
			</div>
			<div className="field">
				<span className="lbl">{"Grill pace"}</span>
				{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented control DOM contract. */}
				<div
					className="seg big"
					id="bGrill"
					role="group"
					aria-label="Grill pace"
				>
					{(
						[
							["round", "Full round"],
							["single", "One at a time"],
						] as const
					).map(([value, label]) => (
						<button
							type="button"
							key={value}
							data-val={value}
							aria-pressed={prefs.grillStyle === value}
							onClick={() => setPreference("grillStyle", value)}
						>
							{label}
						</button>
					))}
				</div>
				<small>
					{
						"A round shows every question that is ready at once. One at a time shows a single card."
					}
				</small>
			</div>
			<div
				className="field"
				data-modes="local web"
				hidden={!["local", "web"].includes(MODE)}
			>
				<Label htmlFor="bCreative">
					{"Creativity "}
					<output id="bCreativeVal">{(+prefs.creativity).toFixed(2)}</output>
				</Label>
				<input
					type="range"
					id="bCreative"
					min="0"
					max="1"
					step="0.05"
					value={prefs.creativity}
					onChange={(e) => setPreference("creativity", +e.currentTarget.value)}
				/>
				<small>
					{
						"Lower is more predictable, higher is more varied. Placement always runs cool so it stays consistent. Some newer models ignore this."
					}
				</small>
			</div>
		</section>
	);
}
