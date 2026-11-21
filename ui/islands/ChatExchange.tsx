import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { S } from "../core/state.ts";
import { CHATUI, chatAction } from "../features/chat-exchange.ts";
import { useFocus } from "../hooks/useFocus.ts";

export default function ChatExchange() {
	const prompt = useFocus<HTMLTextAreaElement>("chatPrompt");
	const chat = useSnapshot(CHATUI, { sync: true }),
		state = useSnapshot(S, { sync: true });
	return (
		<section className="prov" id="chatExchange">
			<h4>Use your chat account</h4>
			<p className="sub">
				Try real suggestions without an API key. Copy a prompt into ChatGPT or
				Claude, then paste its reply here. Free accounts work within their chat
				limits. You copy and paste by hand, so there is no account to link.
			</p>
			<p className="small">
				Select a node before opening Settings to focus on that branch. The
				prompt includes its accepted descendants and your goal, context,
				constraints, and enabled project brief. Review it before sharing.
			</p>
			<div className="field">
				<Label htmlFor="chatTask">What would you like to explore?</Label>
				<Textarea
					id="chatTask"
					rows={2}
					maxLength={2000}
					placeholder="Suggest questions that challenge this decision"
					value={chat.task}
					onChange={(e) => chatAction("editTask", e.currentTarget.value)}
				/>
			</div>
			<Button
				className="btn"
				id="chatPrepare"
				type="button"
				onClick={() => chatAction("prepare")}
			>
				Prepare chat prompt
			</Button>
			<div id="chatSteps" hidden={!chat.steps}>
				<div className="field">
					<Label htmlFor="chatPrompt">1. Copy this prompt into your chat</Label>
					<Textarea
						id="chatPrompt"
						ref={prompt}
						rows={8}
						readOnly
						value={chat.prompt}
						onChange={(e) => chatAction("editPrompt", e.currentTarget.value)}
					/>
				</div>
				<div className="frow">
					<Button
						className="btn"
						id="chatCopy"
						type="button"
						onClick={() => chatAction("copy")}
					>
						Copy prompt
					</Button>
					<a
						href="https://chatgpt.com/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Open ChatGPT
					</a>
					<a
						href="https://claude.ai/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Open Claude
					</a>
				</div>
				<div className="field">
					<Label htmlFor="chatReply">2. Paste the full reply</Label>
					<Textarea
						id="chatReply"
						rows={6}
						maxLength={100000}
						spellCheck={false}
						value={chat.reply}
						onChange={(e) => chatAction("editReply", e.currentTarget.value)}
					/>
				</div>
				<Button
					className="btn"
					id="chatReview"
					type="button"
					onClick={() => chatAction("review")}
				>
					Preview suggestions
				</Button>
				<div id="chatPreview" hidden={!chat.draft.length}>
					<h4>3. Review suggestions</h4>
					<ul id="chatSuggestions">
						{chat.draft.map((row, i) => (
							<li key={i}>
								{row.type +
									": " +
									row.text +
									', under "' +
									(state.nodes[row.parent]?.text || "") +
									'"'}
							</li>
						))}
					</ul>
					<Button
						className="btn primary"
						id="chatImport"
						type="button"
						onClick={() => chatAction("importDraft")}
					>
						Add as suggestions
					</Button>
					<p className="small">
						Keep or dismiss each suggestion on the canvas. Undo removes this
						import.
					</p>
				</div>
			</div>
			<p id="chatStatus" className="small" role="status" aria-live="polite">
				{chat.status}
			</p>
		</section>
	);
}
