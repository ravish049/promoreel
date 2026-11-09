// What every layer of the Launch composition reads: the spec, its plan, the format's layout and the hook's measured
// type (the counter's centre stage depends on it). Text is measured with the walk's helpers (src/walk/context.ts), in
// the loaded font, so headlines are sized to fit instead of clipped.
import { createContext, useContext } from 'react'
import { EASE, tween } from '../motion'
import type { Theme } from '../reel/theme'
import type { LaunchHook, LaunchInput } from '../reel/spec'
import { fitSize, textWidth, wrapWords } from '../walk/context'
import { counterHeight, type LaunchLayout, type Rect } from './layout'
import { EXIT, at60, counterAt, type CounterTrack, type LaunchPlan, type LaunchTLScene } from './plan'

/** Kinetic type's letter spacing and word gap, as <Words> draws them. */
export const TRACK = -0.025
export const WORD_GAP = 0.26

export type LaunchCtx = {
  spec: LaunchInput & { fps: number }
  plan: LaunchPlan
  lay: LaunchLayout
  /** The hook's type and the counter's place on its centre stage, per hook scene id. */
  hooks: Record<string, HookGeometry>
}

export const LaunchContext = createContext<LaunchCtx | null>(null)

export const useLaunch = (): LaunchCtx => {
  const c = useContext(LaunchContext)
  if (!c) throw new Error('useLaunch() outside the Launch composition')
  return c
}

/** A row of kinetic words as drawn: its words, whether it is in the accent colour, and the frame each word enters. */
export type Row = { words: string[]; accent: boolean; at: number[] }

export type HookGeometry = {
  rows: Row[]
  size: number
  /** The headline block's top and the counter card's centre (y from the canvas centre). */
  headTop: number
  heroCy: number | null
}

/** The width <Words> takes for these words at `size`. */
export const wordsWidth = (words: readonly string[], size: number, font: string) =>
  words.reduce((w, x) => w + textWidth(x, size, 800, font, TRACK), 0) + Math.max(0, words.length - 1) * WORD_GAP * size

/** Rows of words fitted to `maxW`: one shared size (down to `min` × max), rows that still don't fit wrap. */
export function fitRows(rows: Row[], maxW: number, max: number, font: string, min = 0.55): { rows: Row[]; size: number } {
  let size = max
  for (const r of rows) {
    const w = wordsWidth(r.words, max, font)
    if (w > maxW) size = Math.min(size, Math.max(max * min, Math.floor((max * maxW) / w)))
  }
  const out: Row[] = []
  for (const r of rows) {
    if (wordsWidth(r.words, size, font) <= maxW) {
      out.push(r)
      continue
    }
    let k = 0
    for (const part of wrapWords(r.words, size, maxW, 800, font, TRACK, WORD_GAP)) {
      out.push({ words: part, accent: r.accent, at: r.at.slice(k, k + part.length) })
      k += part.length
    }
  }
  // a single word wider than the line shrinks to fit
  for (const r of out) for (const w of r.words) size = Math.min(size, fitSize(w, maxW, size, 800, font, TRACK))
  return { rows: out, size }
}

/** The line height <Words> rows are stacked at. */
export const ROW_H = 1.12

/** The hook's type, fitted, and the counter's place above it; the whole stack centred in the safe area. */
export function hookGeometry(t: Theme, lay: LaunchLayout, spec: LaunchHook, wordsAt: number[][], counter: boolean): HookGeometry {
  const src: Row[] = spec.headline.map((h, i) => ({ words: h.text.split(/\s+/).filter(Boolean), accent: !!h.accent, at: wordsAt[i] ?? [] }))
  // a long row wraps rather than shrinking the whole headline far
  const { rows, size } = fitRows(src, lay.headline.maxW, lay.headline.size, t.font, 0.78)
  const rowsH = rows.length * size * ROW_H
  const heroH = counter ? counterHeight(lay.heroSize) : 0
  const gap = counter ? Math.max(size * 0.55, 48) : 0
  const top = centredTop(lay, heroH + gap + rowsH)
  return { rows, size, headTop: top + heroH + gap, heroCy: counter ? top + heroH / 2 : null }
}

/**
 * The top of a block `h` tall, centred on the canvas when it fits in the safe area there, else as close to the centre
 * as the safe area allows (y from the canvas centre).
 */
export const centredTop = (lay: LaunchLayout, h: number) => {
  const S = lay.safe
  if (h >= S.bottom - S.top) return (S.top + S.bottom) / 2 - h / 2
  return Math.min(S.bottom - h, Math.max(S.top, -h / 2))
}

/** The counter card's width at the hero size, its label measured in the loaded font (see src/motion/Counter.tsx). */
export const counterCardW = (t: Theme, lay: LaunchLayout, c: CounterTrack) => {
  const size = lay.heroSize
  const fs = size * 0.27
  const labelW = textWidth(c.label, fs, 600, t.font, 0.4 / fs) + size * 0.13 + 10 + 6
  return Math.ceil(Math.max(c.digits * 0.62 * size, labelW) + 26 * 2 + 4)
}

/** The counter card's width in its corner during a scene, or 0 when the counter isn't on screen then. */
export const hudWidth = (t: Theme, lay: LaunchLayout, c: CounterTrack | undefined, s: LaunchTLScene) => (c && counterIn(c, s) ? (counterCardW(t, lay, c) * lay.hud.size) / lay.heroSize : 0)

/** Whether the counter is on screen during a scene. */
export const counterIn = (c: CounterTrack | undefined, s: LaunchTLScene) => !!c && c.show < s.to && (!c.hide || c.hide[1] > s.from)

/** The counter's value and glow mix at global frame g. */
export const counterValue = (c: CounterTrack, g: number) => counterAt(c, g, EASE.count)

/** The exit every scene shares: 0 → 1 (ease-in) over its last frames, from the plan's `out`. */
export const sceneOut = (f: number, out: number, fps: number) => tween(f, out, out + at60(EXIT, fps), 0, 1, EASE.in)

export type { Rect }
