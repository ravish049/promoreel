# STORY-01.5 — Walk timeline (pure)

## Goal
A pure function that turns a walk spec plus measured voice into frames, ported from
`~/crewdash-videos/src/insta/c/timeline.ts` but for any number of steps and any named events.

## Done When
- `src/walk/timeline.ts` exports `buildWalkTimeline(spec, cut, lineDurationsMs, words)` returning scenes (hook, one per
  step, logo) with start/end frames, line start frames, the resolved event frames per step, the steps this cut
  contains, and warnings.
- Scene length = lead + lines (with gaps) + tail, never below a minimum; optional beat sync nudges each cut to the
  nearest beat (−0.6 s / +0.3 s) but never within 0.2 s of the last spoken word.
- Anchors are `{ line, word (text or index, negative from the end), offsetMs }` or `{ scene, offsetMs }`, declared per
  step in the spec (no hardcoded event names). An anchor whose word isn't found is a warning naming the line and word.
- Cuts: a spec has `cuts: { long, short, … }`, each listing its lines and steps; the short cut's tracker lists only its
  own steps.
- No React, no Remotion imports (same rule as `src/reel/timeline.ts`).
- Tests: 3-step and 6-step specs; beat sync bounds; word anchors with repeated words; a short cut dropping steps.
- `npm run lint` and `npm test` pass.

## Files
- `src/walk/timeline.ts`, `src/walk/timeline.test.ts`
