// The screen kit's shared parts: the card shell (with its light sweep on done), the primary button (idle → busy → done),
// pills, avatars, check marks, the screen head and small caps labels. Sizes are in design pixels: a card is laid out
// DW (900) wide and scaled to the box it is given, so type stays in proportion at any size.
import React, { useMemo } from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { EASE, enter, mixColor, press, tween } from '../motion'
import { Icon, type IconName } from '../reel/icons'
import { onColor, rgba, useTheme } from '../reel/theme'
import type { ScreenAction, ScreenButton, ScreenHeading, Tone } from '../reel/spec'
import { paletteOf, sec, type Palette } from './look'

/** The frame each action starts at; an absent action never happens. */
export type Progress = Partial<Record<ScreenAction, number>>

/** What every screen takes. `width`/`height` are the box it fills, in pixels (default: its natural size at DW). */
export type ScreenProps<S> = {
  spec: S
  progress?: Progress
  /** The frame to draw (default: the current frame). */
  f?: number
  width?: number
  height?: number
  /** Drawn as a phone's content: no shadow or rounded corners. */
  flat?: boolean
  /** The design width the content is laid out at (default DW; the phone passes a narrower one). */
  dw?: number
}

/** The design width of a card, and its padding. */
export const DW = 900
export const PAD = 48
/** The padding of a flat screen (a phone's content). */
export const FLAT_PAD = 36
export const BUTTON_H = 96
/** The gap between a card's sections. */
export const GAP = 28

export const usePalette = (): Palette => {
  const t = useTheme()
  return useMemo(() => paletteOf(t), [t])
}

/** The frame to draw and the fps. */
export const useClock = (f?: number) => {
  const cur = useCurrentFrame()
  const { fps } = useVideoConfig()
  return { f: f ?? cur, fps }
}

/** The scale and design box of a screen drawn into a width × height box: content always fits, the box is always filled. */
export const fitOf = (natural: number, dw: number, width?: number, height?: number) => {
  const W = width ?? dw
  const H = height ?? natural * (W / dw)
  const u = Math.min(W / dw, H / natural)
  return { W, H, u, iw: W / u, ih: H / u }
}

export const Check: React.FC<{ size: number; draw: number; color: string; stroke?: number }> = ({ size, draw, color, stroke = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
    <path
      d="M5 12.5 L10 17.5 L19 7.5"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={24}
      strokeDashoffset={24 * (1 - Math.max(0, Math.min(1, draw)))}
    />
  </svg>
)

/** A success disc that pops in at frame `at` and draws its check. Nothing before `at`. */
export const CheckDisc: React.FC<{ f: number; at: number | undefined; size: number }> = ({ f, at, size }) => {
  const p = usePalette()
  const { fps } = useVideoConfig()
  if (at === undefined || f < at) return <div style={{ width: size, height: size, flexShrink: 0 }} />
  const pop = enter(f, at, sec(0.8, fps), fps)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: p.success,
        border: `${Math.max(2, size * 0.06)}px solid ${p.card}`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${pop})`,
        boxShadow: `0 4px 12px ${rgba(p.success, 0.35)}`,
        flexShrink: 0,
      }}
    >
      <Check size={size * 0.62} draw={tween(f, at + sec(0.07, fps), at + sec(0.45, fps), 0, 1, EASE.out)} color={p.onSuccess} />
    </div>
  )
}

export const Spinner: React.FC<{ f: number; size: number; color: string }> = ({ f, size, color }) => {
  const { fps } = useVideoConfig()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, transform: `rotate(${(f / fps) * 270}deg)` }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={3} />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

export const Pill: React.FC<{ children: React.ReactNode; tone: Tone; size?: number; dot?: boolean }> = ({ children, tone, size = 26, dot }) => {
  const p = usePalette()
  const c = p.tone(tone)
  return (
    <div
      style={{
        fontFamily: p.font,
        fontSize: size,
        fontWeight: 700,
        color: c.fg,
        background: c.bg,
        borderRadius: 99,
        padding: `${size * 0.34}px ${size * 0.75}px`,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.38,
        lineHeight: 1.1,
        flexShrink: 0,
      }}
    >
      {dot ? <span style={{ width: size * 0.36, height: size * 0.36, borderRadius: 99, background: c.fg, flexShrink: 0 }} /> : null}
      {children}
    </div>
  )
}

export const Avatar: React.FC<{ initials: string; size: number; index?: number }> = ({ initials, size, index }) => {
  const p = usePalette()
  const t = useTheme()
  const bg = p.avatar(initials, index)
  const fg = onColor(bg, t)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: bg,
        color: fg,
        fontSize: size * 0.36,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        letterSpacing: 0.5,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}

export const IconTile: React.FC<{ icon: IconName; size: number; tone?: Tone }> = ({ icon, size, tone = 'accent' }) => {
  const p = usePalette()
  const c = p.tone(tone)
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={size * 0.52} color={c.fg} stroke={2.2} />
    </div>
  )
}

/** Small caps section labels. */
export const ColLabel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const p = usePalette()
  return (
    <div style={{ fontSize: 22, fontWeight: 700, color: p.label2, letterSpacing: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style }}>
      {children}
    </div>
  )
}

/** One line, cut with an ellipsis when it doesn't fit. */
export const clip: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }

const TITLE = 48
const SUB = 26

/** The head's height in design pixels (0 when the spec has no title, subtitle, icon or badge). */
export const headHeight = (s: ScreenHeading) => {
  if (!s.title && !s.subtitle && !s.icon && !s.badge) return 0
  const text = (s.title ? Math.round(TITLE * 1.18) : 0) + (s.subtitle ? Math.round(SUB * 1.35) + (s.title ? 4 : 0) : 0)
  return Math.max(s.icon ? 76 : 0, text, s.badge ? 46 : 0)
}

/** The screen's top: an icon tile, the large title, the subtitle and a pill on the right. */
export const ScreenHead: React.FC<{ spec: ScreenHeading; right?: React.ReactNode }> = ({ spec, right }) => {
  const p = usePalette()
  const h = headHeight(spec)
  if (!h) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: h, flexShrink: 0 }}>
      {spec.icon ? <IconTile icon={spec.icon} size={76} /> : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {spec.title ? <div style={{ ...clip, fontSize: TITLE, fontWeight: 800, color: p.label, letterSpacing: -1.2, lineHeight: 1.18 }}>{spec.title}</div> : null}
        {spec.subtitle ? <div style={{ ...clip, fontSize: SUB, fontWeight: 500, color: p.label2, lineHeight: 1.35 }}>{spec.subtitle}</div> : null}
      </div>
      {right}
    </div>
  )
}

/** The head's pill: the spec's badge (muted) until done, then the button's done label in success, with a check. */
export const HeadBadge: React.FC<{ spec: ScreenHeading; button?: ScreenButton; f: number; done?: number }> = ({ spec, button, f, done }) => {
  const p = usePalette()
  const { fps } = useVideoConfig()
  if (done !== undefined && f >= done && (button?.done || spec.badge)) {
    const pop = enter(f, done, sec(0.7, fps), fps)
    return (
      <div style={{ transform: `scale(${0.6 + 0.4 * pop})`, opacity: Math.min(1, pop * 1.5) }}>
        <Pill tone="success">
          <Check size={26} draw={tween(f, done, done + sec(0.45, fps), 0, 1, EASE.out)} color={p.tone('success').fg} /> {button?.done ?? spec.badge}
        </Pill>
      </div>
    )
  }
  return spec.badge ? (
    <Pill tone="muted" dot>
      {spec.badge}
    </Pill>
  ) : null
}

/** The primary button: pressed at `click`, busy until `done`, then done (success colour, check, done label). */
export const AppButton: React.FC<{ spec: ScreenButton; f: number; click?: number; done?: number; h?: number }> = ({ spec, f, click, done, h = BUTTON_H }) => {
  const p = usePalette()
  const { fps } = useVideoConfig()
  const ok = done !== undefined && f >= done
  const busy = !ok && click !== undefined && f >= click + sec(0.13, fps) && spec.busy
  const k = done === undefined ? 0 : tween(f, done, done + sec(0.25, fps), 0, 1, EASE.out)
  const pop = ok ? enter(f, done, sec(0.7, fps), fps) : 1
  const bg = mixColor(p.tint, p.success, k)
  const fg = k > 0.5 ? p.onSuccess : p.onTint
  const scale = (click === undefined ? 1 : press(f, click, sec(0.27, fps))) * (0.95 + 0.05 * pop)
  const fs = Math.min(34, h * 0.36)
  return (
    <div
      style={{
        height: h,
        borderRadius: h * 0.25,
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontSize: fs,
        fontWeight: 700,
        boxShadow: `0 10px 22px ${rgba(bg, 0.28)}`,
        transform: `scale(${scale})`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        padding: '0 24px',
      }}
    >
      {ok ? (
        <>
          <Check size={fs * 1.1} draw={tween(f, done, done + sec(0.45, fps), 0, 1, EASE.out)} color={fg} /> <span style={clip}>{spec.done ?? spec.label}</span>
        </>
      ) : busy ? (
        <>
          <Spinner f={f} size={fs * 0.9} color={fg} /> <span style={clip}>{spec.busy}</span>
        </>
      ) : (
        <span style={clip}>{spec.label}</span>
      )}
    </div>
  )
}

/**
 * The screen a kind is drawn in: a rounded card with a soft shadow (or, `flat`, a phone's content), its content laid out
 * at `dw` design pixels wide and scaled to fill width × height. `sweepAt`: a soft light sweeps across when it is done.
 */
export const CardShell: React.FC<{
  natural: number
  width?: number
  height?: number
  dw?: number
  flat?: boolean
  pad?: number
  sweepAt?: number
  f: number
  children: React.ReactNode
}> = ({ natural, width, height, dw = DW, flat, pad = flat ? FLAT_PAD : PAD, sweepAt, f, children }) => {
  const p = usePalette()
  const { fps } = useVideoConfig()
  const { W, H, u, iw, ih } = fitOf(natural, dw, width, height)
  const sweep = sweepAt === undefined ? -1 : tween(f, sweepAt, sweepAt + sec(1.1, fps), 0, 1, EASE.inOut)
  const band = Math.max(W, H) * 0.32
  return (
    <div
      style={{
        width: W,
        height: H,
        flexShrink: 0,
        position: 'relative',
        borderRadius: flat ? 0 : 36 * u,
        background: p.card,
        boxShadow: flat ? 'none' : `${p.shadow}, inset 0 0 0 ${Math.max(1, u * 1.5)}px ${p.separator}`,
        overflow: 'hidden',
        fontFamily: p.font,
        color: p.label,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: iw,
          height: ih,
          transform: `scale(${u})`,
          transformOrigin: '0 0',
          padding: pad,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
      {sweep > 0 && sweep < 1 ? (
        <div
          style={{
            position: 'absolute',
            top: -H * 0.3,
            bottom: -H * 0.3,
            width: band,
            left: -band * 1.4 + sweep * (W + band * 2.8),
            transform: 'rotate(14deg)',
            background: `linear-gradient(90deg, ${rgba(p.success, 0)} 0%, ${rgba(p.success, 0.13)} 42%, ${rgba(p.card, 0.7)} 50%, ${rgba(p.success, 0.13)} 58%, ${rgba(p.success, 0)} 100%)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  )
}

/** Fills the space between a screen's content and its button. */
export const Spacer: React.FC<{ min?: number }> = ({ min = GAP }) => <div style={{ flex: 1, minHeight: min }} />
