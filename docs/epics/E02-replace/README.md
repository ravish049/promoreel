# E02 — Style: replace ad

## Goal
A developer can make a short "replace your tools" ad from JSON alone. It has a logo and a headline at the top, then a
row of the tools a customer uses today. A hand-drawn scribble crosses those tools out, and a phone rises showing the
app with its call to action. It renders as a short video and a still image in 9:16, 4:5 and 1:1.

| Style | What it is | Formats | Sound |
|---|---|---|---|
| `replace` | Headline, a row of tool icons scribbled out, a phone with the app's pitch screen and CTA buttons. Optional photo background with the screen placed onto the photo's phone | 9:16, 4:5, 1:1 (video + still) | Music + pops, scribble, click; no voice |

Reference: the owner shared a feed ad of this kind (logo, "Replace all your team management tools", app icons crossed
out with a yellow scribble, a hand holding a phone over boxes). This epic builds the generic version of that ad.

## Principles
- Free and local, as in E01: music and sound effects are synthesised in TypeScript, and nothing needs a paid service.
- No third-party logos in the repo. The kit draws generic tool icons (spreadsheet, chat, phone, email, calendar,
  calculator, clipboard, notes, folder). A project may supply its own icon images instead.
- Nothing brand-specific in `src/`. Copy comes from the spec, and colours and fonts from the theme.
- The photo background is optional. Without a photo, a drawn phone sits on a soft brand background.
- With a photo, you give the four corners of the phone screen in the photo's own pixels. A still photo or a clip shot on
  a tripod works. Handheld footage, which would need motion tracking, is out of scope.
- `recorded`, `walk` and `launch` render exactly as before (the `examples/generic` video md5 is unchanged).
- README grows by one row in "Pick a style"; depth goes into `docs/styles/replace.md`.
- No invented claims in example copy (no user counts or ratings).

## Stories
| Story | Name | Depends on |
|---|---|---|
| 02.1 | Spec and CLI: `replace` style, 4:5 format, stills, background probe | — |
| 02.2 | Ad parts: tool icon tiles, scribble, pitch screen, scribble sound | — |
| 02.3 | Photo placement: four corners to a perspective transform, crop per format | — |
| 02.4 | Replace composition | 02.1, 02.2, 02.3 |
| 02.5 | Examples: CrewDash and Brindlebook replace ads | 02.4 |
| 02.6 | Docs, skill and `init --style replace` | 02.1 |

## Batch plan
No two stories in one batch touch the same file. Stories 02.2 and 02.3 use their own local prop types, which match the
spec types 02.1 writes, so all three can be built in parallel. Story 02.4 wires them together.

| Batch | Stories (parallel) | Why this grouping |
|---|---|---|
| 1 | 02.1 · 02.2 · 02.3 | Independent foundations: spec + CLI; drawing parts in `src/replace/parts/` + one sfx; pure perspective math |
| 2 | 02.4 · 02.6 | Composition registers in `src/Root.tsx` and the screen kit; docs, skill and `init` touch neither |
| 3 | 02.5 | Examples need the composition |

## Gate after every batch
- `npm run lint` and `npm test` pass.
- `npx promoreel all examples/generic` still renders with the same video md5 (`ad3be38f9fb70d5cc7380347f81cb647`).
- From batch 2: render every new spec in all three formats, read contact sheets and stills against
  `.claude/skills/promoreel/review.md` (safe zone, overlaps, nothing off canvas, text readable on the photo), and check
  loudness (−16 to −14 LUFS, true peak ≤ −1 dBFS).
- A review agent reads the batch diff for bugs and brand-specific leaks into `src/`.

## Owner step (optional, not blocking)
A photo for the photo-background demo: a hand holding a phone with the screen toward the camera, portrait, at least
1080 px wide, taken on a tripod or held still. Without one, the CrewDash example ships drawn-only, and the photo path is
checked with a generated test image that is not committed.

## Out of scope
- Motion tracking for handheld clips; masking fingers that cover the screen.
- 4:5 for `launch` and `walk`.
- Voice-over for this style.

## Delivery
One PR from `epic/e02-replace` to `main` with a report. The owner merges.
