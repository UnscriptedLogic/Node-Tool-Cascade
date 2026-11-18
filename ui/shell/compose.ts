import { flushSync } from "react-dom";
import {
	enqueue,
	placeBlock,
	queuedCount,
	setController,
} from "../ai/prompts.ts";
import { dragUi } from "../canvas/interaction.ts";
import { decorate, nodeW } from "../canvas/look.ts";
import { screenToWorld } from "../canvas/view.ts";
import { clamp, ICONS, LABEL } from "../core/constants.ts";
import { stage } from "../core/dom.ts";
import { UI } from "../core/state.ts";
import { setBusy } from "./hud.ts";
/* ================= compose + palette ================= */
export function closeCompose() {
	// Native Escape must also commit the pending menu closure (test/mobile.test.ts:233).
	flushSync(() => {
		UI.compose.open = false;
	});
}
export function openCompose(type, cx, cy) {
	const sr = stage.getBoundingClientRect(),
		w = Math.min(300, sr.width - 24);
	const x = clamp(cx - sr.left - 24, 12, sr.width - w - 12),
		y = clamp(cy - sr.top - 24, 100, Math.max(100, sr.height - 190));
	// The caller reads the composer placement before returning (test/mobile.test.ts:39).
	flushSync(() => {
		Object.assign(UI.compose, {
			type,
			wpos: screenToWorld(cx, cy),
			x,
			y,
			w,
			text: "",
			open: true,
			focus: UI.compose.focus + 1,
		});
	});
}
export function submitCompose() {
	if (!UI.compose.open) return;
	const text = UI.compose.text.trim();
	if (!text) {
		UI.compose.focus++;
		return;
	}
	const { type, wpos, x, y } = UI.compose;
	closeCompose();
	const pend = document.createElement("div");
	pend.className = `pending blk t-${type}`;
	pend.style.left = `${x}px`;
	pend.style.top = `${y}px`;
	pend.innerHTML = '<span class="ico"></span><span class="txt"></span>';
	pend.querySelector(".ico").innerHTML = ICONS[type];
	pend.querySelector(".txt").textContent = text;
	decorate(pend, type, null);
	pend.style.width = `${nodeW(type)}px`;
	stage.appendChild(pend);
	enqueue(async () => {
		const c = new AbortController();
		setController(c);
		try {
			await placeBlock(type, text, wpos, pend, c.signal);
		} finally {
			setController(null);
			pend.remove();
			if (!queuedCount() || queuedCount() === 1) setBusy(null);
		}
	});
}
export function startTileDrag(
	e: Pick<PointerEvent, "preventDefault" | "clientX" | "clientY"> & {
		currentTarget: EventTarget;
	},
	type: string,
) {
	const t = e.currentTarget as HTMLElement;
	e.preventDefault();
	dragUi(true);
	const sx = e.clientX,
		sy = e.clientY;
	let moved = false,
		chip: Node | null = null,
		finished = false;
	const mv = (ev) => {
		if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
			moved = true;
			chip = t.cloneNode(true) as HTMLElement;
			(chip as HTMLElement).id = "chip";
			(chip as HTMLElement).removeAttribute("data-type");
			(chip as HTMLElement).className = `blk t-${type}`;
			(chip as HTMLElement).style.cssText = "";
			(chip as HTMLElement).innerHTML =
				`<span class="ico">${ICONS[type]}</span><span class="txt">${LABEL[type]}</span>`;
			decorate(chip as HTMLElement, type, null, {
				tile: true,
			});
			document.body.appendChild(chip);
			stage.classList.add("droptarget");
		}
		if (chip)
			(chip as HTMLElement).style.transform =
				`translate(${ev.clientX + 10}px,${ev.clientY + 10}px)`;
	};
	const up = (ev) => {
		if (finished) return;
		finished = true;
		dragUi(false);
		removeEventListener("pointerup", up);
		removeEventListener("pointermove", mv);
		removeEventListener("pointercancel", up);
		if (chip) (chip as HTMLElement).remove();
		stage.classList.remove("droptarget");
		const sr = stage.getBoundingClientRect();
		const inside =
			ev.clientX > sr.left &&
			ev.clientX < sr.right &&
			ev.clientY > sr.top &&
			ev.clientY < sr.bottom;
		if (!moved)
			openCompose(type, sr.left + sr.width / 2, sr.top + sr.height / 2);
		else if (inside && ev.type === "pointerup")
			openCompose(type, ev.clientX, ev.clientY);
	};
	addEventListener("pointermove", mv);
	addEventListener("pointerup", up);
	addEventListener("pointercancel", up);
}
