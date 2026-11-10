# STORY-02.2 — Ad parts: tool icon tiles, scribble, pitch screen, scribble sound

## Goal
The drawn pieces of a replace ad, each usable on its own: app-style tool tiles, a hand-drawn scribble that draws itself
across them, the phone's pitch screen, and a scribble sound.

## Done When
- `src/replace/parts/ToolTile.tsx`: a rounded-square tile with a coloured fill and a white glyph, for each of
  `spreadsheet, chat, phone, email, calendar, calculator, clipboard, notes, folder` (glyphs drawn in SVG, no third-party
  logos). It takes `color` and an optional `label` under the tile, and draws an `image` (public/ path) in the tile instead of
  a glyph. Default colours are a fixed neutral set in this file, not taken from any brand.
- `src/replace/parts/scribblePath.ts` (pure): `scribblePath(box, seed, opts)` returns an SVG path that zigzags across a row
  box (6–10 strokes with jitter, a little overshoot at the ends, and a loop or two), plus its length. The same seed always
  gives the same path. Unit tests check that it is deterministic, that it stays within the box plus the overshoot, and
  that the stroke count stays in range.
- `src/replace/parts/Scribble.tsx`: draws the path with `stroke-dashoffset` over a 0–1 `progress`, with an uneven speed
  (fast strokes, slower turns). Stroke width scales with the box, and the ends are rounded.
- `src/replace/parts/Pitch.tsx`: the pitch screen (eyebrow, title, body, one or two buttons, footnote), sized for the
  screen kit's inner width and laid out with the theme's fonts and colours. It builds in step by step from a `progress`
  prop, and has a `press` prop (0–1) for the primary button. Its props are a local type that matches 02.1's `PitchScreen`.
- `cli/audio/sfx.ts`: `scribble(rng, dur)`, a marker-on-paper scratch (band-passed noise in strokes), with a unit test for
  length and peak.
- A throwaway still (not committed) of the tiles, a scribble at 0.5 and 1, and a pitch screen. Read it for legibility.
- `npm run lint` and `npm test` pass.

## Files
- `src/replace/parts/ToolTile.tsx`, `glyphs.tsx`, `scribblePath.ts`, `scribblePath.test.ts`, `Scribble.tsx`, `Pitch.tsx`
- `cli/audio/sfx.ts`, `cli/audio/synth.test.ts`
