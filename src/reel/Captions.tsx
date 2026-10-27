// Word-by-word captions (TikTok style, @remotion/captions), always inside Meta's safe zone.
// Each voice line gets its own pages, so a page never spans two lines. Over the phone and showcase scenes the pill sits
// at the top of the safe zone (above the frame); everywhere else at its bottom.
import React, { useMemo } from 'react'
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from '@remotion/captions'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SAFE, rgba, useTheme } from './theme'
import type { Timeline } from './timeline'

type AbsPage = TikTokPage & { endMs: number; place: 'top' | 'bottom' | 'off' }

export const Captions: React.FC<{ timeline: Timeline; captions: Record<string, Caption[]>; hideIn: string[] }> = ({ timeline, captions, hideIn }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const nowMs = (frame / fps) * 1000

  const pages = useMemo(() => {
    const out: AbsPage[] = []
    for (const line of timeline.lines) {
      const caps = captions[line.id]
      if (!caps) continue
      const scene = timeline.scenes.find((s) => s.spec.id === line.sceneId)!
      const type = scene.spec.type
      const place = hideIn.includes(line.sceneId) ? 'off' : type === 'phone' || type === 'showcase' ? 'top' : 'bottom'
      const { pages: ps } = createTikTokStyleCaptions({ captions: caps, combineTokensWithinMilliseconds: 950 })
      ps.forEach((p, i) => {
        const next = ps[i + 1]
        out.push({
          ...p,
          startMs: p.startMs + line.startMs,
          tokens: p.tokens.map((tk) => ({ ...tk, fromMs: tk.fromMs + line.startMs, toMs: tk.toMs + line.startMs })),
          endMs: (next ? next.startMs : line.durationMs + 280) + line.startMs,
          place,
        })
      })
    }
    return out
  }, [timeline, captions, hideIn])

  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.endMs)
  if (!page || page.place === 'off') return null
  const inF = ((nowMs - page.startMs) / 1000) * fps
  const pop = spring({ frame: inF, fps, config: { damping: 16, stiffness: 220 } })
  const out = interpolate(page.endMs - nowMs, [0, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pos: React.CSSProperties = page.place === 'top' ? { top: SAFE.top + 10 } : { bottom: 1920 - SAFE.bottom + 12 }

  return (
    <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, display: 'flex', justifyContent: 'center', ...pos }}>
      <div
        style={{
          maxWidth: SAFE.right - SAFE.left,
          padding: '20px 34px 22px',
          borderRadius: 34,
          // the brand's ink, so it reads on the dark backdrop and over a bright app alike
          background: rgba(t.ink, 0.94),
          boxShadow: `0 14px 40px rgba(0,0,0,0.35), 0 0 0 1.5px ${rgba(t.paper, 0.2)}`,
          fontFamily: t.font,
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.16,
          letterSpacing: -0.6,
          color: t.paper,
          textAlign: 'center',
          opacity: out,
          transform: `scale(${0.92 + 0.08 * pop}) translateY(${(1 - pop) * 14}px)`,
        }}
      >
        {page.tokens.map((tk, i) => {
          const active = nowMs >= tk.fromMs && nowMs < tk.toMs
          const said = nowMs >= tk.toMs
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap', color: active ? t.accent : said ? t.paper : rgba(t.paper, 0.45) }}>
              {tk.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}
