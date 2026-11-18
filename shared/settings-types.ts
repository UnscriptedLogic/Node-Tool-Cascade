import type { LookSettings } from "./look-types.ts";
import type {
	ProjectFinding,
	ProjectGroup,
	ProjectInfo,
	SearchHit,
} from "./project-types.ts";
export interface ProviderPatch {
	key?: string | null;
	model?: string;
	baseUrl?: string;
}
export interface ProviderStatus {
	ready?: boolean;
	hasKey?: boolean;
	hint?: string;
	source?: string | null;
	model?: string;
	effectiveModel?: string;
	baseUrl?: string;
	effectiveBase?: string;
	defaultModel?: string;
	account?: { email?: string; name?: string; plan?: string };
	pending?: boolean;
	lastError?: string;
	installed?: boolean;
}
export interface PublicSettings {
	local?: boolean;
	cloud?: boolean;
	active: string;
	providers: Record<string, ProviderStatus>;
	ready?: boolean;
	prefs?: Record<string, string | number | boolean>;
	look?: LookSettings;
	server?: { port: number; preferred: number; pid: number };
}
export interface SettingsPatch {
	active?: string;
	prefs?: unknown;
	look?: LookSettings;
	clearAllKeys?: boolean;
	providers?: Record<string, ProviderPatch>;
}
export interface ApiReply extends Partial<PublicSettings>, ProjectInfo {
	detail?: string;
	error?: string;
	models?: string[];
	ok?: boolean;
	ms?: number;
	reply?: string;
	url?: string;
	results?: SearchHit[];
	groups?: ProjectGroup[];
	path?: string;
	running?: boolean;
	files?: number;
	dirs?: number;
	info?: ProjectInfo;
	text?: string;
	start?: number;
	findings?: ProjectFinding[];
	project?: ProjectInfo;
}
