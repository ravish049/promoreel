// promoreel render <project> [--reel id] [--crf 18] [--no-sheet]
// Bundles the template, renders the reel to out/<id>.mp4 (H.264, 1080×1920), makes out/<id>-sheet.png (8 frames), and
// adds the video to out/manifest.json. Progress comes from Remotion's own render callback.
import fs from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { KIT, buildProps, ensurePublic, loadProject, pickReel, rel } from '../lib/project'
import { step } from '../lib/progress'
import { upsertVideo } from '../lib/manifest'
import { probeDuration, probeSize } from '../lib/sh'
import { contactSheet } from './sheet'

/** The props Remotion gets, written to out/.props-<id>.json (Studio reads the same file). */
export function writeProps(projectDir: string, reel?: string) {
  const p = loadProject(projectDir)
  const { spec, file } = pickReel(p, reel)
  ensurePublic(p)
  const props = buildProps(p, spec)
  fs.mkdirSync(p.outDir, { recursive: true })
  const propsFile = path.join(p.outDir, `.props-${spec.id}.json`)
  fs.writeFileSync(propsFile, JSON.stringify(props))
  return { p, spec, file, props, propsFile }
}

export async function render(projectDir: string, opts: { reel?: string; crf?: number; sheet?: boolean; out?: string }) {
  const st = step('render')
  const { p, spec, file, props } = writeProps(projectDir, opts.reel)
  st.start(`${spec.id}: bundling the template`)
  let lastPct = -1
  const serveUrl = await bundle({
    entryPoint: path.join(KIT, 'src', 'index.ts'),
    publicDir: p.publicDir,
    onProgress: (pct) => {
      if (pct - lastPct >= 20) {
        lastPct = pct
        st.progress(pct * 0.1, `bundling ${pct}%`)
      }
    },
  })
  const inputProps = props as unknown as Record<string, unknown>
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps, logLevel: 'error' })
  const seconds = composition.durationInFrames / composition.fps
  st.progress(10, `${spec.id}: ${seconds.toFixed(1)} s, ${composition.durationInFrames} frames`)
  const out = opts.out ? path.resolve(opts.out) : path.join(p.outDir, `${spec.id}.mp4`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  let lastEmit = 0
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: opts.crf ?? spec.crf ?? 18,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    pixelFormat: 'yuv420p',
    outputLocation: out,
    inputProps,
    logLevel: 'error',
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const now = Date.now()
      if (now - lastEmit < 1500 && progress < 1) return
      lastEmit = now
      st.progress(10 + progress * 85, `frames ${renderedFrames}/${composition.durationInFrames}, encoded ${encodedFrames}`)
    },
  })
  const durationSec = +probeDuration(out).toFixed(2)
  let sheetRel: string | undefined
  if (opts.sheet !== false) {
    const sheetPath = out.replace(/\.mp4$/, '') + '-sheet.png'
    contactSheet(out, sheetPath)
    sheetRel = rel(p, sheetPath)
    st.progress(98, `contact sheet ${sheetRel}`)
  }
  const { width, height } = probeSize(out)
  const entry = {
    id: spec.id,
    title: spec.title ?? spec.id,
    path: rel(p, out),
    ...(sheetRel ? { sheet: sheetRel } : {}),
    durationSec,
    width,
    height,
    sizeBytes: fs.statSync(out).size,
    voice: spec.voice.use,
    created: new Date().toISOString(),
    spec: rel(p, file),
  }
  upsertVideo(p.outDir, p.name, entry)
  st.done(`${entry.path} · ${durationSec} s`, entry)
  return entry
}
