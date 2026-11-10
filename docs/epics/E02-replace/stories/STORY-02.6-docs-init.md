# STORY-02.6 — Docs, skill and `init --style replace`

## Goal
A new developer can find the replace style, start one with one command, and edit it without reading code.

## Done When
- `README.md`: one new row in "Pick a style" (the formats are 9:16, 4:5 and 1:1, with video + still), linking
  `docs/styles/replace.md` and the CrewDash example. There are no other README changes.
- `docs/styles/replace.md` follows the shape of `launch.md`:
  - when to use it;
  - the two commands to make one;
  - the fields you usually edit;
  - a minimal spec;
  - photo mode in a short section: how to take the photo, and how to read the four corners, in pixels, from any image
    viewer;
  - a note that the kit does not ship third-party logos.
- `docs/spec.md` gets a replace section, and the `pitch` screen goes under the screen kit.
- `npx promoreel init <dir> --style replace` writes `brand.json`, `reels/replace.json` (a working drawn-mode example)
  and a README, and renders as it is. The usage text and the `init` test cover it.
- `.claude/skills/promoreel/SKILL.md` asks about the replace style, and `review.md` gets a short replace section:
  - the headline is readable on the photo;
  - the scribble covers every tile;
  - the phone's buttons are inside the safe area;
  - the still's frame is complete;
  - the 4:5 and 1:1 edges are clear.
- `npm run lint` and `npm test` pass, and all relative links resolve.

## Files
- `README.md`, `docs/styles/replace.md`, `docs/spec.md`
- `cli/commands/init.ts`, `cli/lib/init.test.ts`, `cli/index.ts` (usage text only), `templates/project/reels/replace.json`, `templates/project/README.replace.md`
- `.claude/skills/promoreel/SKILL.md`, `.claude/skills/promoreel/review.md`
