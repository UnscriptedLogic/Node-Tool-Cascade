# Cascade

> **A tool to help you find and ask better questions to get better answers**

Cascade is a real-time decision tree for thinking through hard design problems. Drop a question, an emotion or a
decision onto the canvas and Cascade finds where it belongs, then grows branches around it. It can trace a player's
frustration back to its causes, grill you until your decisions are real, map what is still undecided, and answer
questions about your own graph by lighting up the line of blocks that answers it.

Made for game design, useful for any decision tree.

## Tech stack

- **Runtime:** Node.js 18+ with no runtime dependencies (built-in modules only).
- **Frontend:** a single-file vanilla HTML, CSS and JavaScript app (`app/app.html`), no framework and no build step
  for the local app.
- **AI providers:** OpenRouter, ChatGPT plan, Anthropic API, OpenAI API, or any OpenAI-compatible endpoint
  (Ollama, LM Studio, Groq).
- **Testing:** Node's built-in test runner with jsdom and local mock providers.
- **CI and hosting:** GitHub Actions, with the static web build deployed to GitHub Pages.

## Try it

**No install:** open the web version at `https://unscriptedlogic.github.io/Node-Tool-Cascade/` *(see [Publishing](#publishing-the-web-version))*.
It starts in a **demo mode** with scripted responses on an example tree, so you can feel every feature without an
account. When you want real AI, click **Continue with OpenRouter**.

**On your computer:** needs [Node.js](https://nodejs.org) 18 or newer, nothing else to install.

```bash
git clone https://github.com/UnscriptedLogic/Node-Tool-Cascade.git
cd Node-Tool-Cascade
npm start          # or double-click start.command (Mac) / start.bat (Windows)
```

Your browser opens at <http://localhost:4173>. If that port is busy Cascade picks a free one, and it frees the port
again when you quit.

## Connecting an AI

You never have to paste an API key to get started. Pick whichever of these suits you:

| Option | Web version | Local app | What you need |
| --- | :---: | :---: | --- |
| **Demo** | yes | yes | Nothing. Scripted answers on the example tree. |
| **OpenRouter** | yes | yes | A free OpenRouter account and some credit. One click signs you in, and one key reaches Claude, GPT, Gemini and more. |
| **ChatGPT plan** | | yes | ChatGPT Plus or Pro. Uses your plan instead of an API key (OpenAI's open-source preview). |
| **Claude** (Anthropic API) | | yes | An Anthropic API key. |
| **OpenAI API** | | yes | An OpenAI API key. |
| **Custom endpoint** | | yes | Anything OpenAI-compatible: Ollama, LM Studio, Groq and others. Free if it runs on your machine. |

Anthropic doesn't offer a sign-in that lets third-party apps use a Claude subscription, so Claude needs either an API key or OpenRouter.

**Where keys live.** In the web version an OpenRouter key sits in your browser's storage and is sent only to
OpenRouter. In the local app, keys and sign-ins are saved in files on your computer (`settings.json`,
`chatgpt-auth.json`, owner-readable only) and are never sent to the page, which only sees the last four characters.

## What it does

- **Domino placement.** Drag a block on. The AI picks its parent, links related nodes, then grows ghost branches in
  waves that you keep or dismiss. Answers, questions, emotions, consequences, decisions, fog and game-loop stages.
- **Trace back.** Start from a player emotion and get the "why" questions that lead to its likely causes, linked to
  nodes already in your tree.
- **Goal and steering.** Give the tree an overarching goal, context, pillars and things to avoid. Every suggestion
  leans toward it.
- **Grill.** The AI interviews you in rounds and pushes back on weak answers, but never writes an answer for you.
  Settled questions land on the canvas as decisions.
- **Map.** A layer showing what is up next, waiting, settled, foggy or out of scope, with ticket types and blocking
  links. "Chart the map" drafts the tickets from your goal.
- **Make it yours.** Choose a shape, colours and size for each kind of block (diamonds, hexagons, pills, tags...),
  recolour the player moods, and set wires to default, bezier, straight or manhattan with adjustable curve, elbow and
  corners. Start from a preset, describe the look in words, or edit it as text.
- **Ask the graph.** Type a question. If a thread of blocks answers it, the thread lights up in order. If not, you
  get the gaps. Then summarise the thread or the whole tree.
- **Project folder** *(local app)*. Point it at a game project (Unity, Unreal, Godot or your own engine). It builds an
  editable brief of what the notes and code already decide, seeds the graph with sourced suggestions, and lets Ask
  and Grill cite the files they used. See [Project folders](#project-folders).

See the [guide](docs/guide.md) for details.

## Project folders

*Local app only, under **Settings > Project**.* Choose a game project's folder and Cascade learns from it, on top of
your goal and steering.

1. **Scan.** Reads the folder on your computer. It follows the project's `.gitignore`, skips each engine's generated
   folders (Unity `Library/`, Unreal `Binaries/` and `Saved/`, Godot `.godot/` and `addons/`), binaries, generated and
   minified files, and anything that looks like a secret. Links out of the project are never followed. Possible keys,
   tokens and passwords inside the files it does read are redacted. You see exactly what was read and skipped.
2. **Build a brief.** For code, Cascade does not send whole files. It extracts compact digests (class and function
   names, tuning values such as `moveSpeed = 6.5`, TODOs and FIXMEs) plus a little raw code from the most
   design-relevant files, and the AI turns those into findings and then a short brief. You see an estimate of the
   tokens first, can stop at any time, and can edit the brief. After changes, *Update brief* rereads only the folders
   that changed.
3. **The brief** is added under your goal and pillars in every AI call, and the goal always wins if they disagree.
   Turn it off with a checkbox.
4. **Seed the graph.** Drafts ghost nodes for decisions the project already made, open questions (TODOs and
   conflicts with your goal), fog and loop stages. A node with no real source is refused, and every kept node
   remembers its file and line. Click the small file mark on a node to read the code.
5. **Ask and Grill cite the files.** For each question, Cascade searches the project on your computer and gives the AI
   the few best excerpts. Ask shows whether its answer came from the tree, the files or both, with clickable
   citations. Grill asks whether code that already decides something is intended, and pushback can point at code
   that contradicts an answer.

What leaves your machine: only the digests, excerpts and findings in those prompts, to the AI you connected (never to
Cascade, which has no backend). A local model keeps all of it on your computer. Files, the brief and the search index
are saved next to your other data as `project.json` and `project-index.json`, both git-ignored. *Forget this project*
removes them.

## Publishing the web version

1. Push the repo to GitHub.
2. In **Settings > Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/pages.yml` builds `dist/web/index.html` and deploys it.

OpenRouter sign-in returns to the page's own address, so it works on any `https` host. To build locally:
`REPO_URL=https://github.com/UnscriptedLogic/Node-Tool-Cascade npm run build`.

## Privacy and security

- There is no Cascade backend. The web version talks only to OpenRouter (when you sign in). The local app talks
  only to the provider you pick, from your own machine.
- The local server listens on `127.0.0.1` only and accepts requests only from pages it served itself.
- Never commit `settings.json`, `tree.json`, `chatgpt-auth.json`, `project.json`, `project-index.json` or `.env`. They are in `.gitignore`.
- A project folder is read-only and only files from your scan can be shown back. Secret-looking files are never read,
  and secret-looking strings inside other files are redacted before anything is indexed or sent.
- **If you fork this:** OpenAI allows ChatGPT plan usage for open-source and locally hosted apps. Putting the local
  server on a public host for other people to use would be a remotely hosted app, which needs OpenAI's approval
  first. Run it locally, or use the web version, which does not use ChatGPT plan usage.

## Development

```bash
npm install
npm test           # server and UI tests, against local mock providers
npm run build      # writes dist/web/index.html
```

| Path | What it is |
| --- | --- |
| `app/app.html` | The whole app, one file. Every mode runs this. |
| `server/server.js` | Local server: ports, shutdown, routes. |
| `server/lib/` | Settings, provider adapters, and the ChatGPT sign-in flow. |
| `scripts/build.js` | Produces the static web build. |
| `test/` | Tests and mock providers. No network or real keys needed. |

The app has three modes decided by what the host page injects: hosted inside Claude, the static web build, and the
local server. The demo provider lives in the page itself, so it works in all of them.

**Notes for contributors.** The ChatGPT flow follows OpenAI's published open-source guide, which is a preview and may
change. It is tested against a mock that implements the documented contract, not against OpenAI. If you ship
OpenAI's branding for the sign-in button, follow their UI guidelines.

## Credits and licence

The grill and map ideas are inspired by Matt Pocock's `/grill-me` and `/wayfinder` skills, rebuilt independently for
design trees. Cascade is not affiliated with or endorsed by OpenAI, Anthropic or OpenRouter.

## License

Cascade is open source under the [MIT License](LICENSE). Use it, fork it and build on it freely.
