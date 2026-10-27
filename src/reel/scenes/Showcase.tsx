// A finished video in a rounded frame: the result of the steps before it, a before/after, another reel. It plays muted
// (the reel's own voice talks over it) and lasts as long as the scene's lines.
import React from 'react'
import { Video } from '@remotion/media'
import { AbsoluteFill, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { rgba, useTheme } from '../theme'
import type { ShowcaseScene } from '../spec'
import type { TLScene } from '../timeline'

const FRAME_W = 680
const FRAME_H = Math.round((FRAME_W * 16) / 9)
const FRAME_TOP = 520

export const ShowcaseView: React.FC<{ scene: TLScene & { spec: ShowcaseScene } }> = ({ scene }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = scene.spec
  const enter = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 120 } })
  const pLabel = spring({ frame: frame - 14, fps, config: { damping: 12, stiffness: 170 } })
  const drift = 1 + 0.03 * (frame / Math.max(1, scene.durationFrames))

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: (1080 - FRAME_W) / 2,
          top: FRAME_TOP,
          width: FRAME_W,
          height: FRAME_H,
          borderRadius: 54,
          overflow: 'hidden',
          background: '#000',
          boxShadow: `0 60px 140px rgba(0,0,0,0.6), 0 0 0 3px ${rgba(t.paper, 0.3)}, 0 0 90px ${rgba(t.accent, 0.18)}`,
          transform: `translateY(${(1 - enter) * 480}px) rotate(${(1 - enter) * 4}deg) scale(${(0.9 + 0.1 * enter) * drift})`,
          transformOrigin: '50% 30%',
        }}
      >
        <Video src={staticFile(s.src)} trimBefore={Math.round(((s.fromMs ?? 0) / 1000) * fps)} playbackRate={s.rate ?? 1} muted objectFit="cover" style={{ width: '100%', height: '100%' }} />
      </div>
      {s.label && (
        <div style={{ position: 'absolute', top: FRAME_TOP - 34, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              padding: '14px 34px',
              borderRadius: 999,
              background: t.accent,
              color: t.ink,
              fontFamily: t.font,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -0.6,
              boxShadow: `0 14px 36px ${rgba(t.accent, 0.45)}`,
              opacity: Math.min(1, pLabel * 1.5),
              transform: `scale(${0.7 + 0.3 * pLabel})`,
            }}
          >
            {s.label}
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}
