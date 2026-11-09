// The canvas, by format. Scenes place things from the canvas centre (see Camera.tsx) and keep key text inside `safe`, so
// the same scene renders at 1080×1920, 1920×1080 and 1080×1080.
import { useVideoConfig } from 'remotion'
import { SAFE } from '../reel/theme'

export type Kind = 'wide' | 'tall' | 'square'

/** Edges of the area key text stays inside, in pixels. */
export type Safe = { top: number; bottom: number; left: number; right: number }

export type Layout = {
  W: number
  H: number
  kind: Kind
  wide: boolean
  /** Text scale for headlines: 1 on a 1920×1080 canvas, 0.86 on 1080×1920 and 1080×1080, proportional at other sizes. */
  t: number
  /** The safe area measured from the top-left corner (the same shape as the reel's SAFE). */
  safe: Safe
  /** The same safe area as offsets from the canvas centre (top and left are negative), for <Center> and <Camera>. */
  fromCenter: Safe
}

/** Wide and square canvases: title-safe margins, a share of the canvas on every edge. */
const MARGIN = { wide: 0.05, square: 0.06 } as const

export const layoutFor = (W: number, H: number): Layout => {
  const kind: Kind = W > H ? 'wide' : H > W ? 'tall' : 'square'
  let safe: Safe
  if (kind === 'tall') {
    // the Reels/Shorts UI zones, scaled from the 1080×1920 reference
    const sx = W / 1080
    const sy = H / 1920
    safe = { top: Math.round(SAFE.top * sy), bottom: Math.round(SAFE.bottom * sy), left: Math.round(SAFE.left * sx), right: Math.round(SAFE.right * sx) }
  } else {
    const m = MARGIN[kind]
    safe = { top: Math.round(H * m), bottom: Math.round(H * (1 - m)), left: Math.round(W * m), right: Math.round(W * (1 - m)) }
  }
  const cx = W / 2
  const cy = H / 2
  return {
    W,
    H,
    kind,
    wide: kind === 'wide',
    t: (kind === 'wide' ? 1 : 0.86) * (Math.min(W, H) / 1080),
    safe,
    fromCenter: { top: safe.top - cy, bottom: safe.bottom - cy, left: safe.left - cx, right: safe.right - cx },
  }
}

export const useLayout = (): Layout => {
  const { width, height } = useVideoConfig()
  return layoutFor(width, height)
}
