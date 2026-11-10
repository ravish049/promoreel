// When everything on screen happens in one walk cut, in frames: the camera's moves between the steps, when each screen
// enters and leaves, its actions (click, checkRows, fill, count, done) with defaults for the ones the spec leaves out, the
// hook's lit chain, the tracker's exit and the close's beats. Pure (no React, no Remotion), so the Walk composition and
// the audio job (audio.ts) agree on every moment: a whoosh lands on a camera move, a chime on a step's done.
//
// Frame counts below are tuned for 60 fps (the walk's default) and scaled to the video's fps.
import type { IconName } from '../reel/icons'
import type { ScreenAction, ScreenSpec, WalkSpec } from '../reel/spec'
import { checkFrames, countFrames, fillFrames } from '../screens/timing'
import type { WalkTimeline, WalkTLLine, WalkTLScene } from './timeline'

/** Frames at 60 fps → frames at `fps`. */
export const at60 = (frames: number, fps: number) => Math.max(1, Math.round((frames * fps) / 60))

/** The camera leaves a step this long before the next scene starts and lands this long after it (60 fps frames). */
export const MOVE = { before: 22, after: 32 } as const

/** A smooth 0 → 1 (smootherstep), for the hook's light run; pure so the chips' check frames can be found from it. */
export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export type Progress = Partial<Record<ScreenAction, number>>

export type StepPlan = {
  id: string
  /** Its position in the cut (0 = the first step shown). */
  index: number
  label: string
  icon: IconName
  scene: WalkTLScene
  lines: WalkTLLine[]
  screen: ScreenSpec
  /** The frame each screen action starts at (the spec's anchors, plus defaults). */
  progress: Progress
  /** The frame the step completes: its tracker entry turns to success, the card sweeps, a chime plays. */
  done: number
  /** The screen starts entering / starts leaving. */
  enterAt: number
  leaveAt: number
  /** The camera's move into this step (none for the first step). */
  moveIn?: [number, number]
}

export type HookPlan = {
  scene: WalkTLScene
  /** The light runs the chain over these frames; each chip checks as it arrives. */
  run: [number, number]
  checks: number[]
  /** The headline leaves, then the camera dives into the first step. */
  textOut: [number, number]
  dive: [number, number]
}

export type LogoPlan = {
  scene: WalkTLScene
  /** The brand name reveals, the tagline's first word lands, the call to action pops. */
  name: number
  tagline: number
  cta: number
}

export type WalkPlan = {
  fps: number
  durationInFrames: number
  hook?: HookPlan
  steps: StepPlan[]
  logo: LogoPlan
  /** The opening camera move when there is no hook: a slight push onto the first step. */
  open?: [number, number]
  /** The world (path, screens) leaves before the close. */
  worldOut: number
  /** The step pill and the tracker leave before the logo (they are gone by `trackerOut` + 18 frames at 60 fps). */
  trackerOut: number
  /** Scenes whose captions are hidden. */
  hideCaptionsIn: string[]
  /** Steps too short for their screen's actions, or whose done lands before the screen has settled. */
  warnings: string[]
}

/** What a screen has to animate, so defaults are only made for actions it shows. */
const hasRows = (s: ScreenSpec): boolean => (s.kind === 'phone' ? hasRows(s.screen) : s.kind === 'list' || s.kind === 'table' || s.kind === 'form')
const counts = (s: ScreenSpec): boolean => (s.kind === 'phone' ? counts(s.screen) : s.kind === 'stat' || (s.kind === 'form' && !!s.total))
const pressable = (s: ScreenSpec): boolean => (s.kind === 'phone' ? !!s.action || pressable(s.screen) : s.kind !== 'stat' && !!s.button)

/** The number of rows a screen ticks off (checkRows), for the tick sounds. */
export const rowCount = (s: ScreenSpec): number => (s.kind === 'phone' ? rowCount(s.screen) : s.kind === 'list' || s.kind === 'table' ? s.rows.length : 0)

/** Frames between rows that tick off in turn: the screen kit's cascade (src/screens/look.ts `stagger`). */
export const rowStagger = (n: number, fps: number) => Math.max(1, Math.round(Math.min(0.3, 1.8 / Math.max(1, n)) * fps))

/** Default captions-off scenes: the hook and the close carry their own words on screen. */
export const DEFAULT_HIDE_CAPTIONS = ['hook', 'logo']

/**
 * The plan of one cut. `spec.fps` must be the video's fps (the timeline was built at it).
 * Defaults for actions a step leaves out: fill a moment after the screen lands; count after fill; click and done near the
 * end of the step's last line (done 0.55 s after click). Every action stays inside its scene.
 */
export function buildWalkPlan(spec: WalkSpec, tl: WalkTimeline): WalkPlan {
  const fps = tl.fps
  const F = (n: number) => at60(n, fps)
  const sec = (s: number) => Math.round(s * fps)
  const cut = spec.cuts[tl.cut]
  const byId = new Map(spec.steps.map((s) => [s.id, s]))
  const stepScenes = tl.scenes.filter((s) => s.kind === 'step')
  const hookScene = tl.scenes.find((s) => s.kind === 'hook')
  const logoScene = tl.scenes.find((s) => s.kind === 'logo')!
  const worldOut = logoScene.from - F(4)
  const warnings: string[] = []

  const steps: StepPlan[] = stepScenes.map((scene, index) => {
    const step = byId.get(scene.id)!
    const lines = tl.lines.filter((l) => l.sceneId === scene.id)
    const ev = tl.events[scene.id] ?? {}
    const first = index === 0
    const moveIn: [number, number] | undefined = first ? undefined : [scene.from - F(MOVE.before), scene.from + F(MOVE.after)]
    // the first screen arrives during the dive (or is already in at frame 0), so the camera always lands on something
    const enterAt = first ? (hookScene ? hookScene.to - F(18) : -F(14)) : scene.from + F(2)
    const next = stepScenes[index + 1]
    const leaveAt = next ? next.from - F(MOVE.before) : worldOut
    const landed = first ? Math.max(0, scene.from) + F(hookScene ? 30 : 12) : scene.from + F(MOVE.after)
    const lo = landed
    const hi = (next ? next.from - F(MOVE.before) : logoScene.from) - F(12)
    const clamp = (f: number) => Math.max(lo, Math.min(hi, f))
    const speechEnd = lines.length ? lines[lines.length - 1].from + lines[lines.length - 1].durationInFrames : scene.to
    const p: Progress = {}
    for (const k of ['click', 'checkRows', 'fill', 'count', 'done'] as const) if (ev[k] !== undefined) p[k] = Math.max(enterAt, Math.min(hi, ev[k]))
    const sc = step.screen
    if (p.fill === undefined && hasRows(sc)) p.fill = clamp(landed - F(10))
    // a default count starts as the fill finishes (a form's total rolls once its line items are in)
    if (p.count === undefined && counts(sc)) p.count = clamp((p.fill ?? landed) + Math.max(sec(0.5), (p.fill === undefined ? 0 : fillFrames(sc, fps)) - sec(0.6)))
    // the frame the screen has finished moving: rows and fields in, numbers landed, checks ticked
    const settled = Math.max(
      p.fill === undefined ? 0 : p.fill + fillFrames(sc, fps),
      p.count === undefined ? 0 : p.count + countFrames(sc, fps),
      p.checkRows === undefined ? 0 : p.checkRows + checkFrames(sc, fps),
    )
    if (pressable(sc)) {
      // pressed once the screen has settled, early enough that the busy state reads before the done state lands
      if (p.click === undefined) p.click = Math.min(clamp(Math.max(p.done !== undefined ? p.done - sec(0.55) : speechEnd - sec(0.9), settled)), Math.max(lo, hi - sec(0.4)))
      if (p.done === undefined) p.done = clamp(Math.max(p.click + sec(0.55), settled))
    } else if (p.done === undefined) p.done = clamp(Math.max(speechEnd - sec(0.2), settled))
    const s1 = (f: number) => `${(f / fps).toFixed(2)} s`
    if (settled > hi) warnings.push(`step "${scene.id}": its screen is still filling or counting until ${s1(settled)}, but the step leaves at ${s1(hi)}; lengthen it (minMs or tailMs) or anchor fill / count earlier`)
    else if (p.done! < settled) warnings.push(`step "${scene.id}": done lands at ${s1(p.done!)}, before the screen finishes filling or counting (${s1(settled)}); anchor done later or fill / count earlier`)
    return { id: scene.id, index, label: step.label, icon: step.icon, scene, lines, screen: sc, progress: p, done: p.done!, enterAt, leaveAt, moveIn }
  })

  let hook: HookPlan | undefined
  if (hookScene) {
    const run: [number, number] = [hookScene.from + F(6), hookScene.from + F(84)]
    const n = steps.length
    const checks = steps.map((_, i) => {
      const want = n > 1 ? i / (n - 1) : 1
      for (let f = run[0]; f <= run[1]; f++) if (smooth((f - run[0]) / (run[1] - run[0])) >= want - 0.005) return f
      return run[1]
    })
    hook = { scene: hookScene, run, checks, textOut: [hookScene.to - F(40), hookScene.to - F(22)], dive: [hookScene.to - F(24), hookScene.to + F(30)] }
  }

  const lev = tl.events.logo ?? {}
  const logoLines = tl.lines.filter((l) => l.sceneId === 'logo')
  const name = lev.name ?? logoScene.from + F(30)
  const tagline = lev.tagline ?? name + F(36)
  const cta = lev.cta ?? (logoLines.length > 1 ? logoLines[logoLines.length - 1].from : tagline + F(40))
  const logo: LogoPlan = { scene: logoScene, name, tagline, cta }

  return {
    fps,
    durationInFrames: tl.durationInFrames,
    hook,
    steps,
    logo,
    open: hookScene ? undefined : [0, F(40)],
    worldOut,
    trackerOut: logoScene.from - F(24),
    hideCaptionsIn: cut.hideCaptionsIn ?? DEFAULT_HIDE_CAPTIONS,
    warnings,
  }
}

/** Where the camera is along the chain at frame f: k while it rests on step k, k−1 → k during the move into step k. */
export const chainPos = (plan: WalkPlan, f: number): number => {
  let pos = 0
  for (const s of plan.steps) {
    if (!s.moveIn) continue
    if (f < s.moveIn[0]) break
    const t = Math.min(1, (f - s.moveIn[0]) / (s.moveIn[1] - s.moveIn[0]))
    pos = s.index - 1 + smooth(t)
  }
  return pos
}

/** The step on screen at frame f (the one whose scene holds f; the last one after the steps, the first one before). */
export const stepAt = (plan: WalkPlan, f: number): number => {
  let k = 0
  for (const s of plan.steps) if (f >= s.scene.from) k = s.index
  return k
}
