// The world the camera travels: one node per step of the cut on a zig-zag path, each step's screen drawn at its node.
// World coordinates are pixels at camera scale 1; at rest the camera frames one screen in the safe zone, between the
// step pill (top) and the captions (bottom). In the hook the camera pulls back to show the whole chain as chips that
// check off as a light runs the path; then it dives into the first screen.
//
// Layers, back to front: the paper with a dot grid at a quarter of the camera's speed (parallax) → the path, on a camera
// that trails the screens' by a few frames during moves → the screens and chips, which swing in with a little
// perspective. The path and screens get motion blur on fast moves (Walk.tsx).
import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { Box, Camera, Cursor, EASE, drift, enter, exit, tween, type Cam, type CamKey, type Move } from '../motion'
import { Icon, type IconName } from '../reel/icons'
import { SAFE, luminance, rgba, useTheme, type Theme } from '../reel/theme'
import { CheckDisc, Screen, screenSize, screenTarget, usePalette } from '../screens'
import { PH, PW } from '../screens'
import { lift as liftOf } from '../screens/look'
import { at60, chainPos, smooth, type StepPlan, type WalkPlan } from './plan'
import { fitSize, useWalk, wrapWords } from './context'

/** Neighbouring nodes: far enough apart that only one screen is ever in frame, and the path leaves through the bottom. */
export const NODE = { dx: 560, dy: 1000 }
/** A step's chip in the hook's chain, in world px. */
export const CHIP = { w: 1500, h: 380 }
/**
 * Where a card screen sits on the canvas at rest: below the step pill (it ends at y 335), above the captions (from
 * y ~1148), with room for the camera's 2.5 % push-in before each move.
 */
export const STAGE = { top: 360, bottom: 1126, left: 80, right: 1000 }
/** A phone: as tall as fits in the same band. */
export const PHONE_STAGE = { top: 356, bottom: 1126 }
/** The headline and the strapline of the hook. */
const HOOK_W = SAFE.right - SAFE.left
export const HOOK = { top: SAFE.top + 24, logo: 88, nameMax: 96, headMax: 96, subMax: 56, subTop: SAFE.bottom - 160 }
/** Kinetic type's letter spacing and word gap (as <Words> draws them). */
export const TRACK = -0.025
export const WORD_GAP = 0.26

export type StepBox = { w: number; h: number; cy: number }

export type HookLayout = {
  nameSize: number
  nameRowH: number
  headSize: number
  rows: string[][]
  headTop: number
  subSize: number
  /** The band the chain fills, screen y. */
  band: [number, number]
}

export type World = {
  nodes: { x: number; y: number }[]
  boxes: StepBox[]
  hook?: HookLayout
  /** The camera that shows the whole chain in the hook. */
  chainCam?: (k: number) => CamKey
  keys: CamKey[]
}

/** A screen's box at rest: a phone as tall as its stage, a card scaled to fit its stage, centred. */
export const boxOf = (s: StepPlan['screen']): StepBox => {
  if (s.kind === 'phone') {
    const h = PHONE_STAGE.bottom - PHONE_STAGE.top
    return { w: (h * PW) / PH, h, cy: PHONE_STAGE.top + h / 2 }
  }
  const n = screenSize(s)
  const u = Math.min((STAGE.right - STAGE.left) / n.width, (STAGE.bottom - STAGE.top) / n.height)
  return { w: n.width * u, h: n.height * u, cy: (STAGE.top + STAGE.bottom) / 2 }
}

/** The hook's type, sized to fit: the brand name on one line, the headline in up to three rows. */
export const hookLayout = (t: Theme, headline: string, sub: string | undefined): HookLayout => {
  const nameSize = fitSize(t.brand.name, HOOK_W - HOOK.logo - 24, HOOK.nameMax, 800, t.font, TRACK)
  const words = headline.split(/\s+/).filter(Boolean)
  let headSize = HOOK.headMax
  let rows = wrapWords(words, headSize, HOOK_W, 800, t.font, TRACK, WORD_GAP)
  while (rows.length > 3 && headSize > 56) {
    headSize -= 8
    rows = wrapWords(words, headSize, HOOK_W, 800, t.font, TRACK, WORD_GAP)
  }
  // a single word wider than the line shrinks to fit
  for (const r of rows) for (const w of r) headSize = Math.min(headSize, fitSize(w, HOOK_W, headSize, 800, t.font, TRACK))
  const nameRowH = Math.max(HOOK.logo, nameSize * 1.2)
  const headTop = HOOK.top + nameRowH + 4
  const headBottom = headTop + rows.length * headSize * 1.08
  const subSize = sub ? fitSize(sub, HOOK_W, HOOK.subMax, 800, t.font, -0.02) : 0
  const bandBottom = sub ? HOOK.subTop - 36 : SAFE.bottom - 110
  return { nameSize, nameRowH, headSize, rows, headTop, subSize, band: [headBottom + 44, bandBottom] }
}

export const buildWorld = (t: Theme, plan: WalkPlan, hook: { headline: string; sub?: string } | undefined): World => {
  const F = (n: number) => at60(n, plan.fps)
  const nodes = plan.steps.map((_, i) => ({ x: i % 2 === 0 ? -NODE.dx : NODE.dx, y: i * NODE.dy }))
  const boxes = plan.steps.map((s) => boxOf(s.screen))
  const focus = (i: number, s: number): CamKey => ({ f: 0, x: nodes[i].x, y: nodes[i].y + (960 - boxes[i].cy) / s, s })
  const keys: CamKey[] = []
  const at = (f: number, k: CamKey) => keys.push({ ...k, f })
  let layout: HookLayout | undefined
  let chainCam: World['chainCam']
  if (plan.hook && hook) {
    layout = hookLayout(t, hook.headline, hook.sub)
    const xs = nodes.map((n) => n.x)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const chainW = Math.max(...xs) - Math.min(...xs) + CHIP.w
    const chainH = nodes[nodes.length - 1].y - nodes[0].y + CHIP.h
    const mid = (nodes[0].y + nodes[nodes.length - 1].y) / 2
    const [b0, b1] = layout.band
    const s0 = Math.min((b1 - b0) / chainH, HOOK_W / chainW)
    const y = (b0 + b1) / 2
    chainCam = (k: number) => ({ f: 0, x: cx, y: mid + (960 - y) / (s0 * k), s: s0 * k })
    at(0, chainCam(0.96))
    at(plan.hook.dive[0], chainCam(1.02))
    at(plan.hook.dive[1], focus(0, 1))
  } else {
    const [a, b] = plan.open ?? [0, F(40)]
    at(a, focus(0, 0.94))
    at(b, focus(0, 1))
  }
  for (const s of plan.steps) {
    if (!s.moveIn) continue
    at(s.moveIn[0], focus(s.index - 1, 1.025))
    at(s.moveIn[1], focus(s.index, 1))
  }
  const last = plan.steps.length - 1
  at(plan.worldOut, focus(last, 1.025))
  at(plan.worldOut + F(40), focus(last, 1.06))
  return { nodes, boxes, hook: layout, chainCam, keys }
}

/**
 * The camera at frame f, eased between the keys (sorted by f). Scale changes geometrically and the next key's focus
 * point travels a straight line to the centre of the frame, so a big zoom (the dive) runs straight at its target
 * instead of swinging past it. Between keys of one scale this is the same as a plain eased move.
 */
export const camAtZoom = (keys: readonly CamKey[], f: number): Cam => {
  let c: Cam = { x: keys[0].x, y: keys[0].y, s: keys[0].s }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]
    const b = keys[i]
    if (f <= a.f) break
    const t = tween(f, a.f, b.f, 0, 1, EASE.inOut)
    const s = a.s * (b.s / a.s) ** t
    // where b's focus point sits on screen (offset from the centre): at a's camera, then eased to 0
    const ox = (b.x - a.x) * a.s * (1 - t)
    const oy = (b.y - a.y) * a.s * (1 - t)
    c = { x: b.x - ox / s, y: b.y - oy / s, s }
  }
  return c
}

/** The camera at frame f. */
export const useCam = () => {
  const { world } = useWalk()
  return (f: number): Cam => camAtZoom(world.keys, f)
}

// ── the paper ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The theme's paper, a very soft lift of light, and a faint dot grid at a quarter of the camera's speed. */
export const Backdrop: React.FC<{ g: number; cam: Cam }> = ({ g, cam }) => {
  const t = useTheme()
  const { plan } = useWalk()
  const light = luminance(t.paper) > 0.4
  const step = 56
  const ox = (((-cam.x * cam.s * 0.25) % step) + step) % step
  const oy = (((-cam.y * cam.s * 0.25) % step) + step) % step
  const dot = rgba(light ? t.ink : t.paper, light ? 0.07 : 0.06)
  // the paper lifted toward white: a soft light, in the theme's own tint
  const glow = liftOf(t.paper, 0.85)
  const lift = `radial-gradient(ellipse 70% 45% at 50% 40%, ${rgba(glow, light ? 0.55 : 0.05)} 0%, ${rgba(glow, 0)} 100%)`
  return (
    <AbsoluteFill style={{ backgroundColor: t.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${dot} 2.2px, transparent 2.6px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: `${ox}px ${oy}px` }} />
      <AbsoluteFill style={{ background: lift, transform: `translate(${drift(g, 14, at60(900, plan.fps))}px, ${drift(g, 18, at60(1200, plan.fps), 1)}px)` }} />
    </AbsoluteFill>
  )
}

// ── the path ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const seg = (nodes: World['nodes'], i: number) => {
  const a = nodes[i]
  const b = nodes[i + 1]
  const k = NODE.dy * 0.62
  return { a, b, c1: { x: a.x, y: a.y + k }, c2: { x: b.x, y: b.y - k } }
}

const pointAt = (nodes: World['nodes'], p: number) => {
  const i = Math.min(nodes.length - 2, Math.max(0, Math.floor(p)))
  const t = Math.min(1, Math.max(0, p - i))
  const { a, b, c1, c2 } = seg(nodes, i)
  const u = 1 - t
  return { x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y }
}

/** The accent path: lit whole in the hook, then drawn step by step as the camera travels; the road ahead is dotted. */
export const PathLine: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { plan, world } = useWalk()
  const { nodes } = world
  if (nodes.length < 2) return null
  const F = (n: number) => at60(n, plan.fps)
  const hook = plan.hook
  const inHook = !!hook && g < hook.dive[0] + F(30)
  const run = hook ? smooth((g - hook.run[0]) / (hook.run[1] - hook.run[0])) * (nodes.length - 1) : 0
  const hookFade = hook ? 1 - tween(g, hook.dive[0] + F(8), hook.dive[0] + F(30), 0, 1, EASE.in) : 0
  const first = plan.steps[0]
  const landed = hook ? hook.dive[1] : 0
  const roadAhead = hook ? tween(g, landed - F(6), landed + F(18), 0, 1, EASE.out) : 1
  const pos = chainPos(plan, g)
  const moving = plan.steps.some((s) => s.moveIn && g >= s.moveIn[0] && g <= s.moveIn[1])
  const heads: { x: number; y: number }[] = []
  if (inHook && run > 0 && run < nodes.length - 1) heads.push(pointAt(nodes, run))
  if (moving) heads.push(pointAt(nodes, pos))
  const minX = Math.min(...nodes.map((n) => n.x)) - 900
  const maxX = Math.max(...nodes.map((n) => n.x)) + 900
  const box = { x: minX, y: -900, w: maxX - minX, h: nodes[nodes.length - 1].y + 1800 }
  const wide = inHook ? 22 : 14
  return (
    <svg style={{ position: 'absolute', left: box.x, top: box.y, overflow: 'visible' }} width={box.w} height={box.h} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      {nodes.slice(0, -1).map((_, i) => {
        const { a, b, c1, c2 } = seg(nodes, i)
        const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
        const hookT = Math.min(1, Math.max(0, run - i)) * hookFade
        const stepT = g >= first.enterAt ? Math.min(1, Math.max(0, pos - i)) : 0
        const lit = Math.max(hookT, stepT)
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={t.accent} strokeWidth={9} strokeDasharray="2 24" strokeLinecap="round" opacity={0.45 * (inHook ? 1 : roadAhead)} />
            {lit > 0 ? <path d={d} fill="none" stroke={t.accent} strokeWidth={wide} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - lit} style={{ filter: `drop-shadow(0 0 12px ${rgba(t.accent, 0.4)})` }} /> : null}
          </g>
        )
      })}
      {heads.map((h, i) => (
        <g key={i}>
          <circle cx={h.x} cy={h.y} r={inHook ? 90 : 48} fill={rgba(t.accent, 0.22)} />
          <circle cx={h.x} cy={h.y} r={inHook ? 40 : 22} fill={t.paper} stroke={t.accent} strokeWidth={inHook ? 16 : 9} />
        </g>
      ))}
    </svg>
  )
}

// ── the screens and chips ───────────────────────────────────────────────────────────────────────────────────────────────

/** A step's chip in the hook: its icon, its label and a check that lands as the light reaches it. */
const StepChip: React.FC<{ g: number; label: string; icon: IconName; checkAt: number; pulse: number }> = ({ g, label, icon, checkAt, pulse }) => {
  const t = useTheme()
  const p = usePalette()
  const done = g >= checkAt
  const tone = done ? p.tone('success') : p.tone('accent')
  const titleW = CHIP.w - 160 - 240 - 56 * 2 - 190
  const size = fitSize(label, titleW, 140, 800, t.font, -0.03)
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 90, background: p.card, boxShadow: `${p.shadow}, 0 0 0 ${18 * pulse}px ${rgba(t.accent, 0.4 * pulse)}`, display: 'flex', alignItems: 'center', gap: 56, padding: '0 80px', boxSizing: 'border-box', fontFamily: t.font }}>
      <div style={{ width: 240, height: 240, borderRadius: 68, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={125} color={done ? t.success : t.accent} stroke={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: size, fontWeight: 800, color: p.label, letterSpacing: -size * 0.03, whiteSpace: 'nowrap', lineHeight: 1.2 }}>{label}</div>
      <CheckDisc f={g} at={checkAt} size={190} />
    </div>
  )
}

/** One step: its screen while the camera is on it (with the cursor on a card's button), its chip in the hook. */
const StepNode: React.FC<{ g: number; s: StepPlan }> = ({ g, s }) => {
  const { plan, spec, world } = useWalk()
  const F = (n: number) => at60(n, plan.fps)
  const n = world.nodes[s.index]
  const box = world.boxes[s.index]
  const step = spec.steps.find((x) => x.id === s.id)!
  const cardIn = enter(g, s.enterAt, F(34), plan.fps)
  const cardOut = exit(g, s.leaveAt, F(20))
  const hook = plan.hook
  let chip = 0
  let pulse = 0
  if (hook) {
    chip = g < hook.dive[0] + F(30) ? enter(g, hook.scene.from - F(16) + s.index * F(3), F(30), plan.fps) * (1 - tween(g, hook.dive[0] + F(8), hook.dive[0] + F(30), 0, 1, EASE.in)) : 0
    const run = smooth((g - hook.run[0]) / (hook.run[1] - hook.run[0])) * Math.max(1, plan.steps.length - 1)
    pulse = g >= hook.run[0] && g <= hook.run[1] + F(10) ? Math.max(0, 1 - Math.abs(run - s.index) * 2.2) : 0
  }
  // perspective: the screen swings in a few degrees and settles; it tips the other way as it leaves
  const tiltX = (1 - cardIn) * 7 - cardOut * 4
  const tiltY = -(1 - cardIn) * 9 + cardOut * 6 + drift(g, 0.6, F(260), s.index)
  const target = s.screen.kind === 'phone' ? null : screenTarget(s.screen, box.w, box.h)
  const click = s.progress.click
  const done = s.done
  let cursor: React.ReactNode = null
  if (target && click !== undefined) {
    // the hand comes in from off the right edge just before the press, and leaves after the done state lands
    const off: [number, number] = [540 + box.w / 2 + 60, box.h + 200]
    const start = Math.max(s.enterAt + F(10), click - F(46))
    const end = Math.max(done, click) + F(22)
    const moves: Move[] = [
      { at: 0, dur: 0, to: off },
      { at: start, dur: Math.max(F(16), click - F(8) - start), to: target },
      { at: end, dur: F(36), to: [off[0] + 40, off[1] + 40] },
    ]
    const vis = tween(g, start, start + F(8), 0, 1, EASE.out) * (1 - tween(g, end + F(20), end + F(36), 0, 1, EASE.in))
    if (vis > 0) cursor = <Cursor f={g} moves={moves} clicks={[click]} opacity={vis} size={52} />
  }
  return (
    <>
      {g >= s.enterAt - 2 && cardOut < 1 ? (
        <Box
          x={n.x}
          y={n.y + (1 - cardIn) * 80}
          w={box.w}
          h={box.h}
          style={{ opacity: Math.min(1, cardIn * 1.6) * (1 - cardOut), transform: `perspective(2000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${(0.9 + 0.1 * cardIn) * (1 - 0.3 * cardOut)})` }}
        >
          <Screen spec={s.screen} progress={s.progress} f={g} width={box.w} height={box.h} />
          {cursor}
        </Box>
      ) : null}
      {chip > 0.001 ? (
        <Box x={n.x} y={n.y} w={CHIP.w} h={CHIP.h} style={{ opacity: Math.min(1, chip * 1.6), transform: `scale(${(0.8 + 0.2 * chip) * (1 + 0.06 * pulse)})` }}>
          <StepChip g={g} label={step.label} icon={step.icon} checkAt={hook!.checks[s.index]} pulse={pulse} />
        </Box>
      ) : null}
    </>
  )
}

/** The world: path + screens + chips. Reads its own frame, so the motion blur can draw it at sub-frame times. */
export const WorldLayer: React.FC = () => {
  const g = useCurrentFrame()
  const { plan } = useWalk()
  const cam = useCam()
  const F = (n: number) => at60(n, plan.fps)
  const out = exit(g, plan.worldOut, F(22))
  if (out >= 1) return null
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 - 0.25 * out})`, transformOrigin: `50% ${(((STAGE.top + STAGE.bottom) / 2) / 1920) * 100}%` }}>
      <Camera cam={cam(g - F(4))}>
        <PathLine g={g} />
      </Camera>
      <Camera cam={cam(g)}>
        {plan.steps.map((s) => (
          <StepNode key={s.id} g={g} s={s} />
        ))}
      </Camera>
    </AbsoluteFill>
  )
}

/** Motion blur only where things move fast: camera travel, the dive and the screens' entrances. */
export const useFast = (g: number) => {
  const { plan } = useWalk()
  const cam = useCam()
  const a = cam(g - 1)
  const b = cam(g)
  const k = 60 / plan.fps
  const speed = (Math.hypot((b.x - a.x) * b.s, (b.y - a.y) * b.s) + (Math.abs(b.s - a.s) / b.s) * 1200) * k
  const entering = plan.steps.some((s) => g >= s.enterAt && g < s.enterAt + at60(14, plan.fps))
  return speed > 5 || entering
}
