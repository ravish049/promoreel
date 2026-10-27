// promoreel studio <project> [--reel id]
// Opens Remotion Studio on a reel: scrub it, tweak the spec, re-run `promoreel studio` to reload the props.
import path from 'node:path'
import { KIT } from '../lib/project'
import { step } from '../lib/progress'
import { stream } from '../lib/sh'
import { writeProps } from './render'

export async function studio(projectDir: string, opts: { reel?: string; port?: string }) {
  const st = step('studio')
  const { p, spec, propsFile } = writeProps(projectDir, opts.reel)
  st.start(`Remotion Studio for ${p.name}/${spec.id}`)
  const remotion = path.join(KIT, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion')
  const args = ['studio', path.join(KIT, 'src', 'index.ts'), `--public-dir=${p.publicDir}`, `--props=${propsFile}`, ...(opts.port ? [`--port=${opts.port}`] : [])]
  const code = await stream(remotion, args, { cwd: KIT, onLine: (l) => process.stderr.write(l + '\n') })
  if (code !== 0) throw new Error(`Remotion Studio exited with ${code}`)
  st.done('studio closed')
}
