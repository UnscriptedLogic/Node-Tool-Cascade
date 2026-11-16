import { useLayoutEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { version } from "../../package.json";
import { call, getLegacy } from "../bridge.ts";
import template from "../templates/settings-view.json";
import Providers from "./Providers.tsx";

const textFields = {
	gGoal: "goal",
	gContext: "context",
	gPillars: "pillars",
	gAvoid: "avoid",
};
const checks = {
	bAutoGrow: "autoGrow",
	bAutoTrace: "autoTrace",
	bPushback: "pushback",
	pUse: "useProject",
	pAsk: "askFiles",
	aFiles: "askFiles",
	sQuitClose: "quitOnClose",
};
const segments = {
	bLayout: "mobileLayout",
	gSteer: "steer",
	bSize: "growSize",
	aTheme: "theme",
	bGrill: "grillStyle",
};
const attributes = {
	class: "className",
	for: "htmlFor",
	maxlength: "maxLength",
	autocomplete: "autoComplete",
	spellcheck: "spellCheck",
	tabindex: "tabIndex",
};
const style = (value) =>
	Object.fromEntries(
		value
			.split(";")
			.filter(Boolean)
			.map((part: string) => {
				const i = part.indexOf(":");
				return [
					part
						.slice(0, i)
						.trim()
						.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
					part.slice(i + 1).trim(),
				];
			}),
	);

export default function Settings() {
	const { PREFS, SETTINGS, DOMAINS, STEER_HELP, MODE, UI } = getLegacy();
	const prefs = useSnapshot(PREFS, { sync: true }),
		settings = useSnapshot(SETTINGS, { sync: true });
	const shell = useSnapshot(UI, { sync: true }),
		fileInput = useRef(null);
	useLayoutEffect(() => {
		document.getElementById("app").inert =
			!!shell.bye || (settings.open && settings.tab !== "look");
	}, [shell.bye, settings.open, settings.tab]);
	const domain = DOMAINS[prefs.domain] || DOMAINS.general;
	const setPref = (key: string, value: number) =>
		call("setPreference", key, value);
	function render(node, index, parent?) {
		if (typeof node === "string") return node;
		const { tag, attrs, children } = node,
			id = attrs.id;
		if (id === "p-mindsets")
			return (
				<section
					key={id}
					id={id}
					className="spane"
					role="tabpanel"
					hidden={settings.tab !== "mindsets"}
				>
					<div id="mindsetsRoot" />
				</section>
			);
		if (id === "chatExchange") return <div key={id} id="chatRoot" />;
		if (id === "p-project")
			return (
				<section
					key={id}
					id={id}
					className="spane"
					role="tabpanel"
					hidden={settings.tab !== "project"}
				>
					<div id="projectRoot" />
				</section>
			);
		if (id === "provList") return <Providers key="provList" />;
		const props: import("../components/LegacyTemplate.tsx").TemplateProps = {
			key: id || index,
		};
		for (const [name, value] of Object.entries(attrs)) {
			if (name === "style") props.style = style(value);
			else if (["hidden", "disabled", "multiple", "checked"].includes(name))
				props[name] = true;
			else
				props[
					name === "value" && tag !== "option"
						? "defaultValue"
						: attributes[name] || name
				] = value;
		}
		let content = children;
		if (attrs["data-modes"])
			props.hidden = !attrs["data-modes"].split(" ").includes(MODE);
		if (attrs["data-dom-text"])
			content = [domain[attrs["data-dom-text"]] || ""];
		if (attrs["data-dom-ph"])
			props.placeholder = domain[attrs["data-dom-ph"]] || "";
		if (id === "aiLocal") props.hidden = !(MODE === "local" || settings.cloud);
		if (id === "aiWeb") props.hidden = MODE !== "web" || settings.cloud;
		if (id === "aiCloudHint")
			props.hidden = settings.cloud || !settings.googleClientId;
		if (id === "dStats") props.hidden = !settings.analytics;
		if (id === "dStatsOn") {
			props.checked = settings.statsOn;
			props.onChange = (e) =>
				call("onDataAction", "stats", e.currentTarget.checked);
		}
		if (id === "dMsg") content = [settings.dataMessage];
		const dataAction = {
			dExport: "export",
			dClear: "clear",
			dForgetKey: "forgetKey",
			dWipeKeys: "wipeKeys",
		}[id];
		if (dataAction) props.onClick = () => call("onDataAction", dataAction);
		if (id === "dFile") {
			props.ref = fileInput;
			props.onChange = async (event) => {
				const input = event.currentTarget;
				await call("onDataAction", "import", input.files[0]);
				input.value = "";
			};
		}
		if (id === "dImport") props.onClick = () => fileInput.current.click();
		if (id === "sQuit") props.onClick = () => call("quitCascade");
		if (id === "sInfo") {
			const server = settings.server?.server;
			content = [
				server
					? `Listening on http://localhost:${server.port}` +
						(server.port !== server.preferred
							? ` (port ${server.preferred} was busy, so this one was chosen)`
							: "") +
						` · process ${server.pid}`
					: "",
			];
		}
		if (id === "libTab") props.hidden = !settings.library;
		if (id === "appVersion") content = [`v${version}`];
		if (id === "aiLocalLead" && settings.cloud)
			content = [
				"Pick who does the thinking. Your keys are saved to your account, encrypted, and used from our server only to call the provider you choose. The page can’t read them back.",
			];
		const web = settings.web,
			useRouter = web.provider === "openrouter",
			hasKey = !!web.key;
		if (id === "wDemo" || id === "wOr")
			props.className = `prov${(id === "wDemo" ? !useRouter : useRouter) ? " active" : ""}`;
		if (id === "wDemoRadio" || id === "wOrRadio") {
			props.checked = id === "wDemoRadio" ? !useRouter : useRouter;
			props.onChange = () =>
				call("onWebAction", id === "wDemoRadio" ? "demo" : "openrouter");
		}
		if (id === "wDemoTag") {
			props.hidden = useRouter;
			props.className = "tag on";
		}
		if (id === "wOrTag") {
			props.hidden = !useRouter;
			props.className = `tag${useRouter && web.model ? " on" : ""}`;
			content = [useRouter && !web.model ? "Pick a model" : "In use"];
		}
		if (id === "wOrKeyHint")
			content = [
				hasKey
					? `Key saved in this browser (••••${web.key.slice(-4)}).`
					: "No key yet.",
			];
		if (id === "wOrForget") props.hidden = !hasKey;
		if (id === "wOrSignIn")
			content = [
				hasKey ? "Sign in again with OpenRouter" : "Continue with OpenRouter",
			];
		if (id === "wOrKey") {
			props.value = settings.webKeyDraft;
			props.onInput = (e) => {
				SETTINGS.webKeyDraft = e.currentTarget.value;
			};
			props.onChange = () => {};
		}
		if (id === "wOrModel") {
			props.value = settings.webModelDraft;
			props.onInput = (e) => {
				SETTINGS.webModelDraft = e.currentTarget.value;
			};
			props.onChange = (e) =>
				call("onWebAction", "model", e.currentTarget.value);
		}
		if (id === "ml-wor")
			content = settings.webModels.map((model) => ({
				tag: "option",
				attrs: { value: model },
				children: [],
			}));
		if (id === "wOrResult") {
			const result = settings.results.web || {};
			content = [result.text || ""];
			props.className = `result ${result.cls || ""}`;
		}
		const webAction = {
			wOrSignIn: "signin",
			wOrSave: "save",
			wOrForget: "forget",
			wOrFetch: "fetch",
			wOrTest: "test",
		}[id];
		if (webAction) props.onClick = () => call("onWebAction", webAction);
		if (id === "wOrTest") props.disabled = settings.webBusy;
		if (id === "settings") {
			props.hidden = !settings.open;
			props.className = settings.tab === "look" ? "sheet" : "";
		}
		if (attrs.class === "spane") props.hidden = id !== `p-${settings.tab}`;
		if (attrs["data-tab"]) {
			props["aria-selected"] = String(settings.tab === attrs["data-tab"]);
			props.onClick = () => call("showTab", attrs["data-tab"]);
		}
		if (id === "sClose") props.onClick = () => call("closeSettings");
		if (textFields[id]) {
			props.value = prefs[textFields[id]] || "";
			props.onInput = (e) => setPref(textFields[id], e.currentTarget.value);
			props.onChange = () => {};
		}
		if (checks[id]) {
			props.checked = !!prefs[checks[id]];
			props.onChange = (e) => setPref(checks[id], e.currentTarget.checked);
		}
		const segment = segments[parent?.attrs?.id];
		if (segment && attrs["data-val"]) {
			props["aria-pressed"] = String(prefs[segment] === attrs["data-val"]);
			props.onClick = () => setPref(segment, attrs["data-val"]);
		}
		if (id === "bCreative") {
			props.value = prefs.creativity;
			props.onInput = (e) => setPref("creativity", +e.currentTarget.value);
			props.onChange = () => {};
		}
		if (id === "bCreativeVal") content = [(+prefs.creativity).toFixed(2)];
		if (id === "steerHelp") content = [STEER_HELP[prefs.steer] || ""];
		if (id === "gPreview") content = [settings.preview];
		if (id === "gDomain") {
			props.value = prefs.domain;
			props.onChange = (e) => setPref("domain", e.currentTarget.value);
			content = Object.entries(
				DOMAINS as Record<string, { label: string }>,
			).map(([key, value]) => ({
				tag: "option",
				attrs: { value: key },
				children: [value.label],
			}));
		}
		if (id === "gDomainHelp")
			content = [
				domain.blurb +
					" This sets the words the AI uses and the example tree. Your blocks stay as they are.",
			];
		if (id === "gChips")
			return (
				<div {...props}>
					{domain.goalChips.map((goal) => (
						<button
							key={goal}
							type="button"
							className="chip"
							onClick={() => setPref("goal", goal)}
						>
							{goal}
						</button>
					))}
				</div>
			);
		const Tag = tag;
		if (props.value !== undefined) delete props.defaultValue;
		return (
			<Tag {...props}>
				{content.length
					? content.map((child, i) => render(child, i, node))
					: undefined}
			</Tag>
		);
	}
	return (
		<>
			{render(template, 0)}
			<div id="bye" hidden={!shell.bye}>
				<div className="card">
					<b>Cascade has stopped.</b>
					<p>
						The port is free again. You can close this tab. Run the start script
						to open it again.
					</p>
				</div>
			</div>
		</>
	);
}
