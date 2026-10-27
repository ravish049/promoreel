// Every CLI step reports progress as one JSON object per line on stdout, so another program (a web studio, a CI job, an
// agent) can follow along:
//   {"step":"record","status":"progress","pct":40,"msg":"clip 02-add: 3.1 s · 94 frames","ts":"2026-10-27T15:00:00.000Z"}
// status is one of: start | progress | log | warn | done | error. `pct` is 0–100 for the step. `data` carries results
// (paths, durations). Anything else a library prints goes to stderr, never stdout.
// With --pretty (or when stdout is a terminal) the same events print as short human lines instead.

export type Status = 'start' | 'progress' | 'log' | 'warn' | 'done' | 'error'
export type Event = { step: string; status: Status; pct?: number; msg?: string; data?: unknown; project?: string; ts: string }

let pretty = process.argv.includes('--pretty') || (process.stdout.isTTY === true && !process.argv.includes('--json'))
let project: string | undefined

export function setProject(name: string | undefined) {
  project = name
}
export function setPretty(v: boolean) {
  pretty = v
}

const ICON: Record<Status, string> = { start: '▸', progress: '·', log: ' ', warn: '⚠', done: '✓', error: '✗' }

export function emit(step: string, status: Status, msg?: string, extra: { pct?: number; data?: unknown } = {}) {
  const ev: Event = { step, status, ...(extra.pct !== undefined ? { pct: Math.max(0, Math.min(100, Math.round(extra.pct))) } : {}), ...(msg ? { msg } : {}), ...(extra.data !== undefined ? { data: extra.data } : {}), ...(project ? { project } : {}), ts: new Date().toISOString() }
  if (pretty) {
    const pct = ev.pct !== undefined && status === 'progress' ? `${String(ev.pct).padStart(3)}% ` : ''
    process.stdout.write(`${ICON[status]} ${step.padEnd(8)} ${pct}${msg ?? ''}\n`)
    if (status === 'done' && extra.data && typeof extra.data === 'object' && 'path' in (extra.data as object)) process.stdout.write(`  → ${(extra.data as { path: string }).path}\n`)
  } else {
    process.stdout.write(JSON.stringify(ev) + '\n')
  }
}

/** A step helper: `const s = step('voice'); s.start('…'); s.progress(40, '…'); s.done('…', data)`. */
export function step(name: string) {
  return {
    start: (msg?: string, data?: unknown) => emit(name, 'start', msg, { pct: 0, data }),
    progress: (pct: number, msg?: string) => emit(name, 'progress', msg, { pct }),
    log: (msg: string) => emit(name, 'log', msg),
    warn: (msg: string) => emit(name, 'warn', msg),
    done: (msg?: string, data?: unknown) => emit(name, 'done', msg, { pct: 100, data }),
    error: (msg: string) => emit(name, 'error', msg),
  }
}
export type Step = ReturnType<typeof step>

/** Keep stdout for progress events only: whatever libraries log goes to stderr. */
export function guardStdout() {
  console.log = console.error
  console.info = console.error
}
