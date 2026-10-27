// promoreel doctor: what is installed, what is missing, and the one command that fixes each.
import fs from 'node:fs'
import path from 'node:path'
import { KIT } from '../lib/project'
import { step } from '../lib/progress'
import { has, run } from '../lib/sh'
import { chatterboxPython } from '../voice/chatterbox'

type Check = { name: string; ok: boolean; required: boolean; detail: string; fix?: string }

export async function doctor() {
  const st = step('doctor')
  st.start('checking the toolchain')
  const checks: Check[] = []
  const major = Number(process.versions.node.split('.')[0])
  checks.push({ name: 'node', ok: major >= 20, required: true, detail: process.versions.node, fix: 'install Node 20 or newer' })
  const ff = has('ffmpeg')
  checks.push({ name: 'ffmpeg', ok: ff, required: true, detail: ff ? run('ffmpeg', ['-version']).split('\n')[0] : 'missing', fix: 'brew install ffmpeg (macOS) · apt install ffmpeg (Linux)' })
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chromium = require(path.join(KIT, 'cli', 'record', 'chromium.cjs')).findChromium()
  checks.push({ name: 'chromium (recorder)', ok: !!chromium, required: true, detail: chromium ?? 'missing', fix: 'npx playwright-core install chromium' })
  checks.push({ name: 'node_modules', ok: fs.existsSync(path.join(KIT, 'node_modules', 'remotion')), required: true, detail: '', fix: 'npm install' })
  const whisper = path.join(KIT, '.cache', 'whisper.cpp')
  checks.push({ name: 'whisper.cpp (captions)', ok: fs.existsSync(whisper), required: false, detail: fs.existsSync(whisper) ? whisper : 'installs itself on the first `promoreel captions`', fix: '' })
  checks.push({ name: 'chatterbox (optional voice)', ok: fs.existsSync(chatterboxPython(KIT)), required: false, detail: fs.existsSync(chatterboxPython(KIT)) ? 'installed' : 'not installed; Kokoro works without it', fix: 'bash scripts/install-chatterbox.sh' })
  const gh = has('gh')
  let ghAuth = false
  if (gh)
    try {
      run('gh', ['auth', 'status'])
      ghAuth = true
    } catch {
      ghAuth = false
    }
  checks.push({ name: 'gh (optional: clone repos, attach to releases)', ok: gh && ghAuth, required: false, detail: !gh ? 'not installed' : ghAuth ? 'signed in' : 'not signed in', fix: gh ? 'gh auth login' : 'https://cli.github.com' })
  for (const c of checks) (c.ok ? st.log : c.required ? st.warn : st.log)(`${c.ok ? 'ok ' : c.required ? 'MISSING' : 'optional'} ${c.name}${c.detail ? ` · ${c.detail}` : ''}${!c.ok && c.fix ? ` → ${c.fix}` : ''}`)
  const missing = checks.filter((c) => c.required && !c.ok)
  if (missing.length) throw new Error(`missing: ${missing.map((c) => c.name).join(', ')}`)
  st.done('ready', { checks })
}
