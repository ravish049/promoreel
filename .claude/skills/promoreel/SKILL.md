---
name: promoreel
description: Make a short vertical promo or tutorial reel (1080×1920, 30–45 s) of the user's own web app with promoreel. Use when the user asks for a promo reel, a demo video, a Reel/Short/TikTok of their app, a tutorial clip of a feature, or to "make a video of my app" from a GitHub repo or a local folder. Covers understanding the app, proposing reel ideas, writing the question-hook script, recording flows at phone size, free local voice, Whisper captions, rendering, checking frames and reporting.
---

# promoreel: a reel of the user's app

You turn the user's web app into a short vertical reel with the kit in this repo. Everything runs locally and free: the
recorder (Chromium), Kokoro or Chatterbox voice, Whisper captions, Remotion render. You never need an API key.

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
  `data-*` attributes.

## 2. Propose 3–5 reel ideas, then let the user pick
Each idea gets the same five lines:
```
1. <Title>: <the problem in the viewer's words>
   Flow: <the screens, in order>   ·   Proof on screen: <what the footage literally shows>
   Hook: "<the opening question>"   ·   ~<N> s
```
Only propose flows that exist and work locally. Wait for the user's choice unless they said "just make one".

## 3. Write the script (read `script-writing.md` in this folder first)
The shape is question hook → the problem → the product doing it on screen → the result → the shared close.
- Open with a question.
- One idea per line.
- No ellipses. Use `|` for a breath.
- Claim only what the footage shows.
- Write 85–100 words for about 35 s.

## 4. Write the project
- `npx promoreel init projects/<app> --name "<App>" --url http://localhost:<port>`. Use `projects/` (git-ignored), not `examples/`.
- `brand.json`:
  - the app's real colours (from its CSS or theme), a bundled font or a font file, and its logo in `public/brand/`;
  - up to 15 features, all of them real;
  - the outro's title, CTA and one or two closing lines.
- `flows/<name>.flow.json`: one clip per beat of the script. Read `docs/flows.md`.
  - Use `mark` after a page loads, `focus` on what the camera should zoom to, and `tap` / `type` with labels you will
    reference.
- `reels/<id>.json`: lines and scenes. Read `docs/spec.md`.
  - Start from `examples/generic/reels/todo-promo.json`.
  - For a developer tool, start from `examples/promoreel-promo/reels/promoreel-promo.json` (a `terminal` scene).

## 5. Record, then look at what you recorded
```bash
npx promoreel record projects/<app>
```
- Open a frame or two of each clip (`ffmpeg -ss 2 -i <clip>.mp4 -frames:v 1 x.png`) and look at it.
- Read `<clip>.json`: every event label, its time and its box.
- If a selector missed, a page was still loading or a banner covers the content, fix the flow (`hide`, `waitFor`,
  `mark`) and record again.

## 6. Voice and captions
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

## 7. Render, then check the frames
```bash
npx promoreel render projects/<app>       # out/<id>.mp4, out/<id>-sheet.png, out/manifest.json
npx promoreel sheet projects/<app>/out/<id>.mp4 /tmp/check.png --at 1,4,9,14,19,24,29,33
```
Read the contact sheet image(s) and go through `review.md` in this folder: text inside the safe zone, the right moment
zoomed, captions in sync and spelled your way, nothing private on screen, and the outro reads. Fix and re-render
(only the changed step reruns: voice and captions cache unchanged lines).

## 8. Report
Give the user:
- the video path and length;
- the contact sheet path;
- the script as spoken;
- the voice;
- anything you couldn't do (a flow that needed data you didn't have, a claim you cut because the footage didn't show it).

## Never
- Run `promoreel release`, `gh release`, `git push`, or create a repo, unless the user asks in this conversation.
- Record production, or an account with real customer data.
- Hard-code or commit credentials or tokens.
- Invent a claim the footage doesn't show ("saves 10 hours a week").
- Use a paid voice or API. Everything here is free and local.

## More
- `docs/spec.md`: every spec field and scene type (hook, quiz, phone, terminal, showcase, end).
- `docs/flows.md`: every flow step and target.
- `docs/voice-providers.md`: the voices, and how a provider plugs in.
- `docs/github.md`: the GitHub flow.
- Remotion's own agent skills help with custom scenes: `npx remotion skills add` (Remotion License, installed separately).
