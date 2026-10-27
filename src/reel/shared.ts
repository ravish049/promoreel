// What every reel of a project shares, folded into a spec before anything reads it: the outro's own voice lines (from
// brand.json), so a spec's `end` scene needs no lines of its own; and the defaults (30 fps, 1080×1920). The video, the
// voice step and the captions step all read specs through resolveSpec, so they agree on every line.
import type { Brand, EndScene, ReelInput, ReelSpec } from './spec'

export const OUTRO_GAP_MS = 900
export const OUTRO_TAIL_MS = 1000

export type Resolved = ReelInput & { fps: number; width: number; height: number }

export function resolveSpec(spec: ReelSpec, brand: Brand): Resolved {
  const outroLines = brand.outro?.lines ?? []
  const hasEnd = spec.scenes.some((s) => s.type === 'end')
  const lines = [...spec.lines]
  if (hasEnd) for (const l of outroLines) if (!lines.some((x) => x.id === l.id)) lines.push(l)
  const scenes = spec.scenes.map((s) => {
    if (s.type !== 'end') return s
    const e = s as EndScene
    return {
      ...e,
      lines: e.lines && e.lines.length > 0 ? e.lines : outroLines.map((l, i) => ({ id: l.id, gapBeforeMs: i === 0 ? 0 : (brand.outro.gapMs ?? OUTRO_GAP_MS) })),
      tailMs: e.tailMs ?? brand.outro.tailMs ?? OUTRO_TAIL_MS,
    }
  })
  return { ...spec, fps: spec.fps ?? 30, width: spec.width ?? 1080, height: spec.height ?? 1920, brand, lines, scenes }
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
