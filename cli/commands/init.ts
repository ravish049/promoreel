// promoreel init <dir> [--name "My App"] [--url http://localhost:3000] [--force]
// Scaffolds a project: brand.json, a first reel spec, a first flow, and public/ with the tap sound.
// Nothing here is a placeholder to delete later: it renders as soon as the flow points at a real screen of your app.
import fs from 'node:fs'
import path from 'node:path'
import { KIT, ensurePublic, loadProject, rel } from '../lib/project'
import { step } from '../lib/progress'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app'

export async function init(dirArg: string | undefined, opts: { name?: string; url?: string; force?: boolean }) {
  const st = step('init')
  if (!dirArg) throw new Error('usage: promoreel init <folder> [--name "My App"] [--url http://localhost:3000]')
  const dir = path.resolve(dirArg)
  if (fs.existsSync(path.join(dir, 'brand.json')) && !opts.force) throw new Error(`${dirArg} already has a brand.json (use --force to overwrite the starter files)`)
  const name = opts.name ?? path.basename(dir)
  const url = opts.url ?? 'http://localhost:3000'
  st.start(`project "${name}" in ${dirArg}`)
  const tpl = path.join(KIT, 'templates', 'project')
  const fill = (s: string) => s.replaceAll('{{NAME}}', name).replaceAll('{{SLUG}}', slug(name)).replaceAll('{{URL}}', url)
  const files: string[] = []
  const copy = (from: string, to: string) => {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, fill(fs.readFileSync(from, 'utf8')))
    files.push(to)
  }
  copy(path.join(tpl, 'brand.json'), path.join(dir, 'brand.json'))
  copy(path.join(tpl, 'reels', 'first-reel.json'), path.join(dir, 'reels', 'first-reel.json'))
  copy(path.join(tpl, 'flows', 'first-flow.flow.json'), path.join(dir, 'flows', 'first-flow.flow.json'))
  copy(path.join(tpl, 'README.md'), path.join(dir, 'README.md'))
  const p = loadProject(dir)
  ensurePublic(p)
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true })
  st.done(`next: edit flows/first-flow.flow.json, then promoreel all ${dirArg}`, { dir, files: files.map((f) => rel(p, f)) })
}
