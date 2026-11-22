// The portable appearance patch stored with settings and edited by the UI.
export interface NodeAppearance {
	shape: string;
	radius: number | number[];
	fill: string;
	stroke: string;
	strokeWidth: number;
	strokeStyle: string;
	text: string;
	iconColor: string;
	fontSize: number;
	fontWeight: number;
	italic: boolean;
	icon: boolean;
	width: number;
	padX: number;
	padY: number;
	bar: { width: number; color: string } | null;
	ring: { width: number; color: string; offset: number } | null;
	pattern: string;
	shadow: string;
	opacity: number;
}
export interface WireKindAppearance {
	color?: string;
	width?: number;
	dash?: string;
	opacity?: number;
}
export interface WireAppearance {
	style: string;
	curvature: number;
	elbow: number;
	radius: number;
	width: number | null;
	color: string | null;
	opacity: number | null;
	dash: string | null;
	arrows: string;
	colorBy: string;
	kinds: Record<string, WireKindAppearance>;
}
export interface CanvasAppearance {
	bg: string | null;
	grid: string;
	gridColor: string | null;
	gridSize: number;
}
export interface LayoutAppearance {
	colGap: number;
	rowGap: number;
}
export interface LookSettings {
	nodes?: Record<string, Partial<NodeAppearance>>;
	wires?: Partial<WireAppearance>;
	canvas?: Partial<CanvasAppearance>;
	layout?: Partial<LayoutAppearance>;
	moods?: Record<string, string>;
}
export interface EffectiveLook {
	v: number;
	nodes: Record<string, NodeAppearance>;
	wires: WireAppearance;
	canvas: CanvasAppearance;
	layout: LayoutAppearance;
	moods: Record<string, string>;
}
