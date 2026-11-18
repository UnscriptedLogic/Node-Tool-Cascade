import { useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { ICONS, LABEL, PREFS } from "../legacy/core/constants.ts";
import { DOMAINS } from "../legacy/core/profiles.ts";
import { UI } from "../legacy/core/state.ts";
import { closeCompose, submitCompose } from "../legacy/ui/compose.ts";

export default function Compose() {
	const ui = useSnapshot(UI, { sync: true }),
		prefs = useSnapshot(PREFS, { sync: true }),
		input = useRef<HTMLTextAreaElement>(null);
	const compose = ui.compose,
		domain = DOMAINS[prefs.domain] || DOMAINS.general;
	useLayoutEffect(() => {
		if (compose.open) input.current?.focus();
	}, [compose.open, compose.focus]);
	return (
		<div
			id="compose"
			hidden={!compose.open}
			role="dialog"
			aria-label="New block"
			style={
				ui.small
					? undefined
					: { width: compose.w, left: compose.x, top: compose.y }
			}
		>
			<div className="chead">
				<span
					className="ico"
					dangerouslySetInnerHTML={{ __html: ICONS[compose.type] }}
				/>
				<span className="cname">{LABEL[compose.type]}</span>
			</div>
			<textarea
				ref={input}
				rows={2}
				maxLength={220}
				aria-label="Block text"
				placeholder={domain.blocks[compose.type]}
				value={compose.text}
				onChange={() => {}}
				onInput={(e) => {
					UI.compose.text = e.currentTarget.value;
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submitCompose();
					} else if (e.key === "Escape") {
						e.preventDefault();
						closeCompose();
					}
				}}
			/>
			<div className="row">
				<span>Enter to place</span>
				<span>
					<Button
						className="btn"
						id="cCancel"
						type="button"
						onClick={() => closeCompose()}
					>
						Cancel
					</Button>{" "}
					<Button
						className="btn primary"
						id="cOk"
						type="button"
						onClick={() => submitCompose()}
					>
						Place
					</Button>
				</span>
			</div>
		</div>
	);
}
