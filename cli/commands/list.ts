// promoreel list [folder …]: every project (a folder with brand.json) under examples/ and projects/ (or the folders
// given), with its reels, flows and finished videos from out/manifest.json. What a studio's sidebar would show.
import fs from 'node:fs'
import path from 'node:path'
import { KIT, loadProject } from '../lib/project'
import { readManifest } from '../lib/manifest'
import { step } from '../lib/progress'
import { flowFiles } from './record'

export async function list(roots: string[]) {
  const st = step('list')
  const dirs = (roots.length ? roots : ['examples', 'projects'].map((d) => path.join(KIT, d))).filter((d) => fs.existsSync(d))
  st.start(`looking in ${dirs.map((d) => path.relative(process.cwd(), d) || '.').join(', ')}`)
  const projects = []
  for (const root of dirs) {
    const candidates = fs.existsSync(path.join(root, 'brand.json')) ? [root] : fs.readdirSync(root).map((d) => path.join(root, d))
    for (const d of candidates) {
      if (!fs.existsSync(path.join(d, 'brand.json'))) continue
      const p = loadProject(d)
      projects.push({ name: p.name, dir: d, brand: p.brand.name, reels: p.reels.map((r) => r.id), flows: flowFiles(d).map((f) => path.basename(f)), videos: readManifest(p.outDir, p.name).videos })
    }
  }
  st.done(`${projects.length} project(s)`, { projects })
}
