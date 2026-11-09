// The sound of a launch film, as an audio job for the synthesised bed (cli/audio/synth.ts): music only, no voice. The
// arrangement changes at the scene cuts (which sit on the beat, so the bar grid starts at frame 0): intro under the
// hook, build under the screens, the drop on the payoff, resolve on the logo. The cursor clicks and the ticks on card
// landings and checkmarks are separate one-shots (click.wav / tick.wav from cli/audio/sfx.ts) that the composition plays
// on the plan's frames. Pure, so it is tested without rendering; the CLI writes the bed to public/audio/<video name>.wav
// before rendering (cli/commands/render.ts), and the Launch composition plays it.
import type { AudioJob, SectionKind } from '../../cli/audio/synth'
import type { Format, LaunchSceneKind, LaunchSpec } from '../reel/spec'
import { DEFAULT_LAUNCH_BPM, type LaunchPlan } from './plan'

/** The section each scene kind plays under. */
const SECTION: Record<LaunchSceneKind, SectionKind> = { hook: 'intro', screen: 'build', payoff: 'drop', logo: 'resolve' }

/** The bed a format plays, under public/: audio/<id>.wav (9:16), audio/<id>-16x9.wav, audio/<id>-1x1.wav (its video's name). */
export const launchBedFile = (id: string, format: Format) => `audio/${[id, format === '9x16' ? undefined : format].filter(Boolean).join('-')}.wav`

/** Where the click and tick one-shots live under public/ (written by `promoreel render`). */
export const LAUNCH_SFX_DIR = 'sfx/launch'
export const LAUNCH_SFX = { click: `${LAUNCH_SFX_DIR}/click.wav`, tick: `${LAUNCH_SFX_DIR}/tick.wav` } as const

export type LaunchAudioOptions = {
  /** Turns spec.music.src (a path in the project's public/) into a file path the synth can read. */
  resolveMusic?: (src: string) => string
}

/** The bed's job, from the plan (built at the video's fps): sections at the scene cuts, no voice, no effects in the bed. */
export function launchAudioJob(spec: Pick<LaunchSpec, 'music'>, plan: LaunchPlan, opts: LaunchAudioOptions = {}): AudioJob {
  const fps = plan.fps
  const ms = (f: number) => Math.round((f / fps) * 1000)
  const sections: AudioJob['sections'] = []
  for (const s of plan.tl.scenes) {
    const kind = SECTION[s.kind]
    if (sections.length && sections[sections.length - 1].kind === kind) continue
    sections.push({ atMs: ms(s.from), kind })
  }
  const music = spec.music
  return {
    durationMs: ms(plan.tl.durationInFrames),
    bpm: music?.bpm ?? DEFAULT_LAUNCH_BPM,
    offsetMs: 0,
    sections,
    sfx: [],
    voiceSpans: [],
    ...(music?.src ? { music: { src: (opts.resolveMusic ?? ((s: string) => s))(music.src), gainDb: music.gainDb } } : {}),
  }
}
