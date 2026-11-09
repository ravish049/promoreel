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
  /** The logo scene: the mark's size, the name's largest size, the tagline's largest size, the line's size and the CTA's. */
  logo: { mark: number; name: number; tagline: number; line: number; cta: number; maxW: number }
  /** The cursor's size. */
  cursor: number
}

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
      ? { mark: 168 * u, name: 148 * u, tagline: 76 * u, line: 32 * u, cta: 34 * u, maxW: S.right - S.left }
      : tall
        ? { mark: 216 * u, name: 196 * u, tagline: 94 * u, line: 38 * u, cta: 44 * u, maxW: S.right - S.left }
        : { mark: 184 * u, name: 168 * u, tagline: 84 * u, line: 36 * u, cta: 40 * u, maxW: S.right - S.left },
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
