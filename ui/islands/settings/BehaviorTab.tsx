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
			<h3>Behavior</h3>
			<p className="lead">How much the AI adds to the tree on its own.</p>
			<div className="field">
				<span className="lbl">Layout on small screens</span>
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
					Standard has a top bar, a block dock and an action strip. Minimal
					shows only the canvas. In Minimal, tap empty space for a menu, or tap
					a block for its actions.
				</small>
			</div>
			<div className="field">
				<CheckRow
					id="bAutoGrow"
					checked={!!prefs.autoGrow}
					onChange={(checked) => setPreference("autoGrow", checked)}
				>
					<span>Grow branches after I place a block</span>
				</CheckRow>
				<small>
					When off, the AI only places blocks. Use the sparkle button on a node
					to grow it.
				</small>
			</div>
			<div className="field">
				<CheckRow
					id="bAutoTrace"
					checked={!!prefs.autoTrace}
					onChange={(checked) => setPreference("autoTrace", checked)}
				>
					<span>Bridge or trace back when I drop an emotion block</span>
				</CheckRow>
				<small>
					The AI links the feeling to the tree and traces its causes. If they
					don't connect, it starts a grill.
				</small>
			</div>
			<div className="field">
				<span className="lbl">Growth size</span>
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
				<small>Roughly 6, 9 or 13 suggested nodes each time.</small>
			</div>
			<div className="field">
				<CheckRow
					id="bPushback"
					checked={!!prefs.pushback}
					onChange={(checked) => setPreference("pushback", checked)}
				>
					<span>Push back on my answers in a grill</span>
				</CheckRow>
				<small>
					The AI challenges weak or risky answers instead of accepting them. It
					never writes an answer for you.
				</small>
			</div>
			<div className="field">
				<span className="lbl">Grill pace</span>
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
					Full round shows all ready questions together. One at a time shows one
					question card.
				</small>
			</div>
			<div
				className="field"
				data-modes="local web"
				hidden={!["local", "web"].includes(MODE)}
			>
				<span className="lbl">
					Creativity&#32;
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
					Lower is more predictable, higher is more varied. Placing blocks
					always uses a low setting. Some newer models ignore this.
				</small>
			</div>
		</SettingsPane>
	);
}
