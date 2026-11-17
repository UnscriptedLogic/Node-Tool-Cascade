import Menu from "../islands/Menu.tsx";
import Rail from "../islands/Rail.tsx";
import Settings from "../islands/Settings.tsx";
import SourceViewer from "../islands/SourceViewer.tsx";
import { CanvasHost } from "./CanvasHost.tsx";
export function App() {
	return (
		<>
			<div id="app">
				<div id="railRoot" className="cui" style={{ display: "contents" }}>
					<Rail />
				</div>

				<CanvasHost />
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
