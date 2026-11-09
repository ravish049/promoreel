// When everything in a launch film happens, in frames: the scene cuts (snapped onto the beat of music.bpm), and per scene
// the moments its layers and sounds share: the hook's words and counter roll, the screen's actions, cursor stops and
// camera push, the payoff's card landings, checkmarks, count-down and pull-back, the logo's beats. Pure (no React, no
// Remotion), so the Launch composition and the audio job (audio.ts) agree on every frame: a click lands on the cursor's
// press, a tick on each card landing and checkmark.
//
// Frame counts written as F(n) are tuned for 60 fps (the launch default) and scaled to the video's fps.
import type { LaunchHook, LaunchLogo, LaunchPayoff, LaunchScene, LaunchSceneKind, LaunchScreen, LaunchSpec, ScreenAction, ScreenSpec } from '../reel/spec'
import { MOTION_FPS } from '../reel/shared'

export const DEFAULT_LAUNCH_BPM = 120

/** Frames at 60 fps → frames at `fps`. */
export const at60 = (frames: number, fps: number) => Math.max(1, Math.round((frames * fps) / 60))

/** A scene is mounted this long (60 fps frames) before its cut, so its entrance overlaps the last scene's exit. */
export const LEAD = 12
/** Every scene exits (ease-in) over its last EXIT frames (60 fps). */
export const EXIT = 18

export type LaunchTLScene = { id: string; kind: LaunchSceneKind; index: number; from: number; to: number }

export type LaunchTimeline = {
  fps: number
  bpm: number
  /** Frames per beat (may be fractional). */
  beat: number
  scenes: LaunchTLScene[]
  durationInFrames: number
}

/**
 * The scene cuts. Each scene runs its `seconds`; unless `music.beatSync` is false, every cut is moved onto the nearest
 * beat of music.bpm (default 120), and every scene keeps at least one beat.
 */
export function buildLaunchTimeline(spec: Pick<LaunchSpec, 'scenes' | 'music' | 'fps'>, fps = spec.fps ?? MOTION_FPS): LaunchTimeline {
  const bpm = spec.music?.bpm ?? DEFAULT_LAUNCH_BPM
  const beatSec = 60 / bpm
  const snap = spec.music?.beatSync !== false
  let cum = 0
  let prev = 0
  const scenes: LaunchTLScene[] = spec.scenes.map((s, index) => {
    cum += s.seconds
    const cut = snap ? Math.max(prev + beatSec, Math.round(cum / beatSec) * beatSec) : cum
    const from = Math.round(prev * fps)
    const to = Math.round(cut * fps)
    prev = cut
    return { id: s.id, kind: s.kind, index, from, to }
  })
  return { fps, bpm, beat: beatSec * fps, scenes, durationInFrames: scenes.length ? scenes[scenes.length - 1].to : 1 }
}

// ── per-scene plans (frames are local to the scene: 0 = its cut) ────────────────────────────────────────────────────────

export type Progress = Partial<Record<ScreenAction, number>>

export type HookPlan = {
  kind: 'hook'
  scene: LaunchTLScene
  spec: LaunchHook
  /** The frame each word of each headline row starts entering. */
  wordsAt: number[][]
  /** The counter rolls up over these frames (when this hook shows it). */
  countUp?: [number, number]
  out: number
}

export type ScreenPlan = {
  kind: 'screen'
  scene: LaunchTLScene
  spec: LaunchScreen
  progress: Progress
  /** The cursor's schedule, when the screen has something to press. */
  cursor?: { enter: [number, number]; approach: [number, number]; click: number; leave?: [number, number] }
  /** The camera pushes in for the click over `in` and back out over `out`. */
  zoom?: { in: [number, number]; out: [number, number] }
  wordsAt: number[]
  out: number
}

export type PayoffPlan = {
  kind: 'payoff'
  scene: LaunchTLScene
  spec: LaunchPayoff
  /** Each card starts landing / has landed (the tick). */
  land: number[]
  landed: number[]
  /** Each card's checkmark (always after every card has landed). */
  checks: number[]
  /** The counter drops to counterTo over these frames (when the film has a counter). */
  countDown?: [number, number]
  /** The moment everything is clear: the camera pulls back from here. */
  zero: number
  pullBack: [number, number]
  wordsAt: number[]
  out: number
}

export type LogoPlan = {
  kind: 'logo'
  scene: LaunchTLScene
  spec: LaunchLogo
  tile: number
  name: number
  tagline: number
  taglineGap: number
  line: number
  cta: number
}

export type ScenePlan = HookPlan | ScreenPlan | PayoffPlan | LogoPlan

/** The counter's track across the film, in global frames. */
export type CounterTrack = {
  label: string
  value: number
  digits: number
  /** It fades in here (global). */
  show: number
  /** It rolls 0 → value over this span (global), when a hook shows it. */
  rollUp?: [number, number]
  /** It moves from the hook's centre stage to its corner over this span (global), when a hook shows it. */
  toCorner?: [number, number]
  /** Each payoff's drop (global): value → to, the glow turning to success. */
  drops: { span: [number, number]; to: number }[]
  /** It leaves over this span (global), before the logo. */
  hide?: [number, number]
}

export type LaunchPlan = {
  fps: number
  tl: LaunchTimeline
  scenes: ScenePlan[]
  counter?: CounterTrack
  /** Global frames of every cursor click, card landing and checkmark. */
  clicks: number[]
  ticks: number[]
  warnings: string[]
}

/** What a screen has to animate, so defaults are only made for actions it shows. */
const hasRows = (s: ScreenSpec): boolean => (s.kind === 'phone' ? hasRows(s.screen) : s.kind === 'list' || s.kind === 'table' || s.kind === 'form')
const counts = (s: ScreenSpec): boolean => (s.kind === 'phone' ? counts(s.screen) : s.kind === 'stat' || (s.kind === 'form' && !!s.total))
const compares = (s: ScreenSpec): boolean => (s.kind === 'phone' ? compares(s.screen) : s.kind === 'table' && !!s.compare)
/** Whether the screen has a button (or a phone action) the cursor can press. */
export const pressable = (s: ScreenSpec): boolean => (s.kind === 'phone' ? !!s.action || pressable(s.screen) : s.kind !== 'stat' && !!s.button)

const clampF = (f: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, f))

function hookPlan(scene: LaunchTLScene, s: LaunchHook, fps: number, withCounter: boolean): HookPlan {
  const F = (n: number) => at60(n, fps)
  const len = scene.to - scene.from
  const out = len - F(EXIT)
  const countUp: [number, number] | undefined = withCounter ? [F(30), F(30) + fps] : undefined
  // the first row starts as the counter is mid-roll; each row after a short breath
  const start = withCounter ? F(56) : F(14)
  const gap = F(8)
  const rowGap = F(26)
  const total = s.headline.reduce((n, r) => n + r.text.split(/\s+/).filter(Boolean).length, 0)
  const span = start + (total - 1) * gap + (s.headline.length - 1) * rowGap
  // squeeze the cadence when the scene is short, so the last word settles before the exit
  const k = span > out - F(40) ? Math.max(0.3, (out - F(40) - start) / Math.max(1, span - start)) : 1
  let t = start
  const wordsAt = s.headline.map((r, ri) =>
    r.text
      .split(/\s+/)
      .filter(Boolean)
      .map((_, wi) => {
        if (wi > 0) t += gap * k
        else if (ri > 0) t += rowGap * k
        return Math.round(t)
      }),
  )
  return { kind: 'hook', scene, spec: s, wordsAt, countUp, out }
}

function screenPlan(scene: LaunchTLScene, s: LaunchScreen, fps: number, beat: number, warn: (m: string) => void): ScreenPlan {
  const F = (n: number) => at60(n, fps)
  const sec = (x: number) => Math.round(x * fps)
  const len = scene.to - scene.from
  const S = len / fps
  const out = len - F(EXIT)
  const last = out - F(6)
  const p: Progress = {}
  for (const [k, v] of Object.entries(s.at ?? {}) as [ScreenAction, number][]) if (typeof v === 'number') p[k] = clampF(sec(v), 0, last)
  const sc = s.screen
  if (p.fill === undefined && hasRows(sc)) p.fill = F(14)
  if (p.count === undefined && counts(sc)) p.count = (p.fill ?? F(10)) + sec(0.5)
  if (p.checkRows === undefined && compares(sc)) p.checkRows = (p.fill ?? 0) + sec(1.2)
  const canPress = pressable(sc)
  if (canPress && p.click === undefined) p.click = clampF(sec(Math.max(2.4, Math.min(S * 0.5, S - 2.2))), sec(1), last - sec(0.8))
  if (p.done === undefined) p.done = p.click !== undefined ? Math.min(last, p.click + sec(0.6)) : clampF(sec(S * 0.66), 0, last)

  let cursor: ScreenPlan['cursor']
  let zoom: ScreenPlan['zoom']
  if (canPress && p.click !== undefined) {
    const c = p.click
    // offsets before the click (s): enter from off canvas, hesitate near the button, then press it
    const want = { enter: 1.95, enterDur: 1.0, approach: 0.55, approachDur: 0.45 }
    const room = Math.max(0.4, c / fps - 0.25)
    const k = Math.min(1, room / want.enter)
    if (k < 1) warn(`scene "${scene.id}": the click at ${(c / fps).toFixed(2)} s leaves the cursor too little time to travel in; it moves faster`)
    const enter: [number, number] = [c - sec(want.enter * k), sec(want.enterDur * k)]
    const approach: [number, number] = [c - sec(want.approach * k), Math.max(1, sec(want.approachDur * k))]
    const leaveAt = Math.max(c, p.done ?? c) + sec(0.55)
    const leave: [number, number] | undefined = leaveAt + sec(0.8) <= out ? [leaveAt, sec(0.8)] : undefined
    cursor = { enter, approach, click: c, leave }
    const zin: [number, number] = [Math.max(F(20), c - sec(0.95)), Math.max(F(21), c - sec(0.12))]
    const holdTo = Math.max(c + sec(0.6), (p.done ?? c) + sec(0.35))
    const zout: [number, number] = [Math.min(holdTo, out - F(30)), Math.min(holdTo + sec(0.75), out)]
    if (zout[0] > zin[1]) zoom = { in: zin, out: zout }
  }
  // kinetic words: on the beat, spread over the first half of the scene
  const n = s.words?.length ?? 0
  const step = n ? Math.max(1, Math.floor((S * 0.5 * fps) / beat / n)) : 1
  const wordsAt = Array.from({ length: n }, (_, i) => Math.round(beat * (1 + i * step)))
  return { kind: 'screen', scene, spec: s, progress: p, cursor, zoom, wordsAt, out }
}

function payoffPlan(scene: LaunchTLScene, s: LaunchPayoff, fps: number, withCounter: boolean, warn: (m: string) => void): PayoffPlan {
  const F = (n: number) => at60(n, fps)
  const len = scene.to - scene.from
  const out = len - F(EXIT)
  const n = s.cards.length
  // the first card is already falling in as the cut lands
  const land = s.cards.map((_, i) => i * F(12) - F(4))
  const landed = land.map((a) => a + F(20))
  const checksAt = landed[n - 1] + F(22)
  const checks = s.cards.map((_, i) => checksAt + i * F(8))
  const countDown: [number, number] | undefined = withCounter ? [checksAt - F(4), checksAt - F(4) + fps] : undefined
  const zero = countDown ? countDown[1] : checks[n - 1] + F(24)
  const pullBack: [number, number] = [zero + F(4), zero + F(72)]
  const wordsAt = (s.words ?? []).map((_, i) => zero + F(6) + i * F(9))
  if (out - zero < Math.round(1.5 * fps)) warn(`scene "${scene.id}": the clear state holds ${((out - zero) / fps).toFixed(2)} s; give the payoff more seconds for a hold of at least 1.5 s`)
  return { kind: 'payoff', scene, spec: s, land, landed, checks, countDown, zero, pullBack, wordsAt, out }
}

function logoPlan(scene: LaunchTLScene, s: LaunchLogo, fps: number): LogoPlan {
  const F = (n: number) => at60(n, fps)
  const tile = F(10)
  const name = F(38)
  const tagline = F(66)
  const taglineGap = F(7)
  // the line follows the tagline's words; set when the composition knows how many there are (it passes `words`)
  return { kind: 'logo', scene, spec: s, tile, name, tagline, taglineGap, line: tagline + F(40), cta: tagline + F(62) }
}

/** The tagline's beats once its word count is known: the line after its last word, the CTA after the line. */
export const logoBeats = (p: LogoPlan, words: number, fps: number) => {
  const F = (n: number) => at60(n, fps)
  const tagEnd = p.tagline + Math.max(0, words - 1) * p.taglineGap
  const line = tagEnd + F(20)
  return { tagEnd, line, cta: line + F(20) }
}

/** The whole plan of a launch film at `fps` (default spec.fps, else 60). */
export function buildLaunchPlan(spec: LaunchSpec, fps = spec.fps ?? MOTION_FPS): LaunchPlan {
  const tl = buildLaunchTimeline(spec, fps)
  const warnings: string[] = []
  const warn = (m: string) => warnings.push(m)
  const counter = spec.counter
  const showsCounter = (s: LaunchScene) => s.kind === 'hook' && !!counter && s.counter !== false
  const scenes: ScenePlan[] = spec.scenes.map((s, i) => {
    const scene = tl.scenes[i]
    switch (s.kind) {
      case 'hook':
        return hookPlan(scene, s, fps, showsCounter(s))
      case 'screen':
        return screenPlan(scene, s, fps, tl.beat, warn)
      case 'payoff':
        return payoffPlan(scene, s, fps, !!counter, warn)
      case 'logo':
        return logoPlan(scene, s, fps)
    }
  })

  const F = (n: number) => at60(n, fps)
  let track: CounterTrack | undefined
  if (counter) {
    const hook = scenes.find((p): p is HookPlan => p.kind === 'hook' && !!p.countUp)
    const payoffs = scenes.filter((p): p is PayoffPlan => p.kind === 'payoff')
    const firstPayoff = payoffs[0]
    const lastWithCounter = [...scenes].reverse().find((p) => p.kind === 'payoff' || p.kind === 'screen' || p === hook)
    if (hook || firstPayoff) {
      const show = hook ? hook.scene.from + F(16) : firstPayoff.scene.from
      const nextAfterHook = hook ? tl.scenes[hook.scene.index + 1] : undefined
      const hideStart = lastWithCounter ? lastWithCounter.scene.to - F(EXIT) : undefined
      track = {
        label: counter.label,
        value: counter.value,
        digits: String(Math.max(1, Math.round(Math.abs(counter.value)))).length,
        show,
        rollUp: hook?.countUp ? [hook.scene.from + hook.countUp[0], hook.scene.from + hook.countUp[1]] : undefined,
        toCorner: hook && nextAfterHook ? [hook.scene.to - F(20), hook.scene.to + F(22)] : undefined,
        drops: payoffs.filter((p) => p.countDown).map((p) => ({ span: [p.scene.from + p.countDown![0], p.scene.from + p.countDown![1]] as [number, number], to: p.spec.counterTo ?? 0 })),
        // the counter stays through the payoff's hold and leaves with its scene (unless it is the film's last scene)
        hide: hideStart !== undefined && lastWithCounter!.scene.index < tl.scenes.length - 1 ? [hideStart, hideStart + F(EXIT)] : undefined,
      }
    }
  }

  const clicks: number[] = []
  const ticks: number[] = []
  for (const p of scenes) {
    if (p.kind === 'screen' && p.cursor) clicks.push(p.scene.from + p.cursor.click)
    if (p.kind === 'payoff') {
      for (const f of p.landed) ticks.push(p.scene.from + f)
      for (const f of p.checks) ticks.push(p.scene.from + f + F(2))
    }
  }
  return { fps, tl, scenes, counter: track, clicks: clicks.sort((a, b) => a - b), ticks: ticks.sort((a, b) => a - b), warnings }
}

/** Frames (60 fps) the counter takes to step out before a click's push-in and back after it. */
export const HUD_FADE = 18

/**
 * How far the counter has stepped out of the way of a click's push-in at global frame g (0 = in its corner, 1 = gone):
 * it is fully gone before the camera starts to push in and comes back only once the camera is back at rest, so the
 * scaled screen never runs under it.
 */
export const hudAway = (plan: LaunchPlan, g: number, ease: (t: number) => number = (t) => t): number => {
  const d = at60(HUD_FADE, plan.fps)
  let away = 0
  for (const p of plan.scenes) {
    if (p.kind !== 'screen' || !p.zoom) continue
    const f = g - p.scene.from
    const a = p.zoom.in[0] - d
    const b = p.zoom.out[1] + d
    if (f <= a || f >= b) continue
    const outT = Math.min(1, (f - a) / d)
    const backT = Math.min(1, Math.max(0, (f - p.zoom.out[1]) / d))
    away = Math.max(away, ease(Math.min(outT, 1 - backT)))
  }
  return away
}

/** The counter's value at global frame g, and how far its glow has turned to success (0–1). */
export const counterAt = (c: CounterTrack, g: number, ease: (t: number) => number = (t) => t): { value: number; ok: number } => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const prog = (span: [number, number]) => Math.min(1, Math.max(0, (g - span[0]) / Math.max(1, span[1] - span[0])))
  let value = c.rollUp ? lerp(0, c.value, ease(prog(c.rollUp))) : c.value
  let ok = 0
  for (const d of c.drops) {
    if (g < d.span[0]) break
    const t = prog(d.span)
    value = lerp(value, d.to, ease(t))
    ok = t
  }
  return { value, ok }
}
