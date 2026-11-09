// Easing constants and the motion primitives the walk and launch styles share. Nothing moves linearly; every value is a
// pure function of the frame, so any frame renders on its own.
import { Easing, interpolate, spring } from 'remotion'

export const EASE = {
  /** The "easy ease" for camera moves and travel. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  /** cubic-bezier(0.34, 1.56, 0.64, 1): entrances with a slight overshoot. */
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Counters: a gentle ease-out so the count visibly runs the whole way instead of front-loading it. */
  count: Easing.bezier(0.5, 1, 0.89, 1),
}

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** from → to between frames a and b, eased (easy ease by default), held outside. */
export const tween = (f: number, a: number, b: number, from: number, to: number, ease: (t: number) => number = EASE.inOut) =>
  interpolate(f, [a, b], [from, to], { ...CLAMP, easing: ease })

/** 0 → 1 entrance with a slight overshoot (spring, damping 14), settled at 1 after `dur` frames. 0 before `at`. */
export const enter = (f: number, at: number, dur = 30, fps = 30) =>
  f < at ? 0 : spring({ frame: f - at, fps, config: { damping: 14, stiffness: 120, mass: 1 }, durationInFrames: dur })

/** 0 → 1 exit, ease-in, 60 % of an entrance by default. */
export const exit = (f: number, at: number, dur = 18) => tween(f, at, at + dur, 0, 1, EASE.in)

/** The click press: scale 1 → 0.96 → 1 over `dur` frames (the low point at 3/8 of it). */
export const press = (f: number, at: number, dur = 8) =>
  interpolate(f - at, [0, dur * 0.375, dur], [1, 0.96, 1], { ...CLAMP, easing: EASE.inOut })

/** Nothing fully stops: a slow sine drift of ±amp over `period` frames. */
export const drift = (f: number, amp = 4, period = 300, phase = 0) => Math.sin((f / period) * Math.PI * 2 + phase) * amp

/** A point on a quadratic bezier from a to b whose control point sits `bend` of the distance off the straight line. */
export const arc = (a: [number, number], b: [number, number], t: number, bend = 0.15): [number, number] => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  // perpendicular, always bowing upward-ish so moves read like a wrist turning
  const cx = mx + dy * bend * (dx >= 0 ? 1 : -1)
  const cy = my - Math.abs(dx) * bend - Math.abs(dy) * bend * 0.3
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]
}

/** Travel along a path: eases in and out and settles with a tiny overshoot past the target. */
export const TRAVEL = Easing.bezier(0.55, 0, 0.25, 1.06)
