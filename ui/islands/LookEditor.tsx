import { useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
	state as canvasLookState,
	decorate,
	effLook,
	KIND_LABEL,
	moodColor,
	NODE_TYPES,
	SHAPES,
	WIRE_KINDS,
} from "../canvas/look.ts";
import { ICONS, LABEL, MOOD_KEYS } from "../core/constants.ts";
import { DOM } from "../core/profiles.ts";
import {
	LK,
	lkApply,
	lkCheckpoint,
	lkCommitPending,
	lkCopy,
	lkFormat,
	lkGenerate,
	lkPreset,
	lkRefresh,
	lkReset,
	lkResetType,
	lkRevert,
	lkSetGroup,
	lkSetKind,
	lkSetMood,
	lkSetNode,
	lkShowTab,
	lkStyle,
	lkUndo,
	lookSheet,
	PRESETS,
	toHex,
	wirePreview,
} from "../shell/look-editor.ts";
import { Choice, Disclosure, SelectField } from "./controls.tsx";

const lookRow =
	"mb-3 grid grid-cols-[128px_minmax(0,1fr)_52px] items-center gap-2.5 text-[13.5px] [@media(max-width:760px)]:grid-cols-[104px_minmax(0,1fr)_44px]";
const colorInput =
	"h-(--control-h) w-11 rounded-[7px] border border-line bg-paper p-0 disabled:opacity-[0.35]";

const checkpoint = () => lkCheckpoint();

interface RangeProps {
	label: string;
	field: string;
	value: number;
	set: (value: number) => void;
	min: number;
	max: number;
	step: number;
	unit?: string;
	show?: boolean;
}
interface SelectProps {
	label: string;
	field: string;
	options: readonly (string | number)[];
	value: unknown;
	set: (value: string) => void;
	show?: boolean;
}
interface CheckProps {
	label: string;
	field: string;
	value: boolean;
	set: (value: boolean) => void;
}
interface ColorProps {
	label: string;
	field: string;
	value?: string;
	set: (value: string | undefined) => void;
	keyword?: string;
	keywordLabel?: string;
}
interface PreviewProps {
	type: string;
	revision: number;
}
interface SegmentProps {
	id: string;
	label: string;
	items: readonly (readonly string[])[];
	value: string;
	set: (value: string) => void;
	attr?: string;
}
function Range({
	label,
	field,
	value,
	set,
	min,
	max,
	step,
	unit = "",
	show = true,
}: RangeProps) {
	return (
		<div className={lookRow} hidden={!show}>
			<span className="font-semibold">{label}</span>
			<Slider
				data-f={field}
				aria-label={label}
				min={min}
				max={max}
				step={step}
				value={[value]}
				onPointerDown={checkpoint}
				onKeyDown={checkpoint}
				onValueChange={([next]) => set(next)}
			/>
			<output className="text-right text-[12.5px] text-ink2">{String(Math.round(value * 100) / 100) + unit}</output>
		</div>
	);
}
function Select({
	label,
	field,
	options,
	value,
	set,
	show = true,
}: SelectProps) {
	return (
		<div className={lookRow} hidden={!show}>
			<span className="font-semibold">{label}</span>
			<SelectField
				label={label}
				attrs={{ "data-f": field }}
				className="col-[2/span_2] w-full"
				value={String(value)}
				options={options.map((option) => [String(option), String(option)])}
				onOpen={checkpoint}
				onChange={set}
			/>
		</div>
	);
}
function Check({ label, field, value, set }: CheckProps) {
	return (
		<div className={lookRow}>
			<span className="font-semibold">{label}</span>
			<Checkbox
				className="col-start-2 justify-self-start"
				data-f={field}
				aria-label={label}
				checked={!!value}
				onCheckedChange={(next) => {
					checkpoint();
					set(next === true);
				}}
			/>
		</div>
	);
}
function Color({
	label,
	field,
	value,
	set,
	keyword = undefined,
	keywordLabel = undefined,
}: ColorProps) {
	const isKeyword = !!keyword && value === keyword;
	const lastColor = useRef("#000000");
	if (!isKeyword) lastColor.current = toHex(value || "#808080");
	return (
		<div className={lookRow}>
			<span className="font-semibold">{label}</span>
			<div className="col-[2/span_2] flex flex-wrap items-center gap-2.5">
				<input
					type="color"
					className={colorInput}
					data-f={field}
					value={lastColor.current}
					disabled={isKeyword}
					onChange={() => {}}
					onPointerDown={checkpoint}
					onKeyDown={checkpoint}
					onInput={(e) => set(e.currentTarget.value)}
				/>
				{keyword && (
					<Label className="flex items-center gap-1.5 text-[12.5px] text-ink2">
						<Checkbox
							data-f={`${field}-kw`}
							checked={isKeyword}
							onCheckedChange={(next) => {
								checkpoint();
								set(next === true ? keyword : lastColor.current);
							}}
						/>
						{keywordLabel}
					</Label>
				)}
				<Button
					type="button"
					variant="ghost"
					className="lk-mini"
					title="Back to the default"
					onClick={() => {
						checkpoint();
						set(undefined);
					}}
				>
					default
				</Button>
			</div>
		</div>
	);
}
function Preview({ type, revision }: PreviewProps) {
	const element = useRef<HTMLDivElement>(null),
		box = useRef<HTMLDivElement>(null);
	const kind = type === "base" ? "question" : type;
	const blocks: Record<string, string> = DOM().blocks;
	useLayoutEffect(() => {
		if (!element.current || !box.current) return;
		const d = decorate(element.current, kind, {
			type: kind,
			mood: "curiosity",
		});
		element.current.className = `blk t-${kind}${d.poly ? " sh-poly" : ""}${d.icon ? "" : " no-ico"}`;
		box.current.style.setProperty("--pvw", `${d.width}px`);
	}, [kind, revision, decorate]);
	return (
		<div ref={box} className="lk-pv" id="lkPv">
			<div ref={element} className={`blk t-${kind}`}>
				<span
					className="ico"
					dangerouslySetInnerHTML={{ __html: ICONS[kind] }}
				/>
				<span className="txt">{blocks[kind]}</span>
			</div>
		</div>
	);
}
function Segment({ id, label, items, value, set, attr = "v" }: SegmentProps) {
	return (
		<Choice
			id={id}
			label={label}
			big={false}
			attr={attr}
			items={items as readonly (readonly [string, string])[]}
			value={String(value ?? "")}
			onChange={set}
		/>
	);
}

export default function LookEditor() {
	const state = useSnapshot(LK, { sync: true }),
		text = useRef<HTMLTextAreaElement>(null),
		wireHost = useRef<SVGSVGElement>(null),
		look = canvasLookState.LOOK,
		node = lkStyle(),
		wires = effLook().wires,
		canvas = effLook().canvas,
		layout = effLook().layout;
	const nodeSet = (field: string) => (value: unknown) =>
		lkSetNode(field, value);
	const set = (group: string, field: string) => (value: unknown) =>
		lkSetGroup(group, field, value);
	useLayoutEffect(() => {
		wirePreview(wireHost.current);
	}, [state.revision]);
	const tabs = [
		["presets", "Presets"],
		["describe", "Describe"],
		["nodes", "Blocks"],
		["wires", "Wires"],
		["canvas", "Canvas"],
		["text", "Text"],
	] as const;
	return (
		<>
			<div className="mt-7 mb-3 flex items-center justify-between gap-2">
				<h4 className="m-0 text-[17px] font-extrabold tracking-[-0.02em]">
					Look
				</h4>
				<div className="frow">
					<Button
						type="button"
						className="btn"
						id="lkUndo"
						disabled={
							!state.hist.some((item: string) => item !== JSON.stringify(look))
						}
						onClick={() => lkUndo()}
					>
						Undo
					</Button>
					<Button
						type="button"
						className="btn"
						id="lkReset"
						onClick={() => lkReset()}
					>
						Reset look
					</Button>
				</div>
			</div>
			<Choice
				id="lkTabs"
				label="Look sections"
				attr="lk"
				style={{ flexWrap: "wrap" }}
				items={tabs}
				value={state.tab}
				onChange={(key) => lkShowTab(key)}
			/>
			<div className="mt-4" id="lk-presets" hidden={state.tab !== "presets"}>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
					{PRESETS.map((preset) => (
						<Button
							type="button"
							variant="ghost"
							className="lk-preset"
							data-id={preset.id}
							key={preset.id}
							onClick={() => lkPreset(preset.id)}
						>
							<b className="mb-[3px] block text-[13.5px]">{preset.name}</b>
							<small className="mb-2 block text-[12px]/[1.35] text-ink2">
								{preset.desc}
							</small>
							<div className="flex gap-[3px]">
								{preset.sw.map((color, i) => (
									<i
										key={i}
										className="h-2.5 flex-1 rounded-[3px] border border-[color-mix(in_srgb,var(--ink)_15%,transparent)]"
										style={{ background: color }}
									/>
								))}
							</div>
						</Button>
					))}
				</div>
				<p className="small" style={{ marginTop: 14 }}>
					Presets replace your current look. Undo brings it back.
				</p>
			</div>
			<div className="mt-4" id="lk-describe" hidden={state.tab !== "describe"}>
				<p className="small">
					Describe the look you want in your own words. You can try it, then
					keep it or put it back.
				</p>
				<Textarea
					id="lkDesc"
					className="area"
					rows={3}
					maxLength={400}
					placeholder="A calm blueprint look with straight wires and huge diamond decisions"
					value={state.desc}
					onChange={() => {}}
					onInput={(e) => {
						LK.desc = e.currentTarget.value;
					}}
				/>
				<div className="chips" style={{ marginTop: 8 }} id="lkChips">
					{[
						"Soft pastel with curvy wires",
						"Dark and spacious, thin straight wires",
						"Big red decisions, small grey answers",
						"Neon with arrows and glowing outlines",
					].map((description) => (
						<Button
							type="button"
							variant="ghost"
							className="chip"
							key={description}
							onClick={() => {
								LK.desc = description;
								lkGenerate();
							}}
						>
							{description}
						</Button>
					))}
				</div>
				<div className="mrow">
					<Button
						type="button"
						className="btn primary"
						id="lkGo"
						disabled={state.busy}
						onClick={() => lkGenerate()}
					>
						Design it
					</Button>
					<span className="small" id="lkStatus" aria-live="polite">
						{state.status}
					</span>
				</div>
				<div
					className="my-3 rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[13px]/[1.5]"
					id="lkResult"
					hidden={!state.resultOpen}
				>
					<b>What changed</b>
					<ul id="lkChanges" className="mt-1.5 mb-2.5 pl-[18px]">
						{state.changes.map((change, i) => (
							<li key={i}>{change}</li>
						))}
					</ul>
					<div className="small" id="lkNote">
						{state.note}
					</div>
					<div className="frow" style={{ marginTop: 10 }}>
						<Button
							type="button"
							className="btn primary"
							id="lkKeep"
							onClick={() => lkCommitPending()}
						>
							Keep it
						</Button>
						<Button
							type="button"
							className="btn"
							id="lkRevert"
							onClick={() => lkRevert()}
						>
							Put it back
						</Button>
					</div>
				</div>
			</div>
			<div className="mt-4" id="lk-nodes" hidden={state.tab !== "nodes"}>
				<div className="field">
					<span className="lbl">Which blocks</span>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						<Segment
							id="lkType"
							label="Block type"
							attr="t"
							items={[
								["base", "All"],
								...NODE_TYPES.map((kind) => [kind, LABEL[kind]]),
							]}
							value={state.type}
							set={(type) => {
								LK.type = type;
								lkRefresh();
							}}
						/>
					</div>
					<small>
						"All" sets a look for every block. A type's own settings win over
						it.
					</small>
				</div>
				<Preview type={state.type} revision={state.revision} />
				<Select
					label="Shape"
					field="shape"
					options={SHAPES}
					value={node.shape}
					set={nodeSet("shape")}
				/>
				<Range
					label="Corner radius"
					field="radius"
					value={Array.isArray(node.radius) ? node.radius[1] : node.radius}
					set={nodeSet("radius")}
					min={0}
					max={40}
					step={1}
					show={node.shape === "rounded"}
				/>
				<Color
					label="Fill"
					field="fill"
					value={node.fill}
					set={nodeSet("fill")}
					keyword="mood"
					keywordLabel="Match mood"
				/>
				<Color
					label="Outline"
					field="stroke"
					value={node.stroke}
					set={nodeSet("stroke")}
				/>
				<Range
					label="Outline width"
					field="strokeWidth"
					value={node.strokeWidth}
					set={nodeSet("strokeWidth")}
					min={0}
					max={8}
					step={0.5}
				/>
				<Select
					label="Outline style"
					field="strokeStyle"
					options={["solid", "dashed", "dotted", "double", "none"]}
					value={node.strokeStyle}
					set={nodeSet("strokeStyle")}
				/>
				<Color
					label="Text"
					field="text"
					value={node.text}
					set={nodeSet("text")}
					keyword="auto"
					keywordLabel="Auto contrast"
				/>
				<Range
					label="Text size"
					field="fontSize"
					value={node.fontSize}
					set={nodeSet("fontSize")}
					min={10}
					max={26}
					step={0.5}
					unit="px"
				/>
				<Select
					label="Text weight"
					field="fontWeight"
					options={[400, 500, 600, 700, 800]}
					value={node.fontWeight}
					set={(v) => nodeSet("fontWeight")(+v)}
				/>
				<Check
					label="Italic"
					field="italic"
					value={node.italic}
					set={nodeSet("italic")}
				/>
				<Range
					label="Width"
					field="width"
					value={node.width}
					set={nodeSet("width")}
					min={110}
					max={460}
					step={2}
					unit="px"
				/>
				<Range
					label="Side padding"
					field="padX"
					value={node.padX}
					set={nodeSet("padX")}
					min={2}
					max={40}
					step={1}
					unit="px"
				/>
				<Range
					label="Vertical padding"
					field="padY"
					value={node.padY}
					set={nodeSet("padY")}
					min={2}
					max={30}
					step={1}
					unit="px"
				/>
				<Select
					label="Shadow"
					field="shadow"
					options={["none", "soft", "hard", "glow"]}
					value={node.shadow}
					set={nodeSet("shadow")}
				/>
				<Select
					label="Pattern"
					field="pattern"
					options={["none", "hatch", "dots"]}
					value={node.pattern}
					set={nodeSet("pattern")}
				/>
				<Range
					label="Opacity"
					field="opacity"
					value={node.opacity}
					set={nodeSet("opacity")}
					min={0.3}
					max={1}
					step={0.05}
				/>
				<Check
					label="Show icon"
					field="icon"
					value={node.icon !== false}
					set={nodeSet("icon")}
				/>
				<Range
					label="Side bar"
					field="barW"
					value={node.bar?.width || 0}
					set={(v: number) =>
						nodeSet("bar")(
							v > 0
								? { width: v, color: node.bar?.color || "var(--ink2)" }
								: null,
						)
					}
					min={0}
					max={10}
					step={1}
					unit="px"
				/>
				<Range
					label="Outer ring"
					field="ringW"
					value={node.ring?.width || 0}
					set={(v: number) =>
						nodeSet("ring")(
							v > 0
								? {
										width: v,
										color: node.ring?.color || "var(--line)",
										offset: node.ring?.offset || 3,
									}
								: null,
						)
					}
					min={0}
					max={5}
					step={0.5}
					unit="px"
				/>
				<div
					className="field"
					id="lkMoods"
					hidden={!["base", "emotion"].includes(state.type)}
				>
					<span className="lbl">Mood colours</span>
					<small>
						Colour only marks how people feel. Change what each feeling looks
						like.
					</small>
					{MOOD_KEYS.map((mood) => (
						<div className={lookRow} key={mood}>
							<span className="font-semibold">
								{mood[0].toUpperCase() + mood.slice(1)}
							</span>
							<div className="col-[2/span_2] flex flex-wrap items-center gap-2.5">
								<input
									type="color"
									className={colorInput}
									data-mood={mood}
									value={toHex(moodColor(mood))}
									onChange={() => {}}
									onPointerDown={checkpoint}
									onInput={(e) => lkSetMood(mood, e.currentTarget.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									className="lk-mini"
									onClick={() => {
										checkpoint();
										lkSetMood(mood, undefined);
									}}
								>
									default
								</Button>
							</div>
						</div>
					))}
				</div>
				<div className="frow">
					<Button
						type="button"
						className="btn"
						id="lkTypeReset"
						hidden={!look.nodes?.[state.type]}
						onClick={() => lkResetType()}
					>
						Reset these blocks
					</Button>
				</div>
			</div>
			<div className="mt-4" id="lk-wires" hidden={state.tab !== "wires"}>
				<div className="field">
					<span className="lbl">Wire style</span>
					<Segment
						id="lkWStyle"
						label="Wire style"
						items={["default", "bezier", "straight", "manhattan"].map((v) => [
							v,
							v[0].toUpperCase() + v.slice(1),
						])}
						value={wires.style}
						set={(v) => {
							checkpoint();
							set("wires", "style")(v);
						}}
					/>
					<small>
						Default is the original gentle curve. Bezier lets you tune the
						curve, Straight draws direct lines, and Manhattan routes with right
						angles.
					</small>
				</div>
				<svg
					id="lkWpv"
					ref={wireHost}
					className="lk-wpv"
					viewBox="0 0 320 132"
					preserveAspectRatio="xMidYMid meet"
				/>
				<Range
					label="Curve"
					field="curvature"
					value={wires.curvature}
					set={set("wires", "curvature")}
					min={0}
					max={1}
					step={0.05}
					show={wires.style === "bezier"}
				/>
				<Range
					label="Elbow position"
					field="elbow"
					value={wires.elbow}
					set={set("wires", "elbow")}
					min={0.1}
					max={0.9}
					step={0.05}
					show={wires.style === "manhattan"}
				/>
				<Range
					label="Corner radius"
					field="wradius"
					value={wires.radius}
					set={set("wires", "radius")}
					min={0}
					max={30}
					step={1}
					unit="px"
					show={wires.style === "manhattan"}
				/>
				<Range
					label="Width"
					field="wwidth"
					value={wires.width || 1.7}
					set={set("wires", "width")}
					min={0.5}
					max={8}
					step={0.1}
					unit="px"
				/>
				<Color
					label="Colour"
					field="wcolor"
					value={wires.color || "var(--edge)"}
					set={set("wires", "color")}
				/>
				<Range
					label="Opacity"
					field="wopacity"
					value={wires.opacity || 1}
					set={set("wires", "opacity")}
					min={0.1}
					max={1}
					step={0.05}
				/>
				<Select
					label="Dash"
					field="wdash"
					value={wires.dash || "solid"}
					options={["solid", "dashed", "dotted"]}
					set={set("wires", "dash")}
				/>
				<Select
					label="Arrowheads"
					field="warrows"
					value={wires.arrows}
					options={["none", "end"]}
					set={set("wires", "arrows")}
				/>
				<Select
					label="Colour by block"
					field="wcolorBy"
					value={wires.colorBy}
					options={["none", "child", "parent"]}
					set={set("wires", "colorBy")}
				/>
				<div className="field">
					<span className="lbl">Other kinds of link</span>
					<small>
						Related links, loop flow, blocking and trace-back wires have their
						own look. Change them here.
					</small>
					{WIRE_KINDS.filter((kind: string) => kind !== "tree").map((kind) => (
						<div key={kind}>
							<Color
								label={KIND_LABEL[kind]}
								field={`k-${kind}-color`}
								value={
									wires.kinds[kind]?.color ||
									(kind === "block" ? "var(--focus)" : "var(--ink2)")
								}
								set={(v) => lkSetKind(kind, "color", v)}
							/>
							<Select
								label=""
								field={`k-${kind}-dash`}
								value={
									wires.kinds[kind]?.dash ||
									(["flow", "block"].includes(kind) ? "dashed" : "dotted")
								}
								options={["solid", "dashed", "dotted"]}
								set={(v) => lkSetKind(kind, "dash", v)}
							/>
						</div>
					))}
				</div>
			</div>
			<div className="mt-4" id="lk-canvas" hidden={state.tab !== "canvas"}>
				<Color
					label="Background"
					field="cbg"
					value={canvas.bg || "var(--bg)"}
					set={set("canvas", "bg")}
				/>
				<div className="field">
					<span className="lbl">Grid</span>
					<Segment
						id="lkGrid"
						label="Grid"
						value={canvas.grid}
						items={["dots", "lines", "none"].map((v) => [
							v,
							v[0].toUpperCase() + v.slice(1),
						])}
						set={(v) => {
							checkpoint();
							set("canvas", "grid")(v);
						}}
					/>
				</div>
				<Color
					label="Grid colour"
					field="cgrid"
					value={canvas.gridColor || "var(--dot)"}
					set={set("canvas", "gridColor")}
				/>
				<Range
					label="Grid size"
					field="cgridSize"
					value={canvas.gridSize}
					set={set("canvas", "gridSize")}
					min={10}
					max={80}
					step={2}
					unit="px"
				/>
				<Range
					label="Column gap"
					field="colGap"
					value={layout.colGap}
					set={set("layout", "colGap")}
					min={16}
					max={200}
					step={2}
					unit="px"
				/>
				<Range
					label="Row gap"
					field="rowGap"
					value={layout.rowGap}
					set={set("layout", "rowGap")}
					min={2}
					max={80}
					step={1}
					unit="px"
				/>
			</div>
			<div className="mt-4" id="lk-text" hidden={state.tab !== "text"}>
				<p className="small">
					This is everything you have changed, as text. Edit it, paste one from
					a friend, or copy yours. Unknown or out-of-range values are ignored.
				</p>
				<Textarea
					ref={text}
					id="lkText"
					spellCheck={false}
					value={state.text}
					onChange={() => {}}
					onInput={(e) => {
						LK.text = e.currentTarget.value;
					}}
					onFocus={() => {
						LK.textFocused = true;
					}}
					onBlur={() => {
						LK.textFocused = false;
					}}
				/>
				<div
					className={`mt-1.5 min-h-[18px] text-[13px] ${state.textOk ? "text-[#19877a]" : "text-[#d94a2b]"}`}
					id="lkTextErr"
					aria-live="polite"
				>
					{state.textError}
				</div>
				<div className="frow" style={{ marginTop: 10 }}>
					<Button
						type="button"
						className="btn primary"
						id="lkApply"
						onClick={() => {
							if (text.current) lkApply(text.current.value);
						}}
					>
						Apply
					</Button>
					<Button
						type="button"
						className="btn"
						id="lkFormat"
						onClick={() => lkFormat()}
					>
						Reload from current look
					</Button>
					<Button
						type="button"
						className="btn"
						id="lkCopy"
						onClick={() => {
							if (text.current) lkCopy(text.current.value);
						}}
					>
						Copy
					</Button>
				</div>
				<Disclosure
					className="card"
					style={{ marginTop: 14 }}
					title="What you can set"
				>
					<pre
						id="lkSheet"
						style={{
							whiteSpace: "pre-wrap",
							font: "12px/1.5 ui-monospace,Menlo,Consolas,monospace",
							color: "var(--ink2)",
							margin: "10px 0 0",
						}}
					>
						{lookSheet}
					</pre>
				</Disclosure>
			</div>
		</>
	);
}
