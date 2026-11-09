# STORY-01.8 — Walk examples

## Goal
Two walk examples that show the style works for any brand: CrewDash (the showcase) and a made-up brand (proof that
editing JSON is enough).

## Done When
- `examples/crewdash/reels/walk.json`: "Dispatch to invoice" re-expressed with screen-kit screens (dispatch → GPS
  clock-in → client sheet check → payroll → invoice), the v4 script, Chatterbox v1 voice settings (exaggeration 0.55,
  cfg 0.45, seed 7), cream background, long and short cuts.
- `examples/sample-walk/`: a fictional bookings app (`brand.json` with its own colours and font, `reels/walk.json`
  with 3–4 steps, Kokoro voice so it needs no Python), plus a short `README.md`.
- Rendered outputs committed like the existing examples: `out/*.mp4`, contact sheets, `out/manifest.json`.
- Whisper's read-back matches every line (seeds re-rolled where needed); no clipped brand name.
- Contact sheets pass the review checklist; loudness −16 to −14 LUFS, true peak ≤ −1 dBFS.
- Claims match what CrewDash does (`examples/crewdash/brand.json` features); demo names and numbers are made up.

## Files
- `examples/crewdash/reels/walk.json`, `examples/crewdash/out/walk*`, `examples/crewdash/out/manifest.json`,
  `examples/crewdash/README.md`
- `examples/sample-walk/**`
