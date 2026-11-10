// promoreel release <project> --tag <tag> [--reel id] [--repo owner/repo] [--clobber] [--dry-run]
// Attaches a finished reel to an existing GitHub release with your own `gh` login: gh release upload <tag> out/<id>*.mp4
// (every cut and format the spec renders, and for a replace ad each video's still, out/<name>.png).
// It publishes a file, so it runs only when you type it; agents are told never to run it unasked.
import fs from 'node:fs'
import path from 'node:path'
import { loadProject, makesStills, outputNames, pickReel, stillFile } from '../lib/project'
import { step } from '../lib/progress'
import { has, run } from '../lib/sh'
import type { VideoSpec } from '../../src/reel/spec'

export async function release(projectDir: string, opts: { reel?: string; tag?: string; repo?: string; clobber?: boolean; dryRun?: boolean }) {
  const st = step('release')
  const p = loadProject(projectDir)
  const { spec } = pickReel(p, opts.reel)
  if (!opts.tag) throw new Error('--tag is required: the release to attach to (create one first: gh release create v1.0.0)')
  const files = releaseFiles(p.outDir, spec)
  for (const file of files) if (!fs.existsSync(file)) throw new Error(`no ${path.relative(process.cwd(), file)}: render it first`)
  if (!has('gh')) throw new Error('the GitHub CLI is required: https://cli.github.com')
  const args = ['release', 'upload', opts.tag, ...files, ...(opts.repo ? ['--repo', opts.repo] : []), ...(opts.clobber ? ['--clobber'] : [])]
  st.start(`gh ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
  if (opts.dryRun) {
    st.done('dry run: nothing uploaded', { command: ['gh', ...args] })
    return
  }
  run('gh', args, { cwd: p.dir })
  st.done(`attached ${files.map((f) => path.basename(f)).join(', ')} to release ${opts.tag}`, { tag: opts.tag, files })
}

/** The files a release attaches: each video the spec renders, and after it its still when the style makes one. */
export function releaseFiles(outDir: string, spec: VideoSpec): string[] {
  const stills = makesStills(spec)
  return outputNames(spec).flatMap((n) => {
    const video = path.join(outDir, `${n}.mp4`)
    return stills ? [video, stillFile(video)] : [video]
  })
}
