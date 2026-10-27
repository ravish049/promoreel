// promoreel: one CLI for the whole pipeline. Every command prints one JSON object per line on stdout (see lib/progress.ts);
// --pretty prints short human lines instead (the default when stdout is a terminal).
import { guardStdout, emit, setProject } from './lib/progress'

guardStdout()

const HELP = `promoreel: vertical promo reels of your own web app (Remotion + free local voice and captions)

  promoreel init <dir> [--name "My App"] [--url http://localhost:3000]   scaffold a project
  promoreel record <project> [flow …] [--only clip,clip]                 film flows at phone size
  promoreel voice <project> [--reel id] [--voice name …]                  speak the script (Kokoro / Chatterbox)
  promoreel captions <project> [--reel id]                                word timings with Whisper
  promoreel render <project> [--reel id] [--crf 18] [--no-sheet]          out/<id>.mp4 + contact sheet + manifest
  promoreel all <project> [--reel id] [--fresh]                           record (if needed) → voice → captions → render
  promoreel sheet <video.mp4> [out.png] [--frames 8] [--at 1.2,4.5]       a contact sheet of any video
  promoreel studio <project> [--reel id]                                  open Remotion Studio on a reel
  promoreel repo <owner/repo | url | path>                                clone (with your gh login) or point at an app
  promoreel release <project> --tag v1.0.0 [--reel id] [--repo o/r]       attach a reel to a GitHub release (gh)
  promoreel list [dir …]                                                  projects, reels and finished videos
  promoreel doctor                                                        check the toolchain

  --json / --pretty   machine-readable lines (default when piped) or human lines (default in a terminal)
  Docs: README.md · docs/spec.md · docs/flows.md · docs/voice-providers.md`

type Opts = { _: string[]; [k: string]: string | boolean | string[] }

function parse(argv: string[]): Opts {
  const o: Opts = { _: [] }
  const multi = new Set(['voice'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2)
      const isFlag = ['fresh', 'force', 'clobber', 'dry-run', 'no-sheet', 'json', 'pretty', 'help'].includes(k)
      const val = v ?? (isFlag ? true : argv[++i])
      if (multi.has(k)) o[k] = [...((o[k] as string[]) ?? []), String(val)]
      else o[k] = val
    } else (o._ as string[]).push(a)
  }
  return o
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const num = (v: unknown) => (typeof v === 'string' ? Number(v) : undefined)

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const o = parse(rest)
  const pos = o._ as string[]
  if (!cmd || cmd === 'help' || o.help) {
    process.stderr.write(HELP + '\n')
    return
  }
  if (pos[0] && !['repo', 'sheet', 'list', 'init'].includes(cmd)) setProject(pos[0].replace(/\/$/, '').split('/').pop())
  switch (cmd) {
    case 'init':
      return (await import('./commands/init')).init(pos[0], { name: str(o.name), url: str(o.url), force: !!o.force })
    case 'record':
      return (await import('./commands/record')).record(pos[0], pos.slice(1), { only: str(o.only)?.split(',') })
    case 'voice':
      return (await import('./commands/voice')).voice(pos[0], { reel: str(o.reel), voices: o.voice as string[] | undefined })
    case 'captions':
      return (await import('./commands/captions')).captions(pos[0], { reel: str(o.reel), voice: (o.voice as string[] | undefined)?.[0] })
    case 'render':
      return (await import('./commands/render')).render(pos[0], { reel: str(o.reel), crf: num(o.crf), sheet: !o['no-sheet'], out: str(o.out) })
    case 'all':
      return (await import('./commands/all')).all(pos[0], { reel: str(o.reel), fresh: !!o.fresh, crf: num(o.crf) })
    case 'sheet':
      return (await import('./commands/sheet')).sheet(pos[0], pos[1], { frames: num(o.frames), at: str(o.at)?.split(',').map(Number) })
    case 'studio':
      return (await import('./commands/studio')).studio(pos[0], { reel: str(o.reel), port: str(o.port) })
    case 'repo':
      return (await import('./commands/repo')).repo(pos[0], { dir: str(o.dir) })
    case 'release':
      return (await import('./commands/release')).release(pos[0], { reel: str(o.reel), tag: str(o.tag), repo: str(o.repo), clobber: !!o.clobber, dryRun: !!o['dry-run'] })
    case 'list':
      return (await import('./commands/list')).list(pos)
    case 'doctor':
      return (await import('./commands/doctor')).doctor()
    default:
      throw new Error(`unknown command "${cmd}". Run promoreel help.`)
  }
}

main().catch((e: Error) => {
  emit(process.argv[2] ?? 'promoreel', 'error', e.message)
  if (process.env.PROMOREEL_DEBUG) process.stderr.write(`${e.stack}\n`)
  process.exit(1)
})
