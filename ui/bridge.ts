import type { LegacyActions, LegacyContext } from "./legacy-types.ts";

const legacy = {} as LegacyContext;

export function connect(values: Partial<LegacyContext>) {
	Object.assign(legacy, values);
}
export function getLegacy(): LegacyContext {
	return legacy;
}

type ActionName = {
	[K in keyof LegacyActions]: LegacyActions[K] extends (
		...args: never[]
	) => unknown
		? K
		: never;
}[keyof LegacyActions];
export function call<K extends ActionName>(
	name: K,
	...args: Parameters<LegacyActions[K]>
): ReturnType<LegacyActions[K]> {
	const action = legacy.actions[name] as (
		...values: Parameters<LegacyActions[K]>
	) => ReturnType<LegacyActions[K]>;
	return action(...args);
}
