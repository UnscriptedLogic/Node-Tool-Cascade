import { cancelAI } from "../ai/prompts.ts";
import { applyView, fitTo, zoomAt } from "../canvas/view.ts";
import { stage } from "../core/dom.ts";
import { visibleIds } from "../core/tree.ts";
import { isMobile } from "./responsive.ts";
export function zoomCanvas(factor) {
	const center = stageCenter();
	zoomAt(factor, center.x, center.y);
}
export function fitCanvas() {
	fitTo(visibleIds(), {
		maxZ: 1,
		minZ: isMobile() ? 0.6 : 0.3,
		pad: isMobile() ? 24 : 56,
	});
}
export function stopCanvasAI() {
	cancelAI();
}
export const stageCenter = () => ({
	x: stage.clientWidth / 2,
	y: stage.clientHeight / 2,
});

export function initialize() {
	addEventListener("resize", applyView);
}
