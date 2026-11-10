// Where things sit in a launch film, per format, as offsets from the canvas centre (the coordinates of <Center> and
// <Camera>). Derived from the motion engine's layoutFor(): the same spec lands in the safe area of 16:9, 9:16 and 1:1.
//
// - wide (16:9): the counter in the top-right corner beside the stage; kinetic words in the band under the stage; the
//   payoff's cards in one row across the canvas.
// - tall (9:16): the counter on top, centred; words in the free space under the stage (still inside the safe area);
//   the cards in a 2-column grid.
// - square (1:1): the counter in the top-right corner above the stage; words under it; a 2-column grid.
// Pure: no React, so it is tested on its own.
import { layoutFor, type Layout, type Safe } from '../motion/layout'
import { screenSize } from '../screens/Screen'
import { DW, PAD } from '../screens/parts'
import type { ScreenSpec } from '../reel/spec'

export type Rect = { left: number; top: number; right: number; bottom: number }

export const rectW = (r: Rect) => r.right - r.left
export const rectH = (r: Rect) => r.bottom - r.top
export const rectCx = (r: Rect) => (r.left + r.right) / 2
export const rectCy = (r: Rect) => (r.top + r.bottom) / 2

/** The counter card's height for a number `size` px tall (padding, label row, number): see src/motion/Counter.tsx. */
export const counterHeight = (size: number) => 18 + 14 + size * 0.27 * 1.3 + size * 1.12

/** What a scene's stage makes room for: kinetic words under it, and the counter (its card's width in px; 0 = none). */
export type StageOpts = { words: boolean; hud: number }

export type LaunchLayout = {
  L: Layout
  /** The safe area from the centre. */
  safe: Safe
  /** The counter in its corner: its number size and the card's right / top edges (tall: centred, `right` is its centre x). */
  hud: { size: number; right: number; top: number; centred: boolean }
  /** The counter's number size on the hook's centre stage. */
  heroSize: number
  /** The hook's headline: its largest size and the width a row may take. */
  headline: { size: number; maxW: number }
  /** The kinetic words of a screen or payoff: their size, the width they may take, and their centre y. */
  words: { size: number; maxW: number; cy: number }
  /** The area a screen may fill, given whether the scene has words and how wide the counter in its corner is (0: none). */
  stage: (o: StageOpts) => Rect
  /** The area the payoff's cards fill (wide: the whole width, under the counter). */
  cards: (o: StageOpts) => Rect
  /** The payoff's grid: columns for n cards. */
  cols: (n: number) => number
  /**
   * The logo scene: the mark's size, the name's largest size, the tagline's largest size, the line's size and the CTA's;
   * the width a row may take and the area the stack is laid out in (the safe area shrunk by the scene's push-in and
   * drift, so the pushed-in stack still ends inside the safe area).
   */
  logo: { mark: number; name: number; tagline: number; line: number; cta: number; maxW: number; safe: Safe }
  /** The cursor's size. */
  cursor: number
}

/** How far the logo scene's camera pushes in across the scene (about the canvas centre). */
export const LOGO_PUSH = 1.03
/** How far the logo stack drifts up and down, in px. */
export const LOGO_DRIFT = 4

export function launchLayout(W: number, H: number): LaunchLayout {
  const L = layoutFor(W, H)
  const S = L.fromCenter
  const k = L.t
  const u = Math.min(W, H) / 1080
  const wide = L.kind === 'wide'
  const tall = L.kind === 'tall'
  const hudSize = (wide ? 76 : tall ? 68 : 60) * u
  const hud = { size: hudSize, right: tall ? 0 : S.right, top: S.top, centred: tall }
  const hudBottom = S.top + counterHeight(hudSize)
  const wordsSize = (wide ? 80 : 74) * k
  const words = { size: wordsSize, maxW: S.right - S.left, cy: S.bottom - wordsSize * 0.62 }
  const wordsTop = words.cy - wordsSize * 0.62
  const stage = ({ words: hasWords, hud: hudW }: StageOpts): Rect => {
    const bottom = hasWords ? wordsTop - (wide ? 36 : 40) * u : S.bottom
    if (wide) {
      // beside the counter, not under it (symmetric, so the screen stays centred)
      const half = hudW > 0 ? Math.min(640, S.right - hudW - 40 * u) : 640 * u
      return { left: -half, right: half, top: S.top, bottom }
    }
    return { left: S.left, right: S.right, top: hudW > 0 ? hudBottom + 32 * u : S.top, bottom }
  }
  // the logo stack, laid out before the camera's push-in (about the canvas centre) and its drift (up and down)
  const logoSafe: Safe = { top: S.top / LOGO_PUSH + LOGO_DRIFT, bottom: S.bottom / LOGO_PUSH - LOGO_DRIFT, left: S.left / LOGO_PUSH, right: S.right / LOGO_PUSH }
  const logoW = logoSafe.right - logoSafe.left
  const cards = (o: StageOpts): Rect => (wide ? { left: S.left, right: S.right, top: o.hud > 0 ? hudBottom + 28 * u : S.top, bottom: stage(o).bottom } : stage(o))
  return {
    L,
    safe: S,
    hud,
    heroSize: (wide ? 120 : 112) * u,
    headline: { size: (wide ? 104 : 96) * k, maxW: S.right - S.left },
    words,
    stage,
    cards,
    // wide: one row of tall cards; tall and square: a column of wide row cards (two columns past five)
    cols: (n) => (wide ? Math.min(n, 4) : n > 5 ? 2 : 1),
    logo: wide
      ? { mark: 168 * u, name: 148 * u, tagline: 76 * u, line: 32 * u, cta: 34 * u, maxW: logoW, safe: logoSafe }
      : tall
        ? { mark: 216 * u, name: 196 * u, tagline: 94 * u, line: 38 * u, cta: 44 * u, maxW: logoW, safe: logoSafe }
        : { mark: 184 * u, name: 168 * u, tagline: 84 * u, line: 36 * u, cta: 40 * u, maxW: logoW, safe: logoSafe },
    cursor: (wide ? 46 : 44) * u,
  }
}

/**
 * A screen's box inside a stage: its natural aspect, as large as fits, as near the canvas centre as the stage allows.
 * Width/height in px, centre in canvas-centre coords.
 */
export function screenBox(spec: ScreenSpec, stage: Rect, maxW = Infinity): { w: number; h: number; cx: number; cy: number } {
  const n = screenSize(spec)
  const s = Math.min(Math.min(rectW(stage), maxW) / n.width, rectH(stage) / n.height)
  const w = n.width * s
  const h = n.height * s
  return { w, h, cx: Math.min(stage.right - w / 2, Math.max(stage.left + w / 2, 0)), cy: Math.min(stage.bottom - h / 2, Math.max(stage.top + h / 2, 0)) }
}

/** The logo's first row (mark, gap, name) fitted to `maxW`. `measure(size)` is the name's width at a font size. */
export type LogoRow = { mark: number; gap: number; nameSize: number; width: number }

/**
 * The mark and the name, as large as fits in `maxW` (their largest sizes `mark` and `name`). The gap is a fifth of the
 * mark. A name too long for its largest size shrinks, and the mark with it (down to 40 % of its size), so the row keeps
 * its proportions instead of a full-size mark beside small type. The row never ends past `maxW`.
 */
export function fitLogoRow(measure: (size: number) => number, maxW: number, mark: number, name: number): LogoRow {
  const fit = (m: number) => {
    const room = maxW - m * 1.2
    let size = name
    for (let i = 0; i < 16; i++) {
      const w = measure(size)
      if (w <= room || size <= 1) break
      size = Math.max(1, Math.min(size - 0.5, (size * room) / w))
    }
    return size
  }
  let m = mark
  let size = fit(m)
  // the mark follows the name: no larger than 1.15 × the name's size (down to 40 % of its own size)
  for (let i = 0; i < 8 && size * 1.15 < m - 0.5 && m > mark * 0.4; i++) {
    m = Math.max(mark * 0.4, Math.round(size * 1.15))
    size = fit(m)
  }
  return { mark: m, gap: m * 0.2, nameSize: size, width: m * 1.2 + measure(size) }
}

/** The camera's largest push-in for a click (wide canvases always push this far). */
export const PUSH_MAX = 1.3

/** A camera key's place and scale: scene point (x, y) at the canvas centre, scaled by s. */
export type Push = { x: number; y: number; s: number }

/**
 * Where the camera pushes in for a click on a screen in `box` (centre and size, from the canvas centre), its target at
 * `target`. Wide canvases lean well toward the button at PUSH_MAX, a close-up that may crop the card's far edge.
 * Tall and square canvases take the largest scale (≤ PUSH_MAX) at which the whole card stays on the canvas and its
 * content (inset by the card's padding) inside the safe area, centred toward the target as far as that allows.
 * `extra` is the micro-push the camera adds on top of the key's scale (its worst case), which the fit allows for.
 * `floor` is the lowest the card's bottom edge may reach (the stage's bottom when kinetic words sit under it).
 */
export function screenPush(lay: LaunchLayout, box: { w: number; h: number; cx: number; cy: number }, target: [number, number], extra = 1, floor = Infinity): Push {
  if (lay.L.wide) return { x: target[0] * 0.72, y: target[1] * 0.72, s: PUSH_MAX }
  const S = lay.safe
  const pad = (box.w * PAD) / DW
  // per axis: the card's edges inside the canvas, its content's edges inside the safe area
  type C = { lo: number; hi: number; min: number; max: number }
  const axis = (c: number, size: number, half: number, sLo: number, sHi: number, cHi = half): C[] => [
    { lo: c - size / 2, hi: c + size / 2, min: -half, max: Math.max(c + size / 2, Math.min(half, cHi)) },
    { lo: c - size / 2 + pad, hi: c + size / 2 - pad, min: sLo, max: sHi },
  ]
  const xs = axis(box.cx, box.w, lay.L.W / 2, S.left, S.right)
  const ys = axis(box.cy, box.h, lay.L.H / 2, S.top, S.bottom, floor)
  // at scale s, the camera's centre p keeps (edge − p) · s inside [min, max]: p ≥ hi − max / s and p ≤ lo − min / s
  let s = PUSH_MAX
  for (const cs of [xs, ys])
    for (const a of cs)
      for (const b of cs) {
        const d = a.hi - b.lo
        if (d > 0) s = Math.min(s, (a.max - b.min) / d)
      }
  if (s <= 1) return { x: 0, y: 0, s: 1 }
  const place = (cs: C[], want: number) => {
    const lo = Math.max(...cs.map((c) => c.hi - c.max / s))
    const hi = Math.min(...cs.map((c) => c.lo - c.min / s))
    return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, want))
  }
  return { x: place(xs, target[0] * 0.45), y: place(ys, target[1] * 0.72), s: s / extra }
}
