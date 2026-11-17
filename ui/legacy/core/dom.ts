export interface CanvasElements {
	stage: HTMLElement;
	world: HTMLDivElement;
	gEdges: SVGGElement;
	gTh: SVGGElement;
	elabel: SVGTextElement;
}
export let stage: HTMLElement,
	world: HTMLDivElement,
	gEdges: SVGGElement,
	gTh: SVGGElement,
	elabel: SVGTextElement;
export function setCanvasElements(elements: CanvasElements) {
	({ stage, world, gEdges, gTh, elabel } = elements);
}
export function startDom() {}
