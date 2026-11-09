// The logo: the brand's mark pops in with a soft accent glow (brand.logo, or a themed tile with the initial), the name
// wipes out from beside it, the tagline lands word by word (its second part in the accent colour), then a one-line
// description and the call-to-action pill. The whole stack sits centred in the safe area and pushes in gently.
// Copy: the spec's own, else brand.outro (tagline, cta; the line falls back to outro.title); the name is spec.title or
// the brand's name.
import React from 'react'
import { Camera, EASE, Words, camAt, drift, enter, tween } from '../../motion'
import { Logo } from '../../reel/parts'
import { onColor, rgba, useTheme } from '../../reel/theme'
import { fitSize, textWidth } from '../../walk/context'
import { ROW_H, WORD_GAP, centredTop, fitRows, useLaunch, type Row } from '../context'
import { at60, logoBeats, type LogoPlan } from '../plan'

export const LogoScene: React.FC<{ p: LogoPlan; f: number }> = ({ p, f }) => {
  const t = useTheme()
  const { plan, lay } = useLaunch()
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const S = lay.safe
  const maxW = lay.logo.maxW
  const s = p.spec
  const name = s.title ?? t.brand.name
  const tagline = s.tagline ?? t.brand.outro?.tagline
  const line = s.line ?? t.brand.outro?.title
  const cta = s.cta ?? t.brand.outro?.cta ?? ''

  // the name: as large as fits beside the mark; a short name gets a mark in proportion
  const gap = lay.logo.mark * 0.2
  let mark = lay.logo.mark
  let nameSize = fitSize(name, maxW - mark - gap, lay.logo.name, 800, t.font, -0.035)
  if (nameSize * 1.15 < mark) {
    mark = Math.max(mark * 0.6, Math.round(nameSize * 1.15))
    nameSize = fitSize(name, maxW - mark - gap, lay.logo.name, 800, t.font, -0.035)
  }
  const nameW = textWidth(name, nameSize, 800, t.font, -0.035)

  // the tagline: one row if it fits at 80 % of its size, else its two parts on two rows
  const a = tagline ? tagline[0].split(/\s+/).filter(Boolean) : []
  const b = tagline ? tagline[1].split(/\s+/).filter(Boolean) : []
  const all = [...a, ...b]
  const beats = logoBeats(p, all.length, fps)
  const at = all.map((_, i) => p.tagline + i * p.taglineGap)
  const one = fitRows([{ words: all, accent: false, at }], maxW, lay.logo.tagline, t.font, 0.8)
  const tag: { rows: Row[]; size: number } =
    one.rows.length === 1 || !b.length
      ? one
      : fitRows(
          [
            { words: a, accent: false, at: at.slice(0, a.length) },
            { words: b, accent: true, at: at.slice(a.length) },
          ],
          maxW,
          lay.logo.tagline,
          t.font,
        )
  const lineSize = lay.logo.line
  const lineW = line ? textWidth(line, lineSize, 500, t.font) : 0
  const lineOne = lineW <= maxW
  const ctaSize = cta ? fitSize(cta, maxW - lay.logo.cta * 2.6, lay.logo.cta, 700, t.font) : 0
  // the stack's height, so it can sit on the canvas centre when the safe area allows
  const stackH =
    Math.max(mark, nameSize * 1.2) +
    (all.length ? tag.size * 0.55 + tag.rows.length * tag.size * ROW_H : 0) +
    (line ? lineSize * 0.8 + lineSize * 1.35 * Math.max(1, Math.ceil(lineW / maxW)) : 0) +
    (cta ? lay.logo.cta * 1.3 + ctaSize * 1.25 + 2 * Math.round(lay.logo.cta * 0.62) : 0)
  const top = centredTop(lay, stackH)

  const len = p.scene.to - p.scene.from
  const cam = camAt(
    [
      { f: 0, x: 0, y: 0, s: 1 },
      { f: len, x: 0, y: 0, s: 1.03 },
    ],
    f,
  )
  const tile = enter(f, p.tile, F(34), fps)
  const glow = tween(f, p.tile + F(8), p.tile + F(70), 0, 1, EASE.out)
  const reveal = tween(f, p.name, p.name + F(30), 0, 1, EASE.out)
  const nameIn = enter(f, p.name, F(34), fps)
  const slide = (1 - reveal) * (nameW + gap) * 0.5
  const lineIn = enter(f, beats.line, F(30), fps)
  const ctaIn = enter(f, beats.cta, F(30), fps)
  const fg = onColor(t.accent, t)
  const inn = tween(f, -F(12), F(6), 0, 1, EASE.out)
  let k = 0
  return (
    <Camera cam={cam}>
      <div
        style={{
          position: 'absolute',
          left: S.left,
          width: S.right - S.left,
          top,
          height: stackH,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: t.font,
          opacity: inn,
          transform: `translateY(${drift(f, 4, F(320))}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap }}>
          <div style={{ position: 'relative', transform: `translateX(${slide}px)`, flexShrink: 0 }}>
            <div
              style={{
                position: 'absolute',
                left: mark / 2 - mark * 1.6,
                top: mark / 2 - mark * 1.6,
                width: mark * 3.2,
                height: mark * 3.2,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, ${rgba(t.accent, 0.26)}, ${rgba(t.accent, 0)})`,
                opacity: glow,
              }}
            />
            <div style={{ position: 'relative', filter: `drop-shadow(0 ${mark * 0.1}px ${mark * 0.2}px ${rgba('#000000', 0.45)})` }}>
              <Logo size={mark} pop={tile} />
            </div>
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: nameSize,
              letterSpacing: -nameSize * 0.035,
              lineHeight: 1.2,
              color: t.paper,
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
        {all.length ? (
          <div style={{ marginTop: tag.size * 0.55, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {tag.rows.map((r, ri) => {
              const idx = r.words.map(() => k++)
              return (
                <div key={ri} style={{ height: tag.size * ROW_H, display: 'flex', alignItems: 'center' }}>
                  <Words f={f} words={r.words} at={r.at} size={tag.size} color={t.paper} gap={WORD_GAP} accentWords={idx.map((i, j) => (i >= a.length ? j : -1)).filter((j) => j >= 0)} />
                </div>
              )
            })}
          </div>
        ) : null}
        {line ? (
          <div
            style={{
              marginTop: lineSize * 0.8,
              maxWidth: maxW,
              textAlign: 'center',
              fontSize: lineSize,
              fontWeight: 500,
              lineHeight: 1.35,
              color: rgba(t.paper, 0.76),
              whiteSpace: lineOne ? 'nowrap' : 'normal',
              textWrap: 'balance',
              opacity: Math.min(1, lineIn * 1.5),
              transform: `translateY(${(1 - lineIn) * 16}px)`,
            }}
          >
            {line}
          </div>
        ) : null}
        {cta ? (
          <div
            style={{
              marginTop: lay.logo.cta * 1.3,
              fontSize: ctaSize,
              lineHeight: 1.25,
              fontWeight: 700,
              color: fg,
              background: t.accent,
              padding: `${Math.round(lay.logo.cta * 0.62)}px ${Math.round(lay.logo.cta * 1.3)}px`,
              borderRadius: 999,
              boxShadow: `0 16px 40px ${rgba(t.accent, 0.35)}`,
              transform: `scale(${0.85 + 0.15 * ctaIn})`,
              opacity: Math.min(1, ctaIn * 1.6),
              whiteSpace: 'nowrap',
            }}
          >
            {cta}
          </div>
        ) : null}
      </div>
    </Camera>
  )
}
