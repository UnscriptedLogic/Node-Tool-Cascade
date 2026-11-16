declare module "gifenc" {
	export type Palette = number[][];
	function quantize(
		rgba: Uint8Array,
		maxColors: number,
		options?: { format?: string },
	): Palette;
	function applyPalette(
		rgba: Uint8Array,
		palette: Palette,
		format?: string,
	): Uint8Array;
	function GIFEncoder(): {
		writeFrame(
			indexed: Uint8Array,
			width: number,
			height: number,
			options: { palette: Palette; delay?: number; repeat?: number },
		): void;
		finish(): void;
		bytes(): Uint8Array;
	};
	const gifenc: {
		quantize: typeof quantize;
		applyPalette: typeof applyPalette;
		GIFEncoder: typeof GIFEncoder;
	};
	export default gifenc;
}
