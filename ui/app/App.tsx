import Compose from "../islands/Compose.tsx";
import Hud from "../islands/Hud.tsx";
import Menu from "../islands/Menu.tsx";
import Rail from "../islands/Rail.tsx";
import Settings from "../islands/Settings.tsx";
import SidePanel from "../islands/SidePanel.tsx";
import SourceViewer from "../islands/SourceViewer.tsx";
export function App() {
	return (
		<>
			<div id="app">
				<div id="railRoot" className="cui" style={{ display: "contents" }}>
					<Rail />
				</div>

				<main id="stage" aria-label="Design tree canvas">
					<div id="grid" aria-hidden="true"></div>
					<div id="world">
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
							<g id="eg"></g>
							<g id="th"></g>
							<text id="elabel" className="elabel"></text>
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
			</div>

			<div id="menuRoot" className="cui">
				<Menu />
			</div>

			<div id="settingsRoot" className="cui">
				<Settings />
			</div>

			<div id="sourceRoot" className="cui">
				<SourceViewer />
			</div>
		</>
	);
}
