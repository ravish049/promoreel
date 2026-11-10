# STORY-01.7 — Launch composition

## Goal
The `Launch` composition: a music-only launch film in 16:9, 9:16 and 1:1, rebuilt from the CrewDash launch film as
generic scenes driven by the spec.

## Done When
- `src/launch/Launch.tsx` plays a spec's scenes, each with a length in seconds; four generic scene kinds:
  - `hook`: a kinetic headline (word by word) with an optional counter that rolls up in ~1 s.
  - `screen`: one screen-kit screen with a cursor that travels on arcs, hesitates, and clicks; camera eases in for the
    click and back out.
  - `payoff`: cards land one by one, then a checkmark cascade; the counter drops to zero with its glow turning from
    the accent to the success colour; the camera pulls back.
  - `logo`: the brand logo builds, then the tagline and a CTA pill.
- Every element is placed from the canvas centre via `layoutFor`, so one spec renders correctly in all three formats.
- Scene cuts land on the beat of the spec's `music.bpm`; clicks and ticks (01.2) play on cursor clicks, card landings
  and checkmarks.
- `src/launch/audio.ts` builds the audio job (bed sections at scene cuts, clicks/ticks); `render.ts` runs it before
  rendering a launch film and the master after.
- Fonts gated before frame 0; counter has a soft glow; cards land before their checkmarks.
- `src/Root.tsx` registers `Launch` with width/height from the format.
- A throwaway spec (not committed) renders all three formats; stills at every scene key frame pass the review
  checklist.
- `npm run lint` and `npm test` pass; `examples/generic` renders as before.

## Files
- `src/launch/Launch.tsx`, `scenes/Hook.tsx`, `scenes/Screen.tsx`, `scenes/Payoff.tsx`, `scenes/Logo.tsx`, `audio.ts`, `index.ts`
- `src/Root.tsx`, `cli/commands/render.ts`
