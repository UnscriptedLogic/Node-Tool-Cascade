import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { LABEL, PREFS } from "../legacy/core/constants.ts";
import { DOMAINS } from "../legacy/core/profiles.ts";
import { S } from "../legacy/core/state.ts";
import {
	AHIST,
	AN,
	addGaps,
	copyAskSummary,
	openAskSource,
	restoreAsk,
	runAsk,
	setAskFiles,
	summarize,
	TCOL,
	toggleAskThread,
	VERDICT,
} from "../legacy/features/ask.ts";
import { focusNode } from "../legacy/features/map.ts";

export default function Ask() {
	const ask = useSnapshot(AN, { sync: true }),
		history = useSnapshot(AHIST, { sync: true }),
		state = useSnapshot(S, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true });
	const domain = DOMAINS[prefs.domain] || DOMAINS.general,
		sources = Object.fromEntries(
			ask.sources.map((source) => [source.id, source]),
		);
	return (
		<>
			<p className="gintro">
				Ask the graph a question. If a line of blocks answers it, that thread
				lights up on the canvas, numbered in order. If nothing answers it,
				you’ll see what’s missing.
			</p>
			<textarea
				id="aQ"
				className="area"
				rows={2}
				maxLength={300}
				data-dom-ph="askPlaceholder"
				placeholder={domain.askPlaceholder}
				value={ask.input}
				onChange={() => {}}
				onInput={(e) => {
					AN.input = e.currentTarget.value;
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						runAsk(AN.input);
					}
				}}
			/>
			<div className="chips" id="aChips">
				{[
					"What is causing the negative feelings?",
					"What is still undecided?",
					"How do the loops connect?",
				].map((question) => (
					<button
						type="button"
						className="chip"
						key={question}
						onClick={() => {
							AN.input = question;
							runAsk(question);
						}}
					>
						{question}
					</button>
				))}
			</div>
			<label
				className="check small"
				id="aFilesRow"
				data-modes="local"
				hidden={!ask.projectReady}
				style={{ marginTop: 8 }}
			>
				<input
					type="checkbox"
					id="aFiles"
					checked={prefs.askFiles}
					onChange={(e) => setAskFiles(e.currentTarget.checked)}
				/>
				<span>Also use the project’s files</span>
			</label>
			<div className="mrow">
				<Button
					className="btn primary"
					id="aGo"
					type="button"
					disabled={ask.busy}
					onClick={() => runAsk(AN.input)}
				>
					Ask
				</Button>
				<Button
					className="btn"
					id="aSumAll"
					type="button"
					disabled={ask.busy}
					onClick={() => summarize("tree")}
				>
					Summarize the whole tree
				</Button>
			</div>
			<div id="aRes" hidden={!ask.q || !ask.verdict}>
				<span id="aVerdict" className={`averdict ${ask.verdict}`}>
					{ask.verdict
						? VERDICT[ask.verdict] + (ask.local ? " (keyword match)" : "")
						: ""}
				</span>{" "}
				<span
					id="aBasis"
					className="averdict"
					hidden={!ask.basis || !ask.sources.length}
				>
					{
						{
							tree: "From the tree",
							code: "From the project files",
							both: "From the tree and the files",
						}[ask.basis]
					}
				</span>
				<div id="aAnswer" className="aanswer">
					{String(ask.answer)
						.split(/(\[f\d+\])/)
						.map((part, i) => {
							const id = part.match(/^\[(f\d+)\]$/)?.[1],
								source = sources[id];
							return source ? (
								<button
									key={i}
									type="button"
									className="cite"
									data-cite={id}
									onClick={() => openAskSource(id)}
								>
									{`${source.f.split("/").pop()}:${source.l}`}
								</button>
							) : (
								part
							);
						})}
				</div>
				<div id="aSources" className="msec" hidden={!ask.sources.length}>
					<h4>
						<div>From the project</div>
					</h4>
					<div id="aSourceList">
						{ask.sources.map((source) => (
							<div className="srcitem" key={source.id}>
								{source.note && <div>{source.note}</div>}
								<div className="where">
									<button
										type="button"
										className="cite"
										data-cite={source.id}
										onClick={() => openAskSource(source.id)}
									>
										{source.f +
											":" +
											source.l +
											(source.e > source.l ? `-${source.e}` : "")}
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
				<div id="aThreads">
					{ask.threads.map((thread, i) => (
						<div
							className={`athread${thread.on ? "" : " off"}`}
							data-i={i}
							key={i}
						>
							<div className="ath-head">
								<span className="swatch" style={{ background: TCOL[i % 3] }} />
								<b>{thread.label}</b>
								<Button
									className="btn"
									type="button"
									data-aact="toggle"
									onClick={() => toggleAskThread(i)}
								>
									{thread.on ? "Hide" : "Show"}
								</Button>
							</div>
							{thread.why && <div className="ath-why">{thread.why}</div>}
							<ol className="ath-steps">
								{thread.ids.map((id) => {
									const node = state.nodes[id];
									return node ? (
										<li key={id} data-id={id} onClick={() => focusNode(id)}>
											<i>{LABEL[node.type] || node.type}</i>
											{node.text}
										</li>
									) : null;
								})}
							</ol>
						</div>
					))}
				</div>
				<div id="aGaps" className="msec" hidden={!ask.gaps.length}>
					<h4>
						<div>What the tree is missing</div>
					</h4>
					<div id="aGapList">
						{ask.gaps.map((gap, i) => (
							<div className="gapitem" key={i}>
								{gap.text}
							</div>
						))}
					</div>
					<Button
						className="btn"
						id="aAddGaps"
						type="button"
						onClick={() => addGaps()}
					>
						Add as questions
					</Button>
				</div>
				<div className="mrow">
					<Button
						className="btn primary"
						id="aSum"
						type="button"
						disabled={ask.busy}
						hidden={!ask.threads.length}
						onClick={() => summarize("threads")}
					>
						Summarize this
					</Button>
					<label className="check small" hidden={!ask.threads.length}>
						<input
							type="checkbox"
							id="aNext"
							checked={ask.next}
							onChange={(e) => {
								AN.next = e.currentTarget.checked;
							}}
						/>
						<span>End with what to decide next</span>
					</label>
				</div>
			</div>
			<div
				id="aSummaryWrap"
				className="asummary"
				hidden={!ask.summary && !ask.summaryBusy}
			>
				<div className="asum-head">
					<b id="aSumLabel">
						{ask.summaryKind === "tree"
							? "Summary of the whole tree"
							: "Summary of the highlighted threads"}
					</b>
					<Button
						className="btn"
						id="aCopy"
						type="button"
						onClick={() => copyAskSummary()}
					>
						{ask.copyText}
					</Button>
				</div>
				<div id="aSumText">{ask.summary}</div>
			</div>
			<div
				id="aHistWrap"
				className="msec"
				hidden={!history.length}
				style={{ marginTop: 20 }}
			>
				<h4>
					<div>Recent questions</div>
				</h4>
				<div className="chips" id="aHist">
					{history.map((entry, i) => (
						<button
							type="button"
							className="chip"
							data-hi={i}
							key={entry.q}
							title={entry.q}
							onClick={() => restoreAsk(i)}
						>
							{entry.q.length > 44 ? `${entry.q.slice(0, 43)}…` : entry.q}
						</button>
					))}
				</div>
			</div>
		</>
	);
}
