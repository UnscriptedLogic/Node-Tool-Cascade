// Library store for the local app: an index of folders and Cascades, and one JSON file per Cascade.
// One user lives on this computer, so `uid` is ignored. Files are written atomically.
import fs from "node:fs";
import path from "node:path";
import type {
	CascadeMeta,
	CascadeRecord,
	Folder,
	LibraryStore,
} from "../../shared/types.ts";
import { DATA_DIR } from "./util.ts";

const DIR = path.join(DATA_DIR, "library");
const INDEX = path.join(DIR, "index.json");
const file = (id: string) =>
	path.join(DIR, "cascades", `${id.replace(/[^A-Za-z0-9-]/g, "")}.json`);
const writeAtomic = (
	f,
	text: string | NodeJS.ArrayBufferView<ArrayBufferLike>,
) => {
	fs.mkdirSync(path.dirname(f), { recursive: true });
	const tmp = `${f}.tmp`;
	fs.writeFileSync(tmp, text);
	fs.renameSync(tmp, f);
};

function readIndex(): { folders: Folder[]; cascades: CascadeMeta[] } {
	try {
		const o = JSON.parse(fs.readFileSync(INDEX, "utf8"));
		return { folders: o.folders || [], cascades: o.cascades || [] };
	} catch {
		return { folders: [], cascades: [] };
	}
}
const saveIndex = (ix) => writeAtomic(INDEX, JSON.stringify(ix, null, 2));
const metaOf = (r: CascadeRecord) => ({
	id: r.id,
	folderId: r.folderId || null,
	name: r.name,
	domain: r.domain,
	createdAt: r.createdAt,
	updatedAt: r.updatedAt,
});

const store: LibraryStore = {
	async listFolders() {
		return readIndex().folders;
	},
	async createFolder(_uid, f) {
		const ix = readIndex();
		ix.folders.push(f);
		saveIndex(ix);
	},
	async updateFolder(_uid, id, patch) {
		const ix = readIndex();
		const f = ix.folders.find((x) => x.id === id);
		if (f) Object.assign(f, patch);
		saveIndex(ix);
	},
	async deleteFolder(_uid, id) {
		const ix = readIndex();
		for (const c of ix.cascades.filter((c) => c.folderId === id)) {
			try {
				fs.unlinkSync(file(c.id));
			} catch {}
		}
		ix.cascades = ix.cascades.filter((c) => c.folderId !== id);
		ix.folders = ix.folders.filter((f) => f.id !== id);
		saveIndex(ix);
	},
	async listCascades() {
		return readIndex().cascades;
	},
	async getCascade(_uid, id) {
		const m = readIndex().cascades.find((c) => c.id === id);
		if (!m) return null;
		try {
			return { ...m, data: JSON.parse(fs.readFileSync(file(id), "utf8")) };
		} catch {
			return null;
		}
	},
	async putCascade(_uid, rec) {
		writeAtomic(file(rec.id), JSON.stringify(rec.data));
		const ix = readIndex(),
			m = metaOf(rec),
			i = ix.cascades.findIndex((c) => c.id === rec.id);
		if (i < 0) ix.cascades.push(m);
		else ix.cascades[i] = m;
		saveIndex(ix);
	},
	async deleteCascade(_uid, id) {
		try {
			fs.unlinkSync(file(id));
		} catch {}
		const ix = readIndex();
		ix.cascades = ix.cascades.filter((c) => c.id !== id);
		saveIndex(ix);
	},
};

export default store;
