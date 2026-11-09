// The screen kit's palette and its pure helpers. Every colour is derived from the theme (ink, paper, accent, highlight,
// success): the card is the paper lifted toward white, greys are ink mixed into the card, the app's tint (links, primary
// buttons, the lit tab) is the theme's highlight, and pills take a Tone. Timing helpers are in seconds and turned into
// frames with the composition's fps, so a screen moves the same at 30 and 60 fps.
import { mixColor } from '../motion'
import { luminance, onColor, rgba, type Theme } from '../reel/theme'
import type { Tone } from '../reel/spec'

const rgbOf = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** hex lifted toward white by k (0–1). */
export const lift = (hex: string, k: number) => `#${rgbOf(hex).map((v) => Math.round(v + (255 - v) * Math.min(1, Math.max(0, k))).toString(16).padStart(2, '0')).join('')}`

/** Rough colour distance 0–1 (Euclidean RGB / max). */
const distance = (a: string, b: string) => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0)) / 441.7
}

export type ToneColors = { fg: string; bg: string; solid: string }

export type Palette = {
  card: string
  /** Secondary fills: input wells, day chips, the phone's screen. */
  grouped: string
  separator: string
  label: string
  label2: string
  label3: string
  /** The app's own tint: primary buttons, links, focus rings, the lit tab. */
  tint: string
  onTint: string
  success: string
  onSuccess: string
  shadow: string
  shadowSmall: string
  tone: (tone: Tone) => ToneColors
  /** The tone of a diff pill: the accent, or the highlight when the accent is too close to success to tell apart. */
  diff: Tone
  /** An avatar colour: by position when `index` is given (neighbours differ), else stable for the key (initials). */
  avatar: (key: string, index?: number) => string
  font: string
}

export const paletteOf = (t: Theme): Palette => {
  const light = luminance(t.paper) > 0.4
  const card = light ? lift(t.paper, 0.82) : mixColor(t.paper, t.ink, 0.08)
  const label2 = mixColor(t.ink, card, 0.45)
  const tones: Record<Tone, ToneColors> = {
    accent: { fg: mixColor(t.accent, t.ink, 0.32), bg: rgba(t.accent, 0.15), solid: t.accent },
    highlight: { fg: mixColor(t.highlight, t.ink, 0.18), bg: rgba(t.highlight, 0.12), solid: t.highlight },
    success: { fg: mixColor(t.success, t.ink, 0.3), bg: rgba(t.success, 0.14), solid: t.success },
    muted: { fg: label2, bg: mixColor(card, t.ink, 0.06), solid: label2 },
  }
  const avatars = [t.accent, t.highlight, t.success, mixColor(t.highlight, t.ink, 0.35), mixColor(t.accent, t.ink, 0.3)]
  return {
    card,
    grouped: mixColor(card, t.ink, 0.045),
    separator: mixColor(card, t.ink, 0.11),
    label: t.ink,
    label2,
    label3: mixColor(t.ink, card, 0.68),
    tint: t.highlight,
    onTint: onColor(t.highlight, t),
    success: t.success,
    onSuccess: onColor(t.success, t),
    shadow: `0 30px 70px ${rgba(t.ink, 0.14)}, 0 6px 18px ${rgba(t.ink, 0.07)}`,
    shadowSmall: `0 8px 22px ${rgba(t.ink, 0.12)}`,
    tone: (tone) => tones[tone] ?? tones.muted,
    diff: distance(t.accent, t.success) < 0.18 ? 'highlight' : 'accent',
    avatar: (key, index) => avatars[(index ?? [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7)) % avatars.length],
    font: t.font,
  }
}

// ── text ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const NUM = /\d[\d,]*(?:\.\d+)?/g

/**
 * Every number in `text` counted up from 0 by p (0–1), keeping its decimals and thousands commas:
 * countText("$4,960.00", 0.5) → "$2,480.00". Text without numbers is returned as is.
 */
export const countText = (text: string, p: number) => {
  const k = Math.min(1, Math.max(0, p))
  if (k >= 1) return text
  return text.replace(NUM, (m) => {
    const dec = m.includes('.') ? m.split('.')[1].length : 0
    const v = parseFloat(m.replace(/,/g, '')) * k
    const s = dec ? v.toFixed(dec) : String(Math.floor(v))
    if (!m.includes(',')) return s
    const [int, frac] = s.split('.')
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac !== undefined ? `.${frac}` : '')
  })
}

/** The first `p` share of `text`, whole characters: typing it in. */
export const typed = (text: string, p: number) => {
  const chars = [...text]
  return chars.slice(0, Math.ceil(chars.length * Math.min(1, Math.max(0, p)))).join('')
}

/** A number in a cell ("38.0 h", "$1,078.00", "−2"), or null. */
export const numberIn = (text: string): { value: number; decimals: number } | null => {
  const m = text.replace(/−/g, '-').match(/-?\d[\d,]*(?:\.\d+)?/)
  if (!m) return null
  return { value: parseFloat(m[0].replace(/,/g, '')), decimals: m[0].includes('.') ? m[0].split('.')[1].length : 0 }
}

/** b − a as a signed label ("−2.0", "+1.5"), or null when either isn't a number. Equal numbers give "0". */
export const diffText = (a: string, b: string): string | null => {
  const x = numberIn(a)
  const y = numberIn(b)
  if (!x || !y) return null
  const d = y.value - x.value
  const dec = Math.max(x.decimals, y.decimals)
  if (d === 0) return '0'
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(dec)}`
}

// ── timing ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export { sec, stagger } from './timing'
