import type { ReactNode } from "react";
import { useSnapshot } from "valtio";
import { TabsContent } from "@/components/ui/tabs";
import { SETTINGS } from "../../shell/settings.ts";

// Each section keeps its own id, and its tab points at it.
export const tabId = (value: string) =>
	value === "library" ? "libTab" : `tab-${value}`;

// One Settings section. All stay mounted, so their fields keep state.
export default function SettingsPane({
	value,
	children,
}: {
	value: string;
	children: ReactNode;
}) {
	const settings = useSnapshot(SETTINGS, { sync: true });
	return (
		<TabsContent
			value={value}
			forceMount
			id={`p-${value}`}
			aria-labelledby={tabId(value)}
			className="spane"
			hidden={settings.tab !== value}
		>
			{children}
		</TabsContent>
	);
}
