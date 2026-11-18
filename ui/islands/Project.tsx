import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PREFS } from "../legacy/core/constants.ts";
import { DOMAINS } from "../legacy/core/profiles.ts";
import {
	buildBrief,
	cancelProjectScan,
	editProjectBrief,
	forgetProject,
	PROJECTUI,
	projectPick,
	projectScan,
	restoreProjectBrief,
	seedFromProject,
	setProjectDepth,
	setProjectField,
	stopProject,
} from "../legacy/features/project.ts";
import { closeSettings, setPreference } from "../legacy/shell/settings.ts";

const formatNumber = (n: number) =>
	n >= 10000
		? `${Math.round(n / 1000)}k`
		: n >= 1000
			? `${(n / 1000).toFixed(1)}k`
			: String(n);
export default function Project() {
	const ui = useSnapshot(PROJECTUI, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true });
	const project = ui.project,
		domain = DOMAINS[prefs.domain] || DOMAINS.general;
	const counts = project.counts || {},
		skipped = Object.values(project.skipped || {}).reduce(
			(a: number, b: number) => a + b,
			0,
		);
	const depths: readonly (readonly [
		"quick" | "standard" | "thorough",
		string,
	])[] = [
		["quick", "Quick"],
		["standard", "Standard"],
		["thorough", "Thorough"],
	];
	return (
		<>
			<h3>{"Project folder"}</h3>
			<p className="lead">
				<span data-dom-text="projectLead">{domain.projectLead}</span>
				{
					" Reading and searching happen on this computer. When you build a brief, short digests and code excerpts go to the AI you connected, never your keys, and anything that looks like a secret is skipped or redacted first."
				}
			</p>
			<div className="field">
				<Label htmlFor="pPath">{"Folder"}</Label>
				<div className="frow">
					<Input
						id="pPath"
						type="text"
						spellCheck={false}
						autoComplete="off"
						data-dom-ph="projectPlaceholder"
						placeholder={domain.projectPlaceholder}
						value={ui.path}
						onChange={(e) => setProjectField("path", e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								projectScan();
							}
						}}
					/>
					<Button
						className="btn"
						id="pPick"
						type="button"
						disabled={ui.busy}
						onClick={() => projectPick()}
					>
						{"Choose…"}
					</Button>
					<Button
						className="btn primary"
						id="pScan"
						type="button"
						disabled={ui.busy || ui.scanBusy}
						onClick={() => projectScan()}
					>
						{"Scan"}
					</Button>
					<Button
						className="btn"
						id="pCancel"
						type="button"
						hidden={!ui.scanBusy}
						onClick={() => cancelProjectScan()}
					>
						{"Stop"}
					</Button>
				</div>
				<small id="pMsg" aria-live="polite" className={ui.messageClass}>
					{ui.message}
				</small>
			</div>
			<details className="card pdetails">
				<summary>{"Skip or add files"}</summary>
				<div className="field">
					<Label htmlFor="pIgnore">{"Also skip"}</Label>
					<Textarea
						id="pIgnore"
						rows={3}
						placeholder="Assets/ThirdParty/\n*.generated.cs"
						value={ui.ignore}
						onChange={(e) => setProjectField("ignore", e.currentTarget.value)}
					/>
					<small>
						{
							"One pattern per line, written like a .gitignore. The project’s own .gitignore and each engine’s generated folders are skipped already."
						}
					</small>
				</div>
				<div className="field">
					<Label htmlFor="pInclude">{"Also read these extensions"}</Label>
					<Input
						id="pInclude"
						type="text"
						placeholder="shader, tres"
						value={ui.include}
						onChange={(e) => setProjectField("include", e.currentTarget.value)}
					/>
					<small>{"Comma separated. Binary files are never read."}</small>
				</div>
				<small id="pDefaults">
					{project.has && project.engineIgnore?.length
						? "Skipped automatically for " +
							project.engineLabel +
							": " +
							project.engineIgnore.join(", ")
						: ""}
				</small>
			</details>
			<div id="pSummary" hidden={!project.has}>
				<div className="pstat" id="pStats">
					{[
						["Engine", project.engineLabel],
						["Files read", String(counts.files)],
						[
							"Text",
							counts.textKB +
								" KB · about " +
								formatNumber(counts.tokensEst || 0) +
								" tokens",
						],
						["Skipped", String(skipped)],
					].map(([label, value]) => (
						<div key={label}>
							<b>{value}</b>
							{label}
						</div>
					))}
				</div>
				<small id="pDetail">{ui.detail}</small>
			</div>
			<div id="pBriefWrap" hidden={!project.has}>
				<div className="field">
					<span className="lbl">{"Project brief"}</span>
					{/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing depth control DOM contract. */}
					<div
						className="seg big"
						id="pDepth"
						role="group"
						aria-label="How thoroughly to read"
					>
						{depths.map(([value, label]) => (
							<button
								key={value}
								type="button"
								data-val={value}
								aria-pressed={ui.depth === value}
								onClick={() => setProjectDepth(value)}
							>
								{label}
							</button>
						))}
					</div>
					<small id="pEstimate">{ui.estimate}</small>
					<div className="frow">
						<Button
							className="btn primary"
							id="pBuild"
							type="button"
							disabled={ui.busy}
							onClick={() => buildBrief()}
						>
							{ui.buildLabel}
						</Button>
						<Button
							className="btn"
							id="pStop"
							type="button"
							hidden={!ui.busy}
							onClick={() => stopProject()}
						>
							{"Stop"}
						</Button>
						<Button
							className="linkbtn"
							id="pRestore"
							type="button"
							hidden={!ui.canRestore}
							onClick={() => restoreProjectBrief()}
						>
							{"Restore previous brief"}
						</Button>
					</div>
					<small id="pProg" aria-live="polite" className={ui.progressClass}>
						{ui.progress}
					</small>
					<Textarea
						id="pBrief"
						className="area"
						rows={14}
						maxLength={12000}
						placeholder="The brief appears here. You can edit it freely."
						value={ui.brief}
						onChange={(e) => editProjectBrief(e.currentTarget.value)}
					/>
					<small>
						{
							"This is exactly what the AI is told about your project. Fix anything that’s wrong. Your goal and pillars always take precedence."
						}
					</small>
				</div>
				<div className="field">
					<Label className="check">
						<input
							type="checkbox"
							id="pUse"
							checked={prefs.useProject}
							onChange={(e) =>
								setPreference("useProject", e.currentTarget.checked)
							}
						/>
						<span>{"Use the brief in every AI call"}</span>
					</Label>
					<Label className="check">
						<input
							type="checkbox"
							id="pAsk"
							checked={prefs.askFiles}
							onChange={(e) =>
								setPreference("askFiles", e.currentTarget.checked)
							}
						/>
						<span>
							{
								"Let Ask and Grill look things up in the project’s files and cite them"
							}
						</span>
					</Label>
				</div>
				<div className="field">
					<span className="lbl">{"Graph"}</span>
					<div className="frow">
						<Button
							className="btn primary"
							id="pSeed"
							type="button"
							disabled={ui.busy}
							onClick={() => {
								closeSettings();
								seedFromProject();
							}}
						>
							{"Seed the graph from the project"}
						</Button>
						<Button
							className="btn"
							id="pForget"
							type="button"
							disabled={ui.busy}
							onClick={() => forgetProject()}
						>
							{"Forget this project"}
						</Button>
					</div>
					<small>
						{
							"Seeding drafts suggested nodes (decisions already made, open questions, fog) as ghosts you keep or dismiss. Each one remembers the file it came from."
						}
					</small>
				</div>
			</div>{" "}
		</>
	);
}
