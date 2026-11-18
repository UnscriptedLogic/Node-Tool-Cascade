import { type Ref, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { type Snapshot, useSnapshot } from "valtio";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UI } from "../legacy/core/state.ts";
import {
	backMenu,
	chooseMenuItem,
	closeMenu,
	state as responsiveState,
} from "../legacy/ui/responsive.ts";
import type { MenuSpec } from "../model.ts";

interface MenuItemsProps {
	spec: Snapshot<MenuSpec>;
	first: Ref<HTMLButtonElement>;
}
function MenuItems({ spec, first }: MenuItemsProps) {
	const firstIndex = spec.items.findIndex(
		(item) => !item.sep && !item.disabled,
	);
	return (
		<>
			{(spec.back || spec.title) && (
				<div className="ctx-head">
					{spec.back && (
						<button
							type="button"
							className="ctx-back"
							ref={first}
							aria-label="Back"
							onClick={() => backMenu()}
						>
							<svg
								viewBox="0 0 16 16"
								width="15"
								height="15"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M10 3 5 8l5 5" />
							</svg>
						</button>
					)}
					<span className="ctx-title">{spec.title || ""}</span>
				</div>
			)}
			{spec.items.map((item, i) =>
				item.sep ? (
					<div className="ctx-sep" key={i} />
				) : (
					<button
						type="button"
						role="menuitem"
						key={i}
						ref={!spec.back && i === firstIndex ? first : undefined}
						disabled={!!item.disabled}
						className={item.danger ? "danger" : undefined}
						onClick={() => chooseMenuItem(i)}
					>
						<span
							className="ic"
							dangerouslySetInnerHTML={{ __html: item.icon || "" }}
						/>
						<span className="lb">{item.label}</span>
						{item.sub && <span className="chev">›</span>}
					</button>
				),
			)}
		</>
	);
}

export default function Menu() {
	const { menu } = useSnapshot(UI, { sync: true });
	const first = useRef<HTMLButtonElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const open = !!menu;
	useEffect(() => {
		if (!open) return;
		// Popover defers dismissal until click; canvas taps need pointerdown (test/mobile.test.ts:222).
		const outside = (event: PointerEvent) => {
			if (content.current && !content.current.contains(event.target as Node)) {
				responsiveState.tapSuppressed = true;
				flushSync(closeMenu);
			}
		};
		document.addEventListener("pointerdown", outside, true);
		return () => document.removeEventListener("pointerdown", outside, true);
	}, [open]);
	const anchor = useRef({ getBoundingClientRect: () => new DOMRect() });
	anchor.current = {
		getBoundingClientRect: () =>
			new DOMRect(menu?.at.x || 0, menu?.at.y || 0, 0, 0),
	};
	if (!menu) return null;
	const onOpenChange = (open: boolean) => {
		// Native dismissal must commit before returning (test/mobile.test.ts:233).
		if (!open) flushSync(closeMenu);
	};
	const onOpenAutoFocus = (event: Event) => {
		event.preventDefault();
		if (menu.focus) first.current?.focus({ preventScroll: true });
	};
	const onCloseAutoFocus = (event: Event) => event.preventDefault();
	const onPointerDownOutside = () => {
		responsiveState.tapSuppressed = true;
	};
	const onFocusOutside = (event: Event) => event.preventDefault();
	const items = <MenuItems spec={menu.spec} first={first} />;
	if (menu.at.sheet)
		return (
			<Sheet open onOpenChange={onOpenChange}>
				<SheetContent
					id="ctx"
					ref={content}
					role="menu"
					side="bottom"
					className="cui sheet block gap-0 transition-none"
					showCloseButton={false}
					overlayProps={{ id: "ctxBack" }}
					aria-describedby={undefined}
					onOpenAutoFocus={onOpenAutoFocus}
					onCloseAutoFocus={onCloseAutoFocus}
					onEscapeKeyDown={(event) => event.stopPropagation()}
					onPointerDownOutside={onPointerDownOutside}
					onFocusOutside={onFocusOutside}
				>
					<SheetTitle className="sr-only">Actions</SheetTitle>
					{items}
				</SheetContent>
			</Sheet>
		);
	return (
		<Popover open onOpenChange={onOpenChange}>
			<PopoverAnchor virtualRef={anchor} />
			<PopoverContent
				id="ctx"
				ref={content}
				role="menu"
				className="cui w-auto"
				sideOffset={10}
				collisionPadding={8}
				style={{ maxHeight: "calc(100dvh - 16px)" }}
				onOpenAutoFocus={onOpenAutoFocus}
				onCloseAutoFocus={onCloseAutoFocus}
				onEscapeKeyDown={(event) => event.stopPropagation()}
				onPointerDownOutside={onPointerDownOutside}
				onFocusOutside={onFocusOutside}
			>
				{items}
			</PopoverContent>
		</Popover>
	);
}
