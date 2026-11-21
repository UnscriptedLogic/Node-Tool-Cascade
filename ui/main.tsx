import type { ComponentType } from "react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { start } from "./start.ts";

export { flushSync as sync } from "react-dom";
export { proxy, ref, snapshot, subscribe } from "valtio/vanilla";
export { testApi } from "./test-api.ts";

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
	start();
}

import "./styles/base.css";
import "./styles/rail.css";
import "./styles/blocks.css";
import "./styles/stage.css";
import "./styles/hud.css";
import "./styles/goal-settings.css";
import "./styles/map.css";
import "./styles/ask.css";
import "./styles/interaction.css";
import "./styles/look-editor.css";
import "./styles/project.css";
import "./styles/library.css";
import "./styles/mobile.css";
