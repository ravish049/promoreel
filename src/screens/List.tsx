// A list screen: rows of avatar or icon, title, subtitle, a tag pill and a value. fill: rows slide in one by one;
// count: the values roll up; checkRows: each row gets a check disc in turn; click / done: the button.
import React from 'react'
import { EASE, enter, tween } from '../motion'
import { rgba } from '../reel/theme'
import type { ListScreen } from '../reel/spec'
import { countText, sec, stagger } from './look'
import { AppButton, Avatar, BUTTON_H, CardShell, CheckDisc, DW, GAP, HeadBadge, IconTile, PAD, Pill, ScreenHead, Spacer, clip, headHeight, useClock, usePalette, type ScreenProps } from './parts'

const ROW_H = 108

export const listHeight = (s: ListScreen) => {
  const head = headHeight(s)
  return PAD * 2 + head + (head ? GAP : 0) + s.rows.length * ROW_H + (s.button ? GAP + BUTTON_H : 0)
}

export const List: React.FC<ScreenProps<ListScreen>> = ({ spec, progress = {}, f: frame, width, height, flat, dw = DW }) => {
  const p = usePalette()
  const { f, fps } = useClock(frame)
  const st = stagger(spec.rows.length, fps)
  const { fill, count, checkRows, click, done } = progress
  const n = count === undefined ? 1 : tween(f, count, count + sec(1, fps), 0, 1, EASE.count)
  return (
    <CardShell natural={listHeight(spec)} width={width} height={height} dw={dw} flat={flat} sweepAt={done} f={f}>
      <ScreenHead spec={spec} right={<HeadBadge spec={spec} button={spec.button} f={f} done={done} />} />
      {headHeight(spec) ? <div style={{ height: GAP, flexShrink: 0 }} /> : null}
      {spec.rows.map((r, i) => {
        const inP = fill === undefined ? 1 : enter(f, fill + i * st, sec(0.9, fps), fps)
        const ck = checkRows === undefined ? undefined : checkRows + i * st
        const lit = ck === undefined ? 0 : tween(f, ck, ck + sec(0.4, fps), 0, 1, EASE.out)
        return (
          <div
            key={i}
            style={{
              height: ROW_H,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              borderTop: `1.5px solid ${p.separator}`,
              padding: '0 12px',
              margin: '0 -12px',
              borderRadius: 14,
              background: rgba(p.success, 0.07 * lit),
              opacity: Math.min(1, inP * 1.5),
              transform: `translateX(${(1 - inP) * 40}px)`,
            }}
          >
            {r.initials ? <Avatar initials={r.initials} size={64} index={i} /> : r.icon ? <IconTile icon={r.icon} size={64} /> : null}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ ...clip, fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{r.title}</div>
              {r.subtitle ? <div style={{ ...clip, fontSize: 24, fontWeight: 500, color: p.label2, lineHeight: 1.25 }}>{r.subtitle}</div> : null}
            </div>
            {r.tag ? (
              <Pill tone={r.tagTone ?? 'muted'} size={22}>
                {r.tag}
              </Pill>
            ) : null}
            {r.value ? (
              <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', flexShrink: 0 }}>{countText(r.value, n)}</div>
            ) : null}
            {checkRows !== undefined ? <CheckDisc f={f} at={ck} size={44} /> : null}
          </div>
        )
      })}
      {spec.button ? (
        <>
          <Spacer />
          <AppButton spec={spec.button} f={f} click={click} done={done} />
        </>
      ) : null}
    </CardShell>
  )
}
