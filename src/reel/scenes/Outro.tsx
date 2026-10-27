// FeatureGridOutro: the closing of every reel of a project (an `end` scene). On the dark backdrop: the logo and the title,
// a grid of the brand's features (brand.json → features, up to 15, three columns) popping in one after another, the
// tagline with its last words in the accent colour, then the call-to-action pill.
// Its voice is shared too (brand.outro.lines). The scene lasts those lines plus brand.outro.tailMs.
import React from 'react'
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Icon } from '../icons'
import { Logo } from '../parts'
import { SAFE, rgba, useTheme } from '../theme'
import type { EndScene } from '../spec'
import type { TLScene } from '../timeline'

const COLS = 3
const GAP_X = 16
const GAP_Y = 10
const TILE_W = (SAFE.right - SAFE.left - GAP_X * (COLS - 1)) / COLS
const TILE_H = 94
/** Tiles pop in this far apart (≈70 ms at 30 fps). */
const STAGGER_FRAMES = 2.1

export const FeatureGridOutro: React.FC<{ scene: TLScene & { spec: EndScene } }> = ({ scene }) => {
  const t = useTheme()
  // nothing moves until the crossfade into the outro is over
  const frame = useCurrentFrame() - 8
  const { fps } = useVideoConfig()
  const features = t.brand.features.slice(0, 15)
  const title = scene.spec.title ?? t.brand.outro.title
  const cta = scene.spec.cta ?? t.brand.outro.cta
  const tagline = t.brand.outro.tagline
  const pHead = spring({ frame, fps, config: { damping: 14, stiffness: 140 } })
  const pLogo = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 160 } })
  const rows = Math.ceil(features.length / COLS)
  // fewer rows sit lower, so the block stays centred in the safe zone
  const gridTop = SAFE.top + 112 + (5 - rows) * ((TILE_H + GAP_Y) / 2)
  const gridStart = 8
  const gridDone = gridStart + features.length * STAGGER_FRAMES
  const pTag = spring({ frame: frame - gridDone - 2, fps, config: { damping: 14, stiffness: 150 } })
  const pCta = spring({ frame: frame - gridDone - 10, fps, config: { damping: 12, stiffness: 150 } })
  const tagTop = gridTop + rows * TILE_H + (rows - 1) * GAP_Y + 20
  const ctaTop = tagTop + (tagline ? 76 : 10)

  return (
    <AbsoluteFill style={{ fontFamily: t.font }}>
      <div style={{ position: 'absolute', top: gridTop - 104, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, opacity: Math.min(1, pHead * 1.5), transform: `translateY(${(1 - pHead) * 30}px)` }}>
        <div style={{ borderRadius: 84 * 0.22, boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 0 1.5px ${rgba(t.paper, 0.25)}` }}>
          <Logo size={84} pop={pLogo} />
        </div>
        <div style={{ fontSize: title.length > 24 ? 50 : 60, fontWeight: 850, letterSpacing: -1.8, color: t.paper }}>{title}</div>
      </div>

      {features.map((f, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        // a short last row is centred
        const inRow = row === rows - 1 ? features.length - row * COLS : COLS
        const shift = ((COLS - inRow) * (TILE_W + GAP_X)) / 2
        const p = spring({ frame: frame - gridStart - i * STAGGER_FRAMES, fps, config: { damping: 13, stiffness: 190, mass: 0.7 } })
        return (
          <div
            key={f.label}
            style={{
              position: 'absolute',
              left: SAFE.left + shift + col * (TILE_W + GAP_X),
              top: gridTop + row * (TILE_H + GAP_Y),
              width: TILE_W,
              height: TILE_H,
              boxSizing: 'border-box',
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderRadius: 26,
              background: rgba(t.paper, 0.11),
              border: `1.5px solid ${rgba(t.paper, 0.4)}`,
              backdropFilter: 'blur(14px)',
              boxShadow: '0 10px 26px rgba(0,0,0,0.28)',
              opacity: Math.min(1, p * 1.8),
              transform: `scale(${0.6 + 0.4 * p})`,
            }}
          >
            <Icon name={f.icon} size={40} color={t.accent} stroke={2.1} />
            <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.3, color: t.paper }}>
              {/* non-breaking hyphens: "bi-weekly" wraps at the space, never at the hyphen */}
              {f.label.replace(/-/g, '‑')}
            </div>
          </div>
        )
      })}

      {tagline && (
        <div style={{ position: 'absolute', top: tagTop, left: SAFE.left, right: 1080 - SAFE.right, textAlign: 'center', fontSize: 46, fontWeight: 800, letterSpacing: -1, color: t.paper, opacity: Math.min(1, pTag * 1.5), transform: `translateY(${(1 - pTag) * 24}px)` }}>
          {tagline[0]} <span style={{ color: t.accent }}>{tagline[1]}</span>
        </div>
      )}

      <div style={{ position: 'absolute', top: ctaTop, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            padding: '20px 48px',
            borderRadius: 999,
            background: t.accent,
            color: t.ink,
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: -0.8,
            boxShadow: `0 18px 48px ${rgba(t.accent, 0.45)}`,
            opacity: Math.min(1, pCta * 1.5),
            transform: `translateY(${(1 - pCta) * 30}px) scale(${(0.9 + 0.1 * pCta) * (1 + 0.015 * Math.sin(Math.max(0, frame - 60) / 7))})`,
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  )
}
