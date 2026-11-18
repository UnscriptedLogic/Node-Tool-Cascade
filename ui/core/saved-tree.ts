import { isRecord } from "../../shared/types.ts";
import type { SavedTree } from "../model.ts";

export function decodeSavedTree(value: unknown): SavedTree | null {
	if (!isRecord(value) || !isRecord(value.nodes) || !Array.isArray(value.order))
		return null;
	// Preserve the historical envelope check; individual nodes and optional fields pass through.
	return value as SavedTree;
}
