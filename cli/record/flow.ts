// A flow file says what to do in the app, one clip at a time; the recorder films each clip at phone size (390×844 CSS px,
// 3× → 1170×2532) and logs every tap and focus so the reel can zoom, ripple and glow on them.
//
//   {
//     "name": "add-todos",                      → public/videos/add-todos/<clip>.mp4 + .json
//     "url": "http://localhost:3000",            the app (PROMOREEL_APP_URL overrides it)
//     "login": { … },                            optional, credentials from env only (see LoginSpec)
//     "setup": [ steps ],                        run first, not recorded
//     "clips": [ { "name": "01-add", "steps": [ steps ] } ]
//   }
//
// Steps (one action each): goto, tap, type, press, wait, waitFor, scroll, focus, mark, choose, upload.
// A target is a CSS / Playwright selector string, or { role, name } | { text } | { label } | { placeholder } | { testid },
// with optional "nth". See docs/flows.md for every field.
import fs from 'node:fs'
import path from 'node:path'
import type { Step } from '../lib/progress'

export type Target = string | { role?: string; name?: string; exact?: boolean; text?: string; label?: string; placeholder?: string; testid?: string; css?: string; nth?: number }

export type FlowStep =
  | { goto: string; settle?: number }
  | { tap: Target; label?: string; before?: number; after?: number }
  | { type: string; into: Target; label?: string; perKey?: number; after?: number; enter?: boolean; clear?: boolean }
  | { press: string; after?: number }
  | { wait: number }
  | { waitFor: Target; state?: 'visible' | 'hidden'; timeout?: number }
  | { scroll: Target | { by: number }; label?: string; block?: 'start' | 'center' | 'end'; after?: number }
  | { focus: Target; label: string; card?: boolean; minHeight?: number }
  | { mark: string }
  | { choose: Target; option: string; label?: string }
  | { upload: Target; files: string[]; label?: string }

/** Optional sign-in before recording. Credentials only ever come from environment variables, never from the file. */
export type LoginSpec = {
  /** The login page, relative to url. */
  path: string
  email: Target
  password: Target
  submit: Target
  /** Env var names holding the test account (defaults PROMOREEL_LOGIN_EMAIL / PROMOREEL_LOGIN_PASSWORD). */
  emailEnv?: string
  passwordEnv?: string
  /** Wait until the URL no longer contains this after submitting (default: the login path). */
  doneWhenUrlNot?: string
}

export type FlowFile = {
  name: string
  url: string
  login?: LoginSpec
  /** CSS selectors hidden while recording (a chat bubble, a cookie banner). */
  hide?: string[]
  /** localStorage keys set before every page load. */
  localStorage?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  locale?: string
  timezone?: string
  /** A phone standing at a place: the page's geolocation answers with it. */
  geolocation?: { latitude: number; longitude: number; accuracy?: number }
  setup?: FlowStep[]
  clips: { name: string; leadMs?: number; tailMs?: number; steps: FlowStep[] }[]
}

type Page = import('playwright-core').Page
type Locator = import('playwright-core').Locator

export function locate(page: Page, t: Target): Locator {
  let loc: Locator
  if (typeof t === 'string') loc = page.locator(t)
  else if (t.role) loc = page.getByRole(t.role as Parameters<Page['getByRole']>[0], t.name ? { name: t.name, exact: t.exact } : {})
  else if (t.text) loc = page.getByText(t.text, { exact: t.exact })
  else if (t.label) loc = page.getByLabel(t.label, { exact: t.exact })
  else if (t.placeholder) loc = page.getByPlaceholder(t.placeholder, { exact: t.exact })
  else if (t.testid) loc = page.getByTestId(t.testid)
  else if (t.css) loc = page.locator(t.css)
  else throw new Error(`a target needs one of role, text, label, placeholder, testid, css: ${JSON.stringify(t)}`)
  // a selector that matches several elements acts on the first (or the nth), instead of failing Playwright's strict mode
  return typeof t === 'object' && t.nth !== undefined ? loc.nth(t.nth) : loc.first()
}

const labelOf = (s: { label?: string }, t: Target, kind: string) => s.label ?? (typeof t === 'string' ? `${kind}:${t}` : `${kind}:${t.name ?? t.text ?? t.label ?? t.placeholder ?? t.testid ?? t.css ?? 'target'}`)

export function validateFlow(f: FlowFile, file: string) {
  const where = path.basename(file)
  if (!f.name || !/^[a-z0-9][a-z0-9._-]*$/i.test(f.name)) throw new Error(`${where}: "name" must be a simple folder name (letters, digits, - _ .)`)
  if (!f.url && !process.env.PROMOREEL_APP_URL) throw new Error(`${where}: "url" is required (or set PROMOREEL_APP_URL)`)
  if (!Array.isArray(f.clips) || f.clips.length === 0) throw new Error(`${where}: "clips" needs at least one clip`)
  const known = ['goto', 'tap', 'type', 'press', 'wait', 'waitFor', 'scroll', 'focus', 'mark', 'choose', 'upload']
  for (const c of f.clips)
    for (const s of c.steps) {
      const k = Object.keys(s).find((x) => known.includes(x))
      if (!k) throw new Error(`${where}: clip ${c.name}: unknown step ${JSON.stringify(s)} (use one of ${known.join(', ')})`)
    }
}

type Clip = {
  tap: (l: Locator, label: string, o?: object) => Promise<void>
  type: (l: Locator, label: string, text: string, o?: object) => Promise<void>
  press: (key: string, o?: { after?: number; label?: string }) => Promise<void>
  focus: (l: Locator, label: string) => Promise<void>
  focusCard: (l: Locator, label: string, o?: object) => Promise<void>
  scrollTo: (l: Locator, label: string, o?: object) => Promise<void>
  scrollBy: (dy: number, label?: string, o?: object) => Promise<void>
  choose: (l: Locator, label: string, option: object, o?: object) => Promise<void>
  tapForFiles: (l: Locator, label: string, files: string[], o?: object) => Promise<void>
  mark: (label: string) => void
}

/** Runs steps; inside a clip the clip's helpers log every event, outside (setup) they just act. */
async function runSteps(steps: FlowStep[], page: Page, go: (u: string, settle?: number) => Promise<void>, c: Clip | null, flowDir: string) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  for (const s of steps) {
    if ('goto' in s) await go(s.goto, s.settle)
    else if ('tap' in s) {
      const l = locate(page, s.tap)
      if (c) await c.tap(l, labelOf(s, s.tap, 'tap'), { before: s.before, after: s.after })
      else await l.click()
    } else if ('type' in s) {
      const l = locate(page, s.into)
      if (s.clear) await l.fill('')
      if (c) await c.type(l, labelOf(s, s.into, 'type'), s.type, { perKey: s.perKey, after: s.enter ? 250 : s.after })
      else await l.fill(s.type)
      if (s.enter) {
        if (c) await c.press('Enter', { after: s.after, label: `${labelOf(s, s.into, 'type')}-enter` })
        else await page.keyboard.press('Enter')
      }
    } else if ('press' in s) {
      if (c) await c.press(s.press, { after: s.after })
      else await page.keyboard.press(s.press)
    } else if ('wait' in s) await sleep(s.wait)
    else if ('waitFor' in s) await locate(page, s.waitFor).waitFor({ state: s.state ?? 'visible', timeout: s.timeout ?? 30000 })
    else if ('scroll' in s) {
      const t = s.scroll
      if (typeof t === 'object' && 'by' in t) {
        if (c) await c.scrollBy(t.by, s.label ?? 'scroll', { after: s.after })
        else await page.evaluate((y) => window.scrollBy(0, y), t.by)
      } else {
        const l = locate(page, t as Target)
        if (c) await c.scrollTo(l, labelOf(s, t as Target, 'scroll'), { block: s.block, after: s.after })
        else await l.scrollIntoViewIfNeeded()
      }
    } else if ('focus' in s) {
      if (!c) continue
      const l = locate(page, s.focus)
      if (s.card) await c.focusCard(l, s.label, { minHeight: s.minHeight })
      else await c.focus(l, s.label)
    } else if ('mark' in s) c?.mark(s.mark)
    else if ('choose' in s) {
      const l = locate(page, s.choose)
      if (c) await c.choose(l, labelOf(s, s.choose, 'choose'), { label: s.option })
      else await l.selectOption({ label: s.option })
    } else if ('upload' in s) {
      const files = s.files.map((f) => path.resolve(flowDir, f))
      const l = locate(page, s.upload)
      if (c) await c.tapForFiles(l, labelOf(s, s.upload, 'upload'), files)
      else await l.setInputFiles(files)
    }
  }
}

function isLocal(url: string) {
  try {
    const h = new URL(url).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.test')
  } catch {
    return false
  }
}

/** Records every clip of a flow into outDir. Returns the clip manifests. */
export async function recordFlow(file: string, outDir: string, st: Step, only?: string[]) {
  const flowDir = path.dirname(file)
  let manifests: { name: string; durationMs: number }[] = []
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createRecorder } = require('./recorder.cjs')

  if (/\.(mjs|cjs|js)$/.test(file)) {
    // a scripted flow: export default async function ({ createRecorder, outDir, env, log }) → clip manifests
    const mod = await import(path.resolve(file))
    const fn = mod.default ?? mod
    if (typeof fn !== 'function') throw new Error(`${file}: export a default async function`)
    manifests = (await fn({ createRecorder, outDir, env: process.env, log: (m: string) => st.log(m) })) ?? []
    return manifests
  }

  const flow = JSON.parse(fs.readFileSync(file, 'utf8')) as FlowFile
  validateFlow(flow, file)
  const base = process.env.PROMOREEL_APP_URL || flow.url
  if (flow.login) {
    const eEnv = flow.login.emailEnv ?? 'PROMOREEL_LOGIN_EMAIL'
    const pEnv = flow.login.passwordEnv ?? 'PROMOREEL_LOGIN_PASSWORD'
    if (!process.env[eEnv] || !process.env[pEnv]) throw new Error(`flow ${flow.name} signs in: set ${eEnv} and ${pEnv} to a TEST account of your local app (they are never written to any file)`)
    if (!isLocal(base) && process.env.PROMOREEL_ALLOW_REMOTE_LOGIN !== '1')
      throw new Error(`flow ${flow.name} signs in to ${new URL(base).host}, which is not local. Record a local or staging copy with a test account. If you really mean it, set PROMOREEL_ALLOW_REMOTE_LOGIN=1.`)
  }
  const clips = flow.clips.filter((c) => !only?.length || only.includes(c.name))
  if (clips.length === 0) throw new Error(`flow ${flow.name}: no clip named ${only?.join(', ')}`)

  const rec = await createRecorder({
    base,
    outDir,
    colorScheme: flow.colorScheme ?? 'light',
    locale: flow.locale ?? 'en-US',
    timezoneId: flow.timezone,
    geolocation: flow.geolocation ?? null,
    localStorage: flow.localStorage ?? null,
    log: (m: string) => st.log(m),
  })
  try {
    const page: Page = rec.page
    const go = (u: string, settle?: number) => rec.go(u, settle ?? 1200)
    if (flow.hide?.length) await rec.hide(flow.hide)
    if (flow.login) {
      const L = flow.login
      st.log(`signing in at ${L.path} with $${L.emailEnv ?? 'PROMOREEL_LOGIN_EMAIL'}`)
      await go(L.path, 600)
      await locate(page, L.email).fill(process.env[L.emailEnv ?? 'PROMOREEL_LOGIN_EMAIL']!)
      await locate(page, L.password).fill(process.env[L.passwordEnv ?? 'PROMOREEL_LOGIN_PASSWORD']!)
      const away = L.doneWhenUrlNot ?? L.path
      await Promise.all([page.waitForURL((u) => !u.pathname.includes(away), { timeout: 45000 }), locate(page, L.submit).click()])
      await new Promise((r) => setTimeout(r, 1200))
    }
    if (flow.setup?.length) await runSteps(flow.setup, page, go, null, flowDir)
    let k = 0
    for (const c of clips) {
      st.progress((k / clips.length) * 100, `clip ${c.name}`)
      const m = await rec.clip(c.name, (helpers: Clip) => runSteps(c.steps, page, go, helpers, flowDir), { leadMs: c.leadMs ?? 500, tailMs: c.tailMs ?? 900 })
      manifests.push(m)
      k++
      st.progress((k / clips.length) * 100, `clip ${c.name}: ${(m.durationMs / 1000).toFixed(1)} s`)
    }
  } finally {
    await rec.close()
  }
  fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify({ flow: flow.name, clips: manifests.map((m) => m.name), recorded: new Date().toISOString() }, null, 2) + '\n')
  return manifests
}
