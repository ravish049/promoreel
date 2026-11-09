// What every reel of a project shares, folded into a spec before anything reads it: the outro's own voice lines (from
// brand.json), so a spec's `end` scene needs no lines of its own; and the defaults (30 fps, 1080×1920). The video, the
// voice step and the captions step all read specs through resolveSpec, so they agree on every line.
// Walk and launch specs go through resolveWalk / resolveLaunch: the same defaults, plus the cut and the format.
import type { Brand, EndScene, Format, LaunchInput, LaunchSpec, ReelInput, ReelSpec, Style, VideoSpec, WalkInput, WalkSpec } from './spec'

export const OUTRO_GAP_MS = 900
export const OUTRO_TAIL_MS = 1000

export type Resolved = ReelInput & { fps: number; width: number; height: number }

export function resolveSpec(spec: ReelSpec, brand: Brand): Resolved {
  const outro = brand.outro
  const outroLines = outro?.lines ?? []
  const hasEnd = spec.scenes.some((s) => s.type === 'end')
  const lines = [...spec.lines]
  if (hasEnd) for (const l of outroLines) if (!lines.some((x) => x.id === l.id)) lines.push(l)
  const scenes = spec.scenes.map((s) => {
    if (s.type !== 'end') return s
    const e = s as EndScene
    return {
      ...e,
      lines: e.lines && e.lines.length > 0 ? e.lines : outroLines.map((l, i) => ({ id: l.id, gapBeforeMs: i === 0 ? 0 : (outro?.gapMs ?? OUTRO_GAP_MS) })),
      tailMs: e.tailMs ?? outro?.tailMs ?? OUTRO_TAIL_MS,
    }
  })
  return { ...spec, fps: spec.fps ?? 30, width: spec.width ?? 1080, height: spec.height ?? 1920, brand, lines, scenes }
}

export const STYLES: Style[] = ['recorded', 'walk', 'launch']

/** Each format's canvas, px. */
export const FORMAT_SIZE: Record<Format, { width: number; height: number }> = {
  '9x16': { width: 1080, height: 1920 },
  '16x9': { width: 1920, height: 1080 },
  '1x1': { width: 1080, height: 1080 },
}

export const styleOf = (spec: VideoSpec): Style => spec.style ?? 'recorded'

/** The formats a spec renders, in its order, without repeats (default 9x16). */
export const formatsOf = (spec: VideoSpec): Format[] => (spec.formats?.length ? [...new Set(spec.formats)] : ['9x16'])

/** A walk spec's cut names, in the order the spec lists them. */
export const cutsOf = (spec: WalkSpec): string[] => Object.keys(spec.cuts ?? {})

/** walk and launch render at 60 fps by default: their motion is tuned for it (`src/motion/`). */
export const MOTION_FPS = 60

export type ResolvedWalk = WalkInput & { fps: number; width: number; height: number }
export type ResolvedLaunch = LaunchInput & { fps: number; width: number; height: number }

/** One cut of a walk spec as the Walk composition's props (default: the first cut, the first format). */
export function resolveWalk(spec: WalkSpec, brand: Brand, cut = cutsOf(spec)[0], format = formatsOf(spec)[0]): ResolvedWalk {
  return { ...spec, fps: spec.fps ?? MOTION_FPS, ...FORMAT_SIZE[format], brand, cut, format }
}

/** A launch spec in one format as the Launch composition's props (default: its first format). */
export function resolveLaunch(spec: LaunchSpec, brand: Brand, format = formatsOf(spec)[0]): ResolvedLaunch {
  return { ...spec, fps: spec.fps ?? MOTION_FPS, ...FORMAT_SIZE[format], brand, format }
}

/** A line's words for the captions: its `text`, else what it says, without the breath marks. */
export const captionText = (l: { say: string; text?: string }) =>
  (l.text ?? l.say)
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** The phrases Kokoro renders one by one (split on `|`). */
export const phrases = (say: string) =>
  say
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)

/** Where a reel's voice files live under public/: vo/<reel id>/<voice>/ (the voice name made safe for a folder). */
export const voiceDir = (id: string, voice: string) => `vo/${id}/${voice.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
