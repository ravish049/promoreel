// A form screen: labelled fields, line items with amounts, a total and the primary button. fill: each field types its
// value in (with a focus ring), then the line items tick in one by one; count: the total rolls up; click / done: the
// button (idle → busy → done) and the head's badge turns to the done label.
import React from 'react'
import { EASE, enter, tween } from '../motion'
import { rgba } from '../reel/theme'
import type { FormScreen } from '../reel/spec'
import { countText, sec, stagger, typed } from './look'
import { AppButton, BUTTON_H, CardShell, Check, ColLabel, DW, GAP, HeadBadge, PAD, ScreenHead, Spacer, clip, headHeight, useClock, usePalette, type ScreenProps } from './parts'

const FIELD_H = 118
const WELL_H = 70
const ITEM_H = 92
const ITEM_GAP = 12
const TOTAL_H = 96
/** Seconds between one field starting to type and the next. */
const FIELD_STEP = 0.55

export const formHeight = (s: FormScreen) => {
  const head = headHeight(s)
  const items = s.items?.length ?? 0
  return (
    PAD * 2 +
    head +
    (head ? GAP : 0) +
    (s.fields?.length ?? 0) * FIELD_H +
    (items ? items * (ITEM_H + ITEM_GAP) + 6 : 0) +
    (s.total ? TOTAL_H : 0) +
    (s.button ? GAP + BUTTON_H : 0)
  )
}

export const Form: React.FC<ScreenProps<FormScreen>> = ({ spec, progress = {}, f: frame, width, height, flat, dw = DW }) => {
  const p = usePalette()
  const { f, fps } = useClock(frame)
  const { fill, count, click, done } = progress
  const fields = spec.fields ?? []
  const items = spec.items ?? []
  const fst = sec(FIELD_STEP, fps)
  const typeDur = sec(0.45, fps)
  const ist = stagger(items.length, fps)
  const itemsAt = fill === undefined ? undefined : fill + fields.length * fst
  const n = count === undefined ? 1 : tween(f, count, count + sec(1, fps), 0, 1, EASE.count)
  return (
    <CardShell natural={formHeight(spec)} width={width} height={height} dw={dw} flat={flat} sweepAt={done} f={f}>
      <ScreenHead spec={spec} right={<HeadBadge spec={spec} button={spec.button} f={f} done={done} />} />
      {headHeight(spec) ? <div style={{ height: GAP, flexShrink: 0 }} /> : null}
      {fields.map((fl, i) => {
        const at = fill === undefined ? undefined : fill + i * fst
        const k = at === undefined ? 1 : tween(f, at, at + typeDur, 0, 1)
        const focus = at !== undefined && f >= at && f < at + fst + (i === fields.length - 1 ? typeDur : 0) ? tween(f, at, at + sec(0.15, fps), 0, 1) : 0
        const value = typed(fl.value, k)
        const caret = focus > 0 && Math.floor((f - (at ?? 0)) / sec(0.3, fps)) % 2 === 0
        return (
          <div key={i} style={{ height: FIELD_H, flexShrink: 0 }}>
            <ColLabel>{fl.label}</ColLabel>
            <div
              style={{
                marginTop: 8,
                height: WELL_H,
                borderRadius: 16,
                border: `2px solid ${focus > 0 ? p.tint : p.separator}`,
                boxShadow: focus > 0 ? `0 0 0 ${5 * focus}px ${rgba(p.tint, 0.18)}` : 'none',
                background: p.card,
                display: 'flex',
                alignItems: 'center',
                padding: '0 22px',
                fontSize: 28,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            >
              <span style={clip}>{value}</span>
              {caret ? <span style={{ width: 3, height: 34, marginLeft: 2, background: p.tint, flexShrink: 0 }} /> : null}
            </div>
          </div>
        )
      })}
      {items.length ? <div style={{ height: 6, flexShrink: 0 }} /> : null}
      {items.map((it, i) => {
        const at = itemsAt === undefined ? undefined : itemsAt + i * ist
        const inP = at === undefined ? 1 : enter(f, at, sec(0.85, fps), fps)
        const tick = at === undefined ? 1 : tween(f, at + sec(0.13, fps), at + sec(0.5, fps), 0, 1, EASE.out)
        return (
          <div
            key={i}
            style={{
              height: ITEM_H,
              marginBottom: ITEM_GAP,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '0 20px',
              borderRadius: 18,
              boxSizing: 'border-box',
              border: `2px solid ${inP > 0.5 ? rgba(p.tint, 0.45) : p.separator}`,
              background: rgba(p.tint, 0.05 * inP),
              opacity: Math.min(1, 0.35 + inP),
              transform: `scale(${0.97 + 0.03 * inP})`,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: tick > 0 ? p.tint : p.card,
                border: tick > 0 ? 'none' : `2px solid ${p.label3}`,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {tick > 0 ? <Check size={28} draw={tick} color={p.onTint} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ ...clip, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{it.label}</div>
              {it.detail ? <div style={{ ...clip, fontSize: 24, fontWeight: 500, color: p.label2, lineHeight: 1.25 }}>{it.detail}</div> : null}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{it.amount}</div>
          </div>
        )
      })}
      {spec.total ? (
        <div style={{ height: TOTAL_H, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 20, borderTop: `2.5px solid ${p.label}`, boxSizing: 'border-box' }}>
          <div style={{ ...clip, flex: 1, fontSize: 32, fontWeight: 800 }}>{spec.total.label}</div>
          <div style={{ fontSize: 52, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -1.5, whiteSpace: 'nowrap' }}>{countText(spec.total.value, n)}</div>
        </div>
      ) : null}
      {spec.button ? (
        <>
          <Spacer />
          <AppButton spec={spec.button} f={f} click={click} done={done} />
        </>
      ) : null}
    </CardShell>
  )
}
