import { memo, useLayoutEffect, useRef } from "react";
import { useViewport } from "../hooks/useViewport.ts";
import Compose from "../islands/Compose.tsx";
import Hud from "../islands/Hud.tsx";
import SidePanel from "../islands/SidePanel.tsx";
import { setCanvasElements } from "../legacy/core/dom.ts";

export const CanvasHost = memo(function CanvasHost() {
	useViewport();
	const stage = useRef<HTMLElement>(null);
	const world = useRef<HTMLDivElement>(null);
	const eg = useRef<SVGGElement>(null);
	const th = useRef<SVGGElement>(null);
	const elabel = useRef<SVGTextElement>(null);
	useLayoutEffect(() => {
		setCanvasElements({
			stage: stage.current,
			world: world.current,
			gEdges: eg.current,
			gTh: th.current,
			elabel: elabel.current,
		});
	}, []);
	return (
		<main id="stage" ref={stage} aria-label="Design tree canvas">
			<div id="grid" aria-hidden="true"></div>
			<div id="world" ref={world}>
				<svg id="edges" aria-hidden="true">
					<defs>
						<marker
							id="ah"
							viewBox="0 0 10 10"
							refX="8"
							refY="5"
							markerWidth="8"
							markerHeight="8"
							orient="auto-start-reverse"
						>
							<path
								d="M1.5 1.5 8.5 5 1.5 8.5"
								fill="none"
								style={{ stroke: "var(--ink2)" }}
								strokeWidth="1.7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</marker>
					</defs>
					<g id="eg" ref={eg}></g>
					<g id="th" ref={th}></g>
					<text id="elabel" ref={elabel} className="elabel"></text>
				</svg>
			</div>

			<div id="hudRoot" className="cui" style={{ display: "contents" }}>
				<Hud />
			</div>

			<div id="sideRoot" className="cui">
				<SidePanel />
			</div>

			<div id="composeRoot" className="cui" style={{ display: "contents" }}>
				<Compose />
			</div>
		</main>
	);
});
