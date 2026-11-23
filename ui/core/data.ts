export const svg = (d) =>
	`<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS: Record<string, string> = {
	question: svg(
		'<circle cx="8" cy="8" r="6.3"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.4"/><path d="M8 11.5v.1"/>',
	),
	answer: svg(
		'<path d="M3 3v4.5A2.5 2.5 0 0 0 5.5 10H12"/><path d="M9.5 7.5 12 10l-2.5 2.5"/>',
	),
	emotion: svg('<path d="M1.5 8h3l1.7-4.5 3 9L11 8h3.5"/>'),
	consequence: svg(
		'<path d="M8 2.5v4"/><path d="M8 6.5 4 10.5M8 6.5l4 4"/><circle cx="4" cy="12.2" r="1.2"/><circle cx="12" cy="12.2" r="1.2"/>',
	),
	decision: svg('<path d="M8 1.8 14.2 8 8 14.2 1.8 8z"/>'),
	loop: svg(
		'<path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.8"/><path d="M13.3 2.4v3h-3"/>',
	),
	fog: svg(
		'<path d="M4.5 12.5h7a2.5 2.5 0 0 0 .3-5A3.7 3.7 0 0 0 4.6 7.2 2.7 2.7 0 0 0 4.5 12.5z"/>',
	),
	file: svg('<path d="M4 1.8h5.2L12.5 5v9.2H4z"/><path d="M9 1.8V5h3.5"/>'),
};
export const ACT: Record<string, string> = {
	mindset: svg('<path d="M5 10a4 4 0 1 1 6 0l-1 1.5H6zM6 14h4"/>'),
	accept: svg('<path d="m3.5 8.5 3 3 6-7"/>'),
	dismiss: svg('<path d="m4 4 8 8M12 4l-8 8"/>'),
	grow: svg(
		'<path d="M8 1.5c.4 3.2 1.6 5 5.5 6.5-3.9 1.5-5.1 3.3-5.5 6.5-.4-3.2-1.6-5-5.5-6.5C6.4 6.5 7.6 4.7 8 1.5z"/>',
	),
	collapse: svg(
		'<path d="M9.3 3.2v3.5h3.5M13.5 2.5 9.3 6.7M3.2 9.3h3.5v3.5M2.5 13.5l4.2-4.2"/>',
	),
	del: svg('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8"/>'),
	// arrows out to two corners, like open
	expand: svg(
		'<path d="M10 2.5h3.5V6M13.5 2.5 9.3 6.7M6 13.5H2.5V10M2.5 13.5l4.2-4.2"/>',
	),
	// expand: arrows out to two corners
	open: svg(
		'<path d="M10 2.5h3.5V6M13.5 2.5 9.3 6.7M6 13.5H2.5V10M2.5 13.5l4.2-4.2"/>',
	),
	resolve: svg(
		'<circle cx="8" cy="8" r="6.3"/><path d="m5.3 8.3 1.9 1.9 3.5-4"/>',
	),
	reopen: svg('<path d="M3 8a5 5 0 1 1 1.6 3.7"/><path d="M3 12V8.5h3.5"/>'),
	grill: svg('<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>'),
	ticket: svg(
		'<path d="M2.5 8.5V3h5.5l5.5 5.5-5.5 5.5z"/><circle cx="5.5" cy="5.5" r=".8"/>',
	),
	block: svg(
		'<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>',
	),
	out: svg('<circle cx="8" cy="8" r="6.3"/><path d="M5 8h6"/>'),
	sharpen: svg('<path d="m3 13 .8-3L11 2.8l2.2 2.2L6 12.2z"/>'),
	bridge: svg(
		'<circle cx="3" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/><path d="M4.6 8h6.8" stroke-dasharray="1.6 1.8"/><path d="M6.2 8h3.6"/>',
	),
	back: svg(
		'<path d="M12.5 12.5V7.5a3 3 0 0 0-3-3H3.5"/><path d="M6 2 3.5 4.5 6 7"/>',
	),
	delb: svg(
		'<path d="M2.5 4h7M5 4V2.8h2V4M3.5 4l.5 7h4l.5-7"/><path d="M11.5 6v3.5M11.5 9.5l-1.8 2M11.5 9.5l1.8 2"/>',
	),
	src: svg(
		'<path d="M4 1.8h5.2L12.5 5v9.2H4z"/><path d="M9 1.8V5h3.5"/><path d="M6 8.5h4M6 11h4"/>',
	),
};
