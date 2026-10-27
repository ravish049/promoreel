// The talking scenes on the backdrop: the hook (a big question, then optional number cards) and the quiz (options, the
// right one lights up). Everything moves on the voice: words found in the line's captions trigger the cards and badges.
import React from 'react'
import type { Caption } from '@remotion/captions'
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SAFE, rgba, useTheme, type Theme } from '../theme'
import { Icon } from '../icons'
import { fadeUp, onPhoto } from '../parts'
import type { CardStyle, HookCard, HookScene, QuizScene } from '../spec'
import type { TLLine, TLScene } from '../timeline'

export type SceneProps<S> = {
  scene: TLScene & { spec: S }
  lines: TLLine[]
  captions: Record<string, Caption[]>
}

/** Milliseconds from the start of the scene to the start of a line. */
export const lineAt = (scene: TLScene, lines: TLLine[], id: string, fps: number) => {
  const l = lines.find((x) => x.id === id)
  return l ? l.startMs - (scene.startFrame / fps) * 1000 : 0
}

const bare = (w: string) => w.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** Milliseconds from the start of the scene to when the voice says `word` (first match in the scene's lines). */
export function wordAt(scene: TLScene, lines: TLLine[], captions: Record<string, Caption[]>, word: string | undefined, fps: number, fallback: number) {
  if (!word) return fallback
  const want = bare(word)
  for (const l of lines) {
    const w = (captions[l.id] ?? []).find((c) => bare(c.text) === want)
    if (w) return lineAt(scene, lines, l.id, fps) + w.startMs
  }
  return fallback
}

/** How a card sits on the backdrop: solid paper with ink words (default, the most legible), or frosted glass. */
type Skin = { card: React.CSSProperties; label: string; text: string; tile: string; tileText: string }
export const skinOf = (style: CardStyle | undefined, t: Theme): Skin =>
  style === 'glass'
    ? {
        card: { background: rgba(t.paper, 0.13), backdropFilter: 'blur(24px) saturate(1.2)', border: `1.5px solid ${rgba(t.paper, 0.34)}`, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', borderRadius: 56, fontFamily: t.font },
        label: rgba(t.paper, 0.78),
        text: t.paper,
        tile: rgba(t.paper, 0.14),
        tileText: t.accent,
      }
    : {
        card: { background: t.paper, boxShadow: `0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px ${rgba(t.ink, 0.06)}`, borderRadius: 56, fontFamily: t.font },
        label: rgba(t.ink, 0.64),
        text: t.ink,
        tile: t.ink,
        tileText: t.paper,
      }

/** A rolling counter: a strip of whole numbers that slides, so 40 → 39 → 38 rolls like an odometer. */
const Counter: React.FC<{ value: number; min: number; max: number; unit?: string; size: number; color: string; font: string }> = ({ value, min, max, unit, size, color, font }) => {
  const lh = size * 1.02
  const nums = []
  for (let n = max; n >= min; n--) nums.push(n)
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: font, fontWeight: 800, fontSize: size, color, letterSpacing: -size * 0.04, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ height: lh, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `translateY(${-(max - value) * lh}px)` }}>
          {nums.map((n) => (
            <div key={n} style={{ height: lh, lineHeight: `${lh}px` }}>
              {n}
            </div>
          ))}
        </div>
      </div>
      {unit && <span style={{ fontSize: size * 0.5, marginLeft: size * 0.08, letterSpacing: 0 }}>{unit}</span>}
    </div>
  )
}

/** Pack words into rows of at most `max` characters (a long word gets a row of its own). */
function rowsOf(words: string[], max: number): string[][] {
  const rows: string[][] = []
  for (const w of words) {
    const last = rows[rows.length - 1]
    if (last && [...last, w].join(' ').length <= max) last.push(w)
    else rows.push([w])
  }
  return rows
}

const CardView: React.FC<{ card: HookCard; skin: Skin; t: Theme; p: number; count: number; dropped: number; top: number }> = ({ card, skin, t, p, count, dropped, top }) => {
  const lo = Math.min(card.from ?? card.value, card.value)
  const hi = Math.max(card.from ?? card.value, card.value)
  return (
    <div style={{ position: 'absolute', top, width: 930, ...skin.card, padding: '44px 56px 36px', opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }), transform: `translateY(${(1 - p) * 85}px) scale(${0.94 + 0.06 * p})` }}>
      <div style={{ fontSize: 46, fontWeight: 650, color: skin.label, letterSpacing: -0.3, maxWidth: 640 }}>{card.label}</div>
      <Counter value={count} min={lo} max={hi} unit={card.unit} size={230} color={dropped > 0.5 ? t.accent : skin.text} font={t.font} />
      {(card.icon || card.glyph) && (
        <div style={{ position: 'absolute', right: 56, top: 120, width: 150, height: 150, borderRadius: 34, background: skin.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 84, fontWeight: 800, color: skin.tileText }}>
          {card.icon ? <Icon name={card.icon} size={80} color={t.accent} stroke={2} /> : card.glyph}
        </div>
      )}
    </div>
  )
}

export const Hook: React.FC<SceneProps<HookScene> & { cards?: CardStyle }> = ({ scene, lines, captions, cards }) => {
  const s = scene.spec
  const t = useTheme()
  const k = skinOf(cards, t)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = (frame / fps) * 1000
  const f = (atMs: number) => (atMs / 1000) * fps
  const first = lines[0] ? lineAt(scene, lines, lines[0].id, fps) : 0
  const cardList = (s.cards ?? []).slice(0, 2)
  const hasCards = cardList.length > 0

  // with a headline, the cards wait for their own line; the headline leaves as they come
  const tCards = hasCards ? (s.headline && s.cardsLine ? lineAt(scene, lines, s.cardsLine, fps) - 150 : 0) : Infinity
  // the headline is fully gone before the first card starts, so the two never overlap
  const out = hasCards ? interpolate(ms, [tCards - 320, tCards], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) }) : 0

  // the headline: rows sized to fit, the last word in the accent colour
  const words = (s.headline ?? '').split(' ').filter(Boolean)
  const chars = words.join(' ').length
  const size = chars <= 16 ? 196 : chars <= 26 ? 156 : 124
  // ~0.62 em per character covers the wider bundled fonts (Space Grotesk, Poppins); rows never wrap on their own
  const rows = rowsOf(words, Math.max(4, Math.floor(980 / (size * 0.62))))
  let wi = 0

  const c1 = cardList[0]
  const c2 = cardList[1]
  const pA = hasCards ? spring({ frame: frame - f(tCards + 40), fps, config: { damping: 15, stiffness: 130 } }) : 0
  const tCount = c1 ? wordAt(scene, lines, captions, c1.atWord ?? String(c1.value), fps, (Number.isFinite(tCards) ? tCards : first) + 1200) : 0
  const count = c1 ? interpolate(ms, [tCount - 250, tCount + 650], [c1.from ?? c1.value, c1.value], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) }) : 0
  const dropped = c1 && c1.from !== undefined && c1.from !== c1.value ? interpolate(ms, [tCount - 100, tCount + 300], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const tB = c2 ? wordAt(scene, lines, captions, c2.atWord, fps, tCount + 1000) : 0
  const pB = c2 ? spring({ frame: frame - f(Math.max(tB - 120, tCards + 40)), fps, config: { damping: 15, stiffness: 130 } }) : 0
  const tBadge = s.badge ? wordAt(scene, lines, captions, s.badge.atWord, fps, (c2 ? tB : tCount) + 1300) : 0
  const pBadge = s.badge ? spring({ frame: frame - f(hasCards ? Math.max(tBadge, tCards + 40) : tBadge), fps, config: { damping: 9, stiffness: 160 } }) : 0
  const pSub = spring({ frame: frame - 2 - words.length * 5 - 6, fps, config: { damping: 15, stiffness: 140 } })

  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      {words.length > 0 && out < 1 && (
        <div style={{ position: 'absolute', top: SAFE.top + 150, width: 980, textAlign: 'center', fontFamily: t.font, fontSize: size, fontWeight: 900, letterSpacing: -size * 0.035, lineHeight: 0.98, ...onPhoto, opacity: 1 - out, transform: `translateY(${-out * 120}px) scale(${1 - 0.12 * out})` }}>
          {rows.map((row, r) => (
            <div key={r} style={{ whiteSpace: 'nowrap' }}>
              {row.map((w, j) => {
                const idx = wi++
                const p = spring({ frame: frame - 2 - idx * 5, fps, config: { damping: 11, stiffness: 150 } })
                return (
                  <span key={j} style={{ display: 'inline-block', marginRight: j < row.length - 1 ? size * 0.22 : 0, color: idx === words.length - 1 ? t.accent : t.paper, opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 90}px) scale(${0.8 + 0.2 * p})` }}>
                    {w}
                  </span>
                )
              })}
            </div>
          ))}
          {s.sub && <div style={{ marginTop: 44, fontSize: 52, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.18, color: rgba(t.paper, 0.88), ...fadeUp(pSub, 30) }}>{s.sub}</div>}
        </div>
      )}
      {c1 && <CardView card={c1} skin={k} t={t} p={Math.min(1, pA * 1.2)} count={count} dropped={dropped} top={SAFE.top + 20} />}
      {c2 && <CardView card={c2} skin={k} t={t} p={pB} count={c2.value} dropped={0} top={SAFE.top + 450} />}
      {s.badge && (
        <div
          style={{
            position: 'absolute',
            top: SAFE.top + (c2 ? 372 : 400),
            right: 92,
            padding: '18px 34px',
            borderRadius: 999,
            background: t.accent,
            color: t.ink,
            fontFamily: t.font,
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: -1,
            boxShadow: `0 18px 44px ${rgba(t.accent, 0.5)}, 0 0 0 4px ${rgba(t.ink, 0.25)}`,
            transform: `scale(${pBadge}) rotate(${-6 * pBadge}deg)`,
          }}
        >
          {s.badge.text}
        </div>
      )}
    </AbsoluteFill>
  )
}

export const Quiz: React.FC<SceneProps<QuizScene> & { cards?: CardStyle }> = ({ scene, lines, captions, cards }) => {
  const s = scene.spec
  const t = useTheme()
  const k = skinOf(cards, t)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = (frame / fps) * 1000
  const f = (atMs: number) => (atMs / 1000) * fps
  const tQ = lines[0] ? lineAt(scene, lines, lines[0].id, fps) : 0
  const tReveal = lineAt(scene, lines, s.revealLine, fps)
  const reveal = spring({ frame: frame - f(tReveal), fps, config: { damping: 12, stiffness: 150 } })
  const tFoot = wordAt(scene, lines, captions, s.footAtWord, fps, tReveal + 1500)
  const pFoot = spring({ frame: frame - f(tFoot - 80), fps, config: { damping: 16, stiffness: 140 } })
  const words = s.question.split(' ')
  const hl = new Set((s.highlight ?? []).map(bare))
  const letters = ['A', 'B', 'C', 'D']
  const onHighlight = '#fff'

  return (
    <AbsoluteFill style={{ alignItems: 'center', fontFamily: t.font }}>
      <div style={{ position: 'absolute', top: SAFE.top + 10, width: 950, textAlign: 'center', fontSize: 96, fontWeight: 850, letterSpacing: -2.5, lineHeight: 1.04, color: t.paper, ...onPhoto }}>
        {words.map((w, i) => {
          const p = spring({ frame: frame - f(tQ - 250) - i * 2.5, fps, config: { damping: 13, stiffness: 160 } })
          const lit = s.highlight ? hl.has(bare(w)) : /\d/.test(w)
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: 22, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 50}px)`, color: lit ? t.accent : t.paper }}>
              {w}
            </span>
          )
        })}
      </div>
      {s.options.map((o, i) => {
        const p = spring({ frame: frame - f(tQ + 250) - i * 4, fps, config: { damping: 15, stiffness: 150 } })
        const right = i === s.answer
        const lit = right ? reveal : 0
        const dim = right ? 1 : interpolate(reveal, [0, 1], [1, 0.42])
        const pulse = right ? 1 + 0.045 * Math.sin(Math.min(1, Math.max(0, (ms - tReveal) / 450)) * Math.PI) : 1 - 0.02 * reveal
        const on = right && lit > 0.5
        return (
          <div
            key={o}
            style={{
              position: 'absolute',
              top: SAFE.top + 250 + i * 162,
              width: 930,
              height: 142,
              display: 'flex',
              alignItems: 'center',
              gap: 34,
              padding: '0 40px',
              boxSizing: 'border-box',
              ...k.card,
              borderRadius: 44,
              // the highlight colour, only for the right answer
              ...(right && lit > 0.02 ? { background: `color-mix(in srgb, ${t.highlight} ${lit * 100}%, ${cards === 'glass' ? rgba(t.paper, 0.13) : t.paper})`, border: 'none', boxShadow: `0 24px 60px ${rgba(t.highlight, 0.5 * lit)}, 0 0 0 ${6 * lit}px ${rgba(t.highlight, 0.25)}` } : {}),
              opacity: Math.min(1, p * 1.4) * dim,
              transform: `translateX(${(1 - p) * 260}px) scale(${pulse})`,
            }}
          >
            <div style={{ width: 92, height: 92, borderRadius: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 800, background: on ? onHighlight : cards === 'glass' ? k.tile : rgba(t.ink, 0.08), color: on ? t.highlight : k.label }}>
              {on ? '✓' : letters[i]}
            </div>
            <div style={{ fontSize: o.length > 18 ? 54 : 64, fontWeight: 750, letterSpacing: -1.2, color: on ? onHighlight : k.text }}>{o}</div>
          </div>
        )
      })}
      {s.foot && (
        <div style={{ position: 'absolute', top: SAFE.top + 250 + s.options.length * 162 + 4, width: 930, textAlign: 'right', fontSize: 58, fontWeight: 750, fontStyle: 'italic', color: t.accent, letterSpacing: -0.8, ...onPhoto, ...fadeUp(pFoot, 30) }}>
          {s.foot}
        </div>
      )}
    </AbsoluteFill>
  )
}
