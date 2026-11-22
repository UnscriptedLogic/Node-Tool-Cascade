import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import {
	closeSrcView,
	copySource,
	onSourceKeyDown,
	SV,
	stepSource,
} from "../features/project.ts";
import { useFocus } from "../hooks/useFocus.ts";

export default function SourceViewer() {
	useEffect(() => {
		window.addEventListener("keydown", onSourceKeyDown, true);
		return () => window.removeEventListener("keydown", onSourceKeyDown, true);
	}, []);

	const close = useFocus<HTMLButtonElement>("sourceClose");
	const source = useSnapshot(SV, { sync: true }),
		current = source.list[source.i];
	return (
		<DialogPrimitive.Root
			open={source.open}
			onOpenChange={(open) => {
				if (!open) closeSrcView();
			}}
		>
			<DialogPrimitive.Portal
				container={document.getElementById("sourceRoot") || undefined}
			>
				<DialogPrimitive.Content
					id="srcview"
					aria-labelledby="svTitle"
					aria-describedby={undefined}
					onOpenAutoFocus={(event) => event.preventDefault()}
				>
					<div className="svcard">
						<header>
							<DialogPrimitive.Title asChild>
								<b id="svTitle">
									{current
										? `${current.f}:${current.l}${
												current.e !== undefined && current.e > current.l
													? `-${current.e}`
													: ""
											}`
										: ""}
								</b>
							</DialogPrimitive.Title>
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
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
