// promoreel sheet <video.mp4> [out.png] [--frames 8] [--at 1.2,4,…]
// A contact sheet: N frames of a video in two rows, each stamped with its time, to check a render at a glance
// (the agent reads this image to review a reel without watching it).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { step } from '../lib/progress'
import { probeDuration, run } from '../lib/sh'

const FONTS = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf']

let drawtext: boolean | null = null
const hasDrawtext = () => (drawtext ??= /drawtext/.test(run('ffmpeg', ['-hide_banner', '-filters'])))

export function contactSheet(input: string, output: string, times?: number[], frames = 8): { path: string; times: number[] } {
  const d = probeDuration(input)
  const ts = times?.length ? times : Array.from({ length: frames }, (_, k) => +((d * (k + 0.5)) / frames).toFixed(2))
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promoreel-sheet-'))
  try {
    const font = FONTS.find((f) => fs.existsSync(f))
    ts.forEach((t, i) => {
      const label = `${t.toFixed(1)} s`
      const vf = hasDrawtext() && font ? `scale=405:720,pad=425:770:10:10:white,drawtext=fontfile='${font}':text='${label}':x=(w-tw)/2:y=740:fontsize=24:fontcolor=0x1C1C1E` : 'scale=405:720,pad=425:750:10:10:white'
      run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', input, '-frames:v', '1', '-vf', vf, path.join(tmp, `${String(i).padStart(2, '0')}.png`)])
    })
    const cols = Math.ceil(ts.length / 2)
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
    run('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(tmp, '*.png'), '-vf', `tile=${cols}x2:color=white`, '-frames:v', '1', output])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return { path: output, times: ts }
}

export async function sheet(input: string | undefined, output: string | undefined, opts: { frames?: number; at?: number[] }) {
  const st = step('sheet')
  if (!input || !fs.existsSync(input)) throw new Error(`no video ${input ?? ''}`)
  const out = output ?? input.replace(/\.mp4$/, '') + '-sheet.png'
  st.start(path.basename(input))
  const r = contactSheet(input, out, opts.at, opts.frames ?? 8)
  st.done(`contact sheet at ${r.times.map((t) => t.toFixed(1)).join(', ')} s`, r)
}
