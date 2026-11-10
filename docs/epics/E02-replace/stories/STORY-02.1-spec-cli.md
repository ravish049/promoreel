# STORY-02.1 — Spec and CLI: `replace` style, 4:5 format, stills, background probe

## Goal
The spec, validation and CLI know the `replace` style: what a replace spec holds, which videos and stills it makes, and
what the composition gets as props. This story writes the types the other E02 stories build against.

## The contract (written into `src/reel/spec.ts`)
```ts
type Style = 'recorded' | 'walk' | 'launch' | 'replace'
type Format = '9x16' | '16x9' | '1x1' | '4x5'            // 4x5 = 1080×1350, replace only
type ToolIconName = 'spreadsheet' | 'chat' | 'phone' | 'email' | 'calendar' | 'calculator' | 'clipboard' | 'notes' | 'folder'
type ToolSpec = { icon?: ToolIconName; image?: string; label?: string; color?: string }   // icon or image (public/ path)
type PitchScreen = {
  kind: 'pitch'
  eyebrow?: string; title: string; body?: string
  buttons: { label: string; style?: 'primary' | 'secondary' }[]   // 1–2
  footnote?: string
}
type ReplaceSpec = SpecBase & {
  style: 'replace'
  formats?: ('9x16' | '4x5' | '1x1')[]                    // default ['9x16']
  seconds?: number                                       // default 12, allowed 8–20
  stillAt?: number                                       // seconds; default the last frame
  headline: string                                       // one or two lines on screen
  tools: ToolSpec[]                                      // 2–8
  scribble?: { color?: string; seed?: number }
  screen: InnerScreen | PitchScreen                      // what the phone shows (list, table, form, stat or pitch)
  background?: {
    image?: string; video?: string                       // exactly one, under public/
    screen: [[number, number], [number, number], [number, number], [number, number]]  // TL, TR, BR, BL in source px
    dim?: number                                         // 0–0.6, darkens the photo; default 0.25
  }
  music?: { bpm?: number; src?: string }
}
```
Resolved props add `fps` (60), `width`, `height`, `format`, `brand`, and `background.size: { width, height }`, which
the CLI reads with ffprobe.

## Done When
- `Style`, `Format`, `ToolIconName`, `ToolSpec`, `PitchScreen` (in the `InnerScreen` union) and `ReplaceSpec` exist as
  above; `FORMAT_SIZE['4x5']` is 1080×1350; `STYLES` includes `replace`; `resolveReplace(spec, brand, format, bgSize?)`.
- `validateSpec` fails with a clear reason on each of these: missing `headline`; fewer than 2 or more than 8 `tools`; a
  tool with neither `icon` nor `image`, or an unknown icon; a missing `screen` or an unknown screen kind; a pitch screen
  with 0 or more than 2 buttons; `seconds` outside 8–20; `stillAt` outside the video; `16x9` in a replace spec (and `4x5`
  in any other style); a background with both or neither of `image`/`video`, a missing file, or `screen` not four points;
  `dim` outside 0–0.6; a missing CTA (`brand.outro.cta`), since the close needs one.
- `outputNames` / `renderJobs`: one job per format, named like launch (`<id>`, `<id>-4x5`, `<id>-1x1`), composition
  `Replace`; `loadProject` still refuses name clashes.
- `render` writes a still per job at `stillAt` (`npx remotion still`), as `out/<name>.png`. The manifest entry gets
  `still`, and `release` uploads the stills with the videos.
- `RENDER_HOOKS.replace` exists with empty hooks; 02.4 fills them.
- Unit tests cover validation, output names, the still path and the 4x5 size. `npm run lint` and `npm test` pass, and
  the `examples/generic` video md5 is unchanged.

## Files
- `src/reel/spec.ts`, `src/reel/shared.ts`
- `cli/lib/project.ts`, `cli/lib/manifest.ts`, `cli/commands/render.ts`, `cli/commands/release.ts`
- `cli/lib/project.test.ts`, `cli/lib/fixtures/*` (new fixtures only)
