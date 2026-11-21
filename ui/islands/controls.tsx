// Small compositions of shadcn components that the settings screens repeat.
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Options = readonly (readonly [string, string])[];

// One choice out of a few, shown as a segmented row.
export function Choice({
	id,
	label,
	items,
	value,
	onChange,
	attr = "val",
	big = true,
	style,
}: {
	id?: string;
	label: string;
	items: Options;
	value: string;
	onChange: (value: string) => void;
	attr?: string;
	big?: boolean;
	style?: CSSProperties;
}) {
	return (
		<ToggleGroup
			type="single"
			id={id}
			className={cn("seg", big && "big")}
			aria-label={label}
			style={style}
			value={value}
			onValueChange={(next) => {
				// Picking the chosen item again keeps it chosen.
				if (next) onChange(next);
			}}
		>
			{items.map(([key, text]) => (
				<ToggleGroupItem key={key} value={key} {...{ [`data-${attr}`]: key }}>
					{text}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

// A checkbox with its text beside it.
export function CheckRow({
	id,
	checked,
	onChange,
	disabled,
	label,
	children,
	className = "check",
}: {
	id?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label?: string;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<Label className={className}>
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				aria-label={label}
				onCheckedChange={(next) => onChange(next === true)}
			/>
			{children}
		</Label>
	);
}

// A section that opens and closes under its title.
export function Disclosure({
	id,
	title,
	className,
	style,
	onOpenChange,
	children,
}: {
	id?: string;
	title: ReactNode;
	className?: string;
	style?: CSSProperties;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<Collapsible
			id={id}
			className={cn("disclosure", className)}
			style={style}
			onOpenChange={onOpenChange}
		>
			<CollapsibleTrigger className="disclosure-trigger">
				<ChevronRight aria-hidden="true" />
				<span>{title}</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="disclosure-body">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

// Radix Select items can't use an empty value, so "" travels as this.
const EMPTY = "__none__";

// A dropdown of options.
export function SelectField({
	id,
	label,
	value,
	options,
	onChange,
	onOpen,
	disabled,
	className,
	attrs,
}: {
	id?: string;
	label?: string;
	value: string;
	options: Options;
	onChange: (value: string) => void;
	onOpen?: () => void;
	disabled?: boolean;
	className?: string;
	attrs?: Record<string, string>;
}) {
	return (
		<Select
			value={value || EMPTY}
			disabled={disabled}
			onValueChange={(next) => onChange(next === EMPTY ? "" : next)}
			onOpenChange={(open) => {
				if (open) onOpen?.();
			}}
		>
			<SelectTrigger
				id={id}
				aria-label={label}
				className={cn("selectfield", className)}
				{...attrs}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="cui selectmenu" position="popper">
				<SelectGroup>
					{options.map(([key, text]) => (
						<SelectItem key={key || EMPTY} value={key || EMPTY}>
							{text}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
