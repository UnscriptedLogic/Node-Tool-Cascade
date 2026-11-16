import { useSnapshot } from "valtio";
import LegacyTemplate from "../components/LegacyTemplate.tsx";
import { S } from "../legacy/core/state.ts";
import { CHATUI, chatAction } from "../legacy/features/chat-exchange.ts";
import template from "../templates/chat-view.json";

export default function ChatExchange() {
	const chat = useSnapshot(CHATUI, { sync: true }),
		state = useSnapshot(S, { sync: true });
	const bind = ({ attrs }) => {
		const id = attrs.id,
			field = { chatTask: "task", chatPrompt: "prompt", chatReply: "reply" }[
				id
			],
			props: import("../components/LegacyTemplate.tsx").TemplateProps = {};
		if (field) {
			props.value = chat[field];
			props.onChange = () => {};
			props.onInput = (e) =>
				chatAction(
					field === "task"
						? "editTask"
						: field === "reply"
							? "editReply"
							: "editPrompt",
					e.currentTarget.value,
				);
		}
		if (id === "chatSteps") props.hidden = !chat.steps;
		if (id === "chatPreview") props.hidden = !chat.draft.length;
		if (id === "chatStatus") return { ...props, children: chat.status };
		const action = {
			chatPrepare: "prepare",
			chatCopy: "copy",
			chatReview: "review",
			chatImport: "importDraft",
		}[id];
		if (action) props.onClick = () => chatAction(action);
		return props;
	};
	return (
		<LegacyTemplate
			nodes={template}
			bind={bind}
			replace={({ attrs }) =>
				attrs.id === "chatSuggestions" ? (
					<ul key={attrs.id} id={attrs.id}>
						{chat.draft.map((row, i) => (
							<li key={i}>
								{row.type +
									": " +
									row.text +
									" — under “" +
									(state.nodes[row.parent]?.text || "") +
									"”"}
							</li>
						))}
					</ul>
				) : undefined
			}
		/>
	);
}
