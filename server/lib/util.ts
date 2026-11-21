// Small shared helpers. The portable ones live in shared/util.js; this adds what needs Node.
import path from "node:path";
import * as shared from "../../shared/util.ts";

// Where tree.json, settings.json and chatgpt-auth.json live. Defaults to the repo folder.
const DATA_DIR = process.env.CASCADE_DATA_DIR
	? path.resolve(process.env.CASCADE_DATA_DIR)
	: path.resolve(import.meta.dirname, "..", "..");

class HttpError extends Error {
	status: number;
	constructor(status: number, message?: string) {
		super(message);
		this.status = status;
	}
}

export * from "../../shared/util.ts";
export { DATA_DIR, HttpError };
export default { DATA_DIR, HttpError, ...shared };
