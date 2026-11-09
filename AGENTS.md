# AGENTS.md: promoreel

Instructions for coding agents (Codex, Claude Code and others) working in this repo.

## What this repo is
A kit that makes short promo videos of a developer's **own** web app, in three styles (`docs/styles/`):
- `recorded` (default, 1080×1920): the recorder films flows at phone size, a free local voice reads the script,
  Whisper times the captions;
- `walk` (1080×1920): drawn screens described in JSON, one step at a time, with voice, captions and music;
- `launch` (16:9, 9:16, 1:1): a music-only film of a headline, a counter, drawn screens and a logo.

Remotion renders each from a JSON spec.

There are no paid APIs and no API keys.

## The job you'll usually get: "make a video of my app"
Follow `.claude/skills/promoreel/SKILL.md` step by step. It's written for any agent, not only Claude. In short:
1. `npx promoreel doctor`.
2. Understand the app.
   - `npx promoreel repo <owner/repo | path>` clones it with the user's `gh` login or points at a folder.
   - Read the README and routes, then run the app **locally** with a **test** account.
3. Pick a style with the user:
   - `recorded` needs the app running locally, and records it;
   - `walk` and `launch` need no recording: describe the screens in JSON from what you learned of the app;
   - `launch` has no voice, so skip the voice and captions.
4. Propose 3–5 ideas from real flows, and let the user pick.
5. Write the script by `.claude/skills/promoreel/script-writing.md`:
   - question hook → problem → product on screen → result → shared close;
   - one idea per line, no ellipses;
   - claim only what the footage shows (for drawn screens: what the app does);
   - 85–100 words.
6. `npx promoreel init projects/<app> [--style walk|launch]`, then write `brand.json` and `reels/*.json`
   (`docs/spec.md`), plus `flows/*.flow.json` (`docs/flows.md`) for `recorded`.
7. `npx promoreel record` (recorded only), `voice`, `captions`, `render`, or `all`, which does what the style needs.
   Read each step's warnings and Whisper's read-back.
8. Read every contact sheet (one per cut or format) and check it against `.claude/skills/promoreel/review.md`. Fix, re-render.
9. Report: the video paths and lengths, the sheet, the script, and what you couldn't do.

## Commands
```bash
npm install                                   # once
npx promoreel doctor                          # toolchain check
npx promoreel all examples/generic            # the smoke test: records a public demo site, renders ~33 s
npx promoreel <init|record|voice|captions|render|all|sheet|studio|repo|release|list> …   # see README.md
npm run lint                                  # tsc, no emit
npm test                                      # unit tests (alignment, timelines, motion, screens, audio)
npm run gallery                               # every screen-kit kind in Remotion Studio (for contributors)
```
Every command prints one JSON object per line on stdout (`{"step","status","pct","msg","data"}`). Parse those lines
instead of scraping text.

## Map
| Path | What |
|---|---|
| `src/reel/` | The `recorded` style: `Reel.tsx`, `timeline.ts` (pure timing), `spec.ts` (all types, every style), `shared.ts` (defaults, formats), `theme.tsx` (brand → look), `scenes/` (talk, Phone, Terminal, Showcase, Outro) |
| `src/motion/` | The motion engine walk and launch share: easing, camera, cursor, counter, kinetic words, layout per format |
| `src/screens/` | The screen kit: list, table, form, stat and phone screens drawn from JSON. `npm run gallery` shows them |
| `src/walk/` | The `walk` style: timeline (lines → frames, anchors, beat sync), plan, path world, step tracker, captions, close |
| `src/launch/` | The `launch` style: beat-snapped plan, hook, screen, payoff and logo scenes, the counter |
| `cli/` | The CLI: `index.ts` (dispatch), `commands/`, `record/` (recorder + flow runner), `voice/` (providers), `lib/` (progress, project + validation, manifest) |
| `cli/audio/` | Music and sound effects synthesised in TypeScript, and ffmpeg mastering |
| `templates/project/` | What `promoreel init` copies: a brand, and a starter spec per style |
| `examples/generic` | The smoke test (Playwright's public TodoMVC demo) |
| `examples/promoreel-promo` | The kit's own promo, made with the kit (terminal + showcase scenes) |
| `examples/crewdash` | The showcase: a recorded reel, a walk and a launch film, with specs and brand (no recordings) |
| `examples/sample-walk` | Brindlebook, a made-up app: a walk from JSON alone (Kokoro voice) |
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
- **Claims match the product.** Don't write a line the recording doesn't prove, or, for drawn screens, that the app
  doesn't do.
- **Preserve the user's edits** to specs, flows and brands. Build on them.
- **Code:**
  - TypeScript strict, and `npm run lint` passes.
  - Keep `src/reel/timeline.ts` pure. It is shared by Remotion and the CLI.
  - Scenes and screens read colours and fonts only from `useTheme()`.
  - Nothing brand-specific in `src/`.
