export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
	| JsonPrimitive
	| JsonValue[]
	| { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);
export const record = (value: unknown): Record<string, unknown> =>
	isRecord(value) ? value : {};
export const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export interface View {
	x: number;
	y: number;
	z: number;
}
export type Domain = "general" | "product" | "research" | "game";
export interface TreePreferences {
	domain?: string;
	goal?: string;
	context?: string;
	pillars?: string;
	avoid?: string;
	steer?: string;
}
export interface CascadeData {
	tree: string;
	view: View | null;
	prefs: TreePreferences;
}
export interface Folder {
	id: string;
	name: string;
	createdAt: number;
}
export interface CascadeMeta {
	id: string;
	folderId: string | null;
	name: string;
	domain: string;
	createdAt: number;
	updatedAt: number;
}
export interface CascadeRecord extends CascadeMeta {
	data: CascadeData;
}
export interface LibraryStore {
	listFolders(uid: string): Promise<Folder[]>;
	createFolder(uid: string, folder: Folder): Promise<void>;
	updateFolder(uid: string, id: string, patch: { name: string }): Promise<void>;
	deleteFolder(uid: string, id: string): Promise<void>;
	listCascades(uid: string): Promise<CascadeMeta[]>;
	getCascade(uid: string, id: string): Promise<CascadeRecord | null>;
	putCascade(uid: string, record: CascadeRecord): Promise<void>;
	deleteCascade(uid: string, id: string): Promise<void>;
}
export interface Clock {
	now(): number;
	newId(): string;
}
export interface ProviderConfig {
	name?: string;
	kind: string;
	base: string;
	key?: string;
	model: string;
	extra?: { headers?: Record<string, string> };
}
export interface SampleOptions {
	prompt: string;
	maxTokens: number;
	temperature?: number;
	signal?: AbortSignal;
}
export type Delta = (text: string) => void;
