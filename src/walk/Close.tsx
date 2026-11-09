// The close: the brand's logo pops in, the name reveals beside it (sized so it always fits whole), the tagline lands
// word by word with its last words in the accent colour, a short line, then the call-to-action pill. Copy from
// spec.close, falling back to brand.outro. All of it sits in the safe zone, clear of the captions' band.
import React from 'react'
import { EASE, Words, drift, enter, tween } from '../motion'
import { Logo } from '../reel/parts'
import { SAFE, onColor, rgba, useTheme } from '../reel/theme'
import { at60 } from './plan'
import { fitSize, textWidth, useWalk } from './context'
import { TRACK, WORD_GAP } from './World'

const W = SAFE.right - SAFE.left
const MARK = 150
const GAP = 32
const NAME_MAX = 136
const TAG_MAX = 84
const TAG_MIN = 62

export const Close: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { plan, spec } = useWalk()
  const F = (n: number) => at60(n, plan.fps)
  const fps = plan.fps
  const L = plan.logo
  const s = L.scene.from
  if (g < s - F(4)) return null
  const name = t.brand.name
  const tagline = spec.close?.tagline ?? t.brand.outro?.tagline
  const line = spec.close?.title ?? t.brand.outro?.title
  const cta = spec.close?.cta ?? t.brand.outro?.cta ?? ''

  // the name: as large as fits beside the mark, never clipped; a long name gets a smaller mark so the row stays balanced
  let mark = MARK
  let nameSize = fitSize(name, W - mark - GAP - 24, NAME_MAX, 800, t.font, -0.035)
  if (nameSize * 1.15 < mark) {
    mark = Math.max(96, Math.round(nameSize * 1.15))
    nameSize = fitSize(name, W - mark - GAP - 24, NAME_MAX, 800, t.font, -0.035)
  }
  const nameW = textWidth(name, nameSize, 800, t.font, -0.035)
  const tile = enter(g, s + F(14), F(30), fps)
  const reveal = tween(g, L.name, L.name + F(30), 0, 1, EASE.out)
  const nameIn = enter(g, L.name, F(34), fps)
  const slide = (1 - reveal) * (nameW + GAP) * 0.5

  // the tagline: one line if it fits at TAG_MIN or more, else its two parts on two rows
  const a = tagline ? tagline[0].split(/\s+/).filter(Boolean) : []
  const b = tagline ? tagline[1].split(/\s+/).filter(Boolean) : []
  const all = [...a, ...b]
  const oneLine = fitSize(all.join(' '), W / (1 + WORD_GAP * 0.4), TAG_MAX, 800, t.font, TRACK)
  const rows = oneLine >= TAG_MIN || !b.length ? [all] : [a, b]
  const tagSize = rows.length === 1 ? oneLine : Math.min(...rows.map((r) => fitSize(r.join(' '), W / (1 + WORD_GAP * 0.4), TAG_MAX, 800, t.font, TRACK)))
  const wordAt = all.map((_, i) => L.tagline + i * F(8))
  const tagEnd = wordAt[wordAt.length - 1] ?? L.tagline
  const lineIn = enter(g, tagEnd + F(18), F(30), fps)
  const ctaIn = enter(g, L.cta, F(30), fps)
  const ctaSize = fitSize(cta, W - 120, 42, 700, t.font)
  const fg = onColor(t.accent, t)
  let k = 0
  return (
    <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, top: SAFE.top, bottom: 1920 - SAFE.bottom + 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: t.font, transform: `translateY(${drift(g, 4, F(320))}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
        <div style={{ transform: `translateX(${slide}px)`, filter: `drop-shadow(0 16px 30px ${rgba(t.ink, 0.25)})`, flexShrink: 0 }}>
          <Logo size={mark} pop={tile} />
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: nameSize,
            letterSpacing: -nameSize * 0.035,
            lineHeight: 1.2,
            color: t.ink,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            clipPath: reveal < 1 ? `inset(-25% ${(1 - reveal) * 100}% -25% -10%)` : undefined,
            transform: `translateX(${slide - (1 - nameIn) * 40}px)`,
            opacity: Math.min(1, nameIn * 1.4),
          }}
        >
          {name}
        </div>
      </div>
      {rows[0].length ? (
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {rows.map((r, ri) => {
            const idx = r.map(() => k++)
            return <Words key={ri} f={g} words={r} at={idx.map((i) => wordAt[i])} size={tagSize} color={t.ink} accentWords={idx.map((i, j) => (i >= a.length ? j : -1)).filter((j) => j >= 0)} />
          })}
        </div>
      ) : null}
      {line ? (
        <div style={{ marginTop: 22, maxWidth: 860, textAlign: 'center', fontSize: 36, fontWeight: 500, lineHeight: 1.35, color: rgba(t.ink, 0.72), textWrap: 'balance', opacity: Math.min(1, lineIn * 1.5), transform: `translateY(${(1 - lineIn) * 16}px)` }}>{line}</div>
      ) : null}
      {cta ? (
        <div style={{ marginTop: 48, fontSize: ctaSize, fontWeight: 700, color: fg, background: t.accent, padding: `${Math.round(ctaSize * 0.62)}px ${Math.round(ctaSize * 1.24)}px`, borderRadius: 999, boxShadow: `0 16px 36px ${rgba(t.accent, 0.32)}`, transform: `scale(${0.85 + 0.15 * ctaIn})`, opacity: Math.min(1, ctaIn * 1.6), whiteSpace: 'nowrap' }}>{cta}</div>
      ) : null}
    </div>
  )
}
