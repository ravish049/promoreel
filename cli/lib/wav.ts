// 16-bit mono WAV in and out, and the silence trim and level every voice provider applies, so all lines match.
import fs from 'node:fs'

export const SR = 24000

export function wav16(samples: Float32Array, sampleRate = SR): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  return buf
}

/** Reads a 16-bit PCM mono WAV written by wav16 (or by the Chatterbox script). */
export function readWav16(file: string): Float32Array {
  const b = fs.readFileSync(file)
  // find the "data" chunk (other writers may add chunks before it)
  let off = 12
  while (off + 8 <= b.length && b.toString('ascii', off, off + 4) !== 'data') off += 8 + b.readUInt32LE(off + 4)
  const start = off + 8
  const n = Math.floor((b.length - start) / 2)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(start + i * 2) / 32768
  return out
}

export function trimSilence(a: Float32Array, threshold = 0.004, padMs = 40, sampleRate = SR): Float32Array {
  let s = 0
  let e = a.length - 1
  while (s < a.length && Math.abs(a[s]) < threshold) s++
  while (e > s && Math.abs(a[e]) < threshold) e--
  const pad = Math.round((padMs / 1000) * sampleRate)
  return a.subarray(Math.max(0, s - pad), Math.min(a.length, e + pad * 2))
}

/** Every line at the same peak, -1 dBFS. */
export function normalize(a: Float32Array, peakTo = 0.89): Float32Array {
  let peak = 0
  for (const v of a) peak = Math.max(peak, Math.abs(v))
  const g = peak > 0 ? peakTo / peak : 1
  return Float32Array.from(a, (v) => v * g)
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, x) => n + x.length, 0))
  let o = 0
  for (const x of parts) {
    out.set(x, o)
    o += x.length
  }
  return out
}
