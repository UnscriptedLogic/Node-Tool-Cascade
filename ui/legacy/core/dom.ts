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
}
