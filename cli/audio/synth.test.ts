// Unit tests for the music bed: ducking depth, the peak limit and determinism.   npx tsx --test cli/audio/synth.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SR, addSine } from './dsp'
import { PEAK_DBFS, mixBed, writeBed, type AudioJob } from './synth'
import { decodeWav } from './wav'

const rmsDb = (a: Float32Array, fromS: number, toS: number) => {
  let sum = 0
  const i0 = Math.round(fromS * SR)
  const i1 = Math.round(toS * SR)
  for (let i = i0; i < i1; i++) sum += a[i] * a[i]
  return 10 * Math.log10(sum / (i1 - i0))
}

const tone = (sec: number, amp: number) => {
  const a = new Float32Array(sec * SR)
  addSine(a, 440, amp)
  return a
}

for (const duckDb of [-9, -6, -12]) {
  test(`ducking lowers a steady tone by ${duckDb} dB inside a voice span`, () => {
    const music = tone(4, 0.4)
    const [left, right] = mixBed([music], new Float32Array(music.length), { voiceSpans: [{ startMs: 1500, endMs: 3000 }], duckDb })
    for (const ch of [left, right]) {
      const outside = rmsDb(ch, 0.2, 1.3)
      const inside = rmsDb(ch, 1.7, 2.9)
      assert.ok(Math.abs(inside - outside - duckDb) <= 0.5, `ducked by ${(inside - outside).toFixed(2)} dB, wanted ${duckDb}`)
    }
  })
}

test('effects duck by sfxDuckDb, independently of the music', () => {
  const fx = tone(4, 0.3)
  const [left] = mixBed([new Float32Array(fx.length)], fx, { voiceSpans: [{ startMs: 1500, endMs: 3000 }], sfxDuckDb: -3 })
  const d = rmsDb(left, 1.7, 2.9) - rmsDb(left, 0.2, 1.3)
  assert.ok(Math.abs(d + 3) <= 0.5, `effects ducked by ${d.toFixed(2)} dB, wanted -3`)
})

const job: AudioJob = {
  durationMs: 6000,
  bpm: 112,
  sections: [
    { atMs: 0, kind: 'intro' },
    { atMs: 1500, kind: 'build' },
    { atMs: 3000, kind: 'drop' },
    { atMs: 4500, kind: 'resolve' },
  ],
  // stacked effects to push the pre-limit peak well over full scale
  sfx: [
    { atMs: 1000, kind: 'whoosh' },
    { atMs: 1400, kind: 'swish' },
    { atMs: 3000, kind: 'riser' },
    ...[0, 1, 2, 3].map(() => ({ atMs: 4500, kind: 'impact' as const, gainDb: 6 })),
    { atMs: 2200, kind: 'chime' },
    { atMs: 2600, kind: 'click' },
    { atMs: 2800, kind: 'tick' },
  ],
  voiceSpans: [{ startMs: 1200, endMs: 2900 }],
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promoreel-audio-'))
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

test('the bed is 48 kHz stereo, the job length, and peaks at no more than -2 dBFS', () => {
  const r = writeBed(job, path.join(tmp, 'a.wav'))
  const { sampleRate, channels } = decodeWav(fs.readFileSync(r.path))
  assert.equal(sampleRate, 48000)
  assert.equal(channels.length, 2)
  assert.equal(channels[0].length, 6 * SR)
  let peak = 0
  for (const ch of channels) for (const v of ch) peak = Math.max(peak, Math.abs(v))
  const limit = 10 ** (PEAK_DBFS / 20) + 1 / 32768 // one LSB of rounding
  assert.ok(peak <= limit, `peak ${peak.toFixed(5)} over ${limit.toFixed(5)}`)
  assert.ok(peak > 0.7, `peak ${peak.toFixed(5)} should sit near -2 dBFS`)
  assert.ok(r.peakDbfs <= PEAK_DBFS + 0.01)
})

test('the same job gives a byte-identical WAV; another seed does not', () => {
  const a = fs.readFileSync(writeBed(job, path.join(tmp, 'b1.wav')).path)
  const b = fs.readFileSync(writeBed(job, path.join(tmp, 'b2.wav')).path)
  assert.ok(a.equals(b), 'two renders of one job differ')
  const c = fs.readFileSync(writeBed({ ...job, seed: 6 }, path.join(tmp, 'b3.wav')).path)
  assert.ok(!a.equals(c), 'a different seed should change the noise')
})
