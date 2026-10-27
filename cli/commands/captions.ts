// promoreel captions <project> [--reel id] [--voice name]
// Word timings for the voice-over: whisper.cpp (local, free) with token-level timestamps → @remotion/captions Caption[].
// Installs whisper.cpp and its model (captions.model, default base.en) into the kit's .cache/ on first run.
// Each line's WAV is transcribed on its own; Whisper's timings are laid onto the line's OWN words (`text`, else `say`),
// so the captions spell things your way ("CrewDash", "38") whatever Whisper heard. What Whisper heard is reported per
// line: the check for a slurred word (if a line reads back wrong, give it another `seed` or reword it).
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe, type WhisperModel } from '@remotion/install-whisper-cpp'
import type { Caption } from '@remotion/captions'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { captionText, resolveSpec, voiceDir } from '../../src/reel/shared'
import { KIT, loadProject, pickReel, readJson } from '../lib/project'
import { step } from '../lib/progress'
import { align, words } from '../lib/align'

const VERSION = '1.5.5'

export async function captions(projectDir: string, opts: { reel?: string; voice?: string }) {
  const st = step('captions')
  const p = loadProject(projectDir)
  const { spec } = pickReel(p, opts.reel)
  const r = resolveSpec(spec, p.brand)
  const voice = opts.voice ?? r.voice.use
  const model = (r.captions?.model ?? 'base.en') as WhisperModel
  const whisperPath = path.join(KIT, '.cache', 'whisper.cpp')
  st.start(`Whisper ${model} on ${r.lines.length} lines (${voice})`)

  const exe = ['main', 'main.exe', 'build/bin/whisper-cli'].some((f) => fs.existsSync(path.join(whisperPath, f)))
  if (fs.existsSync(whisperPath) && !exe) throw new Error(`${whisperPath} exists but has no whisper executable: delete it and run again`)
  if (!fs.existsSync(whisperPath)) st.log('installing whisper.cpp (first run only: downloads and compiles, a few minutes)')
  await installWhisperCpp({ to: whisperPath, version: VERSION, printOutput: false })
  st.progress(5, 'whisper.cpp ready')
  await downloadWhisperModel({ model, folder: whisperPath, printOutput: false })
  st.progress(10, `model ${model} ready`)

  const dir = path.join(p.publicDir, voiceDir(r.id, voice))
  const linesFile = path.join(dir, 'lines.json')
  if (!fs.existsSync(linesFile)) throw new Error(`no voice-over for ${voice}: run promoreel voice first`)
  const durations = readJson<{ lines: Record<string, { durationMs: number }> }>(linesFile).lines
  const out: Record<string, Caption[]> = {}
  const heardBack: Record<string, string> = {}
  let k = 0
  for (const line of r.lines) {
    const wav16k = path.join(whisperPath, `tmp-${r.id}-${line.id}.wav`)
    // a little silence each side helps Whisper place the first and last word
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, `${line.id}.wav`), '-af', 'adelay=300,apad=pad_dur=0.5', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav16k])
    const whisperCppOutput = await transcribe({ inputPath: wav16k, whisperPath, whisperCppVersion: VERSION, model, tokenLevelTimestamps: true, language: 'en', printOutput: false })
    fs.rmSync(wav16k)
    const heard = words(toCaptions({ whisperCppOutput }).captions).map((c) => ({ ...c, startMs: Math.max(0, c.startMs - 300), endMs: Math.max(0, c.endMs - 300) }))
    const script = captionText(line).split(/\s+/).filter(Boolean)
    out[line.id] = align(script, heard, durations[line.id].durationMs)
    heardBack[line.id] = heard.map((h) => h.text.trim()).join(' ')
    k++
    st.progress(10 + (k / r.lines.length) * 90, `${line.id}: heard "${heardBack[line.id]}"`)
  }
  fs.writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(out, null, 2) + '\n')
  st.done(`captions for ${r.lines.length} lines`, { reel: r.id, voice, heard: heardBack })
}
