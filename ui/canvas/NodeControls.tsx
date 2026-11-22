import { memo, type ReactElement, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ACT, ICONS } from "../core/constants.ts";
import {
	getNodeControls,
	type NodeControls,
	subscribeNodeControls,
} from "./node-controls-state.ts";

function NodeTooltip({
	label,
	children,
	disableHoverableContent,
}: {
	label: string;
	children: ReactElement;
	disableHoverableContent?: boolean;
}) {
	return (
		<Tooltip disableHoverableContent={disableHoverableContent}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent
				className="max-w-xs wrap-anywhere whitespace-pre-line"
				sideOffset={6}
				hideWhenDetached
				updatePositionStrategy="always"
			>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

const NodeControlsPortals = memo(function NodeControlsPortals({
	el,
	controls: { actions, mindset, source },
}: {
	el: HTMLDivElement;
	controls: NodeControls;
}) {
	const mindsetSlot = el.querySelector(".mindset-slot");
	const sourceSlot = el.querySelector(".source-slot");
	const actionBar = el.querySelector(".bar");
	if (!mindsetSlot || !sourceSlot || !actionBar) return null;

	return (
		<>
			{mindset &&
				createPortal(
					<NodeTooltip label={mindset.details}>
						<button
							type="button"
							className="mindset-label"
							aria-label={`${mindset.label}. Show source and relevance`}
							data-mindset-details={mindset.details}
						>
							{mindset.label}
						</button>
					</NodeTooltip>,
					mindsetSlot,
				)}
			{source &&
				createPortal(
					<NodeTooltip label={source}>
						<button
							type="button"
							className="srcmark"
							aria-label="Where this came from"
							dangerouslySetInnerHTML={{ __html: ICONS.file }}
						/>
					</NodeTooltip>,
					sourceSlot,
				)}
			{createPortal(
				actions.map(([action, label]) => (
					<NodeTooltip key={action} label={label} disableHoverableContent>
						<button
							type="button"
							data-act={action}
							aria-label={label}
							dangerouslySetInnerHTML={{ __html: ACT[action] }}
						/>
					</NodeTooltip>
				)),
				actionBar,
			)}
		</>
	);
});

export function CanvasNodeControls() {
	const entries = useSyncExternalStore(subscribeNodeControls, getNodeControls);
	return (
		<TooltipProvider delayDuration={400} skipDelayDuration={0}>
			{entries.map(([el, controls]) => (
				<NodeControlsPortals key={el.dataset.id} el={el} controls={controls} />
			))}
		</TooltipProvider>
	);
}
