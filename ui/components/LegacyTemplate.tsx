import {
	type CSSProperties,
	createElement,
	type ElementType,
	type Key,
	type ReactNode,
} from "react";
export interface TemplateNode {
	tag: string;
	attrs: Record<string, string>;
	children: (TemplateNode | string)[];
}
export type TemplateProps = Record<string, unknown> & {
	key?: Key;
	children?: ReactNode;
	style?: CSSProperties;
	value?: string | number | readonly string[];
	defaultValue?: string | number | readonly string[];
};
interface Props {
	nodes: TemplateNode | (TemplateNode | string)[];
	bind?: (node: TemplateNode) => TemplateProps;
	replace?: (node: TemplateNode) => ReactNode;
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const attributes: Record<string, string> = {
	class: "className",
	for: "htmlFor",
	maxlength: "maxLength",
	autocomplete: "autoComplete",
	spellcheck: "spellCheck",
	readonly: "readOnly",
	tabindex: "tabIndex",
};
function style(value: string): CSSProperties {
	return Object.fromEntries(
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
}

// Retains the existing DOM contract while controls are moved to state-backed components.
export default function LegacyTemplate({
	nodes,
	bind = () => ({}),
	replace = () => undefined,
}: Props) {
	function render(node: TemplateNode | string, index: number): ReactNode {
		if (typeof node === "string") return node;
		const replaced = replace(node);
		if (replaced !== undefined) return replaced;
		const { tag, attrs, children } = node,
			props: TemplateProps = { key: attrs.id || index };
		for (const [name, value] of Object.entries(attrs)) {
			if (name === "style") props.style = style(value);
			else if (
				["hidden", "disabled", "multiple", "checked", "readonly"].includes(name)
			)
				props[attributes[name] || name] = true;
			else
				props[
					name === "value" && tag !== "option" && attrs.type !== "checkbox"
						? "defaultValue"
						: attributes[name] || name
				] = value;
		}
		Object.assign(props, bind(node));
		if (props.value !== undefined) delete props.defaultValue;
		const Tag: ElementType =
			tag === "button"
				? Button
				: tag === "input" && !["checkbox", "file", "range"].includes(attrs.type)
					? Input
					: (tag as ElementType);
		const content =
			props.children !== undefined
				? props.children
				: children.length
					? children.map(render)
					: undefined;
		delete props.children;
		return createElement(Tag, props, content);
	}
	return Array.isArray(nodes) ? nodes.map(render) : render(nodes, 0);
}
