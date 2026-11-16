import { mount } from "../../runtime.tsx";
import { $ } from "./constants.ts";
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
	mount("rail", $("#railRoot"));
	mount("hud", $("#hudRoot"));
	mount("compose", $("#composeRoot"));
	mount("menu", $("#menuRoot"));
}
