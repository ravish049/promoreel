// A user's photo (or tripod clip) of a hand holding a phone, cover-cropped to the canvas, with the drawn app screen
// placed onto that phone's screen from four corner points. The same props render in 9:16, 4:5 and 1:1: the crop keeps
// the phone as central as the photo's edges allow (see perspective.ts).
//
// The children are laid out in a `width × height` box and mapped onto the screen with a matrix3d. On top of them: a
// dark layer that `light` fades out (0 = a screen that is off, 1 = full brightness), a faint diagonal glare on the glass,
// and a soft shadow at the bezel so the edge sits in the photo instead of on it. These are neutral light effects
// (black and white), not brand colours, so the component needs no theme.
import React, { useEffect, useState } from 'react'
import { Video } from '@remotion/media'
import { AbsoluteFill, Img, cancelRender, continueRender, delayRender, staticFile, useVideoConfig } from 'remotion'
import { coverCrop, homography, mapQuad, type Point, type Quad, type Size } from './perspective'

/** Matches `background` in the replace spec (src/reel/spec.ts). Media paths are relative to the project's public/. */
export type PhotoBackground = {
  image?: string
  video?: string
  /** The phone screen's corners in source pixels: TL, TR, BR, BL. */
  screen: Quad
  /** How much the photo is darkened under everything, 0–0.6. Default 0.25. */
  dim?: number
  /** The source's pixel size (the CLI adds it with ffprobe). Without it, the component reads it from the file. */
  size?: Size
}

export type PhotoScreenProps = {
  background: PhotoBackground
  /** The box the children are laid out in, in px (the drawn screen's own size). */
  width: number
  height: number
  /** Screen brightness, 0–1: 0 is a near-black screen that is off, 1 is the screen at full. Default 1. */
  light?: number
  /** Corner radius of the screen, in box px. Default 0 (square corners). */
  radius?: number
  /** The point of the photo to keep central, in source px. Default: the screen's centre. */
  focus?: Point
  children?: React.ReactNode
}

export const DEFAULT_DIM = 0.25
const MAX_DIM = 0.6
/** At light 0 the screen is this dark: off, but still a piece of glass that catches a little light. */
const OFF = 0.94

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The source size: the given one, or read from the file before the frame renders. */
function useSourceSize(src: string, isVideo: boolean, given?: Size): Size | null {
  const [read, setRead] = useState<Size | null>(null)
  const [handle] = useState(() => (given ? null : delayRender(`PhotoScreen: reading the size of ${src}`)))
  useEffect(() => {
    if (handle === null) return
    let done = false
    const finish = (s: Size | null) => {
      if (done) return
      done = true
      if (s && s.width > 0 && s.height > 0) {
        setRead(s)
        continueRender(handle)
      } else cancelRender(new Error(`PhotoScreen: could not read the size of ${src}`))
    }
    if (isVideo) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.muted = true
      v.onloadedmetadata = () => finish({ width: v.videoWidth, height: v.videoHeight })
      v.onerror = () => finish(null)
      v.src = src
    } else {
      const i = new Image()
      i.onload = () => finish({ width: i.naturalWidth, height: i.naturalHeight })
      i.onerror = () => finish(null)
      i.src = src
    }
    return () => {
      done = true
    }
  }, [handle, src, isVideo])
  return given ?? read
}

export const PhotoScreen: React.FC<PhotoScreenProps> = ({ background, width, height, light = 1, radius = 0, focus, children }) => {
  const { width: W, height: H } = useVideoConfig()
  const isVideo = !background.image && !!background.video
  const path = background.image ?? background.video
  if (!path) throw new Error('PhotoScreen: the background needs an image or a video')
  const src = staticFile(path)
  const size = useSourceSize(src, isVideo, background.size)
  if (!size) return null

  const crop = coverCrop(size, { width: W, height: H }, focus ?? background.screen)
  const quad = mapQuad(background.screen, crop)
  const dim = Math.min(MAX_DIM, Math.max(0, background.dim ?? DEFAULT_DIM))
  const dark = (1 - clamp01(light)) * OFF
  const media: React.CSSProperties = { position: 'absolute', left: crop.x, top: crop.y, width: crop.width, height: crop.height }

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      {isVideo ? <Video src={src} muted loop objectFit="fill" style={media} /> : <Img src={src} style={media} />}
      {dim > 0 ? <AbsoluteFill style={{ backgroundColor: `rgba(0, 0, 0, ${dim})` }} /> : null}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transformOrigin: '0 0',
          transform: homography(width, height, quad),
          overflow: 'hidden',
          borderRadius: radius,
          // a hairline of soft dark just outside the edge: the bezel. It hides the 1 px seam where Chrome's hard edge of
          // a 3D-transformed box meets the photo's own antialiased screen edge
          boxShadow: '0 0 1px 0.5px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
        {dark > 0 ? <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(0, 0, 0, ${dark})` }} /> : null}
        {/* a faint diagonal glare on the glass, wide and soft */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(118deg, rgba(255, 255, 255, 0.0) 18%, rgba(255, 255, 255, 0.075) 34%, rgba(255, 255, 255, 0.02) 52%, rgba(255, 255, 255, 0.0) 62%)',
          }}
        />
        {/* the bezel: a thin soft shade just inside the edge, so the screen doesn't look cut out */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: radius, boxShadow: 'inset 0 0 1.5px 0.75px rgba(0, 0, 0, 0.55), inset 0 0 10px rgba(0, 0, 0, 0.18)' }} />
      </div>
    </AbsoluteFill>
  )
}
