# AGENTS.md: promoreel

Instructions for coding agents (Codex, Claude Code and others) working in this repo.

## What this repo is
A kit that makes short vertical reels (1080×1920, 30–45 s) of a developer's **own** web app:
- the recorder films flows at phone size;
- a free local voice reads the script;
- Whisper times the captions;
- Remotion renders a spec-driven template.

There are no paid APIs and no API keys.

## The job you'll usually get: "make a reel of my app"
Follow `.claude/skills/promoreel/SKILL.md` step by step. It's written for any agent, not only Claude. In short:
1. `npx promoreel doctor`.
2. Understand the app.
   - `npx promoreel repo <owner/repo | path>` clones it with the user's `gh` login or points at a folder.
   - Read the README and routes, then run the app **locally** with a **test** account.
3. Propose 3–5 reel ideas from real flows, and let the user pick.
4. Write the script by `.claude/skills/promoreel/script-writing.md`:
   - question hook → problem → product on screen → result → shared close;
   - one idea per line, no ellipses;
   - claim only what the footage shows;
   - 85–100 words.
5. `npx promoreel init projects/<app>`, then write `brand.json`, `flows/*.flow.json` (`docs/flows.md`) and
   `reels/*.json` (`docs/spec.md`).
6. `npx promoreel record`, `voice`, `captions`, `render`, or `all`, which does everything. Read each step's warnings
   and Whisper's read-back.
7. Read the contact sheet and check it against `.claude/skills/promoreel/review.md`. Fix, re-render.
8. Report: the video path and length, the sheet, the script, and what you couldn't do.

## Commands
```bash
npm install                                   # once
npx promoreel doctor                          # toolchain check
npx promoreel all examples/generic            # the smoke test: records a public demo site, renders ~33 s
npx promoreel <init|record|voice|captions|render|all|sheet|studio|repo|release|list> …   # see README.md
npm run lint                                  # tsc, no emit
npm test                                      # unit tests (alignment, timeline fitting)
```
Every command prints one JSON object per line on stdout (`{"step","status","pct","msg","data"}`). Parse those lines
instead of scraping text.

## Map
| Path | What |
|---|---|
| `src/reel/` | The Remotion template: `Reel.tsx`, `timeline.ts` (pure timing), `spec.ts` (all types), `theme.tsx` (brand → look), `scenes/` (talk, Phone, Terminal, Showcase, Outro) |
| `cli/` | The CLI: `index.ts` (dispatch), `commands/`, `record/` (recorder + flow runner), `voice/` (providers), `lib/` (progress, project, manifest) |
| `examples/generic` | The smoke test (Playwright's public TodoMVC demo) |
| `examples/promoreel-promo` | The kit's own promo, made with the kit (terminal + showcase scenes) |
| `examples/crewdash` | The showcase: a finished reel, its spec and brand (no recordings) |
| `projects/`, `apps/` | The user's own projects and cloned apps (git-ignored) |

## Rules
- **Credentials** come only from environment variables (`PROMOREEL_LOGIN_EMAIL` / `PROMOREEL_LOGIN_PASSWORD`, or the names a
  flow sets). Never write them to a file, a flow, a spec, a log or a commit.
- **Record local or staging builds** with test data, not production with real customers. The recorder refuses to sign
  in to a non-local host unless `PROMOREEL_ALLOW_REMOTE_LOGIN=1`.
- **Publishing is the user's call.** Run `promoreel release`, `gh release …`, `git push`, or create a repo only when the
  user asks for it in the conversation.
- **Free only.** Don't add a paid API to the default path. A paid voice goes behind the `VoiceProvider` interface
  (`docs/voice-providers.md`) as an opt-in.
- **Claims match footage.** Don't write a line the recording doesn't prove.
- **Preserve the user's edits** to specs, flows and brands. Build on them.
- **Code:**
  - TypeScript strict, and `npm run lint` passes.
  - Keep `src/reel/timeline.ts` pure. It is shared by Remotion and the CLI.
  - Scenes read colours and fonts only from `useTheme()`.
  - Nothing brand-specific in `src/`.
