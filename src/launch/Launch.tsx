// The Launch: a launch spec + its brand → a music-only launch film in one format (16:9, 9:16 or 1:1). Everything comes
// from the spec and the brand: plan.ts lays the scenes out on the beat and times every moment, layout.ts places things
// from the canvas centre for the format, and the scenes below draw them.
//
// Layers, back to front: the backdrop (the brand's photo, blurred under the ink, or soft light on the ink) → the scenes
// (hook, screen, payoff, logo; each mounted a few frames before its cut so its entrance overlaps the last one's exit) →
// the counter, which rolls up on the hook's centre stage, moves to its corner and drops to zero in the payoff. Sound: the
// music bed (public/audio/<video>.wav) and a click / tick on every cursor click, card landing and checkmark
// (public/sfx/launch/*.wav), both written by `promoreel render`.
import React from 'react'
import { Audio } from '@remotion/media'
import { AbsoluteFill, type CalculateMetadataFunction, Img, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { Counter, EASE, drift, enter, tween, useFontGate } from '../motion'
import { ThemeProvider, rgba, useTheme } from '../reel/theme'
import type { LaunchInput } from '../reel/spec'
import { FORMAT_SIZE, MOTION_FPS } from '../reel/shared'
import { useTextReady } from '../walk/context'
import { LAUNCH_SFX, launchBedFile } from './audio'
import { LaunchContext, counterCardW, counterValue, hookGeometry, useLaunch, type HookGeometry } from './context'
import { counterHeight, launchLayout } from './layout'
import { LEAD, at60, buildLaunchPlan, zoomAt, type ScenePlan } from './plan'
import { HookScene } from './scenes/Hook'
import { ScreenScene } from './scenes/Screen'
import { PayoffScene } from './scenes/Payoff'
import { LogoScene } from './scenes/Logo'

export type LaunchProps = LaunchInput & {
  fps?: number
  width?: number
  height?: number
  /** Filled in by calculateMetadata: never written by hand. */
  resolved?: { bed: string | null; sfx: boolean }
}

const exists = async (p: string) => {
  try {
    return (await fetch(staticFile(p), { method: 'HEAD' })).ok
  } catch {
    return false
  }
}

export const calculateLaunchMetadata: CalculateMetadataFunction<LaunchProps> = async ({ props }) => {
  if (!props.brand) throw new Error('No brand in the props. Render through the CLI (promoreel render <project>), which merges brand.json into the spec.')
  if (props.style !== 'launch' || !props.scenes) throw new Error(`The Launch composition renders launch specs (style "launch"); ${props.id ?? 'this spec'} is not one.`)
  const fps = props.fps ?? MOTION_FPS
  const format = props.format ?? '16x9'
  const size = FORMAT_SIZE[format]
  const plan = buildLaunchPlan({ ...props, fps }, fps)
  for (const w of plan.warnings) console.warn(`[${props.id} ${format}] ${w}`)
  const bedFile = launchBedFile(props.id, format)
  const bed = (await exists(bedFile)) ? bedFile : null
  if (!bed) console.warn(`[${props.id} ${format}] no music bed at public/${bedFile}: rendering without music (promoreel render writes it)`)
  const sfx = await exists(LAUNCH_SFX.click)
  return { durationInFrames: plan.tl.durationInFrames, fps, width: size.width, height: size.height, props: { ...props, fps, format, ...size, resolved: { bed, sfx } } }
}

export const Launch: React.FC<LaunchProps> = (props) => {
  if (!props.resolved || !props.brand) return null
  return (
    <ThemeProvider brand={props.brand}>
      <LaunchFrame {...props} resolved={props.resolved} />
    </ThemeProvider>
  )
}

const LaunchFrame: React.FC<LaunchProps & { resolved: NonNullable<LaunchProps['resolved']> }> = (props) => {
  const t = useTheme()
  useFontGate([t.font])
  const textReady = useTextReady(t.font)
  const g = useCurrentFrame()
  const fps = props.fps ?? MOTION_FPS
  const { width, height } = FORMAT_SIZE[props.format ?? '16x9']
  const spec = React.useMemo(() => ({ ...props, fps }), [props, fps])
  const plan = React.useMemo(() => buildLaunchPlan(spec, fps), [spec, fps])
  const lay = React.useMemo(() => launchLayout(width, height), [width, height])
  // measured with the loaded font, so the type is never laid out in a fallback font
  const hooks = React.useMemo(() => {
    if (!textReady) return null
    const out: Record<string, HookGeometry> = {}
    for (const p of plan.scenes) if (p.kind === 'hook') out[p.scene.id] = hookGeometry(t, lay, p.spec, p.wordsAt, !!p.countUp)
    return out
  }, [textReady, plan, lay, t])
  if (!hooks) return null
  const F = (n: number) => at60(n, fps)
  const { bed, sfx } = props.resolved
  const bedGain = spec.music?.src ? 1 : 10 ** ((spec.music?.gainDb ?? 0) / 20)
  return (
    <LaunchContext.Provider value={{ spec, plan, lay, hooks }}>
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: t.ink }}>
        <Backdrop g={g} />
        {plan.scenes.map((p) => (g >= p.scene.from - F(LEAD) && g < p.scene.to ? <SceneView key={p.scene.id} p={p} f={g - p.scene.from} /> : null))}
        <HudCounter g={g} />
      </AbsoluteFill>
      {bed ? <Audio src={staticFile(bed)} volume={bedGain} /> : null}
      {sfx
        ? plan.clicks.map((at, i) => (
            <Sequence key={`c${i}`} from={at} durationInFrames={F(30)} name="click" layout="none">
              <Audio src={staticFile(LAUNCH_SFX.click)} volume={0.55} />
            </Sequence>
          ))
        : null}
      {sfx
        ? plan.ticks.map((at, i) => (
            <Sequence key={`t${i}`} from={at} durationInFrames={F(30)} name="tick" layout="none">
              <Audio src={staticFile(LAUNCH_SFX.tick)} volume={0.32} />
            </Sequence>
          ))
        : null}
    </LaunchContext.Provider>
  )
}

const SceneView: React.FC<{ p: ScenePlan; f: number }> = ({ p, f }) => {
  switch (p.kind) {
    case 'hook':
      return <HookScene p={p} f={f} />
    case 'screen':
      return <ScreenScene p={p} f={f} />
    case 'payoff':
      return <PayoffScene p={p} f={f} />
    case 'logo':
      return <LogoScene p={p} f={f} />
  }
}

/** The ink, with the brand's photo blurred under it when there is one, and two soft lights drifting slowly. */
const Backdrop: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { lay } = useLaunch()
  const { W, H } = lay.L
  const photo = t.brand.photo
  const big = Math.max(W, H)
  return (
    <AbsoluteFill style={{ backgroundColor: t.ink, overflow: 'hidden' }}>
      {photo ? (
        <>
          <Img
            src={staticFile(photo)}
            style={{
              position: 'absolute',
              left: -W * 0.08 + drift(g, 12, 900),
              top: -H * 0.08 + drift(g, 8, 1100, 1),
              width: W * 1.16,
              height: H * 1.16,
              objectFit: 'cover',
              filter: 'blur(18px) saturate(0.9)',
            }}
          />
          <AbsoluteFill style={{ backgroundColor: rgba(t.ink, 0.74) }} />
        </>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: W * 0.5 - big * 0.55 + drift(g, W * 0.04, 1300),
          top: H * 0.42 - big * 0.4 + drift(g, H * 0.03, 1700, 2),
          width: big * 1.1,
          height: big * 0.8,
          background: `radial-gradient(closest-side, ${rgba(t.accent, 0.13)}, ${rgba(t.accent, 0)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: W * 0.15 - big * 0.35 + drift(g, W * 0.05, 1500, 1),
          top: H * 0.85 - big * 0.3 + drift(g, H * 0.04, 1900),
          width: big * 0.7,
          height: big * 0.6,
          background: `radial-gradient(closest-side, ${rgba(t.highlight, 0.08)}, ${rgba(t.highlight, 0)})`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, ${rgba('#000000', 0)} 55%, ${rgba('#000000', 0.42)} 100%)` }} />
    </AbsoluteFill>
  )
}

/** The counter: on the hook's centre stage while it rolls up, then in its corner until the payoff has dropped it. */
const HudCounter: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { plan, lay, hooks } = useLaunch()
  const c = plan.counter
  if (!c || g < c.show || (c.hide && g >= c.hide[1])) return null
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const size = lay.heroSize
  const w = counterCardW(t, lay, c)
  const h = counterHeight(size)
  const k = lay.hud.size / size
  // the corner: right-aligned in the safe area (wide, square) or centred on top (tall)
  const hudCx = lay.hud.centred ? lay.hud.right : lay.hud.right - (w * k) / 2
  const hudCy = lay.hud.top + (h * k) / 2
  const hookPlan = plan.scenes.find((p) => p.kind === 'hook' && p.countUp)
  const heroCy = hookPlan ? hooks[hookPlan.scene.id]?.heroCy : null
  const move = c.toCorner ? tween(g, c.toCorner[0], c.toCorner[1], 0, 1, EASE.inOut) : 1
  const atHero = heroCy !== null && heroCy !== undefined && c.rollUp
  const cx = atHero ? hudCx * move : hudCx
  const cy = atHero ? heroCy + (hudCy - heroCy) * move : hudCy
  const s = atHero ? 1 + (k - 1) * move : k
  const inn = enter(g, c.show, F(30), fps)
  const out = c.hide ? tween(g, c.hide[0], c.hide[1], 0, 1, EASE.in) : 0
  const { value, ok } = counterValue(c, g)
  // on a tall or square canvas the camera's push-in for a click runs under the counter: it steps back meanwhile
  const zoom = lay.L.wide ? 0 : zoomAt(plan, g, EASE.inOut)
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: cx - w / 2,
          top: cy - h / 2 + (1 - inn) * 24 - out * 16,
          width: w,
          transformOrigin: '50% 50%',
          transform: `scale(${s * (0.94 + 0.06 * inn)})`,
          opacity: Math.min(1, inn * 1.5) * (1 - out) * (1 - zoom),
        }}
      >
        <Counter value={value} digits={c.digits} label={c.label} ok={ok} size={size} width={w} />
      </div>
    </div>
  )
}
