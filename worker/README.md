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

## Two environments

| | Branch | Address | Worker | Database | Deploy |
| --- | --- | --- | --- | --- | --- |
| Production | `main` | https://cascade.unscriptedlogic.com | `cascade` | `cascade` | `npm run worker:deploy` |
| Dev | `dev` | https://cascade-dev.unscriptedlogic.com | `cascade-dev` | `cascade-dev` | `npm run worker:deploy:dev` |

The two never share data or sessions. Add both addresses as authorised JavaScript origins on the Google OAuth client. For a new
environment, create its database (`wrangler d1 create`), apply `schema.sql` to it with `--env <name>`, and add an `[env.<name>]`
block to `wrangler.toml` (bindings are not inherited).

`.github/workflows/deploy.yml` deploys on every push: `main` to production, `dev` to dev, after the tests pass. It needs the
repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## AI keys for signed-in users

Signed in, a person can save their own Claude, OpenAI, OpenRouter or custom-endpoint key (Settings > AI model). The page shows the
same provider screen as the local app. Keys are encrypted with AES-GCM before they reach D1 (bound to the user and provider, so a
copied row cannot be read as someone else's) and the page only ever sees the last four characters. Model calls go page > Worker >
provider and stream back, so the key never reaches the browser after it is saved.

Each environment needs its own encryption secret, set once:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put KEY_SECRET -c worker/wrangler.toml
# dev:  add --env dev
```

Keep a copy somewhere safe. If it is lost or changed, saved keys cannot be decrypted and people have to enter them again. Without
it, saving a key answers "not set up on this server yet" and nothing is stored. The tables for this (`ai_settings`,
`ai_connections`) are in `schema.sql`, which the deploy workflow applies before each deploy.

Custom endpoints must be public https hosts. Anything on your own computer or network (Ollama, LM Studio) only works in the local
app. Anything a user wants to spend is on their own provider account; there is no per-user rate limit here.

## Usage counts

`src/analytics.js` writes anonymous events to Workers Analytics Engine (one dataset per environment: `cascade_events`,
`cascade_events_dev`), and adds the Cloudflare Web Analytics page-view counter to the page. The events, their labels and what is
never stored are listed at the top of that file, and are checked on the server: anything off the lists is dropped.

**Reading the numbers.** Create an API token with *Account > Account Analytics > Read*. On Windows, double-click
`scripts\analytics-report.bat` (or run `scripts\analytics-report.bat dev 30`): it asks for the token once, hidden, and can save it to
`scripts/analytics.local.env`, which git ignores. Or from any shell:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/analytics-report.js --env prod --days 30
```

It prints visits and unique visitors per day, blocks created, kept and dismissed (and the kept percentage), AI calls and unique
users per provider (`anthropic` is Claude, `openai` is OpenAI), sign-ins, feature use and visits by country. The raw rows can be
queried with SQL in the dashboard or API; the column layout is in `analytics.js`.

**Page views.** In the Cloudflare dashboard open *Analytics & Logs > Web Analytics > Add a site*, enter the hostname
(`cascade.unscriptedlogic.com`, and again for `cascade-dev.unscriptedlogic.com`), choose manual setup, and copy the token from the
snippet (`data-cf-beacon='{"token": "..."}'`). Put it in `CF_BEACON_TOKEN` in `wrangler.toml` for that environment. The token is
public. The Worker adds the snippet to the page, skipping visitors who send Do Not Track.

## How it works

| Piece | File |
| --- | --- |
| Routes: config, Google sign-in, sessions, library | `src/index.js` |
| Google ID token check (RS256 against Google's keys, audience, issuer, expiry) | `src/auth.js` |
| D1 storage: folders, Cascades, users, sessions | `src/d1store.js` |
| Anonymous usage counts, page-view counter | `src/analytics.js` |
| AI keys, model calls, streaming | `src/ai.js` (uses `../../shared/providers.js`, the same adapters as the local app) |
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
