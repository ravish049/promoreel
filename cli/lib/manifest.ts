// out/manifest.json: every finished video of a project, newest first. The web studio's gallery (docs/studio-plan.md)
// reads only this file: no scanning, no guessing.
//
// { "project": "generic", "updated": "…", "videos": [ { "id", "title", "path", "sheet", "durationSec", "width", "height",
//   "sizeBytes", "voice", "created", "spec", "format", "cut" } ] }   — paths are relative to the project folder.
// Each rendered file is its own entry: a launch film in three formats is three entries (ids launch, launch-16x9, …).
import fs from 'node:fs'
import path from 'node:path'
import type { Format } from '../../src/reel/spec'

export type VideoEntry = {
  /** The file's name under out/ without .mp4: the reel id, plus -<cut> and -<format> when it has them. */
  id: string
  title: string
  path: string
  sheet?: string
  durationSec: number
  width: number
  height: number
  sizeBytes: number
  /** The voice it plays; a launch film has none. */
  voice?: string
  created: string
  spec: string
  format?: Format
  /** The walk cut this file is (e.g. "short"). */
  cut?: string
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
