// Where every scene, clip and voice line sits in time. Pure: used by Remotion (calculateMetadata) and by the CLI's voice
// step (to lay the listening sample out exactly like the video), so the two can never disagree.
//
// Talking scenes (hook, quiz, terminal, showcase, end) last as long as their lines; the phone scene lasts as long as its
// clips, and its lines are pinned to recorded events. So a re-voiced line re-times the video by itself.
import type { ClipSpec, PhoneScene, ReelSpec, SceneSpec } from './spec'

export type ClipEvent = {
  kind: 'tap' | 'focus' | 'type' | 'scroll' | 'mark'
  label: string
  t: number
  box?: { x: number; y: number; w: number; h: number } | null
  text?: string
}

export type ClipManifest = {
  name: string
  file: string
  cssWidth: number
  cssHeight: number
  pixelWidth: number
  pixelHeight: number
  fps: number
  durationMs: number
  events: ClipEvent[]
}

export type TLClip = {
  spec: ClipSpec
  /** Which of the clip's segments this is (0 when it has none); a later segment follows the one before with a hard cut. */
  segment: number
  manifest: ClipManifest
  src: string
  fromMs: number
  toMs: number
  rate: number
  /** Frames from the start of the phone scene. */
  startFrame: number
  durationFrames: number
}

export type TLScene = {
  spec: SceneSpec
  startFrame: number
  durationFrames: number
  clips: TLClip[]
}

export type TLLine = {
  id: string
  sceneId: string
  /** From the start of the video. */
  startMs: number
  durationMs: number
}

export type Timeline = {
  fps: number
  durationInFrames: number
  transitionFrames: number
  scenes: TLScene[]
  lines: TLLine[]
  warnings: string[]
  /** What the layout changed by itself (clips slowed so their lines fit). */
  notes: string[]
  /** Clip name → the factor its speed was multiplied by. */
  fitted: Record<string, number>
}

/** "tap-label", "tap-label+300", "mark:loaded-200" or a number of ms → source ms. */
export function eventTime(m: ClipManifest, ref: string | number | undefined, fallback: number): number {
  if (ref === undefined) return fallback
  if (typeof ref === 'number') return ref
  const mm = /^(.*?)([+-]\d+)?$/.exec(ref)
  const label = (mm?.[1] ?? ref).replace(/^\w+:/, '')
  const delta = mm?.[2] ? Number(mm[2]) : 0
  const e = m.events.find((ev) => ev.label === label)
  if (!e) throw new Error(`clip ${m.name}: no event "${label}" (has: ${m.events.map((x) => x.label).join(', ')})`)
  return e.t + delta
}

export function findEvent(m: ClipManifest, label: string): ClipEvent {
  const e = m.events.find((ev) => ev.label === label)
  if (!e) throw new Error(`clip ${m.name}: no event "${label}"`)
  return e
}

/**
 * Lays the reel out. Phone lines are pinned to recorded moments, so a line can be longer than the footage under it.
 * Unless a phone scene sets `fitLines: false`, the clip under such a line is slowed (to at most 0.4× its set speed) until
 * the line ends before the next one starts (and before the scene ends). `fitted` reports each clip's resulting factor.
 */
export function buildTimeline(spec: ReelSpec, lineDurationsMs: Record<string, number>, manifests: Record<string, ClipManifest>): Timeline {
  const scale: Record<string, number> = {}
  let tl = layout(spec, lineDurationsMs, manifests, scale)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    for (const sc of tl.scenes) {
      if (sc.spec.type !== 'phone' || (sc.spec as PhoneScene).fitLines === false) continue
      const fps = tl.fps
      const sceneEnd = ((sc.startFrame + sc.durationFrames) / fps) * 1000
      const all = [...tl.lines].sort((a, b) => a.startMs - b.startMs)
      const own = all.filter((l) => l.sceneId === sc.spec.id)
      own.forEach((l) => {
        // the next line anywhere (the next scene's first line starts soon after this scene ends)
        const after = all.find((x) => x.startMs > l.startMs && x.id !== l.id)
        const limit = Math.min(after ? after.startMs - 150 : Infinity, sceneEnd - 200)
        const need = l.startMs + l.durationMs - limit
        if (need <= 15) return
        // the clip on screen when the line starts takes the extra time
        const rel = ((l.startMs - (sc.startFrame / fps) * 1000) / 1000) * fps
        const clip = [...sc.clips].reverse().find((c) => c.startFrame <= rel) ?? sc.clips[0]
        const name = clip.spec.name
        const clipFrames = sc.clips.filter((c) => c.spec.name === name).reduce((n, c) => n + c.durationFrames, 0)
        const clipMs = (clipFrames / fps) * 1000
        const next = Math.max(0.4, (scale[name] ?? 1) * (clipMs / (clipMs + need)))
        if (next < (scale[name] ?? 1) - 0.005) {
          scale[name] = next
          changed = true
        }
      })
    }
    if (!changed) break
    tl = layout(spec, lineDurationsMs, manifests, scale)
  }
  tl.fitted = Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, +v.toFixed(3)]))
  for (const [k, v] of Object.entries(tl.fitted)) tl.notes.push(`clip "${k}" slowed to ${Math.round(v * 100)} % of its set speed so its line fits`)
  return tl
}

function layout(spec: ReelSpec, lineDurationsMs: Record<string, number>, manifests: Record<string, ClipManifest>, rateScale: Record<string, number>): Timeline {
  const fps = spec.fps ?? 30
  const T = spec.transitionFrames ?? 12
  const msToFrames = (ms: number) => Math.round((ms / 1000) * fps)
  const warnings: string[] = []
  const scenes: TLScene[] = []
  const lines: TLLine[] = []
  const dur = (id: string) => {
    const d = lineDurationsMs[id]
    if (d === undefined) throw new Error(`no voice for line "${id}": run: promoreel voice <project>`)
    return d
  }

  let cursorFrame = 0
  spec.scenes.forEach((s, i) => {
    const startFrame = i === 0 ? 0 : cursorFrame - T
    const startMs = (startFrame / fps) * 1000
    if (s.type === 'phone') {
      const ps = s as PhoneScene
      const cut = ps.cutFrames ?? 6
      let f = 0
      const clips: TLClip[] = []
      for (const c of ps.clips) {
        const m = manifests[c.name]
        if (!m) throw new Error(`no recording for clip "${c.name}" in ${ps.clipsDir}`)
        const segs = c.segments ?? [{ from: c.from ?? 0, to: c.to ?? m.durationMs, rate: c.rate }]
        segs.forEach((sg, si) => {
          const fromMs = eventTime(m, sg.from, 0)
          const toMs = Math.min(m.durationMs, eventTime(m, sg.to, m.durationMs))
          if (toMs <= fromMs) throw new Error(`clip ${c.name} segment ${si}: ends before it starts (${fromMs}–${toMs})`)
          const rate = (sg.rate ?? c.rate ?? 1) * (rateScale[c.name] ?? 1)
          const durationFrames = msToFrames((toMs - fromMs) / rate)
          // a new clip crossfades in; a later segment of the same clip is a hard jump cut
          const startFrame = clips.length === 0 ? 0 : si === 0 ? f - cut : f
          clips.push({ spec: c, segment: si, manifest: m, src: `${ps.clipsDir}/${m.file}`, fromMs, toMs, rate, startFrame, durationFrames })
          f = startFrame + durationFrames
        })
      }
      const durationFrames = f
      for (const l of ps.lines) {
        const named = clips.filter((x) => x.spec.name === l.clip)
        if (named.length === 0) throw new Error(`line ${l.id}: no clip ${l.clip}`)
        const want = l.event ? eventTime(named[0].manifest, l.event, named[0].fromMs) : named[0].fromMs
        const c = named.find((x) => want >= x.fromMs && want <= x.toMs) ?? named.find((x) => want < x.fromMs) ?? named[named.length - 1]
        const srcMs = Math.min(Math.max(want, c.fromMs), c.toMs)
        const at = startMs + (c.startFrame / fps) * 1000 + (srcMs - c.fromMs) / c.rate + (l.offsetMs ?? 0)
        lines.push({ id: l.id, sceneId: s.id, startMs: Math.round(at), durationMs: dur(l.id) })
      }
      scenes.push({ spec: s, startFrame, durationFrames, clips })
      cursorFrame = startFrame + durationFrames
    } else {
      let cursor = s.leadMs ?? 250
      ;((s as { lines?: { id: string; gapBeforeMs?: number }[] }).lines ?? []).forEach((l, k) => {
        cursor += k === 0 ? 0 : (l.gapBeforeMs ?? 350)
        lines.push({ id: l.id, sceneId: s.id, startMs: Math.round(startMs + cursor), durationMs: dur(l.id) })
        cursor += dur(l.id)
      })
      cursor += s.tailMs ?? 400
      const durationFrames = msToFrames(cursor)
      scenes.push({ spec: s, startFrame, durationFrames, clips: [] })
      cursorFrame = startFrame + durationFrames
    }
  })

  const sorted = [...lines].sort((a, b) => a.startMs - b.startMs)
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1]
    if (sorted[k].startMs < prev.startMs + prev.durationMs + 120) warnings.push(`line "${sorted[k].id}" starts ${prev.startMs + prev.durationMs + 120 - sorted[k].startMs} ms too early: "${prev.id}" is still talking`)
  }
  for (const l of lines) {
    const sc = scenes.find((x) => x.spec.id === l.sceneId)!
    const endMs = ((sc.startFrame + sc.durationFrames) / fps) * 1000
    if (l.startMs + l.durationMs > endMs + 1) warnings.push(`line "${l.id}" runs ${Math.round(l.startMs + l.durationMs - endMs)} ms past the end of scene "${l.sceneId}"`)
  }
  return { fps, durationInFrames: cursorFrame, transitionFrames: T, scenes, lines, warnings, notes: [], fitted: {} }
}
