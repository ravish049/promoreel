// Photo placement, pure: the perspective transform that puts a drawn w×h screen onto the phone in a photo, the cover
// crop of that photo per format, and plain-language warnings when the phone won't sit well in a format.
//
// Points are [x, y] in pixels, y down. A quad is the phone screen's corners in the order TL, TR, BR, BL (clockwise on
// screen), as read from an image viewer in the photo's own pixels. `mapQuad` moves them into canvas pixels.
import type { Safe } from '../motion/layout'

export type Point = [number, number]
export type Quad = [Point, Point, Point, Point]
export type Size = { width: number; height: number }
/** A 3×3 projective matrix, row-major, normalised so that m[2][2] = 1. */
export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]]
/** Source pixels to canvas pixels: canvas = source × scale + (x, y). `width` × `height` is the drawn source. */
export type Crop = { scale: number; x: number; y: number; width: number; height: number }

const EPS = 1e-9

/**
 * The projective matrix that maps the rectangle (0,0)-(w,0)-(w,h)-(0,h) onto `quad` (TL, TR, BR, BL), so
 * apply(m, [0,0]) = TL, apply(m, [w,0]) = TR, apply(m, [w,h]) = BR and apply(m, [0,h]) = BL.
 * The unit-square-to-quad solution (Heckbert 1989), then scaled by 1/w and 1/h. Throws on a degenerate quad.
 */
export function homographyMatrix(w: number, h: number, quad: Quad): Mat3 {
  if (!(w > 0) || !(h > 0)) throw new Error(`homography: the box must have a positive size (got ${w}×${h})`)
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  if (Math.abs(den) < EPS) throw new Error('homography: the four corners are degenerate (three of them on one line)')
  // a parallelogram (dx3 = dy3 = 0) gives g = h = 0: an affine map
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const k = (dx1 * dy3 - dx3 * dy1) / den
  const a = x1 - x0 + g * x1
  const b = x3 - x0 + k * x3
  const d = y1 - y0 + g * y1
  const e = y3 - y0 + k * y3
  return [
    [a / w, b / h, x0],
    [d / w, e / h, y0],
    [g / w, k / h, 1],
  ]
}

/** Maps a point through a projective matrix. */
export function apply(m: Mat3, [x, y]: Point): Point {
  const W = m[2][0] * x + m[2][1] * y + m[2][2]
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / W, (m[1][0] * x + m[1][1] * y + m[1][2]) / W]
}

// fixed-point, never exponent notation, enough digits for the tiny perspective terms (~1e-5 per px)
const num = (v: number): string => {
  const s = (Math.abs(v) < 1e-15 ? 0 : v).toFixed(12).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}

/**
 * The CSS `matrix3d(...)` (column-major) for a 3×3 projective matrix. Use it with `transform-origin: 0 0` on a box
 * whose top-left corner sits at the canvas origin.
 */
export function matrix3d(m: Mat3): string {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  // the 2D homography in the x, y and w rows/columns of a 4×4, z left alone
  const cols = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i]
  return `matrix3d(${cols.map(num).join(', ')})`
}

/** The CSS `matrix3d` that maps a `w×h` box (transform-origin 0 0, placed at the origin) onto `quad` (TL, TR, BR, BL). */
export function homography(w: number, h: number, quad: Quad): string {
  return matrix3d(homographyMatrix(w, h, quad))
}

/** The mean of the four corners. */
export function quadCentre(quad: Quad): Point {
  return [(quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4, (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4]
}

const isQuad = (f: Point | Quad): f is Quad => Array.isArray(f[0])

/**
 * The scale and offset that make `src` cover `canvas` (no edge showing), with `focus` (a point in source pixels, or a
 * quad whose centre is used; default: the source centre) as close to the canvas centre as the edges allow.
 */
export function coverCrop(src: Size, canvas: Size, focus?: Point | Quad): Crop {
  if (!(src.width > 0) || !(src.height > 0)) throw new Error(`coverCrop: the source must have a positive size (got ${src.width}×${src.height})`)
  const scale = Math.max(canvas.width / src.width, canvas.height / src.height)
  const width = src.width * scale
  const height = src.height * scale
  const [fx, fy] = focus ? (isQuad(focus) ? quadCentre(focus) : focus) : [src.width / 2, src.height / 2]
  const clamp = (v: number, lo: number) => Math.min(0, Math.max(lo, v))
  return {
    scale,
    x: clamp(canvas.width / 2 - fx * scale, canvas.width - width),
    y: clamp(canvas.height / 2 - fy * scale, canvas.height - height),
    width,
    height,
  }
}

/** A source point in canvas pixels. */
export function mapPoint([x, y]: Point, crop: Crop): Point {
  return [x * crop.scale + crop.x, y * crop.scale + crop.y]
}

/** A source quad (photo pixels) in canvas pixels. */
export function mapQuad(quad: Quad, crop: Crop): Quad {
  return [mapPoint(quad[0], crop), mapPoint(quad[1], crop), mapPoint(quad[2], crop), mapPoint(quad[3], crop)]
}

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** How far, in degrees, the top edge (TL → TR) may turn away from pointing right before the corner order is suspect. */
const MAX_TILT_DEG = 60
/** The smallest screen, as a share of the canvas width. */
export const MIN_SCREEN_SHARE = 0.25

/**
 * Plain-language warnings for a screen quad already in canvas pixels (see `mapQuad`), for one format's canvas and safe
 * area. An empty list means the screen sits well. Checks: the corners are convex and in the order TL, TR, BR, BL; the
 * screen is inside the crop and the safe area; the screen is at least a quarter of the canvas width.
 */
export function photoWarnings(quad: Quad, canvas: Size, safe?: Safe): string[] {
  const out: string[] = []
  const fmt = `${canvas.width}×${canvas.height}`
  const turns = [0, 1, 2, 3].map((i) => cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]))
  if (turns.every((t) => t < 0)) {
    out.push('The screen corners are in the wrong order: they go anticlockwise. List them top-left, top-right, bottom-right, bottom-left.')
  } else if (!turns.every((t) => t > 0)) {
    out.push('The screen corners do not make a convex shape: two corners are swapped or one is misread. List them top-left, top-right, bottom-right, bottom-left.')
  } else {
    const [tl, tr] = quad
    const tilt = (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI
    if (Math.abs(tilt) > MAX_TILT_DEG) {
      out.push('The screen corners seem to start at the wrong corner: the first two should be the top-left and top-right of the screen.')
    }
  }
  const outside = quad.filter(([x, y]) => x < 0 || y < 0 || x > canvas.width || y > canvas.height).length
  if (outside > 0) {
    out.push(`In ${fmt} the phone screen falls partly outside the picture (${outside} of 4 corners are cropped off). Use a photo with more room around the phone, or move the phone toward the middle.`)
  } else if (safe) {
    const unsafe = quad.filter(([x, y]) => x < safe.left || y < safe.top || x > safe.right || y > safe.bottom).length
    if (unsafe > 0) {
      out.push(`In ${fmt} the phone screen reaches outside the safe area (${unsafe} of 4 corners), where a feed's buttons and captions can cover it.`)
    }
  }
  const width = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2
  if (width < MIN_SCREEN_SHARE * canvas.width) {
    out.push(`In ${fmt} the phone screen is small: ${Math.round(width)} px wide, under a quarter of the ${canvas.width} px canvas, so the app will be hard to read. Use a closer photo.`)
  }
  return out
}
