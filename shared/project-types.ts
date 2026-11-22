export interface ProjectCounts {
	files?: number;
	chunks?: number;
	textKB?: number;
	tokensEst?: number;
	indexTruncated?: boolean;
}
export interface ProjectGroup {
	id: string;
	label: string;
	files: string[];
	changed: boolean;
	fingerprint: string;
	chars: number;
	digest: string;
	excerpts: string;
	score: number;
}
export interface ProjectFinding {
	id: string;
	text?: string;
	file?: string;
	line?: number;
	group?: string;
	type?: string;
}
export interface ProjectInfo {
	has?: boolean;
	root?: string;
	engine?: string;
	engineLabel?: string;
	scannedAt?: number;
	counts?: ProjectCounts;
	skipped?: Record<string, number>;
	redactions?: number;
	byExt?: { ext: string; files: number }[];
	topDirs?: { dir: string; kb: number }[];
	diff?: { added: string[]; changed: string[]; removed: string[] };
	ignore?: string[];
	include?: string[];
	engineIgnore?: string[];
	brief?: string;
	briefMeta?: {
		at?: number;
		model?: string;
		groups?: number;
		edited?: boolean;
	};
	findingCount?: number;
	scanning?: object;
}
export interface SearchHit {
	file: string;
	start: number;
	end: number;
	text: string;
}
