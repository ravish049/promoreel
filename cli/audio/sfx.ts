// Sound effects, synthesised (nothing downloaded): the one-shots the music bed mixes in at a timeline's moments, and the
// standalone click.wav / tick.wav the launch style plays on cursor clicks and checkmarks.
// Ported from scripts/insta-c-music.py and scripts/make-launch-audio.py in the CrewDash videos.
import fs from 'node:fs'
import path from 'node:path'
import { Rng, SR, addSine, decay, env, filter, len, mul, scale, sweep } from './dsp'
import { encodeWav } from './wav'

/** A breath of filtered noise that brightens as it passes: camera moves. */
export function whoosh(rng: Rng, dur: number): Float32Array {
  const n = len(dur)
  const x = rng.noise(n)
  const lo = filter(Float32Array.from(x), { lo: 300, hi: 1600 })
  const hi = filter(x, { lo: 1800, hi: 7000 })
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const k = i / SR / dur
    out[i] = (lo[i] * (1 - k) + hi[i] * k) * Math.sin(Math.PI * k) ** 1.6 * 0.32
  }
  return out
}

/** Noise and a rising tone that swell into a moment; the swell peaks at the end. */
export function riser(rng: Rng, dur: number): Float32Array {
  const n = len(dur)
  const x = filter(rng.noise(n), { lo: 600, hi: 8000 })
  const tone = sweep(n, (t) => 180 + 900 * (t / dur) ** 2)
  for (let i = 0; i < n; i++) {
    const k = (i / SR / dur) ** 2
    x[i] = (x[i] * k * 0.5 + 0.22 * tone[i] * k) * k
  }
  return x
}

/** A low boom with a soft thump: the logo landing. */
export function impact(rng: Rng): Float32Array {
  const n = len(1.6)
  const boom = decay(
    sweep(n, (t) => 32 + 70 * Math.exp(-t / 0.05)),
    0.55,
  )
  const thump = scale(decay(filter(rng.noise(n), { hi: 900 }), 0.08), 0.5)
  for (let i = 0; i < n; i++) boom[i] += thump[i]
  return scale(mul(boom, env(n, 0.001, 0.3)), 0.9)
}

/** A bell-like ding: a step completing. */
export function chime(): Float32Array {
  const n = len(0.9)
  const out = new Float32Array(n)
  for (const [f, a, d] of [
    [1568, 1, 0.45],
    [2349, 0.45, 0.3],
    [3136, 0.25, 0.2],
    [4186, 0.12, 0.12],
  ]) {
    const partial = new Float32Array(n)
    addSine(partial, f, a)
    decay(partial, d)
    for (let i = 0; i < n; i++) out[i] += partial[i]
  }
  return scale(mul(out, env(n, 0.002, 0.1)), 0.35)
}

/** A short bright tick with a small low body: cursor clicks. Peak about 1 before the in-mix gain. */
export function click(): Float32Array {
  const n = len(0.05)
  const bright = new Float32Array(n)
  addSine(bright, 2300, 0.55)
  addSine(bright, 4700, 0.25)
  decay(bright, 0.006)
  const body = new Float32Array(n)
  addSine(body, 210, 0.6)
  decay(body, 0.012)
  for (let i = 0; i < n; i++) bright[i] += body[i]
  return mul(bright, env(n, 0.0005, 0.01))
}

/** A soft glassy tink: cards landing, checkmarks. */
export function tick(): Float32Array {
  const n = len(0.16)
  const out = new Float32Array(n)
  addSine(out, 2637, 1)
  addSine(out, 3951, 0.35)
  decay(out, 0.04)
  return mul(out, env(n, 0.001, 0.02))
}

/**
 * A felt marker scratching across paper: `strokes` back-and-forth strokes of band-passed noise filling `dur`, each
 * swelling in and easing out with a short lift at the turn, a little brighter on the push than on the pull, with the
 * grain of the paper in it. Peak 0.5 before the in-mix gain. Match `strokes` to the drawn scribble's.
 */
export function scribble(rng: Rng, dur: number, strokes = Math.max(3, Math.round(dur / 0.12))): Float32Array {
  const n = len(dur)
  const out = new Float32Array(n)
  if (n === 0) return out
  // two bands of paper noise: a body and a bright scratch; the mix shifts per stroke
  const body = filter(rng.noise(n), { lo: 900, hi: 3200 })
  const bright = filter(rng.noise(n), { lo: 3200, hi: 9000 })
  // the paper's grain: slow random wobble on the level (noise low-passed at ~40 Hz)
  const grain = filter(rng.noise(n), { hi: 40, order: 2 })
  let gmax = 0
  for (const v of grain) gmax = Math.max(gmax, Math.abs(v))
  const per = n / strokes
  for (let s = 0; s < strokes; s++) {
    const i0 = Math.floor(s * per)
    const i1 = Math.min(n, Math.floor((s + 1) * per))
    const push = s % 2 === 0
    const level = rng.uniform(0.75, 1)
    const tilt = push ? rng.uniform(0.55, 0.75) : rng.uniform(0.3, 0.45)
    for (let i = i0; i < i1; i++) {
      const k = (i - i0) / Math.max(1, i1 - i0)
      // in fast, held, out a little slower, and a lift at the turn (the last 12 % of the stroke)
      const shape = Math.min(1, k / 0.08) * Math.min(1, Math.max(0, (0.88 - k) / 0.2)) ** 1.5
      const speed = Math.sin(Math.PI * Math.min(1, k / 0.88)) ** 0.5
      const g = 0.75 + 0.25 * (gmax > 0 ? grain[i] / gmax : 0)
      out[i] = (body[i] * (1 - tilt) + bright[i] * tilt) * shape * (0.4 + 0.6 * speed) * level * g
    }
  }
  return peakTo(mul(out, env(n, 0.004, 0.03)), 0.5)
}

function peakTo(a: Float32Array, peak: number): Float32Array {
  let m = 0
  for (const v of a) m = Math.max(m, Math.abs(v))
  return m > 0 ? scale(a, peak / m) : a
}

/** Writes click.wav (peak 0.7) and tick.wav (peak 0.6), 48 kHz mono 16-bit, into `dir`. */
export function writeLaunchSfx(dir: string): { click: string; tick: string } {
  fs.mkdirSync(dir, { recursive: true })
  const out = { click: path.join(dir, 'click.wav'), tick: path.join(dir, 'tick.wav') }
  fs.writeFileSync(out.click, encodeWav([peakTo(click(), 0.7)], SR))
  fs.writeFileSync(out.tick, encodeWav([peakTo(tick(), 0.6)], SR))
  return out
}
