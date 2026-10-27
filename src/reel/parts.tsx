// Small shared pieces: the brand's logo tile, springs.
import React from 'react'
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { useTheme } from './theme'

/** The brand's logo (brand.logo in public/), or a tile with the name's first letter. `pop` 0→1 scales it in. */
export const Logo: React.FC<{ size: number; pop?: number; radius?: number }> = ({ size, pop = 1, radius = 0.22 }) => {
  const t = useTheme()
  const s = 0.6 + 0.4 * pop
  const style: React.CSSProperties = { width: size, height: size, borderRadius: size * radius, display: 'block', transform: `scale(${s})`, opacity: Math.min(1, pop * 1.5) }
  if (t.brand.logo) return <Img src={staticFile(t.brand.logo)} style={{ ...style, objectFit: 'contain' }} />
  return (
    <div style={{ ...style, background: t.accent, color: t.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: t.font, fontWeight: 900, fontSize: size * 0.56 }}>
      {t.brand.name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

/** A spring that starts at `delayFrames`. */
export function useSpring(delayFrames: number, config: { damping?: number; stiffness?: number; mass?: number } = { damping: 14, stiffness: 140 }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delayFrames, fps, config })
}

export const fadeUp = (p: number, dist = 60): React.CSSProperties => ({
  opacity: interpolate(p, [0, 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  transform: `translateY(${(1 - p) * dist}px)`,
})

/** Words straight on the backdrop. */
export const onPhoto: React.CSSProperties = { textShadow: '0 4px 28px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)' }
