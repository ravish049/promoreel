// A project is a folder with a brand.json, its reels (reels/<id>.json) and its flows (flows/<name>.flow.json):
//
//   my-app/
//     brand.json            colours, font, logo, photo, the outro's features and voice
//     reels/launch.json     a reel spec: lines, scenes, clips, camera moves
//     flows/signup.flow.json  what the recorder does in the app
//     public/               logo + photo you add; videos/, vo/, sfx/ the CLI writes (Remotion serves this folder)
//     out/                  renders, contact sheets, manifest.json
import fs from 'node:fs'
import path from 'node:path'
import type { Anchor, Brand, Format, LaunchSpec, LineSpec, PhoneScene, PitchScreen, ReelSpec, ReplaceFormat, ReplaceSpec, ScreenSpec, ShowcaseScene, Style, VideoSpec, WalkSpec } from '../../src/reel/spec'
import {
  FORMAT_SIZE,
  REPLACE_DIM_MAX,
  REPLACE_SECONDS,
  REPLACE_SECONDS_RANGE,
  STYLES,
  STYLE_FORMATS,
  TOOL_ICONS,
  cutsOf,
  formatsOf,
  resolveLaunch,
  resolveReplace,
  resolveSpec,
  resolveWalk,
  styleOf,
  type Resolved,
  type ResolvedLaunch,
  type ResolvedReplace,
  type ResolvedWalk,
} from '../../src/reel/shared'
import { ICON_NAMES } from '../../src/reel/icons'
import { run } from './sh'

/** The kit's own folder (where package.json is). */
export const KIT = path.resolve(__dirname, '..', '..')

export type Project = {
  dir: string
  name: string
  brand: Brand
  publicDir: string
  outDir: string
  reels: { id: string; file: string }[]
}

export function readJson<T>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch (e) {
    throw new Error(`could not read ${file}: ${(e as Error).message}`)
  }
}

export function loadProject(dirArg: string | undefined): Project {
  if (!dirArg) throw new Error('which project? Pass its folder, e.g. examples/generic')
  const dir = path.resolve(dirArg)
  const brandFile = path.join(dir, 'brand.json')
  if (!fs.existsSync(brandFile)) throw new Error(`${dirArg} is not a project: no brand.json (create one with: promoreel init ${dirArg})`)
  const brand = readJson<Brand>(brandFile)
  for (const k of ['ink', 'paper', 'accent'] as const) if (!brand.colors?.[k]) throw new Error(`brand.json: colors.${k} is required`)
  if (!Array.isArray(brand.features)) brand.features = []
  const reelsDir = path.join(dir, 'reels')
  const reels = fs.existsSync(reelsDir)
    ? fs
        .readdirSync(reelsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ id: readJson<VideoSpec>(path.join(reelsDir, f)).id, file: path.join(reelsDir, f) }))
    : []
  const owner = new Map<string, string>()
  for (const r of reels) {
    let names: string[]
    try {
      names = outputNames(readJson<VideoSpec>(r.file))
    } catch {
      continue // a malformed spec fails with its own reason when it's picked
    }
    for (const n of names) {
      const other = owner.get(n)
      if (other && other !== r.file) throw new Error(`${path.basename(other)} and ${path.basename(r.file)} both render to out/${n}.mp4: rename a reel id or cut`)
      owner.set(n, r.file)
    }
  }
  return { dir, name: path.basename(dir), brand, publicDir: path.join(dir, 'public'), outDir: path.join(dir, 'out'), reels }
}

/** The reel to work on: --reel <id>, or the project's only reel. */
export function pickReel(p: Project, id: string | undefined): { spec: VideoSpec; file: string } {
  if (p.reels.length === 0) throw new Error(`${p.name} has no reels: add one to ${path.join(p.dir, 'reels')}/`)
  const r = id ? p.reels.find((x) => x.id === id || path.basename(x.file, '.json') === id) : p.reels.length === 1 ? p.reels[0] : null
  if (!r) throw new Error(id ? `no reel "${id}" in ${p.name} (has: ${p.reels.map((x) => x.id).join(', ')})` : `${p.name} has several reels; pick one with --reel (${p.reels.map((x) => x.id).join(', ')})`)
  const spec = readJson<VideoSpec>(r.file)
  validateSpec(spec, r.file, p.brand, p.publicDir)
  return { spec, file: r.file }
}

const FORMATS = Object.keys(FORMAT_SIZE) as Format[]
const SCREEN_KINDS = ['list', 'table', 'form', 'phone', 'stat']
/** What a replace ad's phone can show (the ad draws the phone itself, so not another phone). */
const REPLACE_SCREEN_KINDS = ['list', 'table', 'form', 'stat', 'pitch']
const LAUNCH_KINDS = ['hook', 'screen', 'payoff', 'logo']
const ICONS = new Set<string>(ICON_NAMES)
const list = (xs: readonly string[]) => xs.join(', ')

/**
 * Fail early, with the reason, on the mistakes a hand-written or agent-written spec usually has. Each style has its own
 * required fields; with the brand, also the closing copy the style needs (brand.outro for recorded, a CTA for the others);
 * with the project's public/ folder, also that the media a replace ad names is there.
 */
export function validateSpec(spec: VideoSpec, file: string, brand?: Brand, publicDir?: string) {
  const where = path.basename(file)
  const fail = (msg: string): never => {
    throw new Error(`${where}: ${msg}`)
  }
  if (!spec.id) fail('"id" is required')
  const style = styleOf(spec)
  if (!STYLES.includes(style)) fail(`"style" must be one of ${list(STYLES)} (got "${style}")`)
  if (spec.formats !== undefined) {
    if (!Array.isArray(spec.formats) || spec.formats.length === 0) fail(`"formats" must be a non-empty list of ${list(FORMATS)}`)
    for (const f of spec.formats) if (!FORMATS.includes(f)) fail(`format "${f}" is not one of ${list(FORMATS)}`)
    const bad = formatsOf(spec).find((f) => !STYLE_FORMATS[style].includes(f))
    if (bad) fail(formatRefusal(style, bad))
  }
  if (spec.style === 'walk') validateWalk(spec, where, fail, brand)
  else if (spec.style === 'launch') validateLaunch(spec, where, fail, brand)
  else if (spec.style === 'replace') validateReplace(spec, where, fail, brand, publicDir)
  else validateRecorded(spec, where, fail, brand)
}

/** Why a style can't render in a format, naming the formats it does take. */
function formatRefusal(style: Style, format: Format): string {
  if (style === 'recorded' || style === 'walk') return `a ${style} reel renders in 9x16 only; launch films also take 16x9 and 1x1, replace ads 4x5 and 1x1`
  if (style === 'launch') return `a launch film renders in 9x16, 16x9 and 1x1 (got "${format}"${format === '4x5' ? '; 4x5 is for replace ads only' : ''})`
  return `a replace ad renders in 9x16, 4x5 and 1x1 (got "${format}")`
}

type Fail = (msg: string) => never

/** The script: ids unique, every line says something; an ellipsis gets a note (TTS pauses oddly there). */
function checkLines(lines: LineSpec[] | undefined, where: string, fail: Fail): Set<string> {
  if (!Array.isArray(lines)) return fail('"lines" is required: the script, [{ "id", "say" }, …]')
  const ids = new Set<string>()
  for (const l of lines) {
    if (!l?.id || typeof l.say !== 'string') fail('every line needs an "id" and a "say"')
    if (ids.has(l.id)) fail(`line "${l.id}" is defined twice`)
    ids.add(l.id)
  }
  for (const l of lines) if (/…|\.\.\./.test(l.say)) process.stderr.write(`note: ${where} line "${l.id}" has an ellipsis; TTS often pauses oddly there. Use "|" for a breath instead.\n`)
  return ids
}

function validateRecorded(spec: ReelSpec, where: string, fail: Fail, brand?: Brand) {
  if (!spec.voice?.use) fail('voice.use is required (e.g. "af_heart" or "chatterbox")')
  if (!Array.isArray(spec.scenes)) fail('"scenes" is required: [{ "id", "type": "hook" | "quiz" | "phone" | … }, …]')
  const ids = checkLines(spec.lines, where, fail)
  for (const s of spec.scenes) {
    const ls = (s as { lines?: { id: string }[] }).lines ?? []
    for (const l of ls) if (!ids.has(l.id)) fail(`scene "${s.id}" uses line "${l.id}", which is not in "lines"`)
  }
  if (brand && !brand.outro) throw new Error('brand.json: outro { title, cta, lines } is required for recorded reels')
}

function checkIcon(icon: unknown, what: string, fail: Fail) {
  if (typeof icon !== 'string' || !ICONS.has(icon)) fail(`${what}: icon "${String(icon)}" is not one of the bundled icons (src/reel/icons.tsx)`)
}

/** A screen-kit screen: a known kind and the fields that kind draws. */
function checkScreen(screen: ScreenSpec | undefined, what: string, fail: Fail, inPhone = false) {
  if (!screen || typeof screen !== 'object') return fail(`${what} needs a "screen": { "kind": ${SCREEN_KINDS.map((k) => `"${k}"`).join(' | ')}, … }`)
  if (!SCREEN_KINDS.includes(screen.kind)) fail(`${what}: screen kind "${screen.kind}" is not one of ${list(SCREEN_KINDS)}`)
  if (screen.kind !== 'phone' && screen.icon !== undefined) checkIcon(screen.icon, what, fail)
  switch (screen.kind) {
    case 'list':
      if (!Array.isArray(screen.rows) || screen.rows.length === 0) fail(`${what}: a list screen needs "rows": [{ "title" }, …]`)
      for (const r of screen.rows) {
        if (!r?.title) fail(`${what}: every list row needs a "title"`)
        if (r.icon !== undefined) checkIcon(r.icon, what, fail)
      }
      break
    case 'table': {
      const n = Array.isArray(screen.columns) ? screen.columns.length : 0
      if (n === 0) fail(`${what}: a table screen needs "columns": ["…", …]`)
      if (!Array.isArray(screen.rows) || screen.rows.length === 0) fail(`${what}: a table screen needs "rows": [["…", …], …]`)
      for (const r of screen.rows) if (!Array.isArray(r) || r.length !== n) fail(`${what}: every table row needs ${n} cells, one per column`)
      const c = screen.compare?.columns
      if (screen.compare && (!Array.isArray(c) || c.length !== 2 || c.some((i) => !Number.isInteger(i) || i < 0 || i >= n))) fail(`${what}: compare.columns must be two column indexes (0–${n - 1})`)
      break
    }
    case 'form':
      if (!screen.fields?.length && !screen.items?.length) fail(`${what}: a form screen needs "fields" or "items"`)
      break
    case 'stat':
      if (!Number.isInteger(screen.value) || !screen.label) fail(`${what}: a stat screen needs a whole-number "value" and a "label"`)
      break
    case 'phone':
      if (inPhone) fail(`${what}: a phone screen cannot wrap another phone`)
      checkScreen(screen.screen, `${what} (inside the phone)`, fail, true)
      if (screen.action?.icon !== undefined) checkIcon(screen.action.icon, what, fail)
      for (const t of screen.tabs ?? []) checkIcon(t.icon, what, fail)
      break
  }
}

function checkAnchors(anchors: Record<string, Anchor> | undefined, what: string, lines: Set<string>, scenes: Set<string>, fail: Fail) {
  for (const [name, a] of Object.entries(anchors ?? {})) {
    if (!a || typeof a !== 'object') fail(`${what}: anchor "${name}" must be { "line", "word", "offsetMs" } or { "scene", "offsetMs" }`)
    if ('scene' in a) {
      if (!scenes.has(a.scene)) fail(`${what}: anchor "${name}" points at scene "${a.scene}", which is not one of ${list([...scenes])}`)
    } else if (a.line !== undefined && !lines.has(a.line)) fail(`${what}: anchor "${name}" uses line "${a.line}", which is not in "lines"`)
  }
}

/** The synth plays 40–240 bpm (cli/audio/synth.ts). */
export const BPM_RANGE = [40, 240] as const
function checkMusic(music: { bpm?: number; gainDb?: number } | undefined, fail: Fail) {
  if (music?.bpm !== undefined && !(music.bpm >= BPM_RANGE[0] && music.bpm <= BPM_RANGE[1])) fail(`music.bpm must be ${BPM_RANGE[0]}–${BPM_RANGE[1]} (got ${music.bpm})`)
  if (music?.gainDb !== undefined && !Number.isFinite(music.gainDb)) fail('music.gainDb must be a number')
}

function validateWalk(spec: WalkSpec, where: string, fail: Fail, brand?: Brand) {
  checkMusic(spec.music, fail)
  if (!spec.voice?.use) fail('voice.use is required (e.g. "af_heart" or "chatterbox")')
  const lineIds = checkLines(spec.lines, where, fail)
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) fail('a walk needs "steps": [{ "id", "label", "icon", "screen" }, …]')
  const stepIds = new Set<string>()
  for (const s of spec.steps) {
    if (!s?.id) fail('every step needs an "id"')
    if (s.id === 'hook' || s.id === 'logo') fail(`step id "${s.id}" is taken by the walk's own ${s.id} scene; rename the step`)
    if (stepIds.has(s.id)) fail(`step "${s.id}" is defined twice`)
    stepIds.add(s.id)
    if (!s.label) fail(`step "${s.id}" needs a "label" (the tracker shows it)`)
    checkIcon(s.icon, `step "${s.id}"`, fail)
    checkScreen(s.screen, `step "${s.id}"`, fail)
  }
  const sceneIds = new Set(['hook', ...stepIds, 'logo'])
  for (const s of spec.steps) checkAnchors(s.anchors, `step "${s.id}"`, lineIds, sceneIds, fail)
  const cuts = cutsOf(spec)
  if (cuts.length === 0) fail('a walk needs "cuts": { "long": { "steps": [{ "step", "lines" }, …], "logo": { "lines" } } }')
  const usesLines = (lines: string[] | undefined, what: string) => {
    if (!Array.isArray(lines) || lines.length === 0) fail(`${what} needs "lines": ["<line id>", …]`)
    for (const l of lines!) if (!lineIds.has(l)) fail(`${what} uses line "${l}", which is not in "lines"`)
  }
  for (const name of cuts) {
    const cut = spec.cuts[name]
    const what = `cut "${name}"`
    if (cut.hook) {
      if (!spec.hook?.headline) fail(`${what} has a hook scene, but the spec has no "hook": { "headline" }`)
      usesLines(cut.hook.lines, `${what}'s hook`)
    }
    if (!Array.isArray(cut.steps) || cut.steps.length === 0) fail(`${what} needs "steps": [{ "step": "<step id>", "lines": [...] }, …]`)
    const seen = new Set<string>()
    for (const cs of cut.steps) {
      if (!stepIds.has(cs.step)) fail(`${what} shows step "${cs.step}", which is not in "steps"`)
      if (seen.has(cs.step)) fail(`${what} shows step "${cs.step}" twice`)
      seen.add(cs.step)
      usesLines(cs.lines, `${what}'s step "${cs.step}"`)
      checkAnchors(cs.anchors, `${what}'s step "${cs.step}"`, lineIds, sceneIds, fail)
    }
    if (!cut.logo) fail(`${what} needs a "logo": { "lines": [...] } (the close)`)
    usesLines(cut.logo.lines, `${what}'s logo`)
    checkAnchors(cut.logo.anchors, `${what}'s logo`, lineIds, sceneIds, fail)
    for (const sc of cut.hideCaptionsIn ?? []) if (!sceneIds.has(sc)) fail(`${what}: hideCaptionsIn has "${sc}", which is not one of ${list([...sceneIds])}`)
  }
  if (brand && !(spec.close?.cta ?? brand.outro?.cta)) fail('the close needs a call to action: set close.cta (or brand.json outro.cta)')
}

function validateLaunch(spec: LaunchSpec, where: string, fail: Fail, brand?: Brand) {
  const extra = spec as { voice?: unknown; lines?: unknown }
  if (extra.voice !== undefined || extra.lines !== undefined) process.stderr.write(`note: ${where} is a launch film (music only): its "voice" and "lines" are not used.\n`)
  checkMusic(spec.music, fail)
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) fail(`a launch film needs "scenes": [{ "id", "kind": ${LAUNCH_KINDS.map((k) => `"${k}"`).join(' | ')}, "seconds" }, …]`)
  const ids = new Set<string>()
  for (const s of spec.scenes) {
    if (!s?.id) fail('every scene needs an "id"')
    if (ids.has(s.id)) fail(`scene "${s.id}" is defined twice`)
    ids.add(s.id)
    const what = `scene "${s.id}"`
    if (!LAUNCH_KINDS.includes(s.kind)) fail(`${what}: kind "${s.kind}" is not one of ${list(LAUNCH_KINDS)}`)
    if (typeof s.seconds !== 'number' || !(s.seconds > 0)) fail(`${what} needs "seconds" (how long it runs, > 0)`)
    // a screen or payoff needs time for its cursor, press and done state (or its cards and checkmarks) to read
    if (s.kind === 'screen' || s.kind === 'payoff') {
      if (s.seconds < 1) fail(`${what}: a ${s.kind} scene needs at least 1 second (it has ${s.seconds}); 1.5 or more reads well`)
      if (s.seconds < 1.5) process.stderr.write(`note: ${where} ${what} runs ${s.seconds} s; a ${s.kind} scene reads better with 1.5 s or more.\n`)
    }
    switch (s.kind) {
      case 'hook':
        if (!Array.isArray(s.headline) || s.headline.length === 0 || s.headline.some((h) => !h?.text)) fail(`${what}: a hook needs "headline": [{ "text" }, …]`)
        break
      case 'screen':
        checkScreen(s.screen, what, fail)
        break
      case 'payoff':
        if (!Array.isArray(s.cards) || s.cards.length === 0 || s.cards.some((c) => !c?.title)) fail(`${what}: a payoff needs "cards": [{ "title" }, …]`)
        for (const c of s.cards) if (c.icon !== undefined) checkIcon(c.icon, what, fail)
        break
      case 'logo':
        if (brand && !(s.cta ?? brand.outro?.cta)) fail(`${what} needs a call to action: set "cta" (or brand.json outro.cta)`)
        break
    }
  }
}

const isPoint = (pt: unknown): pt is [number, number] => Array.isArray(pt) && pt.length === 2 && pt.every((n) => typeof n === 'number' && Number.isFinite(n))
const inPublic = (publicDir: string | undefined, file: string) => !publicDir || fs.existsSync(path.join(publicDir, file))

function validateReplace(spec: ReplaceSpec, where: string, fail: Fail, brand?: Brand, publicDir?: string) {
  const extra = spec as { voice?: unknown; lines?: unknown }
  if (extra.voice !== undefined || extra.lines !== undefined) process.stderr.write(`note: ${where} is a replace ad (music only): its "voice" and "lines" are not used.\n`)
  checkMusic(spec.music, fail)
  if (typeof spec.headline !== 'string' || !spec.headline.trim()) fail('a replace ad needs a "headline": the line at the top, e.g. "Replace all your team tools"')
  if (spec.headline.split('\n').length > 2) fail('the "headline" takes one or two lines (it has more than one line break)')
  const [minS, maxS] = REPLACE_SECONDS_RANGE
  if (spec.seconds !== undefined && !(typeof spec.seconds === 'number' && spec.seconds >= minS && spec.seconds <= maxS)) fail(`"seconds" must be ${minS}–${maxS} (got ${spec.seconds})`)
  const seconds = spec.seconds ?? REPLACE_SECONDS
  if (spec.stillAt !== undefined && !(typeof spec.stillAt === 'number' && spec.stillAt >= 0 && spec.stillAt <= seconds)) fail(`"stillAt" must be a moment in the video, 0–${seconds} s (got ${spec.stillAt})`)

  if (!Array.isArray(spec.tools) || spec.tools.length < 2 || spec.tools.length > 8) fail(`a replace ad needs 2–8 "tools": [{ "icon": ${TOOL_ICONS.map((i) => `"${i}"`).join(' | ')} }, …] (got ${Array.isArray(spec.tools) ? spec.tools.length : 'none'})`)
  for (const [i, t] of spec.tools.entries()) {
    const what = `tool ${i + 1}${t?.label ? ` ("${t.label}")` : ''}`
    if (!t || typeof t !== 'object') fail(`${what} must be { "icon" } or { "image" }`)
    if (t.icon === undefined && t.image === undefined) fail(`${what} needs an "icon" (one of ${list(TOOL_ICONS)}) or an "image" (a file under public/)`)
    if (t.icon !== undefined && t.image !== undefined) fail(`${what} has both an "icon" and an "image": keep one`)
    if (t.icon !== undefined && !TOOL_ICONS.includes(t.icon)) fail(`${what}: icon "${t.icon}" is not one of ${list(TOOL_ICONS)}`)
    if (t.image !== undefined && (typeof t.image !== 'string' || !inPublic(publicDir, t.image))) fail(`${what}: image "${t.image}" is not in public/`)
  }
  if (spec.scribble?.seed !== undefined && !Number.isFinite(spec.scribble.seed)) fail('scribble.seed must be a number')

  const screen = spec.screen
  if (!screen || typeof screen !== 'object') fail(`a replace ad needs a "screen" for its phone: { "kind": ${REPLACE_SCREEN_KINDS.map((k) => `"${k}"`).join(' | ')}, … }`)
  if (!REPLACE_SCREEN_KINDS.includes(screen.kind)) fail(`the screen: kind "${screen.kind}" is not one of ${list(REPLACE_SCREEN_KINDS)}`)
  if (screen.kind === 'pitch') checkPitch(screen, fail)
  else checkScreen(screen, 'the screen', fail, true)

  const bg = spec.background
  if (bg !== undefined) {
    if (!bg || typeof bg !== 'object') fail('"background" must be { "image" or "video", "screen": [[x, y] × 4] }')
    if ((bg.image === undefined) === (bg.video === undefined)) fail('the background needs exactly one of "image" and "video" (a file under public/)')
    const media = (bg.image ?? bg.video)!
    if (typeof media !== 'string' || !inPublic(publicDir, media)) fail(`the background's ${bg.image !== undefined ? 'image' : 'video'} "${media}" is not in public/`)
    if (!Array.isArray(bg.screen) || bg.screen.length !== 4 || !bg.screen.every(isPoint)) fail('background.screen must be the phone screen\'s four corners in the source\'s pixels: [[x, y] top-left, top-right, bottom-right, bottom-left]')
    if (bg.dim !== undefined && !(typeof bg.dim === 'number' && bg.dim >= 0 && bg.dim <= REPLACE_DIM_MAX)) fail(`background.dim must be 0–${REPLACE_DIM_MAX} (got ${bg.dim})`)
  }
  if (brand && !brand.outro?.cta) fail('the close needs a call to action: set brand.json outro.cta')
}

function checkPitch(screen: PitchScreen, fail: Fail) {
  if (typeof screen.title !== 'string' || !screen.title) fail('the pitch screen needs a "title"')
  const n = Array.isArray(screen.buttons) ? screen.buttons.length : 0
  if (n < 1 || n > 2) fail(`the pitch screen needs one or two "buttons": [{ "label" }, …] (got ${n})`)
  for (const b of screen.buttons) {
    if (!b?.label) fail('every pitch button needs a "label"')
    if (b.style !== undefined && b.style !== 'primary' && b.style !== 'secondary') fail(`pitch button "${b.label}": style "${b.style}" is not one of primary, secondary`)
  }
}

/** The spec with its brand merged in and project-relative media staged into public/, ready to be the Reel's props. */
export function buildProps(p: Project, spec: ReelSpec): Resolved {
  const r = resolveSpec(spec, p.brand)
  r.scenes = r.scenes.map((s) => {
    if (s.type !== 'showcase') return s
    const sc = s as ShowcaseScene
    return { ...sc, src: stage(p, sc.src) }
  })
  return r
}

/** A showcase `src` may point outside public/ (e.g. "../generic/out/todo.mp4"): copy it to public/_staged/ and use that. */
function stage(p: Project, src: string): string {
  const inPublic = path.join(p.publicDir, src)
  if (!src.startsWith('.') && fs.existsSync(inPublic)) return src
  const abs = path.resolve(p.dir, src)
  if (!fs.existsSync(abs)) throw new Error(`showcase src "${src}" not found (looked in public/ and relative to ${p.dir})`)
  const rel = `_staged/${path.basename(abs)}`
  const dst = path.join(p.publicDir, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(abs).mtimeMs) fs.copyFileSync(abs, dst)
  return rel
}

/** The Remotion composition each style renders with. */
export const COMPOSITION = { recorded: 'Reel', walk: 'Walk', launch: 'Launch', replace: 'Replace' } as const satisfies Record<Style, string>

/** A video's file name under out/, without .mp4: <id>, then -<cut> (walks with several cuts), then -16x9 / -1x1 / -4x5. */
export const outputName = (id: string, format: Format, cut?: string) => [id, cut, format === '9x16' ? undefined : format].filter(Boolean).join('-')

/** The file names (out/<name>.mp4, also the manifest ids) a spec renders to, without resolving its props. */
export function outputNames(spec: VideoSpec): string[] {
  const formats = formatsOf(spec)
  if (spec.style === 'walk') {
    const cuts = cutsOf(spec)
    return cuts.flatMap((cut) => formats.map((f) => outputName(spec.id, f, cuts.length > 1 ? cut : undefined)))
  }
  if (spec.style === 'launch' || spec.style === 'replace') return formats.map((f) => outputName(spec.id, f))
  return [outputName(spec.id, '9x16')]
}

/** Whether a spec's videos each come with a still image (out/<name>.png): replace ads do. */
export const makesStills = (spec: VideoSpec): boolean => styleOf(spec) === 'replace'

/** A video's still, next to it: out/<name>.mp4 → out/<name>.png. */
export const stillFile = (video: string) => video.replace(/\.mp4$/, '') + '.png'

/** The frame a still is taken at: `stillAt` seconds (rounded to a frame, kept inside the video), or the last frame. */
export function stillFrame(stillAt: number | undefined, fps: number, durationInFrames: number): number {
  const last = Math.max(0, durationInFrames - 1)
  if (stillAt === undefined) return last
  return Math.min(last, Math.max(0, Math.round(stillAt * fps)))
}

/** One video to render: a spec in one format (and, for a walk, one cut), with the props its composition gets. */
export type RenderJob = {
  style: Style
  composition: (typeof COMPOSITION)[Style]
  format: Format
  cut?: string
  width: number
  height: number
  /** out/<name>.mp4, and the manifest entry's id. */
  name: string
  /** A still image to take after the video (out/<name>.png): at `at` seconds, or the last frame. Replace ads only. */
  still?: { at?: number }
  props: Resolved | ResolvedWalk | ResolvedLaunch | ResolvedReplace
}

export type MediaSize = { width: number; height: number }

/**
 * An image's or a video's size in px, as it is shown: a video's rotation (a phone clip shot upright) swaps width and
 * height.
 */
export function probeMediaSize(file: string): MediaSize {
  const out = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_tags=rotate:stream_side_data=rotation', '-of', 'json', file])) as {
    streams?: { width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[]
  }
  const s = out.streams?.[0]
  if (!s?.width || !s?.height) throw new Error(`could not read the size of ${file}`)
  const rotation = Number(s.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? s.tags?.rotate ?? 0)
  return Math.abs(rotation) % 180 === 90 ? { width: s.height, height: s.width } : { width: s.width, height: s.height }
}

/** A replace ad in one format as the Replace composition's props: with a background, its size, and its corners checked against it. */
export function replaceProps(spec: ReplaceSpec, brand: Brand, format: ReplaceFormat, bgSize?: MediaSize): ResolvedReplace {
  const bg = spec.background
  if (bg && bgSize) {
    const outside = bg.screen.find(([x, y]) => x < 0 || y < 0 || x > bgSize.width || y > bgSize.height)
    if (outside) throw new Error(`${spec.id}: background.screen corner [${outside.join(', ')}] is outside the ${bg.image ? 'image' : 'video'} (${bgSize.width}×${bgSize.height} px)`)
  }
  return resolveReplace(spec, brand, format, bgSize)
}

/**
 * Every video a spec makes: a recorded reel → one; a walk → one per cut; a launch film or a replace ad → one per format.
 * A replace ad's background is measured with `probe` (default ffprobe on the file in public/).
 */
export function renderJobs(p: Project, spec: VideoSpec, opts: { probe?: (file: string) => MediaSize } = {}): RenderJob[] {
  const formats = formatsOf(spec)
  if (spec.style === 'walk') {
    const cuts = cutsOf(spec)
    return cuts.flatMap((cut) =>
      formats.map((format) => {
        const props = resolveWalk(spec, p.brand, cut, format)
        return { style: 'walk' as const, composition: COMPOSITION.walk, format, cut, width: props.width, height: props.height, name: outputName(spec.id, format, cuts.length > 1 ? cut : undefined), props }
      }),
    )
  }
  if (spec.style === 'launch') {
    return formats.map((format) => {
      const props = resolveLaunch(spec, p.brand, format)
      return { style: 'launch' as const, composition: COMPOSITION.launch, format, width: props.width, height: props.height, name: outputName(spec.id, format), props }
    })
  }
  if (spec.style === 'replace') {
    const bg = spec.background
    const bgSize = bg ? (opts.probe ?? probeMediaSize)(path.join(p.publicDir, (bg.image ?? bg.video)!)) : undefined
    return formats.map((f) => {
      const format = f as ReplaceFormat
      const props = replaceProps(spec, p.brand, format, bgSize)
      return { style: 'replace' as const, composition: COMPOSITION.replace, format, width: props.width, height: props.height, name: outputName(spec.id, format), still: { at: spec.stillAt }, props }
    })
  }
  const props = buildProps(p, spec)
  return [{ style: 'recorded', composition: COMPOSITION.recorded, format: '9x16', width: props.width, height: props.height, name: outputName(spec.id, '9x16'), props }]
}

/** The kit's shared files every project's public/ needs (the tap sound). */
export function ensurePublic(p: Project) {
  const sfx = path.join(p.publicDir, 'sfx', 'tap.wav')
  if (!fs.existsSync(sfx)) {
    fs.mkdirSync(path.dirname(sfx), { recursive: true })
    fs.copyFileSync(path.join(KIT, 'assets', 'sfx', 'tap.wav'), sfx)
  }
}

/** The folders under public/ whose recordings a reel's phone scenes use. */
export function clipsDirsOf(spec: VideoSpec): string[] {
  if (styleOf(spec) !== 'recorded') return []
  return [...new Set((spec as ReelSpec).scenes.filter((s) => s.type === 'phone').map((s) => (s as PhoneScene).clipsDir))]
}

export const rel = (p: Project, abs: string) => path.relative(p.dir, abs).split(path.sep).join('/')
