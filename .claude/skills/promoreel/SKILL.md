---
name: promoreel
description: Make a short promo, tutorial or launch video of the user's own web app with promoreel, in one of three styles - a recorded reel (9:16, the app filmed at phone size), a voiced feature walk of drawn screens (9:16), or a music-only launch film (16:9, 9:16 and 1:1). Use when the user asks for a promo reel, a demo or launch video, a Reel/Short/TikTok of their app, a tutorial clip of a feature, or to "make a video of my app" from a GitHub repo or a local folder. Covers understanding the app, picking a style, proposing ideas, writing the question-hook script, recording flows or describing screens in JSON, free local voice, Whisper captions, rendering, checking frames and reporting.
---

# promoreel: a video of the user's app

You turn the user's web app into a short video with the kit in this repo. Everything runs locally and free: the
recorder (Chromium), Kokoro or Chatterbox voice, Whisper captions, synthesised music, Remotion render. You never need an
API key.

Work in this order. Each step ends with something you can check; don't move on until it passes.

**Preserve the user's changes.** If they edited a spec, flow or brand by hand, build on their version. Don't regenerate it.

## 0. Check the toolchain
```bash
npx promoreel doctor          # or: node bin/promoreel.cjs doctor
```
Fix anything marked MISSING with the command it prints. Chatterbox, gh and whisper.cpp are optional or install on first use.

## 1. Understand the app
- **From GitHub:** `npx promoreel repo owner/name`. This clones with the user's own `gh` login into `apps/<name>/`.
  **From a local folder:** `npx promoreel repo ../their-app`.
- Read its summary: the README, framework, scripts and routes. Then read the README itself and the main routes and pages.
- Run the app **locally** as its README says. Use a test or seed account, never real customer data or production.
  - If it needs a login, ask the user for a **test** account and have them export `PROMOREEL_LOGIN_EMAIL` and
    `PROMOREEL_LOGIN_PASSWORD` in their shell.
  - Never write credentials into a file, a flow, a spec or a commit.
- Open the app at phone size (390×844) and click through the flows you might film. Note real selectors: roles, labels,
  `data-*` attributes. For a walk or launch film, note what the screens really show instead: titles, columns, fields,
  button labels and what each button does.

## 2. Pick a style
Choose with the user before proposing ideas (one page each in `docs/styles/`):

| Style | Use it for | What it needs |
|---|---|---|
| `recorded` (default) | A promo or tutorial of a real flow, 9:16 | The app running locally, and recording (step 6) |
| `walk` | How several features fit together, 9:16, a long and a short cut | No recording: you describe each screen in JSON from what you learned of the app. Voice, captions, music |
| `launch` | A launch or announcement film in 16:9, 9:16 and 1:1 | No recording, **no voice**: a headline, a counter, drawn screens, cards and a logo, set to music |

If the app can't run locally, or its real screens hold data that can't be shown, suggest `walk` or `launch`.

## 3. Propose 3–5 ideas, then let the user pick
Each idea gets the same five lines:
```
1. <Title>: <the problem in the viewer's words>
   Flow: <the screens, in order>   ·   Proof on screen: <what the footage literally shows>
   Hook: "<the opening question>"   ·   ~<N> s
```
Only propose flows that exist (and, for `recorded`, work locally). Wait for the user's choice unless they said "just make one".

## 4. Write the script (read `script-writing.md` in this folder first)
The shape is question hook → the problem → the product doing it on screen → the result → the shared close.
- Open with a question.
- One idea per line.
- No ellipses. Use `|` for a breath.
- Claim only what the footage shows. For drawn screens: only what the app really does.
- Write 85–100 words for about 35 s (a walk's short cut: about 40 words for 15–20 s).
- A launch film has no voice: write the hook's headline, the few `words` over each screen and the payoff cards instead,
  with the same rules.

## 5. Write the project
- `npx promoreel init projects/<app> --name "<App>" --url http://localhost:<port>`, adding `--style walk` or
  `--style launch` for those styles. Use `projects/` (git-ignored), not `examples/`. A walk or launch project renders
  as it is, so you can run `all` once before editing to see the shape.
- `brand.json`:
  - the app's real colours (from its CSS or theme), a bundled font or a font file, and its logo in `public/brand/`;
  - up to 15 features, all of them real;
  - the outro's title, CTA and one or two closing lines.
- **recorded:** `flows/<name>.flow.json`: one clip per beat of the script. Read `docs/flows.md`.
  - Use `mark` after a page loads, `focus` on what the camera should zoom to, and `tap` / `type` with labels you will
    reference.
- **recorded:** `reels/<id>.json`: lines and scenes. Read `docs/spec.md`.
  - Start from `examples/generic/reels/todo-promo.json`.
  - For a developer tool, start from `examples/promoreel-promo/reels/promoreel-promo.json` (a `terminal` scene).
- **walk:** `reels/walk.json`: lines, one step per feature with its `screen` (list, table, form, stat, or a phone around
  one) and `anchors` that pin each screen action to a spoken word, then the `cuts`. See `examples/sample-walk`.
- **launch:** `reels/launch.json`: `formats`, the `counter`, and `scenes` (hook, screen, payoff, logo) with their
  `seconds`. See `examples/crewdash/reels/launch.json`.
- Use the app's real names, labels and plausible sample data. No real customer names.

## 6. Record, then look at what you recorded (`recorded` only)
```bash
npx promoreel record projects/<app>
```
- Open a frame or two of each clip (`ffmpeg -ss 2 -i <clip>.mp4 -frames:v 1 x.png`) and look at it.
- Read `<clip>.json`: every event label, its time and its box.
- If a selector missed, a page was still loading or a banner covers the content, fix the flow (`hide`, `waitFor`,
  `mark`) and record again.

## 7. Voice and captions (not for `launch`)
```bash
npx promoreel voice projects/<app>        # Kokoro by default; "use": "chatterbox" for the more natural voice
npx promoreel captions projects/<app>
```
- Read every `warn` line. A line that overlaps another means you shorten the line, widen its `offsetMs`, or slow the clip.
  The CLI already slows a clip that is too short for its line, and says so.
- Read what Whisper `heard` for each line.
  - A word that reads back wrong usually means a slurred word: give that line a new `seed` (Chatterbox) or reword it.
  - A homophone ("real" for "reel") or a brand name spelled differently is fine, because captions use your own spelling.
- Aim for 30–45 s total (`out/<id>.timeline.json`).

## 8. Render, then check the frames
```bash
npx promoreel render projects/<app>       # out/<id>.mp4, out/<id>-sheet.png, out/manifest.json
npx promoreel sheet projects/<app>/out/<id>.mp4 /tmp/check.png --at 1,4,9,14,19,24,29,33
```
A walk renders one video per cut and a launch film one per format, each with its own sheet. Read every contact sheet
and go through `review.md` in this folder: text inside the safe zone, the right moment zoomed, captions in sync and
spelled your way, nothing private on screen, nothing cut off at the edges in 16:9 or 1:1, and the close reads. Fix and
re-render (only the changed step reruns: voice and captions cache unchanged lines).

## 9. Report
Give the user:
- the video path and length;
- the contact sheet path;
- the script as spoken;
- the style and the voice;
- anything you couldn't do (a flow that needed data you didn't have, a claim you cut because the footage didn't show it).

## Never
- Run `promoreel release`, `gh release`, `git push`, or create a repo, unless the user asks in this conversation.
- Record production, or an account with real customer data.
- Hard-code or commit credentials or tokens.
- Invent a claim the footage, or the app, doesn't back up ("saves 10 hours a week").
- Use a paid voice or API. Everything here is free and local.

## More
- `docs/styles/`: one short page per style (recorded, walk, launch).
- `docs/spec.md`: every spec field: the recorded scenes, walk steps, anchors and cuts, launch scenes, the screen kit.
- `docs/flows.md`: every flow step and target.
- `docs/voice-providers.md`: the voices, and how a provider plugs in.
- `docs/github.md`: the GitHub flow.
- Remotion's own agent skills help with custom scenes: `npx remotion skills add` (Remotion License, installed separately).
