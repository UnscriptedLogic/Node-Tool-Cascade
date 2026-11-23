import type { ComponentProps } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// A card for one way of running the AI. The active one gets a heavier border.
export function ProvCard({
	active,
	className,
	...props
}: ComponentProps<"section"> & { active?: boolean }) {
	return (
		<section
			data-active={active || undefined}
			className={cn(
				"mb-4 max-w-[700px] rounded-[14px] border border-line bg-paper px-[18px] pt-4 pb-1.5",
				"[&_.frow:last-child]:mb-4 [&_p_a]:font-semibold [&_p_a]:text-focus",
				active && "border-ink shadow-[inset_0_0_0_1px_var(--ink)]",
				className,
			)}
			{...props}
		/>
	);
}

export function ProvHeader({ className, ...props }: ComponentProps<"header">) {
	return (
		<header
			className={cn("flex items-center justify-between gap-3", className)}
			{...props}
		/>
	);
}

// The card's name, which also selects its radio.
export function ProvTitle({
	className,
	...props
}: ComponentProps<typeof Label>) {
	return (
		<Label
			className={cn(
				"cursor-pointer gap-2.5 text-[15.5px] leading-normal font-bold",
				className,
			)}
			{...props}
		/>
	);
}

export function ProvSub({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"mt-1.5 mr-0 mb-4 ml-[27px] text-[13px] leading-[1.45] text-ink2",
				className,
			)}
			{...props}
		/>
	);
}
