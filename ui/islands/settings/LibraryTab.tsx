import Library from "../Library.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function LibraryTab() {
	return (
		<SettingsPane value="library">
			<h3>{"Library"}</h3>
			<p className="lead">
				{
					"Keep several Cascades and group them in folders. The one you have open saves itself as you work."
				}
			</p>
			<div id="libraryRoot" className="cui">
				<Library />
			</div>
		</SettingsPane>
	);
}
