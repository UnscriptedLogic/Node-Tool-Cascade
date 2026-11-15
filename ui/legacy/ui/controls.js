import { stage } from "../core/dom.js";
import { applyView, fitTo, zoomAt } from "../canvas/view.js";
import { visibleIds } from "../core/tree.js";
import { isMobile } from "./responsive.js";
import { cancelAI } from "../ai/prompts.js";
export let stageCenter;
export function zoomCanvas(factor) {
  const center = stageCenter();
  zoomAt(factor, center.x, center.y);
}
export function fitCanvas() {
  fitTo(visibleIds(), {
    maxZ: 1,
    minZ: isMobile() ? .6 : .3,
    pad: isMobile() ? 24 : 56
  });
}
export function stopCanvasAI() {
  cancelAI();
}
export function initialize() {
  stageCenter = () => ({
    x: stage.clientWidth / 2,
    y: stage.clientHeight / 2
  });
  addEventListener('resize', applyView);
}
