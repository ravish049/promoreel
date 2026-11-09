// A stat screen: one big number on the Odometer, with an optional prefix and suffix, and a label under it. count: the
// number rolls from `from` to `value` over a second; done: it turns to the success colour, the label gets a check and
// the card its light sweep.
import React from 'react'
import { EASE, Odometer, mixColor, tween } from '../motion'
import { rgba } from '../reel/theme'
import type { StatScreen } from '../reel/spec'
import { sec } from './look'
import { CardShell, Check, DW, GAP, PAD, ScreenHead, clip, headHeight, useClock, usePalette, type ScreenProps } from './parts'

const LABEL_H = 56

const digitsOf = (s: StatScreen) => Math.max(1, String(Math.round(Math.abs(s.value))).length, String(Math.round(Math.abs(s.from ?? 0))).length)

/** The number's font size: 200, or smaller so the digits, prefix and suffix fit the width. */
const numberSize = (s: StatScreen, dw: number) => {
  const em = 0.62 * digitsOf(s) + 0.32 * ((s.prefix?.length ?? 0) + (s.suffix?.length ?? 0))
  return Math.min(200, Math.floor((dw - PAD * 2 - 24) / em))
}

export const statHeight = (s: StatScreen, dw = DW) => {
  const head = headHeight(s)
  return PAD * 2 + head + (head ? GAP : 0) + 48 + Math.ceil(numberSize(s, dw) * 1.12) + 20 + LABEL_H + 32
}

export const Stat: React.FC<ScreenProps<StatScreen>> = ({ spec, progress = {}, f: frame, width, height, flat, dw = DW }) => {
  const p = usePalette()
  const { f, fps } = useClock(frame)
  const { count, done } = progress
  const from = spec.from ?? 0
  const roll = count === undefined ? 1 : tween(f, count, count + sec(1, fps), 0, 1, EASE.count)
  const value = from + (spec.value - from) * roll
  const size = numberSize(spec, dw)
  const ok = done === undefined ? 0 : tween(f, done, done + sec(0.3, fps), 0, 1, EASE.out)
  const color = mixColor(p.label, p.tone('success').fg, ok)
  const rolling = count !== undefined && f >= count && roll < 1 ? 1 : 0
  const affix: React.CSSProperties = { fontSize: size * 0.5, fontWeight: 800, color, whiteSpace: 'nowrap', lineHeight: 1 }
  return (
    <CardShell natural={statHeight(spec, dw)} width={width} height={height} dw={dw} flat={flat} sweepAt={done} f={f}>
      <ScreenHead spec={spec} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {spec.prefix ? <div style={affix}>{spec.prefix}</div> : null}
          <Odometer value={Math.abs(value)} digits={digitsOf(spec)} size={size} color={color} glow={rgba(p.tint, 0.22 * rolling)} />
          {spec.suffix ? <div style={affix}>{spec.suffix}</div> : null}
        </div>
        <div style={{ height: LABEL_H, display: 'flex', alignItems: 'center', gap: 12, maxWidth: '100%' }}>
          {ok > 0 ? <Check size={40} draw={tween(f, done!, done! + sec(0.45, fps), 0, 1, EASE.out)} color={p.tone('success').fg} stroke={3.4} /> : null}
          <div style={{ ...clip, fontSize: 34, fontWeight: 700, color: p.label2 }}>{spec.label}</div>
        </div>
      </div>
    </CardShell>
  )
}
