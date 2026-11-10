// A table screen: columns and rows, with an optional compare of two columns (a diff pill on rows that differ, a check
// disc on rows that match). fill: a scan line reads the rows in; checkRows: discs and diff pills land row by row;
// count: numbers roll up; click / done: the button.
import React from 'react'
import { EASE, enter, tween } from '../motion'
import { rgba } from '../reel/theme'
import type { TableScreen } from '../reel/spec'
import { countText, diffText } from './look'
import { COUNT_S, TABLE_CHECK_S, scanSeconds, sec, stagger } from './timing'
import { AppButton, BUTTON_H, CardShell, CheckDisc, ColLabel, DW, GAP, HeadBadge, PAD, Pill, ScreenHead, Spacer, clip, headHeight, useClock, usePalette, type ScreenProps } from './parts'

const HEAD_ROW = 44
const ROW_H = 78
const SUMMARY = 58
const STATUS_W = 150

export const tableHeight = (s: TableScreen) => {
  const head = headHeight(s)
  return PAD * 2 + head + (head ? GAP : 0) + HEAD_ROW + s.rows.length * ROW_H + (s.summary ? SUMMARY : 0) + (s.button ? GAP + BUTTON_H : 0)
}

export const Table: React.FC<ScreenProps<TableScreen>> = ({ spec, progress = {}, f: frame, width, height, flat, dw = DW }) => {
  const p = usePalette()
  const { f, fps } = useClock(frame)
  const { fill, count, checkRows, click, done } = progress
  const rows = spec.rows.length
  const st = stagger(rows, fps)
  const cmp = spec.compare
  const status = cmp !== undefined || checkRows !== undefined
  const cols = `minmax(0, 1.5fr) ${spec.columns
    .slice(1)
    .map(() => 'minmax(0, 1fr)')
    .join(' ')}${status ? ` ${STATUS_W}px` : ''}`
  const scanDur = sec(scanSeconds(rows), fps)
  const scan = fill === undefined ? 1 : tween(f, fill, fill + scanDur, 0, 1, EASE.inOut)
  const n = count === undefined ? 1 : tween(f, count, count + sec(COUNT_S, fps), 0, 1, EASE.count)
  const differs = (r: string[]) => cmp !== undefined && (r[cmp.columns[0]] ?? '') !== (r[cmp.columns[1]] ?? '')
  return (
    <CardShell natural={tableHeight(spec)} width={width} height={height} dw={dw} flat={flat} sweepAt={done} f={f}>
      <ScreenHead spec={spec} right={<HeadBadge spec={spec} button={spec.button} f={f} done={done} />} />
      {headHeight(spec) ? <div style={{ height: GAP, flexShrink: 0 }} /> : null}
      <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 18, alignItems: 'center', height: HEAD_ROW, flexShrink: 0 }}>
        {spec.columns.map((c, i) => (
          <ColLabel key={i} style={{ textAlign: i === 0 ? 'left' : 'right' }}>
            {c}
          </ColLabel>
        ))}
        {status ? <div /> : null}
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {spec.rows.map((r, i) => {
          const read = scan * rows > i + 0.5
          const ck = checkRows === undefined ? undefined : checkRows + i * st
          const off = differs(r)
          const lit = off && ck !== undefined ? tween(f, ck, ck + sec(0.4, fps), 0, 1, EASE.out) : 0
          const diffTone = p.tone(p.diff)
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: cols,
                columnGap: 18,
                alignItems: 'center',
                height: ROW_H,
                borderTop: `1.5px solid ${p.separator}`,
                padding: '0 12px',
                margin: '0 -12px',
                borderRadius: 12,
                background: rgba(diffTone.solid, 0.12 * lit),
              }}
            >
              {spec.columns.map((_, c) => {
                const v = r[c] ?? ''
                const isB = cmp !== undefined && c === cmp.columns[1]
                if (c > 0 && !read)
                  return (
                    <div key={c} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ width: '60%', height: 14, borderRadius: 7, background: p.grouped }} />
                    </div>
                  )
                return (
                  <div
                    key={c}
                    style={{
                      ...clip,
                      fontSize: 28,
                      fontWeight: c === 0 ? 700 : isB && off ? 800 : 600,
                      color: isB && !off ? p.label2 : p.label,
                      textAlign: c === 0 ? 'left' : 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c === 0 ? v : countText(v, n)}
                  </div>
                )
              })}
              {status ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {off ? (
                    ck !== undefined && f >= ck ? (
                      <div style={{ transform: `scale(${enter(f, ck, sec(TABLE_CHECK_S, fps), fps)})`, transformOrigin: 'right center' }}>
                        <Pill tone={p.diff} size={24} dot>
                          {cmp?.diffLabel ?? diffText(r[cmp!.columns[0]] ?? '', r[cmp!.columns[1]] ?? '') ?? '≠'}
                        </Pill>
                      </div>
                    ) : null
                  ) : (
                    <CheckDisc f={f} at={ck} size={44} />
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
        {scan > 0 && scan < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: -20,
              right: -20,
              top: scan * rows * ROW_H - 64,
              height: 70,
              background: `linear-gradient(180deg, ${rgba(p.tint, 0)} 0%, ${rgba(p.tint, 0.12)} 80%, ${rgba(p.tint, 0.4)} 100%)`,
              borderBottom: `4px solid ${p.tint}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {spec.summary ? (
        <div style={{ ...clip, height: SUMMARY, flexShrink: 0, boxSizing: 'border-box', paddingTop: 18, lineHeight: '36px', borderTop: `1.5px solid ${p.separator}`, fontSize: 24, fontWeight: 600, color: p.label2 }}>
          {spec.summary}
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
