// Small process helpers.
import { execFileSync, spawn } from 'node:child_process'

export function has(cmd: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function run(cmd: string, args: string[], opts: { cwd?: string; input?: string } = {}): string {
  return execFileSync(cmd, args, { cwd: opts.cwd, input: opts.input, encoding: 'utf8', stdio: [opts.input ? 'pipe' : 'ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 })
}

/** Runs a command, streaming its stderr to ours, and calls onLine for each stdout line. Resolves with the exit code. */
export function stream(cmd: string, args: string[], opts: { cwd?: string; input?: string; onLine?: (l: string) => void; env?: NodeJS.ProcessEnv } = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'inherit'] })
    let buf = ''
    p.stdout.on('data', (d: Buffer) => {
      buf += d.toString()
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        opts.onLine?.(buf.slice(0, i))
        buf = buf.slice(i + 1)
      }
    })
    p.on('error', reject)
    p.on('close', (code) => {
      if (buf) opts.onLine?.(buf)
      resolve(code ?? 1)
    })
    if (opts.input !== undefined) p.stdin.end(opts.input)
    else p.stdin.end()
  })
}

export function probeDuration(file: string): number {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim())
}

export function probeSize(file: string): { width: number; height: number } {
  const [w, h] = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).trim().split(',')
  return { width: Number(w), height: Number(h) }
}
