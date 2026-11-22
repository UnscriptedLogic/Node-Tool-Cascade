import type { Domain } from "../../shared/types.ts";

export interface Preferences {
	domain: Domain;
	goal: string;
	context: string;
	pillars: string;
	avoid: string;
	steer: "light" | "balanced" | "strong";
	growSize: "small" | "medium" | "large";
	creativity: number;
	autoGrow: boolean;
	autoTrace: boolean;
	pushback: boolean;
	theme: "system" | "light" | "dark";
	mobileLayout: "standard" | "minimal";
	grillStyle: "round" | "single";
	quitOnClose: boolean;
	useProject: boolean;
	askFiles: boolean;
}
