// What the whole video sits on, in three treatments that crossfade with the scenes, so the video feels like one place:
//   opening (hook, quiz, terminal, showcase): light blur, darker at the top where the cards are, a warm push toward the
//                                             accent, and a slow push-in 1.00 → 1.06;
//   phone:                                    darker and more blurred, so the app is the bright thing;
//   outro:                                    very dark (≈80 % ink) under the feature grid.
// With a photo (brand.photo or spec.photo) the treatments are drawn over it. Without one, the backdrop is the brand's ink
// with two soft accent glows that drift, so a project needs no image to look finished.
import React from 'react'
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import type { Timeline } from './timeline'
import { rgba, useTheme } from './theme'

type Look = 'opening' | 'phone' | 'outro'

const LOOKS: Record<Look, { blur: number; overlay: number[]; warm: number; glow: number }> = {
  // ink alpha at 0 %, 38 %, 62 %, 100 % of the height
  opening: { blur: 8, overlay: [0.58, 0.56, 0.48, 0.4], warm: 0.1, glow: 0.34 },
  phone: { blur: 20, overlay: [0.74, 0.72, 0.7, 0.64], warm: 0.06, glow: 0.2 },
  outro: { blur: 16, overlay: [0.8, 0.8, 0.8, 0.8], warm: 0.04, glow: 0.16 },
}

const lookOf = (type: string): Look => (type === 'phone' ? 'phone' : type === 'end' ? 'outro' : 'opening')

const Layer: React.FC<{ src: string | null; look: Look; scale: number; opacity: number; frame: number }> = ({ src, look, scale, opacity, frame }) => {
  const t = useTheme()
  const l = LOOKS[look]
  const [a, b, c, d] = l.overlay
  const overlay = `linear-gradient(180deg, ${rgba(t.ink, a)} 0%, ${rgba(t.ink, b)} 38%, ${rgba(t.ink, c)} 62%, ${rgba(t.ink, d)} 100%)`
  if (!src) {
    // no photo: two slow accent glows on the ink
    const x1 = 22 + 6 * Math.sin(frame / 90)
    const y1 = 18 + 4 * Math.cos(frame / 110)
    const x2 = 80 + 5 * Math.cos(frame / 120)
    const y2 = 84 + 4 * Math.sin(frame / 100)
    return (
      <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, transformOrigin: '50% 42%' }}>
        <AbsoluteFill style={{ background: t.ink }} />
        <AbsoluteFill style={{ background: `radial-gradient(60% 40% at ${x1}% ${y1}%, ${rgba(t.accent, l.glow)} 0%, transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(55% 38% at ${x2}% ${y2}%, ${rgba(t.highlight, l.glow * 0.8)} 0%, transparent 70%)` }} />
        <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 50%, transparent 40%, ${rgba(t.ink, 0.55)} 100%)` }} />
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* drawn 60 px larger on each side, so the blur never shows a soft edge */}
      <Img
        src={src}
        style={{ position: 'absolute', left: -60, top: -60, width: 1080 + 120, height: 1920 + 120, objectFit: 'cover', filter: `blur(${l.blur}px) saturate(1.05)`, transform: `scale(${scale})`, transformOrigin: '50% 42%' }}
      />
      <AbsoluteFill style={{ background: rgba(t.accent, l.warm), mixBlendMode: 'soft-light' }} />
      <AbsoluteFill style={{ background: rgba(t.accent, l.warm * 0.5) }} />
      <AbsoluteFill style={{ background: overlay }} />
    </AbsoluteFill>
  )
}

export const Backdrop: React.FC<{ timeline: Timeline; photo?: string }> = ({ timeline, photo }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const src = photo ? staticFile(photo) : null
  const T = Math.max(1, timeline.transitionFrames)
  const scenes = timeline.scenes
  let i = 0
  for (let k = 0; k < scenes.length; k++) if (scenes[k].startFrame <= frame) i = k
  const cur = lookOf(scenes[i].spec.type)
  const prev = i > 0 ? lookOf(scenes[i - 1].spec.type) : cur
  const p = interpolate(frame, [scenes[i].startFrame, scenes[i].startFrame + T], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // the push-in runs across the opening scenes, then holds and drifts on very slowly
  const openingEnd = (() => {
    const firstOther = scenes.findIndex((s) => lookOf(s.spec.type) !== 'opening')
    const last = firstOther === -1 ? scenes[scenes.length - 1] : scenes[firstOther]
    return firstOther === -1 ? last.startFrame + last.durationFrames : last.startFrame + T
  })()
  const scale = interpolate(frame, [0, Math.max(1, openingEnd), Math.max(2, timeline.durationInFrames)], [1, 1.06, 1.09], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: t.ink, overflow: 'hidden' }}>
      {prev !== cur && p < 1 && <Layer src={src} look={prev} scale={scale} opacity={1} frame={frame} />}
      <Layer src={src} look={cur} scale={scale} opacity={prev !== cur ? p : 1} frame={frame} />
    </AbsoluteFill>
  )
}
