import type { LegacyContext } from "./legacy-types.ts";

const legacy = {} as LegacyContext;

export function connect(values: Partial<LegacyContext>) {
	Object.assign(legacy, values);
}
export function getLegacy(): LegacyContext {
	return legacy;
}
