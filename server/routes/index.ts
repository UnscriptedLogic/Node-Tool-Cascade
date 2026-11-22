import { createRouter } from "../http.ts";
import ai from "./ai.ts";
import auth from "./auth.ts";
import library from "./library.ts";
import page from "./page.ts";
import project from "./project.ts";
import session from "./session.ts";

const router = createRouter();
for (const register of [page, session, library, project, auth, ai])
	register(router);
export default router;
