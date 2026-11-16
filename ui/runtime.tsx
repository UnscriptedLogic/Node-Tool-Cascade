import type { ComponentType } from "react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import Ask from "./islands/Ask.tsx";
import ChatExchange from "./islands/ChatExchange.tsx";
import Compose from "./islands/Compose.tsx";
import Hud from "./islands/Hud.tsx";
import Library from "./islands/Library.tsx";
import LookEditor from "./islands/LookEditor.tsx";
import Menu from "./islands/Menu.tsx";
import MindsetConverter from "./islands/MindsetConverter.tsx";
import Mindsets from "./islands/Mindsets.tsx";
import Project from "./islands/Project.tsx";
import Rail from "./islands/Rail.tsx";
import Settings from "./islands/Settings.tsx";
import SidePanel from "./islands/SidePanel.tsx";
import SourceViewer from "./islands/SourceViewer.tsx";
import "./ui.css";

export { flushSync as sync } from "react-dom";
export { proxy, ref, snapshot, subscribe } from "valtio/vanilla";
export { connect } from "./bridge.ts";

const islands = new Map<string, ComponentType>();
const roots = new Map<string, { root: Root; el: Element }>();
islands.set("library", Library);
islands.set("settings", Settings);
islands.set("look", LookEditor);
islands.set("side", SidePanel);
islands.set("ask", Ask);
islands.set("project", Project);
islands.set("source", SourceViewer);
islands.set("hud", Hud);
islands.set("rail", Rail);
islands.set("compose", Compose);
islands.set("menu", Menu);
islands.set("mindsets", Mindsets);
islands.set("converter", MindsetConverter);
islands.set("chat", ChatExchange);

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
