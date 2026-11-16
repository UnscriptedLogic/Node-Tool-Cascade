import type MindsetConversion from "../shared/mindset-conversion.ts";
import type MINDSET_PRESETS from "../shared/mindset-presets.ts";
import type Mindsets from "../shared/mindsets.ts";
import type * as prompts from "./legacy/ai/prompts.ts";
import type * as transport from "./legacy/ai/transport.ts";
import type * as boot from "./legacy/boot.ts";
import type * as edges from "./legacy/canvas/edges.ts";
import type * as interaction from "./legacy/canvas/interaction.ts";
import type * as layout from "./legacy/canvas/layout.ts";
import type * as look from "./legacy/canvas/look.ts";
import type * as view from "./legacy/canvas/view.ts";
import type * as analytics from "./legacy/core/analytics.ts";
import type * as constants from "./legacy/core/constants.ts";
import type * as dom from "./legacy/core/dom.ts";
import type * as profiles from "./legacy/core/profiles.ts";
import type * as server from "./legacy/core/server.ts";
import type * as model from "./legacy/core/state.ts";
import type * as tree from "./legacy/core/tree.ts";
import type * as ask from "./legacy/features/ask.ts";
import type * as chatExchange from "./legacy/features/chat-exchange.ts";
import type * as library from "./legacy/features/library.ts";
import type * as map from "./legacy/features/map.ts";
import type * as converter from "./legacy/features/mindset-converter.ts";
import type * as mindsets from "./legacy/features/mindsets.ts";
import type * as project from "./legacy/features/project.ts";
import type * as actions from "./legacy/ui/actions.ts";
import type * as compose from "./legacy/ui/compose.ts";
import type * as controls from "./legacy/ui/controls.ts";
import type * as hud from "./legacy/ui/hud.ts";
import type * as lookEditor from "./legacy/ui/look-editor.ts";
import type * as responsive from "./legacy/ui/responsive.ts";
import type * as settings from "./legacy/ui/settings.ts";

type Exports<T> = Omit<T, "state" | "initialize">;
type StateOf<T> = T extends { state: infer S } ? S : Record<never, never>;
export type LegacyActions = Exports<typeof prompts> &
	Exports<typeof transport> &
	Exports<typeof boot> &
	Exports<typeof edges> &
	Exports<typeof interaction> &
	Exports<typeof layout> &
	Exports<typeof look> &
	Exports<typeof view> &
	Exports<typeof analytics> &
	Exports<typeof constants> &
	Exports<typeof dom> & { MindsetConversion: typeof MindsetConversion } & {
		MINDSET_PRESETS: typeof MINDSET_PRESETS;
	} & { Mindsets: typeof Mindsets } & Exports<typeof profiles> &
	Exports<typeof server> &
	Exports<typeof model> &
	Exports<typeof tree> &
	Exports<typeof ask> &
	Exports<typeof chatExchange> &
	Exports<typeof library> &
	Exports<typeof map> &
	Exports<typeof converter> &
	Exports<typeof mindsets> &
	Exports<typeof project> &
	Exports<typeof actions> &
	Exports<typeof compose> &
	Exports<typeof controls> &
	Exports<typeof hud> &
	Exports<typeof lookEditor> &
	Exports<typeof responsive> &
	Exports<typeof settings> &
	StateOf<typeof prompts> &
	StateOf<typeof transport> &
	StateOf<typeof boot> &
	StateOf<typeof edges> &
	StateOf<typeof interaction> &
	StateOf<typeof layout> &
	StateOf<typeof look> &
	StateOf<typeof view> &
	StateOf<typeof analytics> &
	StateOf<typeof constants> &
	StateOf<typeof dom> &
	StateOf<typeof profiles> &
	StateOf<typeof server> &
	StateOf<typeof model> &
	StateOf<typeof tree> &
	StateOf<typeof ask> &
	StateOf<typeof chatExchange> &
	StateOf<typeof library> &
	StateOf<typeof map> &
	StateOf<typeof converter> &
	StateOf<typeof mindsets> &
	StateOf<typeof project> &
	StateOf<typeof actions> &
	StateOf<typeof compose> &
	StateOf<typeof controls> &
	StateOf<typeof hud> &
	StateOf<typeof lookEditor> &
	StateOf<typeof responsive> &
	StateOf<typeof settings>;
export type LegacyContext = LegacyActions & {
	actions: LegacyActions;
	getLook: typeof look.effLook;
	lookSheet: string;
};
