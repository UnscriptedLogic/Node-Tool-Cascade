import * as CascadeUI from "../../runtime.tsx";
import {
	$,
	ACT,
	CONNECTION,
	ICONS,
	LABEL,
	LOCAL,
	MOOD_KEYS,
	MOODS,
	PREFS,
	WEB,
} from "./constants.ts";
import { DOMAINS } from "./profiles.ts";
import { AI, hist, S, UI } from "./state.ts";
export let stage: HTMLDivElement,
	world: HTMLDivElement,
	gEdges: SVGGElement,
	gTh: SVGGElement,
	elabel: HTMLDivElement;
export function initialize() {
	stage = $("#stage");
	world = $("#world");
	gEdges = $("#eg");
	gTh = $("#th");
	elabel = $("#elabel");
	CascadeUI.connect({
		S,
		PREFS,
		UI,
		AI,
		CONNECTION,
		hist,
		ICONS,
		ACT,
		LABEL,
		DOMAINS,
		MOODS,
		MOOD_KEYS,
		LOCAL,
		WEB,
	});
	CascadeUI.mount("rail", $("#railRoot"));
	CascadeUI.mount("hud", $("#hudRoot"));
	CascadeUI.mount("compose", $("#composeRoot"));
	CascadeUI.mount("menu", $("#menuRoot"));
}
