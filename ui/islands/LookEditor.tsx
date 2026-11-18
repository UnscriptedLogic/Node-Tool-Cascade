import { useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import {
	state as canvasLookState,
	decorate,
	effLook,
	KIND_LABEL,
	moodColor,
	NODE_TYPES,
	SHAPES,
	WIRE_KINDS,
} from "../legacy/canvas/look.ts";
import { ICONS, LABEL, MOOD_KEYS } from "../legacy/core/constants.ts";
import { DOM } from "../legacy/core/profiles.ts";
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
} from "../legacy/ui/look-editor.ts";

const checkpoint = () => lkCheckpoint();

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
}) {
	return (
		<label className="lk-row" hidden={!show}>
			<span className="lk-l">{label}</span>
			<input
				type="range"
				data-f={field}
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={() => {}}
				onPointerDown={checkpoint}
				onKeyDown={checkpoint}
				onInput={(e) => set(+e.currentTarget.value)}
			/>
			<output>{String(Math.round(value * 100) / 100) + unit}</output>
		</label>
	);
}
function Select({ label, field, options, value, set, show = true }) {
	return (
		<div className="lk-row" hidden={!show}>
			<span className="lk-l">{label}</span>
			<select
				data-f={field}
				value={String(value)}
				onFocus={checkpoint}
				onChange={(e) => set(e.currentTarget.value)}
			>
				{options.map((option) => (
					<option key={option} value={String(option)}>
						{String(option)}
					</option>
				))}
			</select>
		</div>
	);
}
function Check({ label, field, value, set }) {
	return (
		<div className="lk-row">
			<span className="lk-l">{label}</span>
			<label className="lk-chk">
				<input
					type="checkbox"
					data-f={field}
					checked={!!value}
					onChange={(e) => {
						checkpoint();
						set(e.currentTarget.checked);
					}}
				/>
			</label>
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
}) {
	const isKeyword = !!keyword && value === keyword;
	const lastColor = useRef("#000000");
	if (!isKeyword) lastColor.current = toHex(value || "#808080");
	return (
		<div className="lk-row">
			<span className="lk-l">{label}</span>
			<div className="lk-col">
				<input
					type="color"
					data-f={field}
					value={lastColor.current}
					disabled={isKeyword}
					onChange={() => {}}
					onPointerDown={checkpoint}
					onKeyDown={checkpoint}
					onInput={(e) => set(e.currentTarget.value)}
				/>
				{keyword && (
					<label className="lk-sub">
						<input
							type="checkbox"
							data-f={`${field}-kw`}
							checked={isKeyword}
							onChange={(e) => {
								checkpoint();
								set(e.currentTarget.checked ? keyword : lastColor.current);
							}}
						/>
						{keywordLabel}
					</label>
				)}
				<button
					type="button"
					className="lk-mini"
					title="Back to the default"
					onClick={() => {
						checkpoint();
						set(undefined);
					}}
				>
					default
				</button>
			</div>
		</div>
	);
}
function Preview({ type, revision }) {
	const element = useRef<HTMLDivElement>(null),
		box = useRef<HTMLDivElement>(null);
	const kind = type === "base" ? "question" : type;
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
				<span className="txt">{DOM().blocks[kind]}</span>
			</div>
		</div>
	);
}
function Segment({ id, label, items, value, set, attr = "v" }) {
	return (
		<div className="seg" id={id} role="group" aria-label={label}>
			{items.map(([key, text]) => (
				<button
					type="button"
					key={key}
					{...{ [`data-${attr}`]: key }}
					aria-pressed={Boolean(value === key)}
					onClick={() => set(key)}
				>
					{text}
				</button>
			))}
		</div>
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
	const nodeSet = (field: string) => (value) => lkSetNode(field, value);
	const set = (group: string, field: string) => (value) =>
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
	];
	return (
		<>
			<div className="lk-bar">
				<h4>Look</h4>
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
			<div
				className="seg big"
				id="lkTabs"
				role="group"
				aria-label="Look sections"
				style={{ flexWrap: "wrap" }}
			>
				{tabs.map(([key, label]) => (
					<button
						type="button"
						key={key}
						data-lk={key}
						aria-pressed={Boolean(state.tab === key)}
						onClick={() => lkShowTab(key)}
					>
						{label}
					</button>
				))}
			</div>
			<div className="lk-pane" id="lk-presets" hidden={state.tab !== "presets"}>
				<div className="lk-presets">
					{PRESETS.map((preset) => (
						<button
							type="button"
							className="lk-preset"
							data-id={preset.id}
							key={preset.id}
							onClick={() => lkPreset(preset.id)}
						>
							<b>{preset.name}</b>
							<small>{preset.desc}</small>
							<div className="lk-sw">
								{preset.sw.map((color, i) => (
									<i key={i} style={{ background: color }} />
								))}
							</div>
						</button>
					))}
				</div>
				<p className="small" style={{ marginTop: 14 }}>
					Presets replace your current look. Undo brings it back.
				</p>
			</div>
			<div
				className="lk-pane"
				id="lk-describe"
				hidden={state.tab !== "describe"}
			>
				<p className="small">
					Describe the look you want in your own words. You can try it, then
					keep it or put it back.
				</p>
				<textarea
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
						<button
							type="button"
							className="chip"
							key={description}
							onClick={() => {
								LK.desc = description;
								lkGenerate();
							}}
						>
							{description}
						</button>
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
				<div className="lk-chg" id="lkResult" hidden={!state.resultOpen}>
					<b>What changed</b>
					<ul id="lkChanges">
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
			<div className="lk-pane" id="lk-nodes" hidden={state.tab !== "nodes"}>
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
						Colour is reserved for how people feel. Change what each feeling
						looks like.
					</small>
					{MOOD_KEYS.map((mood) => (
						<div className="lk-row" key={mood}>
							<span className="lk-l">
								{mood[0].toUpperCase() + mood.slice(1)}
							</span>
							<div className="lk-col">
								<input
									type="color"
									data-mood={mood}
									value={toHex(moodColor(mood))}
									onChange={() => {}}
									onPointerDown={checkpoint}
									onInput={(e) => lkSetMood(mood, e.currentTarget.value)}
								/>
								<button
									type="button"
									className="lk-mini"
									onClick={() => {
										checkpoint();
										lkSetMood(mood, undefined);
									}}
								>
									default
								</button>
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
			<div className="lk-pane" id="lk-wires" hidden={state.tab !== "wires"}>
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
						Related links, loop flow, blocking and trace-back wires keep their
						own look. Override them here.
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
			<div className="lk-pane" id="lk-canvas" hidden={state.tab !== "canvas"}>
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
			<div className="lk-pane" id="lk-text" hidden={state.tab !== "text"}>
				<p className="small">
					This is everything you have changed, as text. Edit it, paste one from
					a friend, or copy yours. Unknown or out-of-range values are ignored.
				</p>
				<textarea
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
					className={`lk-err${state.textOk ? " ok" : ""}`}
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
						onClick={() => lkApply(text.current.value)}
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
						onClick={() => lkCopy(text.current.value)}
					>
						Copy
					</Button>
				</div>
				<details className="card" style={{ marginTop: 14 }}>
					<summary>What you can set</summary>
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
				</details>
			</div>
		</>
	);
}
