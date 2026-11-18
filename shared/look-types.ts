// The portable appearance patch stored with settings and edited by the UI.
export interface LookSettings {
	nodes?: Record<string, Record<string, unknown>>;
	wires?: Record<string, unknown>;
	canvas?: Record<string, unknown>;
	layout?: Record<string, unknown>;
	moods?: Record<string, string>;
}
