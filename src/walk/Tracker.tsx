// The step tracker, in two parts that list only the steps of this cut, in its order:
// - the step pill at the top of the safe zone: a dot per step and the current step's label ("Step 2 of 4 · Hours", or
//   just the label). At each cut the old label fades out, then the new one fades in while the pill eases to its width,
//   so two labels never overlap.
// - a soft row in the lower third (non-essential, clear of Instagram's buttons on the right): each step's icon and label;
//   finished steps turn to the success colour with a check, the current one gets an accent ring.
// Both leave before the close, so nothing of them shows with the logo and the call to action.
import React from 'react'
import { EASE, enter, tween } from '../motion'
import { Icon } from '../reel/icons'
import { SAFE, rgba, useTheme } from '../reel/theme'
import { CheckDisc, usePalette } from '../screens'
import { at60, chainPos, type WalkPlan } from './plan'
import { fitSize, textWidth, useWalk } from './context'

/** The lower-third row: icon centre y, the x span left of Instagram's button column. */
export const ROW = { y: 1556, left: 62, right: 842, icon: 88, slotMax: 200 }
const PILL = { h: 62, pad: 28, gap: 18, dot: 12, dotWide: 32, dotGap: 8, font: 30 }

/** The tracker's visibility: in as the camera lands on the first step, out (eased) before the close. */
const visibility = (plan: WalkPlan, g: number) => {
  const F = (n: number) => at60(n, plan.fps)
  const start = plan.hook ? plan.hook.dive[1] - F(12) : 0
  return tween(g, start, start + F(18), 0, 1, EASE.out) * (1 - tween(g, plan.trackerOut, plan.trackerOut + F(18), 0, 1, EASE.in))
}

/** The crossfade at each cut: which step's label is shown, and how far the change has run (0 → 1). */
const labelState = (plan: WalkPlan, g: number) => {
  const F = (n: number) => at60(n, plan.fps)
  let idx = 0
  for (const s of plan.steps) if (g >= s.scene.from - F(14)) idx = s.index
  const from = plan.steps[idx].scene.from
  const a = from - F(14)
  const mid = from - F(4)
  const b = from + F(10)
  if (idx === 0) return { idx, prev: -1, outP: 1, inP: 1, w: 1 }
  return { idx, prev: idx - 1, outP: tween(g, a, mid, 0, 1, EASE.in), inP: tween(g, mid, b, 0, 1, EASE.out), w: tween(g, a, b, 0, 1, EASE.inOut) }
}

export const StepPill: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const { plan, spec } = useWalk()
  const vis = visibility(plan, g)
  if (vis <= 0) return null
  const steps = plan.steps
  const n = steps.length
  const numbered = (spec.cuts[spec.cut].tracker ?? 'numbered') === 'numbered'
  const { idx, prev, outP, inP, w } = labelState(plan, g)
  const dotsW = n * PILL.dot + (PILL.dotWide - PILL.dot) + (n - 1) * PILL.dotGap
  const maxLabel = SAFE.right - SAFE.left - PILL.pad * 2 - dotsW - PILL.gap
  const prefix = (k: number) => (numbered ? `Step ${k + 1} of ${n} · ` : '')
  const fullText = (k: number) => prefix(k) + steps[k].label
  // one size for every label of the cut, so the type doesn't change size between steps
  const size = Math.min(...steps.map((_, k) => fitSize(fullText(k), maxLabel, PILL.font, 700, t.font)))
  const widthOf = (k: number) => Math.ceil(textWidth(fullText(k), size, 700, t.font)) + 2
  const labelW = prev < 0 ? widthOf(idx) : widthOf(prev) + (widthOf(idx) - widthOf(prev)) * w
  const label = (k: number, opacity: number, dy: number) => (
    <div style={{ position: 'absolute', left: '50%', top: 0, transform: `translate(-50%, ${dy}px)`, opacity, whiteSpace: 'nowrap' }}>
      {prefix(k)}
      <span style={{ color: t.accent }}>{steps[k].label}</span>
    </div>
  )
  return (
    <div style={{ position: 'absolute', left: SAFE.left, right: 1080 - SAFE.right, top: SAFE.top + 4, display: 'flex', justifyContent: 'center', opacity: vis, transform: `translateY(${(1 - vis) * -12}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: PILL.gap, height: PILL.h, padding: `0 ${PILL.pad}px`, borderRadius: 99, background: t.ink, boxShadow: `0 8px 20px ${rgba(t.ink, 0.22)}`, fontFamily: t.font, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: PILL.dotGap, flexShrink: 0 }}>
          {steps.map((s, i) => {
            const wide = i === idx ? (prev < 0 ? 1 : w) : i === prev ? 1 - w : 0
            const isDone = g >= s.done
            const bg = isDone ? t.success : i === idx || i === prev ? t.accent : rgba(t.paper, 0.3)
            return <div key={s.id} style={{ width: PILL.dot + (PILL.dotWide - PILL.dot) * wide, height: PILL.dot, borderRadius: PILL.dot / 2, background: bg }} />
          })}
        </div>
        <div style={{ position: 'relative', width: labelW, height: size * 1.34, fontSize: size, lineHeight: `${size * 1.34}px`, fontWeight: 700, color: t.paper, flexShrink: 0 }}>
          {prev >= 0 && outP < 1 ? label(prev, 1 - outP, -outP * 6) : null}
          {label(idx, inP, (1 - inP) * 6)}
        </div>
      </div>
    </div>
  )
}

export const TrackerRow: React.FC<{ g: number }> = ({ g }) => {
  const t = useTheme()
  const p = usePalette()
  const { plan } = useWalk()
  const F = (n: number) => at60(n, plan.fps)
  const vis = visibility(plan, g)
  if (vis <= 0) return null
  const steps = plan.steps
  const n = steps.length
  const slot = Math.min(ROW.slotMax, (ROW.right - ROW.left) / n)
  const mid = (ROW.left + ROW.right) / 2
  const x0 = mid - (slot * n) / 2 + slot / 2
  const x1 = x0 + slot * (n - 1)
  const first = steps[0]
  const appear = plan.hook ? plan.hook.dive[1] - F(14) : -F(10)
  const cur = (() => {
    let k = 0
    for (const s of steps) if (g >= s.scene.from) k = s.index
    return k
  })()
  const draw = n > 1 && g >= first.scene.from ? chainPos(plan, g) / (n - 1) : 0
  const labelSize = Math.min(...steps.map((s) => fitSize(s.label, slot - 10, 24, 700, t.font)))
  const size = ROW.icon
  return (
    <div style={{ position: 'absolute', left: 0, top: ROW.y - size / 2, width: 1080, height: size + 50, opacity: vis, transform: `translateY(${(1 - vis) * 24}px)` }}>
      {n > 1 ? (
        <>
          <div style={{ position: 'absolute', left: x0, width: x1 - x0, top: size / 2 - 3, height: 6, borderRadius: 3, background: rgba(t.ink, 0.14) }} />
          <div style={{ position: 'absolute', left: x0, width: (x1 - x0) * draw, top: size / 2 - 3, height: 6, borderRadius: 3, background: t.accent, opacity: 0.85 }} />
        </>
      ) : null}
      {steps.map((s, i) => {
        const pop = enter(g, appear + i * F(4), F(26), plan.fps)
        const isDone = g >= s.done
        const isCur = i === cur && !isDone && g >= s.scene.from - F(4)
        const lit = isCur ? enter(g, s.scene.from - F(4), F(24), plan.fps) : 0
        const ahead = !isDone && !isCur
        const color = isDone ? t.success : isCur ? t.accent : p.label3
        return (
          <div key={s.id} style={{ position: 'absolute', left: x0 + slot * i - slot / 2, top: 0, width: slot, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, pop * 1.6), transform: `scale(${0.6 + 0.4 * pop})` }}>
            <div
              style={{
                position: 'relative',
                width: size,
                height: size,
                borderRadius: size,
                background: isDone ? p.tone('success').bg : p.card,
                boxShadow: `${p.shadowSmall}${isCur ? `, 0 0 0 ${6 * lit}px ${rgba(t.accent, 0.4)}` : ''}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${1 + 0.12 * lit})`,
              }}
            >
              <div style={{ opacity: ahead ? 0.75 : 1, display: 'flex' }}>
                <Icon name={s.icon} size={size * 0.46} color={color} stroke={2.3} />
              </div>
              <div style={{ position: 'absolute', right: -6, top: -6 }}>
                <CheckDisc f={g} at={s.done} size={34} />
              </div>
            </div>
            <div style={{ marginTop: 8, fontFamily: t.font, fontSize: labelSize, fontWeight: 700, color: isDone ? p.tone('success').fg : isCur ? t.ink : p.label2, opacity: ahead ? 0.8 : 1, whiteSpace: 'nowrap' }}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}
