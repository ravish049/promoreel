// The phone's pitch screen in a replace ad: an app's landing screen. The theme's logo mark, an eyebrow, a large title and
// a short body sit in the upper part over a soft glow in the app's tint; one or two buttons and a footnote are pinned to
// the bottom. It is laid out `dw` design pixels wide (the phone's inner width by default) and scaled to fill the box it
// is given, like the screen kit's screens. `progress` (0–1) builds it in piece by piece; `press` (0–1) presses the
// primary button (a dip, a ripple, then back). Colours and fonts come from the theme.
import React from 'react'
import { interpolate } from 'remotion'
import { EASE, mixColor } from '../../motion'
import { Logo } from '../../reel/parts'
import { luminance, rgba, useTheme, type Theme } from '../../reel/theme'
import { CardShell, FLAT_PAD, PAD, fitOf, usePalette } from '../../screens/parts'

/** The pitch screen. Matches the spec's PitchScreen. */
export type PitchScreen = {
  kind: 'pitch'
  eyebrow?: string
  title: string
  body?: string
  buttons: { label: string; style?: 'primary' | 'secondary' }[]
  footnote?: string
}

export type PitchProps = {
  spec: PitchScreen
  /** 0 → 1: the screen builds in, top to bottom (default 1: all in). */
  progress?: number
  /** 0 → 1: the primary button's press (default 0: not pressed). */
  press?: number
  width?: number
  height?: number
  /** Drawn as a phone's content: no card shadow or rounded corners. */
  flat?: boolean
  /** The design width (default PITCH_DW, the phone's inner width). */
  dw?: number
  /** Show the theme's logo mark above the eyebrow (default true). */
  logo?: boolean
}

/** The design width the phone lays its screen out at. */
export const PITCH_DW = 520

const LOGO = 92
const LOGO_GAP = 34
const EYEBROW = 21
const EYEBROW_H = 42
const TITLE = 58
const TITLE_LH = 1.04
const BODY = 27
const BODY_LH = 1.42
const BUTTON_H = 92
const BUTTON_GAP = 14
const FOOT = 20
const FOOT_LH = 1.35
/** The footnote's box: two lines, top-aligned, so the buttons sit at a fixed height. */
const FOOT_H = Math.round(FOOT * FOOT_LH * 2)
const FOOT_GAP = 22

/** The buttons drawn (at most two), each with its style: the first is primary unless it says otherwise. */
export const pitchButtons = (s: PitchScreen) => s.buttons.slice(0, 2).map((b, i) => ({ ...b, style: b.style ?? (i === 0 ? 'primary' : 'secondary') }))

const linesOf = (text: string | undefined, perLine: number) => (text ? Math.max(1, Math.ceil(text.length / Math.max(1, perLine))) : 0)

/** The screen's natural (smallest comfortable) height in design pixels at `dw`. */
export const pitchHeight = (s: PitchScreen, dw = PITCH_DW, flat = true, logo = true) => {
  const pad = flat ? FLAT_PAD : PAD
  const inner = dw - pad * 2
  const n = pitchButtons(s).length
  return Math.round(
    pad * 2 +
      (logo ? LOGO + LOGO_GAP : 0) +
      (s.eyebrow ? EYEBROW_H + 22 : 0) +
      linesOf(s.title, inner / (TITLE * 0.54)) * TITLE * TITLE_LH +
      (s.body ? 20 + linesOf(s.body, inner / (BODY * 0.5)) * BODY * BODY_LH : 0) +
      80 +
      n * BUTTON_H +
      Math.max(0, n - 1) * BUTTON_GAP +
      (s.footnote ? FOOT_GAP + FOOT_H : 0),
  )
}

/** The primary button's centre in a width × height box, in box pixels (null without a primary button). */
export const pitchTarget = (s: PitchScreen, width: number, height: number, opts: { dw?: number; flat?: boolean; logo?: boolean } = {}): [number, number] | null => {
  const dw = opts.dw ?? PITCH_DW
  const flat = opts.flat ?? true
  const buttons = pitchButtons(s)
  const i = buttons.findIndex((b) => b.style === 'primary')
  if (i < 0) return null
  const { u, iw, ih } = fitOf(pitchHeight(s, dw, flat, opts.logo ?? true), dw, width, height)
  const pad = flat ? FLAT_PAD : PAD
  const below = (buttons.length - 1 - i) * (BUTTON_H + BUTTON_GAP) + (s.footnote ? FOOT_GAP + FOOT_H : 0)
  return [(iw / 2) * u, (ih - pad - below - BUTTON_H / 2) * u]
}

/** Piece i of n eased in at progress p: the pieces start in turn and each takes 30 % of the build. */
const stepIn = (p: number, i: number, n: number) => {
  const start = n <= 1 ? 0 : (0.7 * i) / (n - 1)
  return EASE.out(Math.min(1, Math.max(0, (p - start) / 0.3)))
}

/** The theme's darker and lighter colour (ink and paper, whichever way round a brand has them). */
const darkLight = (t: Theme) => (luminance(t.ink) <= luminance(t.paper) ? [t.ink, t.paper] : [t.paper, t.ink])

const rise = (k: number, dist = 28): React.CSSProperties => ({ opacity: k, transform: `translateY(${(1 - k) * dist}px)`, position: 'relative' })

export const Pitch: React.FC<PitchProps> = ({ spec, progress = 1, press = 0, width, height, flat = true, dw = PITCH_DW, logo = true }) => {
  const p = usePalette()
  const t = useTheme()
  const buttons = pitchButtons(spec)
  const primary = buttons.findIndex((b) => b.style === 'primary')
  // the pieces, top to bottom, in the order they build in
  const pieces = ['glow', logo && 'logo', spec.eyebrow && 'eyebrow', 'title', spec.body && 'body', ...buttons.map((_, i) => `button${i}`), spec.footnote && 'foot'].filter(Boolean) as string[]
  const k = (name: string) => stepIn(progress, Math.max(0, pieces.indexOf(name)), pieces.length)
  const pr = Math.min(1, Math.max(0, press))
  const dip = interpolate(pr, [0, 0.375, 1], [1, 0.95, 1], { easing: EASE.inOut })
  const bump = Math.sin(Math.PI * pr)
  const glow = k('glow')
  // text on the primary button: dark on a light tint, light on a dark one, whether the brand is light or dark
  const [dark, light] = darkLight(t)
  const onTint = luminance(p.tint) > 0.36 ? dark : light
  return (
    <CardShell natural={pitchHeight(spec, dw, flat, logo)} width={width} height={height} dw={dw} flat={flat} f={0}>
      {/* the hero glow: two soft discs of the app's tint and accent behind the head */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: glow, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: '42%', top: -dw * 0.34, width: dw * 1.0, height: dw * 1.0, borderRadius: '50%', background: `radial-gradient(circle at 50% 50%, ${rgba(p.tint, 0.22)} 0%, ${rgba(p.tint, 0)} 68%)` }} />
        <div style={{ position: 'absolute', left: -dw * 0.42, top: dw * 0.06, width: dw * 0.9, height: dw * 0.9, borderRadius: '50%', background: `radial-gradient(circle at 50% 50%, ${rgba(t.accent, 0.16)} 0%, ${rgba(t.accent, 0)} 66%)` }} />
      </div>
      <div style={{ flex: 0.75, minHeight: 12 }} />
      {logo ? (
        <div style={{ ...rise(k('logo')), marginBottom: LOGO_GAP, alignSelf: 'flex-start', borderRadius: LOGO * 0.26, boxShadow: `0 12px 28px ${rgba(t.ink, 0.14)}` }}>
          <Logo size={LOGO} radius={0.26} />
        </div>
      ) : null}
      {spec.eyebrow ? (
        <div style={{ ...rise(k('eyebrow')), alignSelf: 'flex-start', marginBottom: 22 }}>
          <div
            style={{
              height: EYEBROW_H,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 18px',
              borderRadius: 99,
              background: rgba(p.tint, 0.11),
              color: mixColor(p.tint, t.ink, 0.2),
              fontSize: EYEBROW,
              fontWeight: 800,
              letterSpacing: 1.3,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 9, background: p.tint, flexShrink: 0 }} />
            {spec.eyebrow}
          </div>
        </div>
      ) : null}
      <div style={{ ...rise(k('title'), 36), fontSize: TITLE, lineHeight: TITLE_LH, fontWeight: 800, letterSpacing: -1.9, color: p.label, textWrap: 'balance' }}>{spec.title}</div>
      {spec.body ? <div style={{ ...rise(k('body')), marginTop: 20, fontSize: BODY, lineHeight: BODY_LH, fontWeight: 500, color: p.label2, textWrap: 'pretty' }}>{spec.body}</div> : null}
      <div style={{ flex: 1, minHeight: 80 }} />
      {buttons.map((b, i) => {
        const isPrimary = b.style === 'primary'
        const pressed = i === primary
        const bg = isPrimary ? mixColor(p.tint, dark, pressed ? 0.14 * bump : 0) : p.grouped
        return (
          <div
            key={i}
            style={{
              ...rise(k(`button${i}`), 24),
              height: BUTTON_H,
              marginTop: i ? BUTTON_GAP : 0,
              flexShrink: 0,
              borderRadius: BUTTON_H / 2,
              background: bg,
              color: isPrimary ? onTint : p.label,
              border: isPrimary ? 'none' : `2px solid ${p.separator}`,
              boxSizing: 'border-box',
              boxShadow: isPrimary ? `0 ${14 - 8 * bump}px ${30 - 12 * bump}px ${rgba(p.tint, 0.34)}, inset 0 1.5px 0 ${rgba('#FFFFFF', 0.18)}` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: -0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              transform: `translateY(${(1 - k(`button${i}`)) * 24}px) scale(${pressed ? dip : 1})`,
            }}
          >
            {pressed && pr > 0 && pr < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: dw,
                  height: dw,
                  marginLeft: -dw / 2,
                  marginTop: -dw / 2,
                  borderRadius: '50%',
                  background: rgba(light, 0.25 * (1 - pr)),
                  transform: `scale(${0.08 + 0.92 * EASE.out(pr)})`,
                }}
              />
            ) : null}
            <span style={{ position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 28px' }}>{b.label}</span>
          </div>
        )
      })}
      {spec.footnote ? (
        <div
          style={{
            ...rise(k('foot'), 16),
            marginTop: FOOT_GAP,
            height: FOOT_H,
            flexShrink: 0,
            fontSize: FOOT,
            lineHeight: FOOT_LH,
            fontWeight: 500,
            color: p.label3,
            textAlign: 'center',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {spec.footnote}
        </div>
      ) : null}
    </CardShell>
  )
}
