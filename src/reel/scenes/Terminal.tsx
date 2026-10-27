// A terminal window on the backdrop, for developer tools and CLI walkthroughs. Each command is typed out when its voice
// line starts; its output lines appear one after another while the line is spoken, with an optional progress bar.
// A row of step pills above the window lights the current step ("Record", "Voice", "Render").
// Once the next command starts, an earlier one folds to its command line and its last output line (its result), so three
// or four steps fit the window without scrolling.
import React from 'react'
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SAFE, rgba, useTheme, type Theme } from '../theme'
import type { TerminalCommand, TerminalScene } from '../spec'
import type { TLLine, TLScene } from '../timeline'
import { lineAt } from './talk'

const TYPE_CPS = 30 // characters typed per second
const WIN_TOP = SAFE.top + 150
const WIN_BOTTOM = 1060 // clear of the captions pill at the bottom of the safe zone

type Timed = { cmd: TerminalCommand; start: number; typed: number; end: number }

const toneColor = (tone: string | undefined, t: Theme) => (tone === 'ok' ? t.success : tone === 'accent' ? t.accent : tone === 'plain' ? t.paper : rgba(t.paper, 0.62))

export const TerminalView: React.FC<{ scene: TLScene & { spec: TerminalScene }; lines: TLLine[] }> = ({ scene, lines }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = (frame / fps) * 1000
  const s = scene.spec
  const sceneEnd = (scene.durationFrames / fps) * 1000

  const timed: Timed[] = s.commands.map((c) => {
    const l = lines.find((x) => x.id === c.atLine)
    const start = (l ? lineAt(scene, lines, l.id, fps) : 0) + (c.offsetMs ?? 0)
    const typed = start + (c.cmd.length / TYPE_CPS) * 1000
    const end = l ? Math.max(typed + 600, lineAt(scene, lines, l.id, fps) + l.durationMs - 150) : typed + 2000
    return { cmd: c, start, typed, end }
  })
  const steps = [...new Set(s.commands.map((c) => c.step).filter(Boolean))] as string[]
  const current = [...timed].reverse().find((x) => ms >= x.start)
  const pWin = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 130 } })
  const blink = Math.floor(ms / 450) % 2 === 0

  return (
    <AbsoluteFill style={{ fontFamily: t.font }}>
      {steps.length > 0 && (
        <div style={{ position: 'absolute', top: SAFE.top + 24, left: SAFE.left, right: 1080 - SAFE.right, display: 'flex', justifyContent: 'center', gap: 18 }}>
          {steps.map((st, i) => {
            const on = current?.cmd.step === st
            const done = !on && timed.some((x) => x.cmd.step === st && ms > x.end)
            const p = spring({ frame: frame - 6 - i * 4, fps, config: { damping: 14, stiffness: 160 } })
            return (
              <div
                key={st}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 30px 16px 18px',
                  borderRadius: 999,
                  background: on ? t.accent : rgba(t.paper, done ? 0.2 : 0.1),
                  border: `1.5px solid ${on ? t.accent : rgba(t.paper, 0.3)}`,
                  color: on ? t.ink : t.paper,
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: -0.6,
                  opacity: Math.min(1, p * 1.5),
                  transform: `translateY(${(1 - p) * 30}px) scale(${on ? 1.06 : 1})`,
                  boxShadow: on ? `0 12px 34px ${rgba(t.accent, 0.45)}` : 'none',
                }}
              >
                <span style={{ width: 52, height: 52, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, background: on ? t.ink : rgba(t.paper, 0.16), color: on ? t.accent : t.paper }}>{done ? '✓' : i + 1}</span>
                {st}
              </div>
            )
          })}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: SAFE.left - 10,
          right: 1080 - SAFE.right - 10,
          top: WIN_TOP,
          height: WIN_BOTTOM - WIN_TOP,
          borderRadius: 32,
          overflow: 'hidden',
          background: 'rgba(10,10,12,0.86)',
          border: `1.5px solid ${rgba(t.paper, 0.18)}`,
          boxShadow: `0 40px 100px rgba(0,0,0,0.55), 0 0 80px ${rgba(t.accent, 0.1)}`,
          opacity: Math.min(1, pWin * 1.4),
          transform: `translateY(${(1 - pWin) * 80}px) scale(${0.95 + 0.05 * pWin})`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ height: 70, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', borderBottom: `1px solid ${rgba(t.paper, 0.1)}`, background: 'rgba(255,255,255,0.04)' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />
          ))}
          <div style={{ flex: 1, textAlign: 'center', marginRight: 80, fontFamily: t.mono, fontSize: 26, color: rgba(t.paper, 0.6) }}>{s.title ?? 'terminal'}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '26px 36px 30px', fontFamily: t.mono, fontSize: 31, lineHeight: 1.42, overflow: 'hidden' }}>
          {timed
            .filter((x) => ms >= x.start - 50)
            .map((x, ci) => {
              const n = Math.max(0, Math.min(x.cmd.cmd.length, Math.floor(((ms - x.start) / 1000) * TYPE_CPS)))
              const typing = ms < x.typed
              const out = x.cmd.output ?? []
              const span = Math.max(1, x.end - x.typed - 250)
              const shown = typing ? 0 : Math.min(out.length, 1 + Math.floor(((ms - x.typed - 250) / span) * out.length))
              const isLast = ci === timed.filter((y) => ms >= y.start - 50).length - 1
              // an earlier command, once the next one is typing, keeps only its result line
              const folded = !isLast && out.length > 0
              const visible = folded ? [out[out.length - 1]] : out.slice(0, ms >= x.typed + 250 ? shown : 0)
              const prog = interpolate(ms, [x.typed + 150, x.end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) })
              return (
                <div key={ci} style={{ marginTop: ci === 0 ? 0 : 18 }}>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: t.paper }}>
                    <span style={{ color: t.accent, fontWeight: 700 }}>$ </span>
                    {x.cmd.cmd.slice(0, n)}
                    {typing && isLast && <span style={{ display: 'inline-block', width: 18, height: 34, marginLeft: 2, verticalAlign: -5, background: blink ? t.paper : 'transparent' }} />}
                  </div>
                  {visible.map((o, k) => {
                    const line = typeof o === 'string' ? { text: o } : o
                    return (
                      <div key={k} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 27, color: toneColor(line.tone, t) }}>
                        {line.text}
                      </div>
                    )
                  })}
                  {x.cmd.progress && !typing && !folded && (
                    <div style={{ marginTop: 12, height: 16, borderRadius: 8, background: rgba(t.paper, 0.12), overflow: 'hidden' }}>
                      <div style={{ width: `${prog * 100}%`, height: '100%', borderRadius: 8, background: prog >= 1 ? t.success : t.accent }} />
                    </div>
                  )}
                </div>
              )
            })}
          {current && ms > current.end && ms < sceneEnd && (
            <div style={{ marginTop: 18, color: t.paper }}>
              <span style={{ color: t.accent, fontWeight: 700 }}>$ </span>
              <span style={{ display: 'inline-block', width: 18, height: 34, verticalAlign: -5, background: blink ? t.paper : 'transparent' }} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}
