# STORY-01.13 — Launch framing on tall and square

## Goal
Fix three framing issues seen in the CrewDash launch film (STORY-01.9 review), so the launch style meets STORY-01.7's
"nothing clipped or off canvas" in every format.

## Done When
- During the screen push-in, the card stays fully inside the canvas (and its text inside the safe area) in 9:16 and 1:1;
  the push scale adapts to the card's size instead of a fixed 1.3×. 16:9 keeps its current look.
- The 9:16 logo wordmark ends inside the safe area (x ≤ 1015) through the whole push-in; the mark + name scale down to
  fit when a brand name is long.
- At a hook → screen cut, the fading headline never overlaps the incoming screen.
- `examples/crewdash` launch re-rendered in all three formats; contact sheets reviewed; loudness −16 to −14 LUFS,
  true peak ≤ −1 dBFS.
- `npm run lint` and `npm test` pass.

## Files
- `src/launch/plan.ts`, `src/launch/layout.ts`, `src/launch/scenes/{Hook,Screen,Logo}.tsx`, tests
- `examples/crewdash/out/launch*`, `examples/crewdash/out/manifest.json`
