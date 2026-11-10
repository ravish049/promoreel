# STORY-01.9 — Launch examples

## Goal
A launch-film example in all three formats, using the CrewDash brand, so people can see the style and copy the spec.

## Done When
- `examples/crewdash/reels/launch.json`: the 30 s launch storyboard (hook with counter → screen with a click →
  payoff with checkmarks and counter to zero → logo + CTA) expressed with the launch scene kinds and screen-kit screens,
  `formats: ['16x9', '9x16', '1x1']`, music at 120 BPM.
- Rendered `out/launch-16x9.mp4`, `out/launch.mp4` (9:16), `out/launch-1x1.mp4`, their contact sheets, and manifest
  entries.
- Contact sheets pass the review checklist in each format (nothing clipped or off canvas); loudness −16 to −14 LUFS,
  true peak ≤ −1 dBFS.

## Files
- `examples/crewdash/reels/launch.json`, `examples/crewdash/out/launch*`
