import { useSnapshot } from "valtio";
import { Label } from "@/components/ui/label";
import { MODE } from "../../core/constants.ts";
import { onWebAction, SETTINGS } from "../../shell/settings.ts";
import ChatExchange from "../ChatExchange.tsx";
import Providers from "../Providers.tsx";
export default function AiTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const web = settings.web,
		useRouter = web.provider === "openrouter",
		hasKey = !!web.key,
		result = settings.results.web || {};
	return (
		<section
			className="spane"
			id="p-ai"
			role="tabpanel"
			hidden={settings.tab !== "ai"}
		>
			<h3>{"AI model"}</h3>
			<div id="chatRoot">
				<ChatExchange />
			</div>
			<div data-modes="artifact" hidden={!["artifact"].includes(MODE)}>
				<p className="lead">
					{
						"This page runs on your Claude account, so there are no keys to enter here."
					}
				</p>
				<div className="card">
					{
						"To use ChatGPT, OpenRouter, a local model, or Claude with your own API key, run the downloadable version. It adds sign-in with ChatGPT and OpenRouter, provider and model pickers, key storage and a connection test. The goal and behavior settings here work everywhere."
					}
				</div>
			</div>
			<div
				id="aiWeb"
				data-modes="web"
				hidden={MODE !== "web" || settings.cloud}
			>
				<p
					className="card"
					id="aiCloudHint"
					hidden={settings.cloud || !settings.googleClientId}
				>
					{
						"Signed-in accounts can save their own Claude, OpenAI, OpenRouter or custom keys and use them from any device. Sign in under "
					}
					<b>{"Library"}</b>
					{" to set that up."}
				</p>
				<p className="lead">
					{
						"Cascade runs entirely in your browser and has no server of its own. Choose how the AI part works. A key, if you add one, stays in this browser."
					}
				</p>
				<section className={`prov${!useRouter ? " active" : ""}`} id="wDemo">
					<header>
						<Label className="radio">
							<input
								type="radio"
								name="webProv"
								id="wDemoRadio"
								value="demo"
								checked={!useRouter}
								onChange={() => onWebAction("demo")}
							/>
							<span>{"Demo (no account)"}</span>
						</Label>
						<span className="tag on" id="wDemoTag" hidden={useRouter}>
							{"In use"}
						</span>
					</header>
					<p className="sub">
						{
							"Scripted responses on the example tree, so you can feel how it works. Nothing is sent anywhere."
						}
					</p>
				</section>
				<section className={`prov${useRouter ? " active" : ""}`} id="wOr">
					<header>
						<Label className="radio">
							<input
								type="radio"
								name="webProv"
								id="wOrRadio"
								value="openrouter"
								checked={useRouter}
								onChange={() => onWebAction("openrouter")}
							/>
							<span>{"OpenRouter"}</span>
						</Label>
						<span
							className={`tag${useRouter && web.model ? " on" : ""}`}
							id="wOrTag"
							hidden={!useRouter}
						>
							{useRouter && !web.model ? "Pick a model" : "In use"}
						</span>
					</header>
					<p className="sub">
						{
							"One sign-in, many models: Claude, GPT, Gemini and more. OpenRouter hands this page a key and you pay OpenRouter directly for what you use. Cascade never sees your password."
						}
					</p>
					<div className="frow" style={{ margin: "0 0 16px 27px" }}>
						<button
							className="btn primary"
							id="wOrSignIn"
							type="button"
							onClick={() => onWebAction("signin")}
						>
							{hasKey
								? "Sign in again with OpenRouter"
								: "Continue with OpenRouter"}
						</button>
					</div>
					<div className="field">
						<Label htmlFor="wOrKey">{"Or paste an OpenRouter key"}</Label>
						<div className="frow">
							<input
								id="wOrKey"
								type="password"
								autoComplete="off"
								spellCheck={false}
								placeholder="sk-or-…"
								value={settings.webKeyDraft}
								onChange={(e) => {
									SETTINGS.webKeyDraft = e.currentTarget.value;
								}}
							/>
							<button
								className="btn"
								id="wOrSave"
								type="button"
								onClick={() => onWebAction("save")}
							>
								{"Save key"}
							</button>
							<button
								className="btn"
								id="wOrForget"
								type="button"
								hidden={!hasKey}
								onClick={() => onWebAction("forget")}
							>
								{"Forget key"}
							</button>
						</div>
						<small id="wOrKeyHint">
							{hasKey
								? `Key saved in this browser (••••${web.key.slice(-4)}).`
								: "No key yet."}
						</small>
					</div>
					<div className="field">
						<Label htmlFor="wOrModel">{"Model"}</Label>
						<div className="frow">
							<input
								id="wOrModel"
								type="text"
								list="ml-wor"
								autoComplete="off"
								spellCheck={false}
								placeholder="Choose one with Fetch models"
								value={settings.webModelDraft}
								onChange={(e) => {
									SETTINGS.webModelDraft = e.currentTarget.value;
									onWebAction("model", e.currentTarget.value);
								}}
							/>
							<datalist id="ml-wor">
								{settings.webModels.map((model) => (
									<option key={model} value={model} />
								))}
							</datalist>
							<button
								className="btn"
								id="wOrFetch"
								type="button"
								onClick={() => onWebAction("fetch")}
							>
								{"Fetch models"}
							</button>
						</div>
						<small>{"Fast, recent models are suggested first."}</small>
					</div>
					<div className="frow">
						<button
							className="btn primary"
							id="wOrTest"
							type="button"
							onClick={() => onWebAction("test")}
							disabled={settings.webBusy}
						>
							{"Test connection"}
						</button>
						<span
							className={`result ${result.cls || ""}`}
							id="wOrResult"
							aria-live="polite"
						>
							{result.text || ""}
						</span>
					</div>
					<p
						className="small"
						style={{ margin: "12px 0 16px", lineHeight: "1.45" }}
					>
						{
							"The key is stored in this browser only. Anyone who can use this browser profile could read it, so give the key a low credit limit and forget it on shared computers."
						}
					</p>
				</section>
				<div className="card">
					{
						"Want to use your own Claude or OpenAI key, sign in with ChatGPT, or run a local model such as Ollama? "
					}
					<a href="__REPO_URL__" target="_blank" rel="noopener">
						{"Run Cascade on your computer"}
					</a>
					{" and all of those are available."}
				</div>
			</div>
			<div
				id="aiLocal"
				data-modes="local"
				hidden={!(MODE === "local" || settings.cloud)}
			>
				<p className="lead" id="aiLocalLead">
					{settings.cloud
						? "Pick who does the thinking. Your keys are saved to your account, encrypted, and used from our server only to call the provider you choose. The page can’t read them back."
						: "Pick who does the thinking. Keys and sign-ins are kept on this computer, and the page can’t read them back. They only go to the provider you choose."}
				</p>
				<Providers />
			</div>
		</section>
	);
}
