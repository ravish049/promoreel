// One camera per scene: a container whose children live in scene coordinates (origin = canvas centre). Keys are
// interpolated with an easy ease; on top of that the camera can take a slow micro-push, so it never fully stops.
import React from 'react'
import { EASE, tween } from './motion'

export type CamKey = { f: number; x: number; y: number; s: number }
export type Cam = { x: number; y: number; s: number }

/**
 * The camera at frame `f`: eased between the keys (sorted by `f`), held before the first and after the last. `push`
 * grows the scale by that share across the first `len` frames (0.03 = a 3 % push-in).
 */
export const camAt = (keys: readonly CamKey[], f: number, push = 0, len = 1): Cam => {
  if (!keys.length) throw new Error('camAt() needs at least one key')
  let c: Cam = { x: keys[0].x, y: keys[0].y, s: keys[0].s }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]
    const b = keys[i]
    if (f <= a.f) break
    const t = tween(f, a.f, b.f, 0, 1, EASE.inOut)
    c = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t }
  }
  return { ...c, s: c.s * (1 + push * Math.min(1, Math.max(0, f / len))) }
}

/** Places its children so that scene point (cam.x, cam.y) sits at the canvas centre, scaled by cam.s. */
export const Camera: React.FC<{ cam: Cam; children: React.ReactNode }> = ({ cam, children }) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 0,
      height: 0,
      transformOrigin: '0 0',
      transform: `scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
    }}
  >
    {children}
  </div>
)

/** A box whose centre sits at (x, y) in the current coordinate space. */
export const Box: React.FC<{ x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  style,
  children,
}) => <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, ...style }}>{children}</div>

/** Content of unknown size centred on (x, y). */
export const At: React.FC<{ x: number; y: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x, y, style, children }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
    <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap', ...style }}>{children}</div>
  </div>
)

/** The screen-space origin: the canvas centre, with no camera. */
export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, ...style }}>{children}</div>
)
