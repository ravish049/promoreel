# STORY-02.4 — Replace composition

## Goal
The `Replace` composition: a 8–20 s music-only ad in 9:16, 4:5 and 1:1 built from 02.1's spec and 02.2/02.3's parts,
with an end frame that also works as the still.

## Done When
- `src/replace/plan.ts` (pure, tested) times the beats from `seconds` and the number of tools. At the default 12 s with
  six tools, the beats are as follows (the timings scale with `seconds`):
  - 0–1.2 s: the logo and the headline land.
  - 1.2–3.4 s: the tools pop in left to right.
  - 3.6–4.6 s: the scribble draws across them.
  - 4.8–5.6 s: the tools sink and fade while the phone rises (or, with a photo, the screen lights up).
  - From 5.6 s: the screen builds in.
  - At about 8 s: the primary button is pressed.
  - The rest: a hold on the final frame.

  Cuts land on the beat of `music.bpm`.
- `src/replace/layout.ts` (pure, tested) gives the logo, headline, tool row and phone boxes for each format. Everything
  essential (headline, tools, the phone's title and buttons) sits inside each format's safe area, with no overlaps. The
  tool row wraps to two rows when the tiles would be smaller than 96 px. `src/motion/layout.ts` learns 4:5 as a portrait
  kind.
- `src/replace/Replace.tsx` has two modes:
  - Drawn mode: the screen kit's phone frame on a soft brand gradient, rising with a slight tilt that settles.
  - Photo mode: `PhotoScreen` behind everything, with a top scrim so the headline reads on any photo.

  Fonts are gated before frame 0. Photo-mode warnings from 02.3 print during `render`, `all` and `studio`.
- `pitch` joins the screen kit: `src/screens/inner.tsx` and `index.ts` draw it, and the gallery shows it.
- `src/replace/audio.ts`: a short music bed (01.2), a pop per tool, the scribble sound under the scribble, a click on the
  button press, then the master. `RENDER_HOOKS.replace` runs it.
- `src/Root.tsx` registers `Replace` with its width and height taken from the format.
- A throwaway spec (not committed) renders all three formats in both modes, plus stills. The contact sheets and stills
  pass the review checklist, and the loudness is −16 to −14 LUFS with a true peak at or below −1 dBFS.
- Batch 1 review fixes:
  - `probeMediaSize` honours JPEG EXIF orientation (it swaps the size for orientations 5–8), and the photo is drawn
    upright. Tested with an Orientation=6 JPEG.
  - `tools[].color` and `scribble.color` must be `#rgb` or `#rrggbb`, and `scribble.seed` an integer. Each fails with
    a clear reason.
  - The scribble sound's strokes follow `scribblePath().phases`, so the sound matches the drawing.
  - The output-name clash check also covers stills (`.png`) and contact sheets (`-sheet.png`).
  - The default tile colours are shifted away from well-known products' colours.
  - One copy of each shared type and constant: `ToolIconName`, `ToolSpec`, `PitchScreen` and the background type come
    from `src/reel/spec.ts`; `TOOL_ICONS` and the dim constants from `shared.ts`. The inner width is exported from
    `Phone.tsx`. `background.size` is required, and the browser fallback that reads the size is removed.
  - `PitchScreen` joins `InnerScreen`.
- `npm run lint` and `npm test` pass, and the `examples/generic` video md5 is unchanged.

## Files
- `src/replace/plan.ts`, `plan.test.ts`, `layout.ts`, `layout.test.ts`, `Replace.tsx`, `audio.ts`, `audio.test.ts`, `index.ts`
- `src/motion/layout.ts`, `src/screens/inner.tsx`, `src/screens/index.ts`, `src/screens/Gallery.tsx`
- `src/Root.tsx`, `cli/commands/render.ts`, `cli/commands/all.ts`, `cli/commands/studio.ts`
- Review fixes: `cli/lib/project.ts`, `cli/lib/project.test.ts`, `cli/audio/sfx.ts`, `cli/audio/synth.ts`, `src/replace/parts/*`, `src/replace/PhotoScreen.tsx`, `src/replace/perspective.ts`, `src/reel/spec.ts`, `src/reel/shared.ts`, `src/screens/Phone.tsx`, `src/screens/timing.ts`, `src/walk/plan.ts`, `src/launch/plan.ts`
