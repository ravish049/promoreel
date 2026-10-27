// promoreel all <project> [--reel id] [--fresh]
// The whole pipeline for one reel: record the flows its phone scenes need (only those not recorded yet, or all with
// --fresh) → voice → captions → render (+ contact sheet + manifest). Each step prints its own progress lines; this
// command adds {"step":"all"} lines with the overall percentage.
import fs from 'node:fs'
import path from 'node:path'
import { clipsDirsOf, loadProject, pickReel } from '../lib/project'
import { step } from '../lib/progress'
import { captions } from './captions'
import { flowFiles, flowName, record } from './record'
import { render } from './render'
import { voice } from './voice'

export async function all(projectDir: string, opts: { reel?: string; fresh?: boolean; crf?: number }) {
  const st = step('all')
  const p = loadProject(projectDir)
  const { spec } = pickReel(p, opts.reel)
  st.start(`${spec.id}: record → voice → captions → render`)

  const needed = clipsDirsOf(spec).map((d) => d.replace(/^videos\//, ''))
  const flows = flowFiles(p.dir)
  const toRecord = needed.filter((name) => {
    const recorded = fs.existsSync(path.join(p.publicDir, 'videos', name, 'clips.json'))
    if (recorded && !opts.fresh) return false
    if (!flows.some((f) => flowName(f) === name)) {
      if (recorded) return false
      throw new Error(`the reel needs recordings in videos/${name}, and no flow is named "${name}"`)
    }
    return true
  })
  if (toRecord.length) await record(p.dir, toRecord, {})
  else if (needed.length) st.log(`recordings present (${needed.join(', ')}); --fresh records them again`)
  st.progress(30, 'recorded')
  await voice(p.dir, { reel: spec.id })
  st.progress(55, 'voiced')
  await captions(p.dir, { reel: spec.id })
  st.progress(65, 'captioned')
  const entry = await render(p.dir, { reel: spec.id, crf: opts.crf })
  st.done(`${entry.path} · ${entry.durationSec} s`, entry)
}
