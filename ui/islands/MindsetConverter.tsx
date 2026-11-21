import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	downloadConvertedMindset,
	editMindsetSource,
	generateMindsetDraft,
	importConvertedMindset,
	MSCONVERT,
	readMindsetSources,
	setConversionDomain,
	setConversionField,
	stopMindsetConversion,
} from "../features/mindset-converter.ts";

const conversionDomains: readonly (readonly [string, string])[] = [
	["general", "General / business"],
	["product", "Product"],
	["research", "Research"],
	["game", "Game design"],
];
export default function MindsetConverter() {
	const ui = useSnapshot(MSCONVERT, { sync: true });
	return (
		<details id="msConverter" className="card">
			<summary>{"Create a mindset from source material"}</summary>
			<p className="small">
				{
					"Upload PDF, TXT, Markdown, HTML, JSON, CSV, TSV, XML or YAML, or paste text. Files are read on this device. Generate draft sends extracted text in chunks to your connected provider. Review the questions and source references before importing."
				}
			</p>
			<div className="field">
				<Label htmlFor="mcFiles">{"Source files"}</Label>
				<input
					id="mcFiles"
					type="file"
					multiple={true}
					accept=".pdf,.txt,.md,.markdown,.html,.htm,.json,.csv,.tsv,.xml,.yaml,.yml,.log,text/*,application/pdf,application/json"
					disabled={ui.busy}
					onChange={(e) =>
						readMindsetSources([...(e.currentTarget.files || [])])
					}
				/>
			</div>
			<div className="field">
				<Label htmlFor="mcText">{"Source text"}</Label>
				<Textarea
					id="mcText"
					rows={6}
					maxLength={2000000}
					placeholder="Paste notes, an article, a transcript, or exported book text. Uploaded files appear here for review."
					disabled={ui.busy}
					value={ui.text}
					onChange={(e) => editMindsetSource(e.currentTarget.value)}
				/>
				<small id="mcSourceInfo">{ui.info}</small>
			</div>
			<div className="field">
				<Label htmlFor="mcName">{"Mindset name"}</Label>
				<Input
					id="mcName"
					type="text"
					maxLength={80}
					placeholder="My questioning framework"
					disabled={ui.busy}
					value={ui.name}
					onChange={(e) => setConversionField("name", e.currentTarget.value)}
				/>
			</div>
			<div className="field">
				<Label htmlFor="mcSourceTitle">{"Source title or author"}</Label>
				<Input
					id="mcSourceTitle"
					type="text"
					maxLength={200}
					placeholder="Book title, author, or workshop notes"
					disabled={ui.busy}
					value={ui.title}
					onChange={(e) => setConversionField("title", e.currentTarget.value)}
				/>
			</div>
			<div className="field">
				<Label htmlFor="mcEdition">{"Edition or date (optional)"}</Label>
				<Input
					id="mcEdition"
					type="text"
					maxLength={80}
					disabled={ui.busy}
					value={ui.edition}
					onChange={(e) => setConversionField("edition", e.currentTarget.value)}
				/>
			</div>
			<div className="field">
				<Label htmlFor="mcUrl">{"Source link (optional)"}</Label>
				<Input
					id="mcUrl"
					type="url"
					placeholder="https://..."
					disabled={ui.busy}
					value={ui.url}
					onChange={(e) => setConversionField("url", e.currentTarget.value)}
				/>
			</div>
			<fieldset id="mcDomains">
				<legend>Where may these questions be used?</legend>
				{conversionDomains.map(([value, label]) => (
					<Label className="check" key={value}>
						<input
							type="checkbox"
							value={value}
							disabled={ui.busy}
							checked={ui.domains.includes(value)}
							onChange={(e) =>
								setConversionDomain(value, e.currentTarget.checked)
							}
						/>
						{label}
					</Label>
				))}
			</fieldset>
			<div className="field">
				<Label htmlFor="mcLimit">{"Maximum entries"}</Label>
				<Input
					id="mcLimit"
					type="number"
					min="1"
					max="200"
					value={ui.limit}
					disabled={ui.busy}
					onChange={(e) => setConversionField("limit", e.currentTarget.value)}
				/>
				<small>
					{
						"Large sources can require many provider calls. Progress reports how much was processed; stopping or hitting this limit produces a partial draft."
					}
				</small>
			</div>
			<div className="frow">
				<Button
					id="mcGenerate"
					type="button"
					className="btn primary"
					disabled={ui.busy}
					onClick={() => generateMindsetDraft()}
				>
					{"Generate draft"}
				</Button>
				<Button
					id="mcStop"
					type="button"
					className="btn"
					hidden={!ui.busy}
					disabled={false}
					onClick={() => stopMindsetConversion()}
				>
					{"Stop conversion"}
				</Button>
			</div>
			<p id="mcStatus" className="small" role="status" aria-live="polite">
				{ui.status}
			</p>
			<section id="mcReview" hidden={!ui.draft}>
				<h4>{"Review draft"}</h4>
				<p id="mcReport" className="small">
					{ui.report}
				</p>
				<div id="mcEntries">
					{ui.draft?.entries.map((entry) => (
						<details key={entry.id}>
							<summary>{`${entry.label}${entry.number ? ` #${entry.number}` : ""}: ${entry.name}`}</summary>
							<p className="small">{`Topics: ${entry.topics.join(", ")}`}</p>
							{entry.questions.map((question, i) => (
								<p key={i}>{question}</p>
							))}
							<p className="small">
								{entry.references
									.map((ref) => `${ref.source} — ${ref.location}`)
									.join("; ")}
							</p>
						</details>
					))}
				</div>
				<div className="field">
					<Label htmlFor="mcJson">{"Mindset JSON (editable)"}</Label>
					<Textarea
						id="mcJson"
						rows={10}
						spellCheck={false}
						disabled={ui.busy}
						value={ui.json}
						onChange={(e) => setConversionField("json", e.currentTarget.value)}
					/>
				</div>
				<div className="frow">
					<Button
						id="mcImport"
						type="button"
						className="btn primary"
						disabled={ui.busy}
						onClick={() => importConvertedMindset()}
					>
						{"Import reviewed draft"}
					</Button>
					<Button
						id="mcDownload"
						type="button"
						className="btn"
						disabled={ui.busy}
						onClick={() => downloadConvertedMindset()}
					>
						{"Download JSON"}
					</Button>
				</div>
			</section>
		</details>
	);
}
