// promoreel voice <project> [--reel id] [--voice name …]
// Speaks every script line with the reel's voice (voice.use, plus voice.render for comparison samples), one WAV per line
// in public/vo/<reel>/<voice>/, and lines.json with their durations. Unchanged lines are not rendered again.
// The durations time the video: talking scenes stretch to their lines, phone lines sit on their recorded events.
// Also writes out/voices/<reel>-<voice>.wav (the whole voice-over on the video's own timeline, to listen to) and
// out/<reel>.timeline.json (where every line lands, plus any overlap warnings).
import fs from 'node:fs'
import path from 'node:path'
import { buildTimeline, type ClipManifest } from '../../src/reel/timeline'
import type { PhoneScene } from '../../src/reel/spec'
import { resolveSpec, voiceDir } from '../../src/reel/shared'
import { KIT, loadProject, pickReel, readJson, rel } from '../lib/project'
import { step } from '../lib/progress'
import { SR, readWav16, wav16 } from '../lib/wav'
import { providerFor, type VoiceJob } from '../voice'

type LinesFile = { sampleRate: number; lines: Record<string, { durationMs: number; key: string }> }

export function loadManifests(publicDir: string, scenes: { type: string }[]): Record<string, ClipManifest> {
  const out: Record<string, ClipManifest> = {}
  for (const s of scenes) {
    if (s.type !== 'phone') continue
    const ps = s as PhoneScene
    for (const c of ps.clips) {
      const f = path.join(publicDir, ps.clipsDir, `${c.name}.json`)
      if (!fs.existsSync(f)) throw new Error(`no recording ${ps.clipsDir}/${c.name}: run promoreel record first`)
      out[c.name] = readJson<ClipManifest>(f)
    }
  }
  return out
}

export async function voice(projectDir: string, opts: { reel?: string; voices?: string[] }) {
  const st = step('voice')
  const p = loadProject(projectDir)
  const { spec } = pickReel(p, opts.reel)
  const r = resolveSpec(spec, p.brand)
  const voices = opts.voices?.length ? opts.voices : [...new Set([r.voice.use, ...(r.voice.render ?? [])])]
  st.start(`${r.lines.length} lines × ${voices.length} voice(s): ${voices.join(', ')}`)
  const manifests = loadManifests(p.publicDir, r.scenes)
  const results: Record<string, unknown> = {}

  for (const [vi, name] of voices.entries()) {
    const { provider, voice: v } = providerFor(name)
    const ctx = { kit: KIT, settings: r.voice, step: { ...st, progress: (pct: number, msg?: string) => st.progress(((vi + pct / 100) / voices.length) * 100, msg) } }
    const problem = await provider.check(ctx)
    if (problem) throw new Error(problem)
    const dir = path.join(p.publicDir, voiceDir(r.id, name))
    fs.mkdirSync(dir, { recursive: true })
    const linesPath = path.join(dir, 'lines.json')
    const prev: LinesFile = fs.existsSync(linesPath) ? readJson<LinesFile>(linesPath) : { sampleRate: SR, lines: {} }
    const next: LinesFile = { sampleRate: SR, lines: {} }
    const jobs: (VoiceJob & { key: string })[] = []
    for (const line of r.lines) {
      const speed = (line.speed ?? r.voice.speed ?? 1) * (r.voice.speedByVoice?.[name] ?? 1)
      const job: VoiceJob = { id: line.id, say: line.say, speed, pauseMs: line.pauseMs ?? 300, seed: line.seed, out: path.join(dir, `${line.id}.wav`) }
      const key = provider.key(job, v, ctx)
      if (prev.lines[line.id]?.key === key && fs.existsSync(job.out)) next.lines[line.id] = prev.lines[line.id]
      else jobs.push({ ...job, key })
    }
    if (jobs.length) {
      st.log(`${name}: rendering ${jobs.length} of ${r.lines.length} line(s) (${r.lines.length - jobs.length} unchanged)`)
      const durations = await provider.render(jobs, v, ctx)
      for (const j of jobs) {
        if (durations[j.id] === undefined) throw new Error(`${name}: no audio for line ${j.id}`)
        next.lines[j.id] = { durationMs: durations[j.id], key: j.key }
      }
    } else st.log(`${name}: all ${r.lines.length} lines unchanged`)
    fs.writeFileSync(linesPath, JSON.stringify(next, null, 2) + '\n')

    // the listening sample, on the video's own timeline
    const durations = Object.fromEntries(Object.entries(next.lines).map(([k, x]) => [k, x.durationMs]))
    const tl = buildTimeline(r, durations, manifests)
    const total = Math.round((tl.durationInFrames / tl.fps) * SR)
    const mix = new Float32Array(total)
    for (const l of tl.lines) {
      const a = readWav16(path.join(dir, `${l.id}.wav`))
      const at = Math.round((l.startMs / 1000) * SR)
      for (let i = 0; i < a.length && at + i < total; i++) mix[at + i] += a[i]
    }
    const samples = path.join(p.outDir, 'voices')
    fs.mkdirSync(samples, { recursive: true })
    const sample = path.join(samples, `${r.id}-${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.wav`)
    fs.writeFileSync(sample, wav16(mix))
    for (const n of tl.notes) st.log(`${name}: ${n}`)
    for (const w of tl.warnings) st.warn(`${name}: ${w}`)
    const seconds = tl.durationInFrames / tl.fps
    if (name === r.voice.use) {
      fs.writeFileSync(
        path.join(p.outDir, `${r.id}.timeline.json`),
        JSON.stringify({ reel: r.id, voice: name, durationSec: +seconds.toFixed(2), scenes: tl.scenes.map((s) => ({ id: s.spec.id, type: s.spec.type, startSec: +(s.startFrame / tl.fps).toFixed(2), durationSec: +(s.durationFrames / tl.fps).toFixed(2) })), lines: tl.lines.map((l) => ({ id: l.id, scene: l.sceneId, startSec: +(l.startMs / 1000).toFixed(2), durationSec: +(l.durationMs / 1000).toFixed(2) })), fitted: tl.fitted, notes: tl.notes, warnings: tl.warnings }, null, 2) + '\n',
      )
      if (seconds < 25 || seconds > 50) st.warn(`the reel runs ${seconds.toFixed(1)} s; 30–45 s works best for Reels and Shorts`)
    }
    results[name] = { durationSec: +seconds.toFixed(2), sample: rel(p, sample), warnings: tl.warnings.length }
  }
  st.done(`voice-over ready (${voices.join(', ')})`, { reel: r.id, voices: results })
}
