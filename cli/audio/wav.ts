// 16-bit PCM WAV with any number of channels, for the 48 kHz music bed and sound effects. (cli/lib/wav.ts stays the
// mono 24 kHz voice format.)

/** Encodes channels (all the same length) as an interleaved 16-bit PCM WAV. Samples are clamped to [-1, 1]. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Buffer {
  const ch = channels.length
  if (ch === 0) throw new Error('encodeWav: no channels')
  const n = channels[0].length
  if (channels.some((c) => c.length !== n)) throw new Error('encodeWav: channels differ in length')
  const bytes = n * ch * 2
  const buf = Buffer.alloc(44 + bytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + bytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(ch, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * ch * 2, 28)
  buf.writeUInt16LE(ch * 2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(bytes, 40)
  let o = 44
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), o)
      o += 2
    }
  }
  return buf
}

/** Decodes a 16-bit PCM WAV (as written by encodeWav) into one Float32Array per channel. */
export function decodeWav(b: Buffer): { sampleRate: number; channels: Float32Array[] } {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('decodeWav: not a WAV file')
  let off = 12
  let ch = 0
  let sampleRate = 0
  let bits = 0
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4)
    const size = b.readUInt32LE(off + 4)
    if (id === 'fmt ') {
      ch = b.readUInt16LE(off + 10)
      sampleRate = b.readUInt32LE(off + 12)
      bits = b.readUInt16LE(off + 22)
    } else if (id === 'data') {
      if (bits !== 16 || ch === 0) throw new Error(`decodeWav: only 16-bit PCM is supported (got ${bits}-bit, ${ch} channels)`)
      const n = Math.floor(Math.min(size, b.length - off - 8) / (2 * ch))
      const channels = Array.from({ length: ch }, () => new Float32Array(n))
      let o = off + 8
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < ch; c++) {
          channels[c][i] = b.readInt16LE(o) / 32768
          o += 2
        }
      }
      return { sampleRate, channels }
    }
    off += 8 + size + (size & 1)
  }
  throw new Error('decodeWav: no data chunk')
}
