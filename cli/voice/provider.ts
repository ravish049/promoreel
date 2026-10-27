// The voice-provider interface. A provider turns script lines into one WAV per line; the CLI does everything else
// (caching unchanged lines, timing them into the video, the listening sample, captions).
//
// Built in, both free and local:  kokoro (default, Node only)  ·  chatterbox (Python, more natural, watermarked)
// A paid one (ElevenLabs, say) plugs in the same way: see docs/voice-providers.md.
import type { VoiceSettings } from '../../src/reel/spec'
import type { Step } from '../lib/progress'

/** One line to speak. */
export type VoiceJob = {
  id: string
  /** What to say; `|` marks a breath between phrases. */
  say: string
  /** The line's speed (1 = normal), already multiplied by the voice's own factor. */
  speed: number
  /** The breath at each `|`, ms. */
  pauseMs: number
  /** A take number, for providers that sample (Chatterbox). */
  seed?: number
  /** Where to write the WAV: 24 kHz, mono, 16-bit PCM, silence trimmed, peak -1 dBFS. */
  out: string
}

export type ProviderContext = {
  /** The kit's folder (for tools/, models). */
  kit: string
  settings: VoiceSettings
  step: Step
}

export interface VoiceProvider {
  /** The name before the colon in voice.use: "kokoro", "chatterbox", "elevenlabs". */
  readonly name: string
  /** Free and local (true), or a paid / remote service (false): shown by `promoreel doctor` and the docs. */
  readonly local: boolean
  /** Anything that changes the sound of a line for this voice. Lines whose key is unchanged are not rendered again. */
  key(job: VoiceJob, voice: string, ctx: ProviderContext): string
  /** null when ready; otherwise how to set it up (e.g. "run scripts/install-chatterbox.sh"). */
  check(ctx: ProviderContext): Promise<string | null>
  /** Speak the jobs and write their WAVs. Returns each line's duration in ms. */
  render(jobs: VoiceJob[], voice: string, ctx: ProviderContext): Promise<Record<string, number>>
}
