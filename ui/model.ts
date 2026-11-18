import type { EnabledMindset, MindsetMetadata } from "../shared/mindsets.ts";
import type { ProjectInfo } from "../shared/project-types.ts";
import type { PublicSettings } from "../shared/settings-types.ts";
import type { View } from "../shared/types.ts";
export interface TreeNode {
	id: string;
	type: string;
	text: string;
	parent: string | null;
	ghost?: boolean;
	rel?: string;
	mood?: string;
	mindset?: MindsetMetadata;
	collapsed?: boolean;
	back?: boolean;
	decided?: boolean;
	ticket?: string;
	state?: string;
	src?: { f: string; l: number; e?: number; t?: string; note?: string }[];
	why?: string;
	note?: string;
	side?: string;
	was?: string;
	unknown?: boolean;
}
export interface TreeLink {
	a: string;
	b: string;
	kind: string;
}
export interface CascadeTree {
	nodes: Record<string, TreeNode>;
	order: string[];
	links: TreeLink[];
	seq: number;
	mindsets: EnabledMindset[];
	view: View;
	mode: string;
	layer: boolean;
	sel: string | null;
}
export interface Point {
	x: number;
	y: number;
}
export interface RenderedNode {
	el: HTMLDivElement;
	cur: Point;
	tgt: Point;
	w: number;
	h: number;
	shown: boolean;
	fresh: boolean;
	drag?: boolean;
	dragging?: boolean;
	drop?: boolean;
	cull?: boolean;
	culled?: boolean;
	hot?: boolean;
	growing?: boolean;
	bx?: number;
	by?: number;
	width?: number;
	height?: number;
	anim?: number;
	editing?: boolean;
	enter?: boolean;
	tx?: number;
	ty?: number;
	sig?: string;
	actionSig?: string;
	kh?: number;
	sh?: number;
	settle?: boolean;
}
// Bootstrap may include project data before the settings endpoint is available.
export type ServerSettings = Partial<PublicSettings> & {
	project?: ProjectInfo;
};

export interface TreeMap {
	frontier: string[];
	blocked: string[];
	settled: string[];
	fog: string[];
	out: string[];
	flag: Record<string, string>;
	blockers?: Record<string, string[]>;
}

export type SavedTree = Pick<CascadeTree, "nodes" | "order"> &
	Partial<CascadeTree>;

export interface SourceLocation {
	f: string;
	l: number;
	e?: number;
	t?: string;
	note?: string;
}

export interface MenuSpec {
	title?: string;
	back?: MenuSpec;
	items: {
		sep?: boolean;
		disabled?: boolean;
		danger?: boolean;
		icon?: string;
		label?: string;
		sub?: MenuSpec;
		run?: () => void;
	}[];
}
export interface MenuState {
	spec: MenuSpec;
	at: { x?: number; y?: number; sheet?: boolean };
	focus: boolean;
}
export interface UiState {
	bye: boolean;
	busy: string | null;
	stoppable: boolean;
	note: (string | { b: string })[];
	noteOpen: boolean;
	noteUndo: boolean;
	small: boolean;
	minimal: boolean;
	panel: { open: boolean; tab: string } | null;
	ask: typeof import("./legacy/features/ask.ts").AN | null;
	library: typeof import("./legacy/features/library.ts").LIB | null;
	seed: boolean;
	providerLabels: Record<string, string>;
	settingsTitle: string;
	moodColors: Record<string, string>;
	compose: {
		open: boolean;
		type: string;
		text: string;
		x: number;
		y: number;
		w: number;
		wpos: Point | null;
		focus: number;
	};
	menu: MenuState | null;
}
export interface AiState {
	checked: boolean;
	sample:
		| ((prompt: string, options?: object) => Promise<{ text: string }>)
		| null;
	off: boolean;
}
