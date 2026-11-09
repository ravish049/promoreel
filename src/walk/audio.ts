// The sound of one walk cut, as an audio job for the synthesised bed (cli/audio/synth.ts): the arrangement changes at
// the scene cuts, sound effects land on the moments of the plan, and the music ducks under every voice line. Pure, so it
// is tested without rendering; the CLI writes it to public/audio/<video name>.wav before rendering the cut
// (cli/commands/render.ts), and the Walk composition plays that file.
//
// - sections: intro under the hook, build from the first step, drop on the last step (from three steps up), resolve on the close;
// - whoosh on every camera move (the dive from the hook too), a soft swish as each screen enters;
// - click on every press, a tick per row that checks off, a chime when a step is done;
// - a riser that peaks as the close begins, and an impact as the logo lands.
import type { AudioJob, SectionKind } from '../../cli/audio/synth'
import type { WalkSpec } from '../reel/spec'
import { cutsOf } from '../reel/shared'
import { DEFAULT_WALK_BPM, type WalkTimeline } from './timeline'
import { at60, buildWalkPlan, rowCount, rowStagger, type WalkPlan } from './plan'

/** Effects closer than this to the start are dropped (the bed fades in over its first 80 ms). */
const MIN_SFX_MS = 100

/** The bed a cut plays, under public/: audio/<id>.wav, or audio/<id>-<cut>.wav when the walk has several cuts (its video's name). */
export const walkBedFile = (spec: Pick<WalkSpec, 'id' | 'cuts'>, cut: string) => `audio/${[spec.id, cutsOf(spec as WalkSpec).length > 1 ? cut : undefined].filter(Boolean).join('-')}.wav`

export type WalkAudioOptions = {
  /** Turns spec.music.src (a path in the project's public/) into a file path the synth can read. */
  resolveMusic?: (src: string) => string
  /** The plan, if the caller has it already. */
  plan?: WalkPlan
}

/** The audio job of one cut, from its timeline (built at the video's fps). */
export function walkAudioJob(spec: WalkSpec, tl: WalkTimeline, opts: WalkAudioOptions = {}): AudioJob {
  const plan = opts.plan ?? buildWalkPlan(spec, tl)
  const fps = tl.fps
  const ms = (f: number) => Math.round((f / fps) * 1000)
  const F = (n: number) => at60(n, fps)

  const sections: AudioJob['sections'] = []
  const add = (f: number, kind: SectionKind) => sections.push({ atMs: ms(f), kind })
  if (plan.hook) add(plan.hook.scene.from, 'intro')
  plan.steps.forEach((s, i) => {
    if (i === 0) add(s.scene.from, 'build')
    else if (i === plan.steps.length - 1 && plan.steps.length >= 3) add(s.scene.from, 'drop')
  })
  add(plan.logo.scene.from, 'resolve')

  const sfx: AudioJob['sfx'] = []
  if (plan.hook) {
    sfx.push({ atMs: ms(plan.hook.dive[0]), kind: 'whoosh', durMs: ms(plan.hook.dive[1] - plan.hook.dive[0]) + 200 })
    for (const c of plan.hook.checks) sfx.push({ atMs: ms(c), kind: 'tick' })
  }
  for (const s of plan.steps) {
    if (s.moveIn) sfx.push({ atMs: ms(s.moveIn[0]), kind: 'whoosh', durMs: ms(s.moveIn[1] - s.moveIn[0]) + 200 })
    sfx.push({ atMs: ms(s.enterAt + F(2)), kind: 'swish', gainDb: -3 })
    if (s.progress.click !== undefined) sfx.push({ atMs: ms(s.progress.click), kind: 'click' })
    if (s.progress.checkRows !== undefined) {
      const n = rowCount(s.screen)
      const st = rowStagger(n, fps)
      for (let i = 0; i < n; i++) sfx.push({ atMs: ms(s.progress.checkRows + i * st), kind: 'tick' })
    }
    sfx.push({ atMs: ms(s.done), kind: 'chime' })
  }
  sfx.push({ atMs: ms(plan.worldOut), kind: 'whoosh', durMs: 700, gainDb: -2 })
  sfx.push({ atMs: ms(plan.logo.scene.from), kind: 'riser', durMs: 1400 })
  sfx.push({ atMs: ms(plan.logo.scene.from + F(14)), kind: 'impact' })

  const music = spec.music
  return {
    durationMs: ms(tl.durationInFrames),
    bpm: music?.bpm ?? DEFAULT_WALK_BPM,
    offsetMs: 0,
    sections,
    sfx: sfx.filter((e) => e.atMs >= MIN_SFX_MS).sort((a, b) => a.atMs - b.atMs),
    voiceSpans: tl.lines.map((l) => ({ startMs: ms(l.from), endMs: ms(l.from + l.durationInFrames) })),
    ...(music?.src ? { music: { src: (opts.resolveMusic ?? ((s: string) => s))(music.src), gainDb: music.gainDb } } : {}),
  }
}
