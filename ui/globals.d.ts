import type { View } from "../shared/types.ts";
import type { ServerSettings } from "./model.ts";

declare global {
	interface Navigator {
		globalPrivacyControl?: boolean;
	}
	interface Window {
		doNotTrack?: string;
		__LOCAL__?: boolean;
		__WEB__?: boolean;
		__SETTINGS__?: ServerSettings;
		__CASCADE_SAVED__?: { tree: string; view: View };
		__DEMO_FAST__?: boolean;
		__POLL_MS?: number;
		__navigate?: (url: string) => void;
		claude?: {
			use(
				name: "sample",
			): Promise<
				(prompt: string, options?: object) => Promise<{ text: string }>
			>;
		};
		google?: {
			accounts: {
				id: {
					initialize(options: {
						client_id: string;
						ux_mode?: string;
						auto_select?: boolean;
						callback(response: { credential: string }): void;
					}): void;
					renderButton(el: HTMLElement, options: object): void;
					disableAutoSelect(): void;
					prompt(): void;
				};
			};
		};
	}
	const claude: Window["claude"];
	const google: Window["google"];
}
declare module "react" {
	interface CSSProperties {
		[key: `--${string}`]: string | number;
	}
}
