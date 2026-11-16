import { useSnapshot } from "valtio";
import LegacyTemplate from "../components/LegacyTemplate.tsx";
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
} from "../legacy/features/mindset-converter.ts";
import template from "../templates/converter-view.json";

export default function MindsetConverter() {
	const ui = useSnapshot(MSCONVERT, { sync: true });
	const bind = ({ tag, attrs }) => {
		const id = attrs.id,
			props: import("../components/LegacyTemplate.tsx").TemplateProps = {};
		if (["input", "textarea", "button"].includes(tag))
			props.disabled = ui.busy && id !== "mcStop";
		const field = {
			mcText: "text",
			mcName: "name",
			mcSourceTitle: "title",
			mcEdition: "edition",
			mcUrl: "url",
			mcLimit: "limit",
			mcJson: "json",
		}[id];
		if (field) {
			props.value = ui[field];
			props.onChange = () => {};
			props.onInput = (e) =>
				field === "text"
					? editMindsetSource(e.currentTarget.value)
					: setConversionField(field, e.currentTarget.value);
		}
		if (tag === "input" && attrs.type === "checkbox") {
			props.checked = ui.domains.includes(attrs.value);
			props.onChange = (e) =>
				setConversionDomain(attrs.value, e.currentTarget.checked);
		}
		if (id === "mcFiles")
			props.onChange = (e) => readMindsetSources([...e.currentTarget.files]);
		const text = {
			mcStatus: "status",
			mcSourceInfo: "info",
			mcReport: "report",
		}[id];
		if (text) props.children = ui[text];
		if (id === "mcReview") props.hidden = !ui.draft;
		if (id === "mcStop") props.hidden = !ui.busy;
		const action = {
			mcGenerate: generateMindsetDraft,
			mcStop: stopMindsetConversion,
			mcImport: importConvertedMindset,
			mcDownload: downloadConvertedMindset,
		}[id];
		if (action) props.onClick = () => action();
		return props;
	};
	return (
		<LegacyTemplate
			nodes={template}
			bind={bind}
			replace={({ attrs }) =>
				attrs.id === "mcEntries" ? (
					<div id="mcEntries" key="mcEntries">
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
				) : undefined
			}
		/>
	);
}
