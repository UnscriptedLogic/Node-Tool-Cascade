import { useEffect, useRef, useState } from "react";
import { type Snapshot, useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MINDSET_PRESETS from "../../shared/mindset-presets.ts";
import type { Mindset } from "../../shared/mindsets.ts";
import MindsetCollection from "../../shared/mindsets.ts";
import { PREFS } from "../legacy/core/constants.ts";
import type { Preferences } from "../legacy/core/prefs.ts";
import { DOMAINS } from "../legacy/core/profiles.ts";
import { S } from "../legacy/core/state.ts";
import {
	applyMindset,
	changeMindsetIcon,
	downloadBuiltinMindset,
	downloadMindsetExample,
	enableBuiltinMindset,
	enableMindset,
	exportMindset,
	importMindsetFile,
	importMindsetJson,
	MSUI,
	removeMindset,
} from "../legacy/features/mindsets.ts";
import { closeSettings } from "../legacy/shell/settings.ts";
import type { CascadeTree } from "../model.ts";
import MindsetConverter from "./MindsetConverter.tsx";

interface MindsetIconProps {
	pack: Pick<Mindset, "id" | "name" | "icon">;
}
function MindsetIcon({ pack }: MindsetIconProps) {
	const [value, setValue] = useState(pack.icon);
	useEffect(() => setValue(pack.icon), [pack.icon]);
	return (
		<Input
			type="text"
			maxLength={16}
			value={value}
			aria-label={`Icon for ${pack.name}`}
			onChange={(e) => setValue(e.currentTarget.value)}
			onBlur={() => {
				if (value !== pack.icon) changeMindsetIcon(pack.id, value);
			}}
		/>
	);
}
function context(state: Snapshot<CascadeTree>, prefs: Readonly<Preferences>) {
	const parts = [],
		seen = new Set();
	let node = state.nodes[String(state.sel)];
	while (node && !seen.has(node.id) && seen.size < 3) {
		seen.add(node.id);
		parts.push(node.text);
		node = state.nodes[String(node.parent)];
	}
	return parts.length
		? parts.join("\n")
		: [
				prefs.goal,
				prefs.context,
				...state.order
					.filter((id) => state.nodes[id] && !state.nodes[id].ghost)
					.slice(0, 20)
					.map((id) => state.nodes[id].text),
			].join("\n");
}
export default function Mindsets() {
	const domains: Record<string, { label: string }> = DOMAINS;
	const state = useSnapshot(S, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true }),
		ui = useSnapshot(MSUI, { sync: true }),
		file = useRef<HTMLInputElement>(null);
	const topic = context(state, prefs);
	return (
		<>
			<h3>{"Mindsets"}</h3>
			<p className="sub">
				{
					"Add ways of thinking to this Cascade. Matching lenses can add questions alongside ordinary branches and interviews. Select a node before opening Settings to apply a pack to that branch."
				}
			</p>
			<p className="small">
				{
					"Only enabled packs for the current domain and matching branch topics are considered. A matching word is a starting point: questions must still fit the topic and goal. Existing questions keep their source when a pack is removed."
				}
			</p>
			<div id="msBuiltins">
				{MINDSET_PRESETS.map((preset) => {
					const pack = MindsetCollection.pack(preset),
						installed = state.mindsets.find((p) => p.id === pack.id);
					return (
						<section className="card mindset-builtin" key={pack.id}>
							<strong>{`${pack.icon} ${pack.name}`}</strong>
							<p className="small">{`Included · Game design only · ${pack.source.edition}. ${pack.source.coverage}`}</p>
							<div className="frow">
								<Button
									type="button"
									className="btn primary"
									disabled={!!installed?.enabled}
									onClick={() => enableBuiltinMindset(pack.id)}
								>
									{installed?.enabled
										? "Enabled in this Cascade"
										: "Enable starter mindset"}
								</Button>
								<Button
									type="button"
									className="btn"
									onClick={() => downloadBuiltinMindset(pack.id)}
								>
									Download starter JSON
								</Button>
								<a href={pack.source.url} target="_blank" rel="noopener">
									Source reference
								</a>
							</div>
						</section>
					);
				})}
			</div>
			<div className="frow">
				<Button
					type="button"
					className="btn primary"
					id="msImport"
					onClick={() => file.current?.click()}
				>
					{"Import JSON pack"}
				</Button>
				<Button
					type="button"
					className="btn"
					id="msExample"
					onClick={() => downloadMindsetExample()}
				>
					{"Download example"}
				</Button>
			</div>
			<input
				type="file"
				id="msFile"
				accept=".json,application/json"
				hidden={true}
				ref={file}
				onChange={async (e) => {
					const input = e.currentTarget;
					await importMindsetFile(input.files?.[0]);
					input.value = "";
				}}
			/>
			<details>
				<summary>{"Paste JSON pack"}</summary>
				<Label className="field" htmlFor="msJson">
					{"Mindset JSON"}
				</Label>
				<Textarea
					id="msJson"
					className="area"
					rows={7}
					spellCheck={false}
					value={ui.json}
					onChange={(e) => {
						MSUI.json = e.currentTarget.value;
					}}
				/>
				<Button
					type="button"
					className="btn"
					id="msPasteImport"
					onClick={() => importMindsetJson()}
				>
					{"Import pasted JSON"}
				</Button>
			</details>
			<p id="msMsg" className="small" role="status" aria-live="polite">
				{ui.message}
			</p>
			<p id="msEmpty" className="sub" hidden={state.mindsets.length > 0}>
				{
					"No mindsets yet. Download the example to see the format. Import one pack or a JSON array of packs."
				}
			</p>
			<div id="msList">
				{state.mindsets.map((pack) => {
					const candidates = MindsetCollection.candidates(
						state.mindsets,
						prefs.domain,
						topic,
						pack.id,
					);
					return (
						<section
							className="card mindset-pack"
							data-pack={pack.id}
							key={pack.id}
						>
							<Label className="check">
								<input
									type="checkbox"
									checked={pack.enabled}
									aria-label={`Enable ${pack.name}`}
									onChange={(e) =>
										enableMindset(pack.id, e.currentTarget.checked)
									}
								/>
								<strong>{pack.name}</strong>
							</Label>
							<p className="small">{`${pack.entries.length} ${pack.entries.length === 1 ? "entry" : "entries"} · ${pack.domains.map((d) => domains[d].label).join(", ")}${pack.source.title ? ` · ${pack.source.title}${pack.source.edition ? ` (${pack.source.edition})` : ""}` : ""}`}</p>
							{pack.source.coverage && (
								<p className="small">{pack.source.coverage}</p>
							)}
							<Label className="field">
								Node icon
								<MindsetIcon pack={pack} />
							</Label>
							<p className="small">
								{!pack.domains.includes(prefs.domain)
									? "Inactive in this domain."
									: !pack.enabled
										? "Disabled for this Cascade."
										: `${candidates.length} matching ${candidates.length === 1 ? "entry" : "entries"} for ${state.sel ? "the selected branch" : "this tree"}.`}
							</p>
							<div className="frow">
								<Button
									type="button"
									className="btn"
									disabled={!state.sel || !candidates.length}
									onClick={() => {
										closeSettings();
										applyMindset(state.sel, pack.id);
									}}
								>
									Apply to selected node
								</Button>
								<Button
									type="button"
									className="btn"
									onClick={() => exportMindset(pack.id)}
								>
									Export pack
								</Button>
								<Button
									type="button"
									className="btn"
									onClick={() => removeMindset(pack.id)}
								>
									Remove
								</Button>
							</div>
						</section>
					);
				})}
			</div>
			<div id="converterRoot">
				<MindsetConverter />
			</div>{" "}
		</>
	);
}
