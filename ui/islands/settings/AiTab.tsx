import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MODE } from "../../core/constants.ts";
import { onWebAction, SETTINGS } from "../../shell/settings.ts";
import ChatExchange from "../ChatExchange.tsx";
import { ProvCard, ProvHeader, ProvSub, ProvTitle } from "../ProvCard.tsx";
import Providers from "../Providers.tsx";
import SettingsPane from "./SettingsPane.tsx";
export default function AiTab() {
	const settings = useSnapshot(SETTINGS, { sync: true });
	const web = settings.web,
		useRouter = web.provider === "openrouter",
		hasKey = !!web.key,
		result = settings.results.web || {};
	return (
		<SettingsPane value="ai">
			<h3>AI model</h3>
			<div id="chatRoot">
				<ChatExchange />
			</div>
			<div data-modes="artifact" hidden={!["artifact"].includes(MODE)}>
				<p className="lead">
					This page runs on your Claude account, so there are no keys to enter
					here.
				</p>
				<div className="card">
					To use ChatGPT, OpenRouter, a local model, or Claude with your own API
					key, run the downloadable version. It adds sign-in with ChatGPT and
					OpenRouter, provider and model pickers, key storage and a connection
					test. The goal and behavior settings here work everywhere.
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
					Signed-in accounts can save their own Claude, OpenAI, OpenRouter or
					custom keys and use them from any device. Sign in under&#32;
					<b>Library</b>
					&#32;to set that up.
				</p>
				<p className="lead">
					Cascade runs entirely in your browser and has no server of its own.
					Choose how the AI part works. A key, if you add one, stays in this
					browser.
				</p>
				<RadioGroup
					className="provgroup"
					aria-label="How the AI works"
					value={useRouter ? "openrouter" : "demo"}
					onValueChange={(value) => onWebAction(value)}
				>
					<ProvCard active={!useRouter} id="wDemo">
						<ProvHeader>
							<ProvTitle>
								<RadioGroupItem id="wDemoRadio" value="demo" />
								<span>Demo (no account)</span>
							</ProvTitle>
							<span className="tag on" id="wDemoTag" hidden={useRouter}>
								In use
							</span>
						</ProvHeader>
						<ProvSub>
							Scripted responses on the example tree, so you can try Cascade
							without an account. Nothing leaves this browser.
						</ProvSub>
					</ProvCard>
					<ProvCard active={useRouter} id="wOr">
						<ProvHeader>
							<ProvTitle>
								<RadioGroupItem id="wOrRadio" value="openrouter" />
								<span>OpenRouter</span>
							</ProvTitle>
							<span
								className={`tag${useRouter && web.model ? " on" : ""}`}
								id="wOrTag"
								hidden={!useRouter}
							>
								{useRouter && !web.model ? "Pick a model" : "In use"}
							</span>
						</ProvHeader>
						<ProvSub>
							One sign-in, many models: Claude, GPT, Gemini and more. OpenRouter
							gives this page a key and you pay OpenRouter directly for what you
							use. Cascade never sees your password.
						</ProvSub>
						<div className="frow" style={{ margin: "0 0 16px 27px" }}>
							<Button
								className="btn primary"
								id="wOrSignIn"
								type="button"
								onClick={() => onWebAction("signin")}
							>
								{hasKey
									? "Sign in again with OpenRouter"
									: "Continue with OpenRouter"}
							</Button>
						</div>
						<div className="field">
							<Label htmlFor="wOrKey">Or paste an OpenRouter key</Label>
							<div className="frow">
								<Input
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
								<Button
									className="btn"
									id="wOrSave"
									type="button"
									onClick={() => onWebAction("save")}
								>
									Save key
								</Button>
								<Button
									className="btn"
									id="wOrForget"
									type="button"
									hidden={!hasKey}
									onClick={() => onWebAction("forget")}
								>
									Forget key
								</Button>
							</div>
							<small id="wOrKeyHint">
								{hasKey
									? `Key saved in this browser (••••${web.key.slice(-4)}).`
									: "No key yet."}
							</small>
						</div>
						<div className="field">
							<Label htmlFor="wOrModel">Model</Label>
							<div className="frow">
								<Input
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
								<Button
									className="btn"
									id="wOrFetch"
									type="button"
									onClick={() => onWebAction("fetch")}
								>
									Fetch models
								</Button>
							</div>
							<small>The list puts fast, recent models first.</small>
						</div>
						<div className="frow">
							<Button
								className="btn primary"
								id="wOrTest"
								type="button"
								onClick={() => onWebAction("test")}
								disabled={settings.webBusy}
							>
								Test connection
							</Button>
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
							Only this browser keeps the key. Anyone who uses this browser
							profile could read it, so give the key a low credit limit and
							forget it on shared computers.
						</p>
					</ProvCard>
				</RadioGroup>
				<div className="card">
					Want to use your own Claude or OpenAI key, sign in with ChatGPT, or
					run a local model such as Ollama?&#32;
					<a href="__REPO_URL__" target="_blank" rel="noopener">
						Run Cascade on your computer
					</a>
					&#32;and all of those are available.
				</div>
			</div>
			<div
				id="aiLocal"
				data-modes="local"
				hidden={!(MODE === "local" || settings.cloud)}
			>
				<p className="lead" id="aiLocalLead">
					{settings.cloud
						? "Choose the AI provider. Your account stores your keys encrypted, and our server uses them only to call the provider you choose. The page can’t read them back."
						: "Choose the AI provider. Keys and sign-ins stay on this computer, and the page can’t read them back. They only go to the provider you choose."}
				</p>
				<Providers />
			</div>
		</SettingsPane>
	);
}
