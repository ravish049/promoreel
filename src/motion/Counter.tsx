// An odometer counter: every digit is a rolling column, so the value always moves continuously and never jumps in a
// single frame. The Counter card's glow crossfades between two theme colours as `ok` goes 0 → 1 (by default the accent
// for "work left" to success for "done").
import React from 'react'
import { glowColor, rgba, useTheme } from '../reel/theme'

type Rgb = [number, number, number]

const rgbOf = (hex: string): Rgb => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hexOf = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** a → b by t (0–1), both #rgb or #rrggbb; returns #rrggbb. */
export const mixColor = (a: string, b: string, t: number) => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  const k = Math.min(1, Math.max(0, t))
  return hexOf(x.map((v, i) => v + (y[i] - v) * k) as Rgb)
}

/** The position of the rolling column for place p (0 = ones) at value v: whole steps, plus a smooth carry. */
const placePos = (v: number, p: number) => {
  if (p === 0) return v
  const unit = 10 ** p
  const carry = Math.min(1, Math.max(0, (v % unit) - (unit - 1)))
  return Math.floor(v / unit) + carry
}

/**
 * The rolling number. `digits` columns are always laid out (so the width never changes); leading zeros fade in only
 * when the value reaches them. `value` may be fractional: that is what makes the digits roll.
 */
export const Odometer: React.FC<{ value: number; digits: number; size: number; color: string; glow: string; weight?: number }> = ({
  value,
  digits,
  size,
  color,
  glow,
  weight = 800,
}) => {
  const t = useTheme()
  const v = Math.min(Math.max(0, value), 10 ** digits - 1)
  const h = size * 1.12
  const w = size * 0.62
  return (
    // the glow is a drop-shadow on the parent, applied after the digit columns are clipped, so it never shows a box
    <div style={{ filter: `drop-shadow(0 0 ${size * 0.18}px ${glow})` }}>
      <div style={{ display: 'flex', height: h, overflow: 'hidden', fontFamily: t.font, fontWeight: weight, fontSize: size, color }}>
        {Array.from({ length: digits }, (_, i) => digits - 1 - i).map((p) => {
          const pos = placePos(v, p) % 10
          const show = p === 0 ? 1 : Math.min(1, Math.max(0, v - (10 ** p - 1)))
          return (
            <div key={p} style={{ width: w, height: h, position: 'relative', opacity: show }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: w, transform: `translateY(${-pos * h}px)` }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, k) => (
                  <div key={k} style={{ height: h, lineHeight: `${h}px`, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type GlowName = 'accent' | 'highlight' | 'success'

/** The counter as a card: label above, the rolling number below, a soft glow behind. */
export const Counter: React.FC<{
  value: number
  digits: number
  label: string
  /** 0 → 1: the glow moves from `from` to `to` */
  ok?: number
  from?: GlowName
  to?: GlowName
  /** a dark card for dark scenes (paper number), or a light tint for light ones (number in the glow colour) */
  surface?: 'dark' | 'light'
  size?: number
  width?: number
}> = ({ value, digits, label, ok = 0, from = 'accent', to = 'success', surface = 'dark', size = 72, width = 340 }) => {
  const t = useTheme()
  const c = mixColor(glowColor(from, t), glowColor(to, t), ok)
  const dark = surface === 'dark'
  const pad = dark ? 26 : 22
  const numColor = dark ? t.paper : mixColor(c, t.ink, 0.2)
  const glowW = size * (0.62 * digits + 0.74)
  return (
    <div style={{ position: 'relative', width, fontFamily: t.font }}>
      <div
        style={{
          position: 'absolute',
          // centred behind the right-aligned number
          right: pad + size * 0.31 * digits - glowW / 2,
          top: '62%',
          width: glowW,
          height: size * 1.5,
          transform: 'translateY(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${rgba(c, dark ? 0.5 : 0.16)}, ${rgba(c, 0)})`,
          filter: 'blur(14px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: dark ? '18px 26px 14px' : '14px 22px 10px',
          borderRadius: 22,
          background: dark ? rgba(t.ink, 0.72) : rgba(c, 0.06),
          border: `1.5px solid ${rgba(c, dark ? 0.45 : 0.28)}`,
          boxShadow: `0 0 36px ${rgba(c, dark ? 0.28 : 0.16)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: size * 0.27,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: dark ? rgba(t.paper, 0.72) : rgba(t.ink, 0.6),
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ width: size * 0.13, height: size * 0.13, borderRadius: 99, background: c }} />
          {label}
        </div>
        <Odometer value={value} digits={digits} size={size} color={numColor} glow={rgba(c, dark ? 0.55 : 0.3)} />
      </div>
    </div>
  )
}
