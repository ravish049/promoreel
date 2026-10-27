# promoreel studio: plan (Part 3, not built)

A local web page that makes the kit usable without a terminal. It has four parts:
- a chat box that drives the developer's **own** Claude Code or Codex;
- a "Connect GitHub" button that goes through `gh`;
- live progress from the CLI;
- a gallery of finished reels.

It runs on `localhost` only, and it costs nothing beyond the subscription the developer already has.

## What already exists for it
- **The CLI is the API.** Every action is a `promoreel <command>`, and every command streams one JSON object per line on
  stdout (`cli/lib/progress.ts`). Studio needs no new back-end logic, only a process runner. Events look like this:
  ```json
  {"step":"render","status":"progress","pct":64,"msg":"frames 612/983, encoded 590","project":"generic","ts":"…"}
  {"step":"render","status":"done","pct":100,"msg":"out/todo-promo.mp4 · 32.77 s","data":{"id":"todo-promo","path":"out/todo-promo.mp4","durationSec":32.77,…}}
  ```
  `status` ∈ `start | progress | log | warn | done | error`. `pct` is per step. `promoreel all` adds `{"step":"all"}`
  events with the overall percentage.
- **The gallery reads `out/manifest.json`** of each project. It lists id, title, path, sheet, duration, size, voice,
  created and spec.
- **The sidebar reads `promoreel list`**: projects, reels, flows and videos, as one JSON event.
- **GitHub is `promoreel repo`**: a clone with the developer's `gh` session, plus a JSON summary of the app.
- **Publishing is `promoreel release`**, with `--dry-run` to preview.

## Shape
```
studio/            (new, later)
  server.ts        Node http server on 127.0.0.1:4321 (no framework needed), serves the page + 4 endpoints
  public/index.html, app.js, style.css   one page, no build step
```

| Endpoint | Does |
|---|---|
| `GET /api/projects` | Runs `promoreel list`, returns its `data` |
| `GET /media/<project>/<path>` | Streams a file from that project's `out/` only, with Range support for `<video>`, download via `?download=1`. Paths are normalised and confined to `out/` |
| `POST /api/run` `{ cmd, args }` | Spawns `promoreel <cmd> …` from an allow-list (`record voice captions render all sheet repo list doctor`). Returns a run id. `release` needs a separate confirm step in the UI |
| `GET /api/runs/<id>/events` | Server-Sent Events: each stdout JSON line is forwarded as is; stderr lines become `{"status":"log"}` |
| `POST /api/agent` `{ engine, prompt, sessionId? }` | Spawns the agent (below) and streams its events over SSE |
| `GET /api/github` | `gh auth status` and `gh repo list --json name,owner,description --limit 50`, so the user can pick a repo |

## The chat box: the developer's own agent
- **Claude Code:**
  `claude -p "<prompt>" --output-format stream-json --verbose [--resume <sessionId>] --allowedTools "Bash(npx promoreel:*),Read,Write,Edit,Glob,Grep"`.
  Each line is a JSON event: assistant text, tool use, tool result. The page renders text as chat bubbles and tool calls
  as collapsible rows. The `session_id` from the first event lets the next message `--resume`.
- **Codex:** `codex exec --json "<prompt>"` (and `codex exec resume <id>` for a follow-up) in the repo. It reads
  `AGENTS.md`.
- Both run with the repo as their working directory, so the `promoreel` skill and `AGENTS.md` apply unchanged.
- When the agent runs `npx promoreel …`, its JSON lines appear inside the tool result. The page can pick out lines that
  parse as promoreel events and show them as live progress bars in the chat.
- **Who's signed in:** whatever the developer's CLI is logged into (their subscription). The studio stores no
  credentials and calls no model API itself.

## Connect GitHub
1. The button calls `GET /api/github`. If `gh` isn't signed in, show the one command (`gh auth login`) and a "check
   again" button. Never take a token in the page.
2. Signed in: a searchable list of the user's repos. Picking one runs `promoreel repo owner/name` (SSE progress), then
   pre-fills the chat: "Propose 3–5 reel ideas for apps/<name>".

## Live progress
- One progress bar per step (record, voice, captions, render), driven by `pct`. `warn` lines show as yellow notes under
  the bar.
- `error` shows the message and a "copy log" button.
- `done` with `data.path` reloads the gallery card.

## Gallery
- Cards from every project's `manifest.json`, newest first: the sheet PNG as the poster, then title, duration and voice.
- Click to play (`<video src=/media/…>`). There's a Download button and an "Open spec" link.
- A "Re-render" button runs `promoreel render <project> --reel <id>`.
- A "Attach to release…" button opens a confirm dialog with the exact `gh` command from `--dry-run` before running it.

## Safety
- Bind to `127.0.0.1` only, and check the `Host` header (DNS-rebinding guard). Add a random per-launch token in the page
  URL that every API call must carry.
- Allow-list the CLI commands, and pass args as an array (no shell).
- Confine file serving to `<project>/out/`.
- `release` and anything that pushes always need a click in a confirm dialog that shows the command.

## Size
About 400 lines of server code and 500 of page code, with no new dependencies: Node's `http`, `child_process`, SSE.
Open questions for the owner:
- Should the studio also embed Remotion Studio (`promoreel studio`) for scrubbing a reel?
- Is a single page with a project switcher enough?
