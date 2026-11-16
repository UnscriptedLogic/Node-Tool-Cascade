import { connect } from "../../bridge.ts";
import { mount } from "../../runtime.tsx";
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
export function startDom() {
	stage = $("#stage");
	world = $("#world");
	gEdges = $("#eg");
	gTh = $("#th");
	elabel = $("#elabel");
	connect({
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
	mount("rail", $("#railRoot"));
	mount("hud", $("#hudRoot"));
	mount("compose", $("#composeRoot"));
	mount("menu", $("#menuRoot"));
}
