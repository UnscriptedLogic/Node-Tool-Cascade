import type { ComponentType } from "react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { initialize } from "./bootstrap.ts";

export { flushSync as sync } from "react-dom";
export { proxy, ref, snapshot, subscribe } from "valtio/vanilla";
export { legacy } from "./bootstrap.ts";
export { connect } from "./bridge.ts";

import "./ui.css";

const islands = new Map<string, ComponentType>();
const roots = new Map<string, { root: Root; el: Element }>();

export function register(name: string, component: ComponentType) {
	islands.set(name, component);
}

export function mount(name: string, el: Element | null) {
	const Component = islands.get(name);
	if (!Component) throw new Error(`Unknown Cascade UI island: ${name}`);
	if (el?.nodeType !== 1)
		throw new Error(`Missing container for Cascade UI island: ${name}`);
	const existing = roots.get(name);
	if (existing) {
		if (existing.el !== el)
			throw new Error(`Cascade UI island already mounted: ${name}`);
		return;
	}
	const root = createRoot(el);
	roots.set(name, { root, el });
	// Legacy startup code queries island elements immediately after the first mount.
	flushSync(() => root.render(createElement(Component)));
}

export function unmount(name: string) {
	const entry = roots.get(name);
	if (!entry) return false;
	entry.root.unmount();
	roots.delete(name);
	return true;
}

const container = document.getElementById("root");
if (container) {
	flushSync(() => createRoot(container).render(<App />));
	initialize();
}

import "../app/css/base.css";
import "../app/css/rail.css";
import "../app/css/blocks.css";
import "../app/css/stage.css";
import "../app/css/hud.css";
import "../app/css/goal-settings.css";
import "../app/css/map.css";
import "../app/css/ask.css";
import "../app/css/interaction.css";
import "../app/css/look-editor.css";
import "../app/css/project.css";
import "../app/css/library.css";
import "../app/css/mobile.css";
