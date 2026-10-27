// promoreel record <project> [flow …] [--only clip,clip]
// Runs flow files (flows/<name>.flow.json, or .flow.mjs) and films each clip at phone size into
// public/videos/<flow name>/: <clip>.mp4 (1170×2532) + <clip>.json (every tap / focus with its box and time).
// With no flow named, records every flow in the project.
import fs from 'node:fs'
import path from 'node:path'
import { loadProject, readJson, rel } from '../lib/project'
import { step } from '../lib/progress'
import { has } from '../lib/sh'
import { recordFlow, type FlowFile } from '../record/flow'

export function flowFiles(dir: string): string[] {
  const d = path.join(dir, 'flows')
  if (!fs.existsSync(d)) return []
  return fs
    .readdirSync(d)
    .filter((f) => /\.flow\.(json|mjs|cjs|js)$/.test(f))
    .sort()
    .map((f) => path.join(d, f))
}

/** A flow's output folder name: its "name" (JSON) or its file name (scripts). */
export function flowName(file: string): string {
  if (file.endsWith('.json')) return readJson<FlowFile>(file).name
  return path.basename(file).replace(/\.flow\.(mjs|cjs|js)$/, '')
}

export async function record(projectDir: string, flows: string[], opts: { only?: string[] }) {
  const st = step('record')
  const p = loadProject(projectDir)
  if (!has('ffmpeg')) throw new Error('ffmpeg is required (macOS: brew install ffmpeg)')
  const all = flowFiles(p.dir)
  const chosen = flows.length
    ? flows.map((f) => {
        const hit = all.find((x) => path.basename(x).startsWith(f + '.flow.') || x === path.resolve(f) || flowName(x) === f)
        if (!hit) throw new Error(`no flow "${f}" in ${path.join(p.dir, 'flows')} (has: ${all.map((x) => path.basename(x)).join(', ') || 'none'})`)
        return hit
      })
    : all
  if (chosen.length === 0) throw new Error(`${p.name} has no flows: add flows/<name>.flow.json (see docs/flows.md)`)
  st.start(`${chosen.length} flow(s): ${chosen.map((f) => path.basename(f)).join(', ')}`)
  const done: Record<string, unknown> = {}
  for (const [i, file] of chosen.entries()) {
    const name = flowName(file)
    const outDir = path.join(p.publicDir, 'videos', name)
    fs.mkdirSync(outDir, { recursive: true })
    const sub = { ...st, progress: (pct: number, msg?: string) => st.progress(((i + pct / 100) / chosen.length) * 100, `${name} · ${msg ?? ''}`) }
    const manifests = await recordFlow(file, outDir, sub, opts.only)
    done[name] = { dir: rel(p, outDir), clipsDir: `videos/${name}`, clips: manifests.map((m) => ({ name: m.name, seconds: +(m.durationMs / 1000).toFixed(1) })) }
  }
  st.done(`recorded ${Object.keys(done).length} flow(s)`, { flows: done })
}
