// The Walk: one cut of a walk spec + its brand → a voiced 1080×1920 feature walk. Everything comes from the spec, the
// brand and the measured voice: calculateMetadata reads public/vo/<id>/<voice>/lines.json and captions.json and lays
// the cut out (timeline.ts), plan.ts turns that into moments, and the layers below draw them.
//
// Layers, back to front: the paper and its dot grid → the world (path, screens, chips; motion-blurred on fast moves) →
// the hook's type → the step pill and the tracker → the close → the captions. Sound: each voice line, and the music bed
// with its sound effects (public/audio/<video>.wav, written by `promoreel render` from audio.ts).
import React from 'react'
import { Audio } from '@remotion/media'
import type { Caption } from '@remotion/captions'
import { CameraMotionBlur } from '@remotion/motion-blur'
import { AbsoluteFill, type CalculateMetadataFunction, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { EASE, Words, drift, enter, tween, useFontGate } from '../motion'
import { Logo } from '../reel/parts'
import { SAFE, ThemeProvider, useTheme } from '../reel/theme'
import type { WalkInput } from '../reel/spec'
import { MOTION_FPS, voiceDir } from '../reel/shared'
import { buildWalkTimeline, type WalkTimeline } from './timeline'
import { at60, buildWalkPlan } from './plan'
import { walkBedFile } from './audio'
import { WalkContext, useTextReady, useWalk } from './context'
import { Backdrop, HOOK, WORD_GAP, WorldLayer, buildWorld, useCam, useFast } from './World'
import { StepPill, TrackerRow } from './Tracker'
import { WalkCaptions } from './Captions'
import { Close } from './Close'

export type WalkProps = WalkInput & {
  fps?: number
  width?: number
  height?: number
  /** Filled in by calculateMetadata: never written by hand. */
  resolved?: { timeline: WalkTimeline; captions: Record<string, Caption[]>; bed: string | null }
}

const getJson = async <T,>(p: string): Promise<T> => {
  const r = await fetch(staticFile(p))
  if (!r.ok) throw new Error(`could not read public/${p} (${r.status}). Did you run: promoreel voice / captions?`)
  return (await r.json()) as T
}

const exists = async (p: string) => {
  try {
    return (await fetch(staticFile(p), { method: 'HEAD' })).ok
  } catch {
    return false
  }
}

export const calculateWalkMetadata: CalculateMetadataFunction<WalkProps> = async ({ props }) => {
  if (!props.brand) throw new Error('No brand in the props. Render through the CLI (promoreel render <project>), which merges brand.json into the spec.')
  if (props.style !== 'walk' || !props.cuts) throw new Error(`The Walk composition renders walk specs (style "walk"); ${props.id ?? 'this spec'} is not one.`)
  const fps = props.fps ?? MOTION_FPS
  const spec = { ...props, fps }
  const dir = voiceDir(spec.id, spec.voice.use)
  const lines = await getJson<{ lines: Record<string, { durationMs: number }> }>(`${dir}/lines.json`)
  const captions = await getJson<Record<string, Caption[]>>(`${dir}/captions.json`).catch(() => ({}) as Record<string, Caption[]>)
  const durations = Object.fromEntries(Object.entries(lines.lines).map(([k, v]) => [k, v.durationMs]))
  const words = Object.keys(captions).length ? captions : undefined
  const timeline = buildWalkTimeline(spec, spec.cut, durations, words)
  for (const w of timeline.warnings) console.warn(`[${spec.id} ${spec.cut}] ${w}`)
  const bedFile = walkBedFile(spec, spec.cut)
  const bed = (await exists(bedFile)) ? bedFile : null
  if (!bed) console.warn(`[${spec.id} ${spec.cut}] no music bed at public/${bedFile}: rendering the voice only (promoreel render writes it)`)
  return {
    durationInFrames: timeline.durationInFrames,
    fps,
    width: props.width ?? 1080,
    height: props.height ?? 1920,
    props: { ...spec, resolved: { timeline, captions, bed } },
  }
}

export const Walk: React.FC<WalkProps> = (props) => {
  if (!props.resolved || !props.brand) return null
  return (
    <ThemeProvider brand={props.brand}>
      <WalkFrame {...props} resolved={props.resolved} />
    </ThemeProvider>
  )
}

const WalkFrame: React.FC<WalkProps & { resolved: NonNullable<WalkProps['resolved']> }> = (props) => {
  const t = useTheme()
  useFontGate([t.font])
  const textReady = useTextReady(t.font)
  const g = useCurrentFrame()
  const { timeline: tl, captions, bed } = props.resolved
  const spec = React.useMemo(() => ({ ...props, fps: tl.fps }), [props, tl])
  const plan = React.useMemo(() => buildWalkPlan(spec, tl), [spec, tl])
  // measured with the loaded font each frame (cached), so it is never laid out in a fallback font
  if (!textReady) return null
  const world = buildWorld(t, plan, spec.hook)
  const dir = voiceDir(spec.id, spec.voice.use)
  const bedGain = spec.music?.src ? 1 : 10 ** ((spec.music?.gainDb ?? 0) / 20)
  return (
    <WalkContext.Provider value={{ spec, tl, plan, captions, world }}>
      <Layers g={g} />
      {tl.lines.map((l) => (
        <Sequence key={`${l.sceneId}-${l.id}-${l.from}`} from={l.from} durationInFrames={l.durationInFrames + at60(6, tl.fps)} name={`voice ${l.id}`} layout="none">
          <Audio src={staticFile(`${dir}/${l.id}.wav`)} volume={spec.voice.volume ?? 1} />
        </Sequence>
      ))}
      {bed ? <Audio src={staticFile(bed)} volume={bedGain} /> : null}
    </WalkContext.Provider>
  )
}

const Layers: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const cam = useCam()
  const fast = useFast(g)
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: t.paper }}>
      <Backdrop g={g} cam={cam(g)} />
      {fast ? (
        <CameraMotionBlur shutterAngle={150} samples={6}>
          <WorldLayer />
        </CameraMotionBlur>
      ) : (
        <WorldLayer />
      )}
      <HookTitle g={g} />
      <StepPill g={g} />
      <TrackerRow g={g} />
      <Close g={g} />
      <WalkCaptions g={g} />
    </AbsoluteFill>
  )
}

/** The hook's type: the logo and the brand name, the headline word by word, and the strapline in the accent colour. */
const HookTitle: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { plan, spec, world } = useWalk()
  const hook = plan.hook
  const L = world.hook
  if (!hook || !L || !spec.hook) return null
  const F = (n: number) => at60(n, plan.fps)
  const fps = plan.fps
  const [o0, o1] = hook.textOut
  if (g >= o1) return null
  const out = tween(g, o0, o1, 0, 1, EASE.in)
  const from = hook.scene.from
  const mark = enter(g, from - F(12), F(30), fps)
  const nameIn = enter(g, from - F(10), F(30), fps)
  let k = 0
  const wordAt = (i: number) => from - F(4) + i * F(5)
  const strap = enter(g, from + F(30), F(30), fps)
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, transform: `translateY(${-out * 30}px)`, fontFamily: t.font }}>
      <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, top: HOOK.top, height: L.nameRowH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * mark})`, opacity: Math.min(1, mark * 1.5), flexShrink: 0 }}>
          <Logo size={HOOK.logo} />
        </div>
        <div style={{ fontSize: L.nameSize, fontWeight: 800, letterSpacing: -L.nameSize * 0.025, lineHeight: 1.2, color: t.ink, whiteSpace: 'nowrap', flexShrink: 0, opacity: Math.min(1, nameIn * 1.6), transform: `translateY(${(1 - nameIn) * L.nameSize * 0.4}px)` }}>{t.brand.name}</div>
      </div>
      <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, top: L.headTop + drift(g, 3, F(280)), display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {L.rows.map((r, ri) => (
          <Words key={ri} f={g} words={r} at={r.map(() => wordAt(k++))} size={L.headSize} color={t.ink} gap={WORD_GAP} />
        ))}
      </div>
      {spec.hook.sub ? (
        <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, top: HOOK.subTop, display: 'flex', justifyContent: 'center', opacity: Math.min(1, strap * 1.5), transform: `translateY(${(1 - strap) * 20}px)` }}>
          <div style={{ fontSize: L.subSize, fontWeight: 800, color: t.accent, letterSpacing: -L.subSize * 0.02, whiteSpace: 'nowrap', lineHeight: 1.2 }}>{spec.hook.sub}</div>
        </div>
      ) : null}
    </div>
  )
}

