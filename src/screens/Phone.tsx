// A phone frame around one of the card screens, with an optional big round action button and a tab bar. The phone is
// laid out PW wide and ph tall in design pixels, and scaled to fit (centred in) the box it is given: ph is PH (a tall,
// modern phone) in a box of that aspect, and down to PH_MIN in a wider box (the walk gives it one), so the phone trades
// height it can't have for width and its screen reads larger. Its bands (status bar, action, tabs) tighten with it.
// With an action, click presses it (a tap ripple, then a spinner) and done turns it to its done state; the screen inside
// gets every other action.
import React from 'react'
import { EASE, enter, mixColor, press, tween } from '../motion'
import { Icon } from '../reel/icons'
import { rgba, useTheme } from '../reel/theme'
import type { PhoneScreen } from '../reel/spec'
import { sec } from './look'
import { InnerView, innerTarget } from './inner'
import { Check, Spinner, clip, useClock, usePalette, type ScreenProps } from './parts'

/** The phone's design width and its natural (tallest) design height. */
export const PW = 600
export const PH = 1240
/** The shortest the phone gets, in a box wider than PW × PH. */
export const PH_MIN = 940
const BEZEL = 16
/**
 * The design width the wrapped screen is laid out at: narrower than the phone's screen (568), so the screen scales up
 * and its type reads larger; a short phone fits its screen to the height left instead.
 */
const INNER_DW = 520
const SW = PW - BEZEL * 2

/** The status bar, action and tab bar bands, and the action disc, in design pixels. */
type Bands = { status: number; action: number; disc: number; tabs: number }
const TALL: Bands = { status: 66, action: 250, disc: 184, tabs: 128 }
const SHORT: Bands = { status: 52, action: 180, disc: 156, tabs: 92 }

/** The phone's design height in a width × height box: the box's aspect, between PH_MIN and PH. */
export const phoneHeight = (width = PW, height = PH) => Math.min(PH, Math.max(PH_MIN, (PW * height) / width))

const bandsOf = (ph: number): Bands => {
  const k = (ph - PH_MIN) / (PH - PH_MIN)
  const at = (key: keyof Bands) => Math.round(SHORT[key] + (TALL[key] - SHORT[key]) * k)
  return { status: at('status'), action: at('action'), disc: at('disc'), tabs: at('tabs') }
}

/** Where the phone sits in a width × height box: its design height and bands, its scale and top-left offset. */
export const phoneFit = (width = PW, height = PH) => {
  const ph = phoneHeight(width, height)
  const u = Math.min(width / PW, height / ph)
  return { ph, bands: bandsOf(ph), u, x: (width - PW * u) / 2, y: (height - ph * u) / 2 }
}

/** The wrapped screen's height in design pixels. */
const innerH = (s: PhoneScreen, ph: number, b: Bands) => ph - BEZEL * 2 - b.status - (s.action ? b.action : 0) - (s.tabs?.length ? b.tabs : 0)

/** The click target: the action button's centre, else the wrapped screen's button, in box pixels (or null). */
export const phoneTarget = (s: PhoneScreen, width = PW, height = PH): [number, number] | null => {
  const { ph, bands: b, u, x, y } = phoneFit(width, height)
  const top = BEZEL + b.status
  const ih = innerH(s, ph, b)
  if (s.action) return [x + u * (PW / 2), y + u * (top + ih + b.action / 2)]
  const t = innerTarget(s.screen, SW, ih, { dw: INNER_DW, flat: true })
  return t ? [x + u * (BEZEL + t[0]), y + u * (top + t[1])] : null
}

const StatusBar: React.FC<{ time: string; h: number }> = ({ time, h }) => {
  const p = usePalette()
  const t = useTheme()
  const notch = Math.round((38 * h) / TALL.status)
  return (
    <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 44px 0', fontSize: 25, fontWeight: 700, color: p.label, flexShrink: 0, position: 'relative' }}>
      <span style={{ width: 90 }}>{time}</span>
      <div style={{ position: 'absolute', left: SW / 2 - 66, top: Math.round((14 * h) / TALL.status), width: 132, height: notch, borderRadius: notch / 2, background: t.ink }} />
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

const ActionButton: React.FC<{ action: NonNullable<PhoneScreen['action']>; h: number; disc: number; f: number; click?: number; done?: number }> = ({ action, h, disc: DISC, f, click, done }) => {
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
  // the disc's contents at its size (designed at 188)
  const z = DISC / 188
  return (
    <div style={{ height: h, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderTop: `1.5px solid ${p.separator}` }}>
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
          gap: 8 * z,
          transform: `scale(${scale})`,
          position: 'relative',
        }}
      >
        {ok ? (
          <Check size={58 * z} draw={tween(f, done, done + sec(0.45, fps), 0, 1, EASE.out)} color={fg} stroke={3.2} />
        ) : busy ? (
          <Spinner f={f} size={52 * z} color={fg} />
        ) : action.icon ? (
          <Icon name={action.icon} size={56 * z} color={fg} stroke={2.3} />
        ) : null}
        <div style={{ ...clip, maxWidth: DISC - 24, fontSize: Math.round(26 * z), fontWeight: 800, textAlign: 'center' }}>{ok ? (action.done ?? action.label) : action.label}</div>
      </div>
    </div>
  )
}

const TabBar: React.FC<{ tabs: NonNullable<PhoneScreen['tabs']>; active: number; h: number }> = ({ tabs, active, h }) => {
  const p = usePalette()
  const k = h / TALL.tabs
  return (
    <div style={{ height: h, flexShrink: 0, borderTop: `1.5px solid ${p.separator}`, background: p.grouped, display: 'flex', justifyContent: 'space-around', paddingTop: Math.round(16 * k), boxSizing: 'border-box', position: 'relative' }}>
      {tabs.map((tb, i) => {
        const c = i === active ? p.tint : p.label2
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(6 * k), width: SW / tabs.length - 8, color: c, fontSize: 20, fontWeight: 700 }}>
            <Icon name={tb.icon} size={Math.round(34 * Math.min(1, k + 0.1))} color={c} stroke={2.1} />
            <span style={{ ...clip, maxWidth: '100%' }}>{tb.label}</span>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: SW / 2 - 70, bottom: Math.round(10 * k), width: 140, height: 6, borderRadius: 3, background: p.label }} />
    </div>
  )
}

export const Phone: React.FC<ScreenProps<PhoneScreen>> = ({ spec, progress = {}, f: frame, width = PW, height = PH }) => {
  const p = usePalette()
  const t = useTheme()
  const { f } = useClock(frame)
  const { ph, bands: b, u, x, y } = phoneFit(width, height)
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
          height: ph,
          transform: `scale(${u})`,
          transformOrigin: '0 0',
          borderRadius: 92,
          background: t.ink,
          boxShadow: `${p.shadow}, inset 0 0 0 3px ${rgba(t.paper, 0.16)}`,
        }}
      >
        <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SW, height: ph - BEZEL * 2, borderRadius: 78, background: p.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <StatusBar time={spec.statusBarTime ?? '9:41'} h={b.status} />
          <InnerView spec={spec.screen} progress={inner} f={f} width={SW} height={innerH(spec, ph, b)} flat dw={INNER_DW} />
          {spec.action ? <ActionButton action={spec.action} h={b.action} disc={b.disc} f={f} click={click} done={done} /> : null}
          {spec.tabs?.length ? <TabBar tabs={spec.tabs} active={spec.activeTab ?? 0} h={b.tabs} /> : null}
        </div>
      </div>
    </div>
  )
}
