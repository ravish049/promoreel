// A phone frame around one of the card screens, with an optional big round action button and a tab bar. The phone is
// laid out PW × PH design pixels and scaled to fit (centred in) the box it is given. With an action, click presses it
// (a tap ripple, then a spinner) and done turns it to its done state; the screen inside gets every other action.
import React from 'react'
import { EASE, enter, mixColor, press, tween } from '../motion'
import { Icon } from '../reel/icons'
import { rgba, useTheme } from '../reel/theme'
import type { PhoneScreen } from '../reel/spec'
import { sec } from './look'
import { InnerView, innerTarget } from './inner'
import { Check, Spinner, clip, useClock, usePalette, type ScreenProps } from './parts'

/** The phone's design size, bezel and bands. */
export const PW = 600
export const PH = 1240
const BEZEL = 16
const STATUS_H = 66
const ACTION_H = 280
const TABS_H = 128
const DISC = 188
/** The design width the wrapped screen is laid out at (narrower than a card, so its type stays readable). */
const INNER_DW = 640

const SW = PW - BEZEL * 2
const SH = PH - BEZEL * 2

const innerH = (s: PhoneScreen) => SH - STATUS_H - (s.action ? ACTION_H : 0) - (s.tabs?.length ? TABS_H : 0)

/** Where the phone sits in a width × height box: its scale and top-left offset. */
export const phoneFit = (width = PW, height = PH) => {
  const u = Math.min(width / PW, height / PH)
  return { u, x: (width - PW * u) / 2, y: (height - PH * u) / 2 }
}

/** The click target: the action button's centre, else the wrapped screen's button, in box pixels (or null). */
export const phoneTarget = (s: PhoneScreen, width = PW, height = PH): [number, number] | null => {
  const { u, x, y } = phoneFit(width, height)
  const top = BEZEL + STATUS_H
  if (s.action) return [x + u * (PW / 2), y + u * (top + innerH(s) + ACTION_H / 2)]
  const t = innerTarget(s.screen, SW, innerH(s), { dw: INNER_DW, flat: true })
  return t ? [x + u * (BEZEL + t[0]), y + u * (top + t[1])] : null
}

const StatusBar: React.FC<{ time: string }> = ({ time }) => {
  const p = usePalette()
  const t = useTheme()
  return (
    <div style={{ height: STATUS_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 44px 0', fontSize: 25, fontWeight: 700, color: p.label, flexShrink: 0, position: 'relative' }}>
      <span style={{ width: 90 }}>{time}</span>
      <div style={{ position: 'absolute', left: SW / 2 - 66, top: 14, width: 132, height: 38, borderRadius: 19, background: t.ink }} />
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: 90, justifyContent: 'flex-end' }}>
        {[10, 14, 18, 22].map((h) => (
          <span key={h} style={{ width: 6, height: h, background: p.label, borderRadius: 2 }} />
        ))}
        <span style={{ width: 38, height: 20, marginLeft: 8, borderRadius: 6, border: `2.5px solid ${p.label}`, boxSizing: 'border-box', padding: 2, alignSelf: 'center' }}>
          <span style={{ display: 'block', width: '70%', height: '100%', borderRadius: 2, background: p.label }} />
        </span>
      </span>
    </div>
  )
}

const ActionButton: React.FC<{ action: NonNullable<PhoneScreen['action']>; f: number; click?: number; done?: number }> = ({ action, f, click, done }) => {
  const p = usePalette()
  const { fps } = useClock(f)
  const ok = done !== undefined && f >= done
  const busy = !ok && click !== undefined && f >= click + sec(0.13, fps) && done !== undefined
  const k = done === undefined ? 0 : tween(f, done, done + sec(0.25, fps), 0, 1, EASE.out)
  const bg = mixColor(p.tint, p.success, k)
  const fg = k > 0.5 ? p.onSuccess : p.onTint
  const pop = ok ? enter(f, done, sec(0.7, fps), fps) : 1
  const scale = (click === undefined ? 1 : press(f, click, sec(0.3, fps))) * (0.94 + 0.06 * pop)
  // an idle pulse until it is pressed, then one tap ripple
  const period = sec(1.6, fps)
  const pulse = click !== undefined && f >= click ? -1 : (f % period) / period
  const tap = click !== undefined && f >= click ? Math.min(1, (f - click) / sec(0.6, fps)) : 1
  return (
    <div style={{ height: ACTION_H, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderTop: `1.5px solid ${p.separator}` }}>
      {pulse >= 0 && !ok ? (
        <div style={{ position: 'absolute', width: DISC, height: DISC, borderRadius: DISC, border: `5px solid ${rgba(p.tint, 0.45 * (1 - pulse))}`, transform: `scale(${1 + 0.32 * EASE.out(pulse)})`, boxSizing: 'border-box' }} />
      ) : null}
      {tap < 1 ? <div style={{ position: 'absolute', width: DISC, height: DISC, borderRadius: DISC, background: rgba(p.tint, 0.3 * (1 - tap)), transform: `scale(${1 + 0.5 * EASE.out(tap)})` }} /> : null}
      <div
        style={{
          width: DISC,
          height: DISC,
          borderRadius: DISC,
          background: bg,
          color: fg,
          boxShadow: `0 16px 34px ${rgba(bg, 0.35)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transform: `scale(${scale})`,
          position: 'relative',
        }}
      >
        {ok ? (
          <Check size={58} draw={tween(f, done, done + sec(0.45, fps), 0, 1, EASE.out)} color={fg} stroke={3.2} />
        ) : busy ? (
          <Spinner f={f} size={52} color={fg} />
        ) : action.icon ? (
          <Icon name={action.icon} size={56} color={fg} stroke={2.3} />
        ) : null}
        <div style={{ ...clip, maxWidth: DISC - 28, fontSize: 26, fontWeight: 800, textAlign: 'center' }}>{ok ? (action.done ?? action.label) : action.label}</div>
      </div>
    </div>
  )
}

const TabBar: React.FC<{ tabs: NonNullable<PhoneScreen['tabs']>; active: number }> = ({ tabs, active }) => {
  const p = usePalette()
  return (
    <div style={{ height: TABS_H, flexShrink: 0, borderTop: `1.5px solid ${p.separator}`, background: p.grouped, display: 'flex', justifyContent: 'space-around', paddingTop: 16, boxSizing: 'border-box', position: 'relative' }}>
      {tabs.map((tb, i) => {
        const c = i === active ? p.tint : p.label2
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: SW / tabs.length - 8, color: c, fontSize: 20, fontWeight: 700 }}>
            <Icon name={tb.icon} size={34} color={c} stroke={2.1} />
            <span style={{ ...clip, maxWidth: '100%' }}>{tb.label}</span>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: SW / 2 - 70, bottom: 10, width: 140, height: 6, borderRadius: 3, background: p.label }} />
    </div>
  )
}

export const Phone: React.FC<ScreenProps<PhoneScreen>> = ({ spec, progress = {}, f: frame, width = PW, height = PH }) => {
  const p = usePalette()
  const t = useTheme()
  const { f } = useClock(frame)
  const { u, x, y } = phoneFit(width, height)
  const { click, done, ...rest } = progress
  // with an action, click and done belong to it; the screen inside still hears done (its badge and button)
  const inner = spec.action ? { ...rest, done } : progress
  return (
    <div style={{ width, height, position: 'relative', fontFamily: p.font }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: PW,
          height: PH,
          transform: `scale(${u})`,
          transformOrigin: '0 0',
          borderRadius: 92,
          background: t.ink,
          boxShadow: `${p.shadow}, inset 0 0 0 3px ${rgba(t.paper, 0.16)}`,
        }}
      >
        <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SW, height: SH, borderRadius: 78, background: p.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <StatusBar time={spec.statusBarTime ?? '9:41'} />
          <InnerView spec={spec.screen} progress={inner} f={f} width={SW} height={innerH(spec)} flat dw={INNER_DW} />
          {spec.action ? <ActionButton action={spec.action} f={f} click={click} done={done} /> : null}
          {spec.tabs?.length ? <TabBar tabs={spec.tabs} active={spec.activeTab ?? 0} /> : null}
        </div>
      </div>
    </div>
  )
}
