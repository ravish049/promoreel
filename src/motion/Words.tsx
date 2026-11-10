// Kinetic type: a line laid out in full from the start (so nothing reflows), each word rising in on its own frame.
import React from 'react'
import { useVideoConfig } from 'remotion'
import { useTheme } from '../reel/theme'
import { atFps, enter } from './motion'

export const Words: React.FC<{
  f: number
  words: readonly string[]
  /** the frame each word starts entering (one per word) */
  at: readonly number[]
  size: number
  /** the theme's ink by default */
  color?: string
  /** the theme's accent by default */
  accent?: string
  /** indexes of words drawn in the accent colour */
  accentWords?: readonly number[]
  weight?: number
  /** the space between words, as a share of `size` */
  gap?: number
  /** frames each word takes to settle (30 at 60 fps by default, scaled to the video's fps) */
  dur?: number
}> = ({ f, words, at, size, color, accent, accentWords = [], weight = 800, gap = 0.26, dur }) => {
  const t = useTheme()
  const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', gap: size * gap, fontFamily: t.font, fontWeight: weight, fontSize: size, letterSpacing: -size * 0.025, lineHeight: 1.08 }}>
      {words.map((w, i) => {
        const p = enter(f, at[i] ?? at[at.length - 1] ?? 0, dur ?? atFps(30, fps), fps)
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: accentWords.includes(i) ? (accent ?? t.accent) : (color ?? t.ink),
              opacity: Math.min(1, p * 1.6),
              transform: `translateY(${(1 - p) * size * 0.5}px) scale(${0.92 + 0.08 * p})`,
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}
