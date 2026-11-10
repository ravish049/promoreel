// The replace ad's cross-out scribble, as pure geometry: a hand-drawn zigzag of 6–10 strokes across a row box, each one
// running between the row's top and bottom edge as it works from left to right, with uneven steps and slants, a little
// overshoot past the ends and a loop or two at the turns. The same box, seed and options always give the same path. No React, so it is unit-tested.
//
// The path is built as a list of points (each stroke sampled along a slightly bowed line with a small wobble, each loop
// as a drifting curl) and smoothed through them with a Catmull-Rom spline written out as cubic Béziers. Every point and
// control point is clamped to `bounds` (the box grown by the overshoot), so the curve never leaves it.

export type Box = { x: number; y: number; w: number; h: number }

export type ScribbleOpts = {
  /** Strokes (top to bottom or back), 6–10 (default: from the box's width over its height, varied by the seed). */
  strokes?: number
  /** Loops at the turns, 0–2 (default: 1 or 2, picked by the seed). */
  loops?: number
  /** How far the scribble may run past the box on every side, in px (default: 14 % of the box height). */
  overshoot?: number
}

/** A stretch of the path, in path-length units: a stroke of the zigzag, or a loop at a turn. */
export type ScribblePhase = { kind: 'stroke' | 'loop'; from: number; to: number }

export type Scribble = {
  /** The SVG path (absolute M and C commands, in the box's coordinates). */
  d: string
  /** Its length in px. */
  length: number
  /** How many strokes the zigzag has. */
  strokes: number
  /** The strokes and loops in drawing order; they cover 0 → length. */
  phases: ScribblePhase[]
  /** The box grown by the overshoot: the path stays inside it. */
  bounds: Box
}

type Pt = [number, number]

export const MIN_STROKES = 6
export const MAX_STROKES = 10

/** mulberry32: a small seeded PRNG, uniform in [0, 1). */
const rngOf = (seed: number) => {
  let s = (Math.floor(seed) ^ 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The length of a cubic Bézier, by chords (fine enough for dash timing). */
const cubicLength = (a: Pt, b: Pt, c: Pt, d: Pt, steps = 20) => {
  let len = 0
  let px = a[0]
  let py = a[1]
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0]
    const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
    len += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  return len
}

const fmt = (v: number) => String(Math.round(v * 10) / 10)

/** A scribble across `box`, the same for the same seed and options. */
export function scribblePath(box: Box, seed = 1, opts: ScribbleOpts = {}): Scribble {
  const rnd = rngOf(seed)
  const range = (a: number, b: number) => a + (b - a) * rnd()
  const { x, y, w, h } = box
  const over = Math.max(0, opts.overshoot ?? h * 0.14)
  const bounds: Box = { x: x - over, y: y - over, w: w + over * 2, h: h + over * 2 }
  const clampPt = (p: Pt): Pt => [clampN(p[0], bounds.x, bounds.x + bounds.w), clampN(p[1], bounds.y, bounds.y + bounds.h)]

  // by default, about one stroke per 0.7 row-heights of width, give or take one
  const auto = Math.round(w / (h * 0.7)) + Math.floor(rnd() * 3) - 1
  const n = clampN(Math.round(opts.strokes ?? auto), MIN_STROKES, MAX_STROKES)
  const loopCount = clampN(Math.round(opts.loops ?? 1 + Math.floor(rnd() * 2)), 0, 2)
  const r = h * 0.17

  // which inner turns curl into a loop (not the first or last turn, and not two in a row)
  const loops = new Set<number>()
  const turns = Array.from({ length: n - 1 }, (_, i) => i + 1)
  while (loops.size < Math.min(loopCount, Math.floor((n - 1) / 2))) {
    const k = turns[Math.floor(rnd() * turns.length)]
    if (!loops.has(k - 1) && !loops.has(k + 1)) loops.add(k)
  }

  // The turn points: P0 starts left of the box and Pn ends right of it; in between, the turns step across the row by
  // uneven amounts and alternate between its top and bottom edge (a little inside or past it), so each stroke slants at
  // its own angle. A turn that curls into a loop sits further in, so the loop has room.
  const x0 = x - over * range(0.45, 1)
  const x1 = x + w + over * range(0.45, 1)
  const steps = Array.from({ length: n }, () => range(0.6, 1.4))
  const sum = steps.reduce((a, b) => a + b, 0)
  const top0 = rnd() < 0.5
  const apex: Pt[] = []
  let acc = 0
  for (let i = 0; i <= n; i++) {
    if (i > 0) acc += steps[i - 1]
    const atTop = (i % 2 === 0) === top0
    const inset = loops.has(i) ? (r * 1.3) / h : 0
    const k = atTop ? range(-0.1, 0.08) + inset : range(0.92, 1.1) - inset
    apex.push([x0 + ((x1 - x0) * acc) / sum, y + h * k])
  }

  // the points the spline runs through, and where each stroke and loop starts in that list
  const pts: Pt[] = [apex[0]]
  const marks: { kind: ScribblePhase['kind']; at: number }[] = []
  const unit = (from: Pt, to: Pt): Pt => {
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
    return [(to[0] - from[0]) / L, (to[1] - from[1]) / L]
  }
  for (let i = 0; i < n; i++) {
    const a = pts[pts.length - 1]
    const b = apex[i + 1]
    marks.push({ kind: 'stroke', at: pts.length - 1 })
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const [ux, uy] = unit(a, b)
    // a wrist arc (bowed to either side) and a small wobble
    const bow = h * range(-0.09, 0.09)
    const samples = 4
    for (let k = 1; k <= samples; k++) {
      const t = k / (samples + 1)
      const off = 4 * t * (1 - t) * bow + h * 0.006 * (rnd() * 2 - 1)
      pts.push([a[0] + dx * t - uy * off, a[1] + dy * t + ux * off])
    }
    const next = apex[i + 2]
    if (loops.has(i + 1) && next) {
      // a curl: one and a half turns around a centre that drifts back along the stroke and forward across the row, so it
      // crosses itself and leaves heading back the way it came
      pts.push(b)
      marks.push({ kind: 'loop', at: pts.length - 1 })
      const e1: Pt = [ux, uy]
      // the side of the stroke facing the next turn
      const fwd = (next[0] - b[0]) * -uy + (next[1] - b[1]) * ux >= 0 ? 1 : -1
      const e2: Pt = [-uy * fwd, ux * fwd]
      const drift = r * range(1.0, 1.4)
      const shift = r * range(0.2, 0.6)
      const curl = 14
      let last: Pt = b
      for (let k = 1; k <= curl; k++) {
        const th = (3 * Math.PI * k) / curl
        const q = k / curl
        const s1 = -drift * q + r * Math.sin(th)
        const s2 = r + shift * q - r * Math.cos(th)
        last = [b[0] + e1[0] * s1 + e2[0] * s2, b[1] + e1[1] * s1 + e2[1] * s2]
        pts.push(last)
      }
    } else {
      // a hairpin: a point just short of the tip on each side keeps it tight and round
      const tip = r * range(0.5, 0.9)
      pts.push([b[0] - ux * tip, b[1] - uy * tip])
      pts.push(b)
      if (next) {
        const [vx, vy] = unit(b, next)
        pts.push([b[0] + vx * tip, b[1] + vy * tip])
      }
    }
  }

  // Catmull-Rom through pts → cubic Béziers
  const P = pts.map(clampPt)
  let d = `M${fmt(P[0][0])} ${fmt(P[0][1])}`
  const at: number[] = [0]
  let length = 0
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[Math.min(P.length - 1, i + 2)]
    const c1 = clampPt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])
    const c2 = clampPt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`
    length += cubicLength(p1, c1, c2, p2)
    at.push(length)
  }

  const phases: ScribblePhase[] = marks.map((m, i) => ({ kind: m.kind, from: at[m.at], to: i + 1 < marks.length ? at[marks[i + 1].at] : length }))
  return { d, length, strokes: n, phases, bounds }
}

/** How long each kind of phase takes, relative to a stroke: loops are quick flicks. */
const WEIGHT: Record<ScribblePhase['kind'], number> = { stroke: 1, loop: 0.55 }

/** Strokes ease in and out (slow into and out of the turns, fast in between). */
const strokeEase = (t: number) => (1 - Math.cos(Math.PI * t)) / 2

/**
 * How much of the path is drawn at `progress` (0–1), in px: each stroke and loop gets its share of the time, and a
 * stroke moves fast in the middle and slows into the turns. 0 at 0, the whole length at 1, never going back.
 */
export function scribbleDrawn(s: Pick<Scribble, 'phases' | 'length'>, progress: number): number {
  const p = clampN(progress, 0, 1)
  if (p >= 1) return s.length
  const total = s.phases.reduce((sum, ph) => sum + WEIGHT[ph.kind], 0)
  let t = p * total
  for (const ph of s.phases) {
    const wgt = WEIGHT[ph.kind]
    if (t <= wgt) {
      const k = t / wgt
      return ph.from + (ph.to - ph.from) * (ph.kind === 'stroke' ? strokeEase(k) : k)
    }
    t -= wgt
  }
  return s.length
}
