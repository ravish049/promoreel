// Where every scene, voice line and on-screen moment of one walk cut sits, in frames. Pure (no React, no Remotion), so
// the Walk composition (calculateMetadata) and the CLI read the same layout.
//
// A cut is hook? → its steps, in order → logo. Each scene lasts lead + its lines (with gaps) + tail, never less than its
// minimum; with music.beatSync each cut between scenes moves onto the nearest beat, but never into a spoken word. Every
// named anchor of a step (and of the logo) resolves to a frame from the measured voice: a word of a line, a line's start,
// or a scene's start. So a re-voiced line re-times the video by itself.
import type { Anchor, WalkSceneTiming, WalkSpec, WalkStep } from '../reel/spec'

/** Default pacing, ms (the spec's `pace` and each scene's own lead / tail / min override these). */
export const WALK_PACE = { leadMs: 350, gapMs: 800, tailMs: 400, minMs: 2400, endHoldMs: 1000 } as const

/** The beat grid used for beat sync when the spec sets no music.bpm (the synthesised bed's default tempo). */
export const DEFAULT_WALK_BPM = 112

/** Beat sync moves a cut at most this much earlier / later, and keeps it this far after the last spoken word, ms. */
export const BEAT_WINDOW = { earlierMs: 600, laterMs: 300, afterSpeechMs: 200 } as const

/**
 * Word timings per line, as `captions` writes them to public/vo/<reel>/<voice>/captions.json: line id → its words, each
 * with `startMs` from the start of the line (the leading space on a word's text is ignored).
 */
export type WalkWords = Record<string, readonly { text: string; startMs: number; endMs?: number }[]>

export type WalkSceneKind = 'hook' | 'step' | 'logo'

export type WalkTLScene = {
  /** "hook", the step id, or "logo". */
  id: string
  kind: WalkSceneKind
  /** First frame of the scene, from the start of the video. */
  from: number
  /** The frame the next scene starts on (the logo runs to the end of the video, its end hold included). */
  to: number
}

export type WalkTLLine = {
  id: string
  sceneId: string
  /** From the start of the video. */
  from: number
  durationInFrames: number
}

export type WalkTrackerStep = Pick<WalkStep, 'id' | 'label' | 'icon'>

export type WalkTimeline = {
  cut: string
  fps: number
  durationInFrames: number
  scenes: WalkTLScene[]
  lines: WalkTLLine[]
  /** Scene id → anchor name → frame. Every scene of the cut has an entry (empty when it has no anchors). */
  events: Record<string, Record<string, number>>
  /** The steps this cut shows, in its order: the tracker lists only these. */
  trackerSteps: WalkTrackerStep[]
  warnings: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Lays one cut of a walk out.
 * @param lineDurationsMs line id → its length, ms (public/vo/<reel>/<voice>/lines.json → `lines[id].durationMs`).
 *   Every line the cut speaks must have one, or this throws.
 * @param words captions.json as it is on disk. Leave it out before `captions` has run: word anchors then fall on their
 *   line's start without a warning. When given, an anchor whose line has no timings or whose word is not found is a
 *   warning (and falls on the line's start).
 */
export function buildWalkTimeline(spec: WalkSpec, cutId: string, lineDurationsMs: Record<string, number>, words?: WalkWords): WalkTimeline {
  const cut = spec.cuts?.[cutId]
  if (!cut) throw new Error(`walk ${spec.id}: no cut "${cutId}" (has: ${Object.keys(spec.cuts ?? {}).join(', ')})`)
  const fps = spec.fps ?? 30
  const fr = (ms: number) => Math.round((ms / 1000) * fps)
  const pace = { ...WALK_PACE, ...stripUndefined(spec.pace ?? {}) }
  const warnings: string[] = []
  const steps = new Map(spec.steps.map((s) => [s.id, s]))

  // the cut's scenes, in order
  type Plan = { id: string; kind: WalkSceneKind; timing: WalkSceneTiming; anchors: Record<string, Anchor> }
  const plan: Plan[] = []
  if (cut.hook) plan.push({ id: 'hook', kind: 'hook', timing: cut.hook, anchors: {} })
  for (const cs of cut.steps) {
    const step = steps.get(cs.step)
    if (!step) throw new Error(`walk ${spec.id}, cut "${cutId}": no step "${cs.step}" (has: ${spec.steps.map((s) => s.id).join(', ')})`)
    plan.push({ id: step.id, kind: 'step', timing: cs, anchors: { ...step.anchors, ...cs.anchors } })
  }
  plan.push({ id: 'logo', kind: 'logo', timing: cut.logo, anchors: { ...cut.logo.anchors } })

  const dur = (id: string) => {
    const d = lineDurationsMs[id]
    if (d === undefined) throw new Error(`no voice for line "${id}" (cut "${cutId}"): run: promoreel voice <project>`)
    return d
  }

  // the beat grid, when the cuts snap to it
  let beat = 0
  if (spec.music?.beatSync) {
    const bpm = spec.music.bpm ?? (spec.music.src ? undefined : DEFAULT_WALK_BPM)
    if (bpm && bpm > 0) beat = (60 / bpm) * fps
    else warnings.push('music.beatSync is on, but your own track (music.src) has no music.bpm: the cuts are not beat-synced')
  }

  const scenes: WalkTLScene[] = []
  const lines: WalkTLLine[] = []
  let t = 0
  let speechEnd = 0
  plan.forEach((sc, idx) => {
    let start = t
    if (beat > 0 && idx > 0) {
      // the nearest beat from 0.6 s earlier to 0.3 s later that stays ≥ 0.2 s after the last word (and after the
      // previous scene's start)
      const prev = scenes[idx - 1]
      const lo = Math.max(speechEnd + fr(BEAT_WINDOW.afterSpeechMs), t - fr(BEAT_WINDOW.earlierMs), prev.from + 1)
      const hi = t + fr(BEAT_WINDOW.laterMs)
      let best: number | undefined
      for (let n = Math.floor(lo / beat); n <= Math.ceil(hi / beat); n++) {
        const b = Math.round(n * beat)
        if (b < lo || b > hi) continue
        if (best === undefined || Math.abs(b - t) < Math.abs(best - t)) best = b
      }
      if (best !== undefined) {
        start = best
        prev.to = start
      }
    }
    let at = start + fr(sc.timing.leadMs ?? pace.leadMs)
    sc.timing.lines.forEach((id, i) => {
      if (i > 0) at += fr(pace.gapMs)
      const len = fr(dur(id))
      lines.push({ id, sceneId: sc.id, from: at, durationInFrames: len })
      at += len
    })
    if (sc.timing.lines.length > 0) speechEnd = at
    const end = Math.max(at + fr(sc.timing.tailMs ?? pace.tailMs), start + fr(sc.timing.minMs ?? pace.minMs))
    scenes.push({ id: sc.id, kind: sc.kind, from: start, to: end })
    t = end
  })
  const durationInFrames = t + fr(pace.endHoldMs)
  scenes[scenes.length - 1].to = durationInFrames

  // anchors → frames
  const lineAt = new Map<string, WalkTLLine>()
  for (const l of lines) {
    if (lineAt.has(l.id)) warnings.push(`line "${l.id}" is spoken twice in cut "${cutId}": anchors use its first time`)
    else lineAt.set(l.id, l)
  }
  const sceneAt = new Map(scenes.map((s) => [s.id, s]))
  const events: Record<string, Record<string, number>> = {}
  for (const sc of plan) {
    const own = sceneAt.get(sc.id)!
    const out: Record<string, number> = {}
    for (const [name, a] of Object.entries(sc.anchors)) {
      const where = `cut "${cutId}", scene "${sc.id}", anchor "${name}"`
      out[name] = Math.max(0, resolve(a, own, where) + fr(a.offsetMs ?? 0))
    }
    events[sc.id] = out
  }

  function resolve(a: Anchor, own: WalkTLScene, where: string): number {
    if ('scene' in a) {
      const s = sceneAt.get(a.scene)
      if (s) return s.from
      warnings.push(`${where}: scene "${a.scene}" is not in this cut; using the start of "${own.id}"`)
      return own.from
    }
    const lineId = a.line ?? plan.find((p) => p.id === own.id)!.timing.lines[0]
    const line = lineId === undefined ? undefined : lineAt.get(lineId)
    if (!line) {
      if (lineId !== undefined || a.word !== undefined) warnings.push(`${where}: line "${lineId ?? '(none)'}" is not spoken in this cut; using the start of "${own.id}"`)
      return own.from
    }
    if (a.word === undefined || words === undefined) return line.from
    const ws = words[line.id]
    if (!ws || ws.length === 0) {
      warnings.push(`${where}: line "${line.id}" has no word timings (run: promoreel captions <project>); using the line's start for word "${a.word}"`)
      return line.from
    }
    let k: number
    if (typeof a.word === 'number') {
      k = a.word < 0 ? ws.length + a.word : a.word
      if (!Number.isInteger(a.word) || k < 0 || k >= ws.length) {
        const clamped = Math.max(0, Math.min(ws.length - 1, Math.trunc(k)))
        warnings.push(`${where}: line "${line.id}" has ${ws.length} words, so word ${a.word} is out of range; using word ${clamped}`)
        k = clamped
      }
    } else {
      const want = norm(a.word)
      k = ws.findIndex((w) => norm(w.text) === want)
      if (k < 0) {
        warnings.push(`${where}: line "${line.id}" has no word "${a.word}"; using the line's start`)
        return line.from
      }
    }
    return line.from + fr(ws[k].startMs)
  }

  const trackerSteps = cut.steps.map((cs) => {
    const s = steps.get(cs.step)!
    return { id: s.id, label: s.label, icon: s.icon }
  })

  return { cut: cutId, fps, durationInFrames, scenes, lines, events, trackerSteps, warnings }
}

/** Every cut's warnings, each prefixed with its cut ("long: …"), for the CLI to print after `voice` or `captions`. */
export function walkWarnings(spec: WalkSpec, lineDurationsMs: Record<string, number>, words?: WalkWords): string[] {
  return Object.keys(spec.cuts ?? {}).flatMap((cut) => buildWalkTimeline(spec, cut, lineDurationsMs, words).warnings.map((w) => `${cut}: ${w}`))
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
