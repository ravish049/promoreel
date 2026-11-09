// What every layer of the Walk composition reads: the spec, its timeline and plan, the captions, and the world's
// geometry. Plus text measuring in the browser, so names and labels are sized to fit instead of being clipped.
import { createContext, useContext, useEffect, useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import type { Caption } from '@remotion/captions'
import { firstFamily } from '../motion'
import type { WalkInput } from '../reel/spec'
import type { WalkTimeline } from './timeline'
import type { WalkPlan } from './plan'
import type { World } from './World'

export type WalkCtx = {
  spec: WalkInput & { fps: number }
  tl: WalkTimeline
  plan: WalkPlan
  captions: Record<string, Caption[]>
  world: World
}

export const WalkContext = createContext<WalkCtx | null>(null)

export const useWalk = (): WalkCtx => {
  const c = useContext(WalkContext)
  if (!c) throw new Error('useWalk() outside the Walk composition')
  return c
}

const widths = new Map<string, number>()
let probe: HTMLSpanElement | null = null
/** Families whose faces are loaded: widths measured in them are kept. */
const ready = new Set<string>()

/**
 * Holds the frame until the theme's font is loaded, then renders again, so every width this frame measures is in the
 * real font: a frame is rendered once and screenshotted after its delayRender handles clear, and a font arriving in
 * between would not re-run the measuring. Returns whether the font is ready.
 */
export const useTextReady = (family: string): boolean => {
  const [ok, setOk] = useState(() => ready.has(family))
  const [handle] = useState(() => (ready.has(family) ? null : delayRender(`Measuring text in ${firstFamily(family)}`)))
  useEffect(() => {
    if (ok) return
    let live = true
    const name = firstFamily(family)
    const check = async () => {
      // the weights the walk draws text in; a single-weight font file matches them all
      for (let i = 0; i < 200 && live; i++) {
        const faces = await Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 20px "${name}"`)))
        if (faces.every((f) => f.length > 0)) break
        await new Promise((r) => setTimeout(r, 50))
      }
      if (!live) return
      // a font that never loads is reported by useFontGate; measure with what is there rather than hang
      ready.add(family)
      setOk(true)
    }
    check()
    return () => {
      live = false
    }
  }, [family, ok])
  useEffect(() => {
    if (ok && handle !== null) continueRender(handle)
  }, [ok, handle])
  return ok
}

/**
 * The rendered width of `text` in px at `size`, measured in the DOM with the theme's font (cached once the font is
 * loaded), so it matches the layout exactly. `tracking` is CSS letter-spacing as a share of the size (−0.025 =
 * −0.025em). Outside a browser, an estimate.
 */
export const textWidth = (text: string, size: number, weight: number, family: string, tracking = 0): number => {
  const chars = [...text].length
  if (typeof document === 'undefined' || !document.body) return chars * size * (0.5 + tracking)
  // measured at the size it is drawn at: a variable font's widths don't scale exactly with the size
  const px = Math.max(1, Math.round(size * 4) / 4)
  const key = `${weight}|${family}|${tracking}|${px}|${text}`
  let w = widths.get(key)
  if (w === undefined) {
    if (!probe) {
      probe = document.createElement('span')
      Object.assign(probe.style, { position: 'absolute', left: '-99999px', top: '0', whiteSpace: 'pre', visibility: 'hidden', lineHeight: '1' })
      document.body.appendChild(probe)
    }
    probe.style.fontFamily = family
    probe.style.fontWeight = String(weight)
    probe.style.fontSize = `${px}px`
    probe.style.letterSpacing = `${tracking * px}px`
    probe.textContent = text
    w = probe.getBoundingClientRect().width
    if (ready.has(family)) widths.set(key, w)
  }
  return (w * size) / px
}

/** The largest size ≤ max (and ≥ min) at which `text` fits `width` on one line. */
export const fitSize = (text: string, width: number, max: number, weight: number, family: string, tracking = 0, min = 1): number => {
  let s = max
  for (let i = 0; i < 12; i++) {
    const w = textWidth(text, s, weight, family, tracking)
    if (w <= width || s <= min) break
    s = Math.max(min, Math.min(s - 1, Math.floor((s * width) / w)))
  }
  return s
}

/** Words wrapped greedily into rows no wider than `width`, as laid out by <Words> (gap = share of the size). */
export const wrapWords = (words: readonly string[], size: number, width: number, weight: number, family: string, tracking: number, gap: number): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let w = 0
  for (const word of words) {
    const ww = textWidth(word, size, weight, family, tracking)
    const next = row.length ? w + gap * size + ww : ww
    if (row.length && next > width) {
      rows.push(row)
      row = [word]
      w = ww
    } else {
      row.push(word)
      w = next
    }
  }
  if (row.length) rows.push(row)
  return rows
}
