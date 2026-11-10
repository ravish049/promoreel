// The music bed: a warm groove at the job's tempo, arranged by sections, with sound effects at the timeline's moments,
// ducked under every voice span, soft-limited and peaked at −2 dBFS (the final loudness is set by master.ts).
// Synthesised in TypeScript, nothing downloaded; the same job always gives a byte-identical WAV (seeded noise).
// Ported from scripts/insta-c-music.py (CrewDash videos).
//
// Sections set the arrangement from their atMs until the next section:
//   intro    a dark pad, a soft bass pulse and a heartbeat kick (room for a question or a hook)
//   build    the groove: kick, clap with ghost notes, swung 16th hats, syncopated bass, 7th / 9th pads and piano stabs
//   drop     the lift: brighter pads, an extra kick, a plucked arpeggio; a crash lands on its first beat
//   resolve  a resolved chord that rings out with a soft arpeggio and a crash (the logo / CTA)
// With `music.src` the user's own track (decoded by ffmpeg) replaces the synthesised bed and is ducked the same way.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Rng, SR, addSine, dbToGain, decay, env, filter, hz, len, mul, place, scale, sweep } from './dsp'
import { chime, click, impact, riser, tick, whoosh } from './sfx'
import { encodeWav } from './wav'

export type SectionKind = 'intro' | 'build' | 'drop' | 'resolve'
export type SfxKind = 'whoosh' | 'swish' | 'riser' | 'impact' | 'chime' | 'click' | 'tick'

export type AudioJob = {
  durationMs: number
  bpm: number
  /** Where the arrangement changes. Before the first section, the first section's kind plays. None: all `build`. */
  sections: { atMs: number; kind: SectionKind }[]
  /**
   * Sound effects. `atMs` is when the effect starts, except a riser, which *peaks* at `atMs` (it swells into the
   * moment). `durMs` sets the length of a whoosh (default 900) or a riser (default 1400); `gainDb` trims one effect.
   */
  sfx: { atMs: number; kind: SfxKind; durMs?: number; gainDb?: number }[]
  /** Where the voice speaks: music ducks by `duckDb` and effects by `sfxDuckDb` inside each span. */
  voiceSpans: { startMs: number; endMs: number }[]
  /** How far the music drops under the voice, in dB (default −9; the sign is ignored). */
  duckDb?: number
  /** How far the effects drop under the voice, in dB (default −3; the sign is ignored). */
  sfxDuckDb?: number
  /** Shifts the bar grid so a downbeat lands on a cut (default 0). */
  offsetMs?: number
  /** Noise seed (default 5). The same job and seed give byte-identical output. */
  seed?: number
  /** The user's own track instead of the synthesised bed: a path (absolute, or relative to the working directory). */
  music?: { src: string; gainDb?: number }
}

export type BedResult = { path: string; durationMs: number; peakDbfs: number; source: 'synth' | 'track' }

export const DEFAULT_DUCK_DB = -9
export const DEFAULT_SFX_DUCK_DB = -3
export const PEAK_DBFS = -2
/**
 * Fade-in at the very start. Loud audio in the first AAC frames makes ffmpeg's encoder overshoot by several dB
 * (measured: a bed limited to −2.5 dBFS came back at +3.3 dBTP with a 20 ms fade), more than master.ts can correct;
 * with 80 ms the overshoot stays small enough for its limiter retry.
 */
const FADE_IN_S = 0.08

// ---------------------------------------------------------------- instruments

function pad(rng: Rng, notes: string[], dur: number, bright: number): Float32Array {
  const s = new Float32Array(len(dur))
  for (const note of notes) {
    for (const det of [-0.005, 0, 0.005]) {
      const f = hz(note) * (1 + det)
      for (let k = 1; k < 8; k++) addSine(s, f * k, 1 / k ** 1.15, rng.uniform(0, 6.28))
    }
  }
  filter(s, { hi: bright })
  return scale(mul(s, env(s.length, 0.25, 0.35)), 1 / (notes.length * 7))
}

/** A soft electric-piano stab: a sine with a bell-like 2-op FM attack. */
function epiano(notes: string[], dur: number): Float32Array {
  const n = len(dur)
  const s = new Float32Array(n)
  for (const note of notes) {
    const w = 2 * Math.PI * hz(note)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const mod = Math.sin(w * 14 * t) * 1.6 * Math.exp(-t / 0.05)
      s[i] += Math.sin(w * t + mod) * Math.exp(-t / 0.35)
    }
  }
  return scale(mul(s, env(n, 0.003, 0.08)), 1 / notes.length)
}

function pluck(note: string, dur: number, bright: number): Float32Array {
  const n = len(dur)
  const s = new Float32Array(n)
  const f = hz(note)
  addSine(s, f, 1)
  addSine(s, 2 * f, 0.4 * bright)
  addSine(s, 3 * f, 0.15 * bright)
  return mul(decay(s, 0.08 + 0.05 * bright), env(n, 0.002, 0.03))
}

function bass(note: string, dur: number): Float32Array {
  const n = len(dur)
  const s = new Float32Array(n)
  const f = hz(note)
  addSine(s, f, 1)
  addSine(s, 2 * f, 0.3)
  addSine(s, 3 * f, 0.1)
  for (let i = 0; i < n; i++) s[i] = Math.tanh(1.8 * s[i])
  return mul(filter(decay(s, 0.18), { hi: 900 }), env(n, 0.004, 0.04))
}

function kick(rng: Rng): Float32Array {
  const n = len(0.36)
  const body = decay(
    sweep(n, (t) => 44 + 120 * Math.exp(-t / 0.03)),
    0.15,
  )
  const tap = scale(decay(rng.noise(n), 0.002), 0.15)
  for (let i = 0; i < n; i++) body[i] += tap[i]
  return mul(body, env(n, 0.001, 0.05))
}

function clap(rng: Rng, ghost = false): Float32Array {
  const n = len(0.18)
  const s = filter(rng.noise(n), { lo: 900, hi: 5200 })
  const tau = ghost ? 0.03 : 0.05
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let e = Math.exp(-t / tau)
    for (const d of [0, 0.009, 0.018]) if (t >= d) e += 0.5 * Math.exp(-(t - d) / 0.006)
    s[i] *= e * (ghost ? 0.18 : 0.42)
  }
  return s
}

function hat(rng: Rng, open: boolean, vel: number): Float32Array {
  const s = filter(rng.noise(len(open ? 0.16 : 0.04)), { lo: 7500, order: 3 })
  return scale(decay(s, open ? 0.06 : 0.012), 0.3 * vel)
}

function crash(rng: Rng, dur = 2.2): Float32Array {
  const n = len(dur)
  const s = scale(decay(filter(rng.noise(n), { lo: 3500 }), 0.7), 0.35)
  const sub = decay(
    sweep(n, (t) => 38 + 40 * Math.exp(-t / 0.08)),
    0.5,
  )
  for (let i = 0; i < n; i++) s[i] += sub[i] * 0.9
  return mul(s, env(n, 0.002, 0.4))
}

// ---------------------------------------------------------------- the arrangement

/** One per bar: Fmaj7 – G6/9 – Em7 – Am9, voiced close. [pad, piano stab, bass, arpeggio] */
const CHORDS: [string[], string[], string[], string[]][] = [
  [['F2', 'C3', 'E3', 'A3', 'C4', 'E4'], ['A3', 'C4', 'E4'], ['F1', 'F2', 'C2', 'E2'], ['C5', 'E5', 'A5', 'E5']],
  [['G2', 'D3', 'E3', 'A3', 'B3', 'D4'], ['B3', 'D4', 'E4'], ['G1', 'G2', 'D2', 'F#2'], ['B4', 'D5', 'G5', 'D5']],
  [['E2', 'B2', 'D3', 'G3', 'B3', 'D4'], ['G3', 'B3', 'D4'], ['E1', 'E2', 'B1', 'D2'], ['B4', 'E5', 'G5', 'E5']],
  [['A2', 'E3', 'G3', 'B3', 'C4', 'E4'], ['G3', 'B3', 'C4'], ['A1', 'A2', 'E2', 'G2'], ['C5', 'E5', 'A5', 'E5']],
]
const RESOLVED = ['C2', 'G2', 'E3', 'B3', 'D4', 'G4']
const RESOLVE_ARP = ['G4', 'B4', 'D5', 'E5', 'G5', 'B5', 'D6', 'G5']

type Span = { kind: SectionKind; start: number; end: number }

function spans(job: AudioJob, dur: number): Span[] {
  const sorted = [...job.sections].sort((a, b) => a.atMs - b.atMs)
  if (sorted.length === 0) return [{ kind: 'build', start: 0, end: dur }]
  return sorted.map((s, i) => ({ kind: s.kind, start: i === 0 ? Math.min(0, s.atMs / 1000) : s.atMs / 1000, end: i + 1 < sorted.length ? sorted[i + 1].atMs / 1000 : dur }))
}

const kindAt = (sp: Span[], t: number): SectionKind => (sp.find((s) => t >= s.start && t < s.end) ?? sp[sp.length - 1]).kind

function synthMusic(job: AudioJob, rng: Rng, n: number): Float32Array {
  const dur = job.durationMs / 1000
  const beat = 60 / job.bpm
  const bar = 4 * beat
  const off = (job.offsetMs ?? 0) / 1000
  const sp = spans(job, dur)
  const swing = (i16: number) => ((i16 + (i16 % 2 === 1 ? 0.12 : 0)) * beat) / 4
  const music = new Float32Array(n)
  const pads = new Float32Array(n)
  const drums = new Float32Array(n)
  const kickEnv = new Float32Array(n)
  const sidechain = decay(new Float32Array(len(0.3)).fill(1), 0.09)

  const firstBar = Math.floor(-off / bar)
  const lastBar = Math.ceil((dur - off) / bar)
  for (let b = firstBar; b <= lastBar; b++) {
    const t0 = off + b * bar
    if (t0 > dur) break
    const kind = kindAt(sp, Math.max(0, t0 + 0.01))
    if (kind === 'resolve') continue
    const [pn, stab, bl, arp] = CHORDS[((b % 4) + 4) % 4]
    const quiet = kind === 'intro'
    const lift = kind === 'drop'
    place(pads, pad(rng, pn, bar + 0.3, quiet ? 900 : lift ? 2200 : 1500), t0, quiet ? 0.55 : 0.8)
    if (quiet) {
      // a soft pulse and a heartbeat kick
      for (let q = 0; q < 4; q++) place(music, bass(bl[0], 0.3), t0 + q * beat, 0.18)
      place(drums, kick(rng), t0, 0.35)
      continue
    }
    // electric-piano stabs on the syncopations
    for (const pos of [0.5, 1.75, 2.5, 3.25]) place(music, epiano(stab, 0.45), t0 + pos * beat, 0.16)
    // bass: root, octave pop, fifth, root, approach
    for (const [pos, k, d] of [
      [0, 0, 0.3],
      [0.75, 1, 0.15],
      [1.5, 2, 0.22],
      [2, 0, 0.3],
      [2.75, 1, 0.15],
      [3.5, 3, 0.22],
    ])
      place(music, bass(bl[k], d), t0 + pos * beat, 0.42)
    for (let q = 0; q < 4; q++) {
      const tb = t0 + q * beat
      if (q === 0 || q === 2 || (q === 1 && lift)) {
        place(drums, kick(rng), tb, 0.9)
        place(kickEnv, sidechain, tb)
      }
      if (q === 1 || q === 3) place(drums, clap(rng), tb)
    }
    place(drums, kick(rng), t0 + 2.75 * beat, 0.55)
    place(drums, clap(rng, true), t0 + 3.75 * beat)
    for (let i16 = 0; i16 < 16; i16++) {
      const vel = i16 % 4 === 2 ? 1 : i16 % 2 === 0 ? 0.55 : 0.35
      place(drums, hat(rng, i16 === 14, vel), t0 + swing(i16))
    }
    if (lift) for (let i16 = 0; i16 < 16; i16++) place(music, pluck(arp[i16 % 4], 0.26, 1.3), t0 + swing(i16), i16 % 2 === 0 ? 0.1 : 0.06)
  }

  for (const s of sp) {
    if (s.kind === 'resolve') {
      // a long resolved chord with a soft arpeggio
      const at = Math.max(0, s.start)
      place(pads, pad(rng, RESOLVED, s.end - at + 0.3, 2400), at)
      RESOLVE_ARP.forEach((note, i) => place(music, pluck(note, 0.9, 1.2), at + (i * beat) / 2, 0.1 * (1 - i / 12)))
      place(music, bass('C1', 1.8), at, 0.5)
    }
    if (s.kind === 'drop' || s.kind === 'resolve') {
      // a hit on the section's first beat, kept clear of the fade-in
      const at = Math.max(FADE_IN_S, s.start)
      place(drums, crash(rng), at, 0.8)
      place(drums, kick(rng), at)
    }
  }

  for (let i = 0; i < n; i++) {
    const t = i / SR
    const fade = Math.min(1, t / FADE_IN_S) * Math.max(0, Math.min(1, (dur - t) / 1.2)) ** 1.3
    music[i] = (music[i] + pads[i] * (1 - 0.5 * Math.min(1, kickEnv[i])) + drums[i] * 0.85) * fade
  }
  return music
}

/** Decodes the user's track with ffmpeg to 48 kHz stereo, trimmed or padded to the job, with fades at both ends. */
function decodeTrack(job: AudioJob, n: number): Float32Array[] {
  const m = job.music
  if (!m) throw new Error('no music.src')
  const src = path.resolve(m.src)
  if (!fs.existsSync(src)) throw new Error(`music.src not found: ${src}`)
  const dur = job.durationMs / 1000
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-t', String(dur + 0.1), '-vn', '-ar', String(SR), '-ac', '2', '-f', 'f32le', '-'], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] })
  const g = dbToGain(m.gainDb ?? 0)
  const ch = [new Float32Array(n), new Float32Array(n)]
  const frames = Math.min(n, Math.floor(raw.length / 8))
  for (let i = 0; i < frames; i++) {
    const t = i / SR
    const fade = Math.min(1, t / FADE_IN_S) * Math.max(0, Math.min(1, (dur - t) / 1.5))
    ch[0][i] = raw.readFloatLE(i * 8) * g * fade
    ch[1][i] = raw.readFloatLE(i * 8 + 4) * g * fade
  }
  return ch
}

function synthSfx(job: AudioJob, rng: Rng, n: number): Float32Array {
  const fx = new Float32Array(n)
  for (const e of [...job.sfx].sort((a, b) => a.atMs - b.atMs)) {
    const at = e.atMs / 1000
    const g = dbToGain(e.gainDb ?? 0)
    const d = e.durMs !== undefined ? e.durMs / 1000 : undefined
    if (e.kind === 'whoosh') place(fx, whoosh(rng, d ?? 0.9), at, g)
    else if (e.kind === 'swish') place(fx, whoosh(rng, d ?? 0.32), at, 0.5 * g)
    else if (e.kind === 'riser') place(fx, riser(rng, d ?? 1.4), at - (d ?? 1.4), 0.8 * g)
    else if (e.kind === 'impact') place(fx, impact(rng), at, g)
    else if (e.kind === 'chime') place(fx, chime(), at, g)
    else if (e.kind === 'click') place(fx, click(), at, 0.5 * g)
    else if (e.kind === 'tick') place(fx, tick(), at, 0.24 * g)
  }
  return fx
}

/** 1 outside voice spans, `floor` inside, with linear ramps `att` s before each span and `rel` s after it. */
function duckCurve(voiceSpans: AudioJob['voiceSpans'], n: number, floor: number, att: number, rel: number): Float32Array {
  const c = new Float32Array(n).fill(1)
  for (const v of voiceSpans) {
    const s = v.startMs / 1000
    const e = v.endMs / 1000
    const i0 = Math.max(0, Math.floor((s - att) * SR))
    const i1 = Math.min(n, Math.ceil((e + rel) * SR) + 1)
    for (let i = i0; i < i1; i++) {
      const t = i / SR
      const k = t < s ? (s - t) / att : t > e ? (t - e) / rel : 0
      c[i] = Math.min(c[i], floor + (1 - floor) * Math.min(1, k))
    }
  }
  return c
}

/** Unity below the knee, a tanh shoulder above it: shaves peaks without touching the body of the mix. */
function softClip(x: number, knee = 0.6): number {
  const a = Math.abs(x)
  return a <= knee ? x : Math.sign(x) * (knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee)))
}

/**
 * The bed's final mix: music (one channel, given pseudo-stereo width, or two) ducked under the voice, effects lightly
 * ducked, soft-clipped, then scaled so the peak sits at −2 dBFS. Returns [left, right].
 */
export function mixBed(music: Float32Array[], fx: Float32Array, job: Pick<AudioJob, 'voiceSpans' | 'duckDb' | 'sfxDuckDb'>): [Float32Array, Float32Array] {
  const n = fx.length
  const dm = duckCurve(job.voiceSpans, n, dbToGain(-Math.abs(job.duckDb ?? DEFAULT_DUCK_DB)), 0.08, 0.3)
  const df = duckCurve(job.voiceSpans, n, dbToGain(-Math.abs(job.sfxDuckDb ?? DEFAULT_SFX_DUCK_DB)), 0.05, 0.2)
  const mixCh = (m: Float32Array) => Float32Array.from(m, (v, i) => softClip(v * dm[i] * 0.75 + fx[i] * df[i]))
  const left = mixCh(music[0])
  let right: Float32Array
  if (music.length > 1) right = mixCh(music[1])
  else {
    // a little width: the right channel carries an 11 ms echo of the left
    const dly = Math.floor(0.011 * SR)
    right = Float32Array.from(left, (v, i) => (i >= dly ? 0.82 * v + 0.18 * left[i - dly] : v))
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  if (peak > 0) {
    const g = dbToGain(PEAK_DBFS) / peak
    scale(left, g)
    scale(right, g)
  }
  return [left, right]
}

function validate(job: AudioJob) {
  if (!(job.durationMs > 0)) throw new Error(`audio job: durationMs must be > 0 (got ${job.durationMs})`)
  if (!(job.bpm >= 40 && job.bpm <= 240)) throw new Error(`audio job: bpm must be 40–240 (got ${job.bpm})`)
  for (const v of job.voiceSpans) if (!(v.endMs >= v.startMs)) throw new Error(`audio job: voice span ends before it starts (${v.startMs}–${v.endMs} ms)`)
}

/** Renders the bed as [left, right] at 48 kHz. */
export function renderBed(job: AudioJob): [Float32Array, Float32Array] {
  validate(job)
  const n = Math.round((job.durationMs / 1000) * SR)
  const rng = new Rng(job.seed ?? 5)
  const music = job.music?.src ? decodeTrack(job, n) : [synthMusic(job, rng, n)]
  return mixBed(music, synthSfx(job, rng, n), job)
}

/** Writes the bed as a 48 kHz stereo 16-bit WAV. */
export function writeBed(job: AudioJob, out: string): BedResult {
  const [l, r] = renderBed(job)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, encodeWav([l, r], SR))
  let peak = 0
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]))
  return { path: out, durationMs: Math.round((l.length / SR) * 1000), peakDbfs: Math.round(20 * Math.log10(Math.max(peak, 1e-9)) * 100) / 100, source: job.music?.src ? 'track' : 'synth' }
}
