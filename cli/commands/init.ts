// promoreel init <dir> [--style recorded|walk|launch] [--name "My App"] [--url http://localhost:3000] [--force]
// Scaffolds a project: brand.json, a first spec in the chosen style, and public/ with the tap sound. The recorded style
// (the default) also gets a first flow; a walk or a launch film draws its screens from the spec, so it needs none.
// Nothing here is a placeholder to delete later: a walk or launch project renders as it is, and a recorded one renders
// as soon as the flow points at a real screen of your app.
import fs from 'node:fs'
import path from 'node:path'
import type { Style } from '../../src/reel/spec'
import { STYLES } from '../../src/reel/shared'
import { KIT, ensurePublic, loadProject, rel } from '../lib/project'
import { step } from '../lib/progress'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app'

/** Each style's starter files: template path → path in the project. */
const FILES: Record<Exclude<Style, 'replace'>, [string, string][]> = {
  recorded: [
    ['brand.json', 'brand.json'],
    ['reels/first-reel.json', 'reels/first-reel.json'],
    ['flows/first-flow.flow.json', 'flows/first-flow.flow.json'],
    ['README.md', 'README.md'],
  ],
  walk: [
    ['brand.json', 'brand.json'],
    ['reels/walk.json', 'reels/walk.json'],
    ['README.walk.md', 'README.md'],
  ],
  launch: [
    ['brand.json', 'brand.json'],
    ['reels/launch.json', 'reels/launch.json'],
    ['README.launch.md', 'README.md'],
  ],
}

const NEXT: Record<Exclude<Style, 'replace'>, string> = {
  recorded: 'edit flows/first-flow.flow.json',
  walk: 'describe your screens and script in reels/walk.json',
  launch: 'describe your screens in reels/launch.json',
}

export async function init(dirArg: string | undefined, opts: { name?: string; url?: string; style?: string; force?: boolean }) {
  const st = step('init')
  if (!dirArg) throw new Error('usage: promoreel init <folder> [--style recorded|walk|launch] [--name "My App"] [--url http://localhost:3000]')
  if (opts.style === '') throw new Error(`--style needs a value: one of ${STYLES.join(', ')}`)
  const style = (opts.style ?? 'recorded') as Style
  if (!STYLES.includes(style)) throw new Error(`--style must be one of ${STYLES.join(', ')} (got "${opts.style}")`)
  if (style === 'replace') throw new Error('--style replace has no starter files yet: write reels/<id>.json by hand (see src/reel/spec.ts, ReplaceSpec)')
  const dir = path.resolve(dirArg)
  if (fs.existsSync(path.join(dir, 'brand.json')) && !opts.force) throw new Error(`${dirArg} already has a brand.json (use --force to overwrite the starter files)`)
  const name = opts.name ?? path.basename(dir)
  const url = opts.url ?? 'http://localhost:3000'
  st.start(`${style} project "${name}" in ${dirArg}`)
  const tpl = path.join(KIT, 'templates', 'project')
  const fill = (s: string) => s.replaceAll('{{NAME}}', name).replaceAll('{{SLUG}}', slug(name)).replaceAll('{{URL}}', url)
  const files: string[] = []
  for (const [from, to] of FILES[style]) {
    const dst = path.join(dir, to)
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.writeFileSync(dst, fill(fs.readFileSync(path.join(tpl, from), 'utf8')))
    files.push(dst)
  }
  const p = loadProject(dir)
  ensurePublic(p)
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true })
  st.done(`next: ${NEXT[style]}, then promoreel all ${dirArg}`, { dir, style, files: files.map((f) => rel(p, f)) })
}
