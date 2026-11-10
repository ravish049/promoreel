// Word-by-word captions for the walk, at the bottom of the safe zone: an ink pill, paper words, the spoken word in the
// accent colour. Each voice line gets its own pages; a page ends at punctuation and holds at most five words (a longer
// phrase splits into even pages). A page is always one line: its type shrinks to fit the safe zone's width.
import React, { useMemo } from 'react'
import { EASE, enter, tween } from '../motion'
import { SAFE, rgba, useTheme } from '../reel/theme'
import { at60 } from './plan'
import { fitSize, useWalk } from './context'

type Word = { text: string; from: number; to: number }
type Page = { line: string; scene: string; words: Word[]; lineFrom: number; lineTo: number }

/** The most words a caption page holds. */
export const PAGE_WORDS = 5
const SIZE = 48
const PAD_X = 28

/** A line's words split into pages: at punctuation, then evenly so no page holds more than `max` words. */
export const pagesOf = <T extends { text: string }>(words: readonly T[], max = PAGE_WORDS): T[][] => {
  const phrases: T[][] = [[]]
  for (const w of words) {
    phrases[phrases.length - 1].push(w)
    if (/[,.?!;:]["')\]]?$/.test(w.text.trim())) phrases.push([])
  }
  const out: T[][] = []
  for (const ph of phrases.filter((p) => p.length)) {
    const k = Math.ceil(ph.length / max)
    const size = Math.ceil(ph.length / k)
    for (let i = 0; i < ph.length; i += size) out.push(ph.slice(i, i + size))
  }
  return out
}

export const WalkCaptions: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { tl, plan, captions } = useWalk()
  const fps = tl.fps
  const F = (n: number) => at60(n, fps)
  const pages = useMemo(() => {
    const out: Page[] = []
    for (const l of tl.lines) {
      const caps = captions[l.id]
      if (!caps?.length) continue
      const words: Word[] = caps.map((c) => ({ text: c.text.trim(), from: l.from + Math.round((c.startMs / 1000) * fps), to: l.from + Math.round((c.endMs / 1000) * fps) }))
      for (const ws of pagesOf(words)) out.push({ line: l.id, scene: l.sceneId, words: ws, lineFrom: l.from, lineTo: l.from + l.durationInFrames })
    }
    return out
  }, [tl, captions, fps])

  const live = pages.filter((p) => !plan.hideCaptionsIn.includes(p.scene) && g >= p.lineFrom - F(4) && g <= p.lineTo + F(10))
  if (!live.length) return null
  const lineId = live[live.length - 1].line
  const mine = live.filter((p) => p.line === lineId)
  const page = [...mine].reverse().find((p) => g >= p.words[0].from - F(4)) ?? mine[0]
  const pin = enter(g, page.words[0].from - F(4), F(18), fps)
  const out = g > page.lineTo ? tween(g, page.lineTo, page.lineTo + F(10), 0, 1, EASE.in) : 0
  const text = page.words.map((w) => w.text).join(' ')
  const size = fitSize(text, SAFE.right - SAFE.left - PAD_X * 2 - 8, SIZE, 800, t.font, -0.01)
  return (
    <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, bottom: 1920 - SAFE.bottom + 14, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          padding: `${Math.round(size * 0.3)}px ${PAD_X}px`,
          borderRadius: 24,
          background: rgba(t.ink, 0.92),
          boxShadow: `0 10px 26px ${rgba(t.ink, 0.22)}`,
          fontFamily: t.font,
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: -size * 0.01,
          whiteSpace: 'nowrap',
          opacity: Math.min(1, pin * 1.6) * (1 - out),
          transform: `translateY(${(1 - pin) * 14}px) scale(${0.96 + 0.04 * pin})`,
        }}
      >
        {page.words.map((w, k) => {
          const next = page.words[k + 1]
          const active = g >= w.from && g < (next ? next.from : w.to + F(30))
          return (
            <span key={k} style={{ color: active ? t.accent : t.paper }}>
              {k > 0 ? ' ' : ''}
              {w.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}
