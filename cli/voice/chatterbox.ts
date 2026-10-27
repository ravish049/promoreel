// Chatterbox (Resemble AI, MIT): free, local, the more natural voice. It runs in its own Python venv
// (scripts/install-chatterbox.sh: Python 3.11 + PyTorch, ~2 GB with weights; Apple GPU via MPS, CUDA, or CPU).
// Its audio carries Resemble's imperceptible PerTh watermark, which marks it as AI-generated. That is by design.
// It reads the whole line at once (its own phrasing is good); a breath mark becomes a comma. `seed` picks another take.
import fs from 'node:fs'
import path from 'node:path'
import { stream } from '../lib/sh'
import type { ProviderContext, VoiceJob, VoiceProvider } from './provider'

export const chatterboxPython = (kit: string) => path.join(kit, 'tools', 'chatterbox-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')

export const chatterbox: VoiceProvider = {
  name: 'chatterbox',
  local: true,
  key: (j, _voice, ctx) => JSON.stringify([j.say, 'chatterbox', ctx.settings.chatterbox ?? {}, j.seed ?? null]),
  async check(ctx) {
    return fs.existsSync(chatterboxPython(ctx.kit)) ? null : 'Chatterbox is not installed: run bash scripts/install-chatterbox.sh (or use a Kokoro voice, e.g. "af_heart")'
  },
  async render(jobs: VoiceJob[], _voice: string, ctx: ProviderContext) {
    const cb = ctx.settings.chatterbox ?? {}
    const req = {
      exaggeration: cb.exaggeration ?? 0.5,
      cfg_weight: cb.cfgWeight ?? 0.5,
      jobs: jobs.map((j) => ({ id: j.id, text: j.say.replace(/\s*\|\s*/g, ', ').replace(/([.?!…]),/g, '$1'), out: j.out, seed: j.seed ?? cb.seed ?? 7 })),
    }
    ctx.step.log(`Chatterbox: ${jobs.length} line(s); the first run loads the model (~1 min)`)
    let result: Record<string, number> = {}
    let k = 0
    const code = await stream(chatterboxPython(ctx.kit), [path.join(ctx.kit, 'cli', 'voice', 'tts_chatterbox.py')], {
      input: JSON.stringify(req),
      // tqdm's sampling bars are noise in a log
      env: { ...process.env, TQDM_DISABLE: '1', PYTHONWARNINGS: 'ignore', HF_HUB_VERBOSITY: 'error', TRANSFORMERS_VERBOSITY: 'error' },
      onLine: (l) => {
        let ev: { done?: string; ms?: number; result?: Record<string, number> } | null = null
        try {
          ev = JSON.parse(l)
        } catch {
          return
        }
        if (ev?.done) {
          k++
          ctx.step.progress((k / jobs.length) * 100, `chatterbox ${ev.done} ${((ev.ms ?? 0) / 1000).toFixed(2)} s`)
        }
        if (ev?.result) result = ev.result
      },
    })
    if (code !== 0) throw new Error(`Chatterbox exited with ${code} (see the messages above)`)
    return result
  },
}
