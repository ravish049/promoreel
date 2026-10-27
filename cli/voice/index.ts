// Which provider speaks a voice name:
//   "af_heart" / "kokoro:af_heart" → Kokoro     "chatterbox" / "chatterbox:default" → Chatterbox
//   "<provider>:<voice>"           → a provider registered here (see docs/voice-providers.md to add one)
import { chatterbox } from './chatterbox'
import { kokoro } from './kokoro'
import type { VoiceProvider } from './provider'

export const PROVIDERS: Record<string, VoiceProvider> = { kokoro, chatterbox }

export function providerFor(voiceName: string): { provider: VoiceProvider; voice: string } {
  const i = voiceName.indexOf(':')
  if (i > 0) {
    const name = voiceName.slice(0, i)
    const provider = PROVIDERS[name]
    if (!provider) throw new Error(`no voice provider "${name}" (have: ${Object.keys(PROVIDERS).join(', ')}). See docs/voice-providers.md to add one.`)
    return { provider, voice: voiceName.slice(i + 1) || 'default' }
  }
  if (voiceName === 'chatterbox') return { provider: chatterbox, voice: 'default' }
  return { provider: kokoro, voice: voiceName }
}

export type { VoiceProvider, VoiceJob, ProviderContext } from './provider'
