import { proxy } from "valtio/vanilla";
export type FocusTarget =
	| "settingsClose"
	| "settingsButton"
	| "chatPrompt"
	| "goal"
	| "mapDestination"
	| "sourceClose";
export const focusRequest = proxy<{
	target: FocusTarget | null;
	select: boolean;
	revision: number;
}>({ target: null, select: false, revision: 0 });
