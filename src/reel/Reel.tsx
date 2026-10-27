// The Reel: one spec + one brand → a 1080×1920 short. Scenes play in a TransitionSeries; the voice lines, the tap sounds
// and the captions sit on top, on the absolute timeline that timeline.ts worked out.
import React from 'react'
import { Audio } from '@remotion/media'
import type { Caption } from '@remotion/captions'
import { TransitionSeries, springTiming, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { AbsoluteFill, type CalculateMetadataFunction, Sequence, staticFile, useVideoConfig } from 'remotion'
import { Backdrop } from './Backdrop'
import { Captions } from './Captions'
import { Hook, Quiz } from './scenes/talk'
import { FeatureGridOutro } from './scenes/Outro'
import { PhoneSceneView, tapTimes } from './scenes/Phone'
import { TerminalView } from './scenes/Terminal'
import { ShowcaseView } from './scenes/Showcase'
import type { CardStyle, PhoneScene, ReelInput } from './spec'
import { buildTimeline, type ClipManifest, type Timeline } from './timeline'
import { resolveSpec, voiceDir } from './shared'
import { ThemeProvider } from './theme'

export type ReelProps = ReelInput & {
  /** Filled in by calculateMetadata: never written by hand. */
  resolved?: { timeline: Timeline; captions: Record<string, Caption[]> }
}

const getJson = async <T,>(p: string): Promise<T> => {
  const r = await fetch(staticFile(p))
  if (!r.ok) throw new Error(`could not read public/${p} (${r.status}). Did you run: promoreel record / voice / captions?`)
  return (await r.json()) as T
}

export const calculateReelMetadata: CalculateMetadataFunction<ReelProps> = async ({ props: raw }) => {
  if (!raw.brand) throw new Error('No brand in the props. Render through the CLI (promoreel render <project>), which merges brand.json into the spec.')
  const props = resolveSpec(raw, raw.brand)
  const dir = voiceDir(props.id, props.voice.use)
  const lines = await getJson<{ lines: Record<string, { durationMs: number }> }>(`${dir}/lines.json`)
  const captions = await getJson<Record<string, Caption[]>>(`${dir}/captions.json`).catch(() => ({}) as Record<string, Caption[]>)
  const manifests: Record<string, ClipManifest> = {}
  for (const s of props.scenes) {
    if (s.type !== 'phone') continue
    for (const c of (s as PhoneScene).clips) manifests[c.name] = await getJson<ClipManifest>(`${(s as PhoneScene).clipsDir}/${c.name}.json`)
  }
  const durations = Object.fromEntries(Object.entries(lines.lines).map(([k, v]) => [k, v.durationMs]))
  const timeline = buildTimeline(props, durations, manifests)
  for (const w of timeline.warnings) console.warn(`[${props.id}] ${w}`)
  return {
    durationInFrames: timeline.durationInFrames,
    fps: props.fps,
    width: props.width,
    height: props.height,
    props: { ...props, resolved: { timeline, captions } },
  }
}

const cardStyle = (s: string | undefined): CardStyle | undefined => (s === 'glass' ? 'glass' : s ? 'solid' : undefined)

export const Reel: React.FC<ReelProps> = (props) => {
  const { fps } = useVideoConfig()
  if (!props.resolved || !props.brand) return null
  const { timeline, captions } = props.resolved
  const T = timeline.transitionFrames
  const dir = voiceDir(props.id, props.voice.use)
  const taps = timeline.scenes.flatMap((s) => (s.spec.type === 'phone' ? tapTimes(s, fps) : []))
  const cards = cardStyle(props.look?.cards ?? props.brand.look?.cards)
  const tap = props.sfx?.tap === false ? null : (props.sfx?.tap ?? 'sfx/tap.wav')

  return (
    <ThemeProvider brand={props.brand}>
      <AbsoluteFill>
        <Backdrop timeline={timeline} photo={props.photo ?? props.brand.photo} />
        <TransitionSeries>
          {timeline.scenes.flatMap((sc, i) => {
            const lines = timeline.lines.filter((l) => l.sceneId === sc.spec.id)
            const type = sc.spec.type
            const body =
              type === 'hook' ? (
                <Hook scene={sc as never} lines={lines} captions={captions} cards={cards} />
              ) : type === 'quiz' ? (
                <Quiz scene={sc as never} lines={lines} captions={captions} cards={cards} />
              ) : type === 'phone' ? (
                <PhoneSceneView scene={sc as never} />
              ) : type === 'terminal' ? (
                <TerminalView scene={sc as never} lines={lines} />
              ) : type === 'showcase' ? (
                <ShowcaseView scene={sc as never} />
              ) : (
                <FeatureGridOutro scene={sc as never} />
              )
            const seq = (
              <TransitionSeries.Sequence key={sc.spec.id} durationInFrames={sc.durationFrames} name={sc.spec.id}>
                {body}
              </TransitionSeries.Sequence>
            )
            if (i === 0) return [seq]
            // the hook slides away to the next scene; everything else crossfades
            const tr =
              timeline.scenes[i - 1].spec.type === 'hook' ? (
                <TransitionSeries.Transition key={`t-${sc.spec.id}`} presentation={slide({ direction: 'from-right' })} timing={springTiming({ config: { damping: 200 }, durationInFrames: T })} />
              ) : (
                <TransitionSeries.Transition key={`t-${sc.spec.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
              )
            return [tr, seq]
          })}
        </TransitionSeries>

        {timeline.lines.map((l) => (
          <Sequence key={l.id} from={Math.round((l.startMs / 1000) * fps)} durationInFrames={Math.ceil((l.durationMs / 1000) * fps) + 2} name={`voice ${l.id}`} layout="none">
            <Audio src={staticFile(`${dir}/${l.id}.wav`)} volume={props.voice.volume ?? 1} />
          </Sequence>
        ))}
        {tap &&
          taps.map((t, i) => (
            <Sequence key={`tap-${i}`} from={Math.round((t / 1000) * fps)} durationInFrames={6} name="tap" layout="none">
              <Audio src={staticFile(tap)} volume={props.sfx?.tapVolume ?? 0.3} />
            </Sequence>
          ))}

        <Captions timeline={timeline} captions={captions} hideIn={props.captions?.hideIn ?? []} />
      </AbsoluteFill>
    </ThemeProvider>
  )
}
