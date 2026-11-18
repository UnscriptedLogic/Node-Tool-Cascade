import { useSnapshot } from "valtio";
import { SETTINGS } from "../../legacy/shell/settings.ts";
import Library from "../Library.tsx";
export default function LibraryTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	return (
		<section
			className="spane"
			id="p-library"
			role="tabpanel"
			hidden={settings.tab !== "library"}
		>
			<h3>{"Library"}</h3>
			<p className="lead">
				{
					"Keep several Cascades and group them in folders. The one you have open saves itself as you work."
				}
			</p>
			<div id="libraryRoot" className="cui">
				<Library />
			</div>
		</section>
	);
}
