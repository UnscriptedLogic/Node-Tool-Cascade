import { useEffect, useRef } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CascadeMeta, Folder } from "../../shared/types.ts";
import { DOMAINS } from "../core/profiles.ts";
import {
	LIB,
	libDelete,
	libDeleteAccount,
	libMountGoogle,
	libMove,
	libNewCascade,
	libNewFolder,
	libOpen,
	libRename,
	libSaveCurrent,
	libSignOut,
} from "../features/library.ts";
import { SelectField } from "./controls.tsx";

const when = (time: string | number | Date) => {
	const date = new Date(time);
	return Number.isFinite(date.getTime())
		? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
		: "";
};

type LibraryKind = "cascade" | "folder";
interface LibraryEditing {
	kind: LibraryKind;
	id: string;
}
interface NameCellProps {
	kind: LibraryKind;
	item: Pick<Folder, "id" | "name">;
	editing?: LibraryEditing | null;
}
interface DeleteButtonProps {
	kind: LibraryKind;
	item: Pick<Folder, "id" | "name">;
	armed?: string | null;
}
interface CascadeRowProps {
	item: CascadeMeta;
	lib: {
		currentId?: string | null;
		editing?: LibraryEditing | null;
		armed?: string | null;
		folders: readonly Folder[];
	};
}
function NameCell({ kind, item, editing }: NameCellProps) {
	const input = useRef<HTMLInputElement>(null);
	const active = editing?.kind === kind && editing.id === item.id;
	useEffect(() => {
		if (active) {
			input.current?.focus();
			input.current?.select();
		}
	}, [active]);
	if (active)
		return (
			<Input
				ref={input}
				type="text"
				defaultValue={item.name}
				maxLength={80}
				aria-label="Name"
				className="lib-name-input"
				onKeyDown={(event) => {
					if (event.key === "Enter")
						libRename(kind, item.id, event.currentTarget.value);
					else if (event.key === "Escape") LIB.editing = null;
				}}
				onBlur={(event) => {
					const current = LIB.editing;
					if (current?.kind === kind && current.id === item.id)
						libRename(kind, item.id, event.currentTarget.value);
				}}
			/>
		);
	return kind === "cascade" ? (
		<Button type="button" className="lib-open" onClick={() => libOpen(item.id)}>
			{item.name}
		</Button>
	) : (
		<strong>{item.name}</strong>
	);
}

function DeleteButton({ kind, item, armed }: DeleteButtonProps) {
	const key = `${kind}${item.id}`;
	return (
		<Button
			type="button"
			className={`btn small${armed === key ? " danger" : ""}`}
			aria-label={`Delete ${item.name}`}
			onClick={() => {
				if (armed === key) return libDelete(kind, item.id);

				LIB.armed = key;
				window.setTimeout(() => {
					if (LIB.armed === key) LIB.armed = null;
				}, 4000);
			}}
		>
			{armed === key ? "Really delete?" : "Delete"}
		</Button>
	);
}

function CascadeRow({ item, lib }: CascadeRowProps) {
	const domains: Record<string, { label: string }> = DOMAINS;
	return (
		<li
			className={`lib-row flex flex-wrap items-center gap-2.5 rounded-[9px] border-b border-line px-2.5 py-[9px]${item.id === lib.currentId ? " current bg-(--paper2)" : ""}`}
			data-id={item.id}
		>
			<NameCell kind="cascade" item={item} editing={lib.editing} />
			<span className="flex-auto text-[12.5px] text-ink2">
				{`${domains[item.domain]?.label || ""} · ${when(item.updatedAt)}${item.id === lib.currentId ? " · open now" : ""}`}
			</span>
			<span className="lib-actions flex flex-wrap items-center gap-1.5">
				<Button
					type="button"
					className="btn small"
					aria-label={`Rename ${item.name}`}
					onClick={() => {
						LIB.editing = { kind: "cascade", id: item.id };
					}}
				>
					Rename
				</Button>
				<SelectField
					label={`Move ${item.name} to a folder`}
					className="small"
					value={item.folderId || ""}
					options={[
						["", "No folder"],
						...lib.folders.map((folder) => [folder.id, folder.name] as const),
					]}
					onChange={(value) => libMove(item.id, value)}
				/>
				<DeleteButton kind="cascade" item={item} armed={lib.armed} />
			</span>
		</li>
	);
}

export default function Library() {
	const lib = useSnapshot(LIB);
	const googleHost = useRef<HTMLDivElement>(null);
	const signed = lib.kind === "local" || !!lib.user;
	const current = lib.cascades.some((item) => item.id === lib.currentId);
	useEffect(() => {
		if (lib.kind === "cloud" && !lib.user && googleHost.current)
			libMountGoogle(googleHost.current);
	}, [lib.kind, lib.user, lib.googleClientId, lib.gsi]);
	const loose = lib.cascades.filter((item) => !item.folderId);
	return (
		<>
			<div className="field" id="libAccount" hidden={lib.kind !== "cloud"}>
				<span className="lbl">Account</span>
				<small id="libWho">
					{lib.user
						? `Signed in as ${lib.user.name || lib.user.email} (${lib.user.email})`
						: "Sign in to keep your Cascades on the web and open them anywhere."}
				</small>
				<div id="libGoogle" ref={googleHost} hidden={!!lib.user} />
				<div className="frow">
					<Button
						className="btn"
						id="libSignOut"
						type="button"
						hidden={!lib.user}
						onClick={() => libSignOut()}
					>
						Sign out
					</Button>
					<Button
						className="btn small"
						id="libDeleteAccount"
						type="button"
						hidden={!lib.user}
						onClick={() => libDeleteAccount()}
					>
						{lib.armed === "account"
							? "Really delete my account and every saved Cascade?"
							: "Delete my account"}
					</Button>
				</div>
			</div>
			<div className="field" id="libTools" hidden={!signed}>
				<div className="frow">
					<Button
						className="btn primary"
						id="libNew"
						type="button"
						onClick={() => libNewCascade(null)}
					>
						New Cascade
					</Button>
					<Button
						className="btn"
						id="libFolder"
						type="button"
						onClick={() => libNewFolder()}
					>
						New folder
					</Button>
					<Button
						className="btn"
						id="libSaveCur"
						type="button"
						hidden={!signed || current}
						onClick={() => libSaveCurrent()}
					>
						Save the tree I have open
					</Button>
				</div>
				<small id="libStatus" aria-live="polite">
					{lib.status}
				</small>
			</div>
			<div id="libList" className="max-w-[760px]">
				{signed && !lib.folders.length && !lib.cascades.length && (
					<p className="small">
						Nothing saved yet. Start a new Cascade, or save the one you have
						open.
					</p>
				)}
				{signed &&
					lib.folders.map((folder) => {
						const inside = lib.cascades.filter(
							(item) => item.folderId === folder.id,
						);
						return (
							<section
								className="lib-folder mb-5"
								data-folder={folder.id}
								key={folder.id}
							>
								<header className="flex flex-wrap items-center gap-2.5 border-b border-line py-2">
									<NameCell kind="folder" item={folder} editing={lib.editing} />
									<span className="flex-auto text-[12.5px] text-ink2">
										{`${inside.length}${inside.length === 1 ? " Cascade" : " Cascades"}`}
									</span>
									<span className="lib-actions flex flex-wrap items-center gap-1.5">
										<Button
											type="button"
											className="btn small"
											onClick={() => libNewCascade(folder.id)}
										>
											New Cascade here
										</Button>
										<Button
											type="button"
											className="btn small"
											aria-label={`Rename folder ${folder.name}`}
											onClick={() => {
												LIB.editing = { kind: "folder", id: folder.id };
											}}
										>
											Rename
										</Button>
										<DeleteButton
											kind="folder"
											item={folder}
											armed={lib.armed}
										/>
									</span>
								</header>
								<ul className="m-0 list-none p-0">
									{inside.map((item) => (
										<CascadeRow key={item.id} item={item} lib={lib} />
									))}
								</ul>
							</section>
						);
					})}
				{signed && !!loose.length && (
					<section className="lib-folder mb-5">
						{!!lib.folders.length && (
							<header className="flex flex-wrap items-center gap-2.5 border-b border-line py-2">
								<strong>Not in a folder</strong>
							</header>
						)}
						<ul className="m-0 list-none p-0">
							{loose.map((item) => (
								<CascadeRow key={item.id} item={item} lib={lib} />
							))}
						</ul>
					</section>
				)}
			</div>
		</>
	);
}
