// The look of a reel comes from the project's brand.json, never from a scene. Scenes read it with useTheme().
import React, { createContext, useContext } from 'react'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope'
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans'
import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { loadFont as loadLocal } from '@remotion/fonts'
import { staticFile } from 'remotion'
import type { Brand } from './spec'

/** Meta's safe zone for key text on a 1080×1920 Reel: clear of the top ~14 %, the bottom ~35 % and ~6 % each side. */
export const SAFE = { top: 269, bottom: 1248, left: 65, right: 1015 } as const

/** The phone's own chrome (status bar text, separators): fixed, it is a phone, not the brand. */
export const PHONE = { label: '#1C1C1E' } as const

export type Theme = {
  ink: string
  paper: string
  accent: string
  highlight: string
  success: string
  font: string
  mono: string
  brand: Brand
}

const FALLBACK = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
const WEIGHTS = ['500', '600', '700', '800'] as const

// The bundled Google Fonts (all SIL OFL 1.1). Each loads only when a brand asks for it.
const GOOGLE: Record<string, () => { fontFamily: string }> = {
  Inter: () => loadInter('normal', { weights: [...WEIGHTS, '900'], subsets: ['latin'] }),
  Manrope: () => loadManrope('normal', { weights: [...WEIGHTS], subsets: ['latin'] }),
  'DM Sans': () => loadDMSans('normal', { weights: [...WEIGHTS, '900'], subsets: ['latin'] }),
  'Plus Jakarta Sans': () => loadJakarta('normal', { weights: [...WEIGHTS], subsets: ['latin'] }),
  Poppins: () => loadPoppins('normal', { weights: [...WEIGHTS, '900'], subsets: ['latin'] }),
  'Space Grotesk': () => loadSpaceGrotesk('normal', { weights: ['500', '600', '700'], subsets: ['latin'] }),
}

const loaded = new Map<string, string>()

function fontFamilyOf(font: Brand['font']): string {
  const key = typeof font === 'string' || font === undefined ? `g:${font ?? 'Inter'}` : `f:${font.family}:${font.file}`
  const hit = loaded.get(key)
  if (hit) return hit
  let family: string
  if (font && typeof font === 'object') {
    loadLocal({ family: font.family, url: staticFile(font.file) }).catch((e) => console.error(`font ${font.file}: ${e}`))
    family = `"${font.family}"`
  } else {
    const name = font ?? 'Inter'
    const load = GOOGLE[name]
    if (!load) throw new Error(`brand.font "${name}" is not bundled. Use one of ${Object.keys(GOOGLE).join(', ')}, or { "family", "file" } for a font file in public/`)
    family = load().fontFamily
  }
  const full = `${family}, ${FALLBACK}`
  loaded.set(key, full)
  return full
}

let mono: string | null = null
const monoFamily = () => (mono ??= `${loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily}, Menlo, Consolas, monospace`)

export function themeOf(brand: Brand): Theme {
  return {
    ink: brand.colors.ink,
    paper: brand.colors.paper,
    accent: brand.colors.accent,
    highlight: brand.colors.highlight ?? '#0071E3',
    success: brand.colors.success ?? '#228336',
    font: fontFamilyOf(brand.font),
    mono: monoFamily(),
    brand,
  }
}

const Ctx = createContext<Theme | null>(null)

export const ThemeProvider: React.FC<{ brand: Brand; children: React.ReactNode }> = ({ brand, children }) => {
  const theme = React.useMemo(() => themeOf(brand), [brand])
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>
}

export function useTheme(): Theme {
  const t = useContext(Ctx)
  if (!t) throw new Error('useTheme() outside <ThemeProvider>')
  return t
}

/** "#FF5A00" + 0.4 → "rgba(255,90,0,0.4)". Accepts #rgb and #rrggbb. */
export function rgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Relative luminance 0–1, to pick light or dark text on a colour. */
export function luminance(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** The text colour that reads on `bg`: the brand's ink on a light colour, its paper on a dark one. */
export const onColor = (bg: string, t: Theme) => (luminance(bg) > 0.36 ? t.ink : t.paper)

export const glowColor = (c: 'accent' | 'highlight' | 'success' | undefined, t: Theme) => (c === 'success' ? t.success : c === 'highlight' ? t.highlight : t.accent)
