# STORY-01.11 — Bigger phone screens, walk warnings everywhere

## Goal
Fix two gaps found in batch 4 review: the phone screen in walk videos is too small to read (about 375 px wide, row
text about 14 px; the owner asked for "better and bigger screens"), and walk timing warnings print only during render.

## Done When
- In a 1080×1920 walk, a `phone` screen is at least 480 px wide with inner row titles at least 20 px tall. The step
  pill, the phone and the captions still fit inside the safe zone (top 269, bottom 1248), with nothing overlapping.
- `src/screens/Phone.tsx` lays the inner screen out at a narrower logical width so its text renders larger, and the
  empty space above the action button shrinks; the launch film's phone (16:9, 9:16, 1:1) still looks right.
- `npx promoreel voice` and `npx promoreel captions` on a walk print `walkWarnings` as progress warnings.
- The four walk videos (`examples/crewdash` long/short, `examples/sample-walk` long/short) are re-rendered with the
  change; contact sheets reviewed; loudness −16 to −14 LUFS, true peak ≤ −1 dBFS.
- `npm run lint` and `npm test` pass; `examples/generic` video stream unchanged.

## Files
- `src/screens/Phone.tsx`, `src/walk/World.tsx`, `src/walk/plan.ts` (sizing only)
- `cli/commands/voice.ts`, `cli/commands/captions.ts`
- `examples/crewdash/out/walk*`, `examples/crewdash/out/manifest.json`, `examples/sample-walk/out/*`
