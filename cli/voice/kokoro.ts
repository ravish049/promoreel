// Kokoro-82M through kokoro-js: free, local, Node only (no Python). Weights: Apache-2.0
// (onnx-community/Kokoro-82M-v1.0-ONNX, downloaded from Hugging Face on first use, ~330 MB at fp32, ~90 MB at q8).
// Each phrase of a line (split on `|`) is rendered on its own and joined with a breath, which reads far less like a
// script than one long call. Voices: af_heart, af_bella, am_michael, am_fenrir, bf_emma, bm_george, … (kokoro-js docs).
import fs from 'node:fs'
import { phrases } from '../../src/reel/shared'
import { SR, concat, normalize, trimSilence, wav16 } from '../lib/wav'
import type { ProviderContext, VoiceJob, VoiceProvider } from './provider'

type TTS = { generate: (text: string, o: { voice: string; speed: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> }
let tts: TTS | null = null
let loadedDtype = ''

export const kokoro: VoiceProvider = {
  name: 'kokoro',
  local: true,
  key: (j, voice, ctx) => JSON.stringify([j.say, j.speed, j.pauseMs, ctx.settings.dtype ?? 'fp32', voice, 'kokoro-v1']),
  async check() {
    try {
      await import('kokoro-js')
      return null
    } catch {
      return 'kokoro-js is not installed: run npm install'
    }
  },
  async render(jobs: VoiceJob[], voice: string, ctx: ProviderContext) {
    const dtype = ctx.settings.dtype ?? 'fp32'
    if (!tts || loadedDtype !== dtype) {
      ctx.step.log(`loading Kokoro (${dtype}); the first run downloads the model from Hugging Face`)
      const { KokoroTTS } = await import('kokoro-js')
      tts = (await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: dtype as 'fp32', device: 'cpu' })) as unknown as TTS
      loadedDtype = dtype
    }
    const out: Record<string, number> = {}
    let k = 0
    for (const j of jobs) {
      const parts: Float32Array[] = []
      const ph = phrases(j.say)
      for (let i = 0; i < ph.length; i++) {
        const raw = await tts.generate(ph[i], { voice, speed: j.speed })
        if (raw.sampling_rate !== SR) throw new Error(`unexpected sample rate ${raw.sampling_rate}`)
        parts.push(trimSilence(raw.audio))
        if (i < ph.length - 1) {
          // a breath, a little different each time (deterministic, so a re-render matches)
          const jitter = 0.85 + 0.3 * ((((i + 1) * 7919 + j.id.length * 104729) % 1000) / 1000)
          parts.push(new Float32Array(Math.round(((j.pauseMs * jitter) / 1000) * SR)))
        }
      }
      const a = normalize(concat(parts))
      fs.writeFileSync(j.out, wav16(a))
      out[j.id] = Math.round((a.length / SR) * 1000)
      k++
      ctx.step.progress((k / jobs.length) * 100, `kokoro:${voice} ${j.id} ${(out[j.id] / 1000).toFixed(2)} s`)
    }
    return out
  },
}
