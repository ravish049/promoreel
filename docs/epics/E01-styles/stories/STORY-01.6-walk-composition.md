# STORY-01.6 — Walk composition

## Goal
The `Walk` composition: the feature-walk reel from CrewDash variation C v4, driven entirely by the spec, brand and
voice.

## Done When
- `src/walk/Walk.tsx` renders: optional visual hook (logo + headline over the lit chain), one screen per step from the
  screen kit placed along a path the camera follows (eased moves, motion blur on fast moves, slight tilt and parallax),
  word-by-word captions in the safe zone, the step tracker, and the logo + tagline + CTA close.
- Step tracker: each step shows its icon and label from the spec; finished steps turn to the theme's success colour
  with a check; the current step's label **crossfades** (no overlapping roll); the tracker lists only the cut's steps
  and leaves before the logo and CTA.
- Background `paper` from the theme (so a cream brand gets cream); every colour from `useTheme()`.
- Voice lines and the music bed (01.2) play from `public/vo/…` and `public/audio/<id>-<cut>.wav`.
- `src/walk/audio.ts` builds the audio job from the timeline (sections at scene cuts, whoosh on camera moves, chime on
  each step done, voice spans for ducking); `render.ts` runs it before rendering a walk and runs the master after.
- `calculateMetadata` loads `lines.json` and `captions.json` and runs `buildWalkTimeline`.
- `src/Root.tsx` registers `Walk` (1080×1920) next to `Reel`; `Reel` is unchanged.
- A throwaway test spec in the worktree (not committed) renders a long and a short cut; stills at every scene cut pass
  the review checklist (safe zone, no overlap, nothing off canvas).
- `npm run lint` and `npm test` pass; `examples/generic` renders as before.

## Files
- `src/walk/Walk.tsx`, `World.tsx` (path + camera), `Tracker.tsx`, `Captions.tsx`, `Close.tsx`, `audio.ts`, `index.ts`
- `src/Root.tsx`, `cli/commands/render.ts`
