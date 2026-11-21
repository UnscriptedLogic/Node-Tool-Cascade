import { useSnapshot } from "valtio";
import { Slider } from "@/components/ui/slider";
import { MODE, PREFS } from "../../core/constants.ts";
import { setPreference } from "../../shell/settings.ts";
import { CheckRow, Choice } from "../controls.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function BehaviorTab() {
	const prefs = useSnapshot(PREFS, { sync: true });
	return (
		<SettingsPane value="behavior">
			<h3>{"Behavior"}</h3>
			<p className="lead">{"How much the AI adds to the tree on its own."}</p>
			<div className="field">
				<span className="lbl">{"Layout on small screens"}</span>
				<Choice
					id="bLayout"
					label="Layout on small screens"
					items={[
						["standard", "Standard"],
						["minimal", "Minimal"],
					]}
					value={prefs.mobileLayout}
					onChange={(value) =>
						setPreference("mobileLayout", value as typeof prefs.mobileLayout)
					}
				/>
				<small id="bLayoutHelp">
					{
						"Standard has a top bar, a block dock and an action strip. Minimal shows only the canvas. Tap empty space for a menu, or tap a block for its actions. This applies when the screen is narrow."
					}
				</small>
			</div>
			<div className="field">
				<CheckRow
					id="bAutoGrow"
					checked={!!prefs.autoGrow}
					onChange={(checked) => setPreference("autoGrow", checked)}
				>
					<span>{"Grow branches after I place a block"}</span>
				</CheckRow>
				<small>
					{
						"Off means blocks are only placed. The sparkle button on any node grows it on demand."
					}
				</small>
			</div>
			<div className="field">
				<CheckRow
					id="bAutoTrace"
					checked={!!prefs.autoTrace}
					onChange={(checked) => setPreference("autoTrace", checked)}
				>
					<span>{"Bridge or trace back when I drop an emotion block"}</span>
				</CheckRow>
				<small>
					{
						"The AI works from the tree toward the feeling, and from the feeling back to its causes. If the two can’t meet, it starts a grill. While the tree is small, it only traces back."
					}
				</small>
			</div>
			<div className="field">
				<span className="lbl">{"Growth size"}</span>
				<Choice
					id="bSize"
					label="Growth size"
					items={[
						["small", "Small"],
						["medium", "Medium"],
						["large", "Large"],
					]}
					value={prefs.growSize}
					onChange={(value) =>
						setPreference("growSize", value as typeof prefs.growSize)
					}
				/>
				<small>{"Roughly 6, 9 or 13 suggested nodes each time."}</small>
			</div>
			<div className="field">
				<CheckRow
					id="bPushback"
					checked={!!prefs.pushback}
					onChange={(checked) => setPreference("pushback", checked)}
				>
					<span>{"Push back on my answers in a grill"}</span>
				</CheckRow>
				<small>
					{
						"The AI challenges weak or risky answers instead of accepting them. It never writes an answer for you."
					}
				</small>
			</div>
			<div className="field">
				<span className="lbl">{"Grill pace"}</span>
				<Choice
					id="bGrill"
					label="Grill pace"
					items={[
						["round", "Full round"],
						["single", "One at a time"],
					]}
					value={prefs.grillStyle}
					onChange={(value) =>
						setPreference("grillStyle", value as typeof prefs.grillStyle)
					}
				/>
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
				<span className="lbl">
					{"Creativity "}
					<output id="bCreativeVal">{(+prefs.creativity).toFixed(2)}</output>
				</span>
				<Slider
					id="bCreative"
					aria-label="Creativity"
					min={0}
					max={1}
					step={0.05}
					value={[+prefs.creativity]}
					onValueChange={([value]) => setPreference("creativity", value)}
				/>
				<small>
					{
						"Lower is more predictable, higher is more varied. Placement always uses a low setting, so it stays consistent. Some newer models ignore this."
					}
				</small>
			</div>
		</SettingsPane>
	);
}
