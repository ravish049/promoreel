// promoreel render <project> [--reel id] [--crf 18] [--no-sheet]
// Bundles the template once, then renders every video the spec makes with its style's composition (Reel, Walk or
// Launch): one per format (out/<id>.mp4 for 9:16, out/<id>-16x9.mp4, out/<id>-1x1.mp4) and, for a walk with several
// cuts, one per cut (out/<id>-<cut>.mp4). Each gets a contact sheet (8 frames) and its own entry in out/manifest.json.
// A style can run steps before and after each video (RENDER_HOOKS: e.g. build the music bed first, master the sound
// after). Progress comes from Remotion's own render callback.
import fs from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { LaunchSpec, Style, VideoSpec, WalkSpec } from '../../src/reel/spec'
import { voiceDir, type ResolvedLaunch, type ResolvedWalk } from '../../src/reel/shared'
import { buildWalkTimeline, type WalkWords } from '../../src/walk/timeline'
import { walkAudioJob } from '../../src/walk/audio'
import { buildLaunchPlan } from '../../src/launch/plan'
import { LAUNCH_SFX_DIR, launchAudioJob, launchBedFile } from '../../src/launch/audio'
import { writeBed } from '../audio/synth'
import { writeLaunchSfx } from '../audio/sfx'
import { masterMp4 } from '../audio/master'
import { KIT, ensurePublic, loadProject, pickReel, readJson, rel, renderJobs, type Project, type RenderJob } from '../lib/project'
import { step } from '../lib/progress'
import { upsertVideo, type VideoEntry } from '../lib/manifest'
import { probeDuration, probeSize } from '../lib/sh'
import { contactSheet } from './sheet'

/** What a render hook gets: the project, the spec, the video being made, where it goes, and the render step's reporter. */
export type RenderContext = { project: Project; spec: VideoSpec; job: RenderJob; out: string; step: ReturnType<typeof step> }
export type RenderHook = (ctx: RenderContext) => void | Promise<void>

/**
 * Per-style steps around each video: `beforeRender` runs before the template is bundled (the bundle takes a copy of
 * public/, so whatever a hook writes there, e.g. the audio a composition plays, must exist by then); `afterRender` once
 * the mp4 is written and before the sheet and manifest (e.g. master its sound in place). They run in order.
 */
export const RENDER_HOOKS: Record<Style, { beforeRender: RenderHook[]; afterRender: RenderHook[] }> = {
  recorded: { beforeRender: [], afterRender: [] },
  walk: { beforeRender: [writeWalkBed], afterRender: [masterInPlace] },
  launch: { beforeRender: [writeLaunchAudio], afterRender: [masterInPlace] },
}

/**
 * A walk cut's music bed and sound effects, laid out on the same timeline the composition builds (the measured voice,
 * at the video's fps): public/audio/<video name>.wav.
 */
async function writeWalkBed({ project: p, job, step: st }: RenderContext) {
  const spec = job.props as ResolvedWalk
  const dir = path.join(p.publicDir, voiceDir(spec.id, spec.voice.use))
  const linesFile = path.join(dir, 'lines.json')
  if (!fs.existsSync(linesFile)) throw new Error(`no voice-over for ${spec.voice.use}: run promoreel voice ${p.dir}`)
  const lines = readJson<{ lines: Record<string, { durationMs: number }> }>(linesFile).lines
  const capsFile = path.join(dir, 'captions.json')
  const words = fs.existsSync(capsFile) ? readJson<WalkWords>(capsFile) : undefined
  const durations = Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, v.durationMs]))
  const tl = buildWalkTimeline(spec as WalkSpec, job.cut!, durations, words)
  const audio = walkAudioJob(spec as WalkSpec, tl, { resolveMusic: (src) => path.resolve(p.publicDir, src) })
  const out = path.join(p.publicDir, 'audio', `${job.name}.wav`)
  const bed = writeBed(audio, out)
  st.log(`${job.name}: ${bed.source === 'track' ? 'music track' : `music bed at ${audio.bpm} bpm`}, ${audio.sfx.length} sound effects, ${audio.voiceSpans.length} voice spans → ${rel(p, out)}`)
}

/**
 * A launch film's music bed, on the scene cuts of its plan (at the video's fps): public/audio/<video name>.wav; and the
 * click / tick one-shots the composition plays on cursor clicks, card landings and checkmarks: public/sfx/launch/.
 */
async function writeLaunchAudio({ project: p, job, step: st }: RenderContext) {
  const spec = job.props as ResolvedLaunch
  const plan = buildLaunchPlan(spec as LaunchSpec, spec.fps)
  for (const w of plan.warnings) st.warn(`${job.name}: ${w}`)
  const audio = launchAudioJob(spec, plan, { resolveMusic: (src) => path.resolve(p.publicDir, src) })
  const out = path.join(p.publicDir, launchBedFile(spec.id, job.format))
  const bed = writeBed(audio, out)
  writeLaunchSfx(path.join(p.publicDir, LAUNCH_SFX_DIR))
  st.log(`${job.name}: ${bed.source === 'track' ? 'music track' : `music bed at ${audio.bpm} bpm`}, ${plan.clicks.length} clicks, ${plan.ticks.length} ticks → ${rel(p, out)}`)
}

/** Masters the rendered mp4's sound in place (−15 LUFS, true peak ≤ −1.5 dBTP). */
function masterInPlace({ out }: RenderContext) {
  masterMp4(out)
}

/** The props Remotion gets, written to out/.props-<id>.json (Studio reads the same file): the spec's first video. */
export function writeProps(projectDir: string, reel?: string) {
  const p = loadProject(projectDir)
  const { spec, file } = pickReel(p, reel)
  ensurePublic(p)
  const jobs = renderJobs(p, spec)
  const props = jobs[0].props
  fs.mkdirSync(p.outDir, { recursive: true })
  const propsFile = path.join(p.outDir, `.props-${spec.id}.json`)
  fs.writeFileSync(propsFile, JSON.stringify(props))
  return { p, spec, file, props, propsFile, jobs }
}

export async function render(projectDir: string, opts: { reel?: string; crf?: number; sheet?: boolean; out?: string }): Promise<VideoEntry[]> {
  const st = step('render')
  const { p, spec, file, jobs } = writeProps(projectDir, opts.reel)
  if (opts.out && jobs.length > 1) throw new Error(`--out names one file, and ${spec.id} makes ${jobs.length} videos (${jobs.map((j) => `${j.name}.mp4`).join(', ')})`)
  const hooks = RENDER_HOOKS[jobs[0].style]
  st.start(`${spec.id}: ${jobs.length} video(s)`)
  const contexts: RenderContext[] = jobs.map((job) => {
    const out = opts.out ? path.resolve(opts.out) : path.join(p.outDir, `${job.name}.mp4`)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    return { project: p, spec, job, out, step: st }
  })
  for (const ctx of contexts) for (const h of hooks.beforeRender) await h(ctx)
  st.progress(0, `${spec.id}: bundling the template`)
  let lastPct = -1
  const serveUrl = await bundle({
    entryPoint: path.join(KIT, 'src', 'index.ts'),
    publicDir: p.publicDir,
    onProgress: (pct) => {
      if (pct - lastPct >= 20) {
        lastPct = pct
        st.progress(pct * 0.1, `bundling ${pct}%`)
      }
    },
  })
  // each video gets an equal share of the 10–100 % after bundling
  const share = 90 / jobs.length
  const entries: VideoEntry[] = []
  for (const [i, job] of jobs.entries()) {
    const base = 10 + i * share
    const pct = (x: number) => base + (x / 90) * share
    const label = jobs.length > 1 ? job.name : spec.id
    const ctx = contexts[i]
    const out = ctx.out
    const inputProps = job.props as unknown as Record<string, unknown>
    const composition = await selectComposition({ serveUrl, id: job.composition, inputProps, logLevel: 'error' })
    const seconds = composition.durationInFrames / composition.fps
    st.progress(pct(0), `${label}: ${seconds.toFixed(1)} s, ${composition.durationInFrames} frames`)
    let lastEmit = 0
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      crf: opts.crf ?? spec.crf ?? 18,
      imageFormat: 'jpeg',
      jpegQuality: 92,
      pixelFormat: 'yuv420p',
      outputLocation: out,
      inputProps,
      logLevel: 'error',
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        const now = Date.now()
        if (now - lastEmit < 1500 && progress < 1) return
        lastEmit = now
        st.progress(pct(progress * 85), `${jobs.length > 1 ? `${job.name}: ` : ''}frames ${renderedFrames}/${composition.durationInFrames}, encoded ${encodedFrames}`)
      },
    })
    for (const h of hooks.afterRender) await h(ctx)
    const durationSec = +probeDuration(out).toFixed(2)
    let sheetRel: string | undefined
    if (opts.sheet !== false) {
      const sheetPath = out.replace(/\.mp4$/, '') + '-sheet.png'
      contactSheet(out, sheetPath)
      sheetRel = rel(p, sheetPath)
      st.progress(pct(88), `contact sheet ${sheetRel}`)
    }
    const { width, height } = probeSize(out)
    const voice = 'voice' in spec ? spec.voice?.use : undefined
    const entry: VideoEntry = {
      id: job.name,
      title: spec.title ?? spec.id,
      path: rel(p, out),
      ...(sheetRel ? { sheet: sheetRel } : {}),
      durationSec,
      width,
      height,
      sizeBytes: fs.statSync(out).size,
      ...(voice ? { voice } : {}),
      created: new Date().toISOString(),
      spec: rel(p, file),
      format: job.format,
      ...(job.cut ? { cut: job.cut } : {}),
    }
    upsertVideo(p.outDir, p.name, entry)
    entries.push(entry)
    if (jobs.length > 1) st.log(`${entry.path} · ${durationSec} s`)
  }
  if (entries.length === 1) st.done(`${entries[0].path} · ${entries[0].durationSec} s`, entries[0])
  else st.done(`${entries.length} videos: ${entries.map((e) => e.path).join(', ')}`, { videos: entries })
  return entries
}
