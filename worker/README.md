# Cascade on Cloudflare

One Cloudflare Worker serves the web app (static files from `dist/web`) and the `/api` routes. Accounts use Google sign-in.
Saved Cascades and folders live in D1 (SQLite). Nothing here runs the AI: web users bring their own model
(OpenRouter sign-in or a key, stored only in their browser).

## One-time setup

1. **D1 database**
   ```bash
   npx wrangler d1 create cascade
   ```
   Paste the printed `database_id` into `worker/wrangler.toml`, then create the tables:
   ```bash
   npx wrangler d1 execute cascade --remote --file worker/schema.sql -c worker/wrangler.toml
   ```
2. **Google sign-in.** In Google Cloud Console, create an OAuth client of type *Web application*. Add your site as an
   authorised JavaScript origin (for example `https://cascade.<you>.workers.dev` and `http://localhost:8787` for local
   testing). No client secret is needed. Put the client ID in `GOOGLE_CLIENT_ID` in `worker/wrangler.toml`.
3. **Deploy**
   ```bash
   npm run worker:deploy
   ```
   Local preview with a local D1: `npm run worker:dev` (apply `schema.sql` without `--remote` first).

## How it works

| Piece | File |
| --- | --- |
| Routes: config, Google sign-in, sessions, library | `src/index.js` |
| Google ID token check (RS256 against Google's keys, audience, issuer, expiry) | `src/auth.js` |
| D1 storage: folders, Cascades, users, sessions | `src/d1store.js` |
| Library rules shared with the local app | `../shared/library.js` |

- The browser gets a random session token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 is stored.
- Sessions last 30 days. Every library query is scoped to the signed-in user. Writes must be same-origin JSON.
- `DELETE /api/auth/account` removes a user and everything they saved.

## Sign in with ChatGPT or Claude on the web

- **ChatGPT:** the flow in `server/lib/chatgpt.js` uses OpenAI's open-source, loopback (`127.0.0.1`) registration, so it only
  works for the locally run app. For a hosted site, OpenAI's [website guide](https://developers.openai.com/siwc/website) needs an
  OpenAI-issued client ID (`oaiapp_…`) and an exactly registered callback URL, and OpenAI describes the programme as a limited
  trial for selected partners. If you get access, add it as a new route module here; the page already routes AI calls through one adapter.
- **Claude:** Anthropic's terms do not let third-party apps offer claude.ai subscription sign-in, so use an Anthropic API key
  or OpenRouter.
