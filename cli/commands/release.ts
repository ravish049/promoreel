// promoreel release <project> --tag <tag> [--reel id] [--repo owner/repo] [--clobber] [--dry-run]
// Attaches a finished reel to an existing GitHub release with your own `gh` login: gh release upload <tag> out/<id>.mp4.
// It publishes a file, so it runs only when you type it; agents are told never to run it unasked.
import fs from 'node:fs'
import path from 'node:path'
import { loadProject, pickReel } from '../lib/project'
import { step } from '../lib/progress'
import { has, run } from '../lib/sh'

export async function release(projectDir: string, opts: { reel?: string; tag?: string; repo?: string; clobber?: boolean; dryRun?: boolean }) {
  const st = step('release')
  const p = loadProject(projectDir)
  const { spec } = pickReel(p, opts.reel)
  if (!opts.tag) throw new Error('--tag is required: the release to attach to (create one first: gh release create v1.0.0)')
  const file = path.join(p.outDir, `${spec.id}.mp4`)
  if (!fs.existsSync(file)) throw new Error(`no ${path.relative(process.cwd(), file)}: render it first`)
  if (!has('gh')) throw new Error('the GitHub CLI is required: https://cli.github.com')
  const args = ['release', 'upload', opts.tag, file, ...(opts.repo ? ['--repo', opts.repo] : []), ...(opts.clobber ? ['--clobber'] : [])]
  st.start(`gh ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
  if (opts.dryRun) {
    st.done('dry run: nothing uploaded', { command: ['gh', ...args] })
    return
  }
  run('gh', args, { cwd: p.dir })
  st.done(`attached ${spec.id}.mp4 to release ${opts.tag}`, { tag: opts.tag, file })
}
