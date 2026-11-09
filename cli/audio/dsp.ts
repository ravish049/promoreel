// Small DSP toolkit shared by the music bed (synth.ts) and the sound effects (sfx.ts): a seeded PRNG, oscillators,
// envelopes and Butterworth filters. Buffers are Float32Array at 48 kHz; the maths runs in doubles.

export const SR = 48000
const TAU = 2 * Math.PI

/** Samples in `sec` seconds (floored, like numpy's int()). */
export const len = (sec: number) => Math.max(0, Math.floor(sec * SR))
export const dbToGain = (db: number) => 10 ** (db / 20)

/** A seeded PRNG (mulberry32), so the same job always gives the same noise. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0
  }
  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  uniform(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  /** Standard normal (Box–Muller). */
  gauss(): number {
    const u = 1 - this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * this.next())
  }
  noise(n: number): Float32Array {
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) out[i] = this.gauss()
    return out
  }
}

/** Note name ("A4", "F#2") to Hz, A4 = 440. */
export function hz(note: string): number {
  const names: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 }
  const semis = names[note.slice(0, -1)]
  if (semis === undefined) throw new Error(`unknown note ${note}`)
  return 440 * 2 ** ((semis + (Number(note.slice(-1)) - 4) * 12) / 12)
}

/** Adds `sig * gain` into `buf` starting at `atSec` (clipped at both ends). */
export function place(buf: Float32Array, sig: Float32Array, atSec: number, gain = 1) {
  let i = Math.round(atSec * SR)
  let from = 0
  if (i < 0) {
    from = -i
    i = 0
  }
  const end = Math.min(buf.length, i + sig.length - from)
  for (let k = i; k < end; k++) buf[k] += sig[from + k - i] * gain
}

/** Attack / release envelope: squared ramps in and out, 1 in between. */
export function env(n: number, a: number, r: number): Float32Array {
  const e = new Float32Array(n).fill(1)
  const na = Math.max(1, Math.floor(a * SR))
  const nr = Math.max(1, Math.floor(r * SR))
  for (let i = 0; i < Math.min(na, n); i++) e[i] = (na > 1 ? i / (na - 1) : 1) ** 2
  if (nr < n) for (let i = 0; i < nr; i++) e[n - nr + i] *= (nr > 1 ? 1 - i / (nr - 1) : 0) ** 2
  return e
}

/** Multiplies `buf` in place by exp(-t / tau). */
export function decay(buf: Float32Array, tau: number): Float32Array {
  const d = Math.exp(-1 / (SR * tau))
  let g = 1
  for (let i = 0; i < buf.length; i++) {
    buf[i] *= g
    g *= d
  }
  return buf
}

export function mul(a: Float32Array, b: Float32Array): Float32Array {
  for (let i = 0; i < a.length; i++) a[i] *= b[i]
  return a
}

export function scale(a: Float32Array, g: number): Float32Array {
  for (let i = 0; i < a.length; i++) a[i] *= g
  return a
}

/** Adds amp·sin(2πft + phase) into `out` (a two-term recurrence, far cheaper than Math.sin per sample). */
export function addSine(out: Float32Array, f: number, amp: number, phase = 0) {
  if (f <= 0 || f >= SR / 2) return
  const w = (TAU * f) / SR
  const c = 2 * Math.cos(w)
  let s2 = Math.sin(phase - w)
  let s1 = Math.sin(phase)
  for (let i = 0; i < out.length; i++) {
    out[i] += amp * s1
    const s0 = c * s1 - s2
    s2 = s1
    s1 = s0
  }
}

/** A sine whose frequency follows `freq(t)` (phase accumulated per sample): kicks, booms, sweeps. */
export function sweep(n: number, freq: (t: number) => number): Float32Array {
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    ph += (TAU * freq(i / SR)) / SR
    out[i] = Math.sin(ph)
  }
  return out
}

type Coef = { b0: number; b1: number; b2: number; a1: number; a2: number }

function runBiquad(x: Float32Array, k: Coef) {
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]
    const y0 = k.b0 * x0 + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    x[i] = y0
  }
}

function biquad(x: Float32Array, hp: boolean, fc: number, q: number) {
  const w0 = (TAU * Math.min(fc, SR * 0.45)) / SR
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const a0 = 1 + alpha
  const b0 = (hp ? (1 + cos) / 2 : (1 - cos) / 2) / a0
  runBiquad(x, { b0, b1: (hp ? -2 : 2) * b0, b2: b0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 })
}

function onePole(x: Float32Array, hp: boolean, fc: number) {
  const K = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR)
  const b0 = hp ? 1 / (1 + K) : K / (1 + K)
  runBiquad(x, { b0, b1: hp ? -b0 : b0, b2: 0, a1: (K - 1) / (K + 1), a2: 0 })
}

/** Butterworth stages for an order: [one-pole?, biquad Qs]. */
const STAGES: Record<number, { pole: boolean; qs: number[] }> = { 1: { pole: true, qs: [] }, 2: { pole: false, qs: [Math.SQRT1_2] }, 3: { pole: true, qs: [1] }, 4: { pole: false, qs: [0.5412, 1.3066] } }

/** Butterworth high-pass at `lo` and/or low-pass at `hi`, in place. Order 1–4 (default 2). */
export function filter(x: Float32Array, o: { lo?: number; hi?: number; order?: number }): Float32Array {
  const st = STAGES[o.order ?? 2]
  if (!st) throw new Error(`filter order ${o.order} not supported`)
  for (const [fc, hp] of [
    [o.lo, true],
    [o.hi, false],
  ] as const) {
    if (!fc) continue
    if (st.pole) onePole(x, hp, fc)
    for (const q of st.qs) biquad(x, hp, fc, q)
  }
  return x
}
