// The cursor travels on arcs, eases in and out, settles with a tiny overshoot and never quite stops. A `hesitate` stop
// adds a small undecided side-to-side wobble until the next move, like a hand pausing between tabs. A click presses the
// arrow and sends out a ring in the theme's highlight colour.
import React from 'react'
import { interpolate } from 'remotion'
import { rgba, useTheme } from '../reel/theme'
import { TRAVEL, arc, drift, press } from './motion'

export type Move = {
  /** frame the move starts */
  at: number
  /** frames it takes */
  dur: number
  to: [number, number]
  /** how far the path bows off the straight line (0.15 by default) */
  bend?: number
  /** wobble undecided at this stop until the next move */
  hesitate?: boolean
}

/** Where the cursor tip is at frame `f`. The first move is the start position. */
export const cursorAt = (f: number, moves: readonly Move[]): [number, number] => {
  if (!moves.length) throw new Error('cursorAt() needs at least one move')
  let pos: [number, number] = moves[0].to
  let hold = moves[0]
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i]
    if (f < m.at) break
    const t = TRAVEL(Math.min(1, (f - m.at) / m.dur))
    pos = arc(moves[i - 1].to, m.to, t, m.bend ?? 0.15)
    hold = m
  }
  const next = moves.find((m) => m.at > f)
  const settled = f - (hold.at + hold.dur)
  if (settled > 0) {
    // the hand never fully stops
    let dx = drift(f, 1.5, 140)
    let dy = drift(f, 1.2, 190, 1)
    if (hold.hesitate) {
      // eases in, wobbles, eases out before the next move starts
      const room = next ? next.at - (hold.at + hold.dur) : 30
      const env = Math.sin(Math.min(1, settled / room) * Math.PI)
      dx += Math.sin(settled / 5.5) * 9 * env
      dy += Math.sin(settled / 8) * 4 * env
    }
    pos = [pos[0] + dx, pos[1] + dy]
  }
  return pos
}

/** The arrow (ink, outlined in paper) at the cursor position, in the current coordinate space. */
export const Cursor: React.FC<{ f: number; moves: readonly Move[]; clicks: readonly number[]; opacity?: number; size?: number }> = ({
  f,
  moves,
  clicks,
  opacity = 1,
  size = 40,
}) => {
  const t = useTheme()
  const [x, y] = cursorAt(f, moves)
  const s = clicks.reduce((acc, c) => acc * press(f, c), 1)
  const last = [...clicks].reverse().find((c) => f >= c)
  const ring = last === undefined ? 1 : Math.min(1, (f - last) / 18)
  const r = size * 0.6
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, opacity, zIndex: 50 }}>
      {last !== undefined && ring < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: -r,
            top: -r,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            border: `${Math.max(2, size * 0.075)}px solid ${rgba(t.highlight, 0.8)}`,
            transform: `scale(${interpolate(ring, [0, 1], [0.3, 1.4])})`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: -size * 0.2,
          top: -size * 0.1,
          transformOrigin: `${size * 0.2}px ${size * 0.1}px`,
          transform: `scale(${s})`,
          filter: `drop-shadow(0 ${size * 0.1}px ${size * 0.15}px ${rgba(t.ink, 0.35)})`,
          overflow: 'visible',
        }}
      >
        <path d="M4.8 2.4 L4.8 19.6 L9.1 15.6 L12 22 L14.9 20.7 L12.1 14.5 L18 14.5 Z" fill={t.ink} stroke={t.paper} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  )
}
