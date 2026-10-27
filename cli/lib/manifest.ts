// out/manifest.json: every finished video of a project, newest first. The web studio's gallery (docs/studio-plan.md)
// reads only this file: no scanning, no guessing.
//
// { "project": "generic", "updated": "…", "videos": [ { "id", "title", "path", "sheet", "durationSec", "width", "height",
//   "sizeBytes", "voice", "created", "spec" } ] }   — paths are relative to the project folder.
import fs from 'node:fs'
import path from 'node:path'

export type VideoEntry = {
  id: string
  title: string
  path: string
  sheet?: string
  durationSec: number
  width: number
  height: number
  sizeBytes: number
  voice: string
  created: string
  spec: string
}

export type Manifest = { project: string; updated: string; videos: VideoEntry[] }

export function readManifest(outDir: string, project: string): Manifest {
  const file = path.join(outDir, 'manifest.json')
  if (!fs.existsSync(file)) return { project, updated: new Date().toISOString(), videos: [] }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest
}

export function upsertVideo(outDir: string, project: string, entry: VideoEntry): Manifest {
  const m = readManifest(outDir, project)
  m.videos = [entry, ...m.videos.filter((v) => v.id !== entry.id)]
  m.updated = new Date().toISOString()
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(m, null, 2) + '\n')
  return m
}
