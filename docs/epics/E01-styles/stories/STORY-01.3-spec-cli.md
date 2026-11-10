# STORY-01.3 — Spec and CLI: style, formats, optional voice

## Goal
Teach the spec and the CLI about styles, so a reel can be `recorded` (today's default), `walk` or `launch`, can render
in several formats, and can have no voice.

## Done When
- `src/reel/spec.ts`:
  - `style?: 'recorded' | 'walk' | 'launch'` (default `recorded`).
  - `formats?: ('9x16' | '16x9' | '1x1')[]` (default `['9x16']`).
  - `voice` optional when `style` is `launch`.
  - `music?: { bpm?: number; src?: string; gainDb?: number; beatSync?: boolean }`.
  - `WalkSpec` and `LaunchSpec` types: steps / scenes, screens (typed by the screen kit's `ScreenSpec`, declared
    here), anchors, cuts.
- `cli/lib/project.ts` `validateSpec` checks each style's required fields with clear errors. `brand.outro` is required
  only for `recorded`.
- `cli/commands/render.ts`:
  - picks the composition id from the style (`Reel`, `Walk`, `Launch`);
  - renders each format to `out/<id>.mp4` (9:16) or `out/<id>-16x9.mp4` / `out/<id>-1x1.mp4`;
  - exposes `beforeRender` / `afterRender` steps per style (empty for `recorded`), which 01.6 and 01.7 fill with
    their audio job and the master.
- `cli/commands/all.ts` skips `record` for `walk`/`launch` and skips `voice`/`captions` for `launch`.
- `cli/lib/manifest.ts`: `voice` optional; each format is its own entry with `width`/`height`.
- An existing `recorded` spec parses and renders byte-for-byte the same props as before (test on
  `examples/generic/reels/todo-promo.json`).
- Tests: validation errors for a walk without steps and a launch without scenes; format → file name mapping.
- `npm run lint` and `npm test` pass.

## Files
- `src/reel/spec.ts`, `src/reel/shared.ts`
- `cli/lib/project.ts`, `cli/lib/manifest.ts`, `cli/commands/render.ts`, `cli/commands/all.ts`
- `cli/lib/project.test.ts`
