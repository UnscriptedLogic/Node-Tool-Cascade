import { useRef } from "react";
import { useServerLifecycle } from "../hooks/useServerLifecycle.ts";
import Menu from "../islands/Menu.tsx";
import Rail from "../islands/Rail.tsx";
import Settings from "../islands/Settings.tsx";
import SourceViewer from "../islands/SourceViewer.tsx";
import { CanvasHost } from "./CanvasHost.tsx";
export function App() {
	useServerLifecycle();
	const appElement = useRef<HTMLDivElement>(null);
	return (
		<>
			<div id="app" ref={appElement}>
				<div id="railRoot" className="cui" style={{ display: "contents" }}>
					<Rail />
				</div>

				<CanvasHost />
			</div>

			<div id="menuRoot" className="cui">
				<Menu />
			</div>

			<div id="settingsRoot" className="cui">
				<Settings appElement={appElement} />
			</div>

			<div id="sourceRoot" className="cui">
				<SourceViewer />
			</div>
		</>
	);
}
