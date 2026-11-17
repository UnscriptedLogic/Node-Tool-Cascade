import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { useFocus } from "../hooks/useFocus.ts";
import {
	closeSrcView,
	copySource,
	onSourceKeyDown,
	SV,
	stepSource,
} from "../legacy/features/project.ts";

export default function SourceViewer() {
	useEffect(() => {
		window.addEventListener("keydown", onSourceKeyDown, true);
		return () => window.removeEventListener("keydown", onSourceKeyDown, true);
	}, []);

	const close = useFocus<HTMLButtonElement>("sourceClose");
	const source = useSnapshot(SV, { sync: true }),
		current = source.list[source.i];
	return (
		<div
			id="srcview"
			role="dialog"
			aria-modal="true"
			aria-labelledby="svTitle"
			hidden={!source.open}
		>
			<div className="svcard">
				<header>
					<b id="svTitle">
						{current
							? current.f +
								":" +
								current.l +
								(current.e > current.l ? `-${current.e}` : "")
							: ""}
					</b>
					<Button
						className="btn"
						id="svClose"
						ref={close}
						type="button"
						onClick={() => closeSrcView()}
					>
						Close
					</Button>
				</header>
				<p id="svNote" className="svnote" hidden={!current?.note}>
					{current?.note}
				</p>
				<pre id="svCode" className="svcode">
					{source.loading
						? "Loading…"
						: source.error ||
							source.lines.map((line) => (
								<div
									className={`ln${line.hit ? " hit" : ""}`}
									key={line.number}
								>
									<span className="no">{line.number}</span>
									<span>{line.text || " "}</span>
								</div>
							))}
				</pre>
				<footer>
					<span id="svPos" className="small">
						{source.list.length > 1
							? `${source.i + 1} of ${source.list.length}`
							: ""}
					</span>
					<span>
						<Button
							className="btn"
							id="svPrev"
							type="button"
							disabled={source.list.length < 2}
							onClick={() => stepSource(-1)}
						>
							Previous
						</Button>{" "}
						<Button
							className="btn"
							id="svNext"
							type="button"
							disabled={source.list.length < 2}
							onClick={() => stepSource(1)}
						>
							Next
						</Button>{" "}
						<Button
							className="btn"
							id="svCopy"
							type="button"
							onClick={() => copySource()}
						>
							{source.copyText}
						</Button>
					</span>
				</footer>
			</div>
		</div>
	);
}
