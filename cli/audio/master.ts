// Masters a rendered mp4's audio: a two-pass ffmpeg loudnorm to −15 LUFS integrated (true peak −1.5 dBFS, LRA 11),
// with a 4× oversampled limiter in front so the second pass stays linear. AAC 256k; the video
// stream is copied untouched. Reports the measured result as one JSON progress line ("master" step).
// Ported from scripts/insta-c-master.ts (CrewDash videos).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { step as makeStep, type Step } from '../lib/progress'
import { run } from '../lib/sh'

export const MASTER_TARGET = { I: -15, TP: -1.5, LRA: 11 }

export type Loudness = { i: number; tp: number; lra: number; thresh: number; offset: number }
export type MasterResult = { path: string; before: { lufs: number; truePeak: number }; lufs: number; truePeak: number; lra: number }

function ffmpegStderr(args: string[]): string {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}): ${r.stderr.trim().split('\n').slice(-3).join(' ')}`)
  return r.stderr
}

/**
 * Measures a file's audio with loudnorm's first pass (integrated LUFS, true peak, LRA, threshold, target offset),
 * optionally after a filter chain `pre`.
 */
export function measureLoudness(file: string, pre = '', target = MASTER_TARGET): Loudness {
  const ln = `loudnorm=I=${target.I}:TP=${target.TP}:LRA=${target.LRA}:print_format=json`
  const err = ffmpegStderr(['-hide_banner', '-nostats', '-i', file, '-vn', '-af', pre ? `${pre},${ln}` : ln, '-f', 'null', '-'])
  const json = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)
  const m = JSON.parse(json) as Record<string, string>
  const out = { i: Number(m.input_i), tp: Number(m.input_tp), lra: Number(m.input_lra), thresh: Number(m.input_thresh), offset: Number(m.target_offset) }
  if (!Number.isFinite(out.i) || !Number.isFinite(out.tp)) throw new Error(`${file}: the audio is silent (loudnorm measured ${m.input_i} LUFS)`)
  return out
}

/** Gain to the target, then a 4× oversampled true-peak limiter at `limitDb`, so loudnorm's linear mode always fits. */
const preChain = (gainDb: number, limitDb: number) =>
  [`volume=${gainDb.toFixed(2)}dB`, 'aresample=192000', `alimiter=limit=${(10 ** (limitDb / 20)).toFixed(4)}:attack=0.5:release=60:level=false:latency=true`, 'aresample=48000'].join(',')

/**
 * Masters `input` to −15 LUFS / −1.5 dBTP, writing `out` (default: replaces `input`). Emits a "master" progress line
 * with the measured loudness before and after, and a warning if the result still misses the target.
 *
 * Pass 1 measures the source. The gain to the target goes in front of an oversampled limiter (1.5 dB under the true-peak
 * target), so that loudnorm's second pass can stay linear (no dynamic fallback, which lands short of the target).
 * loudnorm then measures that chain and applies the measured values. The AAC encode is measured; if the codec pushed
 * the peak over or the level is off, the limit and gain are corrected and it is encoded again (up to two retries).
 */
export function masterMp4(input: string, opts: { out?: string; step?: Step } = {}): MasterResult {
  const s = opts.step ?? makeStep('master')
  const out = opts.out ?? input
  const T = MASTER_TARGET
  if (!fs.existsSync(input)) throw new Error(`master: ${input} not found`)
  if (!run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', input]).trim()) throw new Error(`master: ${input} has no audio stream`)
  s.start(`mastering ${path.basename(input)} to ${T.I} LUFS`)
  const m0 = measureLoudness(input)
  s.progress(20, `measured ${m0.i} LUFS · ${m0.tp} dBTP`)
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  const tmp = out.replace(/(\.[^./]+)?$/, '.mastering.mp4')
  let gain = T.I - m0.i
  let limit = T.TP - 1.5
  let a: Loudness | undefined
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const pre = preChain(gain, limit)
      const m = measureLoudness(input, pre)
      const af = `${pre},loudnorm=I=${T.I}:TP=${T.TP}:LRA=${T.LRA}:measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true,aresample=48000`
      ffmpegStderr(['-hide_banner', '-nostats', '-y', '-i', input, '-map', '0:v?', '-map', '0:a:0', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', tmp])
      a = measureLoudness(tmp)
      s.progress(50 + attempt * 20, `pass ${attempt + 1}: ${a.i} LUFS · ${a.tp} dBTP`)
      const over = a.tp - T.TP
      if (over <= 0 && Math.abs(a.i - T.I) <= 0.3) break
      if (over > 0) limit -= over + 0.5
      gain += T.I - a.i
    }
    fs.renameSync(tmp, out)
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  if (!a) throw new Error('master: no pass ran')
  const result: MasterResult = { path: out, before: { lufs: m0.i, truePeak: m0.tp }, lufs: a.i, truePeak: a.tp, lra: a.lra }
  if (Math.abs(a.i - T.I) > 0.5) s.warn(`loudness ${a.i} LUFS is off the ${T.I} LUFS target`)
  if (a.tp > T.TP) s.warn(`true peak ${a.tp} dBTP is over the ${T.TP} dBTP target`)
  s.done(`${a.i} LUFS · ${a.tp} dBTP (was ${m0.i} LUFS · ${m0.tp} dBTP)`, result)
  return result
}
