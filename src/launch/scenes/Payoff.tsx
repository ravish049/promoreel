// The payoff: the spec's cards land one by one with an overshoot, each works (its bar fills, its lines tick in), then
// the checkmarks cascade across them, always after every card has landed. On a wide canvas the cards stand in a row
// with their lines listed; on tall and square ones they stack as wide row cards, whose status line runs through the
// lines as the bar passes them (so the type stays large). The counter (Launch.tsx) drops to its
// target meanwhile, its glow turning from the accent to success; when it reaches it the camera pulls back (100 → 86 %)
// and the clear state holds. Kinetic words land at that moment.
import React from 'react'
import { Camera, Center, EASE, Words, camAt, drift, enter, mixColor, tween, type CamKey } from '../../motion'
import { Icon } from '../../reel/icons'
import { rgba, useTheme } from '../../reel/theme'
import { Check, CheckDisc, Spinner, usePalette } from '../../screens'
import type { LaunchPayoff } from '../../reel/spec'
import { WORD_GAP, deepInk, fitRows, hudWidth, sceneOut, useLaunch } from '../context'
import { rectCx, rectCy, rectH, rectW } from '../layout'
import { LEAD, at60, type PayoffPlan } from '../plan'

/** A tile card's design size: drawn at CW wide and scaled to its grid cell. */
const CW = 360
const PAD = 30
const ICON = 64
const TITLE = 32
const STATUS = 23
const LINE = 38
const BAR = 8

type Card = LaunchPayoff['cards'][number]

const cardHeight = (lines: number, status: boolean) => PAD + ICON + 20 + TITLE * 1.2 + (status ? STATUS * 1.35 + 4 : 0) + (lines ? 18 + lines * LINE : 0) + 24 + BAR + PAD

/** A row card's design size. */
const RW = 900
const RPAD = 28
const RICON = 88
const RTITLE = 42
const RSUB = 28
/** A row card's height: with a status line when any card has lines or a done line. */
const rowHeight = (sub: boolean) => RPAD * 2 + RTITLE * 1.2 + (sub ? 6 + RSUB * 1.35 : 0) + 16 + BAR

export const PayoffScene: React.FC<{ p: PayoffPlan; f: number }> = ({ p, f }) => {
  const t = useTheme()
  const { plan, lay } = useLaunch()
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const cards = p.spec.cards
  const n = cards.length
  const words = p.spec.words ?? []
  const rect = lay.cards({ words: words.length > 0, hud: hudWidth(t, lay, plan.counter, p.scene) })
  const cols = lay.cols(n)
  const rows = Math.ceil(n / cols)
  const maxLines = Math.max(0, ...cards.map((c) => c.lines?.length ?? 0))
  const status = cards.some((c) => c.done)
  const rowCards = !lay.L.wide
  const natW = rowCards ? RW : CW
  const natH = rowCards ? rowHeight(status || maxLines > 0) : cardHeight(maxLines, status)
  const gap = (rowCards ? 22 : 28) * (Math.min(lay.L.W, lay.L.H) / 1080)
  // the grid sits inside the rect at the camera's pulled-in scale (1.03), so nothing is clipped at the peak
  const avW = rectW(rect) / 1.03
  const avH = rectH(rect) / 1.03
  const u = Math.min((avW - gap * (cols - 1)) / cols / natW, (avH - gap * (rows - 1)) / rows / natH, rowCards ? 1.15 : 1.6)
  const cw = natW * u
  const ch = natH * u
  const gridW = cols * cw + (cols - 1) * gap
  const gridH = rows * ch + (rows - 1) * gap
  const gx = rectCx(rect) - gridW / 2
  const gy = rectCy(rect) - gridH / 2

  const keys: CamKey[] = [
    { f: -F(LEAD), x: 0, y: 0, s: 0.97 },
    { f: F(60), x: 0, y: 0, s: 1 },
    { f: p.pullBack[0], x: 0, y: 0, s: 1.03 },
    { f: p.pullBack[1], x: 0, y: 0, s: 0.86 },
  ]
  const cam = camAt(keys, f)
  const out = sceneOut(f, p.out, fps)
  const fitted = words.length ? fitRows([{ words, accent: false, at: p.wordsAt }], lay.words.maxW, lay.words.size, t.font) : null
  return (
    <>
      <Camera cam={{ ...cam, s: cam.s * (1 + 0.004 * drift(f, 1, at60(400, fps))) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - out, transform: `scale(${1 - 0.04 * out})` }}>
          {cards.map((c, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            // a short last row is centred
            const inRow = row === rows - 1 ? n - row * cols : cols
            const rowX = gx + (gridW - (inRow * cw + (inRow - 1) * gap)) / 2
            const x = rowX + col * (cw + gap)
            const y = gy + row * (ch + gap)
            const land = enter(f, p.land[i], F(40), fps)
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: cw,
                  height: ch,
                  opacity: f < p.land[i] ? 0 : Math.min(1, land * 2.2),
                  transform: `translateY(${(1 - land) * 110}px) scale(${0.88 + 0.12 * land}) rotate(${(1 - land) * -3}deg)`,
                }}
              >
                {rowCards ? (
                  <RowCard card={c} f={f} landed={p.landed[i]} check={p.checks[i]} u={u} sub={status || maxLines > 0} />
                ) : (
                  <PayoffCard card={c} f={f} landed={p.landed[i]} check={p.checks[i]} u={u} lines={maxLines} status={status} />
                )}
              </div>
            )
          })}
        </div>
      </Camera>
      {fitted ? (
        <Center>
          <div style={{ position: 'absolute', left: 0, top: lay.words.cy, width: 0, height: 0, opacity: 1 - out }}>
            <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {fitted.rows.map((r, i) => {
                const first = fitted.rows.slice(0, i).reduce((k, x) => k + x.words.length, 0)
                const last = first + r.words.length === words.length && words.length > 1
                return <Words key={i} f={f} words={r.words} at={r.at} size={fitted.size} color={t.paper} gap={WORD_GAP} accentWords={last ? [r.words.length - 1] : []} />
              })}
            </div>
          </div>
        </Center>
      ) : null}
    </>
  )
}

/** One card: an icon tile, the title, the done line once checked, its lines ticking in as the bar fills, a check disc. */
const PayoffCard: React.FC<{ card: Card; f: number; landed: number; check: number; u: number; lines: number; status: boolean }> = ({ card, f, landed, check, u, lines, status }) => {
  const p = usePalette()
  // a shadow on the dark stage: its own deepest shade (the palette's shadow is tuned for a light page)
  const deep = deepInk(useTheme())
  const { plan } = useLaunch()
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const work = tween(f, landed, check, 0, 1, EASE.inOut)
  const ok = f >= check
  const okMix = tween(f, check, check + F(14), 0, 1, EASE.out)
  const items = card.lines ?? []
  const barColor = ok ? p.success : p.tint
  return (
    <div
      style={{
        width: CW,
        height: cardHeight(lines, status),
        transform: `scale(${u})`,
        transformOrigin: '0 0',
        boxSizing: 'border-box',
        padding: PAD,
        borderRadius: 28,
        background: p.card,
        boxShadow: `0 24px 60px ${rgba(deep, 0.32)}, 0 4px 14px ${rgba(deep, 0.18)}, inset 0 0 0 ${2 * okMix}px ${rgba(p.success, 0.55)}`,
        fontFamily: p.font,
        color: p.label,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', height: ICON }}>
        <div style={{ width: ICON, height: ICON, borderRadius: ICON * 0.28, background: p.tone(ok ? 'success' : 'accent').bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {card.icon ? (
            <Icon name={card.icon} size={ICON * 0.5} color={p.tone(ok ? 'success' : 'accent').fg} stroke={2.2} />
          ) : (
            <div style={{ width: ICON * 0.3, height: ICON * 0.3, borderRadius: 99, background: p.tone(ok ? 'success' : 'accent').fg }} />
          )}
        </div>
        {ok ? (
          <CheckDisc f={f} at={check} size={52} />
        ) : f >= landed ? (
          <div style={{ marginTop: 10 }}>
            <Spinner f={f} size={32} color={p.tint} />
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 20, fontSize: TITLE, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
      {status ? (
        <div
          style={{
            marginTop: 4,
            height: STATUS * 1.35,
            fontSize: STATUS,
            fontWeight: 600,
            lineHeight: 1.35,
            color: p.tone('success').fg,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: card.done ? okMix : 0,
            transform: `translateY(${(1 - okMix) * 8}px)`,
          }}
        >
          {card.done ?? ''}
        </div>
      ) : null}
      {lines ? (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' }}>
          {items.map((l, k) => {
            // each line ticks in as the bar passes it; all are green once the card checks
            const at = landed + (check - landed) * ((k + 1) / (items.length + 1))
            const lit = f >= at
            const draw = tween(f, at, at + F(12), 0, 1, EASE.out)
            const c = ok ? p.success : p.tint
            return (
              <div key={k} style={{ height: LINE, display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 500, color: lit ? p.label2 : p.label3 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 99,
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    border: lit ? 'none' : `2px solid ${p.separator}`,
                    background: lit ? c : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {lit ? <Check size={18} draw={draw} color={ok ? p.onSuccess : p.onTint} stroke={3.4} /> : null}
                </div>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{l}</span>
              </div>
            )
          })}
        </div>
      ) : null}
      <div style={{ flex: 1 }} />
      <div style={{ height: BAR, borderRadius: BAR, background: p.grouped, overflow: 'hidden' }}>
        <div style={{ width: `${(ok ? 1 : work) * 100}%`, height: '100%', borderRadius: BAR, background: barColor }} />
      </div>
    </div>
  )
}

/** One row card: an icon tile, the title, a status line (the line being worked on, then the done line), the bar, a check disc. */
const RowCard: React.FC<{ card: Card; f: number; landed: number; check: number; u: number; sub: boolean }> = ({ card, f, landed, check, u, sub: hasSub }) => {
  const p = usePalette()
  // a shadow on the dark stage: its own deepest shade (the palette's shadow is tuned for a light page)
  const deep = deepInk(useTheme())
  const { plan } = useLaunch()
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const work = tween(f, landed, check, 0, 1, EASE.inOut)
  const ok = f >= check
  const okMix = tween(f, check, check + F(14), 0, 1, EASE.out)
  const items = card.lines ?? []
  // the line being worked on: each one as the bar passes it
  const k = items.length ? Math.min(items.length - 1, Math.floor(work * items.length)) : -1
  const tone = p.tone(ok ? 'success' : 'accent')
  const sub = ok ? (card.done ?? items[items.length - 1] ?? '') : f >= landed && k >= 0 ? items[k] : ''
  return (
    <div
      style={{
        width: RW,
        height: rowHeight(hasSub),
        transform: `scale(${u})`,
        transformOrigin: '0 0',
        boxSizing: 'border-box',
        padding: RPAD,
        borderRadius: 30,
        background: p.card,
        boxShadow: `0 24px 60px ${rgba(deep, 0.32)}, 0 4px 14px ${rgba(deep, 0.18)}, inset 0 0 0 ${2 * okMix}px ${rgba(p.success, 0.55)}`,
        fontFamily: p.font,
        color: p.label,
        display: 'flex',
        alignItems: 'center',
        gap: 26,
      }}
    >
      <div style={{ width: RICON, height: RICON, borderRadius: RICON * 0.28, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {card.icon ? <Icon name={card.icon} size={RICON * 0.5} color={tone.fg} stroke={2.2} /> : <div style={{ width: RICON * 0.3, height: RICON * 0.3, borderRadius: 99, background: tone.fg }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: RTITLE, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</div>
        {hasSub ? (
          <div
            style={{
              marginTop: 6,
              height: RSUB * 1.35,
              fontSize: RSUB,
              fontWeight: ok ? 600 : 500,
              lineHeight: 1.35,
              color: ok ? mixColor(p.label2, p.tone('success').fg, okMix) : p.label2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sub}
          </div>
        ) : null}
        <div style={{ marginTop: 16, height: BAR, borderRadius: BAR, background: p.grouped, overflow: 'hidden' }}>
          <div style={{ width: `${(ok ? 1 : work) * 100}%`, height: '100%', borderRadius: BAR, background: ok ? p.success : p.tint }} />
        </div>
      </div>
      <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ok ? <CheckDisc f={f} at={check} size={64} /> : f >= landed ? <Spinner f={f} size={40} color={p.tint} /> : null}
      </div>
    </div>
  )
}
