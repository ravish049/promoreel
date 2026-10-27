# Voices

Both built-in voices are **free and run on your machine**. Nothing is sent anywhere, and no key is needed.

| Voice | `voice.use` | Needs | Sound | Licence |
|---|---|---|---|---|
| **Kokoro** (default) | `af_heart`, `af_bella`, `am_michael`, `am_fenrir`, `bf_emma`, `bm_george`, … | Nothing beyond `npm install`. The model (~330 MB fp32, ~90 MB q8) downloads from Hugging Face on first use | Clean, a little even; rendered phrase by phrase with breaths | Apache-2.0 (weights and `kokoro-js`) |
| **Chatterbox** | `chatterbox` | `bash scripts/install-chatterbox.sh`: Python 3.11 + PyTorch, ~2 GB. Apple GPU (MPS), CUDA, or a slow CPU | More natural; `seed` gives another take of a line | MIT, with Resemble AI's **PerTh watermark** |

**The watermark:** Chatterbox embeds an imperceptible watermark that marks its audio as AI-generated. It doesn't affect
how it sounds, and it's fine for a promo. If a platform asks whether the video uses an AI voice, the answer is yes
either way.

Compare voices by listing them in `voice.render`. `promoreel voice` writes a listening sample per voice to
`out/voices/<reel>-<voice>.wav`, laid out on the video's own timeline.

## Caching
Each line has a key: its words, speed, pause, seed, the voice and its settings. A line whose key hasn't changed is not
rendered again. So changing one line, or one seed, re-voices only that line.

## The `VoiceProvider` interface
A provider turns lines into WAV files. The CLI does everything else: caching, timing, samples and captions.
From [`cli/voice/provider.ts`](../cli/voice/provider.ts):

```ts
export interface VoiceProvider {
  readonly name: string            // the part before ":" in voice.use, e.g. "elevenlabs"
  readonly local: boolean          // false for a paid / remote service
  key(job: VoiceJob, voice: string, ctx: ProviderContext): string        // what changes the sound of a line
  check(ctx: ProviderContext): Promise<string | null>                    // null = ready; else how to set it up
  render(jobs: VoiceJob[], voice: string, ctx: ProviderContext): Promise<Record<string, number>>  // id → ms
}
// VoiceJob: { id, say, speed, pauseMs, seed?, out }
// out is the WAV to write: 24 kHz, mono, 16-bit PCM, silence trimmed, peak -1 dBFS (cli/lib/wav.ts has helpers).
```

## Adding a paid voice later (ElevenLabs, say)
This is a later, optional phase, and nothing in the kit depends on it:
1. Create `cli/voice/elevenlabs.ts`, exporting a `VoiceProvider` with `name: 'elevenlabs'` and `local: false`.
2. `check()` returns a message when `ELEVENLABS_API_KEY` is missing from the environment. Never read a key from a file
   in the repo.
3. `render()`:
   - calls the API once per job, with `say` and `|` turned into commas;
   - decodes to 24 kHz mono (pipe through `ffmpeg`);
   - trims and normalises with `trimSilence` / `normalize` from `cli/lib/wav.ts`;
   - writes `job.out` and returns the durations.
4. `key()` includes the voice id and the model settings, so a settings change re-renders.
5. Register it in `cli/voice/index.ts` (`PROVIDERS`), then use `"voice": { "use": "elevenlabs:<voice-id>" }`.
6. Document the cost and the account it needs in the README. Keep Kokoro the default.
