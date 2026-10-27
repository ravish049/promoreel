// The phone scene: the real recordings (promoreel record) inside a clean phone frame, a camera that zooms and pans onto what is being tapped,
// a touch dot and ripple on every tap, and a glow on the rows that matter. Everything is placed from the recorder's JSON.
import React from 'react'
import { Video } from '@remotion/media'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { PHONE, glowColor, luminance, rgba, useTheme } from '../theme'
import { Icon } from '../icons'
import type { CameraKey, FocusSpec, PhoneScene as PhoneSpec } from '../spec'
import { eventTime, findEvent, type ClipManifest, type TLClip, type TLScene } from '../timeline'

// ── geometry: the screen is the recording (390×844 CSS px) under a 47 px status bar ──────────────────────────────────────
const CSS_W = 390
const CSS_H = 844
const STATUS = 47
const SCREEN_W = 600
const K = SCREEN_W / CSS_W // canvas px per CSS px
const SCREEN_H = Math.round((CSS_H + STATUS) * K)
const BEZEL = 20
const FRAME_W = SCREEN_W + BEZEL * 2
const FRAME_H = SCREEN_H + BEZEL * 2
const FRAME_LEFT = (1080 - FRAME_W) / 2
const FRAME_TOP = 430
const SCREEN_LEFT = FRAME_LEFT + BEZEL
const SCREEN_TOP = FRAME_TOP + BEZEL
const CONTENT_TOP = SCREEN_TOP + STATUS * K
/** Where a zoomed-in focus point lands: the middle of the safe zone, under the captions. */
const TARGET = { x: 540, y: 860 }

/** A CSS-px point of the recording → canvas px (camera at rest). */
const toCanvas = (x: number, y: number) => ({ x: SCREEN_LEFT + x * K, y: CONTENT_TOP + y * K })

type Cam = { s: number; fx: number; fy: number }
const REST: Cam = { s: 1, fx: SCREEN_LEFT + SCREEN_W / 2, fy: SCREEN_TOP + SCREEN_H / 2 }

function focusPoint(m: ClipManifest, f: FocusSpec): { x: number; y: number } {
  if (f === 'center') return { x: REST.fx, y: REST.fy }
  if (typeof f === 'string') f = { event: f }
  if ('x' in f) return toCanvas(f.x, f.y)
  const b = findEvent(m, f.event).box
  if (!b) return { x: REST.fx, y: REST.fy }
  return toCanvas(b.x + b.w * (f.fx ?? 0.5), b.y + b.h * (f.fy ?? 0.5))
}

type SceneKey = { t: number; cam: Cam; moveMs: number }

/** Every clip's camera keys on the scene's own clock (output ms). */
function cameraKeys(clips: TLClip[], fps: number): SceneKey[] {
  const keys: SceneKey[] = []
  for (const c of clips) {
    const base = (c.startFrame / fps) * 1000
    for (const k of (c.spec.camera ?? []) as CameraKey[]) {
      const src = k.event ? eventTime(c.manifest, k.event, c.fromMs) : (k.atMs ?? c.fromMs)
      // with jump cuts, a key belongs to the segment that shows its moment (a key at a cut lands on the next segment)
      if (c.spec.segments && (src < c.fromMs - 1 || src > c.toMs)) continue
      const p = focusPoint(c.manifest, k.focus)
      keys.push({ t: base + (src - c.fromMs) / c.rate + (k.offsetMs ?? 0), cam: { s: k.scale, fx: p.x, fy: p.y }, moveMs: k.moveMs ?? 600 })
    }
  }
  return keys.sort((a, b) => a.t - b.t)
}

function cameraAt(keys: SceneKey[], ms: number): Cam {
  let cur = REST
  for (const k of keys) {
    if (ms >= k.t) {
      cur = k.cam
      continue
    }
    if (k.moveMs > 0 && ms > k.t - k.moveMs) {
      const p = Easing.inOut(Easing.cubic)((ms - (k.t - k.moveMs)) / k.moveMs)
      return { s: cur.s + (k.cam.s - cur.s) * p, fx: cur.fx + (k.cam.fx - cur.fx) * p, fy: cur.fy + (k.cam.fy - cur.fy) * p }
    }
    break
  }
  return cur
}

/** The camera as a transform on the phone: the focus point goes to TARGET as the zoom grows, never showing past the screen's sides. */
function cameraTransform(cam: Cam): { tx: number; ty: number; s: number } {
  const w = Math.max(0, Math.min(1, (cam.s - 1) / 0.25))
  const tgx = cam.fx + (TARGET.x - cam.fx) * w
  const tgy = cam.fy + (TARGET.y - cam.fy) * w
  let tx = tgx - cam.s * cam.fx
  let ty = tgy - cam.s * cam.fy
  const left = cam.s * SCREEN_LEFT + tx
  const right = cam.s * (SCREEN_LEFT + SCREEN_W) + tx
  if (cam.s * SCREEN_W >= 1080) {
    if (left > 0) tx -= left
    if (right < 1080) tx += 1080 - right
  } else {
    // narrower than the canvas: pan toward the focus, but keep the whole screen in view (24 px margin)
    const lo = 24 - cam.s * SCREEN_LEFT
    const hi = 1080 - 24 - cam.s * (SCREEN_LEFT + SCREEN_W)
    tx = Math.min(Math.max(tx, Math.min(lo, hi)), Math.max(lo, hi))
  }
  // the top of the screen may come down a little (so a control near the top clears the captions), never further
  const top = cam.s * SCREEN_TOP + ty
  const maxTop = SCREEN_TOP + 170 * w
  if (top > maxTop) ty -= top - maxTop
  // ...and its bottom never rises into the frame (no empty band under a zoomed phone)
  const bottom = cam.s * (SCREEN_TOP + SCREEN_H) + ty
  const minBottom = 1920 - (1920 - (SCREEN_TOP + SCREEN_H)) * (1 - w) - 40 * w
  if (bottom < minBottom) ty += minBottom - bottom
  return { tx, ty, s: cam.s }
}

// ── the parts drawn over a clip, in the recording's CSS px ───────────────────────────────────────────────────────────────
const ClipOverlay: React.FC<{ clip: TLClip }> = ({ clip }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = (frame / fps) * 1000
  const out = (src: number) => (src - clip.fromMs) / clip.rate
  const taps = clip.spec.taps === false ? [] : clip.manifest.events.filter((e) => e.kind === 'tap' && e.box && e.t >= clip.fromMs - 200 && e.t <= clip.toMs)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {(clip.spec.glow ?? []).map((g, i) => {
        const e = findEvent(clip.manifest, g.event)
        if (!e.box) return null
        const t0 = out(e.t)
        const t1 = g.untilEvent ? out(eventTime(clip.manifest, g.untilEvent, clip.toMs)) : out(clip.toMs) + 5000
        // gone by the end event (a scroll usually starts there, and the box would no longer sit on its row)
        if (ms < t0 || ms > t1) return null
        const a = interpolate(ms, [t0, t0 + 220, Math.max(t0 + 221, t1 - 180), Math.max(t0 + 222, t1)], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const pulse = 0.65 + 0.35 * Math.sin(((ms - t0) / 1000) * Math.PI * 2 * 1.1)
        const col = glowColor(g.color, t)
        const pad = g.pad ?? 4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: (e.box.x - pad) * K,
              top: (e.box.y - pad) * K,
              width: (e.box.w + pad * 2) * K,
              height: (e.box.h + pad * 2) * K,
              borderRadius: 14 * K,
              border: `${3 * K}px solid ${col}`,
              boxShadow: `0 0 ${22 * K * pulse}px ${col}, inset 0 0 ${10 * K * pulse}px ${col}55`,
              opacity: a,
            }}
          />
        )
      })}
      {(clip.spec.badges ?? []).map((bd, i) => {
        const e = findEvent(clip.manifest, bd.event)
        if (!e.box) return null
        const t0 = out(e.t)
        const t1 = bd.untilEvent ? out(eventTime(clip.manifest, bd.untilEvent, clip.toMs)) : out(clip.toMs) + 5000
        if (ms < t0 || ms > t1) return null
        const p = spring({ frame: ((ms - t0) / 1000) * fps, fps, config: { damping: 12, stiffness: 180 } })
        const a = interpolate(ms, [Math.max(t0 + 1, t1 - 160), Math.max(t0 + 2, t1)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={`b${i}`} style={{ position: 'absolute', left: e.box.x * K, width: e.box.w * K, top: (e.box.y + e.box.h + 8) * K, display: 'flex', justifyContent: 'center', opacity: a }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6 * K,
                padding: `${6 * K}px ${12 * K}px`,
                borderRadius: 999,
                background: t.ink,
                color: t.paper,
                fontFamily: t.font,
                fontSize: 14 * K,
                fontWeight: 750,
                letterSpacing: -0.1,
                boxShadow: `0 ${6 * K}px ${18 * K}px rgba(0,0,0,0.30), 0 0 0 ${1.5 * K}px ${t.accent}`,
                transform: `scale(${0.6 + 0.4 * p}) translateY(${(1 - p) * 10 * K}px)`,
                opacity: Math.min(1, p * 1.6),
              }}
            >
              {bd.icon && <Icon name={bd.icon} size={15 * K} color={t.accent} stroke={2.4} />}
              {bd.text}
            </div>
          </div>
        )
      })}
      {taps.map((e, i) => {
        const tt = out(e.t)
        if (ms < tt - 220 || ms > tt + 600) return null
        const b = e.box!
        const cx = (b.x + b.w / 2) * K
        const cy = (b.y + b.h / 2) * K
        const dot = interpolate(ms, [tt - 220, tt - 60, tt + 180, tt + 380], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const press = interpolate(ms, [tt - 60, tt, tt + 140], [1, 0.82, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const rp = interpolate(ms, [tt, tt + 520], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
        const r = 22 * K * press
        return (
          <React.Fragment key={i}>
            {ms >= tt && (
              <div style={{ position: 'absolute', left: cx - 44 * K * rp - 8, top: cy - 44 * K * rp - 8, width: (88 * K * rp) + 16, height: (88 * K * rp) + 16, borderRadius: '50%', border: `${3 * K}px solid ${t.accent}`, opacity: 0.7 * (1 - rp) }} />
            )}
            <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'rgba(60,60,67,0.30)', border: `${1.5 * K}px solid rgba(255,255,255,0.85)`, boxShadow: '0 2px 10px rgba(0,0,0,0.18)', opacity: dot }} />
          </React.Fragment>
        )
      })}
    </AbsoluteFill>
  )
}

const ClipView: React.FC<{ clip: TLClip }> = ({ clip }) => {
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff' }}>
      <Video src={staticFile(clip.src)} trimBefore={Math.round((clip.fromMs / 1000) * fps)} playbackRate={clip.rate} muted objectFit="fill" style={{ width: '100%', height: '100%' }} />
      <ClipOverlay clip={clip} />
    </AbsoluteFill>
  )
}

const StatusBar: React.FC<{ time: string; color: string }> = ({ time, color }) => {
  const t = useTheme()
  const ink = luminance(color) > 0.36 ? PHONE.label : '#FFFFFF'
  return (
  <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: STATUS * K, background: color, fontFamily: t.font, color: ink }}>
    <div style={{ position: 'absolute', left: 52 * K, top: 15 * K, fontSize: 17 * K, fontWeight: 650, letterSpacing: -0.2 }}>{time}</div>
    {/* the Dynamic Island */}
    <div style={{ position: 'absolute', left: (CSS_W / 2 - 62) * K, top: 11 * K, width: 124 * K, height: 36 * K, borderRadius: 18 * K, background: '#000' }} />
    <svg style={{ position: 'absolute', right: 26 * K, top: 17 * K }} width={78 * K} height={14 * K} viewBox="0 0 78 14">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 5.5} y={10 - i * 3} width="3.6" height={4 + i * 3} rx="1" fill={ink} />
      ))}
      <path d="M33 5.2a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM35.6 8a6.2 6.2 0 0 1 7.8 0L41.8 9.7a3.8 3.8 0 0 0-4.6 0zM38.2 10.8a2.4 2.4 0 0 1 2.6 0L39.5 12.3z" fill={ink} />
      <rect x="52.5" y="1.5" width="22" height="11" rx="3.4" fill="none" stroke={ink} strokeOpacity="0.4" />
      <rect x="54.5" y="3.5" width="16" height="7" rx="1.8" fill={ink} />
      <rect x="75.6" y="5" width="1.6" height="4" rx="0.8" fill={ink} fillOpacity="0.4" />
    </svg>
  </div>
  )
}

export const PhoneSceneView: React.FC<{ scene: TLScene & { spec: PhoneSpec } }> = ({ scene }) => {
  const t = useTheme()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ms = (frame / fps) * 1000
  const keys = React.useMemo(() => cameraKeys(scene.clips, fps), [scene.clips, fps])
  const cam = cameraTransform(cameraAt(keys, ms))
  // the phone rises once the quiz has mostly faded
  const enter = spring({ frame: frame - 5, fps, config: { damping: 16, stiffness: 120 } })
  const cut = scene.spec.cutFrames ?? 6

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateY(${(1 - enter) * 420}px) scale(${0.9 + 0.1 * enter})`, transformOrigin: '540px 1200px' }}>
        <AbsoluteFill style={{ transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`, transformOrigin: '0 0' }}>
          {/* the phone */}
          <div
            style={{
              position: 'absolute',
              left: FRAME_LEFT,
              top: FRAME_TOP,
              width: FRAME_W,
              height: FRAME_H,
              borderRadius: 96,
              background: 'linear-gradient(145deg, #3a3a3c, #1c1c1e 40%, #2c2c2e)',
              // a paper-coloured rim so the dark phone separates from the dark backdrop
              boxShadow: `0 70px 140px rgba(0,0,0,0.55), 0 18px 40px rgba(0,0,0,0.35), 0 0 0 2px ${rgba(t.paper, 0.28)}, 0 0 60px ${rgba(t.accent, 0.12)}, inset 0 0 0 2px rgba(255,255,255,0.10)`,
            }}
          />
          <div style={{ position: 'absolute', left: SCREEN_LEFT, top: SCREEN_TOP, width: SCREEN_W, height: SCREEN_H, borderRadius: 78, overflow: 'hidden', background: '#fff' }}>
            <StatusBar time={scene.spec.statusBarTime ?? '9:41'} color={scene.spec.statusBarColor ?? '#FFFFFF'} />
            <div style={{ position: 'absolute', left: 0, top: STATUS * K, width: SCREEN_W, height: CSS_H * K, overflow: 'hidden' }}>
              <TransitionSeries>
                {scene.clips.flatMap((c, i) => {
                  const key = `${c.spec.name}#${c.segment}`
                  const seq = (
                    <TransitionSeries.Sequence key={`s-${key}`} durationInFrames={c.durationFrames} name={key}>
                      <ClipView clip={c} />
                    </TransitionSeries.Sequence>
                  )
                  // a new clip crossfades in; a later segment of the same clip is a hard jump cut
                  return i === 0 || c.segment > 0 ? [seq] : [<TransitionSeries.Transition key={`t-${key}`} presentation={fade()} timing={linearTiming({ durationInFrames: cut })} />, seq]
                })}
              </TransitionSeries>
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Absolute times (ms from the start of the video) of every tap the scene draws, for the tap sound. */
export function tapTimes(scene: TLScene, fps: number): number[] {
  const out: number[] = []
  for (const c of scene.clips) {
    if (c.spec.taps === false) continue
    for (const e of c.manifest.events) {
      if (e.kind !== 'tap' || e.t < c.fromMs || e.t > c.toMs) continue
      out.push(((scene.startFrame + c.startFrame) / fps) * 1000 + (e.t - c.fromMs) / c.rate)
    }
  }
  return out
}
